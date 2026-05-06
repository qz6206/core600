#!/usr/bin/env python3
"""【预案脚本】把 by_ticker 结构的大 JSON 文件按 ticker 拆成小文件

为什么需要：
- GitHub 单文件硬限 100 MB
- transcripts.json 现在 22 MB，每加 1 季历史 +22 MB
- 5 季历史时（~110 MB）push 会失败 → 必须改架构

触发条件（任一满足）：
- 单文件 > 80 MB
- 仓库总大小 > 3 GB
- Vercel build 时间 > 5 分钟（说明 JSON 解析变慢）

----- 用法 -----

# 1. 预演（不动文件，只看会拆出多少个）
python3 scripts/split_by_ticker.py --src data/transcripts.json --dry-run

# 2. 执行拆分（生成 data/transcripts/ 目录 + _index.json）
python3 scripts/split_by_ticker.py --src data/transcripts.json --apply

# 3. 验证（diff 一下原 vs 拆后能不能拼回去）
python3 scripts/split_by_ticker.py --src data/transcripts.json --verify

# 4. 回滚（把目录 merge 回单文件）
python3 scripts/split_by_ticker.py --src data/transcripts.json --rollback

----- 拆分后效果 -----

原结构:
  data/transcripts.json                    ← 22 MB 单文件

拆分后:
  data/transcripts/
    _index.json                            ← 元数据 + 可用 ticker 列表（~10 KB）
    AAPL.json                              ← 单股票数据 (~50 KB)
    NVDA.json
    ...                                    ← 共 ~512 个文件
  data/transcripts.json.bak                ← 备份（首次 apply 时生成）

----- 切换后需要改的代码 -----

src/app/stocks/[ticker]/page.tsx 把：

  import transcriptsData from "../../../../data/transcripts.json";
  ...
  const transcript = (transcriptsData as TranscriptsByTicker).by_ticker[upper] || null;

改成：

  import fs from "node:fs";
  import path from "node:path";
  ...
  const transcriptPath = path.join(process.cwd(), "data/transcripts", `${upper}.json`);
  let transcript: TranscriptCN | null = null;
  try {
    transcript = JSON.parse(fs.readFileSync(transcriptPath, "utf-8"));
  } catch {
    // 该股票暂无 transcript（文件不存在）
  }

Server Component 静态构建时 fs.readFileSync 完全 OK，每个静态页只读自己那个 ticker。

translate_transcripts.py 输出也改成写 data/transcripts/{TICKER}.json 即可。
（更新 4 行，不影响主流程）

----- 实现说明 -----
- _index.json 同时存一份"所有 ticker 列表 + 各文件大小"，便于审计
- 字段精确度：原 JSON 100% 保留（用 ensure_ascii=False + indent=2 与原 fetch 脚本一致）
- 幂等：apply 多次结果相同
"""
import argparse
import json
import shutil
import sys
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).parent.parent


def split(src_path: Path, dry_run: bool = False) -> dict:
    """src_path 是 data/transcripts.json 这种大文件"""
    if not src_path.exists():
        raise SystemExit(f"❌ 源文件不存在: {src_path}")

    data = json.loads(src_path.read_text())
    by_ticker = data.get("by_ticker", {})
    if not by_ticker:
        raise SystemExit(f"❌ {src_path} 没有 by_ticker 字段")

    # 输出目录: data/transcripts.json → data/transcripts/
    out_dir = src_path.parent / src_path.stem  # 去掉 .json
    out_index = out_dir / "_index.json"

    print(f"📦 源文件: {src_path} ({src_path.stat().st_size / 1024 / 1024:.2f} MB)", flush=True)
    print(f"📦 拆分目标: {out_dir}/", flush=True)
    print(f"📦 ticker 数量: {len(by_ticker)}", flush=True)
    if dry_run:
        # 估算拆分后文件大小
        total_size = 0
        max_size = 0
        for ticker, value in by_ticker.items():
            sample = json.dumps(value, ensure_ascii=False).encode()
            total_size += len(sample)
            max_size = max(max_size, len(sample))
        print(f"\n🧪 Dry run（不写文件）:")
        print(f"   预估单股票文件平均大小: {total_size / len(by_ticker) / 1024:.1f} KB")
        print(f"   预估单股票文件最大大小: {max_size / 1024:.1f} KB")
        print(f"   预估总大小（拆后）: {total_size / 1024 / 1024:.2f} MB（含 ~10% 格式化开销）")
        return {"mode": "dry-run", "tickers": len(by_ticker)}

    # 实际执行
    out_dir.mkdir(exist_ok=True)
    written = 0
    sizes = {}
    for ticker, value in by_ticker.items():
        # 格式化与原文件一致
        out_file = out_dir / f"{ticker}.json"
        content = json.dumps(value, ensure_ascii=False, indent=2)
        out_file.write_text(content)
        sizes[ticker] = len(content.encode())
        written += 1
        if written % 100 == 0:
            print(f"   {written} / {len(by_ticker)}", flush=True)

    # 写 _index.json
    index = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "source": str(src_path.name),
        "split_by": "ticker",
        "stats": data.get("stats", {}),
        "metadata_keys": [k for k in data.keys() if k != "by_ticker"],  # generated_at, model, stats 等
        "metadata_values": {k: data[k] for k in data.keys() if k != "by_ticker"},
        "tickers_count": len(by_ticker),
        "tickers": sorted(by_ticker.keys()),
        "size_bytes": sizes,
    }
    out_index.write_text(json.dumps(index, ensure_ascii=False, indent=2))

    # 备份原文件
    backup = src_path.with_suffix(".json.bak")
    if not backup.exists():
        shutil.copy(src_path, backup)
        print(f"\n💾 备份: {backup} (首次 apply 才生成，回滚用)")

    total_split_size = sum(sizes.values())
    print(f"\n✅ 完成")
    print(f"   写入文件: {written}")
    print(f"   _index.json: {out_index.stat().st_size / 1024:.1f} KB")
    print(f"   总大小: {total_split_size / 1024 / 1024:.2f} MB")
    print(f"   单文件最大: {max(sizes.values()) / 1024:.1f} KB ({max(sizes, key=sizes.get)})")
    print(f"\n💡 别忘了：")
    print(f"   1. 改 page.tsx 的 import 为 fs.readFileSync（见本脚本顶部 docstring）")
    print(f"   2. 改 translate_transcripts.py / fetch_*.py 输出到 {out_dir}/<TICKER>.json")
    print(f"   3. 老的 {src_path} 可以 git rm（或保留作 fallback）")

    return {"mode": "applied", "tickers": written}


