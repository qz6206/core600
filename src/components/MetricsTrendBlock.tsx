"use client";

import { useMemo } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { ShareCountQuarter, CashFlowQuarter } from "@/lib/fmp";
import { useLocale } from "./LocaleProvider";

/**
 * 关键指标趋势图 — 8 季度，4 个图表 (2x2)
 *
 *   ┌────────────────┬────────────────┐
 *   │ 营收 + YoY%    │ 利润率 (3 lines)│
 *   ├────────────────┼────────────────┤
 *   │ 摊薄股数趋势   │ FCF / 回购 / SBC│
 *   └────────────────┴────────────────┘
 */

function formatUSDShort(n: number | null | undefined): string {
  if (n == null) return "—";
  if (Math.abs(n) >= 1e9) return `$${(n / 1e9).toFixed(1)}B`;
  if (Math.abs(n) >= 1e6) return `$${(n / 1e6).toFixed(0)}M`;
  if (Math.abs(n) >= 1e3) return `$${(n / 1e3).toFixed(0)}K`;
  return `$${n}`;
}

function formatShares(n: number | null | undefined): string {
  if (n == null) return "—";
  if (n >= 1e9) return `${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(0)}M`;
  return `${n}`;
}

function quarterLabel(q: { date: string | null; period: string | null; calendar_year: string | null }): string {
  if (q.calendar_year && q.period) return `${q.calendar_year.slice(2)}${q.period}`;
  if (q.date) {
    const d = q.date.slice(2, 7);
    return d.replace("-", "/");
  }
  return "—";
}

