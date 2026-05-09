import Link from "next/link";
import stocksData from "../../../data/stocks.json";
import fmpExtrasData from "../../../data/fmp_extras.json";
import interpretationsData from "../../../data/earnings_interpretations.json";
import type { StockData, Stock } from "@/lib/types";
import type { FMPExtras, EarningsInterpretation } from "@/lib/fmp";
import CalendarPageContent from "@/components/CalendarPageContent";

export const metadata = {
  title: "Earnings Calendar — Core 600",
  description: "Upcoming earnings for S&P 500 + Nasdaq 100, sorted by date",
};

// ISR: 30 分钟刷新一次 (跟 fmp_extras cron 节奏匹配)
export const revalidate = 1800;

type FMPExtrasByTicker = { by_ticker: Record<string, FMPExtras> };
type InterpretationsByTicker = { by_ticker: Record<string, EarningsInterpretation> };

export interface CalendarEntry {
  ticker: string;
  name_cn: string | null;
  name: string;
  date: string;            // YYYY-MM-DD
  release_time: string | null; // "bmo" / "amc" / null
  eps_estimate: number | null;
  rev_estimate: number | null;  // USD
  fiscal_label: string | null;  // 例: "2026 Q1"
  daysFromNow: number;     // 0=今天, 1=明天, -1=昨天 (only past 0-7 days)
}

function makeFiscalLabel(fpe: string | null | undefined): string | null {
  if (!fpe) return null;
  try {
    const m = parseInt(fpe.slice(5, 7), 10);
    const y = fpe.slice(0, 4);
    const q = m <= 3 ? "Q1" : m <= 6 ? "Q2" : m <= 9 ? "Q3" : "Q4";
    return `${y} ${q}`;
  } catch {
    return null;
  }
}

function buildCalendar(stocks: Stock[], fmpExtras: FMPExtrasByTicker): CalendarEntry[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayStr = today.toISOString().slice(0, 10);

  const entries: CalendarEntry[] = [];

  for (const stock of stocks) {
    const extras = fmpExtras.by_ticker[stock.ticker];
    if (!extras) continue;

    // 找最近一次"未来"财报: eps_actual 为 null 表示还没公布; 但是要找 date >= 今天的最早一条
    // earnings 数组按时间倒序排列 (最新在前), 所以从后往前找
    const earnings = extras.earnings || [];
    let nextFuture: typeof earnings[0] | null = null;
    for (const e of earnings) {
      if (!e.date) continue;
      // 已经发布 (有 actual) 不算
      if (e.eps_actual != null || e.rev_actual != null) continue;
      // 必须是今天或未来
      if (e.date < todayStr) continue;
      // 取最早的未来财报 (nextFuture.date 一定有, 因为 push 时已 check, 但 TS 不知道)
      if (!nextFuture || (nextFuture.date && e.date < nextFuture.date)) {
        nextFuture = e;
      }
    }

    if (!nextFuture) continue;

    const dateObj = new Date(nextFuture.date + "T00:00:00");
    const daysFromNow = Math.round((dateObj.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

    // 只要未来 60 天内
    if (daysFromNow < 0 || daysFromNow > 60) continue;

    entries.push({
      ticker: stock.ticker,
      name_cn: stock.name_cn || null,
      name: stock.name,
      date: nextFuture.date as string,  // 上面 loop 已 check `!e.date` continue, 必非 null
      release_time: nextFuture.time || null,
      eps_estimate: nextFuture.eps_estimate ?? null,
      rev_estimate: nextFuture.rev_estimate ?? null,
      fiscal_label: makeFiscalLabel(nextFuture.fiscal_period_end),
      daysFromNow,
    });
  }

  // 按日期升序
  entries.sort((a, b) => a.date.localeCompare(b.date) || a.ticker.localeCompare(b.ticker));
  return entries;
}

export default function CalendarPage() {
  const data = stocksData as StockData;
  const fmpExtras = fmpExtrasData as FMPExtrasByTicker;
  const interp = interpretationsData as InterpretationsByTicker;

  const entries = buildCalendar(data.stocks, fmpExtras);

  // 已发的最近 7 天财报 (拿来做"刚发"清单, 跳到详情页看 EQR 点评)
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const sevenAgo = new Date(today);
  sevenAgo.setDate(today.getDate() - 7);

  const recent: CalendarEntry[] = [];
  for (const s of data.stocks) {
    const extras = fmpExtras.by_ticker[s.ticker];
    if (!extras) continue;
    for (const e of extras.earnings || []) {
      if (!e.date) continue;
      if (e.eps_actual == null && e.rev_actual == null) continue; // 必须已发布
      const eDate = new Date(e.date + "T00:00:00");
      if (eDate >= sevenAgo && eDate <= today) {
        recent.push({
          ticker: s.ticker,
          name_cn: s.name_cn || null,
          name: s.name,
          date: e.date,
          release_time: e.time || null,
          eps_estimate: e.eps_estimate ?? null,
          rev_estimate: e.rev_estimate ?? null,
          fiscal_label: makeFiscalLabel(e.fiscal_period_end),
          daysFromNow: Math.round((eDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)),
        });
        break; // 一只股票最近一份就够
      }
    }
  }
  recent.sort((a, b) => b.date.localeCompare(a.date));

  // 哪些 ticker 已经有 EQR 点评 (用来标星)
  const tickerWithEQR = new Set(
    Object.entries(interp.by_ticker)
      .filter(([, v]) => v.is_recent && v.narrative_status === "done")
      .map(([k]) => k)
  );

  return (
    <CalendarPageContent
      upcoming={entries}
      recent={recent}
      tickerWithEQR={Array.from(tickerWithEQR)}
    />
  );
}
