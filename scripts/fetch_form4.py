#!/usr/bin/env python3
"""预拉取所有 600 强股票最近 Form 4（内部人交易）→ data/form4.json

为什么用预拉取（而不是 Next.js 服务端实时拉）？
- SEC 限流 10 req/s，next build 期间 522 页并行直接打挂
- 预拉取只 1 线程 + 严格 7 req/s 节流，从不被限
- 构建瞬间完成（无 EDGAR 调用）；数据新鲜度通过 cron / GitHub Action 控制

输出格式：
{
  "generated_at": "2026-05-04T...",
  "by_ticker": {
    "NVDA": [
      {
        "accessionNumber": "...",
        "filingDate": "2026-05-01",
        "reportDate": "2026-04-30",
        "form": "4",
        "primaryDocument": "wf-form4_xxxxx.xml",
        "primaryDocDescription": "FORM 4",
        "size": 12345
      },
      ...
    ]
  }
}

频率建议：每 6 小时跑一次（Form 4 申报频率 ~1-2 次/天）
"""
import json
import time
import threading
import urllib.request
import urllib.error
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone
from pathlib import Path

USER_AGENT = "Core600 Research contact@core600.com"
ROOT = Path(__file__).parent.parent
STOCKS_JSON = ROOT / "data" / "stocks.json"
OUTPUT_JSON = ROOT / "data" / "form4.json"

# SEC 限流：10 req/s。我们用 4 线程 × 500ms 间隔 = 8 req/s（留 20% 余量）
# 单线程 150ms 太慢（大公司 JSON 5MB+，下载 + parse 各 3-4s/只 → 总 25min）
NUM_WORKERS = 4
MIN_INTERVAL_PER_WORKER = 0.5  # 单 worker 内每次请求间隔 ≥500ms
LIMIT_PER_TICKER = 15  # 每只股票最多取 15 条最近 Form 4
MAX_RETRIES = 4

# 全局节流锁（防止同 worker 内连发）
_thread_local = threading.local()


def _throttle():
    """每个 worker 线程独立节流到 ≥MIN_INTERVAL_PER_WORKER"""
    last = getattr(_thread_local, "last_request", 0.0)
    elapsed = time.time() - last
    if elapsed < MIN_INTERVAL_PER_WORKER:
        time.sleep(MIN_INTERVAL_PER_WORKER - elapsed)
    _thread_local.last_request = time.time()


def fetch_submissions(cik: str) -> dict | None:
    """拉一只股票的 SEC submissions JSON（带节流 + 重试）"""
    url = f"https://data.sec.gov/submissions/CIK{cik}.json"
    for attempt in range(MAX_RETRIES):
        _throttle()
        try:
            req = urllib.request.Request(url, headers={
                "User-Agent": USER_AGENT,
                "Accept": "application/json",
            })
            with urllib.request.urlopen(req, timeout=30) as r:
                return json.loads(r.read())
        except urllib.error.HTTPError as e:
            if e.code in (429, 500, 502, 503, 504):
                backoff = 2 ** attempt * 2  # 2/4/8/16s
                print(f"   ⚠️  {cik} → {e.code}, 退避 {backoff}s 后重试 ({attempt + 1}/{MAX_RETRIES})", flush=True)
                time.sleep(backoff)
                continue
            print(f"   ❌ {cik} → HTTP {e.code}", flush=True)
            return None
        except Exception as e:
            print(f"   ❌ {cik} → {e}", flush=True)
            return None
    print(f"   ❌ {cik} → 重试 {MAX_RETRIES} 次仍失败", flush=True)
    return None


def extract_form4(submissions: dict, limit: int) -> list[dict]:
    """从 submissions JSON 中提取最近 Form 4"""
    recent = submissions.get("filings", {}).get("recent", {})
    forms = recent.get("form", [])
    result = []
    for i, form in enumerate(forms):
        if form == "4":
            result.append({
                "accessionNumber": recent["accessionNumber"][i],
                "filingDate": recent["filingDate"][i],
                "reportDate": recent["reportDate"][i],
                "form": form,
                "primaryDocument": recent["primaryDocument"][i],
                "primaryDocDescription": recent.get("primaryDocDescription", [""] * len(forms))[i] or "",
                "size": recent["size"][i],
            })
            if len(result) >= limit:
                break
    return result


def process_one(stock: dict) -> tuple[str, list[dict] | None]:
    """处理单只股票，返回 (ticker, form4_list_or_None)"""
    ticker = stock["ticker"]
    cik = stock["cik"]
    sub = fetch_submissions(cik)
    if sub is None:
        return ticker, None
    return ticker, extract_form4(sub, LIMIT_PER_TICKER)


def main():
    t_start = time.time()
    print(f"📥 加载 stocks.json...", flush=True)
    with open(STOCKS_JSON) as f:
        stocks = json.load(f)["stocks"]

    has_cik = [s for s in stocks if s.get("cik")]
    total = len(has_cik)
    print(f"   ✓ {total} / {len(stocks)} 只有 CIK", flush=True)
    print(f"   🧵 {NUM_WORKERS} 线程并行 × {MIN_INTERVAL_PER_WORKER * 1000:.0f}ms 间隔 = {NUM_WORKERS / MIN_INTERVAL_PER_WORKER:.1f} req/s\n", flush=True)

    by_ticker = {}
    success = 0
    failed = []
    no_form4 = []
    completed = 0

    with ThreadPoolExecutor(max_workers=NUM_WORKERS) as pool:
        futures = {pool.submit(process_one, s): s for s in has_cik}
        for fut in as_completed(futures):
            completed += 1
            stock = futures[fut]
            ticker = stock["ticker"]
            try:
                _, form4 = fut.result()
            except Exception as e:
                print(f"[{completed}/{total}] {ticker}: 异常 {e}", flush=True)
                failed.append(ticker)
                continue

            if form4 is None:
                failed.append(ticker)
                print(f"[{completed}/{total}] {ticker}: 失败", flush=True)
            elif not form4:
                no_form4.append(ticker)
                # 每 50 个打印一次，避免刷屏
                if completed % 50 == 0:
                    print(f"[{completed}/{total}] 进度更新（{ticker}: 无 Form 4）", flush=True)
            else:
                by_ticker[ticker] = form4
                success += 1
                if completed % 50 == 0:
                    print(f"[{completed}/{total}] 进度更新（{ticker}: ✓ {len(form4)} 条）", flush=True)

    output = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "stats": {
            "total": total,
            "success": success,
            "no_form4": len(no_form4),
            "failed": len(failed),
        },
        "by_ticker": by_ticker,
    }

    OUTPUT_JSON.parent.mkdir(parents=True, exist_ok=True)
    with open(OUTPUT_JSON, "w", encoding="utf-8") as f:
        json.dump(output, f, ensure_ascii=False, indent=2)

    elapsed = time.time() - t_start
    print(f"\n📊 完成（耗时 {elapsed:.1f}s）:", flush=True)
    print(f"   ✅ 成功: {success}", flush=True)
    print(f"   📭 无 Form 4: {len(no_form4)}", flush=True)
    print(f"   ❌ 失败: {len(failed)}", flush=True)
    if failed:
        print(f"   失败列表: {failed[:20]}{'...' if len(failed) > 20 else ''}", flush=True)
    print(f"   💾 输出: {OUTPUT_JSON} ({OUTPUT_JSON.stat().st_size / 1024:.1f} KB)", flush=True)


if __name__ == "__main__":
    main()
