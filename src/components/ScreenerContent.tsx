"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import ThemeToggle from "@/components/ThemeToggle";
import LocaleToggle from "@/components/LocaleToggle";
import TimeDisplay from "@/components/TimeDisplay";
import Footer from "@/components/Footer";
import WatchlistStar from "@/components/WatchlistStar";
import { useLocale } from "@/components/LocaleProvider";
import { SECTOR_CN } from "@/lib/types";
import { readWatchlist } from "@/lib/watchlist";
import type { EarningsInterpretation } from "@/lib/fmp";

export type ScreenerStock = {
  ticker: string;
  name: string;
  name_cn: string | null;
  sector: string | null;
  industry: string | null;
  in_sp500: boolean;
  in_nasdaq100: boolean;
  interpretation: EarningsInterpretation | null;
};

type ResultType = "beat" | "miss" | "mixed" | "inline";

const ALL_BADGES = [
  // 业绩
  { key: "连续超预期", category: "earnings", color: "green" },
  { key: "多次低于预期", category: "earnings", color: "red" },
  { key: "EPS 大超预期", category: "earnings", color: "green" },
  { key: "EPS 不及预期", category: "earnings", color: "red" },
  { key: "营收超预期", category: "earnings", color: "green" },
  { key: "营收不及预期", category: "earnings", color: "red" },
  // 增长
  { key: "营收高增长", category: "growth", color: "green" },
  { key: "营收下滑", category: "growth", color: "red" },
  { key: "毛利扩张", category: "growth", color: "green" },
  { key: "毛利收缩", category: "growth", color: "red" },
  // 资金
  { key: "内部人买入", category: "money", color: "green" },
  { key: "内部人卖出", category: "money", color: "red" },
  { key: "机构净流入", category: "money", color: "green" },
  { key: "机构净流出", category: "money", color: "red" },
  { key: "加大回购", category: "capital", color: "green" },
  { key: "回购放缓", category: "capital", color: "amber" },
  { key: "高稀释", category: "capital", color: "red" },
  { key: "低稀释", category: "capital", color: "green" },
  // 评级
  { key: "评级上调潮", category: "ratings", color: "green" },
  { key: "评级下调潮", category: "ratings", color: "red" },
];

const CATEGORY_LABELS: Record<string, string> = {
  earnings: "业绩",
  growth: "增长",
  money: "资金面",
  capital: "资本运作",
  ratings: "分析师评级",
};

type IndexFilter = "all" | "sp500" | "nasdaq100" | "both" | "watchlist";

const PAGE_SIZE = 50;

