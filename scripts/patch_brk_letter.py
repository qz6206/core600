#!/usr/bin/env python3
"""B: 翻译 Berkshire 2025 年度致股东信 → 注入 transcripts.json BRK-B

Berkshire Hathaway 不开传统 earnings call，但每年 2 月发布的"致股东信"是
业内最权威的管理层沟通形式之一（巴菲特 + 现 Greg Abel）。

源：https://www.berkshirehathaway.com/letters/2025ltr.pdf
"""
import json
import os
import time
import urllib.request
import urllib.error
import subprocess
from pathlib import Path

ROOT = Path(__file__).parent.parent
TRANSCRIPTS_JSON = ROOT / "data" / "transcripts.json"
ENV_LOCAL = ROOT / ".env.local"
LETTER_URL = "https://www.berkshirehathaway.com/letters/2025ltr.pdf"
PDF_PATH = "/tmp/brk_2025.pdf"
TXT_PATH = "/tmp/brk_2025.txt"

KIMI_URL = "https://api.siliconflow.cn/v1/chat/completions"
# 2026-05-06 切换到 DeepSeek-V3 (¥2 in / ¥8 out, 比 Kimi-K2.5 砍 50%)
KIMI_MODEL = "deepseek-ai/DeepSeek-V3"


def load_sf_key():
    key = os.environ.get("SILICONFLOW_API_KEY")
    if key:
        return key
    if ENV_LOCAL.exists():
        for line in ENV_LOCAL.read_text().splitlines():
            line = line.strip()
            if line.startswith("SILICONFLOW_API_KEY="):
                return line.split("=", 1)[1].strip().strip('"').strip("'")
    raise SystemExit("❌ SILICONFLOW_API_KEY 未设置")


SF_KEY = load_sf_key()


def fetch_letter():
    """下载 PDF 并提取文本"""
    print(f"📥 下载 Berkshire 2025 年度致股东信...")
    if not Path(PDF_PATH).exists():
        urllib.request.urlretrieve(LETTER_URL, PDF_PATH)
    print(f"📄 提取文本（pdftotext -layout）...")
    subprocess.run(["pdftotext", "-layout", PDF_PATH, TXT_PATH], check=True)
    text = Path(TXT_PATH).read_text()
    # 去掉表格部分（最后一段是历年回报率，对中文翻译没意义）
    # Find "Compounded Annual Gain" 这种 marker
    marker = "Compounded Annual Gain"
    if marker in text:
        idx = text.rfind(marker)
        # 截到这之前的位置（保留表格头但去掉数字海洋）
        # 实际上完整表格也保留，让 Kimi 自己处理
        pass
    print(f"   ✓ {len(text)} 字符 / ~{len(text)//4} tokens")
    return text


def translate_letter(text: str):
    """调 Kimi K2.5 翻译"""
    prompt = f"""你是一位专业财经译者。下面是 Berkshire Hathaway（BRK，伯克希尔哈撒韦）2025 年度致股东信全文，由现任 CEO Greg Abel 撰写（继任 Warren Buffett）。

请翻译成中文。要求：
1. 公司名（Berkshire Hathaway）、人名（Warren Buffett、Greg Abel、Charlie Munger 等）、子公司名（GEICO、BNSF、Apple、Coca-Cola 等）一律保留英文原文
2. 财务术语用准确中文（book value→账面价值，operating earnings→营业利润，underwriting→承保业务，capital allocation→资本配置）
3. 数字精确（$1.2 billion → 12 亿美元，6,099,294% → 6,099,294%，保留原数字）
4. 巴菲特/Abel 的语言风格保留（朴实、机智、自嘲），不要变成生硬翻译腔
5. 段落结构和签名保留
6. 表格部分（年度回报率历史）：保留表格格式，仅翻译表头，数字保留原状
7. 直接输出译文，不加任何前缀

英文全文：
{text}"""

    body = {
        "model": KIMI_MODEL,
        "messages": [{"role": "user", "content": prompt}],
        "max_tokens": 16000,
        "temperature": 0.3,
    }
    print(f"🤖 调 Kimi K2.5 翻译...")
    t0 = time.time()
    for attempt in range(3):
        try:
            req = urllib.request.Request(
                KIMI_URL,
                data=json.dumps(body).encode(),
                headers={"Authorization": f"Bearer {SF_KEY}",
                         "Content-Type": "application/json"},
                method="POST",
            )
            with urllib.request.urlopen(req, timeout=900) as r:
                data = json.loads(r.read())
            elapsed = time.time() - t0
            usage = data.get("usage", {})
            cn = data["choices"][0]["message"]["content"].strip()
            print(f"   ✓ 翻译完成 ({elapsed:.1f}s, in={usage.get('prompt_tokens', 0)} out={usage.get('completion_tokens', 0)})")
            return cn
        except Exception as e:
            print(f"   ⚠️ 重试 {attempt+1}: {e}")
            time.sleep(10 * (attempt + 1))
    return None


def main():
    print("🩹 B: BRK-B 巴菲特/Abel 年度致股东信翻译\n")
    text = fetch_letter()
    cn = translate_letter(text)
    if not cn:
        raise SystemExit("❌ 翻译失败")

    # 注入 transcripts.json BRK-B
    tr = json.loads(TRANSCRIPTS_JSON.read_text())
    tr["by_ticker"]["BRK-B"] = {
        "year": 2025,
        "quarter": 0,  # 0 = 年度，区别于季度 transcript
        "date": "2026-02-22",  # BRK 致股东信通常 2 月发布
        "content_cn": cn,
        "content_en_chars": len(text),
        "is_annual_letter": True,  # 特殊标记
        "source_label": "Berkshire 2025 年度致股东信",  # UI 用，区别于 earnings call
        "source_url": LETTER_URL,
    }
    tr["stats"]["translated"] = tr["stats"].get("translated", 0) + 1
    TRANSCRIPTS_JSON.write_text(json.dumps(tr, ensure_ascii=False, indent=2))
    print(f"\n💾 写回 transcripts.json，BRK-B 已添加 (中文 {len(cn)} 字)")


if __name__ == "__main__":
    main()
