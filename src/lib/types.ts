export interface Stock {
  ticker: string;
  name: string;
  sector: string;
  industry: string;
  in_sp500: boolean;
  in_nasdaq100: boolean;
}

export interface StockData {
  version: string;
  source: string;
  total: number;
  stocks: Stock[];
}

// 行业的中文翻译
export const SECTOR_CN: Record<string, string> = {
  "Information Technology": "科技",
  "Industrials": "工业",
  "Financials": "金融",
  "Health Care": "医疗",
  "Consumer Discretionary": "非必需消费",
  "Consumer Staples": "必需消费",
  "Communication Services": "通讯",
  "Energy": "能源",
  "Utilities": "公用事业",
  "Real Estate": "房地产",
  "Materials": "材料",
};

// 行业对应的颜色（Tailwind class）
export const SECTOR_COLORS: Record<string, string> = {
  "Information Technology": "bg-blue-500/20 text-blue-300 border-blue-500/30",
  "Industrials": "bg-orange-500/20 text-orange-300 border-orange-500/30",
  "Financials": "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
  "Health Care": "bg-rose-500/20 text-rose-300 border-rose-500/30",
  "Consumer Discretionary": "bg-purple-500/20 text-purple-300 border-purple-500/30",
  "Consumer Staples": "bg-yellow-500/20 text-yellow-300 border-yellow-500/30",
  "Communication Services": "bg-cyan-500/20 text-cyan-300 border-cyan-500/30",
  "Energy": "bg-amber-500/20 text-amber-300 border-amber-500/30",
  "Utilities": "bg-teal-500/20 text-teal-300 border-teal-500/30",
  "Real Estate": "bg-pink-500/20 text-pink-300 border-pink-500/30",
  "Materials": "bg-indigo-500/20 text-indigo-300 border-indigo-500/30",
};
