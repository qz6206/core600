#!/usr/bin/env python3
"""
财报速评 — 段 1-4 + 倾向标签 自动生成（纯规则，无 LLM）

读取已有数据：
  - data/fmp_extras.json  (earnings/estimates/ratings/sbc/shares)
  - data/13f.json
  - data/options.json
  - data/edgar_filings.json (form4 / form8k)
  - data/transcripts.json
  - data/stocks.json

输出：
  - data/earnings_interpretations.json

每只股票 5 段：
  段 1: headline (一句话)
  段 2: data_card (业绩数据卡)
  段 3: fundamentals (4-6 条信号)
  段 4: market_reaction (期权 + 评级 + 8-K)
  段 5: narrative — 留空 (status=pending) 等 Opus 4.7 手工补

倾向标签 (badges) 也由本脚本生成。
"""

from __future__ import annotations

import json
import os
import sys
from datetime import date, datetime, timedelta
from pathlib import Path
from typing import Any

ROOT = Path(__file__).parent.parent
DATA_DIR = ROOT / "data"

OUT_FILE = DATA_DIR / "earnings_interpretations.json"

RECENT_DAYS = 90  # 90 天内才显示在 UI


# ====== 辅助函数 ======


def load_json(path: Path, default: Any) -> Any:
    if path.exists():
        with open(path) as f:
            return json.load(f)
    return default


def safe_pct(numer: float | None, denom: float | None) -> float | None:
    """(numer - denom) / |denom| * 100"""
    if numer is None or denom is None or denom == 0:
        return None
    return (numer - denom) / abs(denom) * 100


def safe_div(numer: float | None, denom: float | None) -> float | None:
    if numer is None or denom is None or denom == 0:
        return None
    return numer / denom


def fmt_usd(n: float | None) -> str:
    if n is None:
        return "—"
    if abs(n) >= 1e9:
        return f"${n/1e9:.2f}B"
    if abs(n) >= 1e6:
        return f"${n/1e6:.1f}M"
    if abs(n) >= 1e3:
        return f"${n/1e3:.0f}K"
    return f"${n:.0f}"


def fmt_pct(p: float | None, sign: bool = True) -> str:
    if p is None:
        return "—"
    return f"{'+' if sign and p > 0 else ''}{p:.2f}%"


# ====== 段 1: headline ======


def make_headline(ticker: str, name: str, fiscal_label: str, result: str, eps_surprise: float | None, rev_surprise: float | None) -> str:
    name_part = f"{ticker} {name}" if name else ticker
    result_cn = {"beat": "超预期", "miss": "低于预期", "mixed": "好坏参半", "inline": "符合预期"}[result]

    bits = []
    if eps_surprise is not None:
        bits.append(f"EPS {fmt_pct(eps_surprise)}")
    if rev_surprise is not None:
        bits.append(f"营收 {fmt_pct(rev_surprise)}")
    bits_str = "、".join(bits) if bits else ""

    if bits_str:
        return f"{name_part} {fiscal_label} 财报{result_cn}：{bits_str}（vs 华尔街预期）"
    else:
        return f"{name_part} {fiscal_label} 财报{result_cn}"


# ====== 段 2: data_card ======


def make_data_card(earning: dict, q_recent: dict | None, q_yoy: dict | None) -> dict:
    """
    earning: {date, eps_actual, eps_estimate, rev_actual, rev_estimate, ...}
    q_recent: shares record for 本季 (含 net_income, revenue, gross_margin, net_margin)
    q_yoy: shares record for 同比季 (4 quarters before)
    """
    eps_a = earning.get("eps_actual")
    eps_e = earning.get("eps_estimate")
    rev_a = earning.get("rev_actual")
    rev_e = earning.get("rev_estimate")

    # 同比 / 环比 营收
    rev_yoy = None
    rev_qoq = None
    if rev_a and q_yoy and q_yoy.get("revenue"):
        rev_yoy = safe_pct(rev_a, q_yoy["revenue"])

    # 毛利率
    gm = q_recent.get("gross_margin") if q_recent else None
    gm_yoy_bps = None
    if gm is not None and q_yoy and q_yoy.get("gross_margin") is not None:
        gm_yoy_bps = (gm - q_yoy["gross_margin"]) * 10000  # 转基点

    # 净利率
    nm = q_recent.get("net_margin") if q_recent else None
    if nm is None and q_recent:
        # fallback: 自己算
        nm = safe_div(q_recent.get("net_income"), q_recent.get("revenue"))
    nm_yoy_bps = None
    if nm is not None and q_yoy:
        nm_yoy_other = q_yoy.get("net_margin")
        if nm_yoy_other is None:
            nm_yoy_other = safe_div(q_yoy.get("net_income"), q_yoy.get("revenue"))
        if nm_yoy_other is not None:
            nm_yoy_bps = (nm - nm_yoy_other) * 10000

    return {
        "eps_actual": eps_a,
        "eps_estimate": eps_e,
        "eps_surprise_pct": safe_pct(eps_a, eps_e),
        "rev_actual": rev_a,
        "rev_estimate": rev_e,
        "rev_surprise_pct": safe_pct(rev_a, rev_e),
        "rev_yoy_pct": rev_yoy,
        "rev_qoq_pct": rev_qoq,
        "gross_margin": gm,
        "gross_margin_yoy_bps": gm_yoy_bps,
        "net_margin": nm,
        "net_margin_yoy_bps": nm_yoy_bps,
    }


# ====== 段 3: fundamentals ======


def make_fundamentals(
    earnings_history: list,
    cur_idx: int,
    shares_history: list,
    sbc_history: list,
    form4_filings: list,
    inst13f: dict | None,
    earnings_date: str,
) -> list:
    """
    生成 4-6 条基本面信号
    """
    items: list[dict] = []

    # 1. Beat/Miss streak
    streak = compute_beat_streak(earnings_history, cur_idx)
    if streak:
        items.append(streak)

    # 2. 营收同比加速/减速
    rev_signal = compute_revenue_acceleration(shares_history)
    if rev_signal:
        items.append(rev_signal)

    # 3. 毛利率扩张/收缩
    margin_signal = compute_margin_signal(shares_history)
    if margin_signal:
        items.append(margin_signal)

    # 4. 内部人 (财报后 30 天)
    insider_signal = compute_insider_signal(form4_filings, earnings_date)
    if insider_signal:
        items.append(insider_signal)

    # 5. 13F 机构动向
    inst_signal = compute_institutional_signal(inst13f)
    if inst_signal:
        items.append(inst_signal)

    # 6. 回购 / SBC
    cap_signal = compute_capital_signal(sbc_history, shares_history)
    if cap_signal:
        items.append(cap_signal)

    return items[:6]


