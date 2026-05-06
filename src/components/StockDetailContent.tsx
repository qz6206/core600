"use client";

import Link from "next/link";
import ThemeToggle from "@/components/ThemeToggle";
import LocaleToggle from "@/components/LocaleToggle";
import TimeDisplay from "@/components/TimeDisplay";
import Footer from "@/components/Footer";
import { useLocale } from "@/components/LocaleProvider";
import type { Stock, SECTOR_CN as SC } from "@/lib/types";
import { SECTOR_CN, SECTOR_COLORS } from "@/lib/types";
import React, { useState } from "react";
import type {
  FMPProfile,
  FMPQuote,
  FMPIncomeQuarter,
  Inst13F,
  FMPExtras,
  AnalystEstimate,
  EarningRecord,
  CashFlowQuarter,
  ShareCountQuarter,
  RatingChange,
  OptionsActivity,
  OptionsContract,
  TranscriptCN,
} from "@/lib/fmp";
import type { EdgarFiling } from "@/lib/edgar";
import { filingUrl, parse8KItems } from "@/lib/edgar";
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
  form8k?: EdgarFiling[];
  form6k?: EdgarFiling[];
  inst13f?: Inst13F | null;
  fmpExtras?: FMPExtras | null;
  options?: OptionsActivity | null;
  descriptionCn?: string | null;
  transcript?: TranscriptCN | null;
}

