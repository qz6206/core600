#!/usr/bin/env python3
"""v2: 抓富途中文名 + 记录所有结果（包括"和原来一样"和"抓不到"）"""
import json
import re
import sys
import time
import urllib.request
from pathlib import Path

# 强制 unbuffered output
sys.stdout.reconfigure(line_buffering=True)

USER_AGENT = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36"
PATH = Path(__file__).parent.parent / "data" / "stocks.json"


def fetch_futu_name(ticker: str) -> str | None:
    futu_ticker = ticker.replace("-", ".")
    url = f"https://www.futunn.com/stock/{futu_ticker}-US"
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    try:
        with urllib.request.urlopen(req, timeout=15) as r:
            html = r.read().decode("utf-8", errors="ignore")
    except Exception:
        return None
    m = re.search(r'<title>([^(<]+)\(' + re.escape(futu_ticker) + r'\)', html)
    if m:
        name = m.group(1).strip()
        if re.search(r'[一-鿿]', name):
            return name
    return None


def main():
    with open(PATH) as f:
        data = json.load(f)

    stocks = data["stocks"]
    total = len(stocks)

    # 找出还没标记 source 的（需要抓的）
    todo = [s for s in stocks if s.get("name_cn_source") != "futu"]
    print(f"📊 总数 {total}, 待抓 {len(todo)}")

    if not todo:
        print("✓ 全部已抓过")
        return

    changed = 0
    failed = []
    confirmed = 0  # 抓到但和原来一样

    for i, s in enumerate(todo, 1):
        ticker = s["ticker"]
        old = s.get("name_cn", "")
        new = fetch_futu_name(ticker)

        if new is None:
            failed.append(ticker)
            print(f"  [{i:>3}] {ticker:6} ❌ 抓不到")
        elif new != old:
            s["name_cn_old"] = old
            s["name_cn"] = new
            s["name_cn_source"] = "futu"
            changed += 1
            print(f"  [{i:>3}] {ticker:6} {old} → {new}")
        else:
            s["name_cn_source"] = "futu"  # 标记已确认
            confirmed += 1

        time.sleep(0.3)

        # 每 30 条保存
        if i % 30 == 0:
            with open(PATH, "w", encoding="utf-8") as f:
                json.dump(data, f, ensure_ascii=False, indent=2)
            print(f"  💾 已保存 (改 {changed}, 同 {confirmed}, 失败 {len(failed)})")

    # 最终保存
    with open(PATH, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

    print(f"\n✅ 完成")
    print(f"  改了：{changed}")
    print(f"  富途确认（同原值）：{confirmed}")
    print(f"  抓失败：{len(failed)}")
    if failed:
        print(f"  失败 ticker：{failed[:30]}")


if __name__ == "__main__":
    main()
