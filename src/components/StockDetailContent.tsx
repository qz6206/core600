"use client";

import Link from "next/link";
import ThemeToggle from "@/components/ThemeToggle";
import LocaleToggle from "@/components/LocaleToggle";
import TimeDisplay from "@/components/TimeDisplay";
import Footer from "@/components/Footer";
import { useLocale } from "@/components/LocaleProvider";
import type { Stock, SECTOR_CN as SC } from "@/lib/types";
import { SECTOR_CN, SECTOR_COLORS } from "@/lib/types";
import type { FMPProfile, FMPQuote, FMPIncomeQuarter } from "@/lib/fmp";
import type { EdgarFiling } from "@/lib/edgar";
import { filingUrl } from "@/lib/edgar";
import {
  formatUSD,
  formatPrice,
  formatPercent,
  colorClass,
  calcChange,
} from "@/lib/format";

interface Overview {
  profile: FMPProfile | null;
  quote: FMPQuote | null;
  quarters: FMPIncomeQuarter[];
}

interface Props {
  stock: Stock;
  overview: Overview;
  form4?: EdgarFiling[];
}

export default function StockDetailContent({ stock, overview, form4 = [] }: Props) {
  const { t } = useLocale();
  const { profile, quote, quarters } = overview;

  const sectorColor =
    SECTOR_COLORS[stock.sector] ||
    "bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-500/20 dark:text-slate-300 dark:border-slate-500/30";

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50 dark:from-slate-950 dark:via-slate-900 dark:to-indigo-950 text-slate-900 dark:text-white transition-colors">
      <div className="max-w-5xl mx-auto px-6 py-8">
        {/* 顶部工具栏 */}
        <div className="flex justify-between items-center mb-6">
          <TimeDisplay />
          <div className="flex items-center gap-2">
            <LocaleToggle />
            <ThemeToggle />
          </div>
        </div>

        {/* 顶部导航 */}
        <nav className="flex items-center justify-between mb-8">
          <Link href="/" className="flex items-center gap-3 hover:opacity-80 transition">
            <svg width="32" height="32" viewBox="0 0 60 60" xmlns="http://www.w3.org/2000/svg">
              <path d="M 12 12 L 48 12 L 48 17 L 17 17 L 17 43 L 48 43 L 48 48 L 12 48 Z" fill="#dc2626"/>
              <path d="M 17 28 L 48 28 L 48 48 L 43 48 L 43 33 L 17 33 Z" className="fill-slate-900 dark:fill-white"/>
            </svg>
            <span className="text-xl font-bold bg-gradient-to-r from-slate-900 to-indigo-700 dark:from-white dark:to-indigo-300 bg-clip-text text-transparent">
              Core 600
            </span>
          </Link>
          <Link
            href="/stocks"
            className="text-sm text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition"
          >
            ← {t("股票列表")}
          </Link>
        </nav>

        {/* 股票头部信息 */}
        <div className="mb-8 p-6 bg-white/80 dark:bg-white/5 backdrop-blur border border-slate-200 dark:border-white/10 rounded-2xl shadow-sm">
          <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
            <div>
              <div className="flex items-baseline gap-3 mb-2">
                <h1 className="text-4xl font-bold">{stock.ticker}</h1>
                <div className="flex gap-1.5">
                  {stock.in_sp500 && (
                    <span className="px-2 py-0.5 text-xs bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300 rounded">
                      S&P 500
                    </span>
                  )}
                  {stock.in_nasdaq100 && (
                    <span className="px-2 py-0.5 text-xs bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300 rounded">
                      NDX 100
                    </span>
                  )}
                </div>
              </div>

              {stock.name_cn && (
                <div className="text-xl font-medium text-slate-700 dark:text-slate-300 mb-1">
                  {t(stock.name_cn)}
                </div>
              )}
              <div className="text-base text-slate-500 dark:text-slate-400 mb-3">
                {stock.name}
              </div>

              {stock.sector && (
                <span className={`inline-block px-2 py-0.5 text-xs rounded border ${sectorColor}`}>
                  {t(SECTOR_CN[stock.sector] || stock.sector)}
                </span>
              )}
            </div>

            {/* 价格区 */}
            {quote && (
              <div className="text-right">
                <div className="text-4xl font-bold mb-1">
                  {formatPrice(quote.price)}
                </div>
                <div className={`text-base font-semibold ${colorClass(quote.changesPercentage)}`}>
                  {quote.change > 0 ? "▲" : quote.change < 0 ? "▼" : "—"}{" "}
                  {formatPercent(quote.changesPercentage)} ({formatPrice(Math.abs(quote.change))})
                </div>
              </div>
            )}
          </div>

          {/* 快照指标 */}
          {quote && (
            <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
              <Metric label={t("市值")} value={formatUSD(quote.marketCap)} />
              <Metric label={t("PE")} value={quote.pe ? quote.pe.toFixed(2) : "—"} />
              <Metric label="EPS" value={quote.eps ? `$${quote.eps.toFixed(2)}` : "—"} />
              <Metric
                label={t("52周区间")}
                value={`${formatPrice(quote.yearLow)} - ${formatPrice(quote.yearHigh)}`}
                small
              />
              <Metric label={t("成交量")} value={formatVolume(quote.volume)} />
              <Metric label={t("均量")} value={formatVolume(quote.avgVolume)} />
              <Metric
                label="50日均价"
                value={formatPrice(quote.priceAvg50)}
              />
              <Metric
                label="200日均价"
                value={formatPrice(quote.priceAvg200)}
              />
            </div>
          )}
        </div>

        {/* 财务概览（最近 4 季度）*/}
        {quarters.length > 0 && (
          <Section icon="📊" title={t("财务概览")} subtitle={t("最近 4 个季度")}>
            <FinancialTable quarters={quarters} />
          </Section>
        )}

        {/* 9 大功能区块 — 全部"敬请期待"占位 */}
        <Section icon="🎙️" title={t("财报会议")} subtitle={t("中文全文")} comingSoon>
          <Placeholder text={t("财报会议中文全文摘要正在开发中...")} />
        </Section>

        <Section
          icon="👤"
          title={t("内部人交易")}
          subtitle={`Form 4 · ${t("最近")} ${form4.length} ${t("条")}`}
        >
          {stock.cik && form4.length > 0 ? (
            <InsiderTradeList cik={stock.cik} filings={form4} />
          ) : !stock.cik ? (
            <Placeholder text={t("此股票暂无 SEC CIK 映射")} />
          ) : (
            <Placeholder text={t("最近无内部人 Form 4 申报")} />
          )}
        </Section>

        <Section icon="🏛️" title={t("机构持仓")} subtitle="13F" comingSoon>
          <Placeholder text={t("明星基金的持仓变化追踪...")} />
        </Section>

        <Section icon="📰" title="8-K" subtitle={t("公司重大事项")} comingSoon>
          <Placeholder text={t("M&A、CEO 变动、重大合同等 8-K 公告中文化...")} />
        </Section>

        <Section icon="🔮" title={t("分析师预期")} subtitle={t("EPS / 营收预期 + Beat 历史")} comingSoon>
          <Placeholder text={t("分析师对未来季度的预期，以及过去 Beat / Miss 记录...")} />
        </Section>

        <Section icon="🎯" title={t("期权异动")} subtitle={t("聪明钱大单监控")} comingSoon>
          <Placeholder text={t("异常成交量的期权合约 + IV / Greeks 数据...")} />
        </Section>

        <Section icon="📉" title={t("股本动态")} subtitle={t("回购 + SBC 稀释追踪")} comingSoon>
          <Placeholder text={t("回购授权 vs 实际执行 + 股权激励稀释...")} />
        </Section>

        <Section icon="📅" title={t("财报日历")} subtitle={t("下次财报日 + 历史记录")} comingSoon>
          <Placeholder text={t("财报日期、历史 Beat / Miss、解禁、分红...")} />
        </Section>

        <Section icon="📊" title={t("智能评分")} subtitle={t("多维度综合资金评分")} comingSoon>
          <Placeholder text={t("综合内部人、机构、回购、期权等信号的整体评分...")} />
        </Section>

        {/* 公司简介（可选展示） */}
        {profile?.description && (
          <Section icon="ℹ️" title={t("公司简介")}>
            <div className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
              {profile.description}
            </div>
            {profile.website && (
              <a
                href={profile.website}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block mt-3 text-sm text-indigo-600 dark:text-indigo-400 hover:underline"
              >
                {t("官方网站")} →
              </a>
            )}
          </Section>
        )}
      </div>
      <Footer />
    </main>
  );
}

