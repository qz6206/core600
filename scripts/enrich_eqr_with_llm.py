#!/usr/bin/env python3
"""
EQR LLM 富化脚本 — 给每只 is_recent=True 的股票, 用 DeepSeek-V3.2 抽出:
  1) data_card.third_metric        (按 sector 映射的行业第三指标)
  2) data_card.rev_yoy_pct_alt     (业务剥离场景的"可比口径")
  3) guidance                      (下一季度区间 + 共识对比)
  4) narrative                     (3 个主题 + tone + tone_evidence)

输入:
  - data/earnings_interpretations.json
  - data/transcripts.json (中文翻译版)
  - data/stocks.json (sector / industry)

输出: 原地更新 earnings_interpretations.json

────────────────────────────────────────────────────────────
4 层成本控制 (吸取上次 ¥450 教训):
  1) 预检余额 — 启动时查 SiliconFlow balance, < BALANCE_FLOOR 就停
  2) Circuit breaker — 连续 N 次失败就停 (CIRCUIT_BREAKER_THRESHOLD)
  3) Sample mode — 默认只跑前 SAMPLE_LIMIT 只, --all 才跑全量
  4) Hard cap — 累计 token cost > MAX_BUDGET_CNY 就立刻停
────────────────────────────────────────────────────────────

用法:
  python3 scripts/enrich_eqr_with_llm.py            # 默认采样 10 只
  python3 scripts/enrich_eqr_with_llm.py --all      # 全量
  python3 scripts/enrich_eqr_with_llm.py --tickers APP,ADBE   # 指定列表
"""
from __future__ import annotations

import argparse
import json
import os
import sys
import time
from datetime import datetime
from pathlib import Path
from typing import Any

import requests

ROOT = Path(__file__).parent.parent
DATA_DIR = ROOT / "data"
INTERP_FILE = DATA_DIR / "earnings_interpretations.json"
TRANSCRIPT_FILE = DATA_DIR / "transcripts.json"
STOCKS_FILE = DATA_DIR / "stocks.json"

API_URL = "https://api.siliconflow.cn/v1/chat/completions"
USER_URL = "https://api.siliconflow.cn/v1/user/info"
MODEL = "deepseek-ai/DeepSeek-V3.2-Exp"  # ¥2/M in, ¥8/M out, 跟 V3 同价

# ====== 4 层成本控制 ======
SAMPLE_LIMIT = 10                # 默认只跑前 10 只
CIRCUIT_BREAKER_THRESHOLD = 30   # 连续 30 次失败就停
BALANCE_FLOOR_CNY = 20.0         # 余额 < ¥20 就拒跑
MAX_BUDGET_CNY = 100.0           # 累计花费 > ¥100 立刻停

# Token 价格 (V3.2 Exp 跟 V3 同价)
PRICE_IN_PER_M = 2.0   # ¥/M tokens
PRICE_OUT_PER_M = 8.0

# 单次调用上限
MAX_INPUT_TOKENS = 6000  # transcript 截断
MAX_OUTPUT_TOKENS = 3500  # 一开始 1500/2200 都遇到截断, 拉到 3500 一次性解决

# Transcript 字符截断 (中文 ~ 2 char/token)
MAX_TRANSCRIPT_CHARS = 12000

