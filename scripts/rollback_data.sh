#!/bin/bash
# 一键回滚最近 N 个数据 commit (只回滚 cron 自动 commit, 不动你的代码)
#
# 用法:
#   ./scripts/rollback_data.sh        # 回滚最近 1 个数据 commit
#   ./scripts/rollback_data.sh 3      # 回滚最近 3 个数据 commit
#   ./scripts/rollback_data.sh --dry  # 只显示要回滚的 commit, 不做改动
#
# 安全:
#   - 只匹配 commit message 含"自动更新"的 commit (cron 自动产物)
#   - 你手写的代码 commit 永远不会被回滚
#   - 用 git revert 而不是 reset, 保留历史
#   - revert 后会自动 push (除非 --dry)

set -e

cd "$(dirname "$0")/.."

DRY=0
N=1
for arg in "$@"; do
    case "$arg" in
        --dry|-n) DRY=1 ;;
        ''|*[!0-9]*) ;;
        *) N=$arg ;;
    esac
done

# 找最近 N 个 commit message 含"自动更新"的
COMMITS=$(git log --pretty=format:"%H %s" -100 | grep "自动更新" | head -n "$N" | awk '{print $1}')

if [ -z "$COMMITS" ]; then
    echo "❌ 没找到含'自动更新'的 commit"
    exit 1
fi

echo "📋 准备回滚的 commit:"
git log --pretty=format:"  %h %s" -100 | grep "自动更新" | head -n "$N"

if [ "$DRY" = "1" ]; then
    echo ""
    echo "⚠️  --dry 模式, 没做改动"
    exit 0
fi

echo ""
read -p "确认 revert 这 $N 个 commit 并 push? (yes/no) " confirm
if [ "$confirm" != "yes" ]; then
    echo "取消"
    exit 0
fi

# revert 每一个 (按从新到旧顺序)
for c in $COMMITS; do
    echo "↩️  revert $c"
    git revert --no-edit "$c"
done

echo ""
echo "📤 推送..."
git pull --rebase origin main && git push

echo ""
echo "✅ 回滚完成, Vercel 会自动重新部署"