export default function ScreenerContent({ rows }: { rows: ScreenerStock[] }) {
  const { t } = useLocale();
  const [search, setSearch] = useState("");
  const [selectedBadges, setSelectedBadges] = useState<Set<string>>(new Set());
  const [selectedResults, setSelectedResults] = useState<Set<ResultType>>(new Set());
  const [selectedSector, setSelectedSector] = useState<string>("all");
  const [indexFilter, setIndexFilter] = useState<IndexFilter>("all");
  const [recentOnly, setRecentOnly] = useState(true);
  const [page, setPage] = useState(0);
  const [watchlist, setWatchlist] = useState<string[]>([]);

  useEffect(() => {
    setWatchlist(readWatchlist());
    const handler = () => setWatchlist(readWatchlist());
    window.addEventListener("core600:watchlist-changed", handler);
    window.addEventListener("storage", handler);
    return () => {
      window.removeEventListener("core600:watchlist-changed", handler);
      window.removeEventListener("storage", handler);
    };
  }, []);

  const watchlistSet = useMemo(() => new Set(watchlist), [watchlist]);

  // sector 选项 (含数量)
  const sectors = useMemo(() => {
    const counts: Record<string, number> = {};
    rows.forEach(r => {
      if (r.sector) counts[r.sector] = (counts[r.sector] || 0) + 1;
    });
    return Object.entries(counts).sort((a, b) => b[1] - a[1]);
  }, [rows]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter(r => {
      // 搜索
      if (q) {
        const matches =
          r.ticker.toLowerCase().includes(q) ||
          r.name.toLowerCase().includes(q) ||
          (r.name_cn || "").toLowerCase().includes(q);
        if (!matches) return false;
      }
      // sector
      if (selectedSector !== "all" && r.sector !== selectedSector) return false;
      // index
      if (indexFilter === "sp500" && !r.in_sp500) return false;
      if (indexFilter === "nasdaq100" && !r.in_nasdaq100) return false;
      if (indexFilter === "both" && !(r.in_sp500 && r.in_nasdaq100)) return false;
      if (indexFilter === "watchlist" && !watchlistSet.has(r.ticker)) return false;
      // recent
      if (recentOnly && !r.interpretation?.is_recent) return false;
      // results
      if (selectedResults.size > 0) {
        if (!r.interpretation || !selectedResults.has(r.interpretation.result)) return false;
      }
      // badges (要求所有选中的 badge 都包含)
      if (selectedBadges.size > 0) {
        if (!r.interpretation) return false;
        const have = new Set(r.interpretation.badges.map(b => b.label));
        for (const want of selectedBadges) {
          if (!have.has(want)) return false;
        }
      }
      return true;
    });
  }, [rows, search, selectedSector, indexFilter, watchlistSet, recentOnly, selectedResults, selectedBadges]);

  const visible = filtered.slice(0, (page + 1) * PAGE_SIZE);
  const hasMore = filtered.length > visible.length;

  const toggleBadge = (key: string) => {
    setSelectedBadges(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
    setPage(0);
  };
  const toggleResult = (key: ResultType) => {
    setSelectedResults(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
    setPage(0);
  };

  const clearAll = () => {
    setSelectedBadges(new Set());
    setSelectedResults(new Set());
    setSelectedSector("all");
    setIndexFilter("all");
    setRecentOnly(true);
    setSearch("");
    setPage(0);
  };

  const activeFilterCount =
    selectedBadges.size +
    selectedResults.size +
    (selectedSector !== "all" ? 1 : 0) +
    (indexFilter !== "all" ? 1 : 0) +
    (search.trim() ? 1 : 0) +
    (recentOnly ? 0 : 1); // recent=true is default, count toggle off as 1

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
            <Link href="/stocks" className="text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition">
              {t("股票列表")}
            </Link>
            <Link href="/" className="text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition">
              ← {t("首页")}
            </Link>
          </div>
        </nav>

        <div className="mb-6">
          <h1 className="text-3xl md:text-4xl font-bold mb-2">{t("股票筛选器")}</h1>
          <p className="text-slate-600 dark:text-slate-400 text-sm">
            {t("按业绩 / 资金 / 评级 / 资本运作等多维度信号筛选 516 只美股核心")}
          </p>
        </div>

        {/* 筛选区 */}
        <div className="mb-6 p-5 bg-white/80 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl space-y-4">
          {/* 第一行：搜索 + 时间限定 + 重置 */}
          <div className="flex flex-wrap gap-3 items-center">
            <input
              type="text"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(0); }}
              placeholder={t("搜索 ticker / 中英文名…")}
              className="flex-1 min-w-[200px] px-3 py-2 bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-lg text-sm placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-indigo-500/50"
            />
            <label className="flex items-center gap-2 text-sm select-none cursor-pointer">
              <input
                type="checkbox"
                checked={recentOnly}
                onChange={(e) => { setRecentOnly(e.target.checked); setPage(0); }}
                className="accent-indigo-600 w-4 h-4"
              />
              <span className="text-slate-700 dark:text-slate-300">{t("仅最近 90 天财报")}</span>
            </label>
            {activeFilterCount > 0 && (
              <button
                type="button"
                onClick={clearAll}
                className="px-3 py-1.5 text-xs text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-white/10 rounded-lg hover:bg-slate-50 dark:hover:bg-white/10 transition"
              >
                {t("清除筛选")} ({activeFilterCount})
              </button>
            )}
          </div>

          {/* 第二行：index */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-slate-500 dark:text-slate-400 mr-2">{t("范围")}:</span>
            <FilterChip active={indexFilter === "all"} onClick={() => { setIndexFilter("all"); setPage(0); }}>
              {t("全部")}
            </FilterChip>
            <FilterChip active={indexFilter === "watchlist"} onClick={() => { setIndexFilter("watchlist"); setPage(0); }}>
              ⭐ {t("我的关注")} ({watchlist.length})
            </FilterChip>
            <FilterChip active={indexFilter === "sp500"} onClick={() => { setIndexFilter("sp500"); setPage(0); }}>S&P 500</FilterChip>
            <FilterChip active={indexFilter === "nasdaq100"} onClick={() => { setIndexFilter("nasdaq100"); setPage(0); }}>{t("纳指 100")}</FilterChip>
            <FilterChip active={indexFilter === "both"} onClick={() => { setIndexFilter("both"); setPage(0); }}>{t("两个都在")}</FilterChip>
          </div>

          {/* 第三行：result */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-slate-500 dark:text-slate-400 mr-2">{t("最新财报")}:</span>
            <FilterChip
              active={selectedResults.has("beat")}
              onClick={() => toggleResult("beat")}
              activeColor="green"
            >
              {t("超预期")}
            </FilterChip>
            <FilterChip
              active={selectedResults.has("miss")}
              onClick={() => toggleResult("miss")}
              activeColor="red"
            >
              {t("低于预期")}
            </FilterChip>
            <FilterChip
              active={selectedResults.has("mixed")}
              onClick={() => toggleResult("mixed")}
              activeColor="amber"
            >
              {t("好坏参半")}
            </FilterChip>
            <FilterChip
              active={selectedResults.has("inline")}
              onClick={() => toggleResult("inline")}
            >
              {t("符合预期")}
            </FilterChip>
          </div>

          {/* 第四行：sector */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-slate-500 dark:text-slate-400 mr-2">{t("板块")}:</span>
            <FilterChip active={selectedSector === "all"} onClick={() => { setSelectedSector("all"); setPage(0); }}>
              {t("全部")}
            </FilterChip>
            {sectors.map(([sec, count]) => (
              <FilterChip
                key={sec}
                active={selectedSector === sec}
                onClick={() => { setSelectedSector(sec); setPage(0); }}
              >
                {t(SECTOR_CN[sec] || sec)}{" "}
                <span className="text-slate-400 dark:text-slate-500">({count})</span>
              </FilterChip>
            ))}
          </div>

          {/* 第五-N 行：badges 按 category 分组 */}
          {(() => {
            const categories = [...new Set(ALL_BADGES.map(b => b.category))];
            return categories.map(cat => (
              <div key={cat} className="flex flex-wrap items-center gap-2">
                <span className="text-xs text-slate-500 dark:text-slate-400 mr-2 min-w-[60px]">
                  {t(CATEGORY_LABELS[cat] || cat)}:
                </span>
                {ALL_BADGES.filter(b => b.category === cat).map(b => (
                  <FilterChip
                    key={b.key}
                    active={selectedBadges.has(b.key)}
                    onClick={() => toggleBadge(b.key)}
                    activeColor={b.color as "green" | "red" | "amber"}
                  >
                    {t(b.key)}
                  </FilterChip>
                ))}
              </div>
            ));
          })()}
        </div>

        {/* 结果统计 */}
        <div className="mb-3 flex items-center justify-between text-sm text-slate-600 dark:text-slate-400">
          <div>
            {t("命中")}{" "}
            <span className="font-semibold text-slate-900 dark:text-white">{filtered.length}</span>
            {" / "}
            {rows.length}{" "}{t("只")}
          </div>
        </div>

        {/* 结果表 */}
        <div className="overflow-x-auto bg-white/80 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl">
          <table className="w-full text-sm min-w-[900px]">
            <thead>
              <tr className="border-b border-slate-200 dark:border-white/10 text-slate-500 dark:text-slate-400">
                <th className="text-left py-3 px-3 font-normal">{t("公司")}</th>
                <th className="text-left py-3 px-3 font-normal">{t("板块")}</th>
                <th className="text-right py-3 px-3 font-normal whitespace-nowrap">{t("财报")}</th>
                <th className="text-right py-3 px-3 font-normal">EPS</th>
                <th className="text-right py-3 px-3 font-normal">{t("营收 YoY")}</th>
                <th className="text-right py-3 px-3 font-normal">{t("毛利率")}</th>
                <th className="text-left py-3 pl-3 pr-3 font-normal">{t("场景标签")}</th>
              </tr>
            </thead>
            <tbody>
              {visible.map(r => (
                <ScreenerRow key={r.ticker} stock={r} />
              ))}
            </tbody>
          </table>
        </div>

        {/* 分页 */}
        {hasMore && (
          <div className="mt-4 text-center">
            <button
              type="button"
              onClick={() => setPage(p => p + 1)}
              className="px-4 py-2 text-sm bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-lg hover:bg-slate-50 dark:hover:bg-white/10 transition"
            >
              ↓ {t("加载更多")} ({filtered.length - visible.length} {t("剩余")})
            </button>
          </div>
        )}

        {filtered.length === 0 && (
          <div className="mt-8 text-center py-12 text-slate-500 dark:text-slate-400">
            {t("没有股票符合所有筛选条件")}
          </div>
        )}
      </div>
      <Footer />
    </main>
  );
}

function FilterChip({
  active,
  activeColor = "indigo",
  onClick,
  children,
}: {
  active: boolean;
  activeColor?: "indigo" | "green" | "red" | "amber";
  onClick: () => void;
  children: React.ReactNode;
}) {
  const activeStyles: Record<string, string> = {
    indigo: "bg-indigo-600 border-indigo-600 text-white dark:bg-indigo-500/30 dark:border-indigo-400/50",
    green: "bg-emerald-600 border-emerald-600 text-white dark:bg-emerald-500/30 dark:border-emerald-400/50",
    red: "bg-red-600 border-red-600 text-white dark:bg-red-500/30 dark:border-red-400/50",
    amber: "bg-amber-500 border-amber-500 text-white dark:bg-amber-500/30 dark:border-amber-400/50",
  };
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-3 py-1 rounded-full text-xs border transition ${
        active
          ? activeStyles[activeColor]
          : "bg-white dark:bg-white/5 border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/10"
      }`}
    >
      {children}
    </button>
  );
}

function ScreenerRow({ stock }: { stock: ScreenerStock }) {
  const { t } = useLocale();
  const interp = stock.interpretation;
  const dc = interp?.data_card;

  const resultColor: Record<string, string> = {
    beat: "text-emerald-600 dark:text-emerald-400",
    miss: "text-red-600 dark:text-red-400",
    mixed: "text-amber-600 dark:text-amber-400",
    inline: "text-slate-500 dark:text-slate-400",
  };
  const resultCN: Record<string, string> = {
    beat: "超预期",
    miss: "低于预期",
    mixed: "好坏参半",
    inline: "符合预期",
  };

  return (
    <tr className="border-b border-slate-100 dark:border-white/5 hover:bg-slate-50 dark:hover:bg-white/5 transition">
      <td className="py-3 px-3">
        <div className="flex items-center gap-2">
          <WatchlistStar ticker={stock.ticker} size="sm" />
          <Link href={`/stocks/${stock.ticker}`} className="block hover:underline min-w-0">
            <div className="font-semibold text-slate-900 dark:text-white">{stock.ticker}</div>
            <div className="text-xs text-slate-500 dark:text-slate-400 truncate max-w-[180px]">
              {stock.name_cn || stock.name}
            </div>
          </Link>
        </div>
      </td>
      <td className="py-3 px-3 text-xs text-slate-600 dark:text-slate-400 whitespace-nowrap">
        {stock.sector ? t(SECTOR_CN[stock.sector] || stock.sector) : "—"}
      </td>
      <td className="py-3 px-3 text-right whitespace-nowrap">
        {interp ? (
          <div>
            <div className={`text-xs font-medium ${resultColor[interp.result]}`}>
              {t(resultCN[interp.result])}
            </div>
            <div className="text-xs text-slate-400 dark:text-slate-500 tabular-nums">
              {interp.earnings_date}
            </div>
          </div>
        ) : (
          <span className="text-xs text-slate-400 dark:text-slate-500">—</span>
        )}
      </td>
      <td className="py-3 px-3 text-right tabular-nums">
        {dc?.eps_surprise_pct != null ? (
          <span
            className={
              dc.eps_surprise_pct > 0
                ? "text-emerald-600 dark:text-emerald-400"
                : "text-red-600 dark:text-red-400"
            }
          >
            {dc.eps_surprise_pct > 0 ? "+" : ""}
            {dc.eps_surprise_pct.toFixed(1)}%
          </span>
        ) : (
          "—"
        )}
      </td>
      <td className="py-3 px-3 text-right tabular-nums">
        {dc?.rev_yoy_pct != null ? (
          <span
            className={
              dc.rev_yoy_pct > 0
                ? "text-emerald-600 dark:text-emerald-400"
                : "text-red-600 dark:text-red-400"
            }
          >
            {dc.rev_yoy_pct > 0 ? "+" : ""}
            {dc.rev_yoy_pct.toFixed(1)}%
          </span>
        ) : (
          "—"
        )}
      </td>
      <td className="py-3 px-3 text-right tabular-nums">
        {dc?.gross_margin != null ? `${(dc.gross_margin * 100).toFixed(1)}%` : "—"}
      </td>
      <td className="py-3 pl-3 pr-3">
        {interp && interp.badges.length > 0 ? (
          <div className="flex flex-wrap gap-1">
            {interp.badges.slice(0, 4).map((b, i) => (
              <span
                key={i}
                className={`px-1.5 py-0.5 text-[10px] rounded-full border ${badgeColorClass(b.color)}`}
                title={b.hint}
              >
                {t(b.label)}
              </span>
            ))}
            {interp.badges.length > 4 && (
              <span className="text-[10px] text-slate-400 dark:text-slate-500 px-1">
                +{interp.badges.length - 4}
              </span>
            )}
          </div>
        ) : (
          <span className="text-xs text-slate-300 dark:text-slate-600">—</span>
        )}
      </td>
    </tr>
  );
}

function badgeColorClass(color: string): string {
  const map: Record<string, string> = {
    green: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-300 dark:border-emerald-500/25",
    amber: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-500/15 dark:text-amber-300 dark:border-amber-500/25",
    red: "bg-red-50 text-red-700 border-red-200 dark:bg-red-500/15 dark:text-red-300 dark:border-red-500/25",
    slate: "bg-slate-50 text-slate-600 border-slate-200 dark:bg-slate-500/15 dark:text-slate-300 dark:border-slate-500/25",
  };
  return map[color] || map.slate;
}
