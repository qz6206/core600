#!/usr/bin/env python3
"""
临时脚本: 手动把 APP Q1 2026 完整 EQR 数据注入 earnings_interpretations.json
基于用户的 reports/EQR/202605/APP_20260506.md 内容

跑完后用户在 https://core600.com/stocks/APP 看「财报点评」section
"""
import json
from datetime import datetime
from pathlib import Path

ROOT = Path(__file__).parent.parent
F = ROOT / "data" / "earnings_interpretations.json"

with open(F) as fp:
    data = json.load(fp)

now = datetime.now().isoformat()

# === APP Q1 2026 完整 EQR 数据 ===
app_eqr = {
    "ticker": "APP",
    "fiscal_period_end": "2026-03-31",
    "earnings_date": "2026-05-06",
    "release_time": "amc",
    "fiscal_label": "2026 Q1",
    "is_recent": True,
    "result": "beat",
    "generated_at": now,

    "headline": "APP AppLovin 2026 Q1 财报超预期: EPS +3.5%、营收 +4.1% (vs 共识), Adj EBITDA Margin 85% 创纪录",

    # ① 业绩数据
    "data_card": {
        "eps_actual": 3.56,
        "eps_estimate": 3.44,
        "eps_surprise_pct": 3.49,
        "rev_actual": 1842400000,
        "rev_estimate": 1770000000,
        "rev_surprise_pct": 4.09,
        "rev_yoy_pct": 24.2,           # 表观 YoY (含 Apps 在 Q1'25 = $1,484M)
        "rev_qoq_pct": 11.1,
        "rev_yoy_pct_alt": 59.0,       # ⭐ 软件平台单独 +59%
        "rev_yoy_pct_alt_label": "软件平台单独",
        "gross_margin": 0.889,
        "gross_margin_yoy_bps": 720,   # 88.9% vs 81.7% 同期
        "net_margin": 0.655,           # GAAP Net Income $1,206M / $1,842M
        "net_margin_yoy_bps": 2670,    # vs 38.8% Q1'25
        "third_metric": {
            "label": "Adj EBITDA Margin",
            "actual": 0.85,
            "format": "pct",
            "estimate": 0.83,
            "surprise_pct": 2.4,
            "yoy_change_pp": 34,
            "note": "创纪录 (vs Q1'25 50.6%)"
        }
    },

    # ② 关键 KPI (6 项)
    "kpis": [
        {
            "label": "FCF 自由现金流", "value": 1291000000, "format": "usd",
            "yoy_change_pct": 56, "yoy_change_pp": None, "qoq_change_pct": 0.5,
            "tone": "positive", "note": "4 季度连续加速: $772M→$1,053M→$1,286M→$1,291M"
        },
        {
            "label": "FCF / 营收", "value": 0.701, "format": "pct",
            "yoy_change_pct": None, "yoy_change_pp": 14, "qoq_change_pct": None,
            "tone": "positive", "note": "capital-light 极致"
        },
        {
            "label": "Capex 资本开支", "value": 0, "format": "usd",
            "yoy_change_pct": None, "yoy_change_pp": None, "qoq_change_pct": None,
            "tone": "positive", "note": "纯软件平台, 无 AI capex 烧钱压力"
        },
        {
            "label": "股票回购", "value": 982000000, "format": "usd",
            "yoy_change_pct": 261, "yoy_change_pp": None, "qoq_change_pct": 135,
            "tone": "positive", "note": "Q1 单季创纪录 (Q4 $418M 的 2.4×)"
        },
        {
            "label": "SBC / 营收", "value": 0.045, "format": "pct",
            "yoy_change_pct": None, "yoy_change_pp": 1.6, "qoq_change_pct": None,
            "tone": "neutral", "note": "<10% 健康区间, 微升"
        },
        {
            "label": "Cash 现金", "value": 2759000000, "format": "usd",
            "yoy_change_pct": None, "yoy_change_pp": None, "qoq_change_pct": 11,
            "tone": "positive", "note": "Net Debt $0.76B (vs Q4 $1.06B, 改善)"
        },
    ],

    # ③ 管理层指引 Q2 2026
    "guidance": {
        "next_period_label": "Q2 2026",
        "items": [
            {
                "metric": "营收", "range": "$1,920-1,950M",
                "midpoint": 1935000000, "vs_consensus_pct": 2.4, "format": "usd"
            },
            {
                "metric": "Adj EBITDA", "range": "$1,620-1,650M",
                "midpoint": 1635000000, "vs_consensus_pct": 2.8, "format": "usd"
            },
            {
                "metric": "EBITDA Margin", "range": "~84.5%",
                "midpoint": 0.845, "vs_consensus_pct": None, "format": "pct"
            },
        ],
        "annual_note": "全年指引未给 (沿用 Q+1 滚动指引惯例)",
        "summary_tone": "raise",
        "summary_text": "高出共识 (+2.4% / +2.8%), 隐含 Q2 软件平台 +53% YoY 仍高速"
    },

    # ④ Beat 质量评估 → 顶级优质
    "beat_quality": {
        "rating": "premium",
        "rating_label": "🟢🟢🟢 顶级优质",
        "checks": [
            {
                "label": "GAAP/Non-GAAP 差距", "value": "GAAP Op Margin 78.2%",
                "status": "good", "hint": "几乎一致, 不靠 Adj 美化 (GAAP 真实利润率超 70%)"
            },
            {
                "label": "OCF / 净利润", "value": "107%",
                "status": "good", "hint": ">100% = 现金流 ≥ 利润, 质量极优"
            },
            {
                "label": "SBC / 营收", "value": "4.5%",
                "status": "good", "hint": "<10% 健康区间 (NVDA 5%, RDDT 10%)"
            },
            {
                "label": "Capex 强度", "value": "$0",
                "status": "good", "hint": "纯软件平台, 无 AI capex 烧钱压力"
            },
        ],
        "summary": "EBITDA Margin 85% 全球科技股顶级 (NVDA 75% / META 50% / GOOGL 38%)"
    },

    # ⑤ 健康度 5 维红绿灯
    "health": {
        "overall_rating": 5,
        "dimensions": [
            {
                "label": "营收增长", "stars": 2, "status": "great",
                "note": "软件平台 +59% YoY, Q2 指引 +53% 仍加速"
            },
            {
                "label": "毛利率", "stars": 2, "status": "great",
                "note": "88.9% (vs 81.7% 同期含 Apps 拖累) — 纯软件极致"
            },
            {
                "label": "运营效率", "stars": 2, "status": "great",
                "note": "OpEx/Rev 21.8% (vs 同期 55.3%) — 杠杆爆发"
            },
            {
                "label": "现金流", "stars": 2, "status": "great",
                "note": "FCF $1.29B/季 = $5B+/年化, FCF Margin 70%"
            },
            {
                "label": "资产负债", "stars": 1, "status": "good",
                "note": "Net Debt $0.76B (改善 vs Q4 $1.06B)"
            },
        ]
    },

    # ⑥ 管理层叙事
    "narrative": {
        "themes": [
            {
                "title": "🚀 Axon 6 月全球 self-serve 公开化",
                "detail": "CEO Adam Foroughi 称这是「game-changer, unlocking new growth opportunities」。当前 Axon 仍是 managed service 模式 (高 touch 销售), 6 月开放 self-serve 后中小广告主可一键接入, TAM 几何级扩张, 对标 Google Ads / Meta Ads Manager。这是叙事修复 + 下一轮估值扩张的关键 catalyst。"
            },
            {
                "title": "📈 软件平台 +59% YoY",
                "detail": "Apps 业务在 2025-06 剥离给 Tripledot 后, 纯广告平台同比加速。验证 AI 广告通胀传导 (META Q1 +27% ARPP, RDDT Q1 +50% US ARPU)。"
            },
            {
                "title": "💰 单季回购 $982M 创纪录",
                "detail": "管理层用真金白银投票, 认为当前股价被低估。YTD 节奏看 2026 全年回购可能突破 $4B (vs 2025 全年 $1.7B, 2.5×)。"
            },
        ],
        "tone": "confident",
        "tone_evidence": "CEO Foroughi 「game-changer」用词罕见地激进 (平时偏保守); 每季加速、每季回购、6 月还有大新闻; 直接用业绩 + 回购回应 4 月 IBM/SaaS 板块下跌带来的「AI 身份危机」叙事。",
        "generated_by": "opus-4.7",
        "generated_at": now
    },
    "narrative_status": "done",

    # 顶部色标 chip
    "badges": [
        {"color": "green", "label": "EPS 大超预期", "hint": "EPS 实际超预期 3.5% (3.56 vs 3.44)"},
        {"color": "green", "label": "营收超预期", "hint": "营收超预期 4.1% (1842M vs 1770M)"},
        {"color": "green", "label": "营收高增长", "hint": "软件平台 YoY +59% (剥离 Apps 后纯口径)"},
        {"color": "green", "label": "顶级 FCF", "hint": "FCF Margin 70.1%, +14pp YoY"},
        {"color": "green", "label": "加大回购", "hint": "Q1 单季 $982M 创纪录, 是 Q4 的 2.4×"},
        {"color": "green", "label": "顶级 Beat 质量", "hint": "OCF/NI 107%, GAAP/Non-GAAP 几乎一致"},
    ],

    # 旧字段保留兼容 (旧前端 fallback)
    "fundamentals": [],
    "market_reaction": {
        "atm_iv": None, "iv_level": None, "put_call_ratio": None, "pcr_label": None,
        "ratings_30d": None, "form8k_30d": 0
    },
}

data["by_ticker"]["APP"] = app_eqr

with open(F, "w") as fp:
    json.dump(data, fp, ensure_ascii=False, indent=2)

print(f"  ✅ 注入 APP Q1 2026 EQR 完成")
print(f"  📁 写入 {F}")
