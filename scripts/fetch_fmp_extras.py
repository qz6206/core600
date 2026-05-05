#!/usr/bin/env python3
"""预拉取 FMP 杂项数据 → data/fmp_extras.json

为以下 3 个详情页区块提供数据：
- 🔮 分析师预期：未来 4 季 EPS/营收 + 过去 8 季 Beat/Miss + 最近 10 条评级变动
- 📅 财报日历：下次财报日 + 过去 8 次记录
- 📉 股本动态：8 季 SBC + 8 季摊薄股数 + 最近 10 条回购授权（如有）

每只股票 5 次 FMP API 调用：
1. /v3/analyst-estimates?period=quarter&limit=4 → 未来 4 季 EPS/营收
2. /v3/historical/earning_calendar?limit=12 → 财报日历（含 EPS 实际 vs 预期）
3. /v3/cash-flow-statement?period=quarter&limit=8 → SBC + 自由现金流
4. /v3/income-statement?period=quarter&limit=8 → 摊薄股数（看股数稀释/缩减）
5. /v4/upgrades-downgrades?symbol=X → 最近评级变动（Top 10）

输出格式：
{
  "generated_at": "...",
  "by_ticker": {
    "AAPL": {
      "estimates": [{date, eps_avg, rev_avg, num_analysts}, ... 4 条],
      "earnings": [{date, eps_actual, eps_estimate, rev_actual, rev_estimate, time}, ... 12 条],
      "sbc": [{date, period, sbc, ocf, fcf}, ... 8 条],
      "shares": [{date, period, weighted_avg_diluted}, ... 8 条],
      "ratings": [{date, company, prev_grade, new_grade, action, target_price}, ... 10 条]
    }
  }
}
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
OUTPUT_JSON = ROOT / "data" / "fmp_extras.json"
ENV_LOCAL = ROOT / ".env.local"

NUM_WORKERS = 8
MAX_RETRIES = 3


def load_api_key() -> str:
    key = os.environ.get("FMP_API_KEY")
    if key:
        return key
    if ENV_LOCAL.exists():
        for line in ENV_LOCAL.read_text().splitlines():
            line = line.strip()
            if line.startswith("FMP_API_KEY="):
                return line.split("=", 1)[1].strip().strip('"').strip("'")
    raise SystemExit("❌ FMP_API_KEY 未设置")


API_KEY = load_api_key()


def fmp_get(url: str) -> list | dict | None:
    sep = "&" if "?" in url else "?"
    full_url = f"{url}{sep}apikey={API_KEY}"
    for attempt in range(MAX_RETRIES):
        try:
            req = urllib.request.Request(full_url, headers={"User-Agent": "Core600/0.1"})
            with urllib.request.urlopen(req, timeout=30) as r:
                return json.loads(r.read())
        except urllib.error.HTTPError as e:
            if e.code in (429, 500, 502, 503, 504):
                time.sleep(2 ** attempt)
                continue
            return None
        except Exception:
            time.sleep(1)
            continue
    return None


def fetch_estimates(ticker: str) -> list:
    """未来 4 季度 EPS / 营收预期"""
    data = fmp_get(f"https://financialmodelingprep.com/api/v3/analyst-estimates/{ticker}?period=quarter&limit=4")
    if not data or not isinstance(data, list):
        return []
    out = []
    for e in data[:4]:
        out.append({
            "date": e.get("date"),
            "eps_avg": e.get("estimatedEpsAvg"),
            "eps_low": e.get("estimatedEpsLow"),
            "eps_high": e.get("estimatedEpsHigh"),
            "rev_avg": e.get("estimatedRevenueAvg"),
            "num_analysts": e.get("numberAnalystEstimatedRevenue"),
        })
    return out


def fetch_earnings(ticker: str) -> list:
    """财报日历（过去 + 未来），FMP 返回最新在前"""
    data = fmp_get(f"https://financialmodelingprep.com/api/v3/historical/earning_calendar/{ticker}?limit=12")
    if not data or not isinstance(data, list):
        return []
    out = []
    for e in data[:12]:
        out.append({
            "date": e.get("date"),
            "eps_actual": e.get("eps"),
            "eps_estimate": e.get("epsEstimated"),
            "rev_actual": e.get("revenue"),
            "rev_estimate": e.get("revenueEstimated"),
            "time": e.get("time"),  # bmo / amc / -
            "fiscal_period_end": e.get("fiscalDateEnding"),
        })
    return out


def fetch_cashflow(ticker: str) -> list:
    """8 季度 SBC + OCF + FCF"""
    data = fmp_get(f"https://financialmodelingprep.com/api/v3/cash-flow-statement/{ticker}?period=quarter&limit=8")
    if not data or not isinstance(data, list):
        return []
    out = []
    for e in data[:8]:
        out.append({
            "date": e.get("date"),
            "period": e.get("period"),
            "calendar_year": e.get("calendarYear"),
            "sbc": e.get("stockBasedCompensation"),
            "ocf": e.get("netCashProvidedByOperatingActivities"),
            "fcf": e.get("freeCashFlow"),
            "buyback": e.get("commonStockRepurchased"),  # 负数 = 回购
            "issuance": e.get("commonStockIssued"),       # 正数 = 发行
        })
    return out


def fetch_income(ticker: str) -> list:
    """8 季度摊薄股数（看稀释/缩减趋势）"""
    data = fmp_get(f"https://financialmodelingprep.com/api/v3/income-statement/{ticker}?period=quarter&limit=8")
    if not data or not isinstance(data, list):
        return []
    out = []
    for e in data[:8]:
        out.append({
            "date": e.get("date"),
            "period": e.get("period"),
            "calendar_year": e.get("calendarYear"),
            "weighted_avg_diluted": e.get("weightedAverageShsOutDil"),
            "weighted_avg_basic": e.get("weightedAverageShsOut"),
            "net_income": e.get("netIncome"),
            "revenue": e.get("revenue"),
        })
    return out


def fetch_ratings(ticker: str) -> list:
    """最近 10 条评级变动"""
    data = fmp_get(f"https://financialmodelingprep.com/api/v4/upgrades-downgrades?symbol={ticker}")
    if not data or not isinstance(data, list):
        return []
    out = []
    for e in data[:10]:
        # 从 newsTitle 提取 target price，比如 "raised to $335 from $325" → 335
        title = e.get("newsTitle", "") or ""
        target = None
        import re
        m = re.search(r"\$\s?(\d+(?:\.\d+)?)", title)
        if m:
            target = float(m.group(1))
        out.append({
            "date": e.get("publishedDate", "")[:10],
            "company": e.get("gradingCompany"),
            "prev_grade": e.get("previousGrade"),
            "new_grade": e.get("newGrade"),
            "action": e.get("action"),  # initiate / upgrade / downgrade / hold
            "target_price": target,
            "title": title,
        })
    return out


def fetch_one(ticker: str) -> dict:
    """同时拉 5 类数据"""
    return {
        "estimates": fetch_estimates(ticker),
        "earnings": fetch_earnings(ticker),
        "sbc": fetch_cashflow(ticker),
        "shares": fetch_income(ticker),
        "ratings": fetch_ratings(ticker),
    }


def main():
    t_start = time.time()
    print("📥 加载 stocks.json...", flush=True)
    with open(STOCKS_JSON) as f:
        stocks = json.load(f)["stocks"]
    total = len(stocks)
    print(f"   ✓ {total} 只股票", flush=True)
    print(f"   🧵 {NUM_WORKERS} 线程并行", flush=True)
    print(f"   📊 每只 5 次 FMP 调用（estimates/earnings/cashflow/income/ratings）\n", flush=True)

    by_ticker = {}
    completed = 0
    fully_failed = []
    counters = {"estimates": 0, "earnings": 0, "sbc": 0, "shares": 0, "ratings": 0}

    with ThreadPoolExecutor(max_workers=NUM_WORKERS) as pool:
        futures = {pool.submit(fetch_one, s["ticker"]): s["ticker"] for s in stocks}
        for fut in as_completed(futures):
            completed += 1
            ticker = futures[fut]
            try:
                data = fut.result()
            except Exception as e:
                print(f"[{completed}/{total}] {ticker}: 异常 {e}", flush=True)
                fully_failed.append(ticker)
                continue

            by_ticker[ticker] = data
            for k in counters:
                if data.get(k):
                    counters[k] += 1
            non_empty = sum(1 for v in data.values() if v)
            if non_empty == 0:
                fully_failed.append(ticker)
            if completed % 50 == 0:
                print(f"[{completed}/{total}] 进度（{ticker}: {non_empty}/5 非空）", flush=True)

    output = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "stats": {
            "total": total,
            "with_estimates": counters["estimates"],
            "with_earnings": counters["earnings"],
            "with_sbc": counters["sbc"],
            "with_shares": counters["shares"],
            "with_ratings": counters["ratings"],
            "fully_failed": len(fully_failed),
        },
        "by_ticker": by_ticker,
    }

    OUTPUT_JSON.parent.mkdir(parents=True, exist_ok=True)
    with open(OUTPUT_JSON, "w", encoding="utf-8") as f:
        json.dump(output, f, ensure_ascii=False, indent=2)

    elapsed = time.time() - t_start
    print(f"\n📊 完成（耗时 {elapsed:.1f}s）:", flush=True)
    for k, v in counters.items():
        print(f"   ✅ 有 {k}: {v} / {total}", flush=True)
    print(f"   ❌ 完全失败: {len(fully_failed)}", flush=True)
    if fully_failed:
        print(f"   失败列表（前 20）: {fully_failed[:20]}", flush=True)
    print(f"   💾 输出: {OUTPUT_JSON} ({OUTPUT_JSON.stat().st_size / 1024 / 1024:.2f} MB)", flush=True)


if __name__ == "__main__":
    main()
