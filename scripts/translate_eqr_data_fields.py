#!/usr/bin/env python3
"""一次性翻译 earnings_interpretations.json 里所有 EQR 的中文数据字段 → 加 _en 字段

要翻译的字段:
  - headline → headline_en
  - fundamentals[].text → text_en
  - kpis[].label → label_en, note → note_en
  - beat_quality.rating_label → rating_label_en, summary → summary_en
  - beat_quality.checks[].label → label_en, value → value_en, hint → hint_en
  - health.dimensions[].label → label_en, note → note_en
  - badges[].label → label_en, hint → hint_en

用法:
  python3 scripts/translate_eqr_data_fields.py            # 全量
  python3 scripts/translate_eqr_data_fields.py --tickers AAPL,COIN
  python3 scripts/translate_eqr_data_fields.py --force    # 强制重跑

成本估算: ~¥10, ~30-45 分钟 (单线程串行调 LLM)
"""
from __future__ import annotations

import argparse
import json
import os
import sys
import time
from datetime import datetime
from pathlib import Path

import requests

ROOT = Path(__file__).parent.parent
DATA_DIR = ROOT / "data"
INTERP_FILE = DATA_DIR / "earnings_interpretations.json"

API_URL = "https://api.siliconflow.cn/v1/chat/completions"
USER_URL = "https://api.siliconflow.cn/v1/user/info"
MODEL = "deepseek-ai/DeepSeek-V3.2-Exp"

BALANCE_FLOOR_CNY = 20.0
MAX_BUDGET_CNY = 50.0
PRICE_IN_PER_M = 2.0
PRICE_OUT_PER_M = 8.0


PROMPT_TEMPLATE = """你是金融英文翻译助手。把下面的中文金融术语短句翻译成对应英文。
保持简洁专业, 数字 / % / 美元金额原样保留, 不加引号。

输入 JSON: 中文 → 翻译结果 JSON 同样 key, 值是英文翻译。

【输入】
{json_str}

【输出】严格输出 JSON, 不要解释, 不要 markdown 代码块。所有 key 跟输入一致, value 是英文翻译。
"""


def check_balance(api_key: str) -> float | None:
    try:
        r = requests.get(USER_URL, headers={"Authorization": f"Bearer {api_key}"}, timeout=15)
        if r.status_code != 200:
            return None
        return float(r.json().get("data", {}).get("totalBalance") or 0)
    except Exception:
        return None


def collect_zh_fields(rec: dict) -> dict[str, str]:
    """收集一只 EQR 所有中文字段, 返回 flat dict (key 是路径, value 是中文)"""
    fields: dict[str, str] = {}

    if rec.get("headline"):
        fields["headline"] = rec["headline"]

    for i, f in enumerate(rec.get("fundamentals") or []):
        if f.get("text"):
            fields[f"fundamentals[{i}].text"] = f["text"]

    for i, k in enumerate(rec.get("kpis") or []):
        if k.get("label"):
            fields[f"kpis[{i}].label"] = k["label"]
        if k.get("note"):
            fields[f"kpis[{i}].note"] = k["note"]

    bq = rec.get("beat_quality") or {}
    if bq.get("rating_label"):
        fields["beat_quality.rating_label"] = bq["rating_label"]
    if bq.get("summary"):
        fields["beat_quality.summary"] = bq["summary"]
    for i, c in enumerate(bq.get("checks") or []):
        if c.get("label"):
            fields[f"beat_quality.checks[{i}].label"] = c["label"]
        if c.get("value"):
            fields[f"beat_quality.checks[{i}].value"] = c["value"]
        if c.get("hint"):
            fields[f"beat_quality.checks[{i}].hint"] = c["hint"]

    health = rec.get("health") or {}
    for i, d in enumerate(health.get("dimensions") or []):
        if d.get("label"):
            fields[f"health.dimensions[{i}].label"] = d["label"]
        if d.get("note"):
            fields[f"health.dimensions[{i}].note"] = d["note"]

    for i, b in enumerate(rec.get("badges") or []):
        if b.get("label"):
            fields[f"badges[{i}].label"] = b["label"]
        if b.get("hint"):
            fields[f"badges[{i}].hint"] = b["hint"]

    return fields


