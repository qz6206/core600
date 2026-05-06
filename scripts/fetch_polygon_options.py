#!/usr/bin/env python3
"""预拉取 Polygon 期权异动数据 → data/options.json

为「期权异动」区块提供数据：
- 当前现价（spot）
- ATM IV（30天附近 ATM 期权的隐波，过滤掉 OI=0 / 无成交的"假 IV"）
- Put/Call 量比（市场情绪）
- Top 10 今日最活跃合约（含 vol/OI 比 — 异动指标）

每只股票 2-5 次 Polygon API 调用：
1. /v2/aggs/ticker/{T}/prev → 前一交易日收盘价（spot 参考）
2. /v3/snapshot/options/{T}?expiration_date.gte=today&lte=+90d&limit=250
   分页 1-4 次，最多取 1000 个合约（覆盖 90 天内主要活跃合约）

输出格式：
{
  "generated_at": "...",
  "by_ticker": {
    "AAPL": {
      "spot": 209.25,
      "atm_iv": 0.27,
      "atm_iv_count": 8,
      "total_vol": 482310,
      "call_vol": 280440,
      "put_vol": 201870,
      "put_call_ratio": 0.72,
      "top_contracts": [
        {ticker, type, strike, exp, vol, oi, vol_oi_ratio, iv, delta, change_pct},
        ...
      ]
    }
  }
}

频率建议：每天美股收盘后跑一次（cron 1:00 UTC）
"""
import json
import os
import time
import urllib.request
import urllib.parse
import urllib.error
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone, timedelta
from pathlib import Path
from statistics import median

ROOT = Path(__file__).parent.parent
STOCKS_JSON = ROOT / "data" / "stocks.json"
OUTPUT_JSON = ROOT / "data" / "options.json"
ENV_LOCAL = ROOT / ".env.local"

NUM_WORKERS = 6
MAX_PAGES = 4              # 每只股票最多翻 4 页 = 1000 合约（90 天内通常够）
DAYS_AHEAD = 90            # 抓未来 90 天到期的合约
TOP_N = 10
MAX_RETRIES = 3
TIMEOUT = 30

# stocks.json 用 dash 格式（BRK-B），Polygon 用 dot（BRK.B）— 这里映射
POLYGON_TICKER_OVERRIDES = {
    "BRK-B": "BRK.B",
    "BF-B": "BF.B",
}


def load_api_key() -> str:
    key = os.environ.get("POLYGON_API_KEY")
    if key:
        return key
    if ENV_LOCAL.exists():
        for line in ENV_LOCAL.read_text().splitlines():
            line = line.strip()
            if line.startswith("POLYGON_API_KEY="):
                return line.split("=", 1)[1].strip().strip('"').strip("'")
    raise SystemExit("❌ POLYGON_API_KEY 未设置")


API_KEY = load_api_key()


def polygon_get(url: str) -> dict | None:
    sep = "&" if "?" in url else "?"
    full_url = f"{url}{sep}apiKey={API_KEY}"
    for attempt in range(MAX_RETRIES):
        try:
            req = urllib.request.Request(full_url, headers={"User-Agent": "Core600/0.1"})
            with urllib.request.urlopen(req, timeout=TIMEOUT) as r:
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


def fetch_spot(ticker: str) -> float | None:
    """前一交易日收盘价"""
    data = polygon_get(f"https://api.polygon.io/v2/aggs/ticker/{ticker}/prev")
    if not data or data.get("status") != "OK":
        return None
    results = data.get("results", [])
    if not results:
        return None
    return results[0].get("c")  # close


def fetch_chain(ticker: str, today: str, end_date: str) -> list[dict]:
    """分页拉取 90 天内所有合约（最多 4 页 = 1000 个）"""
    contracts = []
    cursor = None
    for page in range(MAX_PAGES):
        if cursor:
            # next_url 已经包含完整 URL（含 cursor），但不含 apiKey
            url = cursor
        else:
            url = (
                f"https://api.polygon.io/v3/snapshot/options/{ticker}"
                f"?expiration_date.gte={today}&expiration_date.lte={end_date}&limit=250"
            )
        data = polygon_get(url)
        if not data or data.get("status") != "OK":
            break
        results = data.get("results", [])
        if not results:
            break
        contracts.extend(results)
        next_url = data.get("next_url")
        if not next_url:
            break
        cursor = next_url  # 下一页直接用 next_url（已含所有 query 参数）
    return contracts


