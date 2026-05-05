#!/usr/bin/env python3
"""用 Kimi K2.5 翻译所有 600 强最近 1 季度财报会议 transcript → data/transcripts.json

流程：
1. 从 FMP 拉每只股票最近 1 个 quarter 的 earnings call transcript
   - 自动尝试 [当前年 Q4-Q1, 上一年 Q4-Q1]，取最新非空
2. Kimi K2.5 翻译全文（200k context 够装下任何 transcript）
3. 输出 data/transcripts.json：
   { "by_ticker": { "AAPL": { "year": 2026, "quarter": 1, "date": "...", "content_cn": "..." } } }

成本估算：516 × ~12k 输入 + ~9k 输出 ≈ 11M tokens 总，约 ¥60-80
耗时：8 线程 × 60-90s/只 ÷ 8 ≈ 60-100 min
"""
import json
import os
import threading
import time
import urllib.request
import urllib.error
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).parent.parent
STOCKS_JSON = ROOT / "data" / "stocks.json"
OUTPUT_JSON = ROOT / "data" / "transcripts.json"
ENV_LOCAL = ROOT / ".env.local"

NUM_WORKERS = 8  # 单次调用 ~145s，独跑时 8 线程不会触发限流（先前 16 撞限流是因为同时跑 description）
MAX_RETRIES = 3
KIMI_MODEL = "Pro/moonshotai/Kimi-K2.5"
KIMI_URL = "https://api.siliconflow.cn/v1/chat/completions"


def load_keys() -> tuple[str, str]:
    fmp = os.environ.get("FMP_API_KEY")
    sf = os.environ.get("SILICONFLOW_API_KEY")
    if (not fmp or not sf) and ENV_LOCAL.exists():
        for line in ENV_LOCAL.read_text().splitlines():
            line = line.strip()
            if line.startswith("FMP_API_KEY=") and not fmp:
                fmp = line.split("=", 1)[1].strip().strip('"').strip("'")
            elif line.startswith("SILICONFLOW_API_KEY=") and not sf:
                sf = line.split("=", 1)[1].strip().strip('"').strip("'")
    if not fmp or not sf:
        raise SystemExit("❌ 需要 FMP_API_KEY 和 SILICONFLOW_API_KEY")
    return fmp, sf


FMP_KEY, SF_KEY = load_keys()


def fmp_get(url: str) -> list | dict | None:
    sep = "&" if "?" in url else "?"
    full_url = f"{url}{sep}apikey={FMP_KEY}"
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
    return None


def fetch_latest_transcript(ticker: str) -> dict | None:
    """尝试 [当年 Q4-Q1, 去年 Q4-Q1]，返回第一个非空的 transcript"""
    today = datetime.now()
    # 尝试顺序：从最新到最旧
    candidates = []
    for year in [today.year, today.year - 1]:
        for q in [4, 3, 2, 1]:
            candidates.append((year, q))

    for year, quarter in candidates:
        url = f"https://financialmodelingprep.com/api/v3/earning_call_transcript/{ticker}?year={year}&quarter={quarter}"
        data = fmp_get(url)
        if data and isinstance(data, list) and len(data) > 0:
            entry = data[0]
            if entry.get("content"):
                return {
                    "year": year,
                    "quarter": quarter,
                    "date": entry.get("date"),
                    "content": entry["content"],
                }
    return None


def translate_transcript(ticker: str, name: str, content: str) -> str | None:
    """调 Kimi K2.5 翻译全文（带详细诊断日志）"""
    prompt = f"""你是一位专业财经译者，下面是美股 {ticker}（{name}）的财报会议（earnings call）transcript 全文。请翻译成中文。

要求：
1. 公司名（{name}）、人名、产品名（如 NVIDIA Corporation、Jensen Huang、Hopper、Blackwell）一律保留英文原文
2. 财务术语用准确的中文：revenue→营收，data center→数据中心，year over year→同比，fiscal Q1→财年第一季度，hyperscale→超大规模，inference/training→推理/训练，guidance→业绩指引，non-GAAP→非 GAAP，gross margin→毛利率
3. 数字精确（$44 billion → 440 亿美元；69% → 69%）
4. 保留说话人标记（"XXX：" 格式）
5. 中文要自然，像彭博中文财经新闻
6. 直接输出译文，不加任何前缀

英文原文：
{content}"""

    body = {
        "model": KIMI_MODEL,
        "messages": [{"role": "user", "content": prompt}],
        "max_tokens": 12000,
        "temperature": 0.3,
    }
    thread_id = threading.get_ident() % 1000  # 用线程 ID 后 3 位标识
    for attempt in range(MAX_RETRIES):
        t0 = time.time()
        try:
            req = urllib.request.Request(
                KIMI_URL,
                data=json.dumps(body).encode(),
                headers={
                    "Authorization": f"Bearer {SF_KEY}",
                    "Content-Type": "application/json",
                },
                method="POST",
            )
            with urllib.request.urlopen(req, timeout=600) as r:  # 大型股 transcript 输出可达 19k tokens，需 4-5 min
                data = json.loads(r.read())
            elapsed = time.time() - t0
            usage = data.get("usage", {})
            print(f"   ✓ [t{thread_id}] {ticker} Kimi OK ({elapsed:.1f}s, in={usage.get('prompt_tokens', 0)} out={usage.get('completion_tokens', 0)})", flush=True)
            return data["choices"][0]["message"]["content"].strip()
        except urllib.error.HTTPError as e:
            elapsed = time.time() - t0
            body_text = e.read().decode()[:200] if hasattr(e, 'read') else ""
            if e.code in (429, 500, 502, 503, 504):
                backoff = 2 ** attempt * 5
                print(f"   ⚠️  [t{thread_id}] {ticker} HTTP {e.code} after {elapsed:.1f}s: {body_text[:100]}, backoff {backoff}s ({attempt + 1}/{MAX_RETRIES})", flush=True)
                time.sleep(backoff)
                continue
            print(f"   ❌ [t{thread_id}] {ticker} HTTP {e.code}: {body_text[:100]}", flush=True)
            return None
        except Exception as e:
            elapsed = time.time() - t0
            print(f"   ⚠️  [t{thread_id}] {ticker} {type(e).__name__} after {elapsed:.1f}s: {e}, backoff {2 ** attempt * 3}s", flush=True)
            time.sleep(2 ** attempt * 3)
    print(f"   ❌ [t{thread_id}] {ticker} 重试 {MAX_RETRIES} 次仍失败", flush=True)
    return None