// ====== 子组件 ======

function Metric({ label, value, small = false }: { label: string; value: string; small?: boolean }) {
  return (
    <div className="p-3 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-lg">
      <div className="text-xs text-slate-500 dark:text-slate-400 mb-1">{label}</div>
      <div className={small ? "text-sm font-medium" : "text-lg font-semibold"}>{value}</div>
    </div>
  );
}

function Section({
  icon,
  title,
  subtitle,
  comingSoon = false,
  children,
}: {
  icon: string;
  title: string;
  subtitle?: string;
  comingSoon?: boolean;
  children: React.ReactNode;
}) {
  const { t } = useLocale();
  return (
    <section className="mb-6 p-6 bg-white/80 dark:bg-white/5 backdrop-blur border border-slate-200 dark:border-white/10 rounded-2xl shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-baseline gap-3">
          <span className="text-2xl">{icon}</span>
          <h2 className="text-xl font-semibold">{title}</h2>
          {subtitle && (
            <span className="text-sm text-slate-500 dark:text-slate-400">{subtitle}</span>
          )}
        </div>
        {comingSoon && (
          <span className="text-xs px-2 py-0.5 bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300 rounded">
            {t("敬请期待")}
          </span>
        )}
      </div>
      {children}
    </section>
  );
}

function Placeholder({ text }: { text: string }) {
  return (
    <div className="py-6 text-center text-sm text-slate-400 dark:text-slate-500 italic">
      {text}
    </div>
  );
}

