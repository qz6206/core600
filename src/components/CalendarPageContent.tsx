"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import ThemeToggle from "@/components/ThemeToggle";
import LocaleToggle from "@/components/LocaleToggle";
import TimeDisplay from "@/components/TimeDisplay";
import Footer from "@/components/Footer";
import { useLocale } from "@/components/LocaleProvider";
import type { CalendarEntry } from "@/app/calendar/page";

const RANGE_OPTIONS = [
  { label_zh: "7 天", label_en: "7 days", days: 7 },
  { label_zh: "30 天", label_en: "30 days", days: 30 },
  { label_zh: "60 天", label_en: "60 days", days: 60 },
];

function formatDate(d: string, locale: string): string {
  // d = YYYY-MM-DD
  try {
    const dt = new Date(d + "T00:00:00");
    const m = dt.getMonth() + 1;
    const day = dt.getDate();
    if (locale === "zh-Hant") return `${m}月${day}日`;
    return `${m}/${day}`;
  } catch {
    return d;
  }
}

function formatUSD(n: number | null): string {
  if (n == null) return "—";
  if (Math.abs(n) >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (Math.abs(n) >= 1e6) return `$${(n / 1e6).toFixed(0)}M`;
  if (Math.abs(n) >= 1e3) return `$${(n / 1e3).toFixed(0)}K`;
  return `$${n.toFixed(0)}`;
}

function dayBadge(days: number, t: (s: string) => string): string {
  if (days === 0) return t("今天");
  if (days === 1) return t("明天");
  if (days === 2) return t("后天");
  if (days < 7) return `${days} ${t("天后")}`;
  if (days < 14) return `${t("下周")}`;
  if (days < 30) return `${Math.round(days / 7)} ${t("周后")}`;
  return `${Math.round(days / 30)} ${t("个月后")}`;
}

function timeLabel(time: string | null, t: (s: string) => string): string {
  if (time === "bmo") return t("盘前");
  if (time === "amc") return t("盘后");
  return "—";
}

export default function CalendarPageContent({
  upcoming,
  recent,
  tickerWithEQR,
}: {
  upcoming: CalendarEntry[];
  recent: CalendarEntry[];
  tickerWithEQR: string[];
}) {
  const { t, tCn, locale, isEnglish } = useLocale();
  const [rangeDays, setRangeDays] = useState(30);

  const eqrSet = useMemo(() => new Set(tickerWithEQR), [tickerWithEQR]);

  // 按 rangeDays 过滤未来财报, 按日期分组
  const filtered = useMemo(
    () => upcoming.filter((e) => e.daysFromNow <= rangeDays),
    [upcoming, rangeDays]
  );

  // 按日期分组
  const byDate = useMemo(() => {
    const groups: Record<string, CalendarEntry[]> = {};
    for (const e of filtered) {
      if (!groups[e.date]) groups[e.date] = [];
      groups[e.date].push(e);
    }
    return groups;
  }, [filtered]);

  const sortedDates = Object.keys(byDate).sort();

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
          <div className="flex items-center gap-4 text-sm text-slate-500 dark:text-slate-400">
            <Link href="/stocks" className="hover:text-slate-900 dark:hover:text-white transition">
              {t("股票列表")}
            </Link>
            <Link href="/" className="hover:text-slate-900 dark:hover:text-white transition">
              ← {t("首页")}
            </Link>
          </div>
        </nav>

        {/* 标题 */}
        <div className="mb-8">
          <h1 className="text-3xl md:text-4xl font-bold mb-2">📅 {t("财报日历")}</h1>
          <p className="text-slate-600 dark:text-slate-400">
            {t("Core 600 即将发布的财报,按时间排序")}
          </p>
        </div>

        {/* 时间范围切换 */}
        <div className="mb-6 flex gap-2">
          {RANGE_OPTIONS.map((opt) => (
            <button
              key={opt.days}
              onClick={() => setRangeDays(opt.days)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                rangeDays === opt.days
                  ? "bg-indigo-600 text-white"
                  : "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
              }`}
            >
              {isEnglish ? `Upcoming ${opt.label_en}` : `${t("未来")} ${opt.label_zh}`}
            </button>
          ))}
          <span className="ml-auto self-center text-sm text-slate-500 dark:text-slate-400">
            {filtered.length} {t("只")}
          </span>
        </div>

        {/* 即将发布 */}
        {sortedDates.length === 0 ? (
          <div className="rounded-lg border border-slate-200 dark:border-white/10 p-8 text-center text-slate-500 dark:text-slate-400">
            {t("未来")} {rangeDays} {t("天内暂无财报记录")}
          </div>
        ) : (
          <div className="space-y-6 mb-12">
            {sortedDates.map((date) => {
              const items = byDate[date];
              const sample = items[0];
              return (
                <section key={date} className="rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900/50 overflow-hidden">
                  <div className="px-4 py-3 bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-white/10 flex items-center justify-between">
                    <div>
                      <span className="font-semibold">{formatDate(date, locale)}</span>
                      <span className="ml-3 text-xs text-slate-500 dark:text-slate-400">
                        {dayBadge(sample.daysFromNow, t)}
                      </span>
                    </div>
                    <span className="text-xs text-slate-500 dark:text-slate-400">
                      {items.length} {t("只")}
                    </span>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="text-xs text-slate-500 dark:text-slate-400">
                        <tr className="border-b border-slate-100 dark:border-white/5">
                          <th className="text-left py-2 px-4 font-medium">Ticker</th>
                          <th className="text-left py-2 px-3 font-medium">{t("公司")}</th>
                          <th className="text-left py-2 px-3 font-medium">{t("财季")}</th>
                          <th className="text-left py-2 px-3 font-medium">{t("时段")}</th>
                          <th className="text-right py-2 px-3 font-medium">EPS {t("预期")}</th>
                          <th className="text-right py-2 px-4 font-medium">{t("营收预期")}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {items.map((e) => (
                          <tr key={e.ticker} className="border-b border-slate-100 dark:border-white/5 last:border-0 hover:bg-slate-50 dark:hover:bg-slate-800/30 transition">
                            <td className="py-2 px-4">
                              <Link
                                href={`/stocks/${e.ticker}`}
                                className="font-mono font-semibold text-indigo-600 dark:text-indigo-400 hover:underline"
                              >
                                {e.ticker}
                              </Link>
                            </td>
                            <td className="py-2 px-3 text-slate-700 dark:text-slate-300">
                              {isEnglish ? e.name : tCn(e.name_cn || e.name)}
                            </td>
                            <td className="py-2 px-3 text-slate-500 dark:text-slate-400 text-xs">
                              {e.fiscal_label || "—"}
                            </td>
                            <td className="py-2 px-3">
                              <span className={`text-xs px-2 py-0.5 rounded ${
                                e.release_time === "bmo"
                                  ? "bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300"
                                  : e.release_time === "amc"
                                  ? "bg-indigo-100 text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-300"
                                  : "text-slate-400 dark:text-slate-500"
                              }`}>
                                {timeLabel(e.release_time, t)}
                              </span>
                            </td>
                            <td className="py-2 px-3 text-right tabular-nums">
                              {e.eps_estimate != null ? `$${e.eps_estimate.toFixed(2)}` : "—"}
                            </td>
                            <td className="py-2 px-4 text-right tabular-nums">
                              {formatUSD(e.rev_estimate)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>
              );
            })}
          </div>
        )}

        {/* 刚发布 (近 7 天 EQR 点评) */}
        {recent.length > 0 && (
          <section className="rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900/50 overflow-hidden">
            <div className="px-4 py-3 bg-emerald-50 dark:bg-emerald-900/20 border-b border-slate-200 dark:border-white/10">
              <h2 className="font-semibold">📝 {t("刚发布的财报")}（{t("近 7 天")}）</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                {t("点击查看完整 EQR 财报点评")}
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-xs text-slate-500 dark:text-slate-400">
                  <tr className="border-b border-slate-100 dark:border-white/5">
                    <th className="text-left py-2 px-4 font-medium">{t("发布日")}</th>
                    <th className="text-left py-2 px-3 font-medium">Ticker</th>
                    <th className="text-left py-2 px-3 font-medium">{t("公司")}</th>
                    <th className="text-left py-2 px-3 font-medium">{t("财季")}</th>
                    <th className="text-left py-2 px-4 font-medium">EQR {t("点评")}</th>
                  </tr>
                </thead>
                <tbody>
                  {recent.map((e) => (
                    <tr key={`${e.ticker}-${e.date}`} className="border-b border-slate-100 dark:border-white/5 last:border-0 hover:bg-slate-50 dark:hover:bg-slate-800/30 transition">
                      <td className="py-2 px-4 tabular-nums">{formatDate(e.date, locale)}</td>
                      <td className="py-2 px-3">
                        <Link
                          href={`/stocks/${e.ticker}`}
                          className="font-mono font-semibold text-indigo-600 dark:text-indigo-400 hover:underline"
                        >
                          {e.ticker}
                        </Link>
                      </td>
                      <td className="py-2 px-3 text-slate-700 dark:text-slate-300">
                        {isEnglish ? e.name : tCn(e.name_cn || e.name)}
                      </td>
                      <td className="py-2 px-3 text-slate-500 dark:text-slate-400 text-xs">
                        {e.fiscal_label || "—"}
                      </td>
                      <td className="py-2 px-4">
                        {eqrSet.has(e.ticker) ? (
                          <Link
                            href={`/stocks/${e.ticker}#earnings-interpretation`}
                            className="text-xs text-emerald-600 dark:text-emerald-400 hover:underline"
                          >
                            ✓ {t("查看点评")} →
                          </Link>
                        ) : (
                          <span className="text-xs text-slate-400 dark:text-slate-500 italic">
                            {t("生成中…")}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* 免责声明 */}
        <div className="mt-8 text-xs text-slate-500 dark:text-slate-500 text-center leading-relaxed">
          ⚠️ {t("数据来自公开渠道,仅供研究参考,不构成投资建议")}
        </div>
      </div>
      <Footer />
    </main>
  );
}