export default function StockDetailContent({
  stock,
  overview,
  form4 = [],
  form8k = [],
  form6k = [],
  inst13f = null,
  fmpExtras = null,
  options = null,
  descriptionCn = null,
  transcript = null,
}: Props) {
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

        {/* 9 大功能区块 — 已完成：内部人交易、机构持仓、8-K；其余占位 */}
        <Section
          icon="🎙️"
          title={transcript?.is_annual_letter ? t("年度致股东信") : t("财报会议")}
          subtitle={
            transcript?.is_annual_letter
              ? `${transcript.source_label || `${transcript.year} ${t("年度致股东信")}`} · ${t("中文全文")}`
              : transcript
              ? `${transcript.year} ${t("财年")} Q${transcript.quarter} · ${transcript.date?.slice(0, 10) || ""} · ${t("中文全文")}`
              : t("中文全文")
          }
        >
          {transcript ? (
            <TranscriptBlock data={transcript} />
          ) : (
            <Placeholder text={t("此股票暂无财报会议记录")} />
          )}
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

        <Section
          icon="🏛️"
          title={t("机构持仓")}
          subtitle={inst13f?.summary?.date ? `13F · ${inst13f.summary.date}` : "13F"}
        >
          {inst13f && inst13f.summary?.date ? (
            <Inst13FBlock data={inst13f} />
          ) : (
            <Placeholder text={t("暂无 13F 机构持仓数据")} />
          )}
        </Section>

        {(() => {
          // 外国发行人 (foreign private issuer) 用 Form 6-K 替代 8-K
          const useForm6K = form8k.length === 0 && form6k.length > 0;
          const filingsToShow = useForm6K ? form6k : form8k;
          const formLabel = useForm6K ? "6-K" : "8-K";
          const subtitleText = useForm6K
            ? `6-K · ${t("外国发行人公告")} · ${t("最近")} ${form6k.length} ${t("条")}`
            : `${t("公司重大事项")} · ${t("最近")} ${form8k.length} ${t("条")}`;
          return (
            <Section icon="📰" title={formLabel} subtitle={subtitleText}>
              {stock.cik && filingsToShow.length > 0 ? (
                <Form8KList cik={stock.cik} filings={filingsToShow} isForm6K={useForm6K} />
              ) : !stock.cik ? (
                <Placeholder text={t("此股票暂无 SEC CIK 映射")} />
              ) : (
                <Placeholder text={t("最近无 8-K / 6-K 公告")} />
              )}
            </Section>
          );
        })()}

        <Section icon="🔮" title={t("分析师预期")} subtitle={t("未来 4 季 + Beat 历史 + 评级变动")}>
          {fmpExtras && (fmpExtras.estimates.length > 0 || fmpExtras.earnings.length > 0 || fmpExtras.ratings.length > 0) ? (
            <AnalystEstimatesBlock
              estimates={fmpExtras.estimates}
              earnings={fmpExtras.earnings}
              ratings={fmpExtras.ratings}
            />
          ) : (
            <Placeholder text={t("暂无分析师预期数据")} />
          )}
        </Section>

        <Section
          icon="🎯"
          title={t("期权异动")}
          subtitle={
            options?.atm_iv != null
              ? `ATM IV ${(options.atm_iv * 100).toFixed(1)}% · P/C ${
                  options.put_call_ratio != null ? options.put_call_ratio.toFixed(2) : "—"
                }`
              : t("聪明钱大单监控")
          }
        >
          {options && options.top_contracts.length > 0 ? (
            <OptionsActivityBlock data={options} />
          ) : (
            <Placeholder text={t("暂无期权异动数据")} />
          )}
        </Section>

        <Section icon="📉" title={t("股本动态")} subtitle={t("摊薄股数 + 回购 + SBC 稀释")}>
          {fmpExtras && (fmpExtras.shares.length > 0 || fmpExtras.sbc.length > 0) ? (
            <CapitalDynamicsBlock
              shares={fmpExtras.shares}
              cashFlow={fmpExtras.sbc}
              marketCap={quote?.marketCap}
            />
          ) : (
            <Placeholder text={t("暂无股本动态数据")} />
          )}
        </Section>

        <Section icon="📅" title={t("财报日历")} subtitle={t("下次财报 + 过去 8 次记录")}>
          {fmpExtras && fmpExtras.earnings.length > 0 ? (
            <EarningsCalendarBlock earnings={fmpExtras.earnings} />
          ) : (
            <Placeholder text={t("暂无财报日历数据")} />
          )}
        </Section>

        <Section icon="📊" title={t("智能评分")} subtitle={t("多维度综合资金评分")} comingSoon>
          <Placeholder text={t("综合内部人、机构、回购、期权等信号的整体评分...")} />
        </Section>

        {/* 公司简介 — 优先中文版（Kimi K2.5 翻译），fallback 英文 */}
        {(descriptionCn || profile?.description) && (
          <Section icon="ℹ️" title={t("公司简介")}>
            <div className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-line">
              {descriptionCn || profile?.description}
            </div>
            {profile?.website && (
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

function ownerTitleLabel(parsed: { is_director: boolean; is_officer: boolean; is_ten_pct: boolean; owner_title_cn: string | null }, t: (s: string) => string): string {
  // 优先用 officerTitle，否则按角色拼
  if (parsed.owner_title_cn) return parsed.owner_title_cn;
  const roles: string[] = [];
  if (parsed.is_director) roles.push(t("董事"));
  if (parsed.is_officer) roles.push(t("高管"));
  if (parsed.is_ten_pct) roles.push(t("10%+ 股东"));
  return roles.join(" / ") || t("内部人");
}

function summarizeFiling(parsed: NonNullable<EdgarFiling["parsed"]>, t: (s: string) => string): { actionCN: string; actionColor: string; sharesText: string; priceText: string; valueText: string } {
  // 选第一笔最有信号的交易做总结：优先 non-derivative，因为是真金白银
  const txs = parsed.transactions || [];
  const main = txs.find(x => x.kind === "non-derivative") || txs[0];
  if (!main) {
    return { actionCN: "—", actionColor: "text-slate-500", sharesText: "—", priceText: "—", valueText: "—" };
  }
  const isAcquire = main.acquired_disposed === "A";
  const actionColor = isAcquire
    ? "text-emerald-600 dark:text-emerald-400"
    : main.acquired_disposed === "D"
    ? "text-red-600 dark:text-red-400"
    : "text-slate-600 dark:text-slate-400";
  const sharesText = main.shares ? formatShares(main.shares) : "—";
  const priceText = main.price ? `$${main.price.toFixed(2)}` : "—";
  const valueText = main.value && main.value > 0 ? formatUSD(main.value) : "—";
  // 多笔交易在标签里加 +N
  const extra = txs.length > 1 ? ` +${txs.length - 1}` : "";
  return {
    actionCN: t(main.code_label_cn) + extra,
    actionColor,
    sharesText,
    priceText,
    valueText,
  };
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
            <th className="text-left py-2 pr-3 font-normal">{t("申报日")}</th>
            <th className="text-left py-2 pr-3 font-normal">{t("内部人")}</th>
            <th className="text-left py-2 pr-3 font-normal">{t("动作")}</th>
            <th className="text-right py-2 px-3 font-normal">{t("股数")}</th>
            <th className="text-right py-2 px-3 font-normal">{t("价格")}</th>
            <th className="text-right py-2 px-3 font-normal">{t("金额")}</th>
            <th className="text-right py-2 pl-3 font-normal">SEC</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map(f => {
            const url = filingUrl(cik, f.accessionNumber, f.primaryDocument);
            const parsed = f.parsed;
            const summary = parsed ? summarizeFiling(parsed, t) : null;
            const ownerName = parsed?.owner_name || "—";
            const ownerTitle = parsed ? ownerTitleLabel(parsed, t) : "";
            return (
              <tr
                key={f.accessionNumber}
                className="border-b border-slate-100 dark:border-white/5 hover:bg-slate-50 dark:hover:bg-white/5 transition"
              >
                <td className="py-3 pr-3 font-medium tabular-nums whitespace-nowrap">{f.filingDate}</td>
                <td className="py-3 pr-3">
                  {parsed ? (
                    <div>
                      <div className="font-medium">{ownerName}</div>
                      {ownerTitle && (
                        <div className="text-xs text-slate-500 dark:text-slate-400">{ownerTitle}</div>
                      )}
                    </div>
                  ) : (
                    <span className="text-xs text-slate-400">{t("解析中")}</span>
                  )}
                </td>
                <td className={`py-3 pr-3 text-sm ${summary?.actionColor || "text-slate-500"}`}>
                  {summary?.actionCN || "—"}
                </td>
                <td className="py-3 px-3 text-right tabular-nums">
                  {summary?.sharesText || "—"}
                </td>
                <td className="py-3 px-3 text-right tabular-nums text-slate-600 dark:text-slate-400">
                  {summary?.priceText || "—"}
                </td>
                <td className="py-3 px-3 text-right tabular-nums font-medium">
                  {summary?.valueText || "—"}
                </td>
                <td className="py-3 pl-3 text-right whitespace-nowrap">
                  <a
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-indigo-600 dark:text-indigo-400 hover:underline text-sm"
                  >
                    →
                  </a>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <div className="mt-3 text-xs text-slate-500 dark:text-slate-400 space-y-1">
        <div>
          {t("内部人 = 公司高管 / 董事 / 10% 以上股东，必须在交易后 2 个工作日内申报")}
        </div>
        <div>
          <span className="text-emerald-600 dark:text-emerald-400">{t("绿色")}</span> = {t("买入/获得")} ·{" "}
          <span className="text-red-600 dark:text-red-400">{t("红色")}</span> = {t("卖出/处置")} ·{" "}
          {t("「+N」表示同一申报含多笔交易")} ·{" "}
          {t("点击 SEC → 看完整原文")}
        </div>
      </div>
    </div>
  );
}

function Form8KList({
  cik,
  filings,
  isForm6K = false,
}: {
  cik: string;
  filings: EdgarFiling[];
  isForm6K?: boolean;
}) {
  const { t } = useLocale();
  const sorted = [...filings].sort((a, b) => b.filingDate.localeCompare(a.filingDate));

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-200 dark:border-white/10 text-slate-500 dark:text-slate-400">
            <th className="text-left py-2 pr-4 font-normal">{t("申报日")}</th>
            <th className="text-left py-2 pr-4 font-normal">{isForm6K ? t("文档") : t("事件")}</th>
            <th className="text-right py-2 pl-4 font-normal">{t("查看原文")}</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map(f => {
            const url = filingUrl(cik, f.accessionNumber, f.primaryDocument);
            const itemLabels = isForm6K ? [] : parse8KItems(f.items);
            return (
              <tr
                key={f.accessionNumber}
                className="border-b border-slate-100 dark:border-white/5 hover:bg-slate-50 dark:hover:bg-white/5 transition"
              >
                <td className="py-3 pr-4 font-medium tabular-nums whitespace-nowrap">{f.filingDate}</td>
                <td className="py-3 pr-4">
                  {isForm6K ? (
                    <span className="text-xs text-slate-600 dark:text-slate-400 truncate max-w-[280px] inline-block align-middle">
                      {f.primaryDocDescription || f.primaryDocument || "—"}
                    </span>
                  ) : itemLabels.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5">
                      {itemLabels.map((label, i) => (
                        <span
                          key={i}
                          className="px-2 py-0.5 text-xs bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300 rounded"
                          title={f.items}
                        >
                          {t(label)}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <span className="text-slate-400 dark:text-slate-500 text-xs">—</span>
                  )}
                </td>
                <td className="py-3 pl-4 text-right whitespace-nowrap">
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
        {isForm6K
          ? t("Form 6-K 是外国发行人 (foreign private issuer) 用来替代 8-K 的报告，发生重大事件时申报")
          : t("8-K 是公司在出现重大事项后 4 个工作日内必须申报的公告（如高管变动、并购、业绩预告等）")}
      </div>
    </div>
  );
}

function Inst13FBlock({ data }: { data: Inst13F }) {
  const { t } = useLocale();
  const { summary, topHolders } = data;

  return (
    <div className="space-y-4">
      {/* 聚合统计 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat
          label={t("持仓机构")}
          value={summary.investorsHolding?.toLocaleString() ?? "—"}
          delta={summary.investorsHoldingChange}
          isCount
        />
        <Stat
          label={t("13F 持股")}
          value={summary.numberOf13Fshares ? formatShares(summary.numberOf13Fshares) : "—"}
          subtitle={summary.ownershipPercent ? `${summary.ownershipPercent.toFixed(1)}% ${t("流通股")}` : undefined}
        />
        <Stat
          label={t("新进")}
          value={summary.newPositions?.toLocaleString() ?? "—"}
          isCount
          colorOverride={summary.newPositions ? "text-emerald-600 dark:text-emerald-400" : undefined}
        />
        <Stat
          label={t("清仓")}
          value={summary.closedPositions?.toLocaleString() ?? "—"}
          isCount
          colorOverride={summary.closedPositions ? "text-red-600 dark:text-red-400" : undefined}
        />
      </div>

      {/* Top 10 表 */}
      {topHolders.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 dark:border-white/10 text-slate-500 dark:text-slate-400">
                <th className="text-left py-2 pr-3 font-normal">#</th>
                <th className="text-left py-2 pr-3 font-normal">{t("机构")}</th>
                <th className="text-right py-2 px-3 font-normal">{t("持股数")}</th>
                <th className="text-right py-2 px-3 font-normal">{t("占股本")}</th>
                <th className="text-right py-2 px-3 font-normal">{t("季度变化")}</th>
                <th className="text-right py-2 pl-3 font-normal">{t("已持")}</th>
              </tr>
            </thead>
            <tbody>
              {topHolders.map((h, idx) => (
                <tr
                  key={h.cik || h.investorName}
                  className="border-b border-slate-100 dark:border-white/5 hover:bg-slate-50 dark:hover:bg-white/5 transition"
                >
                  <td className="py-3 pr-3 text-slate-500 dark:text-slate-400 tabular-nums">{idx + 1}</td>
                  <td className="py-3 pr-3 font-medium">
                    {h.investorName}
                    {h.isNew && (
                      <span className="ml-2 px-1.5 py-0.5 text-xs bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300 rounded">
                        {t("新进")}
                      </span>
                    )}
                  </td>
                  <td className="py-3 px-3 text-right tabular-nums">
                    {h.sharesNumber ? formatShares(h.sharesNumber) : "—"}
                  </td>
                  <td className="py-3 px-3 text-right tabular-nums">
                    {h.ownership != null ? `${h.ownership.toFixed(2)}%` : "—"}
                  </td>
                  <td className="py-3 px-3 text-right tabular-nums">
                    {h.changeInSharesNumberPercentage != null ? (
                      <span className={colorClass(h.changeInSharesNumberPercentage)}>
                        {formatPercent(h.changeInSharesNumberPercentage)}
                      </span>
                    ) : "—"}
                  </td>
                  <td className="py-3 pl-3 text-right text-xs text-slate-500 dark:text-slate-400 tabular-nums whitespace-nowrap">
                    {h.holdingPeriod ? `${h.holdingPeriod} ${t("季")}` : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="mt-3 text-xs text-slate-500 dark:text-slate-400">
            {t("13F 由管理资产 ≥1 亿美元的机构每季度申报，截止后 45 天内披露。本表按持股占比排序")}
          </div>
        </div>
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  subtitle,
  delta,
  isCount,
  colorOverride,
}: {
  label: string;
  value: string;
  subtitle?: string;
  delta?: number | null;
  isCount?: boolean;
  colorOverride?: string;
}) {
  return (
    <div className="p-3 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-lg">
      <div className="text-xs text-slate-500 dark:text-slate-400 mb-1">{label}</div>
      <div className={`text-lg font-semibold ${colorOverride || ""}`}>{value}</div>
      {delta != null && delta !== 0 && (
        <div className={`text-xs mt-0.5 ${colorClass(delta)}`}>
          {delta > 0 ? "+" : ""}
          {isCount ? delta.toLocaleString() : delta.toFixed(2)}
        </div>
      )}
      {subtitle && (
        <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{subtitle}</div>
      )}
    </div>
  );
}

// ====== 财报会议中文 transcript ======

function TranscriptBlock({ data }: { data: TranscriptCN }) {
  const { t } = useLocale();
  const [expanded, setExpanded] = useState(false);
  const PREVIEW_CHARS = 800;
  const fullText = data.content_cn;
  const tooLong = fullText.length > PREVIEW_CHARS;
  const displayed = expanded || !tooLong ? fullText : fullText.slice(0, PREVIEW_CHARS) + "...";

  // 说话人识别：行首 "XXX：" 或 "XXX:" 加粗
  const formatLines = (text: string): React.JSX.Element[] => {
    const lines = text.split("\n");
    return lines.map((line, i) => {
      const speakerMatch = line.match(/^([一-鿿\w\s.\-+]+?[：:])(.*)$/);
      if (speakerMatch && speakerMatch[1].length < 30) {
        return (
          <p key={i} className="mb-3 leading-7">
            <span className="font-semibold text-indigo-700 dark:text-indigo-300">
              {speakerMatch[1]}
            </span>
            <span>{speakerMatch[2]}</span>
          </p>
        );
      }
      if (line.trim()) {
        return (
          <p key={i} className="mb-3 leading-7">
            {line}
          </p>
        );
      }
      return null;
    }).filter((x): x is React.JSX.Element => x !== null);
  };

  return (
    <div>
      <div className="text-xs text-slate-500 dark:text-slate-400 mb-3 flex flex-wrap items-center gap-2">
        <span>{t("中文翻译")}</span>
        {data.content_en_chars && (
          <span>· {t("英文原文")} {(data.content_en_chars / 1000).toFixed(1)}K {t("字符")}</span>
        )}
        <span>· {t("中文")} {(fullText.length / 1000).toFixed(1)}K {t("字")}</span>
        {data.source_url && (
          <a
            href={data.source_url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-indigo-600 dark:text-indigo-400 hover:underline ml-2"
          >
            · {t("英文原文 PDF")} →
          </a>
        )}
      </div>

      <div className="text-sm text-slate-700 dark:text-slate-200 max-w-none">
        {formatLines(displayed)}
      </div>

      {tooLong && (
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          className="mt-3 text-sm text-indigo-600 dark:text-indigo-400 hover:underline font-medium"
        >
          {expanded ? `↑ ${t("收起")}` : `↓ ${t("展开全文")} (${(fullText.length / 1000).toFixed(1)}K ${t("字")})`}
        </button>
      )}

      <div className="mt-4 pt-3 border-t border-slate-200 dark:border-white/10 text-xs text-slate-500 dark:text-slate-400">
        {t("免责声明")}：{t("中文翻译，仅供参考。投资决策请以英文原文及官方文件为准")}
      </div>
    </div>
  );
}

// ====== 期权异动 ======

function OptionsActivityBlock({ data }: { data: OptionsActivity }) {
  const { t } = useLocale();
  const { spot, atm_iv, atm_iv_count, total_vol, call_vol, put_vol, put_call_ratio, top_contracts } = data;

  const today = new Date().toISOString().slice(0, 10);
  const dteFor = (exp: string | null): number | null => {
    if (!exp) return null;
    const expDate = new Date(exp + "T00:00:00Z");
    const todayDate = new Date(today + "T00:00:00Z");
    return Math.round((expDate.getTime() - todayDate.getTime()) / 86400000);
  };

  return (
    <div className="space-y-4">
      {/* 顶部 4 格 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat
          label="ATM IV"
          value={atm_iv != null ? `${(atm_iv * 100).toFixed(1)}%` : "—"}
          subtitle={atm_iv_count ? `${atm_iv_count} ${t("个候选")}` : undefined}
        />
        <Stat
          label={t("Put/Call 量比")}
          value={put_call_ratio != null ? put_call_ratio.toFixed(2) : "—"}
          subtitle={put_call_ratio != null ? (put_call_ratio < 0.7 ? t("看涨") : put_call_ratio > 1.0 ? t("看跌") : t("中性")) : undefined}
          colorOverride={
            put_call_ratio == null
              ? undefined
              : put_call_ratio < 0.7
              ? "text-emerald-600 dark:text-emerald-400"
              : put_call_ratio > 1.0
              ? "text-red-600 dark:text-red-400"
              : undefined
          }
        />
        <Stat
          label={t("今日总成交")}
          value={total_vol != null ? formatShares(total_vol) : "—"}
          subtitle={`Call ${call_vol != null ? formatShares(call_vol) : "—"} / Put ${put_vol != null ? formatShares(put_vol) : "—"}`}
        />
        <Stat
          label={t("现价")}
          value={spot != null ? `$${spot.toFixed(2)}` : "—"}
          subtitle={t("前一交易日收盘")}
        />
      </div>

      {/* Top 10 合约表 */}
      {top_contracts.length > 0 && (
        <div className="overflow-x-auto">
          <div className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
            {t("今日成交量 Top 10 合约")}
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 dark:border-white/10 text-slate-500 dark:text-slate-400">
                <th className="text-left py-2 pr-3 font-normal">{t("方向")}</th>
                <th className="text-right py-2 px-3 font-normal">{t("行权价")}</th>
                <th className="text-right py-2 px-3 font-normal">{t("到期")}</th>
                <th className="text-right py-2 px-3 font-normal">{t("DTE")}</th>
                <th className="text-right py-2 px-3 font-normal">{t("成交量")}</th>
                <th className="text-right py-2 px-3 font-normal">{t("未平仓")}</th>
                <th className="text-right py-2 px-3 font-normal">vol/OI</th>
                <th className="text-right py-2 px-3 font-normal">IV</th>
                <th className="text-right py-2 pl-3 font-normal">{t("涨跌")}</th>
              </tr>
            </thead>
            <tbody>
              {top_contracts.map(c => {
                const dte = dteFor(c.exp);
                const isUnusual = c.vol_oi_ratio != null && c.vol_oi_ratio >= 2;
                const itm =
                  spot != null && c.strike != null && c.type
                    ? c.type === "call"
                      ? spot > c.strike
                      : spot < c.strike
                    : false;
                return (
                  <tr
                    key={c.ticker}
                    className={`border-b border-slate-100 dark:border-white/5 hover:bg-slate-50 dark:hover:bg-white/5 transition ${
                      isUnusual ? "bg-amber-50/40 dark:bg-amber-500/5" : ""
                    }`}
                  >
                    <td className="py-2 pr-3">
                      <span
                        className={`px-1.5 py-0.5 text-xs rounded font-medium ${
                          c.type === "call"
                            ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300"
                            : "bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-300"
                        }`}
                      >
                        {c.type === "call" ? "Call" : "Put"}
                      </span>
                      {itm && (
                        <span className="ml-1 px-1 py-0.5 text-[10px] bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300 rounded">
                          ITM
                        </span>
                      )}
                    </td>
                    <td className="py-2 px-3 text-right tabular-nums font-medium">
                      {c.strike != null ? `$${c.strike}` : "—"}
                    </td>
                    <td className="py-2 px-3 text-right text-xs text-slate-500 dark:text-slate-400 tabular-nums whitespace-nowrap">
                      {c.exp || "—"}
                    </td>
                    <td className="py-2 px-3 text-right text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                      {dte != null ? `${dte}d` : "—"}
                    </td>
                    <td className="py-2 px-3 text-right tabular-nums">
                      {c.vol != null ? c.vol.toLocaleString() : "—"}
                    </td>
                    <td className="py-2 px-3 text-right text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                      {c.oi != null ? c.oi.toLocaleString() : "—"}
                    </td>
                    <td
                      className={`py-2 px-3 text-right tabular-nums ${
                        isUnusual ? "font-semibold text-amber-700 dark:text-amber-400" : ""
                      }`}
                    >
                      {c.vol_oi_ratio != null ? c.vol_oi_ratio.toFixed(2) : "—"}
                    </td>
                    <td className="py-2 px-3 text-right text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                      {c.iv != null ? `${(c.iv * 100).toFixed(0)}%` : "—"}
                    </td>
                    <td className="py-2 pl-3 text-right tabular-nums">
                      {c.change_pct != null ? (
                        <span className={colorClass(c.change_pct)}>
                          {formatPercent(c.change_pct)}
                        </span>
                      ) : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <div className="mt-3 text-xs text-slate-500 dark:text-slate-400">
            {t("vol/OI ≥ 2 标橙底 = 当日成交量超过历史未平仓量 2 倍，属异动")} ·{" "}
            {t("ATM IV 已过滤 OI<100 + 异常值（防 stale 数据）")}
          </div>
        </div>
      )}
    </div>
  );
}

function formatShares(n: number): string {
  if (n >= 1e9) return `${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(0)}K`;
  return n.toLocaleString();
}

// ====== 分析师预期 ======

function AnalystEstimatesBlock({
  estimates,
  earnings,
  ratings,
}: {
  estimates: AnalystEstimate[];
  earnings: EarningRecord[];
  ratings: RatingChange[];
}) {
  const { t } = useLocale();
  // 未来季度（按 date 升序，最近在前）
  const forwardQuarters = [...estimates]
    .filter(e => e.date)
    .sort((a, b) => (a.date || "").localeCompare(b.date || ""));

  // 过去 4 次已发财报（计算 Beat/Miss）
  const past = earnings
    .filter(e => e.eps_actual != null && e.eps_estimate != null)
    .slice(0, 4);

  return (
    <div className="space-y-5">
      {/* 未来 4 季预期 */}
      {forwardQuarters.length > 0 && (
        <div>
          <div className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
            {t("未来 4 季度预期")}
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {forwardQuarters.slice(0, 4).map(q => (
              <div
                key={q.date}
                className="p-3 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-lg"
              >
                <div className="text-xs text-slate-500 dark:text-slate-400 mb-1 tabular-nums">
                  {q.date}
                </div>
                <div className="text-sm">
                  <div>
                    <span className="text-slate-500 dark:text-slate-400">EPS </span>
                    <span className="font-semibold tabular-nums">
                      {q.eps_avg != null ? `$${q.eps_avg.toFixed(2)}` : "—"}
                    </span>
                  </div>
                  <div className="mt-0.5">
                    <span className="text-slate-500 dark:text-slate-400">{t("营收")} </span>
                    <span className="font-semibold tabular-nums">
                      {q.rev_avg ? formatUSD(q.rev_avg) : "—"}
                    </span>
                  </div>
                  {q.num_analysts != null && (
                    <div className="text-xs text-slate-400 dark:text-slate-500 mt-1">
                      {q.num_analysts} {t("位分析师")}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 过去 4 次 Beat / Miss */}
      {past.length > 0 && (
        <div>
          <div className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
            {t("最近 4 次财报 Beat / Miss")}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 dark:border-white/10 text-slate-500 dark:text-slate-400">
                  <th className="text-left py-2 pr-3 font-normal">{t("发布日")}</th>
                  <th className="text-right py-2 px-3 font-normal">EPS {t("预期")}</th>
                  <th className="text-right py-2 px-3 font-normal">EPS {t("实际")}</th>
                  <th className="text-right py-2 pl-3 font-normal">{t("差异")}</th>
                </tr>
              </thead>
              <tbody>
                {past.map(e => {
                  const surprise =
                    e.eps_estimate && e.eps_estimate !== 0
                      ? ((e.eps_actual! - e.eps_estimate) / Math.abs(e.eps_estimate)) * 100
                      : null;
                  return (
                    <tr
                      key={e.date}
                      className="border-b border-slate-100 dark:border-white/5 hover:bg-slate-50 dark:hover:bg-white/5 transition"
                    >
                      <td className="py-2 pr-3 font-medium tabular-nums">{e.date}</td>
                      <td className="py-2 px-3 text-right tabular-nums text-slate-600 dark:text-slate-400">
                        ${e.eps_estimate!.toFixed(2)}
                      </td>
                      <td className="py-2 px-3 text-right tabular-nums font-semibold">
                        ${e.eps_actual!.toFixed(2)}
                      </td>
                      <td className="py-2 pl-3 text-right tabular-nums">
                        {surprise != null ? (
                          <span className={colorClass(surprise)}>
                            {formatPercent(surprise)}
                          </span>
                        ) : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 最近评级变动 */}
      {ratings.length > 0 && (
        <div>
          <div className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2 flex items-baseline gap-2">
            <span>{t("最近评级变动")}</span>
            {ratings[0]?.source_class && (
              <span className="text-xs text-amber-600 dark:text-amber-400 font-normal">
                ({ratings[0].source_class})
              </span>
            )}
          </div>
          <div className="space-y-1.5">
            {ratings.slice(0, 5).map((r, i) => {
              const actionColor =
                r.action === "upgrade"
                  ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300"
                  : r.action === "downgrade"
                  ? "bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-300"
                  : r.action === "initiate"
                  ? "bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300"
                  : "bg-slate-100 text-slate-600 dark:bg-slate-500/20 dark:text-slate-300";
              const actionCN: Record<string, string> = {
                upgrade: "升级",
                downgrade: "降级",
                initiate: "首次覆盖",
                hold: "维持",
              };
              return (
                <div
                  key={i}
                  className="flex items-center gap-3 text-sm py-1.5 border-b border-slate-100 dark:border-white/5 last:border-0"
                >
                  <span className="text-slate-500 dark:text-slate-400 tabular-nums whitespace-nowrap text-xs">
                    {r.date}
                  </span>
                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${actionColor} whitespace-nowrap`}>
                    {t(actionCN[r.action || ""] || r.action || "—")}
                  </span>
                  <span className="font-medium whitespace-nowrap">{r.company}</span>
                  {r.target_price && (
                    <span className="text-slate-500 dark:text-slate-400 text-xs whitespace-nowrap">
                      → ${r.target_price.toFixed(0)}
                    </span>
                  )}
                  <span className="text-slate-500 dark:text-slate-400 text-xs truncate flex-1">
                    {r.title}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ====== 财报日历 ======

function EarningsCalendarBlock({ earnings }: { earnings: EarningRecord[] }) {
  const { t } = useLocale();
  const today = new Date().toISOString().slice(0, 10);

  // 找下一个未来的财报
  const upcoming = earnings
    .filter(e => e.date && e.date >= today && e.eps_actual == null)
    .sort((a, b) => (a.date || "").localeCompare(b.date || ""))[0];

  // 过去 8 次已发的
  const past = earnings
    .filter(e => e.date && e.eps_actual != null)
    .slice(0, 8);

  const timeLabel = (time: string | null): string => {
    if (time === "bmo") return t("盘前");
    if (time === "amc") return t("盘后");
    return t("未公布");
  };

  return (
    <div className="space-y-4">
      {/* 下次财报 */}
      {upcoming && (
        <div className="p-4 bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-500/10 dark:to-orange-500/10 border border-amber-200 dark:border-amber-500/30 rounded-xl">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <div className="text-xs text-amber-700 dark:text-amber-400 mb-1 font-medium">
                {t("下次财报")}
              </div>
              <div className="text-2xl font-bold tabular-nums">{upcoming.date}</div>
              <div className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                {timeLabel(upcoming.time)}
                {upcoming.fiscal_period_end && ` · ${t("季度结束")} ${upcoming.fiscal_period_end}`}
              </div>
            </div>
            <div className="text-right">
              {upcoming.eps_estimate != null && (
                <div>
                  <div className="text-xs text-slate-500 dark:text-slate-400">EPS {t("预期")}</div>
                  <div className="text-lg font-semibold tabular-nums">
                    ${upcoming.eps_estimate.toFixed(2)}
                  </div>
                </div>
              )}
              {upcoming.rev_estimate != null && (
                <div className="mt-1">
                  <div className="text-xs text-slate-500 dark:text-slate-400">{t("营收预期")}</div>
                  <div className="text-sm font-medium tabular-nums">
                    {formatUSD(upcoming.rev_estimate)}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 过去财报记录 */}
      {past.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 dark:border-white/10 text-slate-500 dark:text-slate-400">
                <th className="text-left py-2 pr-3 font-normal">{t("发布日")}</th>
                <th className="text-left py-2 pr-3 font-normal">{t("时段")}</th>
                <th className="text-right py-2 px-3 font-normal">EPS</th>
                <th className="text-right py-2 px-3 font-normal">{t("营收")}</th>
                <th className="text-right py-2 pl-3 font-normal">{t("EPS 差异")}</th>
              </tr>
            </thead>
            <tbody>
              {past.map(e => {
                const surprise =
                  e.eps_estimate && e.eps_estimate !== 0 && e.eps_actual != null
                    ? ((e.eps_actual - e.eps_estimate) / Math.abs(e.eps_estimate)) * 100
                    : null;
                return (
                  <tr
                    key={e.date}
                    className="border-b border-slate-100 dark:border-white/5 hover:bg-slate-50 dark:hover:bg-white/5 transition"
                  >
                    <td className="py-2 pr-3 font-medium tabular-nums">{e.date}</td>
                    <td className="py-2 pr-3 text-xs text-slate-500 dark:text-slate-400">
                      {timeLabel(e.time)}
                    </td>
                    <td className="py-2 px-3 text-right tabular-nums">
                      {e.eps_actual != null ? `$${e.eps_actual.toFixed(2)}` : "—"}
                    </td>
                    <td className="py-2 px-3 text-right tabular-nums">
                      {e.rev_actual ? formatUSD(e.rev_actual) : "—"}
                    </td>
                    <td className="py-2 pl-3 text-right tabular-nums">
                      {surprise != null ? (
                        <span className={colorClass(surprise)}>{formatPercent(surprise)}</span>
                      ) : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ====== 股本动态 ======

function CapitalDynamicsBlock({
  shares,
  cashFlow,
  marketCap,
}: {
  shares: ShareCountQuarter[];
  cashFlow: CashFlowQuarter[];
  marketCap?: number;
}) {
  const { t } = useLocale();
  // 倒序排列：最近在前
  const sortedShares = [...shares].sort((a, b) => (b.date || "").localeCompare(a.date || ""));
  const sortedCF = [...cashFlow].sort((a, b) => (b.date || "").localeCompare(a.date || ""));

  // 摊薄股数：最新 vs 4 季度前
  const latestShs = sortedShares[0]?.weighted_avg_diluted;
  const yearAgoShs = sortedShares[4]?.weighted_avg_diluted;
  const dilutionPct =
    latestShs && yearAgoShs && yearAgoShs !== 0
      ? ((latestShs - yearAgoShs) / yearAgoShs) * 100
      : null;

  // SBC TTM（最近 4 季加总）vs 净利润 TTM
  const ttmSBC = sortedCF.slice(0, 4).reduce((sum, q) => sum + (q.sbc || 0), 0);
  const ttmNetIncome = sortedShares.slice(0, 4).reduce((sum, q) => sum + (q.net_income || 0), 0);
  const sbcVsNI = ttmNetIncome ? (ttmSBC / Math.abs(ttmNetIncome)) * 100 : null;
  const sbcVsCap = marketCap ? (ttmSBC / marketCap) * 100 : null;

  // 回购 TTM
  const ttmBuyback = sortedCF.slice(0, 4).reduce((sum, q) => sum + (q.buyback || 0), 0);

  return (
    <div className="space-y-4">
      {/* 顶部 4 格 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat
          label={t("摊薄股数")}
          value={latestShs ? formatShares(latestShs) : "—"}
          subtitle={sortedShares[0]?.date ? `${sortedShares[0].calendar_year} ${sortedShares[0].period}` : undefined}
          delta={dilutionPct}
        />
        <Stat
          label={`SBC TTM`}
          value={ttmSBC ? formatUSD(ttmSBC) : "—"}
          subtitle={sbcVsCap != null ? `${sbcVsCap.toFixed(2)}% ${t("市值")}` : undefined}
          colorOverride={ttmSBC > 0 ? "text-orange-600 dark:text-orange-400" : undefined}
        />
        <Stat
          label={t("回购 TTM")}
          value={ttmBuyback ? formatUSD(Math.abs(ttmBuyback)) : "—"}
          colorOverride={ttmBuyback < 0 ? "text-emerald-600 dark:text-emerald-400" : undefined}
        />
        <Stat
          label={t("SBC / 净利")}
          value={sbcVsNI != null ? `${sbcVsNI.toFixed(1)}%` : "—"}
          subtitle={t("TTM")}
          colorOverride={
            sbcVsNI != null && sbcVsNI > 30
              ? "text-red-600 dark:text-red-400"
              : sbcVsNI != null && sbcVsNI < 10
              ? "text-emerald-600 dark:text-emerald-400"
              : undefined
          }
        />
      </div>

      {/* 8 季度趋势表 */}
      {sortedShares.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 dark:border-white/10 text-slate-500 dark:text-slate-400">
                <th className="text-left py-2 pr-3 font-normal">{t("季度")}</th>
                <th className="text-right py-2 px-3 font-normal">{t("摊薄股数")}</th>
                <th className="text-right py-2 px-3 font-normal">SBC</th>
                <th className="text-right py-2 px-3 font-normal">{t("回购")}</th>
                <th className="text-right py-2 pl-3 font-normal">FCF</th>
              </tr>
            </thead>
            <tbody>
              {sortedShares.slice(0, 8).map(s => {
                const cf = sortedCF.find(c => c.date === s.date);
                return (
                  <tr
                    key={s.date}
                    className="border-b border-slate-100 dark:border-white/5 hover:bg-slate-50 dark:hover:bg-white/5 transition"
                  >
                    <td className="py-2 pr-3 font-medium whitespace-nowrap">
                      {s.calendar_year} {s.period}
                    </td>
                    <td className="py-2 px-3 text-right tabular-nums">
                      {s.weighted_avg_diluted ? formatShares(s.weighted_avg_diluted) : "—"}
                    </td>
                    <td className="py-2 px-3 text-right tabular-nums text-orange-600 dark:text-orange-400">
                      {cf?.sbc ? formatUSD(cf.sbc) : "—"}
                    </td>
                    <td className="py-2 px-3 text-right tabular-nums text-emerald-600 dark:text-emerald-400">
                      {cf?.buyback ? formatUSD(Math.abs(cf.buyback)) : "—"}
                    </td>
                    <td className="py-2 pl-3 text-right tabular-nums">
                      {cf?.fcf ? formatUSD(cf.fcf) : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <div className="mt-3 text-xs text-slate-500 dark:text-slate-400">
            {t("摊薄股数减少 = 回购大于股权激励发行；SBC 占净利润 ≥30% 视为高稀释，≤10% 为低稀释")}
          </div>
        </div>
      )}
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