export default function MetricsTrendBlock({
  shares,
  cashFlow,
}: {
  shares: ShareCountQuarter[];
  cashFlow: CashFlowQuarter[];
}) {
  const { t } = useLocale();

  // 升序（最旧 → 最新）
  const sorted = useMemo(() => {
    return [...shares].sort((a, b) => (a.date || "").localeCompare(b.date || ""));
  }, [shares]);

  // 营收 + YoY%
  const revenueData = useMemo(() => {
    return sorted.map((s, i) => {
      const yoyIdx = i - 4;
      const yoyRev = yoyIdx >= 0 ? sorted[yoyIdx]?.revenue : null;
      const yoy =
        s.revenue && yoyRev && yoyRev !== 0 ? ((s.revenue - yoyRev) / yoyRev) * 100 : null;
      return {
        label: quarterLabel(s),
        revenue: s.revenue,
        yoy,
      };
    });
  }, [sorted]);

  // 利润率（毛利 / 营业 / 净利）
  const marginData = useMemo(() => {
    return sorted.map(s => ({
      label: quarterLabel(s),
      gross: s.gross_margin != null ? s.gross_margin * 100 : null,
      operating: s.operating_margin != null ? s.operating_margin * 100 : null,
      net:
        s.net_margin != null
          ? s.net_margin * 100
          : s.net_income && s.revenue
          ? (s.net_income / s.revenue) * 100
          : null,
    }));
  }, [sorted]);

  // 摊薄股数
  const sharesData = useMemo(() => {
    return sorted.map(s => ({
      label: quarterLabel(s),
      diluted: s.weighted_avg_diluted,
    }));
  }, [sorted]);

  // FCF / 回购 / SBC（要按 cashFlow 数据，date 对齐）
  const cfMap = useMemo(() => {
    const m = new Map<string, CashFlowQuarter>();
    for (const c of cashFlow) {
      if (c.date) m.set(c.date, c);
    }
    return m;
  }, [cashFlow]);

  const capitalData = useMemo(() => {
    return sorted.map(s => {
      const cf = s.date ? cfMap.get(s.date) : null;
      return {
        label: quarterLabel(s),
        fcf: cf?.fcf ?? null,
        buyback: cf?.buyback != null ? Math.abs(cf.buyback) : null,
        sbc: cf?.sbc ?? null,
      };
    });
  }, [sorted, cfMap]);

  return (
    <div>
      <div className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-3">
        {t("8 季度趋势")}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* 营收 + YoY% */}
        <ChartCard title={t("营收 + 同比增速")} subtitle={t("柱: 营收 / 线: 同比 %")}>
          <ResponsiveContainer width="100%" height={200}>
            <ComposedChart data={revenueData} margin={{ top: 8, right: 12, left: 0, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.15)" />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: "currentColor" }} stroke="rgba(148,163,184,0.5)" />
              <YAxis
                yAxisId="left"
                tick={{ fontSize: 11, fill: "currentColor" }}
                stroke="rgba(148,163,184,0.5)"
                tickFormatter={(v: number) => (v >= 1e9 ? `${(v / 1e9).toFixed(0)}B` : `${(v / 1e6).toFixed(0)}M`)}
              />
              <YAxis
                yAxisId="right"
                orientation="right"
                tick={{ fontSize: 11, fill: "currentColor" }}
                stroke="rgba(148,163,184,0.5)"
                tickFormatter={(v: number) => `${v.toFixed(0)}%`}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "rgba(15, 23, 42, 0.95)",
                  border: "1px solid rgba(148, 163, 184, 0.3)",
                  borderRadius: "6px",
                  color: "#fff",
                  fontSize: "12px",
                }}
                formatter={(value, name) => {
                  const v = typeof value === "number" ? value : null;
                  if (name === "revenue") return [formatUSDShort(v), t("营收")];
                  if (name === "yoy") return [v != null ? `${v.toFixed(1)}%` : "—", t("同比")];
                  return [String(value), String(name)];
                }}
              />
              <Bar yAxisId="left" dataKey="revenue" fill="#6366f1" radius={[3, 3, 0, 0]} />
              <Line
                yAxisId="right"
                type="monotone"
                dataKey="yoy"
                stroke="#10b981"
                strokeWidth={2}
                dot={{ r: 3 }}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* 利润率 */}
        <ChartCard title={t("利润率")} subtitle={t("毛利率 / 营业利润率 / 净利率")}>
          <ResponsiveContainer width="100%" height={200}>
            <ComposedChart data={marginData} margin={{ top: 8, right: 12, left: 0, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.15)" />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: "currentColor" }} stroke="rgba(148,163,184,0.5)" />
              <YAxis
                tick={{ fontSize: 11, fill: "currentColor" }}
                stroke="rgba(148,163,184,0.5)"
                tickFormatter={(v: number) => `${v.toFixed(0)}%`}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "rgba(15, 23, 42, 0.95)",
                  border: "1px solid rgba(148, 163, 184, 0.3)",
                  borderRadius: "6px",
                  color: "#fff",
                  fontSize: "12px",
                }}
                formatter={(value, name) => {
                  const labelMap: Record<string, string> = {
                    gross: t("毛利率"),
                    operating: t("营业利润率"),
                    net: t("净利率"),
                  };
                  const v = typeof value === "number" ? value : null;
                  return [v != null ? `${v.toFixed(1)}%` : "—", labelMap[String(name)] || String(name)];
                }}
              />
              <Line type="monotone" dataKey="gross" stroke="#10b981" strokeWidth={2} dot={{ r: 3 }} />
              <Line type="monotone" dataKey="operating" stroke="#6366f1" strokeWidth={2} dot={{ r: 3 }} />
              <Line type="monotone" dataKey="net" stroke="#f59e0b" strokeWidth={2} dot={{ r: 3 }} />
            </ComposedChart>
          </ResponsiveContainer>
          <Legend
            items={[
              { color: "#10b981", label: t("毛利率") },
              { color: "#6366f1", label: t("营业利润率") },
              { color: "#f59e0b", label: t("净利率") },
            ]}
          />
        </ChartCard>

        {/* 摊薄股数 */}
        <ChartCard
          title={t("摊薄股数趋势")}
          subtitle={t("下降 = 回购大于发行；上升 = 稀释")}
        >
          <ResponsiveContainer width="100%" height={200}>
            <ComposedChart data={sharesData} margin={{ top: 8, right: 12, left: 0, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.15)" />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: "currentColor" }} stroke="rgba(148,163,184,0.5)" />
              <YAxis
                tick={{ fontSize: 11, fill: "currentColor" }}
                stroke="rgba(148,163,184,0.5)"
                domain={["dataMin - dataMin * 0.005", "dataMax + dataMax * 0.005"]}
                tickFormatter={(v: number) => formatShares(v)}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "rgba(15, 23, 42, 0.95)",
                  border: "1px solid rgba(148, 163, 184, 0.3)",
                  borderRadius: "6px",
                  color: "#fff",
                  fontSize: "12px",
                }}
                formatter={(value) => {
                  const v = typeof value === "number" ? value : null;
                  return [formatShares(v), t("摊薄股数")];
                }}
              />
              <Line type="monotone" dataKey="diluted" stroke="#8b5cf6" strokeWidth={2} dot={{ r: 4 }} />
            </ComposedChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* FCF / 回购 / SBC */}
        <ChartCard title={t("现金流 + 回购 + SBC")} subtitle={t("绿: FCF · 蓝: 回购 · 橙: SBC")}>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={capitalData} margin={{ top: 8, right: 12, left: 0, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.15)" />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: "currentColor" }} stroke="rgba(148,163,184,0.5)" />
              <YAxis
                tick={{ fontSize: 11, fill: "currentColor" }}
                stroke="rgba(148,163,184,0.5)"
                tickFormatter={(v: number) => (Math.abs(v) >= 1e9 ? `${(v / 1e9).toFixed(0)}B` : `${(v / 1e6).toFixed(0)}M`)}
              />
              <ReferenceLine y={0} stroke="rgba(148,163,184,0.4)" />
              <Tooltip
                contentStyle={{
                  backgroundColor: "rgba(15, 23, 42, 0.95)",
                  border: "1px solid rgba(148, 163, 184, 0.3)",
                  borderRadius: "6px",
                  color: "#fff",
                  fontSize: "12px",
                }}
                formatter={(value, name) => {
                  const labelMap: Record<string, string> = {
                    fcf: t("FCF"),
                    buyback: t("回购"),
                    sbc: t("SBC"),
                  };
                  const v = typeof value === "number" ? value : null;
                  return [formatUSDShort(v), labelMap[String(name)] || String(name)];
                }}
              />
              <Bar dataKey="fcf" fill="#10b981" radius={[3, 3, 0, 0]} />
              <Bar dataKey="buyback" fill="#3b82f6" radius={[3, 3, 0, 0]} />
              <Bar dataKey="sbc" fill="#f59e0b" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
          <Legend
            items={[
              { color: "#10b981", label: t("FCF") },
              { color: "#3b82f6", label: t("回购") },
              { color: "#f59e0b", label: t("SBC") },
            ]}
          />
        </ChartCard>
      </div>
    </div>
  );
}

function ChartCard({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="p-3 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-lg text-slate-600 dark:text-slate-400">
      <div className="text-sm font-medium text-slate-700 dark:text-slate-300">{title}</div>
      {subtitle && <div className="text-xs text-slate-400 dark:text-slate-500 mb-2">{subtitle}</div>}
      {children}
    </div>
  );
}

function Legend({ items }: { items: { color: string; label: string }[] }) {
  return (
    <div className="flex flex-wrap gap-3 mt-2 text-xs justify-center">
      {items.map((item, i) => (
        <div key={i} className="flex items-center gap-1.5">
          <span
            className="w-3 h-3 rounded-sm"
            style={{ backgroundColor: item.color }}
          />
          <span className="text-slate-500 dark:text-slate-400">{item.label}</span>
        </div>
      ))}
    </div>
  );
}