def compute_beat_streak(earnings: list, cur_idx: int) -> dict | None:
    """连续 N 次 Beat / Miss"""
    # 看本季 + 前 3 次（共 4 次）
    recent_4 = earnings[cur_idx : cur_idx + 4]
    if len(recent_4) < 2:
        return None
    beat_count = 0
    miss_count = 0
    for e in recent_4:
        a = e.get("eps_actual")
        est = e.get("eps_estimate")
        if a is None or est is None or est == 0:
            continue
        diff = (a - est) / abs(est) * 100
        if diff > 3:
            beat_count += 1
        elif diff < -3:
            miss_count += 1
    if beat_count >= 4:
        return {
            "category": "earnings",
            "text": f"最近 4 次财报 EPS 全部 Beat（差异 >3%），盈利兑现度高",
            "tone": "positive",
        }
    elif beat_count >= 3:
        return {
            "category": "earnings",
            "text": f"最近 4 次财报 {beat_count} 次 Beat，1 次未达预期",
            "tone": "positive",
        }
    elif miss_count >= 2:
        return {
            "category": "earnings",
            "text": f"最近 4 次财报中 {miss_count} 次 Miss（差异 <-3%），盈利能力有压力",
            "tone": "negative",
        }
    elif beat_count == 2:
        return {
            "category": "earnings",
            "text": f"最近 4 次财报 2 次 Beat，整体表现稳健",
            "tone": "neutral",
        }
    return None


def compute_revenue_acceleration(shares: list) -> dict | None:
    """看最新季 vs 同比 vs 上一季"""
    if len(shares) < 5:
        return None
    cur = shares[0]
    prior_q = shares[1]
    yoy = shares[4]
    cur_rev = cur.get("revenue")
    prior_q_rev = prior_q.get("revenue")
    yoy_rev = yoy.get("revenue")
    if not (cur_rev and yoy_rev):
        return None
    yoy_growth = (cur_rev - yoy_rev) / yoy_rev * 100

    # 上一季的 YoY
    prior_yoy = shares[5].get("revenue") if len(shares) > 5 else None
    prior_yoy_growth = None
    if prior_q_rev and prior_yoy:
        prior_yoy_growth = (prior_q_rev - prior_yoy) / prior_yoy * 100

    text = f"营收同比 {fmt_pct(yoy_growth)}"
    tone = "neutral"
    if yoy_growth > 30:
        text += "，高速增长"
        tone = "positive"
    elif yoy_growth > 15:
        text += "，稳健增长"
        tone = "positive"
    elif yoy_growth < 0:
        text += "，营收同比下滑"
        tone = "negative"
    elif yoy_growth < 5:
        text += "，增长乏力"
        tone = "negative"

    if prior_yoy_growth is not None:
        delta = yoy_growth - prior_yoy_growth
        if delta > 5:
            text += f"，较上季 {fmt_pct(prior_yoy_growth)} 加速"
            tone = "positive"
        elif delta < -5:
            text += f"，较上季 {fmt_pct(prior_yoy_growth)} 减速"
            tone = "negative" if tone == "neutral" else tone

    return {"category": "growth", "text": text, "tone": tone}


def compute_margin_signal(shares: list) -> dict | None:
    """毛利率扩张/收缩"""
    if len(shares) < 5:
        return None
    cur = shares[0]
    yoy = shares[4]
    cur_gm = cur.get("gross_margin")
    yoy_gm = yoy.get("gross_margin")
    if cur_gm is None or yoy_gm is None:
        return None
    delta_bps = (cur_gm - yoy_gm) * 10000

    text = f"毛利率 {cur_gm*100:.1f}%"
    tone = "neutral"
    if delta_bps >= 200:
        text += f"，同比扩张 {delta_bps:.0f} 基点"
        tone = "positive"
    elif delta_bps >= 50:
        text += f"，同比 +{delta_bps:.0f} 基点"
        tone = "positive"
    elif delta_bps <= -200:
        text += f"，同比收缩 {delta_bps:.0f} 基点"
        tone = "negative"
    elif delta_bps <= -50:
        text += f"，同比 {delta_bps:.0f} 基点"
        tone = "negative"
    else:
        text += f"，同比基本持平"
    return {"category": "margin", "text": text, "tone": tone}


def compute_insider_signal(form4: list, earnings_date: str) -> dict | None:
    """财报前后 30 天内的内部人买卖"""
    if not form4:
        return None
    try:
        ed = datetime.strptime(earnings_date, "%Y-%m-%d").date()
    except (ValueError, TypeError):
        return None
    start = (ed - timedelta(days=30)).isoformat()
    end = (ed + timedelta(days=30)).isoformat()
    buy_count = 0
    sell_count = 0
    buy_value = 0.0
    sell_value = 0.0
    for f in form4:
        fd = f.get("filingDate", "")
        if not (start <= fd <= end):
            continue
        parsed = f.get("parsed") or {}
        for tx in parsed.get("transactions", []):
            if tx.get("kind") != "non-derivative":
                continue
            if tx.get("acquired_disposed") == "A" and tx.get("code") == "P":
                buy_count += 1
                buy_value += tx.get("value") or 0
            elif tx.get("acquired_disposed") == "D" and tx.get("code") == "S":
                sell_count += 1
                sell_value += tx.get("value") or 0

    if buy_count == 0 and sell_count == 0:
        return None

    if buy_count >= 2 and sell_count == 0:
        return {
            "category": "insider",
            "text": f"财报前后 30 天内部人买入 {buy_count} 笔（{fmt_usd(buy_value)}），无卖出",
            "tone": "positive",
        }
    elif buy_count > sell_count:
        return {
            "category": "insider",
            "text": f"财报前后 30 天内部人 {buy_count} 笔买入 vs {sell_count} 笔卖出，买方主导",
            "tone": "positive",
        }
    elif sell_count >= 5 and buy_count == 0:
        return {
            "category": "insider",
            "text": f"财报前后 30 天内部人 {sell_count} 笔卖出（{fmt_usd(sell_value)}），无买入",
            "tone": "negative",
        }
    elif sell_count > 0 and buy_count == 0:
        return {
            "category": "insider",
            "text": f"财报前后 30 天内部人 {sell_count} 笔卖出，无买入",
            "tone": "neutral",
        }
    elif sell_count > buy_count:
        return {
            "category": "insider",
            "text": f"财报前后 30 天内部人 {buy_count} 笔买入 vs {sell_count} 笔卖出，卖方主导",
            "tone": "neutral",
        }
    return None


