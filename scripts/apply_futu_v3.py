#!/usr/bin/env python3
"""应用富途第二轮重抓的 37 处建议（全部采用富途标准）"""
import csv
import json
from pathlib import Path

CSV_PATH = Path("/Users/qz6206/My Drive/CLAUDE/Projects资料/core600/中文名复查/futu_refetch_suggested_changes.csv")
JSON_PATH = Path(__file__).parent.parent / "data" / "stocks.json"


def main():
    # 读建议清单
    with open(CSV_PATH, encoding="utf-8-sig") as f:
        suggestions = {row["Ticker"]: row["Futu Name"] for row in csv.DictReader(f)}

    print(f"📊 读到 {len(suggestions)} 个建议")

    with open(JSON_PATH) as f:
        data = json.load(f)

    applied = 0
    not_found = []
    for s in data["stocks"]:
        if s["ticker"] in suggestions:
            new = suggestions[s["ticker"]]
            old = s.get("name_cn", "")
            if old != new:
                print(f"  {s['ticker']:6} | {old:25} → {new}")
                s["name_cn_old"] = old
                s["name_cn"] = new
                s["name_cn_source"] = "futu"  # 富途确认
                applied += 1

    expected = set(suggestions.keys())
    actual = {s["ticker"] for s in data["stocks"]}
    missing = expected - actual
    if missing:
        print(f"\n⚠️ 数据中没找到: {missing}")

    with open(JSON_PATH, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

    print(f"\n✅ 已应用 {applied} 处修正")


if __name__ == "__main__":
    main()
