#!/usr/bin/env python3
"""
对比新旧 stocks.json，输出变化（新增、移除、字段变更）。
配合 GitHub Actions 自动检测成分股变化。
"""
import json
import sys
from pathlib import Path

old_path = Path(sys.argv[1]) if len(sys.argv) > 1 else None
new_path = Path(__file__).parent.parent / "data" / "stocks.json"

if not old_path or not old_path.exists():
    print("⚠️ 无旧数据文件，视为全新")
    sys.exit(0)

with open(old_path) as f:
    old = {s["ticker"]: s for s in json.load(f)["stocks"]}
with open(new_path) as f:
    new = {s["ticker"]: s for s in json.load(f)["stocks"]}

old_tickers = set(old.keys())
new_tickers = set(new.keys())

added = new_tickers - old_tickers
removed = old_tickers - new_tickers

# 索引归属变化（从 SP500 移到 Nasdaq100 等）
membership_changes = []
for t in old_tickers & new_tickers:
    if old[t]["in_sp500"] != new[t]["in_sp500"] or \
       old[t]["in_nasdaq100"] != new[t]["in_nasdaq100"]:
        membership_changes.append((t, old[t], new[t]))

has_changes = bool(added or removed or membership_changes)

print(f"📊 成分股变化检测")
print(f"━━━━━━━━━━━━━━━━━━━━━━")
print(f"旧版总数: {len(old_tickers)}")
print(f"新版总数: {len(new_tickers)}")
print()

if added:
    print(f"➕ 新增 ({len(added)} 只):")
    for t in sorted(added):
        info = new[t]
        idx = "S&P500" if info["in_sp500"] else ""
        idx += " + Nasdaq100" if info["in_nasdaq100"] and idx else ("Nasdaq100" if info["in_nasdaq100"] else "")
        print(f"   {t:6} {info['name']:30} [{idx}]")
    print()

if removed:
    print(f"➖ 移除 ({len(removed)} 只):")
    for t in sorted(removed):
        info = old[t]
        idx = "S&P500" if info["in_sp500"] else ""
        idx += " + Nasdaq100" if info["in_nasdaq100"] and idx else ("Nasdaq100" if info["in_nasdaq100"] else "")
        print(f"   {t:6} {info['name']:30} [{idx}]")
    print()

if membership_changes:
    print(f"🔄 归属变化 ({len(membership_changes)} 只):")
    for t, o, n in membership_changes:
        print(f"   {t}: SP500 {o['in_sp500']}→{n['in_sp500']}, Nasdaq100 {o['in_nasdaq100']}→{n['in_nasdaq100']}")
    print()

if not has_changes:
    print("✓ 无变化")

# 输出给 GitHub Actions 用
print(f"::set-output name=has_changes::{'true' if has_changes else 'false'}")

# 写一个简短的变化摘要给 commit message 用
if has_changes:
    summary_path = Path(__file__).parent.parent / "data" / "_changes.txt"
    with open(summary_path, "w") as f:
        if added:
            f.write(f"新增: {', '.join(sorted(added))}\n")
        if removed:
            f.write(f"移除: {', '.join(sorted(removed))}\n")
        if membership_changes:
            f.write(f"归属变化: {len(membership_changes)} 只\n")

sys.exit(0 if not has_changes else 100)  # 100 表示有变化