def compute_institutional_signal(inst13f: dict | None) -> dict | None:
    """13F 机构上季净流入/流出"""
    if not inst13f:
        return None
    summary = inst13f.get("summary", {})
    new_pos = summary.get("newPositions")
    closed = summary.get("closedPositions")
    if new_pos is None or closed is None:
        return None
    net = new_pos - closed
    quarter_label = summary.get("date", "上季")
    if net >= 50:
        return {
            "category": "institutional",
            "text": f"13F 上季新进 {new_pos} - 清仓 {closed} = 净流入 +{net} 家机构",
            "tone": "positive",
        }
    elif net <= -50:
        return {
            "category": "institutional",
            "text": f"13F 上季新进 {new_pos} - 清仓 {closed} = 净流出 {net} 家机构",
            "tone": "negative",
        }
    elif abs(net) < 20:
        return {
            "category": "institutional",
            "text": f"13F 上季机构持仓变化温和（新进 {new_pos} / 清仓 {closed}）",
            "tone": "neutral",
        }
    elif net > 0:
        return {
            "category": "institutional",
            "text": f"13F 上季机构小幅净流入 +{net} 家",
            "tone": "neutral",
        }
    else:
        return {
            "category": "institutional",
            "text": f"13F 上季机构小幅净流出 {net} 家",
            "tone": "neutral",
        }


def compute_capital_signal(sbc_history: list, shares_history: list) -> dict | None:
    """回购加大/放缓 + SBC 占比"""
    if len(sbc_history) < 8:
        # 退一步看 4 季
        if len(sbc_history) < 4:
            return None
    # SBC TTM / 净利 TTM
    sbc_ttm = sum(q.get("sbc") or 0 for q in sbc_history[:4])
    ni_ttm = sum(q.get("net_income") or 0 for q in shares_history[:4]) if shares_history else 0

    # 回购对比
    recent_buyback = sum(abs(q.get("buyback") or 0) for q in sbc_history[:4])
    prior_buyback = (
        sum(abs(q.get("buyback") or 0) for q in sbc_history[4:8])
        if len(sbc_history) >= 8
        else None
    )

    # 优先级：回购加速/放缓 > SBC 比例
    if prior_buyback and prior_buyback > 0:
        ratio = recent_buyback / prior_buyback
        if ratio >= 1.5:
            return {
                "category": "buyback",
                "text": f"最近 4 季回购 {fmt_usd(recent_buyback)}，较前 4 季 {fmt_usd(prior_buyback)} 加大 {(ratio-1)*100:.0f}%",
                "tone": "positive",
            }
        elif ratio < 0.5:
            return {
                "category": "buyback",
                "text": f"最近 4 季回购 {fmt_usd(recent_buyback)}，较前 4 季 {fmt_usd(prior_buyback)} 放缓",
                "tone": "negative",
            }

    if ni_ttm > 0:
        sbc_pct = sbc_ttm / abs(ni_ttm) * 100
        if sbc_pct >= 30:
            return {
                "category": "sbc",
                "text": f"SBC TTM 占净利 {sbc_pct:.1f}%（≥30% 高稀释区间），股权激励侵蚀利润明显",
                "tone": "negative",
            }
        elif sbc_pct <= 10:
            return {
                "category": "sbc",
                "text": f"SBC TTM 占净利 {sbc_pct:.1f}%（≤10% 低稀释区间）",
                "tone": "positive",
            }

    if recent_buyback > 0:
        return {
            "category": "buyback",
            "text": f"最近 4 季回购 {fmt_usd(recent_buyback)}",
            "tone": "neutral",
        }

    return None


# ====== 新版段 ②: KPI 6 项 (rule-based) ======


def _find_q_idx(shares: list, fpe: str) -> int | None:
    """根据 fiscal_period_end 找在 shares[] 里的下标"""
    if not fpe:
        return None
    try:
        target = datetime.strptime(fpe[:10], "%Y-%m-%d").date()
    except (ValueError, TypeError):
        return None
    for i, s in enumerate(shares):
        try:
            d = datetime.strptime(s.get("date", "")[:10], "%Y-%m-%d").date()
        except (ValueError, TypeError):
            continue
        if abs((target - d).days) <= 7:
            return i
    return None


def _q_yoy_idx(shares: list, cur_idx: int) -> int | None:
    """同比季 (cur_idx + 4)"""
    if cur_idx is None:
        return None
    target_idx = cur_idx + 4
    return target_idx if target_idx < len(shares) else None


