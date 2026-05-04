#!/usr/bin/env python3
"""补充只在 Nasdaq 100 不在 S&P 500 的股票名字（手动维护，量很少）"""
import json
from pathlib import Path

# 这 13 只通常是非美国注册公司或 ADR
NASDAQ_ONLY_INFO = {
    "ALNY": ("Alnylam Pharmaceuticals", "Health Care", "Biotechnology"),
    "ARM":  ("Arm Holdings", "Information Technology", "Semiconductors"),
    "ASML": ("ASML Holding", "Information Technology", "Semiconductors"),
    "CCEP": ("Coca-Cola Europacific Partners", "Consumer Staples", "Beverages"),
    "FER":  ("Ferrovial", "Industrials", "Construction"),
    "INSM": ("Insmed", "Health Care", "Biotechnology"),
    "MELI": ("MercadoLibre", "Consumer Discretionary", "Internet Retail"),
    "MRVL": ("Marvell Technology", "Information Technology", "Semiconductors"),
    "MSTR": ("Strategy (MicroStrategy)", "Information Technology", "Software"),
    "PDD":  ("PDD Holdings (Pinduoduo/Temu)", "Consumer Discretionary", "Internet Retail"),
    "SHOP": ("Shopify", "Information Technology", "Software"),
    "TRI":  ("Thomson Reuters", "Industrials", "Information Services"),
    "ZS":   ("Zscaler", "Information Technology", "Software"),
}

path = Path(__file__).parent.parent / "data" / "stocks.json"
with open(path) as f:
    data = json.load(f)

filled = 0
for s in data["stocks"]:
    if not s["name"] and s["ticker"] in NASDAQ_ONLY_INFO:
        name, sector, industry = NASDAQ_ONLY_INFO[s["ticker"]]
        s["name"] = name
        s["sector"] = sector
        s["industry"] = industry
        filled += 1

with open(path, "w", encoding="utf-8") as f:
    json.dump(data, f, ensure_ascii=False, indent=2)

print(f"✓ 补充了 {filled} 只股票的元数据")