# ====== Sector → third_metric 映射 ======
SECTOR_THIRD_METRIC: dict[str, dict[str, Any]] = {
    "Information Technology": {
        "label": "Adj EBITDA Margin",
        "format": "pct",
        "hint": "电话会议里通常出现'Adjusted EBITDA Margin'或'调整后 EBITDA 利润率', 不要拿 GAAP Op Margin 凑数",
    },
    "Communication Services": {
        "label": "Adj EBITDA Margin",
        "format": "pct",
        "hint": "广告/社媒/游戏类用 Adj EBITDA Margin",
    },
    "Consumer Discretionary": {
        "label": "Comparable Sales / Same-Store Sales",
        "format": "pct",
        "hint": "零售/餐饮看同店销售, 例如 'comp sales +5%'",
    },
    "Consumer Staples": {
        "label": "Organic Sales Growth",
        "format": "pct",
        "hint": "宝洁/可口可乐看 organic growth, 例如 '+4%'",
    },
    "Health Care": {
        "label": "Adj EBITDA Margin",
        "format": "pct",
        "hint": "Pharma/Biotech 也用 Adj EBITDA, Devices 同样",
    },
    "Financials": {
        "label": "Net Interest Margin / AUM Growth",
        "format": "pct",
        "hint": "银行 = NIM, 资管 = AUM YoY, 保险 = Combined Ratio",
    },
    "Industrials": {
        "label": "Adj EBITDA Margin / Order Backlog",
        "format": "pct",
        "hint": "工业用 Adj EBITDA Margin 或 Backlog YoY",
    },
    "Energy": {
        "label": "Production / Realized Price",
        "format": "raw",
        "hint": "油气产量 (BOE/d) 或实现价格",
    },
    "Utilities": {
        "label": "Rate Base Growth",
        "format": "pct",
        "hint": "公用事业 rate base 增速",
    },
    "Real Estate": {
        "label": "FFO Growth (Funds From Operations)",
        "format": "pct",
        "hint": "REIT 用 FFO/AFFO 增速, 例如 '+3%'",
    },
    "Materials": {
        "label": "Realized Price / Volume",
        "format": "raw",
        "hint": "金属/化工 看价格 + 销量",
    },
}

DEFAULT_THIRD_METRIC = {
    "label": "Adj EBITDA Margin",
    "format": "pct",
    "hint": "电话会议里的 Adj EBITDA Margin (默认)",
}


def get_third_metric_hint(sector: str) -> dict:
    return SECTOR_THIRD_METRIC.get(sector, DEFAULT_THIRD_METRIC)


# ====== Prompt ======

PROMPT_TEMPLATE = """你是资深美股财报分析师, 仅基于下方电话会议中文翻译, 抽出 4 项结构化数据。

公司: {ticker} {name}
行业: {sector} / {industry}
本季: {fiscal_label} (财报日 {earnings_date})
本季 EPS Beat: {eps_surprise:+.1f}%, 营收 YoY: {rev_yoy:+.1f}%

行业第三指标提示: 应抽出 **{tm_label}**, {tm_hint}

【电话会议中文翻译 (节选)】
{transcript_excerpt}

【任务】严格输出以下 JSON 格式 (不要任何额外文字, 不要 ``` 代码块):
{{
  "third_metric": {{
    "label": "{tm_label}",
    "actual": <数值, 比例用 0-1 小数 (如 0.85), 金额用 USD>,
    "format": "{tm_format}",
    "estimate": <华尔街共识, 没提就 null>,
    "surprise_pct": <vs 共识 %, 没提就 null>,
    "yoy_change_pp": <同比 pp 或 null>,
    "note": "<中文 10 字内点评 (例如: '创纪录' / '超预期 2pp')>",
    "note_en": "<English version, ~5 words (e.g. 'Record' / 'Beat by 2pp')>"
  }},
  "rev_yoy_pct_alt": {{
    "value": <某业务剥离/可比口径下的同比 %, 如电话会议里说"剔除某业务后同比 +XX%"; 没有就 null>,
    "label": "<中文标签, 例: '软件平台单独' / '剔除汇率影响' / '剔除剥离业务'; 没有就 null>",
    "label_en": "<English version, e.g. 'Software platform only' / 'Constant currency' / 'Excluding divestitures'; null if no value>"
  }},
  "guidance": {{
    "next_period_label": "<例: 'Q2 2026' / 'FY2026'>",
    "items": [
      {{"metric": "营收", "metric_en": "Revenue", "range": "<原文区间, 例 '$1,920-1,950M'>", "midpoint": <数值, USD or pct>, "vs_consensus_pct": <数值 or null>, "format": "usd"}},
      {{"metric": "Adj EBITDA", "metric_en": "Adj EBITDA", "range": "...", "midpoint": <数值>, "vs_consensus_pct": <数值 or null>, "format": "usd"}}
    ],
    "annual_note": "<中文全年指引一句话, 没给就 '未给指引'>",
    "annual_note_en": "<English version of annual_note>",
    "summary_tone": "<raise / maintain / lower / mixed>",
    "summary_text": "<中文一句话评价指引: 例 '高出共识 2.4%, 隐含下季软件平台 +53% 仍高速'>"
  }},
  "narrative": {{
    "themes": [
      {{"title": "<中文主题标题, 12 字内, 加 emoji>", "title_en": "<English title, ~10 words>", "detail": "<60-100 字中文>", "detail_en": "<English detail, ~80-120 words, similar content>"}},
      {{"title": "...", "title_en": "...", "detail": "...", "detail_en": "..."}},
      {{"title": "...", "title_en": "...", "detail": "...", "detail_en": "..."}}
    ],
    "tone": "<confident / cautious / mixed>",
    "tone_evidence": "<30-60 字中文>",
    "tone_evidence_en": "<English version of tone_evidence, ~40-80 words>"
  }},
  "guidance_summary_text_en": "<English version of guidance.summary_text>"
}}

规则:
- 没找到的字段一律填 null, 不要瞎编
- 数值不要带 $ 或 % 符号 (按格式说明)
- third_metric.actual 比例类务必用小数 (0.85 不是 85)
- guidance.items 至少 1 项最多 3 项, 没给指引就空数组 []
- narrative.themes 必须 3 项, 真的没料就用本季亮点 (回购 / 利润率扩张 / 增长加速等)
- 双语字段: 中文版优先专业财经汉语; 英文版用专业财经英文 (e.g. Beat → Beat, FCF → FCF, Adj EBITDA → Adj EBITDA)
"""