def make_kpis(shares: list, sbc: list, fpe: str) -> list[dict]:
    """6 项通用 KPI:
       1) FCF  2) FCF/Rev  3) Capex  4) 回购  5) SBC/Rev  6) OCF/NI 现金转化率
    """
    kpis: list[dict] = []
    sb_idx = _find_q_idx(sbc, fpe)
    sh_idx = _find_q_idx(shares, fpe)
    if sb_idx is None or sh_idx is None:
        return kpis

    cur_sb = sbc[sb_idx]
    cur_sh = shares[sh_idx]
    yoy_sb = sbc[sb_idx + 4] if sb_idx + 4 < len(sbc) else None
    yoy_sh = shares[sh_idx + 4] if sh_idx + 4 < len(shares) else None
    qoq_sb = sbc[sb_idx + 1] if sb_idx + 1 < len(sbc) else None

    rev = cur_sh.get("revenue") or 0
    fcf = cur_sb.get("fcf")
    ocf = cur_sb.get("ocf")
    capex = (ocf - fcf) if (ocf is not None and fcf is not None) else None
    buyback = abs(cur_sb.get("buyback") or 0)
    sbc_amt = cur_sb.get("sbc") or 0
    ni = cur_sh.get("net_income") or 0

    # 1. FCF
    if fcf is not None:
        yoy_fcf = yoy_sb.get("fcf") if yoy_sb else None
        qoq_fcf = qoq_sb.get("fcf") if qoq_sb else None
        kpis.append({
            "label": "FCF 自由现金流",
            "value": fcf, "format": "usd",
            "yoy_change_pct": safe_pct(fcf, yoy_fcf) if yoy_fcf else None,
            "yoy_change_pp": None,
            "qoq_change_pct": safe_pct(fcf, qoq_fcf) if qoq_fcf else None,
            "tone": "positive" if fcf > 0 else "negative",
            "note": None,
        })

    # 2. FCF / Revenue
    if fcf is not None and rev > 0:
        fcf_margin = fcf / rev
        yoy_fcf_margin = None
        if yoy_sb and yoy_sh and yoy_sh.get("revenue"):
            y_fcf = yoy_sb.get("fcf")
            y_rev = yoy_sh.get("revenue")
            if y_fcf is not None and y_rev:
                yoy_fcf_margin = (fcf_margin - y_fcf / y_rev) * 100  # pp
        tone = "positive" if fcf_margin > 0.20 else ("neutral" if fcf_margin > 0 else "negative")
        note = "顶级 capital-light" if fcf_margin > 0.40 else None
        kpis.append({
            "label": "FCF / 营收",
            "value": fcf_margin, "format": "pct",
            "yoy_change_pct": None,
            "yoy_change_pp": yoy_fcf_margin,
            "qoq_change_pct": None,
            "tone": tone,
            "note": note,
        })

    # 3. Capex
    if capex is not None:
        capex_intensity = capex / rev if rev else None
        if capex == 0:
            note = "纯软件平台, 无烧钱压力"
            tone = "positive"
        elif capex_intensity is not None and capex_intensity > 0.20:
            note = f"Capex/Rev {capex_intensity*100:.1f}% (高烧钱)"
            tone = "negative"
        else:
            note = None
            tone = "neutral"
        kpis.append({
            "label": "Capex 资本开支",
            "value": capex, "format": "usd",
            "yoy_change_pct": None, "yoy_change_pp": None, "qoq_change_pct": None,
            "tone": tone, "note": note,
        })

    # 4. 回购
    if buyback > 0:
        yoy_bb = abs(yoy_sb.get("buyback") or 0) if yoy_sb else None
        qoq_bb = abs(qoq_sb.get("buyback") or 0) if qoq_sb else None
        yoy_pct = safe_pct(buyback, yoy_bb) if yoy_bb else None
        qoq_pct = safe_pct(buyback, qoq_bb) if qoq_bb else None
        if yoy_pct is not None and yoy_pct > 100:
            tone = "positive"
            note = f"较去年同期翻 {(buyback/yoy_bb):.1f}×"
        elif yoy_pct is not None and yoy_pct < -50:
            tone = "negative"
            note = "回购大幅放缓"
        else:
            tone = "neutral"
            note = None
        kpis.append({
            "label": "股票回购",
            "value": buyback, "format": "usd",
            "yoy_change_pct": yoy_pct, "yoy_change_pp": None, "qoq_change_pct": qoq_pct,
            "tone": tone, "note": note,
        })

    # 5. SBC / Revenue
    if rev > 0:
        sbc_pct = sbc_amt / rev
        if sbc_pct < 0.05:
            tone = "positive"; note = "<5% 低稀释"
        elif sbc_pct < 0.10:
            tone = "neutral"; note = "<10% 健康区间"
        elif sbc_pct < 0.20:
            tone = "neutral"; note = None
        else:
            tone = "negative"; note = ">20% 高稀释"
        yoy_pp = None
        if yoy_sh and yoy_sb and yoy_sh.get("revenue"):
            y_sbc_pct = (yoy_sb.get("sbc") or 0) / yoy_sh["revenue"]
            yoy_pp = (sbc_pct - y_sbc_pct) * 100
        kpis.append({
            "label": "SBC / 营收",
            "value": sbc_pct, "format": "pct",
            "yoy_change_pct": None, "yoy_change_pp": yoy_pp, "qoq_change_pct": None,
            "tone": tone, "note": note,
        })

    # 6. OCF / NI 现金流转化率
    if ocf is not None and ni and ni > 0:
        conv = ocf / ni
        tone = "positive" if conv >= 1.0 else ("neutral" if conv >= 0.7 else "negative")
        if conv >= 1.2:
            note = "现金流远超利润, 极优"
        elif conv >= 1.0:
            note = "现金流 ≥ 利润, 健康"
        elif conv < 0.7:
            note = "现金转化率偏低"
        else:
            note = None
        kpis.append({
            "label": "OCF / 净利润",
            "value": conv, "format": "ratio",
            "yoy_change_pct": None, "yoy_change_pp": None, "qoq_change_pct": None,
            "tone": tone, "note": note,
        })

    return kpis


# ====== 新版段 ④: Beat 质量评估 (rule-based) ======


