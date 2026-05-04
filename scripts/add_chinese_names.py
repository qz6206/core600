#!/usr/bin/env python3
"""为前 150 家最常被中文用户关注的公司添加中文名"""
import json
from pathlib import Path

# 中文用户最关心的公司中文名（按 ticker 字母序）
CN_NAMES = {
    # 七巨头 + 主流科技
    "AAPL": "苹果",
    "MSFT": "微软",
    "GOOGL": "Alphabet（A 类）",
    "GOOG": "Alphabet（C 类）",
    "AMZN": "亚马逊",
    "META": "Meta（脸书）",
    "NVDA": "英伟达",
    "TSLA": "特斯拉",

    # AI / 半导体
    "AMD": "超威半导体",
    "INTC": "英特尔",
    "AVGO": "博通",
    "TSM": "台积电",
    "ASML": "阿斯麦",
    "QCOM": "高通",
    "TXN": "德州仪器",
    "AMAT": "应用材料",
    "MU": "美光科技",
    "ARM": "Arm 控股",
    "MRVL": "迈威尔",
    "ADI": "亚德诺",
    "LRCX": "泛林集团",
    "KLAC": "科磊",
    "MCHP": "微芯科技",
    "ON": "安森美",
    "SNDK": "闪迪",

    # 软件 / SaaS
    "ORCL": "甲骨文",
    "CRM": "Salesforce",
    "ADBE": "Adobe",
    "NOW": "ServiceNow",
    "INTU": "Intuit",
    "PLTR": "Palantir",
    "SNOW": "Snowflake",
    "CRWD": "CrowdStrike",
    "PANW": "Palo Alto Networks",
    "FTNT": "Fortinet",
    "ZS": "Zscaler",
    "DDOG": "Datadog",
    "MDB": "MongoDB",
    "TEAM": "Atlassian",
    "WDAY": "Workday",
    "NET": "Cloudflare",
    "OKTA": "Okta",
    "VEEV": "Veeva Systems",
    "ANSS": "Ansys",
    "CDNS": "Cadence",
    "SNPS": "新思科技",
    "SHOP": "Shopify",

    # 互联网 / 电商
    "NFLX": "网飞",
    "DIS": "迪士尼",
    "PYPL": "PayPal",
    "BKNG": "Booking Holdings",
    "ABNB": "Airbnb",
    "UBER": "优步",
    "MELI": "MercadoLibre",
    "PDD": "拼多多控股",
    "BABA": "阿里巴巴",
    "JD": "京东",
    "EBAY": "易贝",
    "ROKU": "Roku",
    "PINS": "Pinterest",
    "SNAP": "Snap",
    "SPOT": "Spotify",
    "RBLX": "Roblox",
    "DASH": "DoorDash",
    "RDDT": "Reddit",

    # 金融
    "JPM": "摩根大通",
    "BAC": "美国银行",
    "WFC": "富国银行",
    "C": "花旗集团",
    "GS": "高盛",
    "MS": "摩根士丹利",
    "V": "Visa",
    "MA": "万事达",
    "AXP": "美国运通",
    "BLK": "贝莱德",
    "SCHW": "嘉信理财",
    "BRK-B": "伯克希尔",
    "BX": "黑石",
    "KKR": "KKR",
    "SPGI": "标普全球",
    "MCO": "穆迪",
    "ICE": "洲际交易所",
    "CME": "芝加哥商业交易所",
    "NDAQ": "纳斯达克",
    "COF": "第一资本",

    # 加密货币相关
    "COIN": "Coinbase",
    "MSTR": "Strategy（前 MicroStrategy）",
    "CRCL": "Circle",
    "HOOD": "Robinhood",

    # 医疗 / 制药
    "JNJ": "强生",
    "UNH": "联合健康",
    "PFE": "辉瑞",
    "MRK": "默克",
    "ABBV": "艾伯维",
    "LLY": "礼来",
    "TMO": "赛默飞世尔",
    "ABT": "雅培",
    "AMGN": "安进",
    "GILD": "吉利德",
    "ISRG": "直觉外科",
    "REGN": "再生元",
    "VRTX": "福泰制药",
    "BMY": "百时美施贵宝",
    "MDT": "美敦力",
    "SYK": "史赛克",
    "DHR": "丹纳赫",
    "BSX": "波士顿科学",
    "CVS": "CVS Health",
    "BIIB": "渤健",
    "MRNA": "Moderna",
    "ALNY": "Alnylam 制药",
    "INSM": "Insmed",

    # 消费 / 零售
    "WMT": "沃尔玛",
    "COST": "好市多",
    "HD": "家得宝",
    "TGT": "塔吉特",
    "LOW": "劳氏",
    "MCD": "麦当劳",
    "SBUX": "星巴克",
    "KO": "可口可乐",
    "PEP": "百事",
    "PG": "宝洁",
    "NKE": "耐克",
    "LULU": "露露乐蒙",
    "TJX": "TJX 公司",
    "MAR": "万豪",
    "HLT": "希尔顿",
    "MDLZ": "亿滋国际",
    "MO": "奥驰亚",
    "CL": "高露洁",
    "EL": "雅诗兰黛",
    "CMG": "墨式烧烤",
    "DPZ": "达美乐",
    "YUM": "百胜餐饮",
    "F": "福特",
    "GM": "通用汽车",
    "TM": "丰田",
    "BUD": "百威英博",
    "MNST": "怪物饮料",
    "CCEP": "可口可乐欧洲合作伙伴",

    # 工业 / 能源
    "BA": "波音",
    "RTX": "雷神技术",
    "LMT": "洛克希德马丁",
    "GE": "通用电气",
    "CAT": "卡特彼勒",
    "DE": "迪尔",
    "HON": "霍尼韦尔",
    "UPS": "UPS",
    "FDX": "联邦快递",
    "XOM": "埃克森美孚",
    "CVX": "雪佛龙",
    "COP": "康菲石油",
    "OXY": "西方石油",
    "SLB": "斯伦贝谢",
    "EOG": "EOG 资源",
    "FER": "Ferrovial",
    "TRI": "汤森路透",

    # 通讯 / 媒体
    "T": "AT&T",
    "VZ": "Verizon",
    "CMCSA": "康卡斯特",
    "TMUS": "T-Mobile",
    "EA": "艺电",
    "TTWO": "Take-Two",
    "WBD": "华纳兄弟探索",
    "PARA": "派拉蒙",

    # 其他热门
    "VST": "维斯特拉",
    "APP": "AppLovin",
    "CRWV": "CoreWeave",
    "ANET": "Arista Networks",
    "VRT": "维谛技术",
    "APH": "安费诺",
    "LITE": "Lumentum",
    "CIEN": "Ciena",
}


def main():
    path = Path(__file__).parent.parent / "data" / "stocks.json"
    with open(path) as f:
        data = json.load(f)

    matched = 0
    for s in data["stocks"]:
        if s["ticker"] in CN_NAMES:
            s["name_cn"] = CN_NAMES[s["ticker"]]
            matched += 1
        else:
            s["name_cn"] = ""

    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

    print(f"✓ 已添加 {matched} 个中文公司名（共 {len(CN_NAMES)} 个候选）")
    print(f"  剩余 {len(data['stocks']) - matched} 只股票暂用英文名")


if __name__ == "__main__":
    main()
