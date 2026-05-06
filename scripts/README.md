# scripts/

Core 600 数据 pipeline 脚本。分两类：

- **Active**：被 GitHub Action workflow 周期调用，**不要删**
- **One-off**：历史一次性建库脚本，可保留也可归档

## Active 脚本（GitHub workflow 调用）

| 脚本 | 调用方 | 输出 | 频率 |
|------|--------|------|------|
| `fetch_stocks.py` | `update-stocks.yml` | `data/stocks.json` 主索引 | 周一 6:00 UTC |
| `fill_nasdaq_only.py` | `update-stocks.yml` | 补 Nasdaq 100 ticker 标记 | 周一 6:00 UTC |
| `verify_fmp.py` | `update-stocks.yml` | 与 FMP 交叉验证（输出 stats） | 周一 6:00 UTC |
| `check_changes.py` | `update-stocks.yml` | 检测成分股变化，写 `data/_changes.txt` | 周一 6:00 UTC |
| `fetch_edgar.py` | `update-edgar.yml` | `data/edgar_filings.json`（Form 4 + 8-K + 6-K）| 每 6 小时 |
| `fetch_13f.py` | `update-13f.yml` | `data/13f.json`（机构持仓 + Top 10）| 周一 6:30 UTC |
| `fetch_fmp_extras.py` | `update-fmp-extras.yml` | `data/fmp_extras.json`（分析师/财报/SBC/评级）| 每天 7:00 UTC |
| `fetch_polygon_options.py` | `update-options.yml` | `data/options.json`（期权快照 + ATM IV）| 每天 1:00 UTC |
| `translate_descriptions.py` | `update-translations.yml` | `data/descriptions_cn.json`（中文简介）| 周一 8:00 UTC |
| `translate_transcripts.py` | `update-translations.yml` | `data/transcripts.json`（中文财报会议）| 周一 8:00 UTC |

## 预案脚本（暂未启用，未来需要时跑）

| 脚本 | 触发条件 | 用途 |
|------|---------|------|
| `split_by_ticker.py` | transcripts.json > 80 MB / 仓库 > 3 GB / build > 5 min | 按 ticker 拆大 JSON 成单股票文件，绕开 GitHub 单文件 100 MB 限制 |

详细用法看脚本顶部 docstring。一键 `--dry-run` / `--apply` / `--verify` / `--rollback`。

## One-off 脚本（历史建库，已完成任务）

### 中文名修正（4 轮迭代）

| 脚本 | 用途 |
|------|------|
| `add_chinese_names.py` | 从 SEC company_tickers + Wikipedia 拉中文名（v1，已废弃）|
| `translate_names.py` | 第 1 轮 Qwen 翻译（错误率 14.5%，弃用）|
| `fetch_futu_chinese_names.py` | 从富途抓中文名（v2 主要数据源）|
| `fetch_futu_v2.py` | 富途二次重抓修补 v2 |
| `apply_chinese_name_fixes.py` | 应用人工筛选的修正 |
| `apply_futu_v3.py` | 应用富途 v3 数据 |
| `apply_v4_curated.py` | 第 4 轮多源交叉确认 |

→ 最终结果合并入 `data/stocks.json` 的 `name_cn` 字段，这些脚本不再调用。

### 一次性数据建库

| 脚本 | 用途 |
|------|------|
| `add_cik.py` | 给 `stocks.json` 加 `cik` 字段（一次性映射，跑过即完）|
| `patch_missing_data.py` | 主数据建库后期补漏（BF-B/BRK-B options + transcripts 失败重试）|
| `patch_sister_ratings.py` | BF-B/BRK-B/NWS 用姊妹股 (Class A) 评级数据 |
| `patch_brk_letter.py` | BRK-B 用巴菲特 / Greg Abel 年度致股东信代替 earnings call |

→ 这些已合并到产品中，不再周期调用，但保留供参考 / 灾难恢复。

## 添加新 active 脚本时

1. 写好 `scripts/fetch_xxx.py`
2. 加 `.github/workflows/update-xxx.yml`，包含：
   ```yaml
   concurrency:
     group: data-update
     cancel-in-progress: false
   ```
3. 在本 README 表格里加一行
4. （可选）在 `patch_missing_data.py` 加重试逻辑

## 共用 API key 约定

所有 active 脚本通过环境变量读 key：

- `FMP_API_KEY` — FMP Premium
- `POLYGON_API_KEY` — Polygon Options Starter
- `SILICONFLOW_API_KEY` — Kimi K2.5 翻译
- `EDGAR_USER_AGENT` — SEC EDGAR fair-access policy 要求真邮箱（如 `Core600 Research qz6206@gmail.com`）

本地用 `.env.local`（gitignored），CI 用 GitHub repo secrets。Vercel 部署不直接调外部 API（数据已预拉），但仍配置了 env vars 以备未来 API route 使用。