def call_llm(prompt: str, api_key: str) -> tuple[dict | None, dict]:
    """返回 (parsed_json, usage_dict). usage 含 input_tokens / output_tokens / cost_cny / status_code"""
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }
    payload = {
        "model": MODEL,
        "messages": [
            {"role": "system", "content": "你是结构化数据抽取助手, 严格输出 JSON, 不要解释, 不要 markdown 代码块。"},
            {"role": "user", "content": prompt},
        ],
        "max_tokens": MAX_OUTPUT_TOKENS,
        "temperature": 0.1,
        "response_format": {"type": "json_object"},
    }
    usage = {"input_tokens": 0, "output_tokens": 0, "cost_cny": 0.0, "status_code": 0, "error": None}
    try:
        r = requests.post(API_URL, headers=headers, json=payload, timeout=90)
        usage["status_code"] = r.status_code
        if r.status_code != 200:
            usage["error"] = f"HTTP {r.status_code}: {r.text[:200]}"
            return None, usage
        data = r.json()
        u = data.get("usage", {}) or {}
        usage["input_tokens"] = u.get("prompt_tokens", 0)
        usage["output_tokens"] = u.get("completion_tokens", 0)
        usage["cost_cny"] = (
            usage["input_tokens"] / 1_000_000 * PRICE_IN_PER_M
            + usage["output_tokens"] / 1_000_000 * PRICE_OUT_PER_M
        )
        content = data["choices"][0]["message"]["content"]
        return json.loads(content), usage
    except json.JSONDecodeError as e:
        usage["error"] = f"json parse: {e}"
        return None, usage
    except Exception as e:
        usage["error"] = str(e)
        return None, usage


def check_balance(api_key: str) -> float | None:
    """返回 SiliconFlow 总可用余额 (¥), 失败返回 None
    SiliconFlow 把余额拆成 balance(赠送) + chargeBalance(充值), 实际可用是 totalBalance
    """
    try:
        r = requests.get(USER_URL, headers={"Authorization": f"Bearer {api_key}"}, timeout=15)
        if r.status_code != 200:
            return None
        data = r.json().get("data", {})
        return float(data.get("totalBalance") or data.get("balance") or 0)
    except Exception:
        return None


