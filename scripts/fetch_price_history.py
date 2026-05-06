#!/usr/bin/env python3
"""
预拉取 1 年日线 OHLC 数据 → public/prices/{TICKER}.json

数据源: FMP /api/v3/historical-price-full/{T}
存储: public/prices/{TICKER}.json (每只股票一个文件, ~30-60KB)

为啥按文件分:
- 一个总文件 ~10MB+, 全 516 页都打包很慢
- 按文件分 → 用户访问 NVDA 页面只 fetch /prices/NVDA.json
- 加 Cache-Control 后浏览器缓存

输出格式:
{
  "ticker": "NVDA",
  "from": "2025-05-06",
  "to": "2026-05-06",
  "candles": [
    {"t": "2025-05-06", "o": 95.12, "h": 96.5, "l": 94.8, "c": 95.9, "v": 12345678},
    ...
  ]
}
"""
from __future__ import annotations

import json
import os
import sys
import time
import urllib.request
import urllib.error
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import date, timedelta
from pathlib import Path

ROOT = Path(__file__).parent.parent
STOCKS_JSON = ROOT / "data" / "stocks.json"
OUTPUT_DIR = ROOT / "public" / "prices"
ENV_LOCAL = ROOT / ".env.local"

NUM_WORKERS = 8
MAX_RETRIES = 3
TIMEOUT = 30
DAYS_BACK = 365


def load_env(key: str) -> str | None:
    val = os.environ.get(key)
    if val:
        return val
    if ENV_LOCAL.exists():
        for line in ENV_LOCAL.read_text().splitlines():
            line = line.strip()
            if line.startswith(f"{key}="):
                return line.split("=", 1)[1].strip().strip('"').strip("'")
    return None


FMP_KEY = load_env("FMP_API_KEY") or sys.exit("❌ FMP_API_KEY 未设置")


def fmp_get(url: str) -> dict | None:
    sep = "&" if "?" in url else "?"
    full = f"{url}{sep}apikey={FMP_KEY}"
    for attempt in range(MAX_RETRIES):
        try:
            req = urllib.request.Request(full, headers={"User-Agent": "Core600/0.1"})
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


def fetch_one(ticker: str, from_date: str, to_date: str) -> list | None:
    url = f"https://financialmodelingprep.com/api/v3/historical-price-full/{ticker}?from={from_date}&to={to_date}"
    data = fmp_get(url)
    if not data or not isinstance(data, dict):
        return None
    historical = data.get("historical", [])
    if not historical:
        return None
    # FMP 返回降序 (最新在前), 转为升序便于绘图
    historical.sort(key=lambda x: x.get("date", ""))
    candles = []
    for h in historical:
        d = h.get("date")
        o = h.get("open")
        hi = h.get("high")
        lo = h.get("low")
        c = h.get("close")
        v = h.get("volume")
        if not (d and o is not None and hi is not None and lo is not None and c is not None):
            continue
        candles.append({
            "t": d,
            "o": round(o, 4),
            "h": round(hi, 4),
            "l": round(lo, 4),
            "c": round(c, 4),
            "v": v,
        })
    return candles


def main():
    t_start = time.time()
    print(f"📥 加载 stocks.json...", flush=True)
    with open(STOCKS_JSON) as f:
        stocks = json.load(f)["stocks"]
    total = len(stocks)
    today = date.today()
    from_date = (today - timedelta(days=DAYS_BACK)).isoformat()
    to_date = today.isoformat()
    print(f"   ✓ {total} 只股票", flush=True)
    print(f"   📅 抓 {from_date} ~ {to_date}", flush=True)
    print(f"   🧵 {NUM_WORKERS} 线程", flush=True)
    print(f"   📁 输出到 {OUTPUT_DIR}", flush=True)

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    completed = 0
    succeeded = 0
    failed = []
    total_size = 0

    with ThreadPoolExecutor(max_workers=NUM_WORKERS) as pool:
        futures = {pool.submit(fetch_one, s["ticker"], from_date, to_date): s["ticker"] for s in stocks}
        for fut in as_completed(futures):
            completed += 1
            ticker = futures[fut]
            try:
                candles = fut.result()
            except Exception as e:
                print(f"  [{completed}/{total}] {ticker}: 异常 {e}", flush=True)
                failed.append(ticker)
                continue

            if not candles:
                failed.append(ticker)
                if completed % 50 == 0:
                    print(f"  [{completed}/{total}] {ticker}: 无数据", flush=True)
                continue

            out = {
                "ticker": ticker,
                "from": from_date,
                "to": to_date,
                "candles": candles,
            }
            out_file = OUTPUT_DIR / f"{ticker}.json"
            with open(out_file, "w") as f:
                json.dump(out, f, separators=(",", ":"))  # 紧凑格式省空间
            succeeded += 1
            total_size += out_file.stat().st_size

            if completed % 50 == 0:
                print(f"  [{completed}/{total}] 进度（{ticker}: {len(candles)} bars, succeeded {succeeded}）", flush=True)

    elapsed = time.time() - t_start
    print(f"\n📊 完成 (耗时 {elapsed:.1f}s):", flush=True)
    print(f"   ✅ 成功: {succeeded} / {total}", flush=True)
    print(f"   ❌ 失败: {len(failed)}", flush=True)
    if failed:
        print(f"   失败列表（前 20）: {failed[:20]}", flush=True)
    print(f"   💾 总输出: {total_size / 1024 / 1024:.2f} MB", flush=True)


if __name__ == "__main__":
    main()
