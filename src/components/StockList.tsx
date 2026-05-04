"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { Stock, SECTOR_CN, SECTOR_COLORS } from "@/lib/types";

type IndexFilter = "all" | "sp500" | "nasdaq100" | "both";

export default function StockList({ stocks }: { stocks: Stock[] }) {
  const [search, setSearch] = useState("");
  const [selectedSector, setSelectedSector] = useState<string>("all");
  const [indexFilter, setIndexFilter] = useState<IndexFilter>("all");

  const sectors = useMemo(() => {
    const counts: Record<string, number> = {};
    stocks.forEach((s) => {
      if (s.sector) counts[s.sector] = (counts[s.sector] || 0) + 1;
    });
    return Object.entries(counts).sort((a, b) => b[1] - a[1]);
  }, [stocks]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return stocks.filter((s) => {
      if (q && !s.ticker.toLowerCase().includes(q) && !s.name.toLowerCase().includes(q)) return false;
      if (selectedSector !== "all" && s.sector !== selectedSector) return false;
      if (indexFilter === "sp500" && !s.in_sp500) return false;
      if (indexFilter === "nasdaq100" && !s.in_nasdaq100) return false;
      if (indexFilter === "both" && !(s.in_sp500 && s.in_nasdaq100)) return false;
      return true;
    });
  }, [stocks, search, selectedSector, indexFilter]);

  return (
    <div>
      {/* 顶部统计 */}
      <div className="mb-6 grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="总数" value={stocks.length} accent="text-slate-900 dark:text-white" />
        <StatCard label="S&P 500" value={stocks.filter((s) => s.in_sp500).length} accent="text-emerald-600 dark:text-emerald-400" />
        <StatCard label="纳指 100" value={stocks.filter((s) => s.in_nasdaq100).length} accent="text-blue-600 dark:text-blue-400" />
        <StatCard label="两个都在" value={stocks.filter((s) => s.in_sp500 && s.in_nasdaq100).length} accent="text-purple-600 dark:text-purple-400" />
      </div>

      {/* 搜索框 */}
      <div className="mb-4">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="搜索股票代码或公司名（如 NVDA、Apple）..."
          className="w-full px-4 py-3 bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-lg text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-indigo-500/50 focus:bg-white dark:focus:bg-white/10 transition"
        />
      </div>

      {/* 索引筛选 */}
      <div className="mb-4 flex flex-wrap gap-2">
        <FilterPill active={indexFilter === "all"} onClick={() => setIndexFilter("all")}>全部</FilterPill>
        <FilterPill active={indexFilter === "sp500"} onClick={() => setIndexFilter("sp500")}>只看 S&P 500</FilterPill>
        <FilterPill active={indexFilter === "nasdaq100"} onClick={() => setIndexFilter("nasdaq100")}>只看纳指 100</FilterPill>
        <FilterPill active={indexFilter === "both"} onClick={() => setIndexFilter("both")}>两个都在</FilterPill>
      </div>

      {/* 行业筛选 */}
      <div className="mb-6 flex flex-wrap gap-2">
        <FilterPill active={selectedSector === "all"} onClick={() => setSelectedSector("all")}>全部行业</FilterPill>
        {sectors.map(([sector, count]) => (
          <FilterPill
            key={sector}
            active={selectedSector === sector}
            onClick={() => setSelectedSector(sector)}
          >
            {SECTOR_CN[sector] || sector} <span className="text-slate-400 dark:text-slate-500">({count})</span>
          </FilterPill>
        ))}
      </div>

      <div className="mb-4 text-sm text-slate-600 dark:text-slate-400">
        显示 <span className="text-slate-900 dark:text-white font-semibold">{filtered.length}</span> / {stocks.length} 只
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {filtered.map((s) => (
          <StockCard key={s.ticker} stock={s} />
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="text-center text-slate-500 py-12">
          没有找到符合条件的股票
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, accent }: { label: string; value: number; accent: string }) {
  return (
    <div className="p-4 bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-lg shadow-sm">
      <div className="text-sm text-slate-500 dark:text-slate-400 mb-1">{label}</div>
      <div className={`text-2xl font-bold ${accent}`}>{value}</div>
    </div>
  );
}

function FilterPill({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1.5 rounded-full text-sm border transition ${
        active
          ? "bg-indigo-600 border-indigo-600 text-white dark:bg-indigo-500/30 dark:border-indigo-400/50"
          : "bg-white dark:bg-white/5 border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/10"
      }`}
    >
      {children}
    </button>
  );
}

function StockCard({ stock }: { stock: Stock }) {
  const sectorColor = SECTOR_COLORS[stock.sector] || "bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-500/20 dark:text-slate-300 dark:border-slate-500/30";

  return (
    <Link
      href={`/stocks/${stock.ticker}`}
      className="block p-4 bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-lg hover:bg-slate-50 dark:hover:bg-white/10 hover:border-slate-300 dark:hover:border-white/20 transition group shadow-sm"
    >
      <div className="flex items-start justify-between mb-2">
        <div>
          <div className="text-lg font-bold text-slate-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-300 transition">
            {stock.ticker}
          </div>
          <div className="text-sm text-slate-600 dark:text-slate-400 line-clamp-1">{stock.name}</div>
        </div>
        <div className="flex flex-col gap-1">
          {stock.in_sp500 && (
            <span className="px-2 py-0.5 text-xs bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300 rounded">
              S&P
            </span>
          )}
          {stock.in_nasdaq100 && (
            <span className="px-2 py-0.5 text-xs bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300 rounded">
              NDX
            </span>
          )}
        </div>
      </div>
      {stock.sector && (
        <span className={`inline-block px-2 py-0.5 text-xs rounded border ${sectorColor}`}>
          {SECTOR_CN[stock.sector] || stock.sector}
        </span>
      )}
    </Link>
  );
}
