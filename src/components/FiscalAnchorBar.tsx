"use client";

import { useState } from "react";
import { useLocale } from "@/components/LocaleProvider";
import type { EarningsInterpretation, TranscriptCN, Inst13F, OptionsActivity } from "@/lib/fmp";
import type { EdgarFiling } from "@/lib/edgar";

/**
 * 主季度锚点条 — 显示在股票详情页顶部
 *
 * 目的: 解决"页面各 section 季度不一致"问题 (e.g. EQR Q4 + transcript Q3)
 *
 * 设计:
 * - 默认收起, 只显示一行 (主季度 + 财报日 + result)
 * - 用户点 "数据状态" 展开看各 section 对齐情况 (✓ / ⏳ / ❌)
 * - 每条状态可点跳到对应 section anchor
 *
 * 状态计算规则:
 * - 业绩数据: 总是 ✓ (来自 EQR.data_card, 已 ingest)
 * - 财报点评 EQR: ✓ (data_complete=true + narrative=done) / ⏳ 其它
 * - 电话会议: 季度对齐 ✓ / 上一季 ⏳ / 无 ❌
 * - 内部人交易 / 8-K: 显示主季度财报日 ±30 天的数量
 * - 13F / 期权: 显示数据快照日期 (参考用)
 */

const RESULT_STYLES: Record<string, string> = {
  beat: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300",
  miss: "bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-300",
  mixed: "bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300",
  inline: "bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300",
};

const RESULT_LABELS: Record<string, string> = {
  beat: "✅ 超预期",
  miss: "❌ 未达预期",
  mixed: "⚠️ 喜忧参半",
  inline: "= 符合预期",
};

type StatusKind = "ok" | "partial" | "stale" | "missing" | "info";

const STATUS_BG: Record<StatusKind, string> = {
  ok: "bg-emerald-50 dark:bg-emerald-900/10 border-emerald-200 dark:border-emerald-500/20",
  partial: "bg-amber-50 dark:bg-amber-900/10 border-amber-200 dark:border-amber-500/30",
  stale: "bg-amber-50 dark:bg-amber-900/10 border-amber-200 dark:border-amber-500/30",
  missing: "bg-slate-50 dark:bg-slate-800/30 border-slate-200 dark:border-slate-700",
  info: "bg-slate-50 dark:bg-slate-800/30 border-slate-200 dark:border-slate-700",
};

const STATUS_ICON: Record<StatusKind, string> = {
  ok: "✓",
  partial: "⏳",
  stale: "⏳",
  missing: "—",
  info: "•",
};

const STATUS_DOT: Record<StatusKind, string> = {
  ok: "bg-emerald-500",
  partial: "bg-amber-500",
  stale: "bg-amber-500",
  missing: "bg-slate-400",
  info: "bg-slate-400",
};

function StatusItem({
  label,
  status,
  detail,
  anchor,
}: {
  label: string;
  status: StatusKind;
  detail: string;
  anchor?: string;
}) {
  const content = (
    <div className={`flex items-start gap-2 px-3 py-2 rounded-md border ${STATUS_BG[status]} transition`}>
      <span className={`mt-1 inline-block w-1.5 h-1.5 rounded-full flex-shrink-0 ${STATUS_DOT[status]}`} />
      <div className="flex-1 min-w-0">
        <div className="text-xs font-medium text-slate-700 dark:text-slate-200 truncate">{label}</div>
        <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">{detail}</div>
      </div>
      <span className="text-xs text-slate-400 dark:text-slate-500 flex-shrink-0">{STATUS_ICON[status]}</span>
    </div>
  );
  if (anchor) {
    return (
      <a href={`#${anchor}`} className="block hover:opacity-80 transition">
        {content}
      </a>
    );
  }
  return content;
}

