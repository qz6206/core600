/**
 * 中 → 英 翻译字典 (246 条)
 *
 * 用法: LocaleProvider.t() 在 locale=en 时查这个字典,
 *       查不到就 fallback 原中文 (容错)
 *
 * 维护规则:
 * - key 是源代码里 t("xxx") 的中文原文
 * - value 是英文翻译, 风格简洁专业 (财经术语优先用行业标准用法)
 * - 新增 t() 调用时同步加进来
 */
export const T_EN: Record<string, string> = {
  // ===== 数字 / 时间 / 单位 =====
  ",": ",",
  "\n": "\n",
  "hour": "hour",
  "minute": "minute",
  "weekday": "weekday",
  "今天": "Today",
  "明天": "Tomorrow",
  "后天": "In 2 days",
  "下周": "Next week",
  "天后": "days later",
  "周后": "weeks later",
  "个月后": "months later",
  "近 7 天": "Last 7 days",
  "最近": "Recent",
  "最近 4 个季度": "Last 4 quarters",
  "最近 4 次财报": "Last 4 earnings",
  "天内暂无财报记录": " days no earnings scheduled",
  "未来": "Upcoming",
  "下次财报": "Next earnings",
  "下次财报 + 过去 8 次记录": "Next earnings + past 8 quarters",
  "刚发布的财报": "Recently released",
  "财报日±30 天": "±30 days of earnings",
  "财报后 30 天 ": "30 days post-earnings ",
  "北京": "Beijing",
  "美东": "ET",
  "份": " filings",
  "条": " items",
  "笔": " trades",
  "字": " chars",
  "字符": " chars",
  "只": " stocks",
  "个候选": " candidates",
  "条异动": " unusual flows",

  // ===== 财务概览 / 指标名 =====
  "财务概览": "Financial Overview",
  "指标": "Metric",
  "营收": "Revenue",
  "营收同比": "Revenue YoY",
  "营收环比": "Revenue QoQ",
  "营收预期": "Rev. estimate",
  "毛利率": "Gross Margin",
  "营业利润率": "Operating Margin",
  "净利": "Net Income",
  "净利率": "Net Margin",
  "GAAP EPS": "GAAP EPS",
  "摊薄": "Diluted",
  "摊薄股数": "Diluted Share Count",
  "稀释": "Dilution",
  "自由现金流": "Free Cash Flow",
  "资本开支": "Capex",
  "回购": "Buyback",
  "股本动态": "Capital Dynamics",
  "TTM": "TTM",
  "PE": "P/E",
  "市值": "Market Cap",
  "现价": "Price",
  "前一交易日收盘": "Previous close",
  "52周区间": "52-week range",
  "成交量": "Volume",
  "均量": "Avg Volume",
  "涨跌": "Change",
  "同比": "YoY",
  "环比": "QoQ",
  "季": " Q",
  "季度": "Quarter",
  "季度变化": "QoQ change",
  "季度结束": "Quarter end",
  "财年": "FY",
  "财季": "Fiscal quarter",
  "整体语气": "Tone",

  // ===== EQR 财报点评 =====
  "财报点评": "Earnings Review",
  "财报点评 EQR": "Earnings Review (EQR)",
  "业绩数据": "Performance",
  "实际": "Actual",
  "预期": "Estimate",
  "差异": "Surprise",
  "EPS 差异": "EPS surprise",
  "Reported EPS": "Reported EPS",
  "公司公布": "as reported",
  "vs 共识": "vs consensus",
  "关键 KPI": "Key KPIs",
  "Beat 质量评估": "Beat Quality",
  "管理层指引": "Management Guidance",
  "指引区间": "Guidance range",
  "管理层叙事": "Management Commentary",
  "基于电话会议中文 transcript 提炼": "Extracted from earnings call transcript",
  "本速评基于公开数据自动生成，仅作信息参考，不构成投资建议。决策请以原始财报、官方公告及独立研究为准。":
    "This summary is auto-generated from public data, for reference only and not investment advice. Refer to official filings and independent research for decisions.",
  "基本面信号": "Fundamental signals",
  "基本面健康度": "Fundamental health",
  "市场反应": "Market reaction",
  "评级 30 天": "Ratings (30d)",
  "最近评级变动": "Recent ratings",
  "综合评级": "Overall rating",
  "查看点评": "View review",
  "点击查看完整 EQR 财报点评": "Click for full earnings review",
  "暂无财报点评数据": "No earnings review",
  "最近一次财报已超 90 天，本节略": "Last earnings > 90 days ago, hidden",

  // ===== 警示 / 状态 =====
  "部分数据状态": "Data status",
  "现金流 + 叙事均待补齐": "Cash flow + narrative pending",
  "现金流数据滞后": "Cash flow data lagging",
  "现金流数据(KPI / Beat 质量 / 健康度)未对齐当季,等待数据源同步,通常 1-7 天内自动补齐。":
    "Cash flow data (KPIs / Beat quality / Health) not yet aligned to current quarter; data source typically catches up within 1-7 days.",
  "等待当季 transcript": "Awaiting current-quarter transcript",
  "数据源暂无 transcript": "Transcript not in data source",
  "无电话会议": "No earnings call",
  "无显著买卖": "No notable trading",
  "无重大事项": "No material events",
  "已对齐": "aligned",
  "完整": "Complete",
  "叙事生成中": "Narrative generating",
  "生成中…": "Generating…",
  "解析中": "Parsing",
  "未公布": "Not yet released",
  "已过滤": "Filtered",
  "暂无中文摘要,详见 SEC 原文": "No Chinese summary, see SEC original",
  "常规公告（业绩公告 / 财务表 等），详见原文": "Routine filing (earnings / financials), see original",
  "当季电话会议中文翻译尚未刷新(数据源通常在新财报后 1-2 周更新),管理层叙事段落自动等待最新一季 transcript。":
    "Current-quarter transcript translation not yet refreshed (data source typically updates 1-2 weeks after earnings); management commentary section will auto-update once new transcript arrives.",
  "当季电话会议在我们使用的数据源(FMP)中暂未收录(可能因数据源版权限制),管理层叙事段落不展示。如需查阅原文,可前往":
    "Current-quarter transcript not yet in our data source (FMP, possibly due to licensing); management commentary not shown. For original transcript, visit",
  "查看公司 8-K 公告,或在 Seeking Alpha / 公司 IR 网站查阅完整 transcript。":
    "to view 8-K filings, or check Seeking Alpha / company IR for the full transcript.",
  "以下是上一季": "Below is last quarter",
  "的电话会议(对应当前财报点评的": " earnings call (the current quarter's",
  "的电话会议(财报点评对应的": " earnings call (the current review's",
  "上一季": "previous quarter",
  "中文翻译尚未发布,通常在新财报发布后 1-2 周内由数据源刷新。":
    " Chinese translation not yet released, typically refreshed 1-2 weeks after earnings.",
  "在我们使用的数据源中暂未收录,可能因数据源版权限制)。如需当季原文,可前往":
    " not yet in our data source, possibly due to licensing. For the original, visit",
  "或公司 IR 网站查阅。": "or company IR.",

  // ===== 财报会议 transcript =====
  "财报会议": "Earnings Call",
  "电话会议": "Earnings Call",
  "中文": "Chinese",
  "中文全文": "Full Chinese transcript",
  "中文翻译": "Chinese translation",
  "中文摘要": "Chinese summary",
  "中文翻译，仅供参考。投资决策请以英文原文及官方文件为准": "Chinese translation, for reference only. Refer to original English transcript and official filings for decisions",
  "英文原文": "English original",
  "英文原文 PDF": "English PDF",
  "展开全文": "Expand full text",
  "展开全部": "Expand all",
  "收起": "Collapse",
  "年度致股东信": "Annual letter to shareholders",
  "此股票暂无财报会议记录": "No earnings call records",

  // ===== 财报日历 =====
  "财报日历": "Earnings Calendar",
  "Core 600 即将发布的财报,按时间排序": "Upcoming earnings for Core 600, sorted by date",
  "时段": "Session",
  "盘前": "Pre-market",
  "盘后": "After-hours",
  "公司": "Company",
  "发布日": "Release date",
  "暂无财报日历数据": "No earnings calendar data",

  // ===== 分析师 / 评级 =====
  "分析师预期": "Analyst Estimates",
  "暂无分析师预期数据": "No analyst estimates data",
  "看涨": "Bullish",
  "看跌": "Bearish",
  "中性": "Neutral",
  "自信": "Confident",
  "谨慎": "Cautious",
  "防御": "Defensive",

  // ===== 8-K / 公司事件 =====
  "公司重大事项": "Material Events (8-K)",
  "外国发行人公告": "Foreign Private Issuer Filing",
  "事件": "Event",
  "是公司在出现重大事项后 4 个工作日内必须申报的公告（如高管变动、并购、业绩预告等）":
    "Required filing within 4 business days of material events (e.g. exec changes, M&A, earnings announcements)",
  "是外国发行人 (foreign private issuer) 用来替代 8-K 的报告，发生重大事件时申报":
    "Used by foreign private issuers in place of 8-K when material events occur",
  "最近无 8-K / 6-K 公告": "No recent 8-K / 6-K filings",
  "摘要生成中…": "Summary generating…",

  // ===== 内部人 Form 4 =====
  "内部人交易": "Insider Trading",
  "内部人 = 公司高管 / 董事 / 10% 以上股东，必须在交易后 2 个工作日内申报":
    "Insiders = executives / directors / 10%+ shareholders, must file within 2 business days of trade",
  "内部人": "Insider",
  "高管": "Executive",
  "董事": "Director",
  "10%+ 股东": "10%+ shareholder",
  "买入/获得": "Buy/Acquire",
  "卖出/处置": "Sell/Dispose",
  "动作": "Action",
  "股数": "Shares",
  "金额": "Value",
  "价格": "Price",
  "占股本": "% of shares",
  "「+N」表示同一申报含多笔交易": "「+N」means same filing contains multiple trades",
  "最近无内部人 Form 4 申报": "No recent Form 4 filings",
  "此股票暂无 SEC CIK 映射": "No SEC CIK mapping for this stock",

  // ===== 13F 机构 =====
  "机构持仓": "Institutional Holdings",
  "机构持仓 13F": "13F Institutional",
  "13F 持股": "13F holdings",
  "持仓机构": "Institutions",
  "持股数": "Shares held",
  "已持": "Held",
  "新进": "New positions",
  "清仓": "Closed positions",
  "机构": "Institutions",
  "总数": "Total",
  "流通股": "Float",
  "由管理资产 ≥1 亿美元的机构每季度申报，截止后 45 天内披露。本表按持股占比排序":
    "Filed quarterly by institutions with ≥$100M AUM, due 45 days after quarter end. Sorted by holding %",
  "暂无 13F 机构持仓数据": "No 13F data",

  // ===== 期权异动 =====
  "期权异动": "Options Activity",
  "聪明钱大单监控": "Smart-money flow monitor",
  "今日成交量 Top 10 合约": "Today's top 10 by volume",
  "今日总成交": "Today's total volume",
  "未平仓": "Open Interest",
  "量比": "vol/OI",
  "行权价": "Strike",
  "到期": "Expiry",
  "方向": "Side",
  "≥ 2 标橙底 = 当日成交量超过历史未平仓量 2 倍，属异动": "≥ 2 highlighted = volume 2× open interest, unusual flow",
  "暂无期权异动数据": "No options activity data",

  // ===== 股本动态 / 回购 =====
  "暂无股本动态数据": "No capital dynamics data",
  "+ 异常值（防 stale 数据）": "+ outlier check (stale data guard)",
  " 占净利润 ≥30% 视为高稀释，≤10% 为低稀释": " ≥30% of net income = high dilution, ≤10% = low",
  " 减少 = 回购大于股权激励发行；": " decrease = buybacks > equity issuance;",
  "两个都在": "Both included",
  "显示": "Show",
  "只看 S&P 500": "S&P 500 only",
  "只看纳指 100": "Nasdaq 100 only",
  "全部": "All",
  "全部行业": "All sectors",
  "纳指 100": "Nasdaq 100",

  // ===== 公司简介 =====
  "公司简介": "About",
  "官方网站": "Website",
  "文档": "Docs",

  // ===== 首页 / nav =====
  "美股核心 600 强 · 一站式数据中心": "S&P 500 + Nasdaq 100 · One-stop research hub",
  "美股核心 600 强 · 标普 500 + Nasdaq 100 完整成分股": "Core 600 — Full S&P 500 + Nasdaq 100 constituents",
  "美股核心 600 强 · 标普 500 + 纳斯达克 100 完整成分股": "Core 600 — Full S&P 500 + Nasdaq 100 constituents",
  "标普 500 + 纳斯达克 100 · 中文用户专属": "S&P 500 + Nasdaq 100 · Built for global investors",
  "查看 516 只股票列表": "Browse all 516 stocks",
  "点击下方功能卡片，跳转": "Click any feature card to see ",
  "看示范效果": " in action",
  "首页": "Home",
  "股票列表": "Stocks",

  // ===== 关注 =====
  "我的关注": "Watchlist",
  "加入关注": "Add to watchlist",
  "取消关注": "Remove from watchlist",
  "已关注 · 点击取消": "Watching · click to remove",

  // ===== 搜索 / 筛选 =====
  "搜索股票代码、英文名或中文名（如 NVDA、英伟达）...": "Search ticker, English or Chinese name (e.g. NVDA, Apple)...",
  "没有找到符合条件的股票": "No stocks match",
  "还有": "and",

  // ===== FiscalAnchorBar =====
  "当季焦点": "Current focus",
  "查看各 section 数据状态": "View per-section data status",
  "场景": "Status",

  // ===== Footer =====
  "免责声明": "Disclaimer",
  "数据来自公开渠道,仅供研究参考,不构成投资建议": "Data from public sources, for research reference only, not investment advice",
  "数据来自公开渠道,仅供研究参考,不构成投资建议。投资有风险,决策需谨慎。":
    "Data from public sources, for research reference only, not investment advice. Investing involves risk; please proceed with caution.",
  "敬请期待": "Coming soon",
  "申报日": "Filed",
  "点": "Click ",
  "点击": "Click",
  "看": "to see ",
  "点评": "Review",
  "点击 SEC → 看完整原文": "Click SEC → for original",

  // ===== Term tooltip =====
  "术语解释": "Term definition",

  // ===== Sectors (GICS 11 个) =====
  "科技": "Technology",
  "工业": "Industrials",
  "金融": "Financials",
  "医疗": "Health Care",
  "非必需消费": "Consumer Discretionary",
  "必需消费": "Consumer Staples",
  "通讯": "Communication",
  "能源": "Energy",
  "公用事业": "Utilities",
  "房地产": "Real Estate",
  "材料": "Materials",
  "All sectors": "All sectors",

  // ===== 首页 features =====
  "中文全文翻译": "Full transcript translation",
  "自动解读 + 倾向标签": "Auto analysis + sentiment tags",
  "下次财报 + 历史发布日": "Next earnings + history",
  "Beat 历史 + 评级变动": "Beat history + rating changes",
  "8-K 公司重大事项": "8-K Material Events",
  "中文化摘要时间线": "Chinese summary timeline",
  "高管买卖动向追踪": "Executive trading activity",
  "回购 + SBC 稀释追踪": "Buyback + SBC dilution",
  "13F 明星基金动态": "13F top funds",
  "ATM IV + 聪明钱大单": "ATM IV + smart-money flows",

  // ===== 个股详情页 quote 区 =====
  "50日均价": "50-day MA",
  "200日均价": "200-day MA",
  "Volume": "Volume",
  "Avg Volume": "Avg Volume",

  // ===== EQR result labels =====
  "✅ 超预期": "✅ Beat",
  "❌ 未达预期": "❌ Miss",
  "⚠️ 喜忧参半": "⚠️ Mixed",
  "= 符合预期": "= In line",
  "Current focus": "Current focus",

  // ===== Stocks 列表页 =====
  "Total": "Total",
  "Both included": "Both included",
  "Watchlist": "Watchlist",
  "S&P 500 only": "S&P 500 only",
  "Nasdaq 100 only": "Nasdaq 100 only",

  // ===== Earnings Calendar 页 =====
  "Upcoming": "Upcoming",
  "stocks": "stocks",
  "Today": "Today",
  "days later": "days later",

  // ===== Misc =====
  "Retry-After": "Retry-After",
};
