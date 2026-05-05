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