def make_beat_quality(shares: list, sbc: list, fpe: str, eps_surprise: float | None) -> dict | None:
    """4 项检查 + 综合 rating"""
    sb_idx = _find_q_idx(sbc, fpe)
    sh_idx = _find_q_idx(shares, fpe)
    if sb_idx is None or sh_idx is None:
        return None
    if eps_surprise is None or eps_surprise <= 0:
        return None  # 没 Beat 就不评质量

    cur_sb = sbc[sb_idx]
    cur_sh = shares[sh_idx]
    rev = cur_sh.get("revenue") or 0
    ocf = cur_sb.get("ocf")
    fcf = cur_sb.get("fcf")
    capex = (ocf - fcf) if (ocf is not None and fcf is not None) else None
    sbc_amt = cur_sb.get("sbc") or 0
    ni = cur_sh.get("net_income") or 0
    op_margin = cur_sh.get("operating_margin")

    checks: list[dict] = []
    good_count = 0

    # 1. GAAP Op Margin (代理 GAAP/Non-GAAP 差距 — 高 GAAP margin 意味不靠 Adj 美化)
    if op_margin is not None:
        if op_margin >= 0.30:
            checks.append({"label": "GAAP Op Margin", "value": f"{op_margin*100:.1f}%",
                           "status": "good", "hint": "GAAP 真实利润率 ≥30%, 不靠 Adj 美化"})
            good_count += 1
        elif op_margin >= 0.10:
            checks.append({"label": "GAAP Op Margin", "value": f"{op_margin*100:.1f}%",
                           "status": "ok", "hint": "GAAP 利润率适中"})
        else:
            checks.append({"label": "GAAP Op Margin", "value": f"{op_margin*100:.1f}%",
                           "status": "bad", "hint": "GAAP 利润率偏低, 警惕 Adj 美化"})

    # 2. OCF / 净利润
    if ocf is not None and ni > 0:
        conv = ocf / ni
        if conv >= 1.0:
            checks.append({"label": "OCF / 净利润", "value": f"{conv*100:.0f}%",
                           "status": "good", "hint": ">100% = 现金流 ≥ 利润, 质量极优"})
            good_count += 1
        elif conv >= 0.7:
            checks.append({"label": "OCF / 净利润", "value": f"{conv*100:.0f}%",
                           "status": "ok", "hint": "现金转化率适中"})
        else:
            checks.append({"label": "OCF / 净利润", "value": f"{conv*100:.0f}%",
                           "status": "bad", "hint": "<70% 现金转化率偏低"})

    # 3. SBC / Rev
    if rev > 0:
        sbc_pct = sbc_amt / rev * 100
        if sbc_pct < 10:
            checks.append({"label": "SBC / 营收", "value": f"{sbc_pct:.1f}%",
                           "status": "good", "hint": "<10% 健康区间"})
            good_count += 1
        elif sbc_pct < 20:
            checks.append({"label": "SBC / 营收", "value": f"{sbc_pct:.1f}%",
                           "status": "ok", "hint": "10-20% 中等"})
        else:
            checks.append({"label": "SBC / 营收", "value": f"{sbc_pct:.1f}%",
                           "status": "bad", "hint": ">20% 高稀释"})

    # 4. Capex 强度
    if capex is not None and rev > 0:
        if capex == 0:
            checks.append({"label": "Capex 强度", "value": "$0",
                           "status": "good", "hint": "纯软件平台, 无 AI capex 烧钱压力"})
            good_count += 1
        else:
            cx_pct = capex / rev * 100
            if cx_pct < 5:
                checks.append({"label": "Capex 强度", "value": f"{cx_pct:.1f}% of Rev",
                               "status": "good", "hint": "<5% 轻资产"})
                good_count += 1
            elif cx_pct < 15:
                checks.append({"label": "Capex 强度", "value": f"{cx_pct:.1f}% of Rev",
                               "status": "ok", "hint": "中等"})
            else:
                checks.append({"label": "Capex 强度", "value": f"{cx_pct:.1f}% of Rev",
                               "status": "bad", "hint": ">15% 重资产 / 高烧钱"})

    # 综合 rating
    if good_count >= 4:
        rating = "premium"; rating_label = "🟢🟢🟢 顶级优质"
    elif good_count >= 2:
        rating = "healthy"; rating_label = "🟢🟢 健康"
    elif good_count >= 1:
        rating = "mixed"; rating_label = "🟡 一般"
    else:
        rating = "questionable"; rating_label = "🔴 可疑"

    summary = None
    if op_margin is not None and op_margin >= 0.30:
        summary = f"GAAP Op Margin {op_margin*100:.1f}% — 高质量利润"

    return {
        "rating": rating,
        "rating_label": rating_label,
        "checks": checks,
        "summary": summary,
    }


# ====== 新版段 ⑤: 健康度 4 维红绿灯 (rule-based) ======


def make_health(shares: list, sbc: list, fpe: str) -> dict | None:
    """4 维: 营收增长 / 毛利率 / 运营效率 / 现金流  (资产负债维度需要 balance sheet, 暂不做)"""
    sb_idx = _find_q_idx(sbc, fpe)
    sh_idx = _find_q_idx(shares, fpe)
    if sb_idx is None or sh_idx is None:
        return None

    cur_sh = shares[sh_idx]
    yoy_sh = shares[sh_idx + 4] if sh_idx + 4 < len(shares) else None
    cur_sb = sbc[sb_idx]

    dimensions: list[dict] = []
    great_count = 0  # stars=2 计为 great, stars=1 计为 good

    # 1. 营收增长
    rev = cur_sh.get("revenue")
    if rev and yoy_sh and yoy_sh.get("revenue"):
        yoy_g = (rev - yoy_sh["revenue"]) / yoy_sh["revenue"] * 100
        if yoy_g > 30:
            dimensions.append({"label": "营收增长", "stars": 2, "status": "great",
                               "note": f"YoY +{yoy_g:.1f}% 高速增长"})
            great_count += 1
        elif yoy_g > 10:
            dimensions.append({"label": "营收增长", "stars": 1, "status": "good",
                               "note": f"YoY +{yoy_g:.1f}% 稳健"})
        elif yoy_g > 0:
            dimensions.append({"label": "营收增长", "stars": 0, "status": "warn",
                               "note": f"YoY +{yoy_g:.1f}% 缓增"})
        else:
            dimensions.append({"label": "营收增长", "stars": 0, "status": "bad",
                               "note": f"YoY {yoy_g:.1f}% 下滑"})

    # 2. 毛利率
    gm = cur_sh.get("gross_margin")
    if gm is not None:
        if gm >= 0.70:
            dimensions.append({"label": "毛利率", "stars": 2, "status": "great",
                               "note": f"{gm*100:.1f}% — 软件级毛利"})
            great_count += 1
        elif gm >= 0.40:
            dimensions.append({"label": "毛利率", "stars": 1, "status": "good",
                               "note": f"{gm*100:.1f}% — 健康"})
        elif gm >= 0.20:
            dimensions.append({"label": "毛利率", "stars": 0, "status": "warn",
                               "note": f"{gm*100:.1f}% — 偏低"})
        else:
            dimensions.append({"label": "毛利率", "stars": 0, "status": "bad",
                               "note": f"{gm*100:.1f}% — 薄利"})

    # 3. 运营效率
    op_m = cur_sh.get("operating_margin")
    if op_m is not None:
        if op_m >= 0.30:
            dimensions.append({"label": "运营效率", "stars": 2, "status": "great",
                               "note": f"Op Margin {op_m*100:.1f}% 顶级"})
            great_count += 1
        elif op_m >= 0.15:
            dimensions.append({"label": "运营效率", "stars": 1, "status": "good",
                               "note": f"Op Margin {op_m*100:.1f}% 健康"})
        elif op_m >= 0:
            dimensions.append({"label": "运营效率", "stars": 0, "status": "warn",
                               "note": f"Op Margin {op_m*100:.1f}% 微利"})
        else:
            dimensions.append({"label": "运营效率", "stars": 0, "status": "bad",
                               "note": f"Op Margin {op_m*100:.1f}% 亏损"})

    # 4. 现金流 (FCF Margin)
    fcf = cur_sb.get("fcf")
    if fcf is not None and rev:
        fm = fcf / rev * 100
        if fm >= 25:
            dimensions.append({"label": "现金流", "stars": 2, "status": "great",
                               "note": f"FCF Margin {fm:.1f}% 顶级"})
            great_count += 1
        elif fm >= 10:
            dimensions.append({"label": "现金流", "stars": 1, "status": "good",
                               "note": f"FCF Margin {fm:.1f}% 健康"})
        elif fm > 0:
            dimensions.append({"label": "现金流", "stars": 0, "status": "warn",
                               "note": f"FCF Margin {fm:.1f}% 薄"})
        else:
            dimensions.append({"label": "现金流", "stars": 0, "status": "bad",
                               "note": f"FCF Margin {fm:.1f}% 烧钱"})

    if not dimensions:
        return None

    # 综合 rating: 5 = 全 great, 4 = 多数 great, 3 = 中性, 2 = 多数差, 1 = 全差
    overall = 1 + great_count
    overall = min(overall, 5)
    if great_count == 0 and any(d["status"] == "bad" for d in dimensions):
        overall = max(1, overall - 1)

    return {
        "overall_rating": overall,
        "dimensions": dimensions,
    }


