#!/usr/bin/env python3
"""
用 FMP API 交叉验证 Wikipedia 抓取的成分股数据。
不一致时报告差异，但不会中止流程（数据源都可能有滞后）。
"""
import json
import os
import sys
import urllib.request
from pathlib import Path

API_KEY = os.environ.get("FMP_API_KEY", "")
if not API_KEY:
    print("⚠️ 未设置 FMP_API_KEY 环境变量，跳过 FMP 验证")
    sys.exit(0)


def fetch_fmp(endpoint):
    url = f"https://financialmodelingprep.com/api/v3/{endpoint}?apikey={API_KEY}"
    with urllib.request.urlopen(url, timeout=30) as r:
        return json.loads(r.read().decode("utf-8"))


def main():
    data_path = Path(__file__).parent.parent / "data" / "stocks.json"
    with open(data_path) as f:
        wiki_data = json.load(f)

    wiki_sp500 = {s["ticker"] for s in wiki_data["stocks"] if s["in_sp500"]}
    wiki_nasdaq = {s["ticker"] for s in wiki_data["stocks"] if s["in_nasdaq100"]}

    print("🔍 从 FMP 拉取数据...")
    fmp_sp500_raw = fetch_fmp("sp500_constituent")
    fmp_nasdaq_raw = fetch_fmp("nasdaq_constituent")

    # FMP 用 . 表示子类（BRK.B），我们统一成 -
    fmp_sp500 = {s["symbol"].replace(".", "-") for s in fmp_sp500_raw}
    fmp_nasdaq = {s["symbol"].replace(".", "-") for s in fmp_nasdaq_raw}

    print()
    print(f"📊 数量对比：")
    print(f"   S&P 500:    Wiki {len(wiki_sp500):>3} | FMP {len(fmp_sp500):>3}")
    print(f"   Nasdaq 100: Wiki {len(wiki_nasdaq):>3} | FMP {len(fmp_nasdaq):>3}")

    # 对比 S&P 500
    sp_only_wiki = wiki_sp500 - fmp_sp500
    sp_only_fmp = fmp_sp500 - wiki_sp500
    nq_only_wiki = wiki_nasdaq - fmp_nasdaq
    nq_only_fmp = fmp_nasdaq - wiki_nasdaq

    has_diff = bool(sp_only_wiki or sp_only_fmp or nq_only_wiki or nq_only_fmp)

    if has_diff:
        print()
        print("⚠️ 发现差异:")
        if sp_only_wiki:
            print(f"   S&P 500 只在 Wiki: {sorted(sp_only_wiki)}")
        if sp_only_fmp:
            print(f"   S&P 500 只在 FMP:  {sorted(sp_only_fmp)}")
        if nq_only_wiki:
            print(f"   Nasdaq 100 只在 Wiki: {sorted(nq_only_wiki)}")
        if nq_only_fmp:
            print(f"   Nasdaq 100 只在 FMP:  {sorted(nq_only_fmp)}")
        print()
        print("💡 差异原因可能是：")
        print("   - 一方滞后未及时更新（通常几天内会同步）")
        print("   - ticker 格式差异（BRK.B vs BRK-B 已自动处理）")
        print("   - 数据源本身的小bug")
    else:
        print()
        print("✓ Wikipedia 与 FMP 数据完全一致")

    # 写报告（GitHub Actions 用）
    report_path = Path(__file__).parent.parent / "data" / "_verify_report.txt"
    with open(report_path, "w") as f:
        f.write(f"S&P 500: Wiki {len(wiki_sp500)} | FMP {len(fmp_sp500)}\n")
        f.write(f"Nasdaq 100: Wiki {len(wiki_nasdaq)} | FMP {len(fmp_nasdaq)}\n")
        if has_diff:
            f.write("\n⚠️ 存在差异，详见 Action 日志\n")
        else:
            f.write("\n✓ 完全一致\n")


if __name__ == "__main__":
    main()
