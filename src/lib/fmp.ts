// FMP API 封装（仅在服务端使用，key 永远不进 client bundle）

const FMP_BASE = "https://financialmodelingprep.com/api";

function getKey(): string {
  const key = process.env.FMP_API_KEY;
  if (!key) {
    throw new Error("FMP_API_KEY 未设置（请在 Vercel 环境变量或 .env.local 中配置）");
  }
  return key;
}

async function fmpFetch<T = unknown>(path: string, version: "v3" | "v4" = "v3"): Promise<T> {
  const sep = path.includes("?") ? "&" : "?";
  const url = `${FMP_BASE}/${version}/${path}${sep}apikey=${getKey()}`;
  const res = await fetch(url, {
    headers: { "User-Agent": "Core600/0.1" },
    // ISR：30 分钟缓存（财务数据更新不频繁）
    next: { revalidate: 1800 },
  });
  if (!res.ok) {
    throw new Error(`FMP ${path} → ${res.status}`);
  }
  return res.json();
}

// === 类型定义 ===

export interface FMPProfile {
  symbol: string;
  price: number;
  beta: number;
  volAvg: number;
  mktCap: number;
  range: string;
  changes: number;
  companyName: string;
  industry: string;
  website: string;
  description: string;
  ceo: string;
  sector: string;
  country: string;
  fullTimeEmployees: string;
  ipoDate: string;
  image: string;
}

export interface FMPQuote {
  symbol: string;
  name: string;
  price: number;
  changesPercentage: number;
  change: number;
  dayLow: number;
  dayHigh: number;
  yearHigh: number;
  yearLow: number;
  marketCap: number;
  priceAvg50: number;
  priceAvg200: number;
  volume: number;
  avgVolume: number;
  open: number;
  previousClose: number;
  eps: number;
  pe: number;
  earningsAnnouncement: string;
  sharesOutstanding: number;
}

export interface FMPIncomeQuarter {
  date: string;
  symbol: string;
  calendarYear: string;
  period: string;
  revenue: number;
  grossProfit: number;
  grossProfitRatio: number;
  operatingIncome: number;
  operatingIncomeRatio: number;
  netIncome: number;
  netIncomeRatio: number;
  eps: number;
  epsdiluted: number;
}

// === 13F (机构持仓) 类型 ===

export interface Inst13FSummary {
  date: string | null;                      // 季度截止日（如 "2025-12-31"）
  investorsHolding: number | null;          // 持仓机构数
  investorsHoldingChange: number | null;    // 季度环比变化
  numberOf13Fshares: number | null;         // 13F 申报机构合计持股
  numberOf13FsharesChange: number | null;
  totalInvested: number | null;             // 13F 机构合计市值（USD）
  ownershipPercent: number | null;          // 13F 机构合计占股本 %
  ownershipPercentChange: number | null;
  newPositions: number | null;              // 新进
  increasedPositions: number | null;        // 加仓
  closedPositions: number | null;           // 清仓
  reducedPositions: number | null;          // 减仓
}

export interface Inst13FHolder {
  investorName: string;
  cik: string | null;
  sharesNumber: number | null;
  lastSharesNumber: number | null;
  changeInSharesNumber: number | null;
  changeInSharesNumberPercentage: number | null;
  ownership: number | null;                 // 占该股本 %
  weight: number | null;                    // 占该机构组合 %
  isNew: boolean | null;
  isSoldOut: boolean | null;
  holdingPeriod: number | null;             // 持有季度数
  firstAdded: string | null;                // 首次买入日期
}

export interface Inst13F {
  summary: Inst13FSummary;
  topHolders: Inst13FHolder[];
}

// === 分析师预期 / 财报日历 / 股本动态 类型（来自 fmp_extras.json）===

export interface AnalystEstimate {
  date: string | null;          // 季度结束日（如 "2026-12-28"）
  eps_avg: number | null;
  eps_low: number | null;
  eps_high: number | null;
  rev_avg: number | null;
  num_analysts: number | null;
}

