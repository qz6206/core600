#!/usr/bin/env python3
"""
从 Wikipedia 抓取最新的 S&P 500 和 Nasdaq 100 成分股列表，
合并去重后保存为 data/stocks.json
"""
import json
import re
import urllib.request
from pathlib import Path
from html.parser import HTMLParser

USER_AGENT = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Core600/0.1"

def fetch(url):
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(req, timeout=30) as r:
        return r.read().decode("utf-8")


class WikiTableParser(HTMLParser):
    """解析 Wikipedia 表格，提取所有行"""
    def __init__(self):
        super().__init__()
        self.in_table = False
        self.in_row = False
        self.in_cell = False
        self.in_target_table = False
        self.table_id = None
        self.current_row = []
        self.current_cell = ""
        self.tables = {}  # {table_id: [[cell, cell, ...], ...]}

    def handle_starttag(self, tag, attrs):
        attrs_dict = dict(attrs)
        if tag == "table":
            self.table_id = attrs_dict.get("id")
            self.in_table = True
            if self.table_id:
                self.tables[self.table_id] = []
        elif tag == "tr" and self.in_table:
            self.in_row = True
            self.current_row = []
        elif tag in ("td", "th") and self.in_row:
            self.in_cell = True
            self.current_cell = ""

    def handle_endtag(self, tag):
        if tag == "table":
            self.in_table = False
            self.table_id = None
        elif tag == "tr" and self.in_row:
            if self.table_id and self.current_row:
                self.tables[self.table_id].append(self.current_row)
            self.in_row = False
        elif tag in ("td", "th") and self.in_cell:
            self.current_row.append(self.current_cell.strip())
            self.in_cell = False

    def handle_data(self, data):
        if self.in_cell:
            self.current_cell += data


def fetch_sp500():
    print("📥 抓取 S&P 500 成分股...")
    html = fetch("https://en.wikipedia.org/wiki/List_of_S%26P_500_companies")
    parser = WikiTableParser()
    parser.feed(html)

    # 表格 id 通常是 constituents
    table = parser.tables.get("constituents", [])
    if not table:
        # fallback: 找第一个有数据的表格
        for tid, rows in parser.tables.items():
            if len(rows) > 100:
                table = rows
                break

    stocks = []
    # 跳过表头
    for row in table[1:]:
        if len(row) >= 4:
            ticker = row[0].strip().replace(".", "-")  # BRK.B → BRK-B（标准格式）
            name = row[1].strip()
            sector = row[2].strip() if len(row) > 2 else ""
            industry = row[3].strip() if len(row) > 3 else ""
            if ticker and re.match(r"^[A-Z\-\.]+$", ticker):
                stocks.append({
                    "ticker": ticker,
                    "name": name,
                    "sector": sector,
                    "industry": industry,
                })
    print(f"   ✓ 共 {len(stocks)} 只")
    return stocks


def fetch_nasdaq100():
    print("📥 抓取 Nasdaq 100 成分股...")
    html = fetch("https://en.wikipedia.org/wiki/Nasdaq-100")
    parser = WikiTableParser()
    parser.feed(html)

    # Nasdaq 100 的表格 id 是 constituents
    table = parser.tables.get("constituents", [])
    if not table:
        for tid, rows in parser.tables.items():
            if 90 <= len(rows) <= 120:
                table = rows
                break

    tickers = []
    for row in table[1:]:
        if len(row) >= 2:
            # Wikipedia 的 Nasdaq 100 表格列顺序可能是 [Company, Ticker, ...] 或 [Ticker, Company, ...]
            # 通过判断哪一列是大写字母组合来识别 ticker
            for cell in row[:3]:
                cell_clean = cell.strip().replace(".", "-")
                if re.match(r"^[A-Z]{1,5}(-[A-Z]+)?$", cell_clean):
                    tickers.append(cell_clean)
                    break
    tickers = list(set(tickers))  # 去重
    print(f"   ✓ 共 {len(tickers)} 只")
    return tickers


def main():
    sp500 = fetch_sp500()
    nasdaq100_tickers = set(fetch_nasdaq100())

    # 合并
    print("🔄 合并去重...")
    sp500_tickers = {s["ticker"] for s in sp500}

    all_stocks = []
    # 先加 S&P 500（数据最完整）
    for s in sp500:
        s["in_sp500"] = True
        s["in_nasdaq100"] = s["ticker"] in nasdaq100_tickers
        all_stocks.append(s)

    # 再加只在 Nasdaq 100 但不在 S&P 500 的
    only_nasdaq = nasdaq100_tickers - sp500_tickers
    for ticker in sorted(only_nasdaq):
        all_stocks.append({
            "ticker": ticker,
            "name": "",  # 名字后面再补
            "sector": "",
            "industry": "",
            "in_sp500": False,
            "in_nasdaq100": True,
        })

    # 按 ticker 排序
    all_stocks.sort(key=lambda x: x["ticker"])

    # 输出统计
    in_both = sum(1 for s in all_stocks if s["in_sp500"] and s["in_nasdaq100"])
    only_sp = sum(1 for s in all_stocks if s["in_sp500"] and not s["in_nasdaq100"])
    only_nq = sum(1 for s in all_stocks if not s["in_sp500"] and s["in_nasdaq100"])

    print()
    print("📊 统计：")
    print(f"   S&P 500：       {sum(1 for s in all_stocks if s['in_sp500'])}")
    print(f"   Nasdaq 100：    {sum(1 for s in all_stocks if s['in_nasdaq100'])}")
    print(f"   两个都在：      {in_both}")
    print(f"   只 S&P 500：    {only_sp}")
    print(f"   只 Nasdaq 100： {only_nq}")
    print(f"   去重总数：      {len(all_stocks)}")

    # 保存
    from datetime import datetime, timezone
    output = Path(__file__).parent.parent / "data" / "stocks.json"
    output.parent.mkdir(exist_ok=True)
    with open(output, "w", encoding="utf-8") as f:
        json.dump({
            "version": "1.0.0",
            "source": "Wikipedia (S&P 500 + Nasdaq 100 lists), cross-verified with FMP",
            "generated_at": datetime.now(timezone.utc).isoformat(),
            "total": len(all_stocks),
            "stocks": all_stocks,
        }, f, ensure_ascii=False, indent=2)
    print(f"\n✓ 已保存到 {output}")


if __name__ == "__main__":
    main()
