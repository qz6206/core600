"use client";

import Link from "next/link";
import StockList from "@/components/StockList";
import ThemeToggle from "@/components/ThemeToggle";
import LocaleToggle from "@/components/LocaleToggle";
import TimeDisplay from "@/components/TimeDisplay";
import Footer from "@/components/Footer";
import { Stock } from "@/lib/types";
import { useLocale } from "@/components/LocaleProvider";

export default function StocksPageContent({ stocks }: { stocks: Stock[] }) {
  const { t } = useLocale();

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50 dark:from-slate-950 dark:via-slate-900 dark:to-indigo-950 text-slate-900 dark:text-white transition-colors">
      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* 顶部工具栏 */}
        <div className="flex justify-between items-center mb-6">
          <TimeDisplay />
          <div className="flex items-center gap-2">
            <LocaleToggle />
            <ThemeToggle />
          </div>
        </div>

        {/* 顶部导航 */}
        <nav className="flex items-center justify-between mb-8">
          <Link href="/" className="flex items-center gap-3 hover:opacity-80 transition">
            <svg width="36" height="36" viewBox="0 0 60 60" xmlns="http://www.w3.org/2000/svg">
              <path d="M 12 12 L 48 12 L 48 17 L 17 17 L 17 43 L 48 43 L 48 48 L 12 48 Z" fill="#dc2626"/>
              <path d="M 17 28 L 48 28 L 48 48 L 43 48 L 43 33 L 17 33 Z" className="fill-slate-900 dark:fill-white"/>
            </svg>
            <span className="text-2xl font-bold bg-gradient-to-r from-slate-900 to-indigo-700 dark:from-white dark:to-indigo-300 bg-clip-text text-transparent">
              Core 600
            </span>
          </Link>
          <div className="flex items-center gap-4 text-sm">
            <Link
              href="/screener"
              className="text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition"
            >
              🔍 {t("筛选器")}
            </Link>
            <Link
              href="/"
              className="text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition"
            >
              ← {t("首页")}
            </Link>
          </div>
        </nav>

        {/* 标题 */}
        <div className="mb-8">
          <h1 className="text-3xl md:text-4xl font-bold mb-2">{t("股票列表")}</h1>
          <p className="text-slate-600 dark:text-slate-400">
            {t("美股核心 600 强 · 标普 500 + 纳斯达克 100 完整成分股")}
          </p>
        </div>

        <StockList stocks={stocks} />
      </div>
      <Footer />
    </main>
  );
}