function FinancialTable({ quarters }: { quarters: FMPIncomeQuarter[] }) {
  const { t } = useLocale();
  // 倒序排列（最新在前）
  const sorted = [...quarters].sort((a, b) => b.date.localeCompare(a.date));

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-200 dark:border-white/10 text-slate-500 dark:text-slate-400">
            <th className="text-left py-2 pr-4 font-normal">{t("指标")}</th>
            {sorted.map(q => (
              <th key={q.date} className="text-right py-2 px-3 font-normal">
                {q.calendarYear} {q.period}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          <FinancialRow label={t("营收")} values={sorted.map(q => q.revenue)} formatter={formatUSD} />
          <FinancialRow label={t("毛利率")} values={sorted.map(q => q.grossProfitRatio * 100)} formatter={v => `${v.toFixed(1)}%`} />
          <FinancialRow label={t("营业利润")} values={sorted.map(q => q.operatingIncome)} formatter={formatUSD} />
          <FinancialRow label={t("净利润")} values={sorted.map(q => q.netIncome)} formatter={formatUSD} />
          <FinancialRow label={t("净利率")} values={sorted.map(q => q.netIncomeRatio * 100)} formatter={v => `${v.toFixed(1)}%`} />
          <FinancialRow
            label={t("摊薄 EPS")}
            values={sorted.map(q => q.epsdiluted)}
            formatter={v => `$${v.toFixed(2)}`}
          />
        </tbody>
      </table>

      {sorted.length >= 2 && (
        <div className="mt-4 text-xs text-slate-500 dark:text-slate-400">
          {t("最新季度 vs 上一季度环比")}：
          {(() => {
            const change = calcChange(sorted[0].revenue, sorted[1].revenue);
            if (change === null) return "—";
            return (
              <span className={`ml-1 font-medium ${colorClass(change)}`}>
                {t("营收")} {formatPercent(change)}
              </span>
            );
          })()}
        </div>
      )}
    </div>
  );
}

function FinancialRow({
  label,
  values,
  formatter,
}: {
  label: string;
  values: number[];
  formatter: (v: number) => string;
}) {
  return (
    <tr className="border-b border-slate-100 dark:border-white/5 hover:bg-slate-50 dark:hover:bg-white/5 transition">
      <td className="py-3 pr-4 text-slate-700 dark:text-slate-300">{label}</td>
      {values.map((v, i) => (
        <td key={i} className="text-right py-3 px-3 font-medium tabular-nums">
          {v == null || isNaN(v) ? "—" : formatter(v)}
        </td>
      ))}
    </tr>
  );
}

function InsiderTradeList({ cik, filings }: { cik: string; filings: EdgarFiling[] }) {
  const { t } = useLocale();

  // 按日期倒序（虽然 EDGAR 一般已是倒序，保险起见）
  const sorted = [...filings].sort((a, b) => b.filingDate.localeCompare(a.filingDate));

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-200 dark:border-white/10 text-slate-500 dark:text-slate-400">
            <th className="text-left py-2 pr-4 font-normal">{t("申报日")}</th>
            <th className="text-left py-2 pr-4 font-normal">{t("交易日")}</th>
            <th className="text-left py-2 pr-4 font-normal">{t("表格")}</th>
            <th className="text-left py-2 pr-4 font-normal">{t("文档")}</th>
            <th className="text-right py-2 pl-4 font-normal">{t("查看原文")}</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map(f => {
            const url = filingUrl(cik, f.accessionNumber, f.primaryDocument);
            return (
              <tr
                key={f.accessionNumber}
                className="border-b border-slate-100 dark:border-white/5 hover:bg-slate-50 dark:hover:bg-white/5 transition"
              >
                <td className="py-3 pr-4 font-medium tabular-nums">{f.filingDate}</td>
                <td className="py-3 pr-4 text-slate-500 dark:text-slate-400 tabular-nums">
                  {f.reportDate || "—"}
                </td>
                <td className="py-3 pr-4">
                  <span className="px-2 py-0.5 text-xs bg-purple-100 text-purple-700 dark:bg-purple-500/20 dark:text-purple-300 rounded">
                    Form {f.form}
                  </span>
                </td>
                <td className="py-3 pr-4 text-xs text-slate-600 dark:text-slate-400 truncate max-w-[200px]">
                  {f.primaryDocument}
                </td>
                <td className="py-3 pl-4 text-right">
                  <a
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-indigo-600 dark:text-indigo-400 hover:underline text-sm"
                  >
                    SEC →
                  </a>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <div className="mt-3 text-xs text-slate-500 dark:text-slate-400">
        {t("内部人 = 公司高管 / 董事 / 10% 以上股东，必须在交易后 2 个工作日内申报")}
      </div>
    </div>
  );
}

function formatVolume(volume: number | undefined): string {
  if (!volume) return "—";
  if (volume >= 1e9) return `${(volume / 1e9).toFixed(2)}B`;
  if (volume >= 1e6) return `${(volume / 1e6).toFixed(1)}M`;
  if (volume >= 1e3) return `${(volume / 1e3).toFixed(0)}K`;
  return volume.toString();
}
