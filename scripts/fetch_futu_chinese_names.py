#!/usr/bin/env python3
"""
从富途网页批量抓取美股中文名（行业标准译名）
URL 模板：https://www.futunn.com/stock/{TICKER}-US
"""
import json
import re
import time
import urllib.request
from pathlib import Path

USER_AGENT = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36"

PATH = Path(__file__).parent.parent / "data" / "stocks.json"


def fetch_futu_name(ticker: str) -> str | None:
    """抓取一只股票的富途中文名"""
    # 富途用 - 而不是 .（如 BRK-B → BRK.B 在他们网站）
    futu_ticker = ticker.replace("-", ".")
    url = f"https://www.futunn.com/stock/{futu_ticker}-US"
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})

    try:
        with urllib.request.urlopen(req, timeout=15) as r:
            html = r.read().decode("utf-8", errors="ignore")
    except Exception as e:
        return None

    # 从 <title> 标签提取：
    # 例：<title>铿腾电子(CDNS) 股价、新闻、报价和图表 - 富途牛牛</title>
    m = re.search(r'<title>([^(<]+)\(' + re.escape(futu_ticker) + r'\)', html)
    if m:
        name = m.group(1).strip()
        # 过滤明显错误（如返回了英文）
        if re.search(r'[一-鿿]', name):  # 含中文字符
            return name
    return None


def main():
    with open(PATH) as f:
        data = json.load(f)

    stocks = data["stocks"]
    total = len(stocks)
    updated = 0
    not_found = []

    print(f"📊 开始抓取 {total} 只股票的富途中文名\n")

    for i, s in enumerate(stocks, 1):
        ticker = s["ticker"]
        old_name = s.get("name_cn", "")

        # 进度提示
        if i % 20 == 0 or i == 1:
            print(f"  [{i:>3}/{total}] 进度 {i*100/total:.0f}%")

        new_name = fetch_futu_name(ticker)

        if new_name and new_name != old_name:
            # 备份原翻译，加新的
            s["name_cn_old"] = old_name
            s["name_cn"] = new_name
            updated += 1
            if updated <= 30:  # 只显示前 30 个对比
                print(f"     {ticker:6} | {old_name:20} → {new_name}")
        elif not new_name:
            not_found.append(ticker)

        time.sleep(0.3)  # 避免触发反爬

        # 每 50 只保存一次（防意外中断）
        if i % 50 == 0:
            with open(PATH, "w", encoding="utf-8") as f:
                json.dump(data, f, ensure_ascii=False, indent=2)
            print(f"     💾 已保存到 stocks.json")

    # 最终保存
    with open(PATH, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

    print(f"\n{'='*60}")
    print(f"✅ 完成")
    print(f"  总共：{total}")
    print(f"  从富途更新：{updated}")
    print(f"  富途无数据：{len(not_found)}")
    if not_found:
        print(f"  无数据 ticker：{', '.join(not_found[:20])}{' ...' if len(not_found) > 20 else ''}")


if __name__ == "__main__":
    main()