export interface EarningRecord {
  date: string | null;          // 财报发布日
  eps_actual: number | null;    // null = 还没发
  eps_estimate: number | null;
  rev_actual: number | null;
  rev_estimate: number | null;
  time: string | null;          // "bmo" 盘前 / "amc" 盘后 / "-" 未知
  fiscal_period_end: string | null;
}

export interface CashFlowQuarter {
  date: string | null;
  period: string | null;        // Q1 / Q2 / Q3 / Q4
  calendar_year: string | null;
  sbc: number | null;            // 股权激励 (Stock-Based Compensation)
  ocf: number | null;            // 经营现金流
  fcf: number | null;            // 自由现金流
  buyback: number | null;        // 普通股回购（负数 = 实际回购）
  issuance: number | null;       // 普通股发行
}

export interface ShareCountQuarter {
  date: string | null;
  period: string | null;
  calendar_year: string | null;
  weighted_avg_diluted: number | null;
  weighted_avg_basic: number | null;
  net_income: number | null;
  revenue: number | null;
}

export interface RatingChange {
  date: string | null;
  company: string | null;       // 评级机构（如 "Morgan Stanley"）
  prev_grade: string | null;
  new_grade: string | null;
  action: string | null;        // initiate / upgrade / downgrade / hold
  target_price: number | null;  // 从新闻标题中解析的目标价
  title: string | null;
  source_class?: string;        // 来源标注（如 "来源：BRK-A（同公司另一类股）"）
}

export interface FMPExtras {
  estimates: AnalystEstimate[];
  earnings: EarningRecord[];
  sbc: CashFlowQuarter[];
  shares: ShareCountQuarter[];
  ratings: RatingChange[];
}

// === 期权异动 (Polygon) 类型 ===

export interface OptionsContract {
  ticker: string | null;        // OCC 合约代码（如 O:AAPL260506C00200000）
  type: "call" | "put" | null;
  strike: number | null;
  exp: string | null;            // 到期日 YYYY-MM-DD
  vol: number | null;            // 今日成交量
  oi: number | null;             // 未平仓量
  vol_oi_ratio: number | null;   // vol/oi，>2 通常视为异动
  iv: number | null;             // 隐波（小数，如 0.27 = 27%）
  delta: number | null;
  last_price: number | null;
  change_pct: number | null;     // 今日涨跌 %
}

// === 财报速评（来自 earnings_interpretations.json）===

/** 倾向标签（基本面改善 / 基本面恶化 等），与 ScenarioBadge 同色系 */
export interface InterpretationBadge {
  color: "green" | "amber" | "red" | "slate";
  label: string;
  hint: string;
}

/** 段 2: 业绩数据卡（实际 vs 预期 vs 同比） */
export interface InterpretationDataCard {
  eps_actual: number | null;
  eps_estimate: number | null;
  eps_surprise_pct: number | null;        // (actual - est) / |est| * 100
  rev_actual: number | null;
  rev_estimate: number | null;
  rev_surprise_pct: number | null;
  rev_yoy_pct: number | null;             // 同比
  rev_qoq_pct: number | null;             // 环比
  gross_margin: number | null;            // 0-1
  gross_margin_yoy_bps: number | null;    // 同比变化（基点 100 bps = 1%）
  net_margin: number | null;
  net_margin_yoy_bps: number | null;
}

/** 段 3: 基本面信号（4-6 条） */
export interface InterpretationFundamental {
  category: "earnings" | "growth" | "margin" | "insider" | "institutional" | "buyback" | "sbc";
  text: string;                           // 中文一句话（30-50 字）
  tone: "positive" | "neutral" | "negative";
}

/** 段 4: 市场反应 */
export interface InterpretationMarketReaction {
  atm_iv: number | null;
  iv_level: "high" | "medium" | "low" | null;
  put_call_ratio: number | null;
  pcr_label: "bullish" | "neutral" | "bearish" | null;
  ratings_30d: {
    upgrade: number;
    downgrade: number;
    initiate: number;
  } | null;
  form8k_30d: number;                     // 财报后 30 天内的 8-K 数量
}

