"use client";

import Link from "next/link";
import ThemeToggle from "@/components/ThemeToggle";
import LocaleToggle from "@/components/LocaleToggle";
import TimeDisplay from "@/components/TimeDisplay";
import Footer from "@/components/Footer";
import { useLocale } from "@/components/LocaleProvider";

export default function Home() {
  const { t } = useLocale();

  // 点击后跳转到 NVDA 股票详情页对应 section（用 NVDA 作示范）
  const DEMO_TICKER = "NVDA";
  const features = [
    // 第一行：财报核心
    { icon: "📊", title: "财务概览", desc: "营收 / 毛利率 / FCF / Capex", anchor: "financial-overview" },
    { icon: "🎙️", title: "财报会议", desc: "中文全文翻译", anchor: "transcript" },
    { icon: "📝", title: "财报点评", desc: "自动解读 + 倾向标签", anchor: "earnings-interpretation" },
    // 第二行：日历 + 信号
    { icon: "📅", title: "财报日历", desc: "下次财报 + 历史发布日", anchor: "earnings-calendar" },
    { icon: "🔮", title: "分析师预期", desc: "Beat 历史 + 评级变动", anchor: "analyst-estimates" },
    { icon: "📰", title: "8-K 公司重大事项", desc: "中文化摘要时间线", anchor: "form-8k" },
    // 第三行：监管 + 资金 + 期权
    { icon: "👤", title: "内部人交易", desc: "高管买卖动向追踪", anchor: "insider-trading" },
    { icon: "📉", title: "股本动态", desc: "回购 + SBC 稀释追踪", anchor: "capital-dynamics" },
    { icon: "🏛️", title: "机构持仓", desc: "13F 明星基金动态", anchor: "inst-13f" },
    { icon: "🎯", title: "期权异动", desc: "ATM IV + 聪明钱大单", anchor: "options-activity" },
  ];

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50 dark:from-slate-950 dark:via-slate-900 dark:to-indigo-950 text-slate-900 dark:text-white transition-colors">
      <div className="max-w-5xl mx-auto px-6 py-12">
        {/* 顶部工具栏 */}
        <div className="flex justify-between items-center mb-8">
          <TimeDisplay />
          <div className="flex items-center gap-2">
            <LocaleToggle />
            <ThemeToggle />
          </div>
        </div>

        {/* 标题 */}
        <div className="text-center mb-12">
          {/* Logo 图标 */}
          <div className="flex justify-center mb-6">
            <svg width="100" height="100" viewBox="0 0 60 60" xmlns="http://www.w3.org/2000/svg">
              <path d="M 12 12 L 48 12 L 48 17 L 17 17 L 17 43 L 48 43 L 48 48 L 12 48 Z" fill="#dc2626"/>
              <path d="M 17 28 L 48 28 L 48 48 L 43 48 L 43 33 L 17 33 Z" className="fill-slate-900 dark:fill-white"/>
            </svg>
          </div>

          <div className="inline-block px-4 py-1 mb-6 bg-indigo-100 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-300 rounded-full text-sm font-medium">
            🚀 {t("即将上线")}
          </div>
          <h1 className="text-6xl md:text-7xl font-bold mb-4 bg-gradient-to-r from-slate-900 via-indigo-700 to-purple-700 dark:from-white dark:via-indigo-200 dark:to-purple-200 bg-clip-text text-transparent">
            Core 600
          </h1>
          <p className="text-xl md:text-2xl text-slate-600 dark:text-slate-300 mb-2">
            {t("美股核心 600 强 · 一站式数据中心")}
          </p>
          <p className="text-base text-slate-500 dark:text-slate-400 mb-8">
            {t("标普 500 + 纳斯达克 100 · 中文用户专属")}
          </p>

          <div className="flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/stocks"
              className="inline-block px-8 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium transition shadow-lg shadow-indigo-500/30"
            >
              {t("查看 516 只股票列表")} →
            </Link>
            <Link
              href="/calendar"
              className="inline-block px-6 py-3 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-white/10 rounded-lg font-medium transition"
            >
              📅 {t("财报日历")}
            </Link>
          </div>
        </div>

        {/* 功能预览卡片 — 点击跳转 NVDA 对应 section */}
        <div className="text-xs text-slate-500 dark:text-slate-400 text-center mb-3">
          {t("点击下方功能卡片，跳转")} {DEMO_TICKER} {t("看示范效果")} ↓
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-16">
          {features.map((f) => (
            <Link
              key={f.title}
              href={`/stocks/${DEMO_TICKER}#${f.anchor}`}
              className="group block p-5 bg-white/80 dark:bg-white/5 backdrop-blur border border-slate-200 dark:border-white/10 rounded-xl hover:bg-white dark:hover:bg-white/10 hover:border-indigo-300 dark:hover:border-indigo-500/30 hover:shadow-md transition shadow-sm"
            >
              <div className="flex items-start justify-between mb-2">
                <div className="text-3xl">{f.icon}</div>
                <span className="text-xs text-slate-300 dark:text-slate-600 group-hover:text-indigo-500 dark:group-hover:text-indigo-400 transition">
                  →
                </span>
              </div>
              <div className="font-semibold text-slate-900 dark:text-white mb-1 group-hover:text-indigo-700 dark:group-hover:text-indigo-300 transition">
                {t(f.title)}
              </div>
              <div className="text-sm text-slate-600 dark:text-slate-400">{t(f.desc)}</div>
            </Link>
          ))}
        </div>

      </div>
      <Footer />
    </main>
  );
}
