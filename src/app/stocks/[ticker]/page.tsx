import { notFound } from "next/navigation";
import { getStockOverview } from "@/lib/fmp";
import StockDetailContent from "@/components/StockDetailContent";
import stocksData from "../../../../data/stocks.json";
import edgarData from "../../../../data/edgar_filings.json";
import inst13fData from "../../../../data/13f.json";
import fmpExtrasData from "../../../../data/fmp_extras.json";
import optionsData from "../../../../data/options.json";
import descriptionsCnData from "../../../../data/descriptions_cn.json";
import transcriptsData from "../../../../data/transcripts.json";
import type { StockData } from "@/lib/types";
import type { EdgarFiling } from "@/lib/edgar";
import type { Inst13F, FMPExtras, OptionsActivity, TranscriptCN } from "@/lib/fmp";

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

// 类型化的静态数据访问器
type EdgarFilingsByTicker = {
  by_ticker: Record<string, { form4: EdgarFiling[]; form8k: EdgarFiling[]; form6k?: EdgarFiling[] }>;
};
type Inst13FByTicker = {
  by_ticker: Record<string, Inst13F>;
};
type FMPExtrasByTicker = {
  by_ticker: Record<string, FMPExtras>;
};
type OptionsByTicker = {
  by_ticker: Record<string, OptionsActivity>;
};
type DescriptionsCNByTicker = {
  by_ticker: Record<string, string>;
};
type TranscriptsByTicker = {
  by_ticker: Record<string, TranscriptCN>;
};

export default async function StockDetailPage({ params }: { params: Params }) {
  const { ticker } = await params;
  const upper = ticker.toUpperCase();

  // 校验 ticker 在 600 强里
  const data = stocksData as StockData;
  const stock = data.stocks.find(s => s.ticker === upper);
  if (!stock) {
    notFound();
  }

  // FMP 数据实时拉（30 分钟 ISR）
  const overview = await getStockOverview(upper);

  // 静态预拉数据（构建瞬间完成，无 API 调用）
  // 数据源：scripts/fetch_edgar.py（每 6 小时）+ scripts/fetch_13f.py（每周）
  const edgarFilings = (edgarData as EdgarFilingsByTicker).by_ticker[upper];
  const form4 = edgarFilings?.form4 || [];
  const form8k = edgarFilings?.form8k || [];
  const form6k = edgarFilings?.form6k || [];
  const inst13f = (inst13fData as Inst13FByTicker).by_ticker[upper] || null;
  const fmpExtras = (fmpExtrasData as FMPExtrasByTicker).by_ticker[upper] || null;
  const options = (optionsData as OptionsByTicker).by_ticker[upper] || null;
  const descriptionCn = (descriptionsCnData as DescriptionsCNByTicker).by_ticker[upper] || null;
  const transcript = (transcriptsData as TranscriptsByTicker).by_ticker[upper] || null;

  return (
    <StockDetailContent
      stock={stock}
      overview={overview}
      form4={form4}
      form8k={form8k}
      form6k={form6k}
      inst13f={inst13f}
      fmpExtras={fmpExtras}
      options={options}
      descriptionCn={descriptionCn}
      transcript={transcript}
    />
  );
}
