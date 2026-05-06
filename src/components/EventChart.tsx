"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useTheme } from "next-themes";
import {
  CandlestickSeries,
  ColorType,
  createChart,
  createSeriesMarkers,
  type IChartApi,
  type ISeriesApi,
  type SeriesMarker,
  type Time,
  type UTCTimestamp,
} from "lightweight-charts";
import type { EdgarFiling } from "@/lib/edgar";
import type { EarningRecord, RatingChange } from "@/lib/fmp";
import { useLocale } from "./LocaleProvider";

/**
 * K 线 + 关键事件 marker
 *
 * Markers:
 * - 🟢 ↑ : 内部人公开市场买入 (Form 4 code=P, A)
 * - 🔴 ↓ : 内部人公开市场卖出 (Form 4 code=S, D)
 * - 🟡 E : 财报发布日
 * - 🟠 8K : 8-K 重大事项 (排除 Item 2.02 业绩公告)
 * - 🔵 ⬆ : 评级升级
 * - 🔵 ⬇ : 评级降级
 *
 * 数据源: 客户端 fetch /prices/{ticker}.json (1 年日线)
 * 库:    lightweight-charts (~120KB gzipped)
 */

type Candle = {
  t: string;
  o: number;
  h: number;
  l: number;
  c: number;
  v?: number;
};

type PriceData = {
  ticker: string;
  from: string;
  to: string;
  candles: Candle[];
};

function dateToUTC(dateStr: string): UTCTimestamp {
  // 'YYYY-MM-DD' → epoch seconds (UTC midnight)
  return (Date.parse(dateStr + "T00:00:00Z") / 1000) as UTCTimestamp;
}

