// 全站统一的金融术语解释（Term 组件查 key 用）
//
// 添加规则：
// - key 是用户在 UI 上看到的原文（一般是英文缩写或术语）
// - value 是 { cn, en } 双语对象
//   * cn: 中文解释 (1-3 句, 不要超过 200 字)
//   * en: 英文解释 (matching length, professional finance language)
// - 涉及数字计算的术语,给一个例子

export interface GlossaryEntry {
  cn: string;
  en: string;
}

export const GLOSSARY: Record<string, GlossaryEntry> = {
  // ===== 股本相关 =====
  "SBC": {
    cn: "Stock-Based Compensation，股权激励。公司用股票/期权代替现金支付高管薪酬，账面记成「费用」。SBC 越多，股本被稀释越多，等于老股东每股缩水。\n\n示例：净利 10 亿、SBC 1.5 亿 → SBC/净利 = 15%。",
    en: "Stock-Based Compensation. Companies pay executives in stock/options instead of cash, recorded as an expense. More SBC = more share dilution = lower per-share earnings for existing holders.\n\nExample: Net Income $1B, SBC $150M → SBC/NI = 15%.",
  },
  "TTM": {
    cn: "Trailing Twelve Months，过去 12 个月（滚动 4 季）。比看单季更稳，能避免季节性扭曲（如 Apple Q1 旺季异常高）。",
    en: "Trailing Twelve Months (rolling 4 quarters). More stable than single-quarter view, smooths out seasonality (e.g. Apple's holiday Q1 spike).",
  },
  "摊薄股数": {
    cn: "Diluted Shares Outstanding。计算每股指标时用的股本数，包含所有未来可能转换为股票的：期权、RSU、可转债。比「基本股数」更保守。",
    en: "Diluted Shares Outstanding. Includes all potential future shares from options, RSUs, convertible bonds. More conservative than basic share count.",
  },
  "回购": {
    cn: "Stock Buyback。公司用现金从市场买回自家股票并注销，结果是股本减少 → 每股利润提高 → 利好股东。\n\n负数表示买入（减少股本），正数表示新发股票。",
    en: "Stock Buyback. Company uses cash to buy back its own shares from market and retire them. Result: fewer shares outstanding → higher EPS → bullish for shareholders.\n\nNegative = buyback (reduces share count); positive = new share issuance.",
  },
  "FCF": {
    cn: "Free Cash Flow，自由现金流 = 经营现金流 - 资本支出。剔除维持业务必需的开销后，公司真正可自由支配的现金。比净利润更难「做账」。",
    en: "Free Cash Flow = Operating Cash Flow - Capex. Cash truly available after necessary business spending. Harder to manipulate via accounting than net income.",
  },
  "OCF": {
    cn: "Operating Cash Flow，经营性现金流。主营业务带来的现金流入减流出，反映公司「造血能力」。",
    en: "Operating Cash Flow. Net cash from core operations. Reflects company's cash-generating ability from its main business.",
  },
  "Capex": {
    cn: "Capital Expenditures，资本开支。公司为了维持或扩张业务投入的固定资产钱（建厂房、买设备、买服务器）。\n\n公式：Capex = OCF − FCF。\n\nCapex 高 = 重资产 / 增长投入大；Capex 低 = 轻资产模型（如软件公司）。",
    en: "Capital Expenditures. Money spent on physical assets to maintain or expand the business (factories, equipment, servers).\n\nFormula: Capex = OCF − FCF.\n\nHigh Capex = capital-intensive / growth investment; Low Capex = capital-light (e.g. software).",
  },
  "FCF/营收": {
    cn: "FCF Margin，自由现金流率 = FCF ÷ 营收。每 1 美元营收里多少能变成自由现金流。\n\n判读：\n> 20%：优质资产（典型如 ADBE / Visa / MSFT）\n10-20%：健康\n5-10%：偏紧\n< 5%：现金流堪忧 / 重资产模型（如航空、零售）\n\n比净利率更「硬核」：已扣掉 Capex / 应收账款 / 库存堆积等会计技巧的影响。",
    en: "FCF Margin = FCF ÷ Revenue. How much of every $1 of revenue becomes free cash flow.\n\nGuide:\n> 20%: premium asset (e.g. ADBE / Visa / MSFT)\n10-20%: healthy\n5-10%: tight\n< 5%: cash flow concern / capital-heavy (airlines, retail)\n\nMore robust than net margin: already accounts for Capex / receivables / inventory tricks.",
  },

  // ===== Beat 质量评估 4 项 =====
  "GAAP Op Margin": {
    cn: "GAAP 运营利润率 = 营业利润 ÷ 营收，按美国通用会计准则（GAAP）严格计算，不剔除 SBC、并购摊销、重组费用等。\n\n用途：检测公司是否「靠 Adj/Non-GAAP 美化利润」。\n\n判读（科技股）：\n≥30%：高质量利润（NVDA / META / GOOGL 这类，GAAP 已经很漂亮，不需要靠 Adj 包装）\n10-30%：健康\n<10%：警惕「Adj 利润光鲜但 GAAP 微利甚至亏损」（典型如早期 SaaS、生物科技）\n\n例：APP Q1 GAAP Op Margin 78% — 几乎不靠 Adj 修饰。",
    en: "GAAP Operating Margin = Operating Income ÷ Revenue, strictly per GAAP rules. Does NOT exclude SBC, M&A amortization, restructuring costs.\n\nUse: detect if a company \"dresses up profits with Adj/Non-GAAP\".\n\nGuide (tech):\n≥30%: high-quality earnings (NVDA / META / GOOGL — GAAP already strong)\n10-30%: healthy\n<10%: caution — \"shiny Adj numbers but GAAP near-zero or losses\" (early SaaS, biotech)\n\nExample: APP Q1 GAAP Op Margin 78% — almost no Adj makeup.",
  },
  "OCF / 净利润": {
    cn: "现金流转化率 = 经营性现金流 ÷ 净利润。检测「账面利润是否真变成现金」。\n\n判读：\n≥100%：现金流 ≥ 利润，质量极优（Capex 后还有钱回购/分红）\n70-100%：健康\n<70%：警惕。可能原因：\n  • 应收账款激增（卖出去钱没收回来）\n  • 库存堆积（成本进了 NI 但没变现）\n  • 一次性会计利得（不产生现金）\n\n例：APP OCF/NI 119% — 现金创造能力远超账面利润。\n反例：早期 Tesla 一度 OCF/NI 长期低于 50%，说明利润主要靠会计调整。",
    en: "Cash Conversion Ratio = OCF ÷ Net Income. Detects whether \"book profit actually becomes cash\".\n\nGuide:\n≥100%: cash flow ≥ profit, premium quality (room for buybacks/dividends after Capex)\n70-100%: healthy\n<70%: caution. Possible causes:\n  • Receivables surging (sales not collected)\n  • Inventory pile-up (costs in NI but not realized)\n  • One-off accounting gains (no cash impact)\n\nExample: APP OCF/NI 119% — cash creation far exceeds book profit.\nCounter: early Tesla persistently below 50% — profits driven by accounting adjustments.",
  },
  "SBC / 营收": {
    cn: "股权激励占营收比 = 股票薪酬 ÷ 营收。SBC 是「真实成本」但记成非现金费用，会稀释老股东的每股利润。\n\n判读：\n<5%：低稀释（成熟蓝筹如 META / V / MA）\n5-10%：健康（NVDA Q4 ~5%）\n10-20%：偏高（典型成长 SaaS 如 SNOW / DDOG）\n>20%：高稀释（早期 SaaS / Crypto，账面亏损主要靠 SBC「省」现金）\n\n例：APP SBC/Rev 4.5% — 极轻稀释。",
    en: "SBC as % of Revenue = Stock Compensation ÷ Revenue. SBC is a real cost recorded as non-cash expense; dilutes existing shareholders' EPS.\n\nGuide:\n<5%: low dilution (mature blue chips: META / V / MA)\n5-10%: healthy (NVDA Q4 ~5%)\n10-20%: elevated (typical growth SaaS: SNOW / DDOG)\n>20%: high dilution (early SaaS / Crypto — book losses largely SBC-funded)\n\nExample: APP SBC/Rev 4.5% — very light dilution.",
  },
  "Capex 强度": {
    cn: "资本开支强度 = Capex ÷ 营收。每 1 美元营收里多少要烧回固定资产维持/扩张。\n\n判读：\n0%：纯软件平台（APP / ADBE — 服务器都是租云的）\n<5%：轻资产（V / MA / GOOGL）\n5-15%：中等（META / NVDA AI 投入加码）\n>15%：重资产 / 高烧钱（Tesla / 半导体晶圆 / 数据中心 hyperscaler / 航空 / 油气）\n\nAI 时代特别看：高 Capex 是「未来增长投入」还是「永续维持成本」？前者可接受，后者吃光 FCF。",
    en: "Capex Intensity = Capex ÷ Revenue. How much of each $1 revenue gets reinvested into fixed assets.\n\nGuide:\n0%: pure software (APP / ADBE — servers are rented cloud)\n<5%: capital-light (V / MA / GOOGL)\n5-15%: medium (META / NVDA AI build-out)\n>15%: capital-heavy (Tesla / semi fabs / hyperscaler datacenters / airlines / oil)\n\nIn the AI era, key question: is high Capex \"future growth investment\" or \"perpetual maintenance cost\"? Former is acceptable, latter eats FCF.",
  },

  // ===== 期权相关 =====
  "ATM IV": {
    cn: "At-The-Money Implied Volatility，平价隐含波动率。当行权价 ≈ 现价时，市场对该股未来波动幅度的预期（年化）。\n\n例：ATM IV 30% = 市场预期未来一年股价波动幅度约 ±30%。IV 高 = 市场紧张，IV 低 = 平静。",
    en: "At-The-Money Implied Volatility. When strike ≈ spot price, this is the market's expected annualized volatility for the underlying.\n\nExample: ATM IV 30% = market expects ±30% price swing over the next year. High IV = market nervousness, low IV = calm.",
  },
  "Put/Call": {
    cn: "Put/Call 量比 = 当日看跌期权成交量 ÷ 看涨期权成交量。\n\n< 0.7：看涨为主（多头情绪）\n0.7-1.0：中性\n> 1.0：看跌为主（空头情绪 / 对冲需求）",
    en: "Put/Call Volume Ratio = today's put volume ÷ call volume.\n\n< 0.7: bullish-dominant (long sentiment)\n0.7-1.0: neutral\n> 1.0: bearish-dominant (bear sentiment / hedging demand)",
  },
  "vol/OI": {
    cn: "今日成交量 / 未平仓量。> 2 = 当日新成交超过历史累积持仓 2 倍，通常是大单进场（可能是机构定向押注），属「异动」信号。",
    en: "Today's Volume / Open Interest. > 2 = today's flow exceeds historical position 2× — usually large block (potential institutional bet), an \"unusual flow\" signal.",
  },
  "DTE": {
    cn: "Days To Expiration，距到期天数。期权剩余生命。DTE 越短，时间价值衰减越快。\n\n短期投机喜欢 DTE 1-7 天，对冲喜欢 30-60 天。",
    en: "Days To Expiration. Remaining option life. Shorter DTE = faster theta decay.\n\nShort-term speculation favors DTE 1-7 days; hedging favors 30-60 days.",
  },
  "OI": {
    cn: "Open Interest，未平仓量。所有还活着的合约数量。流动性指标 — OI 太小（<100）时 IV 数据可能 stale。",
    en: "Open Interest. Total live contracts. A liquidity metric — when OI is too small (<100), IV data may be stale.",
  },
  "Greeks": {
    cn: "希腊字母，期权对各因素敏感度。Delta（标的涨 1 美元期权涨多少）、Gamma（Delta 变化率）、Theta（每天衰减多少）、Vega（IV 变化敏感度）。",
    en: "Greeks. Option sensitivities. Delta (option move per $1 underlying), Gamma (rate of Delta change), Theta (daily decay), Vega (IV sensitivity).",
  },

  // ===== 财报相关 =====
  "Beat": {
    cn: "实际业绩超过华尔街预期。如分析师预期 EPS $1.50，实际 $1.60 → Beat（差异 +6.7%）。",
    en: "Actual earnings exceed Wall Street consensus. E.g. analyst estimate EPS $1.50, actual $1.60 → Beat (+6.7%).",
  },
  "Miss": {
    cn: "实际业绩低于预期。差异通常 -3% 以上视为明显 miss。",
    en: "Actual earnings below estimate. Usually -3% or worse is considered a notable miss.",
  },
  "EPS": {
    cn: "Earnings Per Share，每股收益 = 净利润 ÷ 股本。最常用的盈利指标。\n\n注意：EPS 有两种口径：\n• GAAP EPS：法律口径，包含所有项目（含一次性损益、并购摊销等）\n• Reported / Adjusted EPS：公司公布的口径，通常剔除一次性项目，更反映持续经营能力\n\n两者差异越大，说明公司「调整项」越多，需要看明细判断合理性。",
    en: "Earnings Per Share = Net Income ÷ Share Count. The most common profitability metric.\n\nNote: EPS has two flavors:\n• GAAP EPS: legal definition, includes everything (one-time items, M&A amortization, etc)\n• Reported / Adjusted EPS: as published by company, usually excludes \"non-recurring\" items, reflects ongoing operations\n\nThe larger the gap between the two, the more \"adjustments\" the company makes — worth examining details.",
  },
  "GAAP EPS": {
    cn: "GAAP 准则下的摊薄每股收益 = GAAP 净利润 ÷ 摊薄股本。法律口径，不剔除任何项目（含并购摊销 / 重组费 / 一次性损益等）。\n\n例 AES Q4 2025: GAAP EPS $0.45 vs Reported EPS $0.81，差异主要来自非现金调整项（重资产公司常见）。\n\nGAAP EPS 更保守，适合判断长期盈利质量。",
    en: "Diluted EPS under GAAP rules = GAAP Net Income ÷ Diluted Shares. Legal-strict, excludes nothing (including M&A amortization, restructuring, one-time gains/losses).\n\nExample AES Q4 2025: GAAP EPS $0.45 vs Reported EPS $0.81 — gap mostly non-cash adjustments (common for capital-heavy companies).\n\nGAAP EPS is more conservative, suitable for assessing long-term earnings quality.",
  },
  "Reported EPS": {
    cn: "公司在财报中对外公布的「主口径」EPS，通常是 Adjusted / Non-GAAP，剔除了管理层认为「非持续」的项目（重组费、并购摊销、汇兑损益等）。\n\n华尔街预期 (consensus) 一般也是 Reported EPS 口径，所以「Beat 预期」的对比用这个数。\n\n例 AES Q4 2025: Reported EPS $0.81，Beat 预期 +30.65%。但 GAAP EPS 只有 $0.45，差异需关注。",
    en: "EPS as published by the company — usually Adjusted / Non-GAAP, excluding what management deems \"non-recurring\" (restructuring, M&A amortization, FX gains/losses, etc).\n\nWall Street consensus is also typically Reported EPS, so \"Beat\" comparisons use this number.\n\nExample AES Q4 2025: Reported EPS $0.81, Beat estimate +30.65%. But GAAP EPS only $0.45 — gap warrants attention.",
  },

  "财报披露日": {
    cn: "Earnings Release Date — 公司正式向 SEC 披露当季业绩的日期。来自数据源 (FMP) 的 earnings calendar。\n\n95%+ 的公司当天会同步发新闻稿 + 开 earnings call (电话会议)，所以这天 = 「财报日」。\n\n少数情况:\n• 公司把 10-K/10-Q 文件提交跟电话会议拆两天 (例 AES Q4 2025: 10-K 提交在 03-02，电话会议在 03-03)\n• 公司临时改期电话会议\n这些情况下「披露日」≠「电话会议日」。\n\n「盘前/盘后」标签指业绩公布的时段 (开盘前 / 收盘后)，是市场对该次财报反应的时间窗口。",
    en: "Earnings Release Date — when the company officially discloses quarterly results to SEC. Sourced from FMP's earnings calendar.\n\n95%+ of companies issue press release + hold earnings call same day, so this = \"earnings day\".\n\nEdge cases:\n• Some split 10-K/10-Q filing and earnings call into two days (e.g. AES Q4 2025: 10-K filed 03-02, call held 03-03)\n• Companies sometimes reschedule the call\nIn these cases, \"release date\" ≠ \"earnings call date\".\n\n\"Pre-market / After-hours\" tags indicate when results were announced (before open / after close), reflecting the market reaction window.",
  },
  "guidance": {
    cn: "公司管理层在财报后给的「业绩指引」，对下个季度/年度的预测。Guidance 上调通常比当季 Beat 更利好（说明前景好）。",
    en: "Management's earnings guidance — projection for next quarter/year given alongside earnings. Raised guidance usually more bullish than a current-quarter Beat (signals improving outlook).",
  },
  "盘前": {
    cn: "美东时间 4:00-9:30，正式开盘前的延长交易时段。流动性低，价格波动大。",
    en: "Pre-market: ET 4:00-9:30, extended trading before regular open. Low liquidity, high volatility.",
  },
  "盘后": {
    cn: "美东时间 16:00-20:00，正式收盘后的延长交易时段。财报通常在盘后发布。",
    en: "After-hours: ET 16:00-20:00, extended trading after regular close. Earnings often released here.",
  },
  "财年": {
    cn: "Fiscal Year，公司自定义的会计年度。如 Apple 财年 9 月底结束（Q1 = 10-12 月圣诞季），与日历年错开。",
    en: "Fiscal Year — company-defined accounting year. E.g. Apple's FY ends late September (Q1 = Oct-Dec holiday season), offset from calendar year.",
  },

  // ===== SEC 表单 =====
  "Form 4": {
    cn: "内部人交易申报表。SEC 要求：高管 / 董事 / 持股 ≥10% 的股东，每次买卖公司股票后必须在 2 个工作日内提交。",
    en: "Insider trading filing. SEC requires executives, directors, and 10%+ shareholders to file within 2 business days of any trade in company stock.",
  },
  "8-K": {
    cn: "美国上市公司发生重大事件时必交的公告。事件包括：高管变动、并购、业绩公告、重大合同等。截止日 = 事件后 4 个工作日。",
    en: "Required filing for material events: executive changes, M&A, earnings announcements, major contracts, etc. Due 4 business days after the event.",
  },
  "6-K": {
    cn: "外国发行人 (foreign private issuer) 用来代替 8-K 的报告。如 ASML、TSM、PDD 等 ADR 公司。",
    en: "Foreign private issuer's equivalent of 8-K. Used by ADR companies like ASML, TSM, PDD.",
  },
  "10-K": {
    cn: "美国上市公司年度财务报告（财年结束后 60-90 天内提交），最详细。",
    en: "Annual report (filed 60-90 days after fiscal year-end). The most comprehensive disclosure.",
  },
  "10-Q": {
    cn: "美国上市公司季度财务报告（季末 40-45 天内）。",
    en: "Quarterly report (filed 40-45 days after quarter-end).",
  },
  "13F": {
    cn: "管理资产 ≥1 亿美元的机构每季度必交，披露全部美股持仓。截止日 = 季末后 45 天。",
    en: "Required quarterly filing by institutions managing ≥$100M, disclosing all US equity positions. Due 45 days after quarter-end.",
  },
  "Item 5.02": {
    cn: "8-K 里的「高管/董事变动」事项编号。包含人事任免、薪酬协议变更等。",
    en: "8-K item code for executive/director changes. Includes appointments, departures, comp agreement updates.",
  },
  "Item 2.02": {
    cn: "8-K 里的「业绩公告」事项编号。季度财报通常以「2.02 + 9.01（财务报表附件）」申报。",
    en: "8-K item code for earnings announcements. Quarterly earnings usually filed under \"2.02 + 9.01 (financial statements exhibit)\".",
  },

  // ===== 机构持仓 =====
  "新进": {
    cn: "本季度首次买入这只股的机构数量（之前完全不持有 → 现在有了）。",
    en: "Number of institutions that newly opened a position this quarter (previously held none → now holding).",
  },
  "清仓": {
    cn: "本季度全部卖光的机构数量（之前持有 → 现在 0）。",
    en: "Number of institutions that fully closed their position this quarter (previously held → now zero).",
  },
  "持股比例": {
    cn: "13F 申报机构合计持有的股数 / 公司流通股。S&P 500 中位数约 70%，>90% 算「高度机构化」。",
    en: "Total 13F-filer holdings ÷ company float. S&P 500 median ~70%; >90% is considered \"highly institutional\".",
  },

  // ===== 分析师评级 =====
  "升级": {
    cn: "Upgrade，分析师把评级调高（如从 Hold 改 Buy）。",
    en: "Analyst upgrade — rating raised (e.g. Hold → Buy).",
  },
  "降级": {
    cn: "Downgrade，把评级调低。",
    en: "Analyst downgrade — rating lowered.",
  },
  "首次覆盖": {
    cn: "Initiate Coverage，分析师/机构第一次跟踪这家公司，发布初始评级和目标价。",
    en: "Initiate Coverage — analyst/firm starts tracking the company for the first time, issuing initial rating and target.",
  },
  "目标价": {
    cn: "Price Target，分析师认为未来 12 个月的合理股价。每家投行不同，平均值更可靠。",
    en: "Price Target — analyst's view of fair value over the next 12 months. Varies by firm; the average is more reliable.",
  },
};

/** 看 key 是否在 GLOSSARY 中（fail-safe） */
export function hasTerm(key: string): boolean {
  return key in GLOSSARY;
}
