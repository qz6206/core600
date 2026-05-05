import { notFound } from "next/navigation";
import { getStockOverview } from "@/lib/fmp";
import StockDetailContent from "@/components/StockDetailContent";
import stocksData from "../../../../data/stocks.json";
import type { StockData } from "@/lib/types";

// 动态路由参数类型（Next.js 16）
type Params = Promise<{ ticker: string }>;

// 静态生成 metadata
export async function generateMetadata({ params }: { params: Params }) {
  const { ticker } = await params;
  const upper = ticker.toUpperCase();
  const data = stocksData as StockData;
  const stock = data.stocks.find(s => s.ticker === upper);

  if (!stock) {
    return { title: `${upper} - Core 600` };
  }

  const cn = stock.name_cn || "";
  const en = stock.name;
  const title = cn ? `${upper} ${cn}（${en}）- Core 600` : `${upper} ${en} - Core 600`;
  return {
    title,
    description: `${upper} ${cn} ${en} | 财务数据、内部人交易、机构持仓、财报会议中文摘要`,
  };
}

// 列表里的所有股票预生成（516 个静态页面，SEO 友好）
export async function generateStaticParams() {
  const data = stocksData as StockData;
  return data.stocks.map(s => ({ ticker: s.ticker }));
}

export default async function StockDetailPage({ params }: { params: Params }) {
  const { ticker } = await params;
  const upper = ticker.toUpperCase();

  // 校验 ticker 在 600 强里
  const data = stocksData as StockData;
  const stock = data.stocks.find(s => s.ticker === upper);
  if (!stock) {
    notFound();
  }

  // 服务端拉取所有数据
  const overview = await getStockOverview(upper);

  return <StockDetailContent stock={stock} overview={overview} />;
}