export default function FiscalAnchorBar({
  interpretation,
  transcript,
  form4,
  form8k,
  inst13f,
  options,
}: {
  interpretation: EarningsInterpretation | null;
  transcript: TranscriptCN | null;
  form4: EdgarFiling[];
  form8k: EdgarFiling[];
  inst13f: Inst13F | null;
  options: OptionsActivity | null;
}) {
  const { t } = useLocale();
  const [expanded, setExpanded] = useState(false);

  // 没 EQR 不显示 (新公司或其它)
  if (!interpretation || !interpretation.is_recent) {
    return null;
  }

  const fiscal = interpretation.fiscal_label;
  const earningsDate = interpretation.earnings_date;
  const releaseTime = interpretation.release_time;
  const result = interpretation.result || "inline";

  // ====== 各 section 状态 ======

  // 财报点评 EQR
  const eqrComplete = interpretation.data_complete !== false;
  const eqrNarrativeDone = interpretation.narrative_status === "done";
  const eqrStatus: StatusKind =
    eqrComplete && eqrNarrativeDone
      ? "ok"
      : "partial";
  let eqrDetail = "";
  if (!eqrComplete && !eqrNarrativeDone) {
    eqrDetail = t("现金流 + 叙事均待补齐");
  } else if (!eqrComplete) {
    eqrDetail = t("现金流数据滞后");
  } else if (interpretation.narrative_status === "pending_transcript_lag") {
    eqrDetail = t("等待当季 transcript");
  } else if (interpretation.narrative_status === "transcript_unavailable_in_fmp") {
    eqrDetail = t("数据源暂无 transcript");
  } else if (interpretation.narrative_status === "pending") {
    eqrDetail = t("叙事生成中");
  } else if (interpretation.narrative_status === "no_transcript") {
    eqrDetail = t("无电话会议");
  } else {
    eqrDetail = t("完整");
  }

  // 财报会议
  let transcriptStatus: StatusKind = "missing";
  let transcriptDetail = t("无");
  if (transcript) {
    if (transcript.is_annual_letter) {
      transcriptStatus = "ok";
      transcriptDetail = `${transcript.year} ${t("年度致股东信")}`;
    } else if (transcript.year && transcript.quarter) {
      const tLabel = `${transcript.year} Q${transcript.quarter}`;
      if (tLabel === fiscal) {
        transcriptStatus = "ok";
        transcriptDetail = `${tLabel} ${t("已对齐")}`;
      } else {
        transcriptStatus = "stale";
        transcriptDetail = `${tLabel} (${t("上一季")})`;
      }
    }
  }

  // 财报日 ±30 天 内部人交易 / 公司重大事项
  const earningsDateMs = earningsDate ? new Date(earningsDate + "T00:00:00").getTime() : null;
  const within30d = (filingDate: string | undefined): boolean => {
    if (!earningsDateMs || !filingDate) return false;
    const d = new Date(filingDate.slice(0, 10) + "T00:00:00").getTime();
    return Math.abs(d - earningsDateMs) <= 30 * 24 * 60 * 60 * 1000;
  };
  const form4Count = form4.filter((f) => within30d(f.filingDate)).length;
  const form8kCount = form8k.filter((f) => within30d(f.filingDate)).length;

  // 设计原则: 有数据 → ok (绿色 ✓); 无数据 → missing (灰色 —)
  // 不再用 'info' 中性状态 (用户视觉上分不出 info 跟 missing)

  const form4Status: StatusKind = form4Count > 0 ? "ok" : "missing";
  const form4Detail = form4Count > 0
    ? `${t("财报日±30 天")} ${form4Count} ${t("笔")}`
    : t("无显著买卖");

  const form8kStatus: StatusKind = form8kCount > 0 ? "ok" : "missing";
  const form8kDetail = form8kCount > 0
    ? `${t("财报日±30 天")} ${form8kCount} ${t("份")}`
    : t("无重大事项");

  // 13F (季度数据,显示申报日期) - 有数据就绿
  const inst13fDate = inst13f?.summary?.date || null;
  const inst13fStatus: StatusKind = inst13fDate ? "ok" : "missing";
  const inst13fDetail = inst13fDate ? `${inst13fDate} ${t("机构持仓")}` : t("无");

  // 期权 (实时快照) - 有任何核心字段就绿 (atm_iv / pcr / 异动单 任一有数据)
  const optionsAtmIv = options?.atm_iv ?? null;
  const optionsPcr = options?.put_call_ratio ?? null;
  const optionsTopCount = options?.top_contracts?.length ?? 0;
  const hasOptions = optionsAtmIv != null || optionsPcr != null || optionsTopCount > 0;
  const optionsStatus: StatusKind = hasOptions ? "ok" : "missing";
  const optionsDetail = optionsAtmIv != null
    ? `ATM IV ${(optionsAtmIv * 100).toFixed(1)}%`
    : optionsPcr != null
    ? `PCR ${optionsPcr.toFixed(2)}`
    : optionsTopCount > 0
    ? `${optionsTopCount} ${t("条异动")}`
    : t("无");

  // 总结状态: 是否有任何 section 不对齐
  const hasAnyLag =
    eqrStatus === "partial" || transcriptStatus === "stale" || transcriptStatus === "missing";

  return (
    <div
      className={`rounded-lg border ${
        hasAnyLag
          ? "border-amber-200 dark:border-amber-500/30 bg-gradient-to-r from-amber-50/60 to-orange-50/40 dark:from-amber-950/20 dark:to-orange-950/10"
          : "border-emerald-200 dark:border-emerald-500/30 bg-gradient-to-r from-emerald-50/60 to-teal-50/40 dark:from-emerald-950/20 dark:to-teal-950/10"
      } px-4 py-3 mb-6`}
    >
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2 text-sm flex-wrap">
          <span className="text-base">🎯</span>
          <span className="text-slate-500 dark:text-slate-400">{t("当季焦点")}:</span>
          <span className="font-semibold text-slate-900 dark:text-white">{fiscal}</span>
          <span className="text-slate-400 dark:text-slate-500">·</span>
          <span className="tabular-nums text-slate-700 dark:text-slate-300">{earningsDate}</span>
          {releaseTime === "bmo" && (
            <span className="text-[10px] px-1.5 py-0.5 bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-300 rounded">
              {t("盘前")}
            </span>
          )}
          {releaseTime === "amc" && (
            <span className="text-[10px] px-1.5 py-0.5 bg-indigo-100 dark:bg-indigo-500/20 text-indigo-700 dark:text-indigo-300 rounded">
              {t("盘后")}
            </span>
          )}
          <span className={`text-[10px] px-2 py-0.5 rounded font-medium ${RESULT_STYLES[result]}`}>
            {t(RESULT_LABELS[result] || RESULT_LABELS.inline)}
          </span>
        </div>
        <button
          onClick={() => setExpanded(!expanded)}
          className="text-xs text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition flex items-center gap-1"
        >
          {hasAnyLag && !expanded && (
            <span className="text-amber-600 dark:text-amber-400 font-medium">⚠️</span>
          )}
          <span>{expanded ? t("收起") : t("查看各 section 数据状态")}</span>
          <span className="text-[10px]">{expanded ? "▲" : "▼"}</span>
        </button>
      </div>

      {expanded && (
        <div className="mt-3 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
          <StatusItem
            label={t("财报点评 EQR")}
            status={eqrStatus}
            detail={eqrDetail}
            anchor="earnings-interpretation"
          />
          <StatusItem
            label={t("电话会议")}
            status={transcriptStatus}
            detail={transcriptDetail}
            anchor="transcript"
          />
          <StatusItem
            label={t("内部人交易")}
            status={form4Status}
            detail={form4Detail}
            anchor="insider-trading"
          />
          <StatusItem
            label={t("公司重大事项")}
            status={form8kStatus}
            detail={form8kDetail}
            anchor="form-8k"
          />
          <StatusItem
            label={t("机构持仓 13F")}
            status={inst13fStatus}
            detail={inst13fDetail}
            anchor="inst-13f"
          />
          <StatusItem
            label={t("期权异动")}
            status={optionsStatus}
            detail={optionsDetail}
            anchor="options-activity"
          />
        </div>
      )}
    </div>
  );
}
