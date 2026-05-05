#!/usr/bin/env python3
"""
用硅基流动 API 批量翻译剩余股票的中文名
"""
import json
import os
import time
import urllib.request
from pathlib import Path

API_KEY = os.environ.get("SILICONFLOW_API_KEY")
if not API_KEY:
    raise SystemExit("请设置环境变量 SILICONFLOW_API_KEY")
API_URL = "https://api.siliconflow.cn/v1/chat/completions"
MODEL = "Qwen/Qwen2.5-32B-Instruct"


def translate_batch(stocks_batch):
    """翻译一批股票名称"""
    items = "\n".join(f"{s['ticker']}: {s['name']}" for s in stocks_batch)

    prompt = f"""我会给你美股公司的英文名称，请翻译成简洁的中文公司名。

要求：
1. 用最常见、最简洁的中文名（如 "Microsoft" → "微软"）
2. 如果是著名公司（如 NVDA、AAPL），用大众熟知的中文译名
3. 如果是中概股（如 BABA、PDD），用中文公司名（如 "阿里巴巴"、"拼多多"）
4. 不知名公司可以用音译或直译
5. 保留必要的公司类型（如"控股"、"集团"、"金融"）但不要太长
6. 不要带"公司"、"Inc."、"Corp."等后缀

请按以下格式输出，每行一个，不要任何额外说明：
TICKER|中文名

输入：
{items}

输出："""

    payload = {
        "model": MODEL,
        "messages": [{"role": "user", "content": prompt}],
        "temperature": 0.3,
        "max_tokens": 4000,
    }

    req = urllib.request.Request(
        API_URL,
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "Authorization": f"Bearer {API_KEY}",
            "Content-Type": "application/json",
        },
    )

    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            result = json.loads(r.read().decode("utf-8"))
            text = result["choices"][0]["message"]["content"]
            # 解析返回
            mapping = {}
            for line in text.strip().split("\n"):
                if "|" in line:
                    parts = line.split("|", 1)
                    if len(parts) == 2:
                        ticker = parts[0].strip().upper()
                        name = parts[1].strip()
                        # 清理一些不需要的字符
                        name = name.replace("**", "").replace("`", "").strip()
                        if ticker and name:
                            mapping[ticker] = name
            return mapping
    except Exception as e:
        print(f"  错误: {e}")
        return {}


def main():
    path = Path(__file__).parent.parent / "data" / "stocks.json"
    with open(path) as f:
        data = json.load(f)

    # 找出没有中文名的股票
    todo = [s for s in data["stocks"] if not s.get("name_cn")]
    print(f"📊 待翻译 {len(todo)} 只股票")

    if not todo:
        print("✓ 全部已有中文名")
        return

    BATCH_SIZE = 30
    total_added = 0

    for i in range(0, len(todo), BATCH_SIZE):
        batch = todo[i:i + BATCH_SIZE]
        print(f"\n📦 第 {i // BATCH_SIZE + 1} 批 ({len(batch)} 只): {batch[0]['ticker']} ~ {batch[-1]['ticker']}")

        mapping = translate_batch(batch)
        added = 0
        for s in batch:
            if s["ticker"] in mapping:
                s["name_cn"] = mapping[s["ticker"]]
                added += 1
        total_added += added
        print(f"   ✓ 翻译 {added}/{len(batch)} 只")

        # 实时保存（防中断）
        with open(path, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)

        time.sleep(1)  # 避免触发 rate limit

    print(f"\n✅ 完成！共翻译 {total_added} 只")
    print(f"   总计有中文名: {sum(1 for s in data['stocks'] if s.get('name_cn'))} / {len(data['stocks'])}")


if __name__ == "__main__":
    main()
