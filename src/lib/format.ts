// 数字格式化工具

/** 格式化美元金额：$4.5T、$125B、$48M、$1.2K、$45.30 */
export function formatUSD(amount: number | undefined | null): string {
  if (amount === undefined || amount === null || isNaN(amount)) return "—";
  const abs = Math.abs(amount);
  if (abs >= 1e12) return `$${(amount / 1e12).toFixed(2)}T`;
  if (abs >= 1e9) return `$${(amount / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `$${(amount / 1e6).toFixed(2)}M`;
  if (abs >= 1e3) return `$${(amount / 1e3).toFixed(2)}K`;
  return `$${amount.toFixed(2)}`;
}

/** 价格：$185.30 */
export function formatPrice(price: number | undefined | null): string {
  if (price === undefined || price === null || isNaN(price)) return "—";
  return `$${price.toFixed(2)}`;
}

/** 百分比：+1.23% / -2.45% */
export function formatPercent(pct: number | undefined | null, withSign = true): string {
  if (pct === undefined || pct === null || isNaN(pct)) return "—";
  const sign = withSign && pct > 0 ? "+" : "";
  return `${sign}${pct.toFixed(2)}%`;
}

/** 涨跌色 class */
export function colorClass(value: number | undefined | null): string {
  if (value === undefined || value === null || isNaN(value)) return "text-slate-500";
  if (value > 0) return "text-emerald-600 dark:text-emerald-400";
  if (value < 0) return "text-red-600 dark:text-red-400";
  return "text-slate-500";
}

/** 大数字简化：4500 亿 / 1.2 万亿 */
export function formatLargeNumberCN(amount: number | undefined | null): string {
  if (amount === undefined || amount === null || isNaN(amount)) return "—";
  const abs = Math.abs(amount);
  if (abs >= 1e12) return `$${(amount / 1e12).toFixed(2)} 万亿`;
  if (abs >= 1e8) return `$${(amount / 1e8).toFixed(2)} 亿`;
  if (abs >= 1e4) return `$${(amount / 1e4).toFixed(2)} 万`;
  return `$${amount.toFixed(2)}`;
}

/** 季度标签：2026 Q4 / FY2026 Q4 */
export function quarterLabel(year: string | number, period: string): string {
  return `${year} ${period}`;
}

/** 同比/环比变化（输入两个数值，返回带符号百分比）*/
export function calcChange(current: number, previous: number): number | null {
  if (!previous || isNaN(current) || isNaN(previous)) return null;
  return ((current - previous) / Math.abs(previous)) * 100;
}
