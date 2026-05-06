#!/usr/bin/env python3
"""用 Kimi K2.5 翻译所有 600 强公司简介 → data/descriptions_cn.json

流程：
1. 从 FMP /api/v3/profile/{ticker} 拉英文简介
2. Kimi K2.5（zai-org/Kimi-K2.5）翻译成中文，严格保留英文原名/产品名
3. 输出 data/descriptions_cn.json：{ "by_ticker": { "AAPL": "Apple Inc. ..." } }

成本估算：516 × ~450 输入 + ~425 输出 ≈ 232k+ tokens 总，约 ¥3-5
耗时：8 线程 × 30s/只 ÷ 8 ≈ 32 min
"""
import json
import os
import time
import urllib.request
import urllib.error
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).parent.parent
STOCKS_JSON = ROOT / "data" / "stocks.json"
OUTPUT_JSON = ROOT / "data" / "descriptions_cn.json"
ENV_LOCAL = ROOT / ".env.local"

NUM_WORKERS = 8
MAX_RETRIES = 3
# 2026-05-06 切换到 DeepSeek-V3 (¥2 in / ¥8 out, 比 Kimi-K2.5 砍 50%)
KIMI_MODEL = "deepseek-ai/DeepSeek-V3"
KIMI_URL = "https://api.siliconflow.cn/v1/chat/completions"


def load_keys() -> tuple[str, str]:
    """返回 (FMP_KEY, SILICONFLOW_KEY)"""
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


def fetch_profile(ticker: str) -> dict | None:
    url = f"https://financialmodelingprep.com/api/v3/profile/{ticker}?apikey={FMP_KEY}"
    for attempt in range(MAX_RETRIES):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "Core600/0.1"})
            with urllib.request.urlopen(req, timeout=30) as r:
                data = json.loads(r.read())
                return data[0] if data else None
        except Exception:
            time.sleep(2 ** attempt)
    return None


def translate_description(ticker: str, name: str, text: str) -> str | None:
    """调 Kimi K2.5 翻译"""
    prompt = f"""你是一位专业财经译者，请把下面这段美股 {ticker}（{name}）的公司简介翻译成简洁、准确、自然的中文。

要求：
1. 公司名（{name}）保留英文原文，不要翻译成中文（不要写成"苹果公司""英伟达"等）
2. 产品名、品牌名（如 iPhone、Apple Music、Hopper、Blackwell）保留英文原文
3. 行业术语用准确中文（如 cloud services=云服务，subscription-based=订阅制）
4. 数字、年份、地名保持准确
5. 中文行文像中信证券/华泰证券研究报告，不要有翻译腔
6. 直接输出译文，不要前后加任何说明文字

英文原文：
{text}"""

    body = {
        "model": KIMI_MODEL,
        "messages": [{"role": "user", "content": prompt}],
        "max_tokens": 2000,
        "temperature": 0.3,
    }
    for attempt in range(MAX_RETRIES):
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
            with urllib.request.urlopen(req, timeout=120) as r:
                data = json.loads(r.read())
            return data["choices"][0]["message"]["content"].strip()
        except urllib.error.HTTPError as e:
            if e.code in (429, 500, 502, 503, 504):
                time.sleep(2 ** attempt * 3)
                continue
            return None
        except Exception:
            time.sleep(2 ** attempt * 2)
    return None


def process_one(ticker: str) -> tuple[str, str | None]:
    """返回 (ticker, chinese_description_or_None)"""
    profile = fetch_profile(ticker)
    if not profile or not profile.get("description"):
        return ticker, None
    name = profile.get("companyName") or ticker
    cn = translate_description(ticker, name, profile["description"])
    return ticker, cn


def main():
    t_start = time.time()
    print("📥 加载 stocks.json...", flush=True)
    with open(STOCKS_JSON) as f:
        stocks = json.load(f)["stocks"]
    total = len(stocks)
    print(f"   ✓ {total} 只股票", flush=True)
    print(f"   🧵 {NUM_WORKERS} 线程并行调 Kimi K2.5", flush=True)
    print(f"   💰 预计成本 ¥3-5，耗时 ~30 min\n", flush=True)

    by_ticker = {}
    failed = []
    completed = 0

    with ThreadPoolExecutor(max_workers=NUM_WORKERS) as pool:
        futures = {pool.submit(process_one, s["ticker"]): s["ticker"] for s in stocks}
        for fut in as_completed(futures):
            completed += 1
            ticker = futures[fut]
            try:
                _, cn = fut.result()
            except Exception as e:
                print(f"[{completed}/{total}] {ticker}: 异常 {e}", flush=True)
                failed.append(ticker)
                continue

            if cn is None:
                failed.append(ticker)
                if completed % 50 == 0:
                    print(f"[{completed}/{total}] {ticker}: 失败", flush=True)
                continue

            by_ticker[ticker] = cn

            if completed % 50 == 0:
                preview = cn[:30].replace("\n", " ")
                print(f"[{completed}/{total}] {ticker}: ✓ {len(cn)} 字 — {preview}...", flush=True)

    output = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "model": KIMI_MODEL,
        "stats": {
            "total": total,
            "translated": len(by_ticker),
            "failed": len(failed),
        },
        "by_ticker": by_ticker,
    }

    OUTPUT_JSON.parent.mkdir(parents=True, exist_ok=True)
    with open(OUTPUT_JSON, "w", encoding="utf-8") as f:
        json.dump(output, f, ensure_ascii=False, indent=2)

    elapsed = time.time() - t_start
    print(f"\n📊 完成（耗时 {elapsed/60:.1f} min）:", flush=True)
    print(f"   ✅ 已翻译: {len(by_ticker)} / {total}", flush=True)
    print(f"   ❌ 失败:   {len(failed)}", flush=True)
    if failed:
        print(f"   失败列表（前 20）: {failed[:20]}", flush=True)
    size_kb = OUTPUT_JSON.stat().st_size / 1024
    print(f"   💾 输出: {OUTPUT_JSON} ({size_kb:.1f} KB)", flush=True)


if __name__ == "__main__":
    main()