# ====== 段 4: market_reaction ======


def make_market_reaction(options: dict | None, ratings: list, form8k: list, earnings_date: str) -> dict:
    atm_iv = None
    pcr = None
    if options:
        atm_iv = options.get("atm_iv")
        pcr = options.get("put_call_ratio")

    iv_level = None
    if atm_iv is not None:
        if atm_iv >= 0.5:
            iv_level = "high"
        elif atm_iv >= 0.2:
            iv_level = "medium"
        else:
            iv_level = "low"

    pcr_label = None
    if pcr is not None:
        if pcr < 0.7:
            pcr_label = "bullish"
        elif pcr > 1.0:
            pcr_label = "bearish"
        else:
            pcr_label = "neutral"

    # 财报后 30 天评级
    ratings_30d = None
    try:
        ed = datetime.strptime(earnings_date, "%Y-%m-%d").date()
        start = ed.isoformat()
        end = (ed + timedelta(days=30)).isoformat()
        u = d = i = 0
        for r in ratings:
            rd = r.get("date", "")
            if not (start <= rd <= end):
                continue
            act = r.get("action")
            if act == "upgrade":
                u += 1
            elif act == "downgrade":
                d += 1
            elif act == "initialise":
                i += 1
        ratings_30d = {"upgrade": u, "downgrade": d, "initiate": i}
    except (ValueError, TypeError):
        pass

    # 财报后 30 天 8-K
    form8k_30d = 0
    try:
        ed = datetime.strptime(earnings_date, "%Y-%m-%d").date()
        start = ed.isoformat()
        end = (ed + timedelta(days=30)).isoformat()
        for f in form8k:
            fd = f.get("filingDate", "")
            if start <= fd <= end:
                form8k_30d += 1
    except (ValueError, TypeError):
        pass

    return {
        "atm_iv": atm_iv,
        "iv_level": iv_level,
        "put_call_ratio": pcr,
        "pcr_label": pcr_label,
        "ratings_30d": ratings_30d,
        "form8k_30d": form8k_30d,
    }


# ====== 倾向标签 ======


def make_badges(
    data_card: dict,
    fundamentals: list,
    market_reaction: dict,
    earnings_history: list,
    cur_idx: int,
) -> list:
    badges: list[dict] = []

    # 1. 业绩面：连续超预期 / 多次低于预期
    streak = compute_beat_streak(earnings_history, cur_idx)
    if streak:
        if "全部 Beat" in streak["text"]:
            badges.append({"color": "green", "label": "连续超预期", "hint": streak["text"]})
        elif "Miss" in streak["text"] and streak["tone"] == "negative":
            badges.append({"color": "red", "label": "多次低于预期", "hint": streak["text"]})

    # 2. 本季 Beat 强度
    eps_pct = data_card.get("eps_surprise_pct")
    if eps_pct is not None:
        if eps_pct > 10:
            badges.append({"color": "green", "label": "EPS 大超预期", "hint": f"EPS 实际超预期 {eps_pct:.1f}%"})
        elif eps_pct < -5:
            badges.append({"color": "red", "label": "EPS 不及预期", "hint": f"EPS 实际低于预期 {eps_pct:.1f}%"})

    rev_pct = data_card.get("rev_surprise_pct")
    if rev_pct is not None:
        if rev_pct > 5:
            badges.append({"color": "green", "label": "营收超预期", "hint": f"营收超预期 {rev_pct:.1f}%"})
        elif rev_pct < -3:
            badges.append({"color": "red", "label": "营收不及预期", "hint": f"营收低于预期 {rev_pct:.1f}%"})

    # 3. 营收增速
    rev_yoy = data_card.get("rev_yoy_pct")
    if rev_yoy is not None:
        if rev_yoy > 30:
            badges.append({"color": "green", "label": "营收高增长", "hint": f"营收同比 +{rev_yoy:.1f}% (>30%)"})
        elif rev_yoy < 0:
            badges.append({"color": "red", "label": "营收下滑", "hint": f"营收同比 {rev_yoy:.1f}%"})

    # 4. 毛利率
    gm_bps = data_card.get("gross_margin_yoy_bps")
    if gm_bps is not None:
        if gm_bps >= 200:
            badges.append({"color": "green", "label": "毛利扩张", "hint": f"毛利率同比 +{gm_bps:.0f} 基点"})
        elif gm_bps <= -200:
            badges.append({"color": "red", "label": "毛利收缩", "hint": f"毛利率同比 {gm_bps:.0f} 基点"})

    # 5. 资金面：内部人/机构（从 fundamentals 提取）
    for fund in fundamentals:
        if fund["category"] == "insider":
            if fund["tone"] == "positive":
                badges.append({"color": "green", "label": "内部人买入", "hint": fund["text"]})
            elif "持续套现" in fund["text"] or "无买入" in fund["text"] and fund["tone"] == "negative":
                badges.append({"color": "red", "label": "内部人卖出", "hint": fund["text"]})
        elif fund["category"] == "institutional":
            if "净流入 +" in fund["text"] and fund["tone"] == "positive":
                badges.append({"color": "green", "label": "机构净流入", "hint": fund["text"]})
            elif "净流出" in fund["text"] and fund["tone"] == "negative":
                badges.append({"color": "red", "label": "机构净流出", "hint": fund["text"]})
        elif fund["category"] == "buyback":
            if "加大" in fund["text"]:
                badges.append({"color": "green", "label": "加大回购", "hint": fund["text"]})
            elif "放缓" in fund["text"]:
                badges.append({"color": "amber", "label": "回购放缓", "hint": fund["text"]})
        elif fund["category"] == "sbc":
            if "高稀释" in fund["text"]:
                badges.append({"color": "red", "label": "高稀释", "hint": fund["text"]})
            elif "低稀释" in fund["text"]:
                badges.append({"color": "green", "label": "低稀释", "hint": fund["text"]})

    # 6. 评级动向
    r30 = market_reaction.get("ratings_30d")
    if r30:
        u = r30.get("upgrade", 0)
        d = r30.get("downgrade", 0)
        if u >= 3 and u > d * 2:
            badges.append({"color": "green", "label": "评级上调潮", "hint": f"财报后 30 天 {u} 次升级 vs {d} 次降级"})
        elif d >= 3 and d > u * 2:
            badges.append({"color": "red", "label": "评级下调潮", "hint": f"财报后 30 天 {d} 次降级 vs {u} 次升级"})

    return badges


