#!/usr/bin/env python3
"""预拉取所有 600 强股票最近 SEC EDGAR filings → data/edgar_filings.json

一次 SEC submissions JSON 包含所有表单类型，所以同时提取：
- Form 4 (内部人交易)
- Form 8-K (公司重大事项)

为什么用预拉取（而不是 Next.js 服务端实时拉）？
- SEC 限流 10 req/s，next build 期间 522 页并行直接打挂
- 预拉取 4 线程 × 500ms 间隔 = 8 req/s 总，安全
- 构建瞬间完成（无 EDGAR 调用）；数据新鲜度通过 GitHub Action cron 控制

输出格式：
{
  "generated_at": "2026-05-04T...",
  "stats": {...},
  "by_ticker": {
    "NVDA": {
      "form4": [<最多 15 条>],
      "form8k": [<最多 15 条>]
    },
    ...
  }
}

频率建议：每 6 小时跑一次（Form 4 申报频率 ~1-2 次/天，8-K 较稀）
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
OUTPUT_JSON = ROOT / "data" / "edgar_filings.json"

# SEC 限流 10 req/s。4 线程 × 500ms 间隔 = 8 req/s，留 20% 余量
NUM_WORKERS = 4
MIN_INTERVAL_PER_WORKER = 0.5
LIMIT_PER_FORM = 15  # 每只股票每种表单最多取 15 条
MAX_RETRIES = 4

# 要提取的表单类型（key=form 字段值，value=输出字段名）
FORMS_TO_EXTRACT = {
    "4": "form4",
    "8-K": "form8k",
}

_thread_local = threading.local()


def _throttle():
    """每个 worker 线程独立节流到 ≥MIN_INTERVAL_PER_WORKER"""
    last = getattr(_thread_local, "last_request", 0.0)
    elapsed = time.time() - last
    if elapsed < MIN_INTERVAL_PER_WORKER:
        time.sleep(MIN_INTERVAL_PER_WORKER - elapsed)
    _thread_local.last_request = time.time()


def fetch_submissions(cik: str) -> dict | None:
    """拉一只股票的 SEC submissions JSON（节流 + 重试）"""
    url = f"https://data.sec.gov/submissions/CIK{cik}.json"
    for attempt in range(MAX_RETRIES):
        _throttle()
        try:
            req = urllib.request.Request(url, headers={
                "User-Agent": USER_AGENT,
                "Accept": "application/json",
            })
            with urllib.request.urlopen(req, timeout=60) as r:
                return json.loads(r.read())
        except urllib.error.HTTPError as e:
            if e.code in (429, 500, 502, 503, 504):
                backoff = 2 ** attempt * 2
                print(f"   ⚠️  {cik} → {e.code}, 退避 {backoff}s 后重试 ({attempt + 1}/{MAX_RETRIES})", flush=True)
                time.sleep(backoff)
                continue
            print(f"   ❌ {cik} → HTTP {e.code}", flush=True)
            return None
        except Exception as e:
            # 网络层异常（SSL/EOF 等）也重试
            backoff = 2 ** attempt * 2
            print(f"   ⚠️  {cik} → {type(e).__name__}: {e}, 退避 {backoff}s ({attempt + 1}/{MAX_RETRIES})", flush=True)
            time.sleep(backoff)
            continue
    print(f"   ❌ {cik} → 重试 {MAX_RETRIES} 次仍失败", flush=True)
    return None


def extract_filings(submissions: dict, target_form: str, limit: int) -> list[dict]:
    """从 submissions JSON 中提取指定表单类型的最近 N 条"""
    recent = submissions.get("filings", {}).get("recent", {})
    forms = recent.get("form", [])
    descriptions = recent.get("primaryDocDescription", [""] * len(forms))
    items = recent.get("items", [""] * len(forms))  # 8-K 的 Item 编号
    result = []
    for i, form in enumerate(forms):
        if form == target_form:
            entry = {
                "accessionNumber": recent["accessionNumber"][i],
                "filingDate": recent["filingDate"][i],
                "reportDate": recent["reportDate"][i],
                "form": form,
                "primaryDocument": recent["primaryDocument"][i],
                "primaryDocDescription": (descriptions[i] if i < len(descriptions) else "") or "",
                "size": recent["size"][i],
            }
            # 8-K 的 items 字段（如 "5.02,9.01" 表示 Item 5.02 + 9.01）
            if target_form == "8-K" and i < len(items) and items[i]:
                entry["items"] = items[i]
            result.append(entry)
            if len(result) >= limit:
                break
    return result


def process_one(stock: dict) -> tuple[str, dict | None]:
    """处理单只股票，返回 (ticker, {form4: [...], form8k: [...]} or None)"""
    ticker = stock["ticker"]
    cik = stock["cik"]
    sub = fetch_submissions(cik)
    if sub is None:
        return ticker, None
    out = {}
    for form_key, output_field in FORMS_TO_EXTRACT.items():
        out[output_field] = extract_filings(sub, form_key, LIMIT_PER_FORM)
    return ticker, out


def main():
    t_start = time.time()
    print(f"📥 加载 stocks.json...", flush=True)
    with open(STOCKS_JSON) as f:
        stocks = json.load(f)["stocks"]

    has_cik = [s for s in stocks if s.get("cik")]
    total = len(has_cik)
    print(f"   ✓ {total} / {len(stocks)} 只有 CIK", flush=True)
    print(f"   🧵 {NUM_WORKERS} 线程并行 × {MIN_INTERVAL_PER_WORKER * 1000:.0f}ms 间隔 = {NUM_WORKERS / MIN_INTERVAL_PER_WORKER:.1f} req/s", flush=True)
    print(f"   📋 提取表单：{list(FORMS_TO_EXTRACT.keys())}\n", flush=True)

    by_ticker = {}
    failed = []
    completed = 0
    with_form4 = 0
    with_form8k = 0

    with ThreadPoolExecutor(max_workers=NUM_WORKERS) as pool:
        futures = {pool.submit(process_one, s): s for s in has_cik}
        for fut in as_completed(futures):
            completed += 1
            stock = futures[fut]
            ticker = stock["ticker"]
            try:
                _, filings = fut.result()
            except Exception as e:
                print(f"[{completed}/{total}] {ticker}: 异常 {e}", flush=True)
                failed.append(ticker)
                continue

            if filings is None:
                failed.append(ticker)
                print(f"[{completed}/{total}] {ticker}: 失败", flush=True)
                continue

            by_ticker[ticker] = filings
            if filings["form4"]:
                with_form4 += 1
            if filings["form8k"]:
                with_form8k += 1

            if completed % 50 == 0:
                print(f"[{completed}/{total}] 进度（{ticker}: F4={len(filings['form4'])} 8K={len(filings['form8k'])}）", flush=True)

    output = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "stats": {
            "total": total,
            "with_form4": with_form4,
            "with_form8k": with_form8k,
            "failed": len(failed),
        },
        "by_ticker": by_ticker,
    }

    OUTPUT_JSON.parent.mkdir(parents=True, exist_ok=True)
    with open(OUTPUT_JSON, "w", encoding="utf-8") as f:
        json.dump(output, f, ensure_ascii=False, indent=2)

    elapsed = time.time() - t_start
    print(f"\n📊 完成（耗时 {elapsed:.1f}s）:", flush=True)
    print(f"   ✅ 有 Form 4: {with_form4} / {total}", flush=True)
    print(f"   ✅ 有 8-K:    {with_form8k} / {total}", flush=True)
    print(f"   ❌ 失败:      {len(failed)}", flush=True)
    if failed:
        print(f"   失败列表: {failed[:20]}{'...' if len(failed) > 20 else ''}", flush=True)
    print(f"   💾 输出: {OUTPUT_JSON} ({OUTPUT_JSON.stat().st_size / 1024 / 1024:.2f} MB)", flush=True)


if __name__ == "__main__":
    main()
