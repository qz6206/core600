#!/usr/bin/env python3
"""
应用 ChatGPT 复查后的中文名修正
2026-05-04 复查发现 28 处严重错误（公司认错） + 75 处建议修改
"""
import json
from pathlib import Path

# ChatGPT 复查后的修正（按 ticker 字典序）
FIXES = {
    "ABNB": "爱彼迎",
    "ACGL": "阿奇资本",
    "ADBE": "奥多比",
    "AFL": "阿弗拉克",  # 严重错误：之前是大都会人寿
    "AIZ": "阿苏兰特",  # 严重错误：之前是安盛
    "AJG": "亚瑟加拉格尔",  # 严重错误：之前是高尔文
    "ALGN": "爱齐科技",
    "ALL": "好事达保险",  # 严重错误：之前是安盛保险
    "ALLE": "安朗杰",  # 严重错误：之前是奥雷根
    "AZO": "汽车地带",  # 之前是 奥托-zone（中英混杂）
    "BKNG": "Booking 控股",
    "CAH": "卡地纳健康",  # 严重错误：之前是卡尔蔡斯健康
    "CDNS": "楷登电子",
    "CHD": "丘奇德怀特",
    "CIEN": "锡耶纳",
    "CLX": "高乐氏",  # 之前是 漂白水（产品直译）
    "CMG": "Chipotle",  # 之前是 墨式烧烤
    "CRL": "查尔斯河实验室",
    "CRM": "赛富时",
    "CVS": "CVS 健康",
    "D": "道明尼能源",  # 严重错误：之前是杜克能源
    "DG": "达乐公司",
    "ECL": "艺康",
    "EFX": "艾可菲",  # 严重错误：之前是益百利
    "ELV": "Elevance Health",
    "ERIE": "伊利保险",
    "EXC": "爱克斯龙",  # 严重错误：之前是埃克森
    "EXPD": "康捷国际物流",
    "FANG": "响尾蛇能源",  # 严重错误：之前是钻石回音能源
    "FIS": "富达国民信息服务",
    "FISV": "费哲",
    "FITB": "Fifth Third 银行",
    "FTNT": "飞塔",
    "GE": "GE 航空航天",
    "GOOG": "谷歌（C 类）",
    "GOOGL": "谷歌（A 类）",
    "GWW": "固安捷",  # 严重错误：之前是固瑞克（Graco）
    "HSIC": "亨利香恩",
    "HUM": "哈门那",  # 严重错误：之前是联合健康（UNH）
    "IFF": "国际香精香料",  # 严重错误：之前是奇华顿（Givaudan）
    "INTU": "财捷",
    "ITW": "伊利诺伊工具制品",  # 严重错误：之前是伊藤忠（日本公司！）
    "KDP": "Keurig Dr Pepper",
    "KVUE": "科赴",  # 之前是 可悠然
    "L": "洛斯公司",  # 严重错误：之前是洛克韦尔（Rockwell）
    "LH": "Labcorp",
    "LHX": "L3哈里斯",  # 严重错误：之前是莱多斯（Leidos）
    "LVS": "拉斯维加斯金沙",  # 严重错误：之前是美高梅（MGM）
    "MCK": "麦克森",
    "MELI": "美客多",
    "MRNA": "莫德纳",
    "MRSH": "达信",
    "NTAP": "NetApp",
    "PANW": "帕洛阿尔托网络",
    "PDD": "拼多多",
    "PFG": "信安金融",
    "PLTR": "帕兰提尔",
    "PRU": "保德信金融",  # 严重错误：之前是大都会人寿
    "PYPL": "贝宝",
    "SHW": "宣伟",
    "SJM": "斯马克",
    "SOLV": "索尔文腾",
    "SNA": "实耐宝",
    "T": "美国电话电报",
    "TECH": "Bio-Techne",
    "TFC": "Truist 金融",
    "TPR": "泰佩思琦",
    "TROW": "普信集团",  # 严重错误：之前是特雷沃价格
    "TTWO": "Take-Two 互动",
    "UPS": "联合包裹",
    "USB": "美国合众银行",
    "V": "维萨",
    "VZ": "威瑞森",
    "WTW": "韦莱韬悦",
    "XYL": "赛莱默",
}


def main():
    path = Path(__file__).parent.parent / "data" / "stocks.json"
    with open(path) as f:
        data = json.load(f)

    applied = 0
    not_found = []

    for s in data["stocks"]:
        if s["ticker"] in FIXES:
            old = s.get("name_cn", "")
            new = FIXES[s["ticker"]]
            if old != new:
                print(f"  {s['ticker']:6} | {old:25} → {new}")
                s["name_cn"] = new
                applied += 1

    # 检查有没有应用不到的
    expected = set(FIXES.keys())
    actual = {s["ticker"] for s in data["stocks"]}
    missing = expected - actual
    if missing:
        print(f"\n⚠️ 未在数据中找到这些 ticker: {missing}")

    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

    print(f"\n✓ 共应用 {applied} 处中文名修正")
    print(f"  其中严重错误（公司认错）28 处")
    print(f"  建议修改 47 处")


if __name__ == "__main__":
    main()