def truncate_transcript(content_cn: str) -> str:
    """前 60% + 后 40% 拼接, 保留开场和 Q&A 高潮"""
    if len(content_cn) <= MAX_TRANSCRIPT_CHARS:
        return content_cn
    head_n = int(MAX_TRANSCRIPT_CHARS * 0.6)
    tail_n = MAX_TRANSCRIPT_CHARS - head_n
    return content_cn[:head_n] + "\n\n... [中间省略] ...\n\n" + content_cn[-tail_n:]


def merge_into_record(rec: dict, llm_out: dict) -> None:
    """把 LLM 输出合并进现有 record"""
    tm = llm_out.get("third_metric")
    if isinstance(tm, dict) and tm.get("actual") is not None:
        rec.setdefault("data_card", {})["third_metric"] = {
            "label": tm.get("label") or "Adj EBITDA Margin",
            "actual": tm.get("actual"),
            "format": tm.get("format") or "pct",
            "estimate": tm.get("estimate"),
            "surprise_pct": tm.get("surprise_pct"),
            "yoy_change_pp": tm.get("yoy_change_pp"),
            "note": tm.get("note"),
            "note_en": tm.get("note_en"),  # ⭐ 双语
        }

    alt = llm_out.get("rev_yoy_pct_alt")
    if isinstance(alt, dict) and alt.get("value") is not None:
        rec.setdefault("data_card", {})["rev_yoy_pct_alt"] = alt.get("value")
        rec["data_card"]["rev_yoy_pct_alt_label"] = alt.get("label")
        rec["data_card"]["rev_yoy_pct_alt_label_en"] = alt.get("label_en")  # ⭐ 双语

    g = llm_out.get("guidance")
    if isinstance(g, dict) and g.get("items"):
        # items 已含 metric / metric_en, 直接透传
        rec["guidance"] = {
            "next_period_label": g.get("next_period_label") or "下一财报",
            "items": g.get("items") or [],
            "annual_note": g.get("annual_note"),
            "annual_note_en": g.get("annual_note_en"),  # ⭐ 双语
            "summary_tone": g.get("summary_tone") or "maintain",
            "summary_text": g.get("summary_text"),
            "summary_text_en": llm_out.get("guidance_summary_text_en"),  # ⭐ 双语
        }

    n = llm_out.get("narrative")
    if isinstance(n, dict) and n.get("themes"):
        # Sanitize themes: 只保留有 title + detail 的 dict, 最多 3 个
        # 同时保留 title_en / detail_en 双语字段
        clean_themes: list[dict] = []
        salvage_evidence = None
        for t in n.get("themes") or []:
            if isinstance(t, dict) and t.get("title") and t.get("detail"):
                theme = {
                    "title": str(t["title"]),
                    "detail": str(t["detail"]),
                }
                # 双语字段 (可选, LLM 没填则没有)
                if t.get("title_en"):
                    theme["title_en"] = str(t["title_en"])
                if t.get("detail_en"):
                    theme["detail_en"] = str(t["detail_en"])
                clean_themes.append(theme)
            elif isinstance(t, str) and "tone_evidence" in t.lower():
                # LLM 偶尔把 tone_evidence 错串到 themes 里, 抢救一下
                salvage_evidence = t
        clean_themes = clean_themes[:3]

        evidence = n.get("tone_evidence")
        if not evidence and salvage_evidence:
            # 从错位字符串里抠出 evidence 内容 (取冒号后的部分)
            for sep in ['":', "”:", ":", "："]:
                idx = salvage_evidence.find(sep)
                if idx > 0:
                    evidence = salvage_evidence[idx+1:].strip(' "“”')[:300]
                    break

        rec["narrative"] = {
            "themes": clean_themes,
            "tone": n.get("tone") or "mixed",
            "tone_evidence": evidence,
            "tone_evidence_en": n.get("tone_evidence_en"),  # ⭐ 新: 英文版
            "generated_by": MODEL,
            "generated_at": datetime.now().isoformat(),
            "schema_version": 2,  # v2 = 双语 schema
        }
        rec["narrative_status"] = "done"