# ====== fiscal_label ======


def make_fiscal_label(fiscal_period_end: str | None, period: str | None, calendar_year: str | None) -> str:
    if period and calendar_year:
        return f"{calendar_year} {period}"
    if not fiscal_period_end:
        return "—"
    try:
        d = datetime.strptime(fiscal_period_end[:10], "%Y-%m-%d").date()
        # 尝试推断 Q
        m = d.month
        if m in (1, 2, 3):
            q = "Q1"
        elif m in (4, 5, 6):
            q = "Q2"
        elif m in (7, 8, 9):
            q = "Q3"
        else:
            q = "Q4"
        return f"{d.year} {q}"
    except (ValueError, TypeError):
        return fiscal_period_end


# ====== 主流程 ======


def determine_result(eps_surprise: float | None, rev_surprise: float | None) -> str:
    """
    Beat: EPS Beat (>3%) and (rev Beat or no rev surprise)
    Miss: EPS Miss (<-3%) and (rev Miss or no rev surprise)
    Mixed: 两者方向不一致
    Inline: |差异| <= 3%
    """
    eps_beat = eps_surprise is not None and eps_surprise > 3
    eps_miss = eps_surprise is not None and eps_surprise < -3
    rev_beat = rev_surprise is not None and rev_surprise > 1
    rev_miss = rev_surprise is not None and rev_surprise < -1

    if eps_beat and not rev_miss:
        return "beat"
    if eps_miss and not rev_beat:
        return "miss"
    if (eps_beat and rev_miss) or (eps_miss and rev_beat):
        return "mixed"
    if rev_beat and not eps_miss:
        return "beat"
    if rev_miss and not eps_beat:
        return "miss"
    return "inline"


def find_yoy_quarter(shares: list, target_period_end: str) -> dict | None:
    """找同比季（约 365 天前）"""
    try:
        target = datetime.strptime(target_period_end[:10], "%Y-%m-%d").date()
    except (ValueError, TypeError):
        return None
    best = None
    best_diff = 999
    for s in shares:
        try:
            d = datetime.strptime(s.get("date", "")[:10], "%Y-%m-%d").date()
        except (ValueError, TypeError):
            continue
        diff = abs((target - d).days - 365)
        if diff < best_diff and diff <= 30:  # 30 天容差
            best = s
            best_diff = diff
    return best


def find_quarter_for_earning(shares: list, fpe: str) -> dict | None:
    """根据 fiscal_period_end 找匹配的 income/shares 记录"""
    if not fpe:
        return None
    try:
        target = datetime.strptime(fpe[:10], "%Y-%m-%d").date()
    except (ValueError, TypeError):
        return None
    for s in shares:
        try:
            d = datetime.strptime(s.get("date", "")[:10], "%Y-%m-%d").date()
        except (ValueError, TypeError):
            continue
        if abs((target - d).days) <= 7:
            return s
    return None


def process_ticker(
    ticker: str,
    name: str,
    fmp: dict,
    edgar_filings: dict,
    options_data: dict,
    inst13f_data: dict,
    transcripts: dict,
    today: date,
) -> dict | None:
    earnings = fmp.get("earnings", []) or []
    shares = fmp.get("shares", []) or []
    sbc = fmp.get("sbc", []) or []
    ratings = fmp.get("ratings", []) or []

    # 找最近一次 eps_actual 不为空的财报
    cur_idx = None
    cur_earning = None
    for idx, e in enumerate(earnings):
        if e.get("eps_actual") is not None:
            cur_idx = idx
            cur_earning = e
            break
    if cur_earning is None:
        return None

    earnings_date = cur_earning.get("date", "")
    if not earnings_date:
        return None

    # 90 天判断
    try:
        ed = datetime.strptime(earnings_date, "%Y-%m-%d").date()
        days_ago = (today - ed).days
        is_recent = 0 <= days_ago <= RECENT_DAYS
    except (ValueError, TypeError):
        return None

    fpe = cur_earning.get("fiscal_period_end", "")
    q_recent = find_quarter_for_earning(shares, fpe)
    q_yoy = find_yoy_quarter(shares, fpe) if fpe else None

    # data_card
    data_card = make_data_card(cur_earning, q_recent, q_yoy)

    # result
    result = determine_result(data_card["eps_surprise_pct"], data_card["rev_surprise_pct"])

    # fiscal_label
    fiscal_label = make_fiscal_label(
        fpe,
        q_recent.get("period") if q_recent else None,
        q_recent.get("calendar_year") if q_recent else None,
    )

    # headline
    headline = make_headline(
        ticker,
        name,
        fiscal_label,
        result,
        data_card["eps_surprise_pct"],
        data_card["rev_surprise_pct"],
    )

    # fundamentals
    form4 = edgar_filings.get(ticker, {}).get("form4", []) or []
    inst = inst13f_data.get(ticker)
    fundamentals = make_fundamentals(
        earnings, cur_idx, shares, sbc, form4, inst, earnings_date
    )

    # market_reaction
    form8k = edgar_filings.get(ticker, {}).get("form8k", []) or []
    options = options_data.get(ticker)
    market_reaction = make_market_reaction(options, ratings, form8k, earnings_date)

    # ⭐ 新版段 ②/④/⑤: KPI / Beat 质量 / 健康度
    kpis = make_kpis(shares, sbc, fpe)
    beat_quality = make_beat_quality(shares, sbc, fpe, data_card.get("eps_surprise_pct"))
    health = make_health(shares, sbc, fpe)

    # badges
    badges = make_badges(data_card, fundamentals, market_reaction, earnings, cur_idx)

    # narrative status: 看 transcript 是否对应这次财报
    narrative_status = "no_transcript"
    transcript = transcripts.get(ticker)
    if transcript:
        # 如果 transcript 的 quarter/year 跟最近这次财报对应（粗略判断）
        # 暂时只要有 transcript 就标 pending（即使是上次的 transcript，Opus 评估时再决定）
        narrative_status = "pending"

    return {
        "ticker": ticker,
        "fiscal_period_end": fpe,
        "earnings_date": earnings_date,
        "release_time": cur_earning.get("time"),
        "fiscal_label": fiscal_label,
        "is_recent": is_recent,
        "result": result,
        "generated_at": datetime.now().isoformat(),
        "headline": headline,
        "data_card": data_card,
        "kpis": kpis,                    # ⭐ 新: 段 ②
        "beat_quality": beat_quality,    # ⭐ 新: 段 ④
        "health": health,                # ⭐ 新: 段 ⑤
        "fundamentals": fundamentals,    # 旧字段保留, 用于回退
        "market_reaction": market_reaction,  # 旧字段保留, 用于回退
        "badges": badges,
        "guidance": None,                # ⭐ 等 LLM 阶段填
        "narrative": None,
        "narrative_status": narrative_status,
    }


