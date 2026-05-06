/**
 * 历史波动率（HV）计算 — 用 1 年日线 OHLC 算 HV30
 *
 * HV30 = 标准差(过去 30 个交易日的对数收益率) × sqrt(252)
 *
 * 用途:
 * - 与 ATM IV (隐含波动率) 对比，判断 IV 高估/低估
 * - IV/HV > 1.3 → IV 偏贵 → 卖期权占优
 * - IV/HV < 0.7 → IV 偏便宜 → 买期权占优
 */

export type PriceCandle = { t: string; o: number; h: number; l: number; c: number; v?: number };

/** 单点 HV — 取最后 windowDays 根 K 线算 */
export function computeHV(candles: PriceCandle[], windowDays = 30): number | null {
  if (candles.length < windowDays + 1) return null;
  const recent = candles.slice(-(windowDays + 1));
  const logReturns: number[] = [];
  for (let i = 1; i < recent.length; i++) {
    const r = Math.log(recent[i].c / recent[i - 1].c);
    if (Number.isFinite(r)) logReturns.push(r);
  }
  if (logReturns.length < 2) return null;
  const mean = logReturns.reduce((a, b) => a + b, 0) / logReturns.length;
  const variance =
    logReturns.reduce((sum, r) => sum + (r - mean) ** 2, 0) / (logReturns.length - 1);
  return Math.sqrt(variance) * Math.sqrt(252); // 年化
}

/** HV 时序 — 每个有足够窗口的日期算一个 HV30 */
export function computeHVSeries(
  candles: PriceCandle[],
  windowDays = 30
): { t: string; hv: number }[] {
  if (candles.length < windowDays + 1) return [];
  const out: { t: string; hv: number }[] = [];
  for (let i = windowDays; i < candles.length; i++) {
    const window = candles.slice(i - windowDays, i + 1);
    const logReturns: number[] = [];
    for (let j = 1; j < window.length; j++) {
      const r = Math.log(window[j].c / window[j - 1].c);
      if (Number.isFinite(r)) logReturns.push(r);
    }
    if (logReturns.length < 2) continue;
    const mean = logReturns.reduce((a, b) => a + b, 0) / logReturns.length;
    const variance =
      logReturns.reduce((sum, r) => sum + (r - mean) ** 2, 0) / (logReturns.length - 1);
    const hv = Math.sqrt(variance) * Math.sqrt(252);
    if (Number.isFinite(hv)) out.push({ t: candles[i].t, hv });
  }
  return out;
}

/** 给定 HV 序列，求 HV Rank (current 在 [min, max] 区间的百分位) */
export function computeHVRank(series: { hv: number }[], current: number): number | null {
  if (series.length === 0 || !Number.isFinite(current)) return null;
  const min = Math.min(...series.map(s => s.hv));
  const max = Math.max(...series.map(s => s.hv));
  if (max <= min) return null;
  const rank = ((current - min) / (max - min)) * 100;
  return Math.max(0, Math.min(100, rank));
}

/** IV/HV 比值的语义解读 */
export function interpretIVHVRatio(ratio: number): {
  label: string;
  color: "green" | "amber" | "red" | "slate";
  hint: string;
} {
  if (ratio >= 1.5) {
    return {
      label: "IV 大幅高估",
      color: "red",
      hint: `IV/HV = ${ratio.toFixed(2)} (≥1.5)，市场预期波动远大于实际，期权偏贵；适合卖方`,
    };
  }
  if (ratio >= 1.2) {
    return {
      label: "IV 偏贵",
      color: "amber",
      hint: `IV/HV = ${ratio.toFixed(2)} (1.2-1.5)，IV 比实际波动高 20%+；卖期权占优`,
    };
  }
  if (ratio <= 0.7) {
    return {
      label: "IV 偏便宜",
      color: "green",
      hint: `IV/HV = ${ratio.toFixed(2)} (≤0.7)，IV 低于实际波动；买期权占优`,
    };
  }
  if (ratio <= 0.85) {
    return {
      label: "IV 略低",
      color: "slate",
      hint: `IV/HV = ${ratio.toFixed(2)} (0.7-0.85)，IV 略偏低`,
    };
  }
  return {
    label: "IV 合理",
    color: "slate",
    hint: `IV/HV = ${ratio.toFixed(2)} (0.85-1.2)，IV 与实际波动接近`,
  };
}
