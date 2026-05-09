import StocksPageContent from "@/components/StocksPageContent";
import stocksData from "../../../data/stocks.json";
import { StockData } from "@/lib/types";

export const metadata = {
  title: "Stocks — Core 600",
  description: "Full list of 516 stocks in S&P 500 + Nasdaq 100",
};

export default function StocksPage() {
  // Server component：在服务端读取 JSON，只把 stocks 数组传给 client
  // 避免 120KB 完整 JSON 进入 client bundle
  const data = stocksData as StockData;
  return <StocksPageContent stocks={data.stocks} />;
}
