// 货币换算工具
// 实时汇率应通过 API 获取，这里先用估算值方便演示

export const FX_RATES = {
  USD_CNY: 7.20,  // 美元 → 人民币
  USD_HKD: 7.78,  // 美元 → 港币
};

export function formatUSD(amount: number, decimals = 2): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(amount);
}

export function formatLargeUSD(amount: number): string {
  // 大数字简化显示：$4.5T、$125B、$48M
  const abs = Math.abs(amount);
  if (abs >= 1e12) return `$${(amount / 1e12).toFixed(2)}T`;
  if (abs >= 1e9) return `$${(amount / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `$${(amount / 1e6).toFixed(2)}M`;
  if (abs >= 1e3) return `$${(amount / 1e3).toFixed(2)}K`;
  return `$${amount.toFixed(2)}`;
}

export function usdToCny(usd: number): number {
  return usd * FX_RATES.USD_CNY;
}

export function usdToHkd(usd: number): number {
  return usd * FX_RATES.USD_HKD;
}

// 给定美元金额，返回三种货币的字符串
export function formatMultiCurrency(usd: number): string {
  const cny = usdToCny(usd);
  const hkd = usdToHkd(usd);
  return `${formatLargeUSD(usd)} ≈ ¥${formatLargeNumber(cny)} ≈ HK$${formatLargeNumber(hkd)}`;
}

function formatLargeNumber(n: number): string {
  const abs = Math.abs(n);
  if (abs >= 1e12) return `${(n / 1e12).toFixed(2)}T`;
  if (abs >= 1e9) return `${(n / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `${(n / 1e6).toFixed(2)}M`;
  if (abs >= 1e3) return `${(n / 1e3).toFixed(2)}K`;
  return n.toFixed(2);
}
