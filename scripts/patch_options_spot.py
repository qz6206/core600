#!/usr/bin/env python3
"""
修补 options.json 中 spot=None 的股票（Polygon /v2/aggs/prev 被 rate limit 了）

策略:
1. 从 FMP 批量拿当前价（每 50 只一批，无 rate limit）
2. 写回 spot 字段
3. 重新拉 Polygon chain (针对没有 atm_iv 的股票) — 因为 atm_iv 计算依赖 chain，
   而 chain 数据没存到 options.json 里，必须重抓

改进版调用 Polygon 时:
- NUM_WORKERS=2（避免 429）
- 429 后退避 30s + 60s + 120s + 240s
"""
from __future__ import annotations
import json
import os
import sys
import time
import urllib.request
import urllib.error
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone, timedelta
from pathlib import Path

ROOT = Path(__file__).parent.parent
OPTIONS_JSON = ROOT / "data" / "options.json"
ENV_LOCAL = ROOT / ".env.local"

NUM_WORKERS = 2
MAX_RETRIES = 5
TIMEOUT = 30
DAYS_AHEAD = 90

POLYGON_TICKER_OVERRIDES = {"BRK-B": "BRK.B", "BF-B": "BF.B"}


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
POLY_KEY = load_env("POLYGON_API_KEY") or sys.exit("❌ POLYGON_API_KEY 未设置")


def fmp_bulk_quote(tickers: list[str]) -> dict[str, float]:
    """批量查 FMP quote，返回 {ticker: price}。每 50 只一批。"""
    out: dict[str, float] = {}
    for i in range(0, len(tickers), 50):
        batch = tickers[i : i + 50]
        # FMP 用 dot 不带 dash 但 stocks.json 都是 dash，这里直接用原 ticker
        # 注意 BRK-B → FMP 接受 BRK-B 格式
        url = f"https://financialmodelingprep.com/api/v3/quote/{','.join(batch)}?apikey={FMP_KEY}"
        try:
            with urllib.request.urlopen(url, timeout=TIMEOUT) as r:
                data = json.loads(r.read())
            for q in data:
                if q.get("symbol") and q.get("price"):
                    out[q["symbol"]] = float(q["price"])
        except Exception as e:
            print(f"  ⚠️ FMP batch {i}-{i+50} 失败: {e}", flush=True)
    return out


def polygon_get(url: str) -> dict | None:
    sep = "&" if "?" in url else "?"
    full_url = f"{url}{sep}apiKey={POLY_KEY}"
    backoff = [30, 60, 120, 240, 480]
    for attempt in range(MAX_RETRIES):
        try:
            req = urllib.request.Request(full_url, headers={"User-Agent": "Core600/0.1"})
            with urllib.request.urlopen(req, timeout=TIMEOUT) as r:
                return json.loads(r.read())
        except urllib.error.HTTPError as e:
            if e.code == 429 and attempt < MAX_RETRIES - 1:
                wait = backoff[attempt]
                time.sleep(wait)
                continue
            elif e.code in (500, 502, 503, 504):
                time.sleep(2 ** attempt)
                continue
            return None
        except Exception:
            time.sleep(1)
            continue
    return None


def fetch_chain(ticker: str, today: str, end_date: str, max_pages: int = 4) -> list[dict]:
    contracts = []
    cursor = None
    for _ in range(max_pages):
        if cursor:
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
        cursor = next_url
    return contracts


def compute_atm_iv(contracts: list[dict], spot: float) -> tuple[float | None, int]:
    """从 chain 算 ATM IV (DTE 14-45, OI≥100, strike ±5%)"""
    from statistics import median
    today_dt = datetime.now(timezone.utc).date()
    candidates = []
    for c in contracts:
        det = c.get("details", {})
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
        if abs(strike - spot) / spot > 0.05:
            continue
        if iv < 0.01 or iv > 5.0:
            continue
        candidates.append(iv)
    if not candidates:
        return None, 0
    return median(candidates), len(candidates)


