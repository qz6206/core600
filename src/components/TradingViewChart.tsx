"use client";

import { useEffect, useRef, useState } from "react";
import { useTheme } from "next-themes";

/**
 * TradingView Advanced Chart Widget
 *
 * 文档: https://www.tradingview.com/widget/advanced-chart/
 *
 * 实现说明:
 * - 用 key={ticker+theme} 强制 remount, 主题切换时新建 widget
 * - 内嵌 widget div + 兄弟 script 的结构 (TV 官方规范)
 * - script 用 innerHTML 传配置 (JSON 字符串)
 *
 * 注意 ticker 格式: TradingView 对 BRK-B 用 BRK.B (用 . 不用 -)
 */

const TV_TICKER_OVERRIDES: Record<string, string> = {
  "BRK-B": "BRK.B",
  "BF-B": "BF.B",
};

function tvSymbol(ticker: string): string {
  return TV_TICKER_OVERRIDES[ticker] ?? ticker;
}

export default function TradingViewChart({
  ticker,
  height = 480,
}: {
  ticker: string;
  height?: number;
}) {
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // SSR / 第一次渲染：占位，避免 hydration mismatch + theme=undefined 闪烁
  if (!mounted) {
    return (
      <div
        className="w-full bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl flex items-center justify-center"
        style={{ height: `${height}px` }}
      >
        <span className="text-sm text-slate-400 dark:text-slate-500">{"加载 K 线图…"}</span>
      </div>
    );
  }

  return (
    <div className="w-full">
      {/* key 强制 remount: ticker / 主题变化时全新加载 */}
      <Widget key={`${ticker}-${resolvedTheme}`} ticker={ticker} theme={resolvedTheme === "dark" ? "dark" : "light"} height={height} />
      <div className="mt-2 text-xs text-slate-400 dark:text-slate-500 text-center">
        可加技术指标 / 画线 / 切换周期 · 拖拽移动 K 线 · 滚轮缩放
      </div>
    </div>
  );
}

function Widget({ ticker, theme, height }: { ticker: string; theme: "dark" | "light"; height: number }) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // 创建 script 并 append (TV 会自动找同级 .tradingview-widget-container__widget div)
    const script = document.createElement("script");
    script.src = "https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js";
    script.async = true;
    script.type = "text/javascript";
    script.innerHTML = JSON.stringify({
      autosize: true,
      symbol: tvSymbol(ticker),
      interval: "D",
      timezone: "America/New_York",
      theme,
      style: "1",
      locale: "zh_CN",
      enable_publishing: false,
      allow_symbol_change: false,
      hide_side_toolbar: false,
      hide_legend: false,
      hide_top_toolbar: false,
      withdateranges: true,
      details: false,
      studies: [],
      support_host: "https://www.tradingview.com",
    });

    container.appendChild(script);

    return () => {
      // cleanup: 移除 script + 清空 widget DOM
      if (script.parentNode) {
        script.parentNode.removeChild(script);
      }
    };
  }, [ticker, theme]);

  return (
    <div
      ref={containerRef}
      className="tradingview-widget-container w-full rounded-xl overflow-hidden"
      style={{ height: `${height}px` }}
    >
      <div
        className="tradingview-widget-container__widget"
        style={{ height: "100%", width: "100%" }}
      />
    </div>
  );
}
