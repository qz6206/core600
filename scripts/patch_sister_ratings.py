#!/usr/bin/env python3
"""A2: 用姊妹股 (Class A) 评级补 BF-B / BRK-B / NWS

逻辑：FMP /upgrades-downgrades 对 BF-B、BRK-B、NWS 等 Class B 股票无数据，
但 BF-A、BRK-A、NWSA 有完整评级。它们是同一公司不同股权类别，分析师评级
通常对整个公司发的，复用没问题。

输出：把姊妹股的 ratings 复制到目标股票的 ratings 字段，并在每条 rating 上
加 source_class 标注（"Class A"），让前端可以选择展示提示。
"""
import json
import os
import time
import urllib.request
import urllib.error
from pathlib import Path

ROOT = Path(__file__).parent.parent
EXTRAS_JSON = ROOT / "data" / "fmp_extras.json"
ENV_LOCAL = ROOT / ".env.local"

# 目标 → 姊妹股
SISTER_MAP = {
    "BF-B": "BF-A",
    "BRK-B": "BRK-A",
    "NWS": "NWSA",
}


def load_fmp_key():
    key = os.environ.get("FMP_API_KEY")
    if key:
        return key
    if ENV_LOCAL.exists():
        for line in ENV_LOCAL.read_text().splitlines():
            line = line.strip()
            if line.startswith("FMP_API_KEY="):
                return line.split("=", 1)[1].strip().strip('"').strip("'")
    raise SystemExit("❌ FMP_API_KEY 未设置")


FMP_KEY = load_fmp_key()


def fetch_ratings(ticker):
    """从 FMP 抓评级变动"""
    url = f"https://financialmodelingprep.com/api/v4/upgrades-downgrades?symbol={ticker}&apikey={FMP_KEY}"
    for attempt in range(3):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "Core600/0.1"})
            with urllib.request.urlopen(req, timeout=30) as r:
                return json.loads(r.read())
        except Exception as e:
            print(f"   重试 {attempt+1}: {e}")
            time.sleep(2 ** attempt)
    return None


def main():
    print("🩹 A2: 姊妹股评级补丁\n", flush=True)
    extras = json.loads(EXTRAS_JSON.read_text())
    fixed = 0

    for target, sister in SISTER_MAP.items():
        existing = extras["by_ticker"].get(target, {}).get("ratings", [])
        if existing:
            print(f"  {target}: 已有 {len(existing)} 条评级，跳过")
            continue

        print(f"  {target} ← {sister} 抓取姊妹股评级...", flush=True)
        raw = fetch_ratings(sister)
        if not raw:
            print(f"    ❌ 抓不到 {sister} 评级")
            continue

        # 加 source 标注
        import re
        out = []
        for e in raw[:10]:
            title = e.get("newsTitle", "") or ""
            target_price = None
            m = re.search(r"\$\s?(\d+(?:\.\d+)?)", title)
            if m:
                target_price = float(m.group(1))
            out.append({
                "date": e.get("publishedDate", "")[:10],
                "company": e.get("gradingCompany"),
                "prev_grade": e.get("previousGrade"),
                "new_grade": e.get("newGrade"),
                "action": e.get("action"),
                "target_price": target_price,
                "title": title,
                "source_class": f"来源：{sister}（同公司另一类股）",
            })

        if target not in extras["by_ticker"]:
            extras["by_ticker"][target] = {}
        extras["by_ticker"][target]["ratings"] = out
        fixed += 1
        print(f"    ✅ {target}: 复用 {sister} 的 {len(out)} 条评级")

    if fixed > 0:
        # 更新 stats
        extras["stats"]["with_ratings"] += fixed
        EXTRAS_JSON.write_text(json.dumps(extras, ensure_ascii=False, indent=2))
        print(f"\n💾 写回 fmp_extras.json，新增 {fixed} 只评级")
    else:
        print("\n无需修复")


if __name__ == "__main__":
    main()
