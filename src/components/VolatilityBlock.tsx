"use client";

import { useEffect, useMemo, useState } from "react";
import { Area, AreaChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import {
  computeHV,
  computeHVRank,
  computeHVSeries,
  interpretIVHVRatio,
  type PriceCandle,
} from "@/lib/volatility";
import { useLocale } from "./LocaleProvider";
import ScenarioBadge from "./ScenarioBadge";
import Term from "./Term";

/**
 * 波动率分析模块 — 客户端读取 /prices/{ticker}.json 算 HV30 + IV/HV
 *
 * 显示:
 * - HV30 当前 + 1 年区间
 * - HV Rank (当前 HV 在 1 年区间的百分位)
 * - IV/HV 比值 + 解读
 * - HV30 1 年走势图 (sparkline)
 */
export default function VolatilityBlock({
  ticker,
  atmIv,
}: {
  ticker: string;
  atmIv: number | null;
}) {
  const { t } = useLocale();
  const [candles, setCandles] = useState<PriceCandle[] | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch(`/prices/${ticker}.json`, { cache: "force-cache" })
      .then(async r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const data = await r.json();
        if (!cancelled) {
          setCandles(data.candles || null);
          setLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setCandles(null);
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [ticker]);

  const stats = useMemo(() => {
    if (!candles || candles.length < 31) return null;
    const series = computeHVSeries(candles, 30);
    if (series.length === 0) return null;
    const current = series[series.length - 1].hv;
    const min = Math.min(...series.map(s => s.hv));
    const max = Math.max(...series.map(s => s.hv));
    const median = [...series.map(s => s.hv)].sort((a, b) => a - b)[Math.floor(series.length / 2)];
    const rank = computeHVRank(series, current);
    return { series, current, min, max, median, rank };
  }, [candles]);

  if (loading) {
    return (
      <div className="py-6 text-center text-sm text-slate-400 dark:text-slate-500 italic">
        {t("加载波动率数据…")}
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="py-6 text-center text-sm text-slate-400 dark:text-slate-500 italic">
        {t("数据不足，无法计算 HV")}
      </div>
    );
  }

  const ivhvRatio = atmIv != null && stats.current > 0 ? atmIv / stats.current : null;
  const interp = ivhvRatio != null ? interpretIVHVRatio(ivhvRatio) : null;

  // sparkline 数据（按周采样减少点数）
  const sparkData = stats.series
    .filter((_, i) => i % 5 === 0 || i === stats.series.length - 1)
    .map(s => ({ t: s.t, hv: s.hv * 100 }));

  return (
    <div className="space-y-4">
      {/* 场景标签 */}
      {interp && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-slate-500 dark:text-slate-400 mr-1">{t("场景")}:</span>
          <ScenarioBadge color={interp.color} label={t(interp.label)} hint={interp.hint} />
          {stats.rank != null && stats.rank >= 80 && (
            <ScenarioBadge
              color="amber"
              label={t("HV 高位")}
              hint={`HV30 在 1 年区间的 ${stats.rank.toFixed(0)}% 分位`}
            />
          )}
          {stats.rank != null && stats.rank <= 20 && (
            <ScenarioBadge
              color="slate"
              label={t("HV 低位")}
              hint={`HV30 在 1 年区间的 ${stats.rank.toFixed(0)}% 分位`}
            />
          )}
        </div>
      )}

      {/* 关键指标 4 格 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat
          label={<>HV30 {t("当前")}</>}
          value={`${(stats.current * 100).toFixed(1)}%`}
          subtitle={`${t("1 年中位数")} ${(stats.median * 100).toFixed(1)}%`}
        />
        <Stat
          label={<>HV30 {t("1 年区间")}</>}
          value={`${(stats.min * 100).toFixed(0)}% - ${(stats.max * 100).toFixed(0)}%`}
          subtitle={
            stats.rank != null ? `${t("HV Rank")} ${stats.rank.toFixed(0)}%` : undefined
          }
        />
        <Stat
          label={<><Term term="ATM IV">ATM IV</Term> {t("当前")}</>}
          value={atmIv != null ? `${(atmIv * 100).toFixed(1)}%` : "—"}
          subtitle={atmIv == null ? t("无 IV 数据") : undefined}
        />
        <Stat
          label={<>IV / HV</>}
          value={ivhvRatio != null ? ivhvRatio.toFixed(2) : "—"}
          subtitle={interp?.label}
          colorOverride={
            interp?.color === "green"
              ? "text-emerald-600 dark:text-emerald-400"
              : interp?.color === "red"
              ? "text-red-600 dark:text-red-400"
              : interp?.color === "amber"
              ? "text-amber-600 dark:text-amber-400"
              : undefined
          }
        />
      </div>

      {/* HV30 1 年走势图 */}
      <div>
        <div className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
          {t("HV30 过去 1 年走势")}
        </div>
        <ResponsiveContainer width="100%" height={120}>
          <AreaChart data={sparkData} margin={{ top: 4, right: 8, left: 0, bottom: 4 }}>
            <defs>
              <linearGradient id="hvGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#6366f1" stopOpacity={0.4} />
                <stop offset="100%" stopColor="#6366f1" stopOpacity={0.05} />
              </linearGradient>
            </defs>
            <XAxis dataKey="t" tick={{ fontSize: 10, fill: "currentColor" }} stroke="rgba(148,163,184,0.5)"
              tickFormatter={(v: string) => v.slice(2, 7)}
              minTickGap={40}
            />
            <YAxis
              tick={{ fontSize: 10, fill: "currentColor" }}
              stroke="rgba(148,163,184,0.5)"
              tickFormatter={(v: number) => `${v.toFixed(0)}%`}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "rgba(15, 23, 42, 0.95)",
                border: "1px solid rgba(148, 163, 184, 0.3)",
                borderRadius: "6px",
                color: "#fff",
                fontSize: "11px",
              }}
              formatter={(value) => {
                const v = typeof value === "number" ? value : null;
                return [v != null ? `${v.toFixed(1)}%` : "—", "HV30"];
              }}
            />
            {atmIv != null && (
              <ReferenceLine
                y={atmIv * 100}
                stroke="#f59e0b"
                strokeDasharray="3 3"
                label={{ value: `IV ${(atmIv * 100).toFixed(0)}%`, fill: "#f59e0b", fontSize: 10, position: "right" }}
              />
            )}
            <Area
              type="monotone"
              dataKey="hv"
              stroke="#6366f1"
              strokeWidth={2}
              fill="url(#hvGradient)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <div className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
        <span className="font-medium">HV30</span> = {t("过去 30 个交易日实际波动率 (年化, 标准差 × √252)")}
        {" · "}
        <span className="font-medium">{t("IV/HV")}</span> = {t("隐含波动率 / 历史波动率, > 1.3 = IV 偏贵, < 0.7 = IV 偏便宜")}
        {" · "}
        <span className="font-medium">HV Rank</span> = {t("当前 HV30 在 1 年区间的百分位")}
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  subtitle,
  colorOverride,
}: {
  label: React.ReactNode;
  value: string;
  subtitle?: string;
  colorOverride?: string;
}) {
  return (
    <div className="p-3 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-lg">
      <div className="text-xs text-slate-500 dark:text-slate-400 mb-1">{label}</div>
      <div className={`text-lg font-semibold tabular-nums ${colorOverride || ""}`}>{value}</div>
      {subtitle && (
        <div className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">{subtitle}</div>
      )}
    </div>
  );
}