def patch_one(ticker: str, spot: float, today: str, end_date: str) -> tuple[float | None, int]:
    """重抓 chain 算 atm_iv"""
    polygon_ticker = POLYGON_TICKER_OVERRIDES.get(ticker, ticker)
    contracts = fetch_chain(polygon_ticker, today, end_date)
    if not contracts:
        return None, 0
    return compute_atm_iv(contracts, spot)


def main():
    t_start = time.time()
    print("📥 加载 options.json...", flush=True)
    with open(OPTIONS_JSON) as f:
        data = json.load(f)
    bt = data["by_ticker"]

    # 找出 spot=None 的股票
    missing_spot = [tk for tk, o in bt.items() if o.get("spot") is None]
    print(f"   总数: {len(bt)}, spot=None: {len(missing_spot)}", flush=True)

    # 第一步：FMP 批量补 spot
    print(f"\n📡 阶段 1: FMP 批量查 spot...", flush=True)
    spots = fmp_bulk_quote(missing_spot)
    print(f"   ✅ 拿到 {len(spots)} 只 spot", flush=True)

    for tk, price in spots.items():
        bt[tk]["spot"] = price

    # 写回 (即使下面 ATM IV 失败，spot 已经救回了)
    with open(OPTIONS_JSON, "w") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    print(f"   💾 spot 已写回 options.json", flush=True)

    # 第二步: 重抓 Polygon chain 算 atm_iv (只针对刚拿到 spot 但 atm_iv 仍空的)
    needs_atm = [tk for tk, o in bt.items()
                 if o.get("spot") is not None and o.get("atm_iv") is None]
    print(f"\n📡 阶段 2: 重抓 Polygon chain 算 ATM IV ({len(needs_atm)} 只, 慢工 NUM_WORKERS={NUM_WORKERS})", flush=True)

    today_dt = datetime.now(timezone.utc).date()
    today = today_dt.strftime("%Y-%m-%d")
    end_date = (today_dt + timedelta(days=DAYS_AHEAD)).strftime("%Y-%m-%d")

    completed = 0
    succeeded = 0
    save_every = 50
    with ThreadPoolExecutor(max_workers=NUM_WORKERS) as pool:
        futures = {pool.submit(patch_one, tk, bt[tk]["spot"], today, end_date): tk for tk in needs_atm}
        for fut in as_completed(futures):
            completed += 1
            tk = futures[fut]
            try:
                atm_iv, count = fut.result()
            except Exception as e:
                print(f"  [{completed}/{len(needs_atm)}] {tk}: 异常 {e}", flush=True)
                continue
            if atm_iv is not None:
                bt[tk]["atm_iv"] = atm_iv
                bt[tk]["atm_iv_count"] = count
                succeeded += 1
            if completed % save_every == 0:
                print(f"  [{completed}/{len(needs_atm)}] (succeeded {succeeded})", flush=True)
                # 增量保存
                with open(OPTIONS_JSON, "w") as f:
                    json.dump(data, f, ensure_ascii=False, indent=2)

    # 最终保存
    with open(OPTIONS_JSON, "w") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

    # 统计
    has_spot = sum(1 for o in bt.values() if o.get("spot") is not None)
    has_atm = sum(1 for o in bt.values() if o.get("atm_iv") is not None)
    elapsed = time.time() - t_start

    print(f"\n📊 完成 (耗时 {elapsed:.1f}s):", flush=True)
    print(f"   总数:        {len(bt)}", flush=True)
    print(f"   有 spot:     {has_spot} ({has_spot*100//len(bt)}%)", flush=True)
    print(f"   有 atm_iv:   {has_atm} ({has_atm*100//len(bt)}%)", flush=True)
    print(f"   💾 已写回 {OPTIONS_JSON}", flush=True)


if __name__ == "__main__":
    main()
