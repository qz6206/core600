import Link from "next/link";
import StockList from "@/components/StockList";
import stocksData from "../../../data/stocks.json";
import { StockData } from "@/lib/types";

export const metadata = {
  title: "股票列表 - Core 600",
  description: "美股核心600强：标普500 + 纳斯达克100 完整成分股列表",
};

export default function StocksPage() {
  const data = stocksData as StockData;

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 text-white">
      <div className="max-w-7xl mx-auto px-6 py-12">
        {/* 顶部导航 */}
        <nav className="flex items-center justify-between mb-10">
          <Link href="/" className="flex items-center gap-3 hover:opacity-80 transition">
            <svg width="36" height="36" viewBox="0 0 60 60" xmlns="http://www.w3.org/2000/svg">
              <path d="M 12 12 L 48 12 L 48 17 L 17 17 L 17 43 L 48 43 L 48 48 L 12 48 Z" fill="#dc2626"/>
              <path d="M 17 28 L 48 28 L 48 48 L 43 48 L 43 33 L 17 33 Z" fill="#ffffff"/>
            </svg>
            <span className="text-2xl font-bold bg-gradient-to-r from-white to-indigo-300 bg-clip-text text-transparent">
              Core 600
            </span>
          </Link>
          <Link
            href="/"
            className="text-sm text-slate-400 hover:text-white transition"
          >
            ← 首页
          </Link>
        </nav>

        {/* 标题 */}
        <div className="mb-8">
          <h1 className="text-3xl md:text-4xl font-bold mb-2">股票列表</h1>
          <p className="text-slate-400">
            美股核心 600 强 · 标普 500 + 纳斯达克 100 完整成分股
          </p>
          <div className="text-xs text-slate-500 mt-1">
            数据来源：Wikipedia + FMP 交叉验证 · 每周一自动更新
          </div>
        </div>

        {/* 股票列表（带筛选） */}
        <StockList stocks={data.stocks} />
      </div>
    </main>
  );
}
