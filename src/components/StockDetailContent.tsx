"use client";

import Link from "next/link";
import ThemeToggle from "@/components/ThemeToggle";
import LocaleToggle from "@/components/LocaleToggle";
import TimeDisplay from "@/components/TimeDisplay";
import Footer from "@/components/Footer";
import Term from "@/components/Term";
import FiscalAnchorBar from "@/components/FiscalAnchorBar";
import ScenarioBadge from "@/components/ScenarioBadge";
import WatchlistStar from "@/components/WatchlistStar";
import { useLocale } from "@/components/LocaleProvider";
import type { Stock, SECTOR_CN as SC } from "@/lib/types";
import { SECTOR_CN, SECTOR_COLORS } from "@/lib/types";
import React, { useMemo, useState } from "react";
import type {
  FMPProfile,
  FMPQuote,
  FMPIncomeQuarter,
  Inst13F,
  FMPExtras,
  EarningRecord,
  CashFlowQuarter,
  ShareCountQuarter,
  RatingChange,
  OptionsActivity,
  OptionsContract,
  TranscriptCN,
  EarningsInterpretation,
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
  interpretation?: EarningsInterpretation | null;
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
  interpretation = null,
}: Props) {
  const { t, tCn, isEnglish } = useLocale();
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
              <div className="flex items-center gap-3 mb-2 flex-wrap">
                <h1 className="text-4xl font-bold">{stock.ticker}</h1>
                <WatchlistStar ticker={stock.ticker} size="md" />
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

              {/* 中文名仅 zh 模式显示, EN 模式隐藏 */}
              {stock.name_cn && !isEnglish && (
                <div className="text-xl font-medium text-slate-700 dark:text-slate-300 mb-1">
                  {t(stock.name_cn)}
                </div>
              )}
              {/* 英文名: zh 模式作副标题, EN 模式作主标题 (用大字号) */}
              <div className={`${isEnglish ? "text-xl font-medium text-slate-700 dark:text-slate-300" : "text-base text-slate-500 dark:text-slate-400"} mb-3`}>
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
              <Metric label={<Term term="EPS">EPS</Term>} value={quote.eps ? `$${quote.eps.toFixed(2)}` : "—"} />
              <Metric
                label={t("52周区间")}
                value={`${formatPrice(quote.yearLow)} - ${formatPrice(quote.yearHigh)}`}
                small
              />
              <Metric label={t("成交量")} value={formatVolume(quote.volume)} />
              <Metric label={t("均量")} value={formatVolume(quote.avgVolume)} />
              <Metric
                label={t("50日均价")}
                value={formatPrice(quote.priceAvg50)}
              />
              <Metric
                label={t("200日均价")}
                value={formatPrice(quote.priceAvg200)}
              />
            </div>
          )}
        </div>

        {/* 主季度锚点条 — 显示当季焦点 + 各 section 对齐状态 */}
        <FiscalAnchorBar
          interpretation={interpretation}
          transcript={transcript}
          form4={form4}
          form8k={form8k}
          inst13f={inst13f}
          options={options}
        />

        {/* 财务概览（最近 4 季度表格）*/}
        {quarters.length > 0 && (
          <Section
            id="financial-overview"
            icon="📊"
            title={t("财务概览")}
            subtitle={t("最近 4 个季度")}
          >
            <FinancialTable
              quarters={quarters}
              cashFlow={fmpExtras?.sbc}
              shares={fmpExtras?.shares}
            />
          </Section>
        )}

        {/* 顺序：财报会议 → 财报点评 → 财报日历 → 分析师预期 → 8-K → 内部人交易 → 股本动态 → 机构持仓 → 期权异动 → 公司简介 */}

        {/* 3. 财报会议 */}
        {(() => {
          // 检测 transcript 季度跟最新财报点评 (interpretation) 是否对应
          // 不对应: 显示一条 stale banner, 让用户知道这是上一季的 transcript
          const interpFiscal = interpretation?.is_recent ? interpretation.fiscal_label : null;
          const transFiscal =
            transcript && !transcript.is_annual_letter && transcript.year && transcript.quarter
              ? `${transcript.year} Q${transcript.quarter}`
              : null;
          const transcriptStale = !!(interpFiscal && transFiscal && interpFiscal !== transFiscal);
          return (
            <Section
              id="transcript"
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
              {transcriptStale && (
                <div className="mb-3 rounded-md border border-amber-200 dark:border-amber-500/30 bg-amber-50 dark:bg-amber-500/10 px-3 py-2 text-xs text-amber-800 dark:text-amber-300 leading-relaxed">
                  {interpretation?.narrative_status === "transcript_unavailable_in_fmp" ? (
                    <>
                      ⚠️ {t("以下是上一季")} {transFiscal} {t("的电话会议(财报点评对应的")} {interpFiscal} {t("在我们使用的数据源中暂未收录,可能因数据源版权限制)。如需当季原文,可前往")}
                      <a
                        href={`https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=${stock.cik || ""}&type=8-K`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="underline hover:text-amber-700 dark:hover:text-amber-200 mx-1"
                      >
                        SEC EDGAR
                      </a>
                      {t("或公司 IR 网站查阅。")}
                    </>
                  ) : (
                    <>
                      ⚠️ {t("以下是上一季")} {transFiscal} {t("的电话会议(对应当前财报点评的")} {interpFiscal} {t("中文翻译尚未发布,通常在新财报发布后 1-2 周内由数据源刷新。")}
                    </>
                  )}
                </div>
              )}
              {transcript ? (
                <TranscriptBlock data={transcript} />
              ) : (
                <Placeholder text={t("此股票暂无财报会议记录")} />
              )}
            </Section>
          );
        })()}

        {/* 3. 财报点评 */}
        {interpretation && interpretation.is_recent ? (
          <Section
            id="earnings-interpretation"
            icon="📝"
            title={t("财报点评")}
            subtitleNode={
              <>
                {interpretation.fiscal_label} · {interpretation.earnings_date}
                {interpretation.release_time === "bmo" && ` (${t("盘前")})`}
                {interpretation.release_time === "amc" && ` (${t("盘后")})`}
              </>
            }
          >
            <EarningsInterpretationBlock data={interpretation} />
          </Section>
        ) : interpretation ? (
          <Section
            id="earnings-interpretation"
            icon="📝"
            title={t("财报点评")}
            subtitleNode={<>{interpretation.fiscal_label} · {interpretation.earnings_date}</>}
          >
            <Placeholder text={t("最近一次财报已超 90 天，本节略")} />
          </Section>
        ) : (
          <Section id="earnings-interpretation" icon="📝" title={t("财报点评")}>
            <Placeholder text={t("暂无财报点评数据")} />
          </Section>
        )}

        {/* 4. 财报日历 */}
        <Section id="earnings-calendar" icon="📅" title={t("财报日历")} subtitle={t("下次财报 + 过去 8 次记录")}>
          {fmpExtras && fmpExtras.earnings.length > 0 ? (
            <EarningsCalendarBlock earnings={fmpExtras.earnings} />
          ) : (
            <Placeholder text={t("暂无财报日历数据")} />
          )}
        </Section>

        {/* 5. 分析师预期 */}
        <Section
          id="analyst-estimates"
          icon="🔮"
          title={t("分析师预期")}
          subtitleNode={
            <><Term term="Beat">Beat</Term>{t(" 历史 + 评级变动")}</>
          }
        >
          {fmpExtras && (fmpExtras.earnings.length > 0 || fmpExtras.ratings.length > 0) ? (
            <AnalystEstimatesBlock
              earnings={fmpExtras.earnings}
              ratings={fmpExtras.ratings}
            />
          ) : (
            <Placeholder text={t("暂无分析师预期数据")} />
          )}
        </Section>

        {/* 6. 8-K / 6-K */}
        {(() => {
          // 外国发行人 (foreign private issuer) 用 Form 6-K 替代 8-K
          const useForm6K = form8k.length === 0 && form6k.length > 0;
          const filingsToShow = useForm6K ? form6k : form8k;
          const formLabel = useForm6K ? "6-K" : "8-K";
          const subtitleNode = useForm6K ? (
            <><Term term="6-K">6-K</Term> · {t("外国发行人公告")} · {t("最近")} {form6k.length} {t("条")}</>
          ) : (
            <><Term term="8-K">{t("公司重大事项")}</Term> · {t("最近")} {form8k.length} {t("条")}</>
          );
          return (
            <Section
              id="form-8k"
              icon="📰"
              title={formLabel}
              subtitleNode={subtitleNode}
            >
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

        {/* 7. 内部人交易 */}
        <Section
          id="insider-trading"
          icon="👤"
          title={t("内部人交易")}
          subtitleNode={<><Term term="Form 4">Form 4</Term> · {t("最近")} {form4.length} {t("条")}</>}
        >
          {stock.cik && form4.length > 0 ? (
            <InsiderTradeList cik={stock.cik} filings={form4} />
          ) : !stock.cik ? (
            <Placeholder text={t("此股票暂无 SEC CIK 映射")} />
          ) : (
            <Placeholder text={t("最近无内部人 Form 4 申报")} />
          )}
        </Section>

        {/* 8. 股本动态 */}
        <Section
          id="capital-dynamics"
          icon="📉"
          title={t("股本动态")}
          subtitleNode={
            <>
              <Term term="摊薄股数">{t("摊薄股数")}</Term> +{" "}
              <Term term="回购">{t("回购")}</Term> +{" "}
              <Term term="SBC">SBC</Term> {t("稀释")}
            </>
          }
        >
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

        {/* 9. 机构持仓 */}
        <Section
          id="inst-13f"
          icon="🏛️"
          title={t("机构持仓")}
          subtitleNode={
            inst13f?.summary?.date ? (
              <><Term term="13F">13F</Term> · {inst13f.summary.date}</>
            ) : (
              <Term term="13F">13F</Term>
            )
          }
        >
          {inst13f && inst13f.summary?.date ? (
            <Inst13FBlock data={inst13f} />
          ) : (
            <Placeholder text={t("暂无 13F 机构持仓数据")} />
          )}
        </Section>

        {/* 期权异动 */}
        <Section
          id="options-activity"
          icon="🎯"
          title={t("期权异动")}
          subtitleNode={
            options?.atm_iv != null ? (
              <>
                <Term term="ATM IV">ATM IV</Term> {(options.atm_iv * 100).toFixed(1)}% ·{" "}
                <Term term="Put/Call">P/C</Term>{" "}
                {options.put_call_ratio != null ? options.put_call_ratio.toFixed(2) : "—"}
              </>
            ) : (
              t("聪明钱大单监控")
            )
          }
        >
          {options && options.top_contracts.length > 0 ? (
            <OptionsActivityBlock data={options} />
          ) : (
            <Placeholder text={t("暂无期权异动数据")} />
          )}
        </Section>

        {/* 公司简介 — EN mode: 用 FMP 原文英文; zh-CN: 中文; zh-HK: opencc 转繁 */}
        {(descriptionCn || profile?.description) && (
          <Section icon="ℹ️" title={t("公司简介")}>
            <div className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-line">
              {isEnglish
                ? (profile?.description || descriptionCn)
                : tCn(descriptionCn || profile?.description)}
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

function Metric({ label, value, small = false }: { label: React.ReactNode; value: string; small?: boolean }) {
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
  subtitleNode,
  comingSoon = false,
  id,
  children,
}: {
  icon: string;
  title: string;
  subtitle?: string;
  subtitleNode?: React.ReactNode;
  comingSoon?: boolean;
  id?: string;
  children: React.ReactNode;
}) {
  const { t } = useLocale();
  return (
    <section
      id={id}
      className="mb-6 p-6 bg-white/80 dark:bg-white/5 backdrop-blur border border-slate-200 dark:border-white/10 rounded-2xl shadow-sm scroll-mt-6"
    >
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-baseline gap-3">
          <span className="text-2xl">{icon}</span>
          <h2 className="text-xl font-semibold">{title}</h2>
          {subtitleNode ? (
            <span className="text-sm text-slate-500 dark:text-slate-400">{subtitleNode}</span>
          ) : subtitle ? (
            <span className="text-sm text-slate-500 dark:text-slate-400">{subtitle}</span>
          ) : null}
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

function FinancialTable({
  quarters,
  cashFlow = [],
  shares = [],
}: {
  quarters: FMPIncomeQuarter[];
  cashFlow?: CashFlowQuarter[];
  shares?: ShareCountQuarter[];
}) {
  const { t } = useLocale();
  // 过滤掉 FMP 的"占位记录" — 财报还没正式发但 FMP 提前建了行
  // 典型特征: revenue/NI 有但 diluted shares / margin / EPS 全是 0
  // 例: AES 2026 Q1 (5-13 才发) FMP 已有 revenue=3.18B 但 diluted=0, gross_margin=0
  const filtered = quarters.filter((q) => {
    // 三个核心字段全部为 0 (或 null) → 判定为占位, 跳过
    const grossEmpty = !q.grossProfitRatio;
    const opEmpty = !q.operatingIncomeRatio;
    const epsEmpty = !q.epsdiluted;
    return !(grossEmpty && opEmpty && epsEmpty);
  });
  // 倒序排列（最新在前）, 取前 4 季 (上游拉 6 季 buffer 给 filter)
  const sorted = [...filtered].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 4);

  // 按 date 匹配 cashFlow (FCF / OCF 来自 fmp_extras.sbc, 8 季度)
  const cfByDate = useMemo(() => {
    const m = new Map<string, CashFlowQuarter>();
    for (const c of cashFlow) {
      if (c.date) m.set(c.date, c);
    }
    return m;
  }, [cashFlow]);

  // 取每一季的 FCF / Capex / OCF
  const cfData = sorted.map(q => {
    const cf = cfByDate.get(q.date);
    const fcf = cf?.fcf ?? null;
    const ocf = cf?.ocf ?? null;
    // Capex = OCF - FCF (会计恒等式)
    const capex = fcf != null && ocf != null ? ocf - fcf : null;
    return { fcf, ocf, capex };
  });

  // YoY: 用 shares (8 季度营收数据) 找 ~365 天前的对应季度
  const computeYoY = (): number | null => {
    if (sorted.length === 0 || shares.length < 5) return null;
    const cur = sorted[0];
    const yoyShares = shares.find(s => {
      if (!s.date || !cur.date) return false;
      const cd = new Date(cur.date).getTime();
      const sd = new Date(s.date).getTime();
      const diff = Math.abs((cd - sd) / 86400000 - 365);
      return diff <= 31; // 30 天容差
    });
    if (!yoyShares?.revenue || !cur.revenue) return null;
    return ((cur.revenue - yoyShares.revenue) / yoyShares.revenue) * 100;
  };
  const yoyRev = computeYoY();

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
          <FinancialRow label={t("营业利润率")} values={sorted.map(q => q.operatingIncomeRatio * 100)} formatter={v => `${v.toFixed(1)}%`} />
          <FinancialRow label={t("净利率")} values={sorted.map(q => q.netIncomeRatio * 100)} formatter={v => `${v.toFixed(1)}%`} />
          <FinancialRow
            label={<><Term term="GAAP EPS">{t("GAAP EPS")}</Term> <span className="text-xs text-slate-400 dark:text-slate-500 font-normal">({t("摊薄")})</span></>}
            values={sorted.map(q => q.epsdiluted)}
            formatter={v => `$${v.toFixed(2)}`}
          />
          <FinancialRow
            label={<><Term term="FCF">FCF</Term> {t("自由现金流")}</>}
            values={cfData.map(c => c.fcf as number)}
            formatter={formatUSD}
          />
          <FinancialRow
            label={<><Term term="Capex">Capex</Term> {t("资本开支")}</>}
            values={cfData.map(c => c.capex as number)}
            formatter={v => formatUSD(Math.abs(v))}
          />
          <FinancialRow
            label={<Term term="FCF/营收">FCF / {t("营收")}</Term>}
            values={sorted.map((q, i) => {
              const fcf = cfData[i]?.fcf;
              return fcf && q.revenue ? (fcf / q.revenue) * 100 : (NaN as unknown as number);
            })}
            formatter={v => `${v.toFixed(1)}%`}
          />
        </tbody>
      </table>

      {(yoyRev != null || sorted.length >= 2) && (
        <div className="mt-4 text-xs text-slate-500 dark:text-slate-400 flex flex-wrap gap-x-4 gap-y-1">
          {yoyRev != null && (
            <span>
              {t("营收同比")} (YoY)：
              <span className={`ml-1 font-medium ${colorClass(yoyRev)}`}>
                {formatPercent(yoyRev)}
              </span>
            </span>
          )}
          {sorted.length >= 2 && (() => {
            const change = calcChange(sorted[0].revenue, sorted[1].revenue);
            if (change === null) return null;
            return (
              <span>
                {t("营收环比")} (QoQ)：
                <span className={`ml-1 font-medium ${colorClass(change)}`}>
                  {formatPercent(change)}
                </span>
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
  label: React.ReactNode;
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

function ownerTitleLabel(
  parsed: { is_director: boolean; is_officer: boolean; is_ten_pct: boolean; owner_title_cn: string | null },
  t: (s: string) => string,
  tCn: (s: string | null | undefined) => string,
): string {
  // 优先用 officerTitle，否则按角色拼 (HK 模式 owner_title_cn 走 opencc)
  if (parsed.owner_title_cn) return tCn(parsed.owner_title_cn);
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
  const { t, tCn } = useLocale();
  const [expanded, setExpanded] = useState(false);
  const INITIAL_ROWS = 5;

  // 按日期倒序（虽然 EDGAR 一般已是倒序，保险起见）
  const sorted = [...filings].sort((a, b) => b.filingDate.localeCompare(a.filingDate));
  const displayed = expanded ? sorted : sorted.slice(0, INITIAL_ROWS);
  const hidden = sorted.length - INITIAL_ROWS;

  // ====== 场景标签：统计买入/卖出信号 ======
  const insiderBadges: { color: "green" | "amber" | "red" | "slate"; label: string; labelEn: string; hint: string; hintEn: string }[] = [];
  // 90 天内的统计
  const now = new Date();
  const ninetyDaysAgo = new Date(now.getTime() - 90 * 86400000).toISOString().slice(0, 10);
  const recent = sorted.filter(f => f.filingDate >= ninetyDaysAgo);
  let buyCount = 0;
  let sellCount = 0;
  let buyValue = 0;
  let sellValue = 0;
  for (const f of recent) {
    const txs = f.parsed?.transactions || [];
    for (const tx of txs) {
      if (tx.kind !== "non-derivative") continue;
      if (tx.acquired_disposed === "A") {
        // 仅算公开市场买入（非授予 / 非行权）
        if (tx.code === "P") {
          buyCount++;
          buyValue += tx.value || 0;
        }
      } else if (tx.acquired_disposed === "D") {
        // 公开市场卖出
        if (tx.code === "S") {
          sellCount++;
          sellValue += tx.value || 0;
        }
      }
    }
  }
  if (buyCount >= 3) {
    insiderBadges.push({
      color: "green",
      label: "内部人买入",
      labelEn: "Insider Buying",
      hint: `90 天内 ${buyCount} 笔公开市场买入，合计 ${formatUSD(buyValue)}`,
      hintEn: `${buyCount} open-market buys in 90 days, totaling ${formatUSD(buyValue)}`,
    });
  }
  if (sellCount >= 5 && buyCount === 0) {
    insiderBadges.push({
      color: "red",
      label: "持续套现",
      labelEn: "Sustained Selling",
      hint: `90 天内 ${sellCount} 笔卖出 (${formatUSD(sellValue)})，无买入`,
      hintEn: `${sellCount} sells (${formatUSD(sellValue)}) in 90 days, no buys`,
    });
  } else if (sellCount > 0 && buyCount === 0) {
    insiderBadges.push({
      color: "amber",
      label: "仅有卖出",
      labelEn: "Sells Only",
      hint: `90 天内 ${sellCount} 笔卖出，无买入`,
      hintEn: `${sellCount} sells in 90 days, no buys`,
    });
  }

  return (
    <div className="space-y-3">
      {insiderBadges.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-slate-500 dark:text-slate-400 mr-1">{t("场景")}:</span>
          {insiderBadges.map((b, i) => (
            <ScenarioBadge key={i} color={b.color} label={b.label} labelEn={b.labelEn} hint={b.hint} hintEn={b.hintEn} />
          ))}
        </div>
      )}
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
          {displayed.map(f => {
            const url = filingUrl(cik, f.accessionNumber, f.primaryDocument);
            const parsed = f.parsed;
            const summary = parsed ? summarizeFiling(parsed, t) : null;
            const ownerName = parsed?.owner_name || "—";
            const ownerTitle = parsed ? ownerTitleLabel(parsed, t, tCn) : "";
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
      {hidden > 0 && (
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          className="mt-3 text-sm text-indigo-600 dark:text-indigo-400 hover:underline font-medium"
        >
          {expanded ? `↑ ${t("收起")}` : `↓ ${t("展开全部")} (${t("还有")} ${hidden} ${t("条")})`}
        </button>
      )}
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
  const { t, tCn, isEnglish } = useLocale();
  const [expanded, setExpanded] = useState(false);
  const INITIAL_ROWS = 5;
  const sorted = [...filings].sort((a, b) => b.filingDate.localeCompare(a.filingDate));
  const displayed = expanded ? sorted : sorted.slice(0, INITIAL_ROWS);
  const hidden = sorted.length - INITIAL_ROWS;

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-200 dark:border-white/10 text-slate-500 dark:text-slate-400">
            <th className="text-left py-2 pr-3 font-normal whitespace-nowrap">{t("申报日")}</th>
            <th className="text-left py-2 pr-3 font-normal">{isForm6K ? t("文档") : t("事件")}</th>
            <th className="text-left py-2 pr-3 font-normal">{t("中文摘要")}</th>
            <th className="text-right py-2 pl-3 font-normal whitespace-nowrap">SEC</th>
          </tr>
        </thead>
        <tbody>
          {displayed.map(f => {
            const url = filingUrl(cik, f.accessionNumber, f.primaryDocument);
            const itemLabels = isForm6K ? [] : parse8KItems(f.items);
            const isRoutine = f.summary_skipped === "routine";
            // 任何非 null 的 summary_skipped (除 routine 外) 表示已尝试过但失败
            // 不应该显示"生成中…"误导用户
            const wasAttempted = f.summary_skipped && f.summary_skipped !== "routine";
            return (
              <tr
                key={f.accessionNumber}
                className="border-b border-slate-100 dark:border-white/5 hover:bg-slate-50 dark:hover:bg-white/5 transition align-top"
              >
                <td className="py-3 pr-3 font-medium tabular-nums whitespace-nowrap">{f.filingDate}</td>
                <td className="py-3 pr-3">
                  {isForm6K ? (
                    <span className="text-xs text-slate-600 dark:text-slate-400 truncate max-w-[200px] inline-block align-middle">
                      {f.primaryDocDescription || f.primaryDocument || "—"}
                    </span>
                  ) : itemLabels.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5 max-w-[180px]">
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
                <td className="py-3 pr-3 text-sm text-slate-700 dark:text-slate-300 leading-relaxed max-w-[420px]">
                  {isEnglish ? (
                    // EN mode: 不显示中文摘要 (对英文用户没用), 引导点 SEC 看英文原文
                    <span className="text-xs text-slate-400 dark:text-slate-500 italic">
                      Click SEC → for original filing
                    </span>
                  ) : f.summary_cn ? (
                    <span>{tCn(f.summary_cn)}</span>
                  ) : isRoutine ? (
                    <span className="text-xs text-slate-400 dark:text-slate-500 italic">
                      {t("常规公告（业绩公告 / 财务表 等），详见原文")}
                    </span>
                  ) : wasAttempted ? (
                    <span className="text-xs text-slate-400 dark:text-slate-500 italic">
                      {t("暂无中文摘要,详见 SEC 原文")}
                    </span>
                  ) : (
                    <span className="text-xs text-slate-400 dark:text-slate-500 italic">
                      {t("摘要生成中…")}
                    </span>
                  )}
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
      {hidden > 0 && (
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          className="mt-3 text-sm text-indigo-600 dark:text-indigo-400 hover:underline font-medium"
        >
          {expanded ? `↑ ${t("收起")}` : `↓ ${t("展开全部")} (${t("还有")} ${hidden} ${t("条")})`}
        </button>
      )}
      <div className="mt-3 text-xs text-slate-500 dark:text-slate-400">
        {isForm6K ? (
          <>
            <Term term="6-K">Form 6-K</Term>{" "}
            {t("是外国发行人 (foreign private issuer) 用来替代 8-K 的报告，发生重大事件时申报")}
          </>
        ) : (
          <>
            <Term term="8-K">8-K</Term>{" "}
            {t("是公司在出现重大事项后 4 个工作日内必须申报的公告（如高管变动、并购、业绩预告等）")}
          </>
        )}
      </div>
    </div>
  );
}

function Inst13FBlock({ data }: { data: Inst13F }) {
  const { t } = useLocale();
  const { summary, topHolders } = data;

  // ====== 场景标签：机构持仓动向 ======
  const instBadges: { color: "green" | "amber" | "red" | "slate"; label: string; labelEn: string; hint: string; hintEn: string }[] = [];
  const investorChange = summary.investorsHoldingChange;
  if (investorChange != null && summary.investorsHolding) {
    const pct = (investorChange / summary.investorsHolding) * 100;
    if (pct >= 5) {
      instBadges.push({
        color: "green",
        label: "机构增持",
        labelEn: "Institutions Increasing",
        hint: `本季度机构数 +${investorChange.toLocaleString()} (${pct.toFixed(1)}%)`,
        hintEn: `Institutions this quarter +${investorChange.toLocaleString()} (${pct.toFixed(1)}%)`,
      });
    } else if (pct <= -5) {
      instBadges.push({
        color: "red",
        label: "机构减持",
        labelEn: "Institutions Reducing",
        hint: `本季度机构数 ${investorChange.toLocaleString()} (${pct.toFixed(1)}%)`,
        hintEn: `Institutions this quarter ${investorChange.toLocaleString()} (${pct.toFixed(1)}%)`,
      });
    }
  }
  // 新进 vs 清仓
  if (summary.newPositions != null && summary.closedPositions != null) {
    const net = summary.newPositions - summary.closedPositions;
    if (net >= 50) {
      instBadges.push({
        color: "green",
        label: "新建仓多",
        labelEn: "New Position Wave",
        hint: `本季度新进 ${summary.newPositions} - 清仓 ${summary.closedPositions} = +${net}`,
        hintEn: `New ${summary.newPositions} - Closed ${summary.closedPositions} = +${net}`,
      });
    } else if (net <= -50) {
      instBadges.push({
        color: "red",
        label: "清仓潮",
        labelEn: "Closing Wave",
        hint: `本季度新进 ${summary.newPositions} - 清仓 ${summary.closedPositions} = ${net}`,
        hintEn: `New ${summary.newPositions} - Closed ${summary.closedPositions} = ${net}`,
      });
    }
  }
  // 高度机构化
  if (summary.ownershipPercent != null) {
    if (summary.ownershipPercent >= 90) {
      instBadges.push({
        color: "slate",
        label: "高度机构化",
        labelEn: "Highly Institutional",
        hint: `13F 机构合计持有 ${summary.ownershipPercent.toFixed(1)}% 流通股 (≥90%)`,
        hintEn: `13F institutions hold ${summary.ownershipPercent.toFixed(1)}% of float (≥90%)`,
      });
    } else if (summary.ownershipPercent < 50) {
      instBadges.push({
        color: "amber",
        label: "机构化偏低",
        labelEn: "Low Institutional",
        hint: `13F 机构合计持有 ${summary.ownershipPercent.toFixed(1)}% 流通股 (<50%)`,
        hintEn: `13F institutions hold ${summary.ownershipPercent.toFixed(1)}% of float (<50%)`,
      });
    }
  }

  return (
    <div className="space-y-4">
      {/* 场景标签 */}
      {instBadges.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-slate-500 dark:text-slate-400 mr-1">{t("场景")}:</span>
          {instBadges.map((b, i) => (
            <ScenarioBadge key={i} color={b.color} label={b.label} labelEn={b.labelEn} hint={b.hint} hintEn={b.hintEn} />
          ))}
        </div>
      )}

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
          label={<Term term="新进">{t("新进")}</Term>}
          value={summary.newPositions?.toLocaleString() ?? "—"}
          isCount
          colorOverride={summary.newPositions ? "text-emerald-600 dark:text-emerald-400" : undefined}
        />
        <Stat
          label={<Term term="清仓">{t("清仓")}</Term>}
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
            <Term term="13F">13F</Term>{" "}
            {t("由管理资产 ≥1 亿美元的机构每季度申报，截止后 45 天内披露。本表按持股占比排序")}
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
  label: React.ReactNode;
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
  const { t, tCn, isEnglish } = useLocale();
  const [expanded, setExpanded] = useState(false);
  const PREVIEW_CHARS = 800;
  // EN mode: 优先英文原文 (data.content_en), 还没有就 fallback 中文 + amber 提示
  const enText = (data as TranscriptCN & { content_en?: string }).content_en;
  const useEn = isEnglish && enText;
  const fullText = useEn ? enText : tCn(data.content_cn);
  const showEnPending = isEnglish && !enText;
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
        <span>{useEn ? "English original" : t("中文翻译")}</span>
        {!useEn && data.content_en_chars && (
          <span>· {t("英文原文")} {(data.content_en_chars / 1000).toFixed(1)}K {t("字符")}</span>
        )}
        <span>· {(fullText.length / 1000).toFixed(1)}K {useEn ? "chars" : t("字")}</span>
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

      {showEnPending && (
        <div className="mb-3 rounded-md border border-amber-200 dark:border-amber-500/30 bg-amber-50 dark:bg-amber-500/10 px-3 py-2 text-xs text-amber-800 dark:text-amber-300 leading-relaxed">
          ⏳ English original transcript will be available after next data refresh (within 24h). Showing Chinese translation as fallback.
        </div>
      )}

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

      {!useEn && (
        <div className="mt-4 pt-3 border-t border-slate-200 dark:border-white/10 text-xs text-slate-500 dark:text-slate-400">
          {t("免责声明")}：{t("中文翻译，仅供参考。投资决策请以英文原文及官方文件为准")}
        </div>
      )}
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

  // ====== 场景标签：期权情绪 ======
  const optBadges: { color: "green" | "amber" | "red" | "slate"; label: string; labelEn: string; hint: string; hintEn: string }[] = [];
  if (put_call_ratio != null) {
    if (put_call_ratio < 0.7) {
      optBadges.push({
        color: "green",
        label: "看涨情绪",
        labelEn: "Bullish Sentiment",
        hint: `Put/Call = ${put_call_ratio.toFixed(2)} (<0.7)，多头主导`,
        hintEn: `Put/Call = ${put_call_ratio.toFixed(2)} (<0.7), bulls dominant`,
      });
    } else if (put_call_ratio > 1.2) {
      optBadges.push({
        color: "red",
        label: "看跌情绪",
        labelEn: "Bearish Sentiment",
        hint: `Put/Call = ${put_call_ratio.toFixed(2)} (>1.2)，空头主导`,
        hintEn: `Put/Call = ${put_call_ratio.toFixed(2)} (>1.2), bears dominant`,
      });
    }
  }
  if (atm_iv != null) {
    if (atm_iv >= 0.5) {
      optBadges.push({
        color: "amber",
        label: "高 IV",
        labelEn: "High IV",
        hint: `ATM IV ${(atm_iv * 100).toFixed(1)}% (≥50%)，市场预期大波动`,
        hintEn: `ATM IV ${(atm_iv * 100).toFixed(1)}% (≥50%), market expects high volatility`,
      });
    } else if (atm_iv < 0.2) {
      optBadges.push({
        color: "slate",
        label: "低 IV",
        labelEn: "Low IV",
        hint: `ATM IV ${(atm_iv * 100).toFixed(1)}% (<20%)，市场平静`,
        hintEn: `ATM IV ${(atm_iv * 100).toFixed(1)}% (<20%), market calm`,
      });
    }
  }
  // 异动合约数量
  const unusualCount = top_contracts.filter(c => c.vol_oi_ratio != null && c.vol_oi_ratio >= 2).length;
  if (unusualCount >= 3) {
    optBadges.push({
      color: "amber",
      label: "异动密集",
      labelEn: "Dense Activity",
      hint: `Top 10 中有 ${unusualCount} 个合约 vol/OI ≥ 2`,
      hintEn: `${unusualCount} of top 10 contracts have vol/OI ≥ 2`,
    });
  }

  return (
    <div className="space-y-4">
      {/* 场景标签 */}
      {optBadges.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-slate-500 dark:text-slate-400 mr-1">{t("场景")}:</span>
          {optBadges.map((b, i) => (
            <ScenarioBadge key={i} color={b.color} label={b.label} labelEn={b.labelEn} hint={b.hint} hintEn={b.hintEn} />
          ))}
        </div>
      )}
      {/* 顶部 4 格 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat
          label={<Term term="ATM IV">ATM IV</Term>}
          value={atm_iv != null ? `${(atm_iv * 100).toFixed(1)}%` : "—"}
          subtitle={atm_iv_count ? `${atm_iv_count} ${t("个候选")}` : undefined}
        />
        <Stat
          label={<><Term term="Put/Call">Put/Call</Term> {t("量比")}</>}
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
                <th className="text-right py-2 px-3 font-normal"><Term term="DTE">DTE</Term></th>
                <th className="text-right py-2 px-3 font-normal">{t("成交量")}</th>
                <th className="text-right py-2 px-3 font-normal">{t("未平仓")}</th>
                <th className="text-right py-2 px-3 font-normal"><Term term="vol/OI">vol/OI</Term></th>
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
            <Term term="vol/OI">vol/OI</Term>{" "}
            {t("≥ 2 标橙底 = 当日成交量超过历史未平仓量 2 倍，属异动")} ·{" "}
            <Term term="ATM IV">ATM IV</Term>{" "}
            {t("已过滤")} <Term term="OI">OI</Term>{"<100 "}
            {t("+ 异常值（防 stale 数据）")}
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
  earnings,
  ratings,
}: {
  earnings: EarningRecord[];
  ratings: RatingChange[];
}) {
  const { t } = useLocale();

  // 过去 4 次已发财报（计算 Beat/Miss）
  const past = earnings
    .filter(e => e.eps_actual != null && e.eps_estimate != null)
    .slice(0, 4);

  // ====== 场景标签：Beat/Miss 历史 + 评级动向 ======
  const analystBadges: { color: "green" | "amber" | "red" | "slate"; label: string; labelEn: string; hint: string; hintEn: string }[] = [];
  if (past.length >= 4) {
    let beatCount = 0;
    let missCount = 0;
    for (const e of past) {
      const surprise =
        e.eps_estimate && e.eps_estimate !== 0
          ? ((e.eps_actual! - e.eps_estimate) / Math.abs(e.eps_estimate)) * 100
          : null;
      if (surprise == null) continue;
      if (surprise > 3) beatCount++;
      else if (surprise < -3) missCount++;
    }
    if (beatCount >= 4) {
      analystBadges.push({
        color: "green",
        label: "连续超预期",
        labelEn: "Consecutive Beats",
        hint: `最近 ${past.length} 次财报全部 Beat (差异 >3%)`,
        hintEn: `All of last ${past.length} earnings beat (>3%)`,
      });
    } else if (beatCount >= 3) {
      analystBadges.push({
        color: "green",
        label: "多次超预期",
        labelEn: "Multiple Beats",
        hint: `最近 ${past.length} 次财报中 ${beatCount} 次 Beat`,
        hintEn: `${beatCount} of last ${past.length} earnings beat`,
      });
    } else if (missCount >= 2) {
      analystBadges.push({
        color: "red",
        label: "多次低于预期",
        labelEn: "Multiple Misses",
        hint: `最近 ${past.length} 次财报中 ${missCount} 次 Miss (差异 <-3%)`,
        hintEn: `${missCount} of last ${past.length} earnings missed (<-3%)`,
      });
    }
  }
  // 评级动向（最近 5 次）
  const recentRatings = ratings.slice(0, 5);
  const upCount = recentRatings.filter(r => r.action === "upgrade").length;
  const downCount = recentRatings.filter(r => r.action === "downgrade").length;
  if (upCount >= 2 && upCount > downCount) {
    analystBadges.push({
      color: "green",
      label: "评级上调",
      labelEn: "Rating Upgrades",
      hint: `最近 5 次评级中 ${upCount} 次升级 vs ${downCount} 次降级`,
      hintEn: `Last 5 ratings: ${upCount} upgrades vs ${downCount} downgrades`,
    });
  } else if (downCount >= 2 && downCount > upCount) {
    analystBadges.push({
      color: "red",
      label: "评级下调",
      labelEn: "Rating Downgrades",
      hint: `最近 5 次评级中 ${downCount} 次降级 vs ${upCount} 次升级`,
      hintEn: `Last 5 ratings: ${downCount} downgrades vs ${upCount} upgrades`,
    });
  }

  return (
    <div className="space-y-5">
      {/* 场景标签 */}
      {analystBadges.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-slate-500 dark:text-slate-400 mr-1">{t("场景")}:</span>
          {analystBadges.map((b, i) => (
            <ScenarioBadge key={i} color={b.color} label={b.label} labelEn={b.labelEn} hint={b.hint} hintEn={b.hintEn} />
          ))}
        </div>
      )}
      {/* 过去 4 次 Beat / Miss */}
      {past.length > 0 && (
        <div>
          <div className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
            {t("最近 4 次财报")} <Term term="Beat">Beat</Term> / <Term term="Miss">Miss</Term>
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
              const actionTermKey: Record<string, string> = {
                upgrade: "升级",
                downgrade: "降级",
                initiate: "首次覆盖",
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
                    {actionTermKey[r.action || ""] ? (
                      <Term term={actionTermKey[r.action || ""]}>
                        {t(actionCN[r.action || ""] || r.action || "—")}
                      </Term>
                    ) : (
                      t(actionCN[r.action || ""] || r.action || "—")
                    )}
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

  const timeLabelNode = (time: string | null): React.ReactNode => {
    if (time === "bmo") return <Term term="盘前">{t("盘前")}</Term>;
    if (time === "amc") return <Term term="盘后">{t("盘后")}</Term>;
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
                {timeLabelNode(upcoming.time)}
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
                      {timeLabelNode(e.time)}
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

  // ====== 场景标签计算（纯规则）======
  const badges: { color: "green" | "amber" | "red" | "slate"; label: string; labelEn: string; hint: string; hintEn: string }[] = [];
  if (dilutionPct != null) {
    if (dilutionPct <= -1) {
      badges.push({
        color: "green",
        label: "持续缩股",
        labelEn: "Persistent Buyback",
        hint: `8 季度股本变化 ${dilutionPct.toFixed(2)}% (回购大于稀释)`,
        hintEn: `8-quarter share change ${dilutionPct.toFixed(2)}% (buyback > dilution)`,
      });
    } else if (dilutionPct >= 1) {
      badges.push({
        color: "red",
        label: "显著稀释",
        labelEn: "Significant Dilution",
        hint: `8 季度股本变化 +${dilutionPct.toFixed(2)}% (新发大于回购)`,
        hintEn: `8-quarter share change +${dilutionPct.toFixed(2)}% (issuance > buyback)`,
      });
    } else {
      badges.push({
        color: "slate",
        label: "股本平稳",
        labelEn: "Stable Share Count",
        hint: `8 季度股本变化 ${dilutionPct.toFixed(2)}%`,
        hintEn: `8-quarter share change ${dilutionPct.toFixed(2)}%`,
      });
    }
  }
  if (sbcVsNI != null) {
    if (sbcVsNI <= 10) {
      badges.push({
        color: "green",
        label: "低稀释",
        labelEn: "Low Dilution",
        hint: `SBC/净利 = ${sbcVsNI.toFixed(1)}% (≤10%)`,
        hintEn: `SBC/Net Income = ${sbcVsNI.toFixed(1)}% (≤10%)`,
      });
    } else if (sbcVsNI >= 30) {
      badges.push({
        color: "red",
        label: "高稀释",
        labelEn: "High Dilution",
        hint: `SBC/净利 = ${sbcVsNI.toFixed(1)}% (≥30%)`,
        hintEn: `SBC/Net Income = ${sbcVsNI.toFixed(1)}% (≥30%)`,
      });
    }
  }
  // 回购放缓：最近 4 季 vs 前 4 季
  const recentBuyback = sortedCF.slice(0, 4).reduce((sum, q) => sum + Math.abs(q.buyback || 0), 0);
  const priorBuyback = sortedCF.slice(4, 8).reduce((sum, q) => sum + Math.abs(q.buyback || 0), 0);
  if (priorBuyback > 0 && recentBuyback < priorBuyback * 0.5) {
    badges.push({
      color: "amber",
      label: "回购放缓",
      labelEn: "Buyback Slowdown",
      hint: `最近 4 季回购 ${formatUSD(recentBuyback)} vs 前 4 季 ${formatUSD(priorBuyback)} (<50%)`,
      hintEn: `Last 4 quarters buyback ${formatUSD(recentBuyback)} vs prior 4 quarters ${formatUSD(priorBuyback)} (<50%)`,
    });
  } else if (priorBuyback > 0 && recentBuyback > priorBuyback * 1.5) {
    badges.push({
      color: "green",
      label: "加大回购",
      labelEn: "Buyback Acceleration",
      hint: `最近 4 季回购 ${formatUSD(recentBuyback)} vs 前 4 季 ${formatUSD(priorBuyback)} (>150%)`,
      hintEn: `Last 4 quarters buyback ${formatUSD(recentBuyback)} vs prior 4 quarters ${formatUSD(priorBuyback)} (>150%)`,
    });
  }

  return (
    <div className="space-y-4">
      {/* 场景标签 */}
      {badges.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-slate-500 dark:text-slate-400 mr-1">{t("场景")}:</span>
          {badges.map((b, i) => (
            <ScenarioBadge key={i} color={b.color} label={b.label} labelEn={b.labelEn} hint={b.hint} hintEn={b.hintEn} />
          ))}
        </div>
      )}

      {/* 顶部 4 格 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat
          label={<Term term="摊薄股数">{t("摊薄股数")}</Term>}
          value={latestShs ? formatShares(latestShs) : "—"}
          subtitle={sortedShares[0]?.date ? `${sortedShares[0].calendar_year} ${sortedShares[0].period}` : undefined}
          delta={dilutionPct}
        />
        <Stat
          label={<><Term term="SBC">SBC</Term> <Term term="TTM">TTM</Term></>}
          value={ttmSBC ? formatUSD(ttmSBC) : "—"}
          subtitle={sbcVsCap != null ? `${sbcVsCap.toFixed(2)}% ${t("市值")}` : undefined}
          colorOverride={ttmSBC > 0 ? "text-orange-600 dark:text-orange-400" : undefined}
        />
        <Stat
          label={<><Term term="回购">{t("回购")}</Term> <Term term="TTM">TTM</Term></>}
          value={ttmBuyback ? formatUSD(Math.abs(ttmBuyback)) : "—"}
          colorOverride={ttmBuyback < 0 ? "text-emerald-600 dark:text-emerald-400" : undefined}
        />
        <Stat
          label={<><Term term="SBC">SBC</Term> / {t("净利")}</>}
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
                <th className="text-right py-2 px-3 font-normal">
                  <Term term="摊薄股数">{t("摊薄股数")}</Term>
                </th>
                <th className="text-right py-2 px-3 font-normal"><Term term="SBC">SBC</Term></th>
                <th className="text-right py-2 px-3 font-normal">
                  <Term term="回购">{t("回购")}</Term>
                </th>
                <th className="text-right py-2 pl-3 font-normal"><Term term="FCF">FCF</Term></th>
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
            <Term term="摊薄股数">{t("摊薄股数")}</Term>
            {t(" 减少 = 回购大于股权激励发行；")}
            <Term term="SBC">SBC</Term>
            {t(" 占净利润 ≥30% 视为高稀释，≤10% 为低稀释")}
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

// ====== 财报速评 ======

function EarningsInterpretationBlock({ data }: { data: EarningsInterpretation }) {
  const { t, tCn, isEnglish } = useLocale();
  // Helper: 双语字段切换
  // - EN: 优先 _en 字段, 没有就走 T_EN 字典 (LLM 旧数据 fallback)
  // - HK: opencc 转繁
  // - CN: 原样
  const tx = (zh: string | undefined | null, en: string | undefined | null): string => {
    if (!zh) return "";
    if (isEnglish) return en || t(zh);  // 没 _en 时走字典, 没字典命中再 fallback 原中文
    return tCn(zh);
  };
  const dc = data.data_card;
  const mr = data.market_reaction;

  const resultStyles: Record<string, string> = {
    beat: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300",
    miss: "bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-300",
    mixed: "bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300",
    inline: "bg-slate-100 text-slate-700 dark:bg-slate-500/20 dark:text-slate-300",
  };
  const resultCN: Record<string, string> = {
    beat: "超预期",
    miss: "低于预期",
    mixed: "好坏参半",
    inline: "符合预期",
  };

  const fmtPctVal = (v: number, decimals = 1) => `${v > 0 ? "+" : ""}${v.toFixed(decimals)}%`;
  const fmtPp = (v: number) => `${v > 0 ? "+" : ""}${v.toFixed(0)} pp`;
  const fmtBps = (v: number) => `${v > 0 ? "+" : ""}${v.toFixed(0)} bps`;
  const fmtKPIValue = (k: { value: number; format: string }) => {
    if (k.format === "usd") return formatUSD(k.value);
    if (k.format === "pct") return `${(k.value * 100).toFixed(1)}%`;
    if (k.format === "ratio") return `${k.value.toFixed(2)}`;
    return `${k.value}`;
  };
  const toneToColor = (tone: "positive" | "negative" | "neutral") =>
    tone === "positive"
      ? "text-emerald-600 dark:text-emerald-400"
      : tone === "negative"
      ? "text-red-600 dark:text-red-400"
      : "text-slate-600 dark:text-slate-400";
  const dimStatusColor = (status: string) => {
    if (status === "great") return "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300";
    if (status === "good") return "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300";
    if (status === "ok") return "bg-slate-100 text-slate-700 dark:bg-slate-500/20 dark:text-slate-300";
    if (status === "warn") return "bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300";
    return "bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-300";
  };
  const ratingBadgeColor = (rating: string) => {
    if (rating === "premium") return "bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-300";
    if (rating === "healthy") return "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300";
    if (rating === "mixed") return "bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300";
    return "bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-300";
  };

  return (
    <div className="space-y-6">
      {/* 顶部：result + 倾向标签 */}
      <div className="flex flex-wrap items-center gap-2">
        <span
          className={`px-2 py-0.5 text-xs rounded font-medium ${resultStyles[data.result]}`}
        >
          {t(resultCN[data.result])}
        </span>
        {data.badges.map((b, i) => (
          <ScenarioBadge key={i} color={b.color} label={t(b.label)} labelEn={b.label_en} hint={b.hint} hintEn={b.hint_en} />
        ))}
      </div>

      {/* headline (双语: EN mode 优先 _en) */}
      <div className="text-base font-medium text-slate-800 dark:text-slate-200 leading-relaxed">
        {(isEnglish && (data as { headline_en?: string }).headline_en) || data.headline}
      </div>

      {/* 数据完整性警示 banner */}
      {(data.data_complete === false ||
        data.narrative_status === "pending_transcript_lag" ||
        data.narrative_status === "transcript_unavailable_in_fmp") && (
        <div className="rounded-md border border-amber-200 dark:border-amber-500/30 bg-amber-50 dark:bg-amber-500/10 px-3 py-2 text-xs text-amber-800 dark:text-amber-300 leading-relaxed">
          ⏳ {t("部分数据状态")}：
          {data.data_complete === false && (
            <span> {t("现金流数据(KPI / Beat 质量 / 健康度)未对齐当季,等待数据源同步,通常 1-7 天内自动补齐。")}</span>
          )}
          {data.narrative_status === "pending_transcript_lag" && (
            <span> {t("当季电话会议中文翻译尚未刷新(数据源通常在新财报后 1-2 周更新),管理层叙事段落自动等待最新一季 transcript。")}</span>
          )}
          {data.narrative_status === "transcript_unavailable_in_fmp" && (
            <span>
              {" "}
              {t("当季电话会议在我们使用的数据源(FMP)中暂未收录(可能因数据源版权限制),管理层叙事段落不展示。如需查阅原文,可前往")}
              <a
                href={`https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=${data.ticker}&type=8-K&dateb=&owner=include&count=10`}
                target="_blank"
                rel="noopener noreferrer"
                className="underline hover:text-amber-700 dark:hover:text-amber-200 mx-1"
              >
                SEC EDGAR
              </a>
              {t("查看公司 8-K 公告,或在 Seeking Alpha / 公司 IR 网站查阅完整 transcript。")}
            </span>
          )}
        </div>
      )}

      {/* ① 业绩数据 */}
      <div>
        <div className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
          ① {t("业绩数据")}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 dark:border-white/10 text-slate-500 dark:text-slate-400">
                <th className="text-left py-2 pr-3 font-normal">{t("指标")}</th>
                <th className="text-right py-2 px-3 font-normal">{t("实际")}</th>
                <th className="text-right py-2 px-3 font-normal">{t("预期")}</th>
                <th className="text-right py-2 px-3 font-normal">{t("差异")}</th>
                <th className="text-right py-2 pl-3 font-normal">{t("同比")}</th>
              </tr>
            </thead>
            <tbody>
              {/* EPS (FMP 给的 reported EPS, 通常是公司公布的 Adjusted/Non-GAAP 口径) */}
              <tr className="border-b border-slate-100 dark:border-white/5">
                <td className="py-2 pr-3">
                  <Term term="Reported EPS">{t("Reported EPS")}</Term>{" "}
                  <span className="text-xs text-slate-400 dark:text-slate-500">({t("公司公布")})</span>
                </td>
                <td className="py-2 px-3 text-right tabular-nums font-semibold">
                  {dc.eps_actual != null ? `$${dc.eps_actual.toFixed(2)}` : "—"}
                </td>
                <td className="py-2 px-3 text-right tabular-nums text-slate-500 dark:text-slate-400">
                  {dc.eps_estimate != null ? `$${dc.eps_estimate.toFixed(2)}` : "—"}
                </td>
                <td className="py-2 px-3 text-right tabular-nums">
                  {dc.eps_surprise_pct != null ? (
                    <span className={colorClass(dc.eps_surprise_pct)}>{formatPercent(dc.eps_surprise_pct)}</span>
                  ) : "—"}
                </td>
                <td className="py-2 pl-3 text-right text-slate-400 dark:text-slate-500">—</td>
              </tr>
              {/* 营收 */}
              <tr className="border-b border-slate-100 dark:border-white/5">
                <td className="py-2 pr-3">{t("营收")}</td>
                <td className="py-2 px-3 text-right tabular-nums font-semibold">
                  {dc.rev_actual != null ? formatUSD(dc.rev_actual) : "—"}
                </td>
                <td className="py-2 px-3 text-right tabular-nums text-slate-500 dark:text-slate-400">
                  {dc.rev_estimate != null ? formatUSD(dc.rev_estimate) : "—"}
                </td>
                <td className="py-2 px-3 text-right tabular-nums">
                  {dc.rev_surprise_pct != null ? (
                    <span className={colorClass(dc.rev_surprise_pct)}>{formatPercent(dc.rev_surprise_pct)}</span>
                  ) : "—"}
                </td>
                <td className="py-2 pl-3 text-right tabular-nums">
                  {dc.rev_yoy_pct != null ? (
                    <span className={colorClass(dc.rev_yoy_pct)}>{formatPercent(dc.rev_yoy_pct)}</span>
                  ) : "—"}
                </td>
              </tr>
              {/* 第三指标 (动态: 软件→Adj EBITDA Margin / 半导体→GM 等) */}
              {dc.third_metric && (
                <tr className="border-b border-slate-100 dark:border-white/5">
                  <td className="py-2 pr-3">
                    <span className="font-medium">{dc.third_metric.label}</span>
                    {dc.third_metric.note && (
                      <span className="ml-2 text-xs text-amber-600 dark:text-amber-400">{tx(dc.third_metric.note, dc.third_metric.note_en)}</span>
                    )}
                  </td>
                  <td className="py-2 px-3 text-right tabular-nums font-semibold">
                    {dc.third_metric.format === "pct"
                      ? `${(dc.third_metric.actual * 100).toFixed(1)}%`
                      : dc.third_metric.format === "usd"
                      ? formatUSD(dc.third_metric.actual)
                      : dc.third_metric.format === "raw" && Math.abs(dc.third_metric.actual) >= 1e9
                      ? `${(dc.third_metric.actual / 1e9).toFixed(2)}B`
                      : dc.third_metric.format === "raw" && Math.abs(dc.third_metric.actual) >= 1e6
                      ? `${(dc.third_metric.actual / 1e6).toFixed(2)}M`
                      : dc.third_metric.format === "raw" && Math.abs(dc.third_metric.actual) >= 1e3
                      ? `${(dc.third_metric.actual / 1e3).toFixed(1)}K`
                      : dc.third_metric.actual.toFixed(2)}
                  </td>
                  <td className="py-2 px-3 text-right tabular-nums text-slate-500 dark:text-slate-400">
                    {dc.third_metric.estimate != null
                      ? dc.third_metric.format === "pct"
                        ? `~${(dc.third_metric.estimate * 100).toFixed(0)}%`
                        : formatUSD(dc.third_metric.estimate)
                      : "—"}
                  </td>
                  <td className="py-2 px-3 text-right tabular-nums">
                    {dc.third_metric.surprise_pct != null ? (
                      <span className={colorClass(dc.third_metric.surprise_pct)}>
                        {fmtPctVal(dc.third_metric.surprise_pct)}
                      </span>
                    ) : "—"}
                  </td>
                  <td className="py-2 pl-3 text-right tabular-nums">
                    {dc.third_metric.yoy_change_pp != null ? (
                      <span className={colorClass(dc.third_metric.yoy_change_pp)}>
                        {fmtPp(dc.third_metric.yoy_change_pp)}
                      </span>
                    ) : "—"}
                  </td>
                </tr>
              )}
              {/* 毛利率 */}
              <tr className="border-b border-slate-100 dark:border-white/5">
                <td className="py-2 pr-3">{t("毛利率")}</td>
                <td className="py-2 px-3 text-right tabular-nums font-semibold">
                  {dc.gross_margin != null ? `${(dc.gross_margin * 100).toFixed(1)}%` : "—"}
                </td>
                <td className="py-2 px-3 text-right text-slate-400 dark:text-slate-500">—</td>
                <td className="py-2 px-3 text-right text-slate-400 dark:text-slate-500">—</td>
                <td className="py-2 pl-3 text-right tabular-nums">
                  {dc.gross_margin_yoy_bps != null ? (
                    <span className={colorClass(dc.gross_margin_yoy_bps)}>{fmtBps(dc.gross_margin_yoy_bps)}</span>
                  ) : "—"}
                </td>
              </tr>
              {/* 净利率 */}
              <tr>
                <td className="py-2 pr-3">{t("净利率")}</td>
                <td className="py-2 px-3 text-right tabular-nums font-semibold">
                  {dc.net_margin != null ? `${(dc.net_margin * 100).toFixed(1)}%` : "—"}
                </td>
                <td className="py-2 px-3 text-right text-slate-400 dark:text-slate-500">—</td>
                <td className="py-2 px-3 text-right text-slate-400 dark:text-slate-500">—</td>
                <td className="py-2 pl-3 text-right tabular-nums">
                  {dc.net_margin_yoy_bps != null ? (
                    <span className={colorClass(dc.net_margin_yoy_bps)}>{fmtBps(dc.net_margin_yoy_bps)}</span>
                  ) : "—"}
                </td>
              </tr>
            </tbody>
          </table>
          {/* 备用 YoY 注释 (业务剥离场景如 APP) */}
          {dc.rev_yoy_pct_alt != null && dc.rev_yoy_pct_alt_label && (
            <div className="mt-2 text-xs text-slate-500 dark:text-slate-400 italic">
              📌 {tx(dc.rev_yoy_pct_alt_label, dc.rev_yoy_pct_alt_label_en)} YoY = <span className={colorClass(dc.rev_yoy_pct_alt) + " font-semibold"}>{fmtPctVal(dc.rev_yoy_pct_alt)}</span>
              {dc.rev_qoq_pct != null && (
                <span> · {t("环比")} <span className={colorClass(dc.rev_qoq_pct) + " font-semibold"}>{fmtPctVal(dc.rev_qoq_pct)}</span></span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ② 关键 KPI */}
      {data.kpis && data.kpis.length > 0 && (
        <div>
          <div className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
            ② {t("关键 KPI")}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {data.kpis.map((k, i) => (
              <div
                key={i}
                className="p-3 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-lg"
              >
                <div className="flex items-start justify-between mb-1">
                  <div className="text-xs text-slate-500 dark:text-slate-400">{tx(k.label, k.label_en)}</div>
                  <div
                    className={`w-2 h-2 rounded-full mt-1.5 ${
                      k.tone === "positive"
                        ? "bg-emerald-500"
                        : k.tone === "negative"
                        ? "bg-red-500"
                        : "bg-slate-400"
                    }`}
                  />
                </div>
                <div className={`text-lg font-semibold tabular-nums ${toneToColor(k.tone)}`}>
                  {fmtKPIValue(k)}
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 tabular-nums">
                  {k.yoy_change_pct != null && (
                    <span className={colorClass(k.yoy_change_pct)}>{t("同比")} {fmtPctVal(k.yoy_change_pct, 0)}</span>
                  )}
                  {k.yoy_change_pp != null && (
                    <span className={colorClass(k.yoy_change_pp)}>{t("同比")} {fmtPp(k.yoy_change_pp)}</span>
                  )}
                  {k.qoq_change_pct != null && (
                    <span className={colorClass(k.qoq_change_pct) + " ml-2"}>{t("环比")} {fmtPctVal(k.qoq_change_pct, 0)}</span>
                  )}
                </div>
                {k.note && (
                  <div className="text-[11px] text-slate-400 dark:text-slate-500 mt-1 leading-relaxed">{tx(k.note, k.note_en)}</div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ③ Guidance 管理层指引 */}
      {data.guidance && data.guidance.items.length > 0 && (
        <div>
          <div className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2 flex items-center gap-2">
            <span>③ {t("管理层指引")}</span>
            <span className="text-xs text-slate-400 dark:text-slate-500 font-normal">
              {data.guidance.next_period_label}
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 dark:border-white/10 text-slate-500 dark:text-slate-400">
                  <th className="text-left py-2 pr-3 font-normal">{t("指标")}</th>
                  <th className="text-right py-2 px-3 font-normal">{t("指引区间")}</th>
                  <th className="text-right py-2 pl-3 font-normal">{t("vs 共识")}</th>
                </tr>
              </thead>
              <tbody>
                {data.guidance.items.map((g, i) => (
                  <tr key={i} className="border-b border-slate-100 dark:border-white/5">
                    <td className="py-2 pr-3">{tx(g.metric, g.metric_en)}</td>
                    <td className="py-2 px-3 text-right tabular-nums font-medium">{g.range}</td>
                    <td className="py-2 pl-3 text-right tabular-nums">
                      {g.vs_consensus_pct != null ? (
                        <span className={colorClass(g.vs_consensus_pct)}>
                          {fmtPctVal(g.vs_consensus_pct)} {g.vs_consensus_pct > 0 ? "✅" : ""}
                        </span>
                      ) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {/* summary_text 是 LLM 自由文本, 79% 有 _en, EN 模式下没 _en 直接隐藏 */}
          {data.guidance.summary_text && !(isEnglish && !data.guidance.summary_text_en) && (
            <div className="mt-2 text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              {tx(data.guidance.summary_text, data.guidance.summary_text_en)}
            </div>
          )}
          {/* annual_note 是 LLM 自由文本, 老数据没 _en — EN 模式下没 _en 直接隐藏避免 CN 残留 */}
          {data.guidance.annual_note && !(isEnglish && !data.guidance.annual_note_en) && (
            <div className="mt-1 text-xs text-slate-400 dark:text-slate-500">{tx(data.guidance.annual_note, data.guidance.annual_note_en)}</div>
          )}
        </div>
      )}

      {/* ④ Beat 质量评估 */}
      {data.beat_quality && (
        <div>
          <div className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2 flex items-center gap-2">
            <span>④ {t("Beat 质量评估")}</span>
            <span className={`text-xs px-2 py-0.5 rounded font-semibold ${ratingBadgeColor(data.beat_quality.rating)}`}>
              {tx(data.beat_quality.rating_label, data.beat_quality.rating_label_en)}
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <tbody>
                {data.beat_quality.checks.map((c, i) => {
                  const cLabel = tx(c.label, c.label_en);
                  return (
                  <tr key={i} className="border-b border-slate-100 dark:border-white/5 last:border-0">
                    <td className="py-2 pr-3 text-slate-600 dark:text-slate-400 whitespace-nowrap">
                      <Term term={c.label}>{cLabel}</Term>
                    </td>
                    <td className="py-2 px-3 tabular-nums font-medium">{tx(c.value, c.value_en)}</td>
                    <td className="py-2 px-3">
                      <span
                        className={`inline-block w-2 h-2 rounded-full ${
                          c.status === "good"
                            ? "bg-emerald-500"
                            : c.status === "ok"
                            ? "bg-slate-400"
                            : "bg-red-500"
                        }`}
                      />
                    </td>
                    <td className="py-2 pl-3 text-xs text-slate-500 dark:text-slate-400">{tx(c.hint, c.hint_en)}</td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {data.beat_quality.summary && (
            <div className="mt-2 text-xs text-slate-600 dark:text-slate-400 leading-relaxed italic">
              💡 {tx(data.beat_quality.summary, data.beat_quality.summary_en)}
            </div>
          )}
        </div>
      )}

      {/* ⑤ 健康度 5 维红绿灯 */}
      {data.health && data.health.dimensions.length > 0 ? (
        <div>
          <div className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2 flex items-center gap-2">
            <span>⑤ {t("基本面健康度")}</span>
            <span className="text-xs text-slate-400 dark:text-slate-500 font-normal">
              {t("综合评级")} {data.health.overall_rating}/5
            </span>
          </div>
          <div className="space-y-2">
            {data.health.dimensions.map((d, i) => (
              <div
                key={i}
                className="flex items-start gap-3 p-2 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-lg"
              >
                <div className="flex-shrink-0 w-20 sm:w-24 text-sm text-slate-700 dark:text-slate-300">{tx(d.label, d.label_en)}</div>
                <span className={`flex-shrink-0 inline-block px-2 py-0.5 text-xs rounded font-medium ${dimStatusColor(d.status)}`}>
                  {d.stars === 2 ? "🟢🟢" : d.stars === 1 ? "🟢" : "⚪"}
                </span>
                <div className="flex-1 text-sm text-slate-600 dark:text-slate-400 leading-relaxed">{tx(d.note, d.note_en)}</div>
              </div>
            ))}
          </div>
        </div>
      ) : data.fundamentals && data.fundamentals.length > 0 ? (
        <div>
          <div className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
            {t("基本面信号")}
          </div>
          <ul className="space-y-1.5 text-sm">
            {data.fundamentals.map((f, i) => {
              const dotColor =
                f.tone === "positive"
                  ? "bg-emerald-500"
                  : f.tone === "negative"
                  ? "bg-red-500"
                  : "bg-slate-400";
              return (
                <li key={i} className="flex items-start gap-2">
                  <span className={`mt-1.5 w-1.5 h-1.5 rounded-full flex-shrink-0 ${dotColor}`} />
                  <span className="text-slate-700 dark:text-slate-300 leading-relaxed">{tx(f.text, f.text_en)}</span>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}

      {/* (旧) 市场反应 — 仅老数据 (没有新 health/kpis 字段时) 显示 */}
      {!data.kpis && !data.health && (mr.atm_iv != null || mr.put_call_ratio != null || mr.form8k_30d > 0) && (
        <div>
          <div className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
            {t("市场反应")}
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
            <div className="p-3 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-lg">
              <div className="text-xs text-slate-500 dark:text-slate-400 mb-1"><Term term="ATM IV">ATM IV</Term></div>
              <div className="text-base font-semibold tabular-nums">
                {mr.atm_iv != null ? `${(mr.atm_iv * 100).toFixed(1)}%` : "—"}
              </div>
            </div>
            <div className="p-3 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-lg">
              <div className="text-xs text-slate-500 dark:text-slate-400 mb-1"><Term term="Put/Call">Put/Call</Term></div>
              <div className="text-base font-semibold tabular-nums">
                {mr.put_call_ratio != null ? mr.put_call_ratio.toFixed(2) : "—"}
              </div>
            </div>
            <div className="p-3 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-lg">
              <div className="text-xs text-slate-500 dark:text-slate-400 mb-1">{t("财报后 30 天 ")}<Term term="8-K">8-K</Term></div>
              <div className="text-base font-semibold tabular-nums">{mr.form8k_30d}</div>
            </div>
            <div className="p-3 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-lg">
              <div className="text-xs text-slate-500 dark:text-slate-400 mb-1">{t("评级 30 天")}</div>
              <div className="text-sm tabular-nums">
                {mr.ratings_30d ? (
                  <>
                    ↑{mr.ratings_30d.upgrade} ↓{mr.ratings_30d.downgrade}
                  </>
                ) : "—"}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 段 5: 管理层叙事 (Opus 4.7 提炼) */}
      {data.narrative_status === "done" && data.narrative ? (
        (() => {
          // EN mode: 优先双语字段, 没有就 fallback 中文
          type ThemeWithEn = { title: string; detail: string; title_en?: string; detail_en?: string };
          type NarrativeWithEn = typeof data.narrative & {
            tone_evidence_en?: string;
            schema_version?: number;
          };
          const nar = data.narrative as NarrativeWithEn;
          const enAvailable = isEnglish && nar.themes.some((t) => (t as ThemeWithEn).title_en);
          const renderTitle = (theme: ThemeWithEn) =>
            enAvailable && theme.title_en ? theme.title_en : tCn(theme.title);
          const renderDetail = (theme: ThemeWithEn) =>
            enAvailable && theme.detail_en ? theme.detail_en : tCn(theme.detail);
          const renderEvidence = enAvailable && nar.tone_evidence_en
            ? nar.tone_evidence_en
            : tCn(nar.tone_evidence);
          return (
            <div>
              <div className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2 flex items-baseline gap-2">
                <span>{t("管理层叙事")}</span>
                <span className="text-xs text-slate-400 dark:text-slate-500 font-normal">
                  {enAvailable
                    ? "Extracted from earnings call transcript"
                    : t("基于电话会议中文 transcript 提炼")}
                </span>
                {isEnglish && !enAvailable && (
                  <span className="text-[10px] px-1.5 py-0.5 bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-300 rounded">
                    English version pending
                  </span>
                )}
              </div>
              <div className="space-y-3">
                {nar.themes.map((theme, i) => (
                  <div
                    key={i}
                    className="p-3 bg-slate-50 dark:bg-white/5 border-l-4 border-indigo-300 dark:border-indigo-500/50 rounded-r-lg"
                  >
                    <div className="text-sm font-semibold text-slate-800 dark:text-slate-200 mb-1">
                      {i + 1}. {renderTitle(theme as ThemeWithEn)}
                    </div>
                    <div className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                      {renderDetail(theme as ThemeWithEn)}
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-3 flex items-center gap-2 text-xs">
                <span className="text-slate-500 dark:text-slate-400">{t("整体语气")}：</span>
                <span
                  className={`px-2 py-0.5 rounded font-medium ${
                    nar.tone === "confident"
                      ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300"
                      : nar.tone === "cautious"
                      ? "bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300"
                      : "bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-300"
                  }`}
                >
                  {nar.tone === "confident"
                    ? t("自信")
                    : nar.tone === "cautious"
                    ? t("谨慎")
                    : t("防御")}
                </span>
                <span className="text-slate-500 dark:text-slate-400">
                  · {renderEvidence}
                </span>
              </div>
            </div>
          );
        })()
      ) : null}
      {/* narrative_status=pending / no_transcript 时不显示这一段（保持页面紧凑）*/}

      {/* 免责声明 */}
      <div className="pt-3 border-t border-slate-200 dark:border-white/10 text-xs text-slate-400 dark:text-slate-500 leading-relaxed">
        {t("本速评基于公开数据自动生成，仅作信息参考，不构成投资建议。决策请以原始财报、官方公告及独立研究为准。")}
      </div>
    </div>
  );
}