def process_chain(contracts: list[dict], spot: float | None) -> dict:
    """聚合 + 选 Top 10 + 算 ATM IV"""
    # 今天有交易的合约
    active = []
    for c in contracts:
        day = c.get("day", {}) or {}
        vol = day.get("volume", 0) or 0
        if vol > 0:
            active.append(c)

    # 按今日成交量倒序
    active.sort(key=lambda c: c.get("day", {}).get("volume", 0) or 0, reverse=True)

    # 聚合
    total_vol = sum(c["day"]["volume"] for c in active)
    call_vol = sum(c["day"]["volume"] for c in active if c["details"]["contract_type"] == "call")
    put_vol = sum(c["day"]["volume"] for c in active if c["details"]["contract_type"] == "put")
    pc_ratio = (put_vol / call_vol) if call_vol else None

    # ATM IV：取 strike 在 spot ±5% 内、DTE 14-45 天、OI≥100、有 IV 的合约，取中位数
    atm_iv = None
    atm_iv_count = 0
    if spot:
        today_dt = datetime.now(timezone.utc).date()
        candidates = []
        for c in contracts:
            det = c["details"]
            iv = c.get("implied_volatility")
            oi = c.get("open_interest", 0) or 0
            strike = det.get("strike_price")
            exp = det.get("expiration_date")
            if not (iv and strike and exp and oi >= 100):
                continue
            try:
                exp_dt = datetime.strptime(exp, "%Y-%m-%d").date()
            except Exception:
                continue
            dte = (exp_dt - today_dt).days
            if not (14 <= dte <= 45):
                continue
            if abs(strike - spot) / spot > 0.05:  # ±5% 之外的不算 ATM
                continue
            # 过滤掉明显异常的 IV（< 1% 或 > 500%，Polygon 偶尔 stale 数据）
            if iv < 0.01 or iv > 5.0:
                continue
            candidates.append(iv)
        if candidates:
            atm_iv = median(candidates)
            atm_iv_count = len(candidates)

    # Top N 合约（精简字段）
    top_contracts = []
    for c in active[:TOP_N]:
        det = c["details"]
        day = c["day"]
        oi = c.get("open_interest") or 0
        vol = day.get("volume", 0)
        top_contracts.append({
            "ticker": det.get("ticker"),
            "type": det.get("contract_type"),
            "strike": det.get("strike_price"),
            "exp": det.get("expiration_date"),
            "vol": vol,
            "oi": oi,
            "vol_oi_ratio": (vol / oi) if oi else None,
            "iv": c.get("implied_volatility"),
            "delta": (c.get("greeks") or {}).get("delta"),
            "last_price": day.get("close"),
            "change_pct": day.get("change_percent"),
        })

    return {
        "spot": spot,
        "atm_iv": atm_iv,
        "atm_iv_count": atm_iv_count,
        "total_vol": total_vol,
        "call_vol": call_vol,
        "put_vol": put_vol,
        "put_call_ratio": pc_ratio,
        "top_contracts": top_contracts,
        "active_count": len(active),
        "total_chain_count": len(contracts),
    }


def fetch_one(stock_ticker: str, today: str, end_date: str) -> dict | None:
    """stock_ticker 是 stocks.json 里的格式（如 BRK-B），调 Polygon 时用 mapping 转换"""
    polygon_ticker = POLYGON_TICKER_OVERRIDES.get(stock_ticker, stock_ticker)
    spot = fetch_spot(polygon_ticker)
    contracts = fetch_chain(polygon_ticker, today, end_date)
    if not contracts:
        return None
    return process_chain(contracts, spot)


def main():
    t_start = time.time()
    today_dt = datetime.now(timezone.utc).date()
    today = today_dt.strftime("%Y-%m-%d")
    end_date = (today_dt + timedelta(days=DAYS_AHEAD)).strftime("%Y-%m-%d")

    print(f"📥 加载 stocks.json...", flush=True)
    with open(STOCKS_JSON) as f:
        stocks = json.load(f)["stocks"]
    total = len(stocks)
    print(f"   ✓ {total} 只股票", flush=True)
    print(f"   📅 抓 {today} ~ {end_date}（未来 {DAYS_AHEAD} 天）合约", flush=True)
    print(f"   🧵 {NUM_WORKERS} 线程，每只最多翻 {MAX_PAGES} 页 = {MAX_PAGES * 250} 合约\n", flush=True)

    by_ticker = {}
    failed = []
    completed = 0
    has_top = 0

    with ThreadPoolExecutor(max_workers=NUM_WORKERS) as pool:
        futures = {pool.submit(fetch_one, s["ticker"], today, end_date): s["ticker"] for s in stocks}
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
                    print(f"[{completed}/{total}] {ticker}: 无期权数据", flush=True)
                continue

            by_ticker[ticker] = data
            if data["top_contracts"]:
                has_top += 1

            if completed % 50 == 0:
                tn = len(data["top_contracts"])
                print(f"[{completed}/{total}] 进度（{ticker}: top {tn}, 总链 {data['total_chain_count']}）", flush=True)

    output = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "stats": {
            "total": total,
            "with_data": len(by_ticker),
            "with_top_contracts": has_top,
            "failed": len(failed),
        },
        "by_ticker": by_ticker,
    }

    OUTPUT_JSON.parent.mkdir(parents=True, exist_ok=True)
    with open(OUTPUT_JSON, "w", encoding="utf-8") as f:
        json.dump(output, f, ensure_ascii=False, indent=2)

    elapsed = time.time() - t_start
    print(f"\n📊 完成（耗时 {elapsed:.1f}s）:", flush=True)
    print(f"   ✅ 有数据:   {len(by_ticker)} / {total}", flush=True)
    print(f"   ✅ 有 Top:   {has_top} / {total}", flush=True)
    print(f"   ❌ 无数据:   {len(failed)}", flush=True)
    if failed:
        print(f"   失败列表（前 20）: {failed[:20]}", flush=True)
    print(f"   💾 输出: {OUTPUT_JSON} ({OUTPUT_JSON.stat().st_size / 1024 / 1024:.2f} MB)", flush=True)


if __name__ == "__main__":
    main()