/** 段 5: 管理层叙事（Opus 4.7 提炼） */
export interface InterpretationNarrativeTheme {
  title: string;                          // 主题（10-20 字）
  detail: string;                         // 详情（50-100 字）
}
export interface InterpretationNarrative {
  themes: InterpretationNarrativeTheme[]; // 通常 3 条
  tone: "confident" | "cautious" | "defensive";  // 整体语气
  tone_evidence: string;                  // 语气依据 (30-60 字)
  generated_by: string;                   // "opus-4.7"
  generated_at: string;                   // ISO timestamp
}

/** 财报速评单条记录 */
export interface EarningsInterpretation {
  ticker: string;
  fiscal_period_end: string;              // "2026-03-31"
  earnings_date: string;                  // 发布日 "2026-02-11"
  release_time: "bmo" | "amc" | null;     // 盘前 / 盘后
  fiscal_label: string;                   // "2026 Q1" / "FY2025"
  is_recent: boolean;                     // 90 天内 = true，否则 false
  result: "beat" | "miss" | "mixed" | "inline";
  generated_at: string;

  headline: string;                       // 段 1: 一句话标题
  data_card: InterpretationDataCard;      // 段 2
  fundamentals: InterpretationFundamental[];  // 段 3
  market_reaction: InterpretationMarketReaction;  // 段 4
  badges: InterpretationBadge[];          // 倾向标签

  narrative: InterpretationNarrative | null;     // 段 5
  narrative_status: "done" | "pending" | "no_transcript";
}

// === 财报会议中文 transcript（来自 transcripts.json）===

export interface TranscriptCN {
  year: number;
  quarter: number;              // 0 = 年度致股东信（如 BRK-B），1-4 = 季度财报
  date: string | null;          // e.g. "2025-05-28 17:00:00"
  content_cn: string;           // Kimi K2.5 翻译的中文全文
  content_en_chars?: number;    // 原文长度（参考）
  is_annual_letter?: boolean;   // true = 年度致股东信
  source_label?: string;        // UI 标题（如 "Berkshire 2025 年度致股东信"）
  source_url?: string;          // 原文链接
}

export interface OptionsActivity {
  spot: number | null;           // 标的现价（前一交易日收盘）
  atm_iv: number | null;         // ATM IV (DTE 14-45, OI≥100, 中位数)
  atm_iv_count: number | null;   // 计算 ATM IV 用了多少个候选合约
  total_vol: number | null;      // 今日全部合约总成交量
  call_vol: number | null;
  put_vol: number | null;
  put_call_ratio: number | null; // put_vol / call_vol，>1 看跌
  top_contracts: OptionsContract[];  // 今日成交量 Top 10
  active_count: number | null;   // 今日有交易的合约数
  total_chain_count: number | null;
}

// === 高层封装 ===

export async function getProfile(ticker: string): Promise<FMPProfile | null> {
  try {
    const data = await fmpFetch<FMPProfile[]>(`profile/${ticker}`);
    return data[0] || null;
  } catch {
    return null;
  }
}

export async function getQuote(ticker: string): Promise<FMPQuote | null> {
  try {
    const data = await fmpFetch<FMPQuote[]>(`quote/${ticker}`);
    return data[0] || null;
  } catch {
    return null;
  }
}

export async function getRecentQuarters(ticker: string, limit = 4): Promise<FMPIncomeQuarter[]> {
  try {
    return await fmpFetch<FMPIncomeQuarter[]>(`income-statement/${ticker}?period=quarter&limit=${limit}`);
  } catch {
    return [];
  }
}

// 一次性拉取个股详情页全部基础数据
export async function getStockOverview(ticker: string) {
  const [profile, quote, quarters] = await Promise.all([
    getProfile(ticker),
    getQuote(ticker),
    getRecentQuarters(ticker, 4),
  ]);
  return { profile, quote, quarters };
}
