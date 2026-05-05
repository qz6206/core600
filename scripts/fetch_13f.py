#!/usr/bin/env python3
"""预拉取所有 600 强股票 13F（机构持仓）汇总 + Top 10 持仓机构 → data/13f.json

数据源：FMP API v4（用户 Premium 包含）
- 聚合：/institutional-ownership/symbol-ownership
- Top 持仓：/institutional-ownership/institutional-holders/symbol-ownership-percent

为什么预拉取：13F 只季度更新（45天后），无需实时；统一与 SEC 一致的静态 JSON 架构

输出格式：
{
  "generated_at": "...",
  "by_ticker": {
    "AAPL": {
      "summary": {date, investorsHolding, ownershipPercent, newPositions, ...},
      "topHolders": [{investorName, sharesNumber, ownership, ...}, ... 10 条]
    }
  }
}

频率建议：每周一次（13F 季度才更新一次，没必要更频）
"""
import json
import os
import time
import urllib.request
import urllib.parse
import urllib.error
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).parent.parent
STOCKS_JSON = ROOT / "data" / "stocks.json"
OUTPUT_JSON = ROOT / "data" / "13f.json"
ENV_LOCAL = ROOT / ".env.local"

NUM_WORKERS = 6  # FMP Premium 限流较宽，可并行 6 个
TOP_HOLDERS = 10
MAX_RETRIES = 3


def load_api_key() -> str:
    """从 .env.local 读 FMP_API_KEY；CI 中从环境变量读"""
    key = os.environ.get("FMP_API_KEY")
    if key:
        return key
    if ENV_LOCAL.exists():
        for line in ENV_LOCAL.read_text().splitlines():
            line = line.strip()
            if line.startswith("FMP_API_KEY="):
                return line.split("=", 1)[1].strip().strip('"').strip("'")
    raise SystemExit("❌ FMP_API_KEY 未设置（环境变量或 .env.local）")


API_KEY = load_api_key()


def fmp_get(url: str) -> list | dict | None:
    """带 apikey + 重试的 FMP GET"""
    sep = "&" if "?" in url else "?"
    full_url = f"{url}{sep}apikey={API_KEY}"
    for attempt in range(MAX_RETRIES):
        try:
            req = urllib.request.Request(full_url, headers={"User-Agent": "Core600/0.1"})
            with urllib.request.urlopen(req, timeout=30) as r:
                return json.loads(r.read())
        except urllib.error.HTTPError as e:
            if e.code in (429, 500, 502, 503, 504):
                backoff = 2 ** attempt
                time.sleep(backoff)
                continue
            return None
        except Exception:
            time.sleep(1)
            continue
    return None


def fetch_one(ticker: str) -> dict | None:
    """同时拉聚合 + Top 持仓"""
    # 1. 聚合（拿最新一个季度）
    summary_data = fmp_get(
        f"https://financialmodelingprep.com/api/v4/institutional-ownership/symbol-ownership?symbol={ticker}"
    )
    if not summary_data or not isinstance(summary_data, list) or len(summary_data) == 0:
        return None
    latest = summary_data[0]
    summary = {
        "date": latest.get("date"),
        "investorsHolding": latest.get("investorsHolding"),
        "investorsHoldingChange": latest.get("investorsHoldingChange"),
        "numberOf13Fshares": latest.get("numberOf13Fshares"),
        "numberOf13FsharesChange": latest.get("numberOf13FsharesChange"),
        "totalInvested": latest.get("totalInvested"),
        "ownershipPercent": latest.get("ownershipPercent"),
        "ownershipPercentChange": latest.get("ownershipPercentChange"),
        "newPositions": latest.get("newPositions"),
        "increasedPositions": latest.get("increasedPositions"),
        "closedPositions": latest.get("closedPositions"),
        "reducedPositions": latest.get("reducedPositions"),
    }

    # 2. Top 持仓机构（按 ownership % 排序）
    holders_data = fmp_get(
        f"https://financialmodelingprep.com/api/v4/institutional-ownership/institutional-holders/symbol-ownership-percent?symbol={ticker}&date={summary['date']}&page=0"
    )
    top_holders = []
    if holders_data and isinstance(holders_data, list):
        for h in holders_data[:TOP_HOLDERS]:
            top_holders.append({
                "investorName": h.get("investorName"),
                "cik": h.get("cik"),
                "sharesNumber": h.get("sharesNumber"),
                "lastSharesNumber": h.get("lastSharesNumber"),
                "changeInSharesNumber": h.get("changeInSharesNumber"),
                "changeInSharesNumberPercentage": h.get("changeInSharesNumberPercentage"),
                "ownership": h.get("ownership"),
                "weight": h.get("weight"),
                "isNew": h.get("isNew"),
                "isSoldOut": h.get("isSoldOut"),
                "holdingPeriod": h.get("holdingPeriod"),
                "firstAdded": h.get("firstAdded"),
            })

    return {"summary": summary, "topHolders": top_holders}


def main():
    t_start = time.time()
    print("📥 加载 stocks.json...", flush=True)
    with open(STOCKS_JSON) as f:
        stocks = json.load(f)["stocks"]

    total = len(stocks)
    print(f"   ✓ {total} 只股票", flush=True)
    print(f"   🧵 {NUM_WORKERS} 线程并行", flush=True)
    print(f"   📊 拉聚合 + Top {TOP_HOLDERS} 机构持仓\n", flush=True)

    by_ticker = {}
    failed = []
    completed = 0
    with_summary = 0
    with_holders = 0

    with ThreadPoolExecutor(max_workers=NUM_WORKERS) as pool:
        futures = {pool.submit(fetch_one, s["ticker"]): s["ticker"] for s in stocks}
        for fut in as_completed(futures):
            completed += 1
            ticker = futures[fut]
            try:
                data = fut.result()
            except Exception as e:
                print(f"[{completed}/{total}] {ticker}: 异常 {e}", flush=True)
                failed.append(ticker)
                continue

            if data is None:
                failed.append(ticker)
                if completed % 50 == 0:
                    print(f"[{completed}/{total}] {ticker}: 无数据", flush=True)
                continue

            by_ticker[ticker] = data
            if data.get("summary", {}).get("date"):
                with_summary += 1
            if data.get("topHolders"):
                with_holders += 1

            if completed % 50 == 0:
                top_n = len(data.get("topHolders", []))
                print(f"[{completed}/{total}] 进度（{ticker}: 持仓机构 Top {top_n}）", flush=True)

    output = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "stats": {
            "total": total,
            "with_summary": with_summary,
            "with_holders": with_holders,
            "failed": len(failed),
        },
        "by_ticker": by_ticker,
    }

    OUTPUT_JSON.parent.mkdir(parents=True, exist_ok=True)
    with open(OUTPUT_JSON, "w", encoding="utf-8") as f:
        json.dump(output, f, ensure_ascii=False, indent=2)

    elapsed = time.time() - t_start
    print(f"\n📊 完成（耗时 {elapsed:.1f}s）:", flush=True)
    print(f"   ✅ 有聚合数据: {with_summary} / {total}", flush=True)
    print(f"   ✅ 有 Top 持仓: {with_holders} / {total}", flush=True)
    print(f"   ❌ 失败:        {len(failed)}", flush=True)
    if failed:
        print(f"   失败列表（前 20）: {failed[:20]}", flush=True)
    print(f"   💾 输出: {OUTPUT_JSON} ({OUTPUT_JSON.stat().st_size / 1024 / 1024:.2f} MB)", flush=True)


if __name__ == "__main__":
    main()
