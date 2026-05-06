"use client";

import { useEffect, useRef, useState } from "react";
import { GLOSSARY } from "@/lib/glossary";
import { useLocale } from "./LocaleProvider";

/**
 * <Term term="SBC">SBC</Term>
 * 把术语包起来，鼠标悬停（桌面）或点击（手机）显示中文解释。
 *
 * - 解释从 src/lib/glossary.ts 查询，找不到时降级为普通文本
 * - 视觉上：术语下方有点状下划线 + 右上角小 "?" 图标
 */
export default function Term({
  term,
  children,
}: {
  term: string;
  children?: React.ReactNode;
}) {
  const { t } = useLocale();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);
  const def = GLOSSARY[term];

  // 点击外部关闭（mobile）
  useEffect(() => {
    if (!open) return;
    const handler = (e: Event) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    document.addEventListener("touchstart", handler);
    return () => {
      document.removeEventListener("mousedown", handler);
      document.removeEventListener("touchstart", handler);
    };
  }, [open]);

  // 没有解释 → fallback 为纯文本
  if (!def) {
    return <span>{children ?? term}</span>;
  }

  return (
    <span ref={ref} className="relative inline-block group align-baseline">
      <span className="underline decoration-dotted decoration-slate-400 dark:decoration-slate-500 underline-offset-2 cursor-help">
        {children ?? term}
      </span>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setOpen(o => !o);
        }}
        className="ml-0.5 inline-flex items-center justify-center w-3.5 h-3.5 text-[10px] rounded-full bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-400 hover:bg-indigo-200 dark:hover:bg-indigo-700 hover:text-indigo-700 dark:hover:text-indigo-200 transition align-super leading-none"
        aria-label={t("术语解释")}
        aria-expanded={open}
      >
        ?
      </button>
      {/* Tooltip — desktop hover OR mobile click */}
      <span
        className={`absolute z-50 left-0 top-full mt-1.5 w-72 sm:w-80 p-3 text-xs leading-relaxed bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 rounded-lg shadow-xl whitespace-pre-line normal-case
          ${open ? "block" : "hidden md:group-hover:block"}
        `}
        // 阻止 tooltip 内容点击关闭
        onClick={(e) => e.stopPropagation()}
      >
        <div className="font-semibold mb-1">{term}</div>
        <div>{t(def)}</div>
      </span>
    </span>
  );
}