def main():
    print("📥 加载数据...", flush=True)
    fmp_extras = load_json(DATA_DIR / "fmp_extras.json", {"by_ticker": {}})
    edgar = load_json(DATA_DIR / "edgar_filings.json", {"by_ticker": {}})
    options = load_json(DATA_DIR / "options.json", {"by_ticker": {}})
    inst13f = load_json(DATA_DIR / "13f.json", {"by_ticker": {}})
    transcripts = load_json(DATA_DIR / "transcripts.json", {"by_ticker": {}})
    stocks_data = load_json(DATA_DIR / "stocks.json", {"stocks": []})

    name_map = {s["ticker"]: s.get("name_cn") or s.get("name", "") for s in stocks_data.get("stocks", [])}

    # 加载现有 interpretations 文件，保留 narrative
    existing = load_json(OUT_FILE, {"by_ticker": {}})
    existing_bt = existing.get("by_ticker", {})

    fmp_bt = fmp_extras.get("by_ticker", {})
    edgar_bt = edgar.get("by_ticker", {})
    options_bt = options.get("by_ticker", {})
    inst_bt = inst13f.get("by_ticker", {})
    trans_bt = transcripts.get("by_ticker", {})

    today = date.today()

    out: dict[str, dict] = {}
    stats = {"total": 0, "no_earnings": 0, "no_transcript": 0, "pending": 0, "narrative_kept": 0, "narrative_invalidated": 0}

    tickers = sorted(fmp_bt.keys())
    for tk in tickers:
        stats["total"] += 1
        rec = process_ticker(
            tk,
            name_map.get(tk, ""),
            fmp_bt.get(tk, {}),
            edgar_bt,
            options_bt,
            inst_bt,
            trans_bt,
            today,
        )
        if rec is None:
            stats["no_earnings"] += 1
            continue

        # 保留 LLM 写过的字段 (narrative / guidance / data_card.third_metric / data_card.rev_yoy_pct_alt):
        # 只要 fiscal_period_end 没变, 这些字段就沿用旧的, 避免 LLM 白跑
        prior = existing_bt.get(tk)
        same_fiscal = prior and prior.get("fiscal_period_end") == rec["fiscal_period_end"]
        if same_fiscal:
            # narrative
            if prior.get("narrative") and prior.get("narrative_status") == "done":
                rec["narrative"] = prior["narrative"]
                rec["narrative_status"] = "done"
                stats["narrative_kept"] += 1
            # guidance
            if prior.get("guidance"):
                rec["guidance"] = prior["guidance"]
            # data_card 的 LLM 字段
            prior_dc = prior.get("data_card") or {}
            if prior_dc.get("third_metric"):
                rec["data_card"]["third_metric"] = prior_dc["third_metric"]
            if prior_dc.get("rev_yoy_pct_alt") is not None:
                rec["data_card"]["rev_yoy_pct_alt"] = prior_dc["rev_yoy_pct_alt"]
                rec["data_card"]["rev_yoy_pct_alt_label"] = prior_dc.get("rev_yoy_pct_alt_label")
        elif prior and prior.get("narrative"):
            stats["narrative_invalidated"] += 1

        if rec["narrative_status"] == "no_transcript":
            stats["no_transcript"] += 1
        elif rec["narrative_status"] == "pending":
            stats["pending"] += 1

        out[tk] = rec

    output = {
        "generated_at": datetime.now().isoformat(),
        "schema_version": 1,
        "stats": stats,
        "by_ticker": out,
    }

    OUT_FILE.parent.mkdir(parents=True, exist_ok=True)
    with open(OUT_FILE, "w") as f:
        json.dump(output, f, ensure_ascii=False, indent=2)

    print(
        f"\n✅ 完成: {stats['total']} 只\n"
        f"   - 有最近财报（已生成段 1-4）: {len(out)}\n"
        f"   - 无 earnings 数据 (跳过): {stats['no_earnings']}\n"
        f"   - narrative pending (待 Opus 4.7 做): {stats['pending']}\n"
        f"   - narrative no_transcript (跳过段 5): {stats['no_transcript']}\n"
        f"   - narrative 沿用上次（fiscal 未变）: {stats['narrative_kept']}\n"
        f"   - narrative 失效（新财报来了）: {stats['narrative_invalidated']}\n"
        f"   💾 输出: {OUT_FILE} ({OUT_FILE.stat().st_size/1024/1024:.2f} MB)",
        flush=True,
    )


if __name__ == "__main__":
    main()
