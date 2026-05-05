"use client";

import Link from "next/link";
import ThemeToggle from "@/components/ThemeToggle";
import LocaleToggle from "@/components/LocaleToggle";
import TimeDisplay from "@/components/TimeDisplay";
import Footer from "@/components/Footer";
import { useLocale } from "@/components/LocaleProvider";

export default function Home() {
  const { t } = useLocale();

  const features = [
    // 第一行：杀手锏
    { icon: "🎙️", title: "财报会议", desc: "中文全文" },
    { icon: "👤", title: "内部人交易", desc: "高管买卖动向追踪" },
    { icon: "🏛️", title: "机构持仓", desc: "13F 明星基金动态" },
    // 第二行：实时信号
    { icon: "📰", title: "8-K 公司重大事项", desc: "中文化解读时间线" },
    { icon: "🔮", title: "分析师预期", desc: "EPS / 营收预期 + Beat 历史" },
    { icon: "🎯", title: "期权异动", desc: "聪明钱大单监控" },
    // 第三行:深度 + 工具 + 综合
    { icon: "📉", title: "股本动态", desc: "回购 + SBC 稀释追踪" },
    { icon: "📅", title: "财报日历", desc: "解禁日历 · 分红日历" },
    { icon: "📊", title: "智能评分", desc: "多维度综合资金评分" },
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

          <Link
            href="/stocks"
            className="inline-block px-8 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium transition shadow-lg shadow-indigo-500/30"
          >
            {t("查看 516 只股票列表")} →
          </Link>
        </div>

        {/* 功能预览卡片 */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-16">
          {features.map((f) => (
            <div
              key={f.title}
              className="p-5 bg-white/80 dark:bg-white/5 backdrop-blur border border-slate-200 dark:border-white/10 rounded-xl hover:bg-white dark:hover:bg-white/10 transition shadow-sm"
            >
              <div className="text-3xl mb-2">{f.icon}</div>
              <div className="font-semibold text-slate-900 dark:text-white mb-1">{t(f.title)}</div>
              <div className="text-sm text-slate-600 dark:text-slate-400">{t(f.desc)}</div>
            </div>
          ))}
        </div>

      </div>
      <Footer />
    </main>
  );
}