def write_back(rec: dict, translations: dict[str, str]) -> int:
    """把翻译结果写回 rec, 加 _en 后缀字段。返回写入的字段数"""
    written = 0
    for key, en_val in translations.items():
        if not en_val or not isinstance(en_val, str):
            continue
        # 解析 key, e.g. "fundamentals[0].text" → ["fundamentals", 0, "text"]
        parts: list = []
        cur = ""
        i = 0
        while i < len(key):
            c = key[i]
            if c == ".":
                if cur:
                    parts.append(cur)
                    cur = ""
            elif c == "[":
                if cur:
                    parts.append(cur)
                    cur = ""
                end = key.index("]", i)
                parts.append(int(key[i+1:end]))
                i = end
            else:
                cur += c
            i += 1
        if cur:
            parts.append(cur)

        # 加 _en 到最后一个 field name
        if isinstance(parts[-1], str):
            parts_en = parts[:-1] + [parts[-1] + "_en"]
        else:
            continue  # 不该发生

        # 设置值
        target = rec
        for p in parts_en[:-1]:
            if isinstance(p, int):
                if isinstance(target, list) and p < len(target):
                    target = target[p]
                else:
                    target = None
                    break
            else:
                if isinstance(target, dict):
                    target = target.setdefault(p, {})
                else:
                    target = None
                    break
        if target is None:
            continue
        last = parts_en[-1]
        if isinstance(last, str) and isinstance(target, dict):
            target[last] = en_val
            written += 1
    return written


def call_llm(fields: dict[str, str], api_key: str) -> tuple[dict | None, dict]:
    json_str = json.dumps(fields, ensure_ascii=False, indent=2)
    prompt = PROMPT_TEMPLATE.format(json_str=json_str)
    payload = {
        "model": MODEL,
        "messages": [
            {"role": "system", "content": "你是 JSON 翻译器, 严格输出有效 JSON, 不要解释。"},
            {"role": "user", "content": prompt},
        ],
        "max_tokens": 3500,
        "temperature": 0.1,
        "response_format": {"type": "json_object"},
    }
    usage = {"input_tokens": 0, "output_tokens": 0, "cost_cny": 0.0, "status_code": 0, "error": None}
    try:
        r = requests.post(
            API_URL,
            headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
            json=payload,
            timeout=120,
        )
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
        return json.loads(data["choices"][0]["message"]["content"]), usage
    except Exception as e:
        usage["error"] = str(e)
        return None, usage


def main() -> int:
    sys.stdout.reconfigure(line_buffering=True)
    p = argparse.ArgumentParser()
    p.add_argument("--tickers", type=str, default=None)
    p.add_argument("--force", action="store_true", help="强制重跑已有 _en 的")
    args = p.parse_args()

    api_key = os.environ.get("SILICONFLOW_API_KEY")
    if not api_key:
        print("❌ SILICONFLOW_API_KEY 未设置")
        return 1

    bal = check_balance(api_key)
    print(f"💰 SF 余额: ¥{bal:.2f}" if bal is not None else "⚠️  余额查询失败")
    if bal is not None and bal < BALANCE_FLOOR_CNY:
        print(f"❌ 余额 < ¥{BALANCE_FLOOR_CNY}, 拒绝")
        return 1

    interp = json.load(open(INTERP_FILE))
    by_ticker = interp["by_ticker"]

    # 候选: is_recent + 没有 headline_en (除非 force)
    candidates = []
    if args.tickers:
        candidates = [t.strip().upper() for t in args.tickers.split(",")]
    else:
        for tk, rec in by_ticker.items():
            if not rec.get("is_recent"):
                continue
            if not args.force and rec.get("headline_en"):
                continue
            candidates.append(tk)
        candidates.sort()

    print(f"📋 候选 {len(candidates)} 只")

    total_cost = 0.0
    success = 0
    failed: list[tuple[str, str]] = []
    t0 = time.time()

    for i, tk in enumerate(candidates, 1):
        rec = by_ticker.get(tk)
        if not rec:
            continue
        fields = collect_zh_fields(rec)
        if not fields:
            continue

        out, usage = call_llm(fields, api_key)
        total_cost += usage["cost_cny"]

        if usage["status_code"] in (401, 402, 403):
            print(f"❌ 余额耗尽, 停: {usage['error']}")
            break
        if total_cost > MAX_BUDGET_CNY:
            print(f"❌ 累计 ¥{total_cost:.2f} > ¥{MAX_BUDGET_CNY} 上限, 停")
            break

        if out is None:
            failed.append((tk, usage.get("error", "?")))
            print(f"  [{i}/{len(candidates)}] ❌ {tk} — {usage.get('error', '?')[:80]}")
            continue

        n_written = write_back(rec, out)
        success += 1

        # 增量保存 (每只都写, 防中断丢失)
        with open(INTERP_FILE, "w") as f:
            json.dump(interp, f, ensure_ascii=False, indent=2)

        elapsed = time.time() - t0
        print(
            f"  [{i}/{len(candidates)}] ✅ {tk} — {n_written} 字段, "
            f"¥{usage['cost_cny']:.4f} (累计 ¥{total_cost:.2f}) {elapsed:.0f}s"
        )

    elapsed = time.time() - t0
    print(
        f"\n✅ 完成 — 成功 {success} / 候选 {len(candidates)} 失败 {len(failed)}\n"
        f"   用时 {elapsed:.0f}s, 花费 ¥{total_cost:.2f}"
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
