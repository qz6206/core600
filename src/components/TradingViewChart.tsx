"use client";

import { useEffect, useRef } from "react";
import { useTheme } from "next-themes";

/**
 * TradingView Advanced Chart Widget
 *
 * 嵌入 TradingView 免费 widget — 用户可加 MA / RSI / MACD / 画线等
 * 文档: https://www.tradingview.com/widget/advanced-chart/
 *
 * - 主题自动跟 next-themes (light/dark)
 * - 中文界面 (locale: zh_CN)
 * - 默认 D 线，用户可切换 (1m/5m/15m/1h/4h/D/W/M)
 * - 自动适配父容器宽度
 *
 * 注意 ticker 格式: TradingView 对 BRK-B 用 BRK.B (用 . 不用 -)
 */

// 部分股票 TradingView 用的代码不同（带 . 而非 -）
const TV_TICKER_OVERRIDES: Record<string, string> = {
  "BRK-B": "BRK.B",
  "BF-B": "BF.B",
};

// SP500 / NDX 大部分在 NASDAQ 或 NYSE，TradingView 一般能自动识别
// 我们不强制加交易所前缀，让 TV 自己 resolve
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
  const containerRef = useRef<HTMLDivElement>(null);
  const { resolvedTheme } = useTheme();

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // 清空旧 widget (主题切换时重新挂载)
    container.innerHTML = "";

    // 1) 先创建 widget 的内嵌 div (TradingView 把图表挂到这里 — 必需)
    const widgetDiv = document.createElement("div");
    widgetDiv.className = "tradingview-widget-container__widget";
    widgetDiv.style.height = "100%";
    widgetDiv.style.width = "100%";
    container.appendChild(widgetDiv);

    // 2) 再加 script (TradingView 推荐方式: 把 config 放在 script 的 innerHTML)
    const script = document.createElement("script");
    script.src = "https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js";
    script.async = true;
    script.type = "text/javascript";
    script.innerHTML = JSON.stringify({
      autosize: true,
      symbol: tvSymbol(ticker),
      interval: "D",
      timezone: "America/New_York",
      theme: resolvedTheme === "dark" ? "dark" : "light",
      style: "1",          // 1 = 蜡烛图 (Candles)
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
      if (container) container.innerHTML = "";
    };
  }, [ticker, resolvedTheme]);

  return (
    <div className="w-full">
      <div
        ref={containerRef}
        className="tradingview-widget-container w-full rounded-xl overflow-hidden"
        style={{ height: `${height}px` }}
      />
      <div className="mt-2 text-xs text-slate-400 dark:text-slate-500 text-center">
        可加技术指标 / 画线 / 切换周期 · 拖拽移动 K 线 · 滚轮缩放
      </div>
    </div>
  );
}
