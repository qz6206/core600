"use client";

import { useLocale } from "./LocaleProvider";

/**
 * 场景标签 — 纯规则触发的色标徽章
 *
 * <ScenarioBadge color="green" label="持续缩股" labelEn="Persistent buyback" hint="..." hintEn="..." />
 *
 * - color: green (好) / amber (中性/警示) / red (坏) / slate (信息)
 * - label: 短文案 zh, labelEn 是 EN 版 (可选)
 * - hint: 鼠标悬停显示的具体数字, hintEn 是 EN 版 (可选)
 */
export default function ScenarioBadge({
  color = "slate",
  label,
  labelEn,
  hint,
  hintEn,
}: {
  color?: "green" | "amber" | "red" | "slate";
  label: string;
  labelEn?: string;
  hint?: string;
  hintEn?: string;
}) {
  const { isEnglish } = useLocale();
  const displayLabel = isEnglish && labelEn ? labelEn : label;
  const displayHint = isEnglish && hintEn ? hintEn : hint;
  const colorMap = {
    green: "bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-500/20 dark:text-emerald-300 dark:border-emerald-500/30",
    amber: "bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-500/20 dark:text-amber-300 dark:border-amber-500/30",
    red: "bg-red-100 text-red-700 border-red-200 dark:bg-red-500/20 dark:text-red-300 dark:border-red-500/30",
    slate: "bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-500/20 dark:text-slate-300 dark:border-slate-500/30",
  };
  const dot = {
    green: "bg-emerald-500",
    amber: "bg-amber-500",
    red: "bg-red-500",
    slate: "bg-slate-500",
  };

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 text-xs rounded-full border ${colorMap[color]}`}
      title={displayHint}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${dot[color]}`} />
      <span>{displayLabel}</span>
    </span>
  );
}
