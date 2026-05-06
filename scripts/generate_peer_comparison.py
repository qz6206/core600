#!/usr/bin/env python3
"""
同业对比 — 给每只股票找同 industry 的 5-8 只股票，预生成对比指标矩阵

输出: data/peer_comparison.json
{
  "by_ticker": {
    "NVDA": {
      "ticker": "NVDA",
      "industry": "Semiconductors",
      "peers": [
        { ticker, name_cn, sector, industry,
          rev_ttm, rev_yoy_pct, gross_margin, net_margin,
          eps_streak (最近 4 次 Beat 数),
          atm_iv, ratings_30d (升降级数),
          buyback_recent_4q, sbc_to_ni_pct },
        ...
      ]
    }
  }
}

数据源:
- data/stocks.json: ticker / sector / industry / name_cn
- data/fmp_extras.json: shares (revenue/margins) + earnings + ratings + sbc
- data/options.json: atm_iv

匹配逻辑:
- 优先同 industry 的全部
- 不足 5 个时扩展到同 sector
- 按 revenue TTM 排序，取 top 8 (含本股)
"""
from __future__ import annotations

import json
from collections import defaultdict
from datetime import date, datetime, timedelta
from pathlib import Path
from typing import Any

ROOT = Path(__file__).parent.parent
DATA_DIR = ROOT / "data"
OUT_FILE = DATA_DIR / "peer_comparison.json"

MAX_PEERS = 8


def load_json(path: Path, default: Any) -> Any:
    if path.exists():
        with open(path) as f:
            return json.load(f)
    return default


def safe_pct(numer: float | None, denom: float | None) -> float | None:
    if numer is None or denom is None or denom == 0:
        return None
    return (numer - denom) / abs(denom) * 100


def compute_metrics(ticker: str, fmp: dict, options: dict) -> dict:
    """从 fmp_extras + options 算关键指标"""
    shares = fmp.get("shares", []) or []
    earnings = fmp.get("earnings", []) or []
    sbc = fmp.get("sbc", []) or []
    ratings = fmp.get("ratings", []) or []

    # TTM 营收 (最近 4 季加总)
    rev_ttm = sum(s.get("revenue") or 0 for s in shares[:4]) if len(shares) >= 4 else None

    # 营收同比 (最新 vs 4 季前)
    rev_yoy = None
    if len(shares) >= 5 and shares[0].get("revenue") and shares[4].get("revenue"):
        rev_yoy = safe_pct(shares[0]["revenue"], shares[4]["revenue"])

    # 毛利率 (最近一季)
    gm = shares[0].get("gross_margin") if shares else None

    # 净利率
    nm = shares[0].get("net_margin") if shares else None
    if nm is None and shares and shares[0].get("net_income") and shares[0].get("revenue"):
        nm = shares[0]["net_income"] / shares[0]["revenue"]

    # 最近 4 次 Beat 次数
    beat_count = 0
    for e in earnings[:4]:
        a = e.get("eps_actual")
        est = e.get("eps_estimate")
        if a is not None and est is not None and est != 0:
            diff = (a - est) / abs(est) * 100
            if diff > 3:
                beat_count += 1

    # ATM IV
    atm_iv = (options.get(ticker) or {}).get("atm_iv") if options else None

    # 评级 30 天动向
    today = date.today()
    cutoff = (today - timedelta(days=30)).isoformat()
    upgrades = 0
    downgrades = 0
    for r in ratings:
        rd = r.get("date", "")
        if rd >= cutoff:
            if r.get("action") == "upgrade":
                upgrades += 1
            elif r.get("action") == "downgrade":
                downgrades += 1

    # 回购 (最近 4 季 abs)
    buyback_4q = sum(abs(c.get("buyback") or 0) for c in sbc[:4])

    # SBC/净利
    sbc_ttm = sum(c.get("sbc") or 0 for c in sbc[:4])
    ni_ttm = sum(s.get("net_income") or 0 for s in shares[:4])
    sbc_to_ni = (sbc_ttm / abs(ni_ttm) * 100) if ni_ttm else None

    return {
        "rev_ttm": rev_ttm,
        "rev_yoy_pct": rev_yoy,
        "gross_margin": gm,
        "net_margin": nm,
        "beat_count_4q": beat_count,
        "atm_iv": atm_iv,
        "ratings_30d_upgrade": upgrades,
        "ratings_30d_downgrade": downgrades,
        "buyback_4q": buyback_4q,
        "sbc_to_ni_pct": sbc_to_ni,
    }


