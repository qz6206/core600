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

// 行业对应的颜色（双主题）
export const SECTOR_COLORS: Record<string, string> = {
  "Information Technology": "bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-500/20 dark:text-blue-300 dark:border-blue-500/30",
  "Industrials": "bg-orange-100 text-orange-700 border-orange-200 dark:bg-orange-500/20 dark:text-orange-300 dark:border-orange-500/30",
  "Financials": "bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-500/20 dark:text-emerald-300 dark:border-emerald-500/30",
  "Health Care": "bg-rose-100 text-rose-700 border-rose-200 dark:bg-rose-500/20 dark:text-rose-300 dark:border-rose-500/30",
  "Consumer Discretionary": "bg-purple-100 text-purple-700 border-purple-200 dark:bg-purple-500/20 dark:text-purple-300 dark:border-purple-500/30",
  "Consumer Staples": "bg-yellow-100 text-yellow-700 border-yellow-200 dark:bg-yellow-500/20 dark:text-yellow-300 dark:border-yellow-500/30",
  "Communication Services": "bg-cyan-100 text-cyan-700 border-cyan-200 dark:bg-cyan-500/20 dark:text-cyan-300 dark:border-cyan-500/30",
  "Energy": "bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-500/20 dark:text-amber-300 dark:border-amber-500/30",
  "Utilities": "bg-teal-100 text-teal-700 border-teal-200 dark:bg-teal-500/20 dark:text-teal-300 dark:border-teal-500/30",
  "Real Estate": "bg-pink-100 text-pink-700 border-pink-200 dark:bg-pink-500/20 dark:text-pink-300 dark:border-pink-500/30",
  "Materials": "bg-indigo-100 text-indigo-700 border-indigo-200 dark:bg-indigo-500/20 dark:text-indigo-300 dark:border-indigo-500/30",
};
