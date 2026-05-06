# Core 600

中文 S&P 500 + Nasdaq 100 数据中心 — **[core600.com](https://core600.com)**

516 只美股最热门股票的 9 大数据维度，全中文界面，500+ 静态页面 SEO 友好。

## 功能

每只股票详情页（`/stocks/[ticker]`）包含 9 个数据区块：

| 区块 | 内容 | 刷新频率 |
|------|------|---------|
| 📊 财务概览 | 最近 4 个季度营收 / 净利润 / 毛利率 / EPS | ISR 30 min |
| 🎙️ 财报会议 | 最近 1 季度 transcript 中文全文（含说话人识别） | 每周 |
| 👤 内部人交易 | Form 4 列表 + SEC 跳转 | 每 6 小时 |
| 🏛️ 机构持仓 | 13F 聚合统计 + Top 10 机构（含季度变化） | 每周 |
| 📰 8-K 公司重大事项 | 含 Item 编号中文化（5.02→高管变动等） + 6-K 兜底（外国 ADR） | 每 6 小时 |
| 🔮 分析师预期 | 未来 4 季 EPS/营收 + Beat/Miss 历史 + 评级变动 | 每天 |
| 🎯 期权异动 | ATM IV / P/C 比 / Top 10 异动合约（vol/OI ≥ 2 标橙）| 每天美股盘后 |
| 📉 股本动态 | 摊薄股数 / SBC TTM / 回购 / SBC 占净利率 | 每天 |
| 📅 财报日历 | 下次财报日（含盘前/盘后）+ 过去 8 次记录 | 每天 |

外加：公司简介中文版、Form 4 中文 Item 标签、首页 600 只股票筛选/排序。

## 架构

```
GitHub Actions (cron)
  ↓
scripts/fetch_*.py（FMP / SEC EDGAR / Polygon / Kimi K2.5）
  ↓
data/*.json（commit 进 main, ~36 MB 总）
  ↓
Next.js 16 build（generateStaticParams 预生成 516 + 5 静态页）
  ↓
Vercel CDN
```

**好处：** 浏览器零 API 调用，runtime 无 backend，Vercel 免费档够用，所有 API key 永远在 server 侧。

## 技术栈

- **Next.js 16** App Router，全 SSG
- **TypeScript 严格模式**
- **Tailwind CSS 4**（不用 PostCSS plugin）
- **next-themes** 双主题
- **opencc-js** 简繁转换
- **GitHub Actions** + **Vercel** 自动部署

## 数据源

- **FMP** (Premium) — 财务、分析师、13F、期权聚合
- **SEC EDGAR** (free) — Form 4、8-K、6-K（外国发行人）
- **Polygon** (Options Starter) — 期权快照、Greeks、IV
- **SiliconFlow Kimi K2.5** — 公司简介 + 财报会议中文翻译

## 本地开发

```bash
# 1. 复制 env
cp .env.example .env.local
# 编辑 .env.local 填入：
#   FMP_API_KEY=...
#   POLYGON_API_KEY=...
#   SILICONFLOW_API_KEY=...
#   EDGAR_USER_AGENT="YourName your@email.com"

# 2. 安装依赖 + 跑 dev
npm install
npm run dev
# 打开 http://localhost:3000

# 3. 生产构建
npm run build
# 生成 522 个静态页面，~13s
```

## 数据更新

各 GitHub Action workflow 自动触发：

| Workflow | Cron | 内容 |
|---------|------|------|
| `update-stocks.yml` | 周一 6:00 UTC | 600 强成分股变化 |
| `update-edgar.yml` | 每 6 小时 | SEC EDGAR (Form 4 + 8-K + 6-K) |
| `update-13f.yml` | 周一 6:30 UTC | FMP 13F 机构持仓 |
| `update-fmp-extras.yml` | 每天 7:00 UTC | FMP 分析师/财报/SBC/评级 |
| `update-options.yml` | 每天 1:00 UTC | Polygon 期权快照 |
| `update-translations.yml` | 周一 8:00 UTC | Kimi 中文翻译刷新 |

所有 workflow 共享 `concurrency: data-update` group，避免并发 push 冲突。

## 部署

`main` 分支 push 自动触发 Vercel 部署，~13s 构建 + ~30s CDN 分发 = 1 min 内全球生效。

## 目录

```
src/
├── app/                    # Next.js App Router
│   ├── page.tsx            # 首页（9 大功能预览）
│   ├── stocks/page.tsx     # 600 列表页
│   └── stocks/[ticker]/    # 详情页（516 静态页）
├── components/
│   ├── StockDetailContent.tsx  # 详情页主组件（9 区块）
│   ├── StocksPageContent.tsx   # 列表页客户端逻辑
│   └── Footer.tsx, ThemeToggle.tsx, ...
└── lib/
    ├── fmp.ts              # FMP API 封装 + 类型
    ├── edgar.ts            # SEC EDGAR API 封装 + 类型
    ├── format.ts           # 数字/百分比/颜色
    └── types.ts            # Stock + 行业中文映射

data/                       # 静态预拉数据（commit 进仓库）
├── stocks.json             # 主索引
├── descriptions_cn.json    # 公司简介中文 (Kimi K2.5)
├── transcripts.json        # 财报会议中文 (Kimi K2.5)
├── edgar_filings.json      # Form 4 + 8-K + 6-K
├── 13f.json                # 机构持仓
├── fmp_extras.json         # 分析师/财报/SBC/评级
└── options.json            # 期权快照

scripts/                    # 数据 pipeline（详见 scripts/README.md）
.github/workflows/          # 6 个数据更新 workflow
review/                     # 代码审查报告（gitignored）
```

## 开发原则

- **静态优先**：所有数据预生成，浏览器零 API 调用
- **API key 永远在 server 侧**：浏览器 bundle 不含任何 key
- **数据来源不暴露给最终用户**（只在内部文档说明）
- **国产 LLM 翻译用结构化 prompt**：保留英文公司名/产品名，避免历史 Qwen 翻车

## 许可

仅供个人学习研究使用。数据来自公开渠道，不构成投资建议。
