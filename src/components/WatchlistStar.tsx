"use client";

import { useEffect, useState } from "react";
import { isInWatchlist, toggleWatchlist } from "@/lib/watchlist";
import { useLocale } from "./LocaleProvider";

/**
 * 收藏 ⭐ 按钮 — 点击切换 watchlist 状态
 *
 * 用 localStorage，刷新页面状态保持。同一 tab 多个 button 通过自定义事件同步。
 */
export default function WatchlistStar({
  ticker,
  size = "md",
}: {
  ticker: string;
  size?: "sm" | "md" | "lg";
}) {
  const { t } = useLocale();
  const [active, setActive] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    setActive(isInWatchlist(ticker));
    // 监听同 tab 内 watchlist 变化
    const handler = () => setActive(isInWatchlist(ticker));
    window.addEventListener("core600:watchlist-changed", handler);
    // 监听跨 tab storage 变化
    const storageHandler = (e: StorageEvent) => {
      if (e.key === "core600_watchlist") setActive(isInWatchlist(ticker));
    };
    window.addEventListener("storage", storageHandler);
    return () => {
      window.removeEventListener("core600:watchlist-changed", handler);
      window.removeEventListener("storage", storageHandler);
    };
  }, [ticker]);

  const sizeMap: Record<string, { box: string; icon: string }> = {
    sm: { box: "w-7 h-7", icon: "text-base" },
    md: { box: "w-9 h-9", icon: "text-lg" },
    lg: { box: "w-11 h-11", icon: "text-2xl" },
  };
  const cls = sizeMap[size];

  // SSR 时不显示状态（避免 hydration mismatch）
  const showActive = mounted && active;

  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        const next = toggleWatchlist(ticker);
        setActive(next);
      }}
      className={`${cls.box} flex items-center justify-center rounded-lg border transition ${
        showActive
          ? "bg-amber-100 dark:bg-amber-500/20 border-amber-300 dark:border-amber-500/40 text-amber-600 dark:text-amber-300 hover:bg-amber-200 dark:hover:bg-amber-500/30"
          : "bg-white/60 dark:bg-white/5 border-slate-200 dark:border-white/10 text-slate-400 dark:text-slate-500 hover:border-amber-300 dark:hover:border-amber-500/40 hover:text-amber-500 dark:hover:text-amber-400"
      }`}
      aria-label={showActive ? t("取消关注") : t("加入关注")}
      title={showActive ? t("已关注 · 点击取消") : t("加入关注")}
    >
      <span className={cls.icon}>{showActive ? "★" : "☆"}</span>
    </button>
  );
}