export default function EventChart({
  ticker,
  form4 = [],
  form8k = [],
  earnings = [],
  ratings = [],
  height = 400,
}: {
  ticker: string;
  form4?: EdgarFiling[];
  form8k?: EdgarFiling[];
  earnings?: EarningRecord[];
  ratings?: RatingChange[];
  height?: number;
}) {
  const { t } = useLocale();
  const { resolvedTheme } = useTheme();
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const [data, setData] = useState<PriceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 加载历史价格
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetch(`/prices/${ticker}.json`, { cache: "force-cache" })
      .then(async r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const d = (await r.json()) as PriceData;
        if (!cancelled) {
          setData(d);
          setLoading(false);
        }
      })
      .catch((e: Error) => {
        if (!cancelled) {
          setError(e.message);
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [ticker]);

  // 计算 markers
  const markers: SeriesMarker<Time>[] = useMemo(() => {
    if (!data) return [];
    const list: SeriesMarker<Time>[] = [];

    const fromTs = data.candles.length > 0 ? data.candles[0].t : "";

    // 内部人交易 — 仅看公开市场买/卖 (P/S code)
    for (const f of form4) {
      const fd = f.filingDate;
      if (!fd || fd < fromTs) continue;
      const txs = f.parsed?.transactions || [];
      let totalBuy = 0;
      let totalSell = 0;
      for (const tx of txs) {
        if (tx.kind !== "non-derivative") continue;
        if (tx.acquired_disposed === "A" && tx.code === "P") {
          totalBuy += tx.value || 0;
        } else if (tx.acquired_disposed === "D" && tx.code === "S") {
          totalSell += tx.value || 0;
        }
      }
      if (totalBuy > 0) {
        list.push({
          time: dateToUTC(fd),
          position: "belowBar",
          color: "#10b981",
          shape: "arrowUp",
          text: `${t("买入")} ${formatUSD(totalBuy)}`,
        });
      }
      if (totalSell > 0) {
        list.push({
          time: dateToUTC(fd),
          position: "aboveBar",
          color: "#ef4444",
          shape: "arrowDown",
          text: `${t("卖出")} ${formatUSD(totalSell)}`,
        });
      }
    }

    // 财报发布日
    for (const e of earnings) {
      const ed = e.date;
      if (!ed || ed < fromTs) continue;
      // 只标已发布过的（有 eps_actual）
      if (e.eps_actual == null) continue;
      const surprise =
        e.eps_estimate && e.eps_estimate !== 0
          ? ((e.eps_actual - e.eps_estimate) / Math.abs(e.eps_estimate)) * 100
          : null;
      const surpriseStr = surprise != null ? ` ${surprise > 0 ? "+" : ""}${surprise.toFixed(0)}%` : "";
      list.push({
        time: dateToUTC(ed),
        position: "inBar",
        color: "#f59e0b",
        shape: "circle",
        text: `${t("财报")}${surpriseStr}`,
      });
    }

    // 8-K 重大事项 (排除 Item 2.02 业绩公告 — 已被财报 marker 覆盖)
    for (const f of form8k) {
      const fd = f.filingDate;
      if (!fd || fd < fromTs) continue;
      const items = f.items || "";
      if (items.includes("2.02")) continue;
      // 关键事项才标
      const isKey = items.includes("5.02") || items.includes("1.01") || items.includes("8.01") || items.includes("2.01");
      if (!isKey) continue;
      list.push({
        time: dateToUTC(fd),
        position: "aboveBar",
        color: "#fb923c",
        shape: "square",
        text: items.split(",")[0]?.trim().slice(0, 8) || "8-K",
      });
    }

    // 评级变动
    for (const r of ratings) {
      const rd = r.date;
      if (!rd || rd < fromTs) continue;
      if (r.action === "upgrade") {
        list.push({
          time: dateToUTC(rd),
          position: "belowBar",
          color: "#3b82f6",
          shape: "arrowUp",
          text: `${t("升级")} ${r.company || ""}`,
        });
      } else if (r.action === "downgrade") {
        list.push({
          time: dateToUTC(rd),
          position: "aboveBar",
          color: "#a855f7",
          shape: "arrowDown",
          text: `${t("降级")} ${r.company || ""}`,
        });
      }
    }

    // 按时间排序（lightweight-charts 要求 markers 按时间升序）
    list.sort((a, b) => (a.time as number) - (b.time as number));
    return list;
  }, [data, form4, form8k, earnings, ratings, t]);

  // 创建图表
  useEffect(() => {
    if (!containerRef.current || !data) return;

    const isDark = resolvedTheme === "dark";

    const chart = createChart(containerRef.current, {
      width: containerRef.current.clientWidth,
      height,
      layout: {
        background: { type: ColorType.Solid, color: "transparent" },
        textColor: isDark ? "#cbd5e1" : "#475569",
        fontSize: 11,
      },
      grid: {
        vertLines: { color: isDark ? "rgba(148, 163, 184, 0.06)" : "rgba(15, 23, 42, 0.06)" },
        horzLines: { color: isDark ? "rgba(148, 163, 184, 0.06)" : "rgba(15, 23, 42, 0.06)" },
      },
      rightPriceScale: {
        borderColor: isDark ? "rgba(148, 163, 184, 0.2)" : "rgba(15, 23, 42, 0.15)",
      },
      timeScale: {
        borderColor: isDark ? "rgba(148, 163, 184, 0.2)" : "rgba(15, 23, 42, 0.15)",
        timeVisible: false,
      },
      crosshair: {
        mode: 1, // 1 = magnet to nearest data
      },
    });

    const series = chart.addSeries(CandlestickSeries, {
      upColor: "#10b981",
      downColor: "#ef4444",
      borderUpColor: "#10b981",
      borderDownColor: "#ef4444",
      wickUpColor: "#10b981",
      wickDownColor: "#ef4444",
    });

    series.setData(
      data.candles.map(c => ({
        time: dateToUTC(c.t),
        open: c.o,
        high: c.h,
        low: c.l,
        close: c.c,
      }))
    );

    if (markers.length > 0) {
      createSeriesMarkers(series, markers);
    }

    chart.timeScale().fitContent();

    chartRef.current = chart;
    seriesRef.current = series;

    // Resize observer
    const resizeObserver = new ResizeObserver(entries => {
      for (const entry of entries) {
        if (chartRef.current) {
          chartRef.current.applyOptions({ width: entry.contentRect.width });
        }
      }
    });
    resizeObserver.observe(containerRef.current);

    return () => {
      resizeObserver.disconnect();
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
    };
  }, [data, markers, height, resolvedTheme]);

  if (loading) {
    return (
      <div
        className="flex items-center justify-center bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-lg"
        style={{ height }}
      >
        <span className="text-sm text-slate-400 dark:text-slate-500">{t("加载 K 线数据…")}</span>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div
        className="flex items-center justify-center bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-lg"
        style={{ height }}
      >
        <span className="text-sm text-slate-400 dark:text-slate-500">
          {t("暂无 K 线数据")} {error ? `(${error})` : ""}
        </span>
      </div>
    );
  }

  return (
    <div className="w-full">
      <div ref={containerRef} className="w-full" style={{ height }} />
      {/* 图例 */}
      <div className="mt-3 flex flex-wrap gap-3 text-xs justify-center text-slate-500 dark:text-slate-400">
        <LegendItem color="#10b981" symbol="▲" label={t("内部人买入")} />
        <LegendItem color="#ef4444" symbol="▼" label={t("内部人卖出")} />
        <LegendItem color="#f59e0b" symbol="●" label={t("财报发布")} />
        <LegendItem color="#fb923c" symbol="■" label={t("8-K 重大事项")} />
        <LegendItem color="#3b82f6" symbol="▲" label={t("评级升级")} />
        <LegendItem color="#a855f7" symbol="▼" label={t("评级降级")} />
      </div>
      <div className="mt-1 text-xs text-slate-400 dark:text-slate-500 text-center">
        {t("过去 1 年日线 · 鼠标悬停看 marker 详情 · 滚轮缩放")}
      </div>
    </div>
  );
}

function LegendItem({ color, symbol, label }: { color: string; symbol: string; label: string }) {
  return (
    <div className="flex items-center gap-1">
      <span style={{ color }}>{symbol}</span>
      <span>{label}</span>
    </div>
  );
}

function formatUSD(n: number): string {
  if (n >= 1e9) return `$${(n / 1e9).toFixed(1)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(0)}M`;
  if (n >= 1e3) return `$${(n / 1e3).toFixed(0)}K`;
  return `$${n.toFixed(0)}`;
}