def main() -> int:
    # 开 line-buffered, 让 log 实时可见 (上次重定向到文件时 print 不显示就是这个原因)
    sys.stdout.reconfigure(line_buffering=True)

    p = argparse.ArgumentParser()
    p.add_argument("--all", action="store_true", help="跑全量, 默认只采样前 10 只")
    p.add_argument("--tickers", type=str, default=None, help="指定 ticker 列表, 逗号分隔, 优先级最高")
    p.add_argument("--force", action="store_true", help="强制重跑已 done 的")
    args = p.parse_args()

    api_key = os.environ.get("SILICONFLOW_API_KEY")
    if not api_key:
        print("❌ SILICONFLOW_API_KEY 未设置", file=sys.stderr)
        return 1

    # 1) 预检余额
    bal = check_balance(api_key)
    print(f"💰 SiliconFlow 余额: ¥{bal:.2f}" if bal is not None else "⚠️  余额查询失败 (继续)")
    if bal is not None and bal < BALANCE_FLOOR_CNY:
        print(f"❌ 余额不足 ¥{BALANCE_FLOOR_CNY}, 拒绝运行 (避免 401 烧 prompt token)", file=sys.stderr)
        return 1

    # 加载数据
    interp = json.load(open(INTERP_FILE))
    transcripts = json.load(open(TRANSCRIPT_FILE))
    stocks = json.load(open(STOCKS_FILE))
    stocks_map = {s["ticker"]: s for s in stocks["stocks"]}

    by_ticker = interp["by_ticker"]
    trans_bt = transcripts.get("by_ticker", {})

    # 候选: is_recent=True + 有 transcript + 状态需要 LLM 处理
    # 跳过: done (已成功) / pending_transcript_lag (transcript 老一季) /
    #       transcript_unavailable_in_fmp (FMP 永远没有) / no_transcript (无)
    SKIP_STATUSES = {
        "done",
        "pending_transcript_lag",
        "transcript_unavailable_in_fmp",
        "no_transcript",
    }
    # 当前 schema 版本: v2 = 双语 (含 *_en 字段); v1/null = 仅中文, 需升级
    CURRENT_SCHEMA_VERSION = 2

    candidates: list[str] = []
    if args.tickers:
        candidates = [t.strip().upper() for t in args.tickers.split(",")]
    else:
        for tk, rec in by_ticker.items():
            if not rec.get("is_recent"):
                continue
            if tk not in trans_bt:
                continue
            if not args.force and rec.get("narrative_status") in SKIP_STATUSES:
                # ⭐ 例外: 已 done 但 schema 版本旧 → 升级双语
                if rec.get("narrative_status") == "done":
                    nar = rec.get("narrative") or {}
                    if nar.get("schema_version", 1) < CURRENT_SCHEMA_VERSION:
                        candidates.append(tk)
                continue
            candidates.append(tk)
        candidates.sort()

    if not args.all and not args.tickers:
        candidates = candidates[:SAMPLE_LIMIT]
        print(f"🎯 采样模式: 跑前 {SAMPLE_LIMIT} 只 (用 --all 跑全量)")

    print(f"📋 候选 {len(candidates)} 只: {candidates[:20]}{'...' if len(candidates) > 20 else ''}")

    # 跑 LLM
    consecutive_fail = 0
    total_cost = 0.0
    total_input = 0
    total_output = 0
    success = 0
    failed: list[tuple[str, str]] = []

    t0 = time.time()
    for i, tk in enumerate(candidates, 1):
        rec = by_ticker.get(tk)
        if not rec:
            failed.append((tk, "无 interpretation 记录"))
            continue
        trans = trans_bt.get(tk)
        if not trans or not trans.get("content_cn"):
            failed.append((tk, "无中文 transcript"))
            continue

        # ⭐ 季度对齐检查 (修 Bug 1: transcript 老一季时, narrative 引语跟数据卡矛盾)
        # transcript.year/quarter 必须等于 EQR 的 fiscal_label
        # 不对应就跳过, 等下次 transcript cron 拿到新一季再跑
        eqr_fiscal = rec.get("fiscal_label", "")
        t_year = trans.get("year")
        t_q = trans.get("quarter")
        if t_year and t_q:
            t_label = f"{t_year} Q{t_q}"
            if t_label != eqr_fiscal and not trans.get("is_annual_letter"):
                failed.append((tk, f"transcript 季度 {t_label} ≠ EQR {eqr_fiscal}, 跳过等 transcript 更新"))
                continue
        # is_annual_letter (BRK 等) 没 quarter, 不做对齐检查 (年度信不区分季度)

        stock = stocks_map.get(tk, {})
        sector = stock.get("sector", "")
        industry = stock.get("industry", "")
        tm_hint = get_third_metric_hint(sector)
        name = stock.get("name_cn") or stock.get("name", "")

        dc = rec.get("data_card", {})
        eps_s = dc.get("eps_surprise_pct") or 0
        rev_y = dc.get("rev_yoy_pct") or 0

        prompt = PROMPT_TEMPLATE.format(
            ticker=tk,
            name=name,
            sector=sector,
            industry=industry,
            fiscal_label=rec.get("fiscal_label", ""),
            earnings_date=rec.get("earnings_date", ""),
            eps_surprise=eps_s,
            rev_yoy=rev_y,
            tm_label=tm_hint["label"],
            tm_hint=tm_hint["hint"],
            tm_format=tm_hint["format"],
            transcript_excerpt=truncate_transcript(trans["content_cn"]),
        )

        out, usage = call_llm(prompt, api_key)
        total_cost += usage["cost_cny"]
        total_input += usage["input_tokens"]
        total_output += usage["output_tokens"]

        if usage["status_code"] in (401, 402, 403):
            print(f"❌ HTTP {usage['status_code']} — 余额/认证错, 立刻停: {usage['error']}", file=sys.stderr)
            break

        if total_cost > MAX_BUDGET_CNY:
            print(f"❌ 累计花费 ¥{total_cost:.2f} 超过 ¥{MAX_BUDGET_CNY} hard cap, 立刻停", file=sys.stderr)
            break

        if out is None:
            consecutive_fail += 1
            failed.append((tk, usage.get("error", "unknown")))
            print(f"  [{i}/{len(candidates)}] ❌ {tk} — {usage.get('error', '?')[:80]}")
            if consecutive_fail >= CIRCUIT_BREAKER_THRESHOLD:
                print(f"❌ 连续失败 {CIRCUIT_BREAKER_THRESHOLD} 次, 熔断退出", file=sys.stderr)
                break
            continue

        consecutive_fail = 0
        merge_into_record(rec, out)
        success += 1

        # ⭐ 每只立刻落盘 (避免中途崩溃丢失 — 上次烧 ¥6.18 的教训)
        # 单次写盘 ~50ms 可忽略, 但避免大批量数据丢失
        interp["generated_at"] = datetime.now().isoformat()
        try:
            with open(INTERP_FILE, "w") as f:
                json.dump(interp, f, ensure_ascii=False, indent=2)
        except Exception as e:
            print(f"  ⚠️  写盘失败 (继续): {e}", flush=True)

        elapsed = time.time() - t0
        print(
            f"  [{i}/{len(candidates)}] ✅ {tk} — "
            f"in={usage['input_tokens']} out={usage['output_tokens']} "
            f"¥{usage['cost_cny']:.4f} (累计 ¥{total_cost:.2f}) "
            f"{elapsed:.0f}s",
            flush=True,  # 也修上次 log 不显示进度的问题
        )

    # 末尾再写一次 (兜底, 也更新 generated_at)
    interp["generated_at"] = datetime.now().isoformat()
    with open(INTERP_FILE, "w") as f:
        json.dump(interp, f, ensure_ascii=False, indent=2)

    elapsed = time.time() - t0
    print(
        f"\n✅ 完成 — 成功 {success} / 候选 {len(candidates)} 失败 {len(failed)}\n"
        f"   用时 {elapsed:.0f}s\n"
        f"   Token 总入 {total_input:,} / 出 {total_output:,}\n"
        f"   花费 ¥{total_cost:.2f}\n"
        f"   写入 {INTERP_FILE.name}",
        flush=True,
    )
    if failed:
        print("\n❌ 失败列表 (前 10):")
        for tk, err in failed[:10]:
            print(f"   {tk}: {err[:80]}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