def main():
    print("📥 加载数据...", flush=True)
    stocks_data = load_json(DATA_DIR / "stocks.json", {"stocks": []})
    fmp_extras = load_json(DATA_DIR / "fmp_extras.json", {"by_ticker": {}})
    options = load_json(DATA_DIR / "options.json", {"by_ticker": {}})

    stocks = stocks_data.get("stocks", [])
    fmp_bt = fmp_extras.get("by_ticker", {})
    options_bt = options.get("by_ticker", {})

    # 按 industry / sector 分组
    by_industry: dict[str, list[dict]] = defaultdict(list)
    by_sector: dict[str, list[dict]] = defaultdict(list)
    for s in stocks:
        ind = s.get("industry") or ""
        sec = s.get("sector") or ""
        if ind:
            by_industry[ind].append(s)
        if sec:
            by_sector[sec].append(s)

    # 给所有 stock 预先算 metrics
    metrics: dict[str, dict] = {}
    for s in stocks:
        tk = s["ticker"]
        fmp = fmp_bt.get(tk, {})
        metrics[tk] = compute_metrics(tk, fmp, options_bt)

    # 找 peers
    out: dict[str, dict] = {}
    for s in stocks:
        tk = s["ticker"]
        ind = s.get("industry") or ""
        sec = s.get("sector") or ""

        # 候选: 同 industry 优先
        candidates: list[dict] = []
        seen = set()

        if ind:
            for c in by_industry[ind]:
                if c["ticker"] not in seen:
                    candidates.append(c)
                    seen.add(c["ticker"])

        # 不足 → 扩展到同 sector
        if len(candidates) < MAX_PEERS and sec:
            for c in by_sector[sec]:
                if c["ticker"] not in seen:
                    candidates.append(c)
                    seen.add(c["ticker"])
                if len(candidates) >= MAX_PEERS * 2:
                    break

        # 按 rev_ttm 排序
        candidates.sort(
            key=lambda c: metrics.get(c["ticker"], {}).get("rev_ttm") or 0,
            reverse=True,
        )

        # 确保本股在内 (前面如果没有，加进来)
        if tk in [c["ticker"] for c in candidates]:
            # 已在
            pass
        else:
            candidates.insert(0, s)

        # 取 top MAX_PEERS
        top = candidates[:MAX_PEERS]

        peers = []
        for c in top:
            ctk = c["ticker"]
            m = metrics.get(ctk, {})
            peers.append({
                "ticker": ctk,
                "name_cn": c.get("name_cn") or c.get("name", ""),
                "sector": c.get("sector"),
                "industry": c.get("industry"),
                "is_self": ctk == tk,
                **m,
            })

        out[tk] = {
            "ticker": tk,
            "industry": ind,
            "sector": sec,
            "peer_count": len(peers),
            "peers": peers,
        }

    output = {
        "generated_at": datetime.now().isoformat(),
        "schema_version": 1,
        "by_ticker": out,
    }

    OUT_FILE.parent.mkdir(parents=True, exist_ok=True)
    with open(OUT_FILE, "w") as f:
        json.dump(output, f, ensure_ascii=False, indent=2)

    print(f"\n✅ 完成: {len(out)} 只", flush=True)
    print(f"   💾 输出: {OUT_FILE} ({OUT_FILE.stat().st_size / 1024 / 1024:.2f} MB)", flush=True)


if __name__ == "__main__":
    main()
