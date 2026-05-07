#!/usr/bin/env python3
"""
数据完整性 + 数量 sanity 验证脚本

在每个 cron push 之前运行, 检测异常数据 (防 FMP 突然返 0、字段格式变化等)。

用法:
  python3 scripts/validate_data.py [文件名]

  python3 scripts/validate_data.py fmp_extras
  python3 scripts/validate_data.py transcripts
  python3 scripts/validate_data.py earnings_interpretations
  python3 scripts/validate_data.py 13f
  python3 scripts/validate_data.py options
  python3 scripts/validate_data.py edgar_filings
  python3 scripts/validate_data.py all   # 验证所有

退出码:
  0 = 全部 OK
  1 = 有 schema 错误 / 数据量异常 (CI 应该 fail)
"""
from __future__ import annotations

import json
import sys
from pathlib import Path
from typing import Any

ROOT = Path(__file__).parent.parent
DATA_DIR = ROOT / "data"

# ====== 数据量阈值 (新数据 / 旧数据 < 阈值 就 fail, 防 FMP 突然返 0) ======
MIN_RATIO = 0.80  # 新数据 ticker 数 < 旧数据的 80% → fail


# ====== Schema 验证规则 ======
# 每个文件必需的顶层 keys + by_ticker 内每个 record 的必需字段
SCHEMAS: dict[str, dict] = {
    "fmp_extras.json": {
        "top_required": ["by_ticker"],
        "min_tickers": 400,        # 至少 400 只 (网站有 516, 给 buffer)
        "ticker_fields": [],       # 不强制每个 ticker 都有所有字段
        "sample_check": ["earnings", "shares", "sbc"],  # 抽样 check 这些字段必须是 list
    },
    "transcripts.json": {
        "top_required": ["by_ticker"],
        "min_tickers": 300,        # transcripts 不是每只都有
        "ticker_fields": ["content_cn"],   # 必须有中文 transcript
        "sample_check": [],
    },
    "earnings_interpretations.json": {
        "top_required": ["by_ticker"],
        "min_tickers": 400,
        "ticker_fields": ["fiscal_period_end", "data_card", "narrative_status"],
        "sample_check": [],
    },
    "13f.json": {
        "top_required": ["by_ticker"],
        "min_tickers": 300,
        "ticker_fields": [],
        "sample_check": [],
    },
    "options.json": {
        "top_required": ["by_ticker"],
        "min_tickers": 400,
        "ticker_fields": [],
        "sample_check": [],
    },
    "edgar_filings.json": {
        "top_required": ["by_ticker"],
        "min_tickers": 400,
        "ticker_fields": [],
        "sample_check": [],
    },
    "stocks.json": {
        "top_required": ["stocks"],
        "min_tickers": 500,        # 600 强通常 510-520 只
        "ticker_fields": [],
        "sample_check": [],
    },
}


def validate_file(name: str) -> tuple[bool, list[str]]:
    """返回 (ok, errors)"""
    schema = SCHEMAS.get(name)
    if not schema:
        return False, [f"未知 schema: {name}"]

    fp = DATA_DIR / name
    if not fp.exists():
        return False, [f"文件不存在: {fp}"]

    errors: list[str] = []

    # 1. 文件能读 + 是有效 JSON
    try:
        data = json.load(open(fp))
    except json.JSONDecodeError as e:
        return False, [f"JSON 无法解析: {e}"]
    except Exception as e:
        return False, [f"读文件失败: {e}"]

    # 2. 顶层 keys
    for k in schema["top_required"]:
        if k not in data:
            errors.append(f"缺顶层字段: {k}")

    # 3. ticker / record 数量
    if name == "stocks.json":
        records: Any = data.get("stocks", [])
        n = len(records) if isinstance(records, list) else 0
    else:
        records = data.get("by_ticker", {})
        n = len(records) if isinstance(records, dict) else 0

    if n < schema["min_tickers"]:
        errors.append(
            f"ticker 数量 {n} 低于阈值 {schema['min_tickers']} (可能 FMP 异常 / 数据丢失)"
        )

    # 4. 跟上次比的 ratio (如果可能)
    backup = fp.with_suffix(".prev.json")
    if backup.exists():
        try:
            prev_data = json.load(open(backup))
            if name == "stocks.json":
                prev_n = len(prev_data.get("stocks", []))
            else:
                prev_n = len(prev_data.get("by_ticker", {}))
            if prev_n > 0 and n / prev_n < MIN_RATIO:
                errors.append(
                    f"数据量骤降: {prev_n} → {n} (比例 {n/prev_n:.0%}, 低于 {MIN_RATIO:.0%})"
                )
        except Exception:
            pass

    # 5. 抽样 check ticker 内字段
    if name != "stocks.json" and isinstance(records, dict) and len(records) > 0:
        sample_keys = list(records.keys())[:5]
        for tk in sample_keys:
            rec = records[tk]
            if not isinstance(rec, dict):
                errors.append(f"{tk} record 不是 dict")
                continue
            for f in schema["ticker_fields"]:
                if f not in rec:
                    errors.append(f"{tk} 缺字段 {f}")
            for f in schema["sample_check"]:
                v = rec.get(f)
                if v is not None and not isinstance(v, list):
                    errors.append(f"{tk}.{f} 应为 list, 实际 {type(v).__name__}")

    return len(errors) == 0, errors


def main() -> int:
    target = sys.argv[1] if len(sys.argv) > 1 else "all"

    if target == "all":
        files = list(SCHEMAS.keys())
    else:
        # 兼容 "fmp_extras" / "fmp_extras.json"
        if not target.endswith(".json"):
            target = target + ".json"
        files = [target]

    all_ok = True
    for f in files:
        ok, errs = validate_file(f)
        if ok:
            print(f"✅ {f}")
        else:
            all_ok = False
            print(f"❌ {f}", file=sys.stderr)
            for e in errs:
                print(f"   {e}", file=sys.stderr)

    if not all_ok:
        print("\n💥 数据验证失败, 不要 push 这批数据 (可能污染网站)", file=sys.stderr)
        return 1

    print(f"\n✅ 所有 {len(files)} 个文件验证通过")
    return 0


if __name__ == "__main__":
    sys.exit(main())
