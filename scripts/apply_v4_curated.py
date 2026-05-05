#!/usr/bin/env python3
"""
应用第 4 轮修正：剩余 129 只用东方财富/新浪美股 + 公司官网交叉确认后
人工筛选出 14 处建议修改
"""
import json
from pathlib import Path

FIXES = {
    "APD":  ("空气化工",         "东方财富/新浪：空气化工产品"),
    "BRO":  ("布朗保险",         "保险经纪业务，更直观"),
    "BXP":  ("波士顿地产",       "结合公司前身 Boston Properties"),
    "DECK": ("德克斯户外",       "东方财富/新浪：德克斯户外"),
    "EXPE": ("亿客行",           "东方财富/新浪：亿客行"),
    "GL":   ("环球人寿",         "东方财富：环球人寿，符合保险公司"),
    "GNRC": ("Generac 控股",     "新浪：Generac控股"),
    "GPC":  ("通用配件",         "东方财富：通用配件（'真利时'识别度低）"),
    "HOOD": ("罗宾汉",           "新浪：罗宾汉，中文用户熟悉"),
    "MSCI": ("明晟",             "东方财富/新浪：明晟"),
    "NDSN": ("诺信",             "东方财富/新浪/Nordson 中文官网均用'诺信'"),
    "PANW": ("派拓网络",         "Palo Alto Networks 中文站及东方财富/新浪均用"),
    "VZ":   ("威瑞森通讯",       "东方财富：威瑞森通讯，更完整"),
    "WST":  ("西氏医药服务",     "东方财富/新浪：西氏医药服务"),
}

PATH = Path(__file__).parent.parent / "data" / "stocks.json"


def main():
    with open(PATH) as f:
        data = json.load(f)

    applied = 0
    for s in data["stocks"]:
        if s["ticker"] in FIXES:
            new, reason = FIXES[s["ticker"]]
            old = s.get("name_cn", "")
            if old != new:
                print(f"  {s['ticker']:6} | {old:18} → {new:15} ({reason})")
                s["name_cn_old"] = old
                s["name_cn"] = new
                s["name_cn_source"] = "curated"  # 人工筛选 + 多源交叉
                applied += 1

    expected = set(FIXES.keys())
    actual = {s["ticker"] for s in data["stocks"]}
    missing = expected - actual
    if missing:
        print(f"\n⚠️ 数据中没找到: {missing}")

    with open(PATH, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

    print(f"\n✅ 已应用 {applied} 处修正")


if __name__ == "__main__":
    main()
