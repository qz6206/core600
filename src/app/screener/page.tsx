import ScreenerContent from "@/components/ScreenerContent";
import stocksData from "../../../data/stocks.json";
import interpretationsData from "../../../data/earnings_interpretations.json";
import type { StockData } from "@/lib/types";
import type { EarningsInterpretation } from "@/lib/fmp";

export const metadata = {
  title: "股票筛选器 - Core 600",
  description: "按 Beat 历史 / 内部人 / 机构 / 估值等多维度筛选 516 只美股核心",
};

type InterpretationsByTicker = {
  by_ticker: Record<string, EarningsInterpretation>;
};

export default function ScreenerPage() {
  const data = stocksData as StockData;
  const interpretations = (interpretationsData as InterpretationsByTicker).by_ticker;

  // 把 interpretations + stocks 合并成 ScreenerStock 数组
  const rows = data.stocks.map(s => {
    const interp = interpretations[s.ticker] || null;
    return {
      ticker: s.ticker,
      name: s.name,
      name_cn: s.name_cn || null,
      sector: s.sector || null,
      industry: s.industry || null,
      in_sp500: s.in_sp500,
      in_nasdaq100: s.in_nasdaq100,
      interpretation: interp,
    };
  });

  return <ScreenerContent rows={rows} />;
}
