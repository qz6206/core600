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
 * Hover detail: LWC v5 markers 只支持静态 text 标签，所以用 crosshair event
 * 自己管理一个 hover tooltip (覆盖在 chart 上)
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

type EventDetail = {
  date: string;
  type: "buy" | "sell" | "earnings" | "form8k" | "upgrade" | "downgrade";
  title: string;
  detail: string;
  color: string;
};

function dateToUTC(dateStr: string): UTCTimestamp {
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

  // Hover tooltip state
  const [hoverInfo, setHoverInfo] = useState<{
    events: EventDetail[];
    x: number;
    y: number;
    candleClose: number | null;
    candleDate: string;
  } | null>(null);

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

  // 收集所有事件（含详情）— 一个数据源，markers 和 hover 都用
  const eventsByDate = useMemo(() => {
    if (!data) return new Map<string, EventDetail[]>();
    const fromTs = data.candles.length > 0 ? data.candles[0].t : "";
    const map = new Map<string, EventDetail[]>();
    const add = (date: string, ev: EventDetail) => {
      if (!map.has(date)) map.set(date, []);
      map.get(date)!.push(ev);
    };

    // 内部人 (公开市场买入/卖出)
    for (const f of form4) {
      const fd = f.filingDate;
      if (!fd || fd < fromTs) continue;
      const txs = f.parsed?.transactions || [];
      let totalBuy = 0;
      let totalSell = 0;
      const owner = f.parsed?.owner_name || t("内部人");
      const titleCN = f.parsed?.owner_title_cn || "";
      for (const tx of txs) {
        if (tx.kind !== "non-derivative") continue;
        if (tx.acquired_disposed === "A" && tx.code === "P") {
          totalBuy += tx.value || 0;
        } else if (tx.acquired_disposed === "D" && tx.code === "S") {
          totalSell += tx.value || 0;
        }
      }
      const titleSuffix = titleCN ? ` (${titleCN})` : "";
      if (totalBuy > 0) {
        add(fd, {
          date: fd,
          type: "buy",
          title: `${t("内部人买入")} ${formatUSD(totalBuy)}`,
          detail: `${owner}${titleSuffix}`,
          color: "#10b981",
        });
      }
      if (totalSell > 0) {
        add(fd, {
          date: fd,
          type: "sell",
          title: `${t("内部人卖出")} ${formatUSD(totalSell)}`,
          detail: `${owner}${titleSuffix}`,
          color: "#ef4444",
        });
      }
    }

    // 财报发布
    for (const e of earnings) {
      const ed = e.date;
      if (!ed || ed < fromTs) continue;
      if (e.eps_actual == null) continue;
      const surprise =
        e.eps_estimate && e.eps_estimate !== 0
          ? ((e.eps_actual - e.eps_estimate) / Math.abs(e.eps_estimate)) * 100
          : null;
      const surpriseTxt = surprise != null
        ? ` (${surprise > 0 ? "Beat " : "Miss "}${surprise > 0 ? "+" : ""}${surprise.toFixed(1)}%)`
        : "";
      const detail = [
        `EPS ${e.eps_actual.toFixed(2)} vs ${t("预期")} ${e.eps_estimate?.toFixed(2) ?? "—"}`,
        e.rev_actual && e.rev_estimate
          ? `${t("营收")} ${formatUSD(e.rev_actual)} vs ${t("预期")} ${formatUSD(e.rev_estimate)}`
          : null,
      ].filter(Boolean).join(" · ");
      add(ed, {
        date: ed,
        type: "earnings",
        title: `${t("财报发布")}${surpriseTxt}`,
        detail,
        color: "#f59e0b",
      });
    }

    // 8-K
    for (const f of form8k) {
      const fd = f.filingDate;
      if (!fd || fd < fromTs) continue;
      const items = f.items || "";
      if (items.includes("2.02")) continue;
      const isKey = items.includes("5.02") || items.includes("1.01") || items.includes("8.01") || items.includes("2.01");
      if (!isKey) continue;
      const summary = f.summary_cn || items;
      add(fd, {
        date: fd,
        type: "form8k",
        title: `8-K ${items.split(",")[0]?.trim() || ""}`,
        detail: summary,
        color: "#fb923c",
      });
    }

    // 评级
    for (const r of ratings) {
      const rd = r.date;
      if (!rd || rd < fromTs) continue;
      if (r.action === "upgrade") {
        const target = r.target_price ? ` ${t("目标价")} $${r.target_price.toFixed(0)}` : "";
        add(rd, {
          date: rd,
          type: "upgrade",
          title: `${t("评级升级")} ${r.company || ""}`,
          detail: `${r.prev_grade || "—"} → ${r.new_grade || "—"}${target}`,
          color: "#3b82f6",
        });
      } else if (r.action === "downgrade") {
        const target = r.target_price ? ` ${t("目标价")} $${r.target_price.toFixed(0)}` : "";
        add(rd, {
          date: rd,
          type: "downgrade",
          title: `${t("评级降级")} ${r.company || ""}`,
          detail: `${r.prev_grade || "—"} → ${r.new_grade || "—"}${target}`,
          color: "#a855f7",
        });
      }
    }

    return map;
  }, [data, form4, form8k, earnings, ratings, t]);

  // 给 LWC 用的 markers (无 text，避免拥挤；hover 看详情)
  const markers: SeriesMarker<Time>[] = useMemo(() => {
    const list: SeriesMarker<Time>[] = [];
    for (const events of eventsByDate.values()) {
      // 同一天有多个事件 → 把每个都加上，但 position 适配
      const buys = events.filter(e => e.type === "buy");
      const sells = events.filter(e => e.type === "sell");
      const earns = events.filter(e => e.type === "earnings");
      const f8ks = events.filter(e => e.type === "form8k");
      const upgrades = events.filter(e => e.type === "upgrade");
      const downgrades = events.filter(e => e.type === "downgrade");

      const date = events[0].date;
      const time = dateToUTC(date);

      if (buys.length > 0) {
        list.push({ time, position: "belowBar", color: "#10b981", shape: "arrowUp", text: "" });
      }
      if (sells.length > 0) {
        list.push({ time, position: "aboveBar", color: "#ef4444", shape: "arrowDown", text: "" });
      }
      if (earns.length > 0) {
        list.push({ time, position: "inBar", color: "#f59e0b", shape: "circle", text: "" });
      }
      if (f8ks.length > 0) {
        list.push({ time, position: "aboveBar", color: "#fb923c", shape: "square", text: "" });
      }
      if (upgrades.length > 0) {
        list.push({ time, position: "belowBar", color: "#3b82f6", shape: "arrowUp", text: "" });
      }
      if (downgrades.length > 0) {
        list.push({ time, position: "aboveBar", color: "#a855f7", shape: "arrowDown", text: "" });
      }
    }
    list.sort((a, b) => (a.time as number) - (b.time as number));
    return list;
  }, [eventsByDate]);

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
        mode: 1,
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

    // ====== 自定义 hover tooltip ======
    chart.subscribeCrosshairMove(param => {
      if (!param.time || !param.point) {
        setHoverInfo(null);
        return;
      }
      // param.time 是 UTCTimestamp (秒) 对于日线
      const ts = param.time as number;
      const dateStr = new Date(ts * 1000).toISOString().slice(0, 10);
      const events = eventsByDate.get(dateStr) || [];
      // 取该日 candle close
      const candleData = param.seriesData.get(series);
      const close = candleData && "close" in candleData ? (candleData.close as number) : null;

      if (events.length === 0) {
        // 不在 marker 日，仍可显示日期 / 收盘价（但只有当鼠标在图表内）
        // 简化：只在有事件时显示
        setHoverInfo(null);
        return;
      }

      setHoverInfo({
        events,
        x: param.point.x,
        y: param.point.y,
        candleClose: close,
        candleDate: dateStr,
      });
    });

    chartRef.current = chart;
    seriesRef.current = series;

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
  }, [data, markers, height, resolvedTheme, eventsByDate]);

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
      <div className="relative">
        <div ref={containerRef} className="w-full" style={{ height }} />
        {hoverInfo && (
          <div
            className="absolute pointer-events-none z-20 bg-slate-900/95 dark:bg-slate-100/95 text-white dark:text-slate-900 rounded-lg shadow-xl px-3 py-2 text-xs leading-relaxed"
            style={{
              // 自动避免溢出右/下
              left: Math.min(hoverInfo.x + 12, (containerRef.current?.clientWidth || 800) - 320),
              top: Math.min(hoverInfo.y + 12, height - 180),
              maxWidth: 320,
              minWidth: 220,
            }}
          >
            <div className="font-semibold tabular-nums mb-1.5 pb-1.5 border-b border-white/10 dark:border-slate-900/10">
              {hoverInfo.candleDate}
              {hoverInfo.candleClose != null && (
                <span className="ml-2 font-normal text-slate-300 dark:text-slate-600">
                  {t("收盘")} ${hoverInfo.candleClose.toFixed(2)}
                </span>
              )}
            </div>
            <div className="space-y-1.5">
              {hoverInfo.events.map((ev, i) => (
                <div key={i} className="flex items-start gap-2">
                  <span
                    className="mt-1 w-2 h-2 rounded-full flex-shrink-0"
                    style={{ backgroundColor: ev.color }}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="font-medium" style={{ color: ev.color }}>
                      {ev.title}
                    </div>
                    {ev.detail && (
                      <div className="text-slate-300 dark:text-slate-600 mt-0.5 text-[11px] break-words">
                        {ev.detail}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
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