def process_one(stock: dict) -> tuple[str, dict | None]:
    ticker = stock["ticker"]
    name = stock.get("name") or ticker
    transcript = fetch_latest_transcript(ticker)
    if not transcript:
        return ticker, None
    cn = translate_transcript(ticker, name, transcript["content"])
    if not cn:
        return ticker, {"failed_translation": True, **transcript}
    return ticker, {
        "year": transcript["year"],
        "quarter": transcript["quarter"],
        "date": transcript["date"],
        "content_cn": cn,
        "content_en_chars": len(transcript["content"]),
    }


def main():
    t_start = time.time()
    print("📥 加载 stocks.json...", flush=True)
    with open(STOCKS_JSON) as f:
        stocks = json.load(f)["stocks"]
    total = len(stocks)
    print(f"   ✓ {total} 只股票", flush=True)
    print(f"   🧵 {NUM_WORKERS} 线程并行调 Kimi K2.5", flush=True)
    print(f"   💰 预计成本 ¥60-80，耗时 ~60-100 min\n", flush=True)

    by_ticker = {}
    failed_fetch = []
    failed_translate = []
    completed = 0

    with ThreadPoolExecutor(max_workers=NUM_WORKERS) as pool:
        futures = {pool.submit(process_one, s): s["ticker"] for s in stocks}
        for fut in as_completed(futures):
            completed += 1
            ticker = futures[fut]
            try:
                _, data = fut.result()
            except Exception as e:
                print(f"[{completed}/{total}] {ticker}: 异常 {e}", flush=True)
                failed_fetch.append(ticker)
                continue

            if data is None:
                failed_fetch.append(ticker)
                if completed % 25 == 0:
                    print(f"[{completed}/{total}] {ticker}: 无 transcript", flush=True)
                continue

            if data.get("failed_translation"):
                failed_translate.append(ticker)
                if completed % 25 == 0:
                    print(f"[{completed}/{total}] {ticker}: 翻译失败", flush=True)
                continue

            by_ticker[ticker] = data
            if completed % 25 == 0:
                cn_chars = len(data["content_cn"])
                print(f"[{completed}/{total}] {ticker}: ✓ {data['year']} Q{data['quarter']} 中文 {cn_chars} 字", flush=True)

    output = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "model": KIMI_MODEL,
        "stats": {
            "total": total,
            "translated": len(by_ticker),
            "no_transcript": len(failed_fetch),
            "translation_failed": len(failed_translate),
        },
        "by_ticker": by_ticker,
    }

    OUTPUT_JSON.parent.mkdir(parents=True, exist_ok=True)
    with open(OUTPUT_JSON, "w", encoding="utf-8") as f:
        json.dump(output, f, ensure_ascii=False, indent=2)

    elapsed = time.time() - t_start
    print(f"\n📊 完成（耗时 {elapsed/60:.1f} min）:", flush=True)
    print(f"   ✅ 已翻译:    {len(by_ticker)} / {total}", flush=True)
    print(f"   📭 无 transcript: {len(failed_fetch)}", flush=True)
    print(f"   ❌ 翻译失败:  {len(failed_translate)}", flush=True)
    if failed_fetch:
        print(f"   无 transcript 列表（前 20）: {failed_fetch[:20]}", flush=True)
    size_mb = OUTPUT_JSON.stat().st_size / 1024 / 1024
    print(f"   💾 输出: {OUTPUT_JSON} ({size_mb:.2f} MB)", flush=True)


if __name__ == "__main__":
    main()