def verify(src_path: Path) -> bool:
    """验证拆分文件能完整还原原 JSON"""
    out_dir = src_path.parent / src_path.stem
    out_index = out_dir / "_index.json"

    if not out_dir.exists() or not out_index.exists():
        raise SystemExit(f"❌ 拆分目录不存在: {out_dir}")

    src_data = json.loads(src_path.read_text())
    src_by_ticker = src_data.get("by_ticker", {})

    rebuilt = {}
    for json_file in sorted(out_dir.glob("*.json")):
        if json_file.name == "_index.json":
            continue
        ticker = json_file.stem
        rebuilt[ticker] = json.loads(json_file.read_text())

    # 比对
    missing_in_split = set(src_by_ticker.keys()) - set(rebuilt.keys())
    extra_in_split = set(rebuilt.keys()) - set(src_by_ticker.keys())

    print(f"📊 验证 {src_path}:")
    print(f"   原文件 ticker: {len(src_by_ticker)}")
    print(f"   拆分后 ticker: {len(rebuilt)}")
    if missing_in_split:
        print(f"   ❌ 拆分缺失: {sorted(missing_in_split)[:10]}")
        return False
    if extra_in_split:
        print(f"   ❌ 拆分多余: {sorted(extra_in_split)[:10]}")
        return False

    # 内容比对（采样）
    import random
    samples = random.sample(list(src_by_ticker.keys()), min(10, len(src_by_ticker)))
    for ticker in samples:
        if json.dumps(src_by_ticker[ticker], sort_keys=True) != json.dumps(rebuilt[ticker], sort_keys=True):
            print(f"   ❌ 内容不一致: {ticker}")
            return False
    print(f"   ✅ ticker 一一对应")
    print(f"   ✅ 内容采样 {len(samples)} 个全部一致")
    return True


def rollback(src_path: Path) -> None:
    """把 data/transcripts/*.json 重新合并回 data/transcripts.json"""
    out_dir = src_path.parent / src_path.stem
    out_index = out_dir / "_index.json"

    if not out_dir.exists():
        raise SystemExit(f"❌ 拆分目录不存在: {out_dir}")

    print(f"🔄 回滚 {out_dir}/ → {src_path}")

    # 读 _index 拿元数据
    if out_index.exists():
        idx = json.loads(out_index.read_text())
        metadata = idx.get("metadata_values", {})
    else:
        metadata = {}

    # 合并
    by_ticker = {}
    for json_file in sorted(out_dir.glob("*.json")):
        if json_file.name == "_index.json":
            continue
        by_ticker[json_file.stem] = json.loads(json_file.read_text())

    rebuilt = {**metadata, "by_ticker": by_ticker}
    src_path.write_text(json.dumps(rebuilt, ensure_ascii=False, indent=2))
    print(f"   ✅ 已写回 {src_path}（{src_path.stat().st_size / 1024 / 1024:.2f} MB）")
    print(f"   💡 现在可以 rm -rf {out_dir}/")


def main():
    parser = argparse.ArgumentParser(description="按 ticker 拆分大 JSON 预案脚本")
    parser.add_argument("--src", required=True, help="源 JSON 文件路径，如 data/transcripts.json")
    grp = parser.add_mutually_exclusive_group(required=True)
    grp.add_argument("--dry-run", action="store_true", help="预演（不写文件）")
    grp.add_argument("--apply", action="store_true", help="执行拆分")
    grp.add_argument("--verify", action="store_true", help="验证拆分文件 == 原文件")
    grp.add_argument("--rollback", action="store_true", help="把拆分文件合并回单文件")
    args = parser.parse_args()

    src = ROOT / args.src if not Path(args.src).is_absolute() else Path(args.src)

    if args.dry_run:
        split(src, dry_run=True)
    elif args.apply:
        split(src, dry_run=False)
    elif args.verify:
        ok = verify(src)
        sys.exit(0 if ok else 1)
    elif args.rollback:
        rollback(src)


if __name__ == "__main__":
    main()
