/**
 * 关注夹（Watchlist）— 用 localStorage 存收藏的股票 ticker 列表
 *
 * 没有账号系统，数据完全在浏览器本地：
 * - 跨浏览器/设备不同步
 * - 清浏览器数据会丢
 * - 所有读写都在 client-side
 */

const STORAGE_KEY = "core600_watchlist";

/** 读取所有收藏的 ticker（始终返回数组） */
export function readWatchlist(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(x => typeof x === "string") : [];
  } catch {
    return [];
  }
}

/** 完整覆盖写入 */
export function writeWatchlist(tickers: string[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(tickers));
    // 触发 storage event（同 tab 也派发）便于其他 component 同步
    window.dispatchEvent(new CustomEvent("core600:watchlist-changed", { detail: tickers }));
  } catch {
    // localStorage 满 / 禁用 → 静默
  }
}

/** 切换某个 ticker 的收藏状态，返回切换后是否在 watchlist */
export function toggleWatchlist(ticker: string): boolean {
  const cur = readWatchlist();
  const idx = cur.indexOf(ticker);
  if (idx >= 0) {
    cur.splice(idx, 1);
    writeWatchlist(cur);
    return false;
  } else {
    cur.push(ticker);
    writeWatchlist(cur);
    return true;
  }
}

/** 是否在 watchlist 里 */
export function isInWatchlist(ticker: string): boolean {
  return readWatchlist().includes(ticker);
}
