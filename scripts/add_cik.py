#!/usr/bin/env python3
"""为 stocks.json 添加 CIK（SEC EDGAR 唯一识别码）

数据源：SEC 官方 https://www.sec.gov/files/company_tickers.json
"""
import json
import os
import urllib.request
from pathlib import Path

USER_AGENT = os.environ.get("EDGAR_USER_AGENT", "Core600 Research qz6206@gmail.com")

JSON_PATH = Path(__file__).parent.parent / "data" / "stocks.json"


def fetch_sec_tickers():
    """抓 SEC 全市场 ticker → CIK 映射"""
    url = "https://www.sec.gov/files/company_tickers.json"
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(req, timeout=30) as r:
        data = json.loads(r.read())

    # SEC 返回格式：{"0": {"cik_str": 320193, "ticker": "AAPL", "title": "Apple Inc."}, ...}
    ticker_to_cik = {}
    for entry in data.values():
        ticker = entry.get("ticker", "").upper()
        cik = entry.get("cik_str")
        if ticker and cik is not None:
            # CIK 必须是 10 位字符串（前面补 0）
            ticker_to_cik[ticker] = f"{cik:010d}"
    return ticker_to_cik


def main():
    print("📥 拉取 SEC ticker → CIK 映射...")
    sec_map = fetch_sec_tickers()
    print(f"   ✓ 共 {len(sec_map)} 条映射")

    with open(JSON_PATH) as f:
        data = json.load(f)

    matched = 0
    missing = []
    for s in data["stocks"]:
        # 处理 ticker 格式（BRK-B → SEC 用 BRK.B 或 BRK-B?）
        candidates = [
            s["ticker"],
            s["ticker"].replace("-", "."),  # BRK-B → BRK.B
            s["ticker"].replace(".", "-"),
        ]
        cik = None
        for c in candidates:
            if c in sec_map:
                cik = sec_map[c]
                break

        if cik:
            s["cik"] = cik
            matched += 1
        else:
            missing.append(s["ticker"])

    with open(JSON_PATH, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

    print(f"\n📊 结果:")
    print(f"   匹配 CIK：{matched} / {len(data['stocks'])}")
    if missing:
        print(f"   未匹配：{missing}")

    # 验证几个关键股票
    print("\n验证:")
    for t in ["NVDA", "AAPL", "PLTR", "BRK-B"]:
        s = next((x for x in data["stocks"] if x["ticker"] == t), None)
        if s:
            print(f"   {t}: CIK = {s.get('cik', '未匹配')}")


if __name__ == "__main__":
    main()
