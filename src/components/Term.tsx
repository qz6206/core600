"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { GLOSSARY } from "@/lib/glossary";
import { useLocale } from "./LocaleProvider";

/**
 * <Term term="SBC">SBC</Term>
 * 把术语包起来，鼠标悬停（桌面）或点击（手机）显示中文解释。
 *
 * - 解释从 src/lib/glossary.ts 查询，找不到时降级为普通文本
 * - 视觉：术语下方有点状下划线 + 右上角小 "?" 图标
 * - 弹窗用 Portal 渲染到 body 层，避开父容器 overflow-x-auto 裁剪
 * - 自动避免溢出视口右/左边界
 */

const TOOLTIP_WIDTH = 320; // sm:w-80 ≈ 320px
const VIEWPORT_PADDING = 12;
const CLOSE_DELAY_MS = 150;

export default function Term({
  term,
  children,
}: {
  term: string;
  children?: React.ReactNode;
}) {
  const { t, isEnglish } = useLocale();
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [coords, setCoords] = useState<{ top: number; left: number; width: number }>({
    top: 0,
    left: 0,
    width: TOOLTIP_WIDTH,
  });
  const ref = useRef<HTMLSpanElement>(null);
  const tooltipRef = useRef<HTMLSpanElement>(null);
  const closeTimerRef = useRef<number | null>(null);
  const entry = GLOSSARY[term];
  // EN mode 用 entry.en, 否则 entry.cn (再走 t() 走繁体转换)
  const def = entry ? (isEnglish ? entry.en : entry.cn) : null;

  useEffect(() => {
    setMounted(true);
  }, []);

  const computeCoords = useCallback(() => {
    if (!ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const width = Math.min(TOOLTIP_WIDTH, window.innerWidth - 2 * VIEWPORT_PADDING);
    let left = rect.left;
    // 防止右边界溢出
    if (left + width > window.innerWidth - VIEWPORT_PADDING) {
      left = window.innerWidth - width - VIEWPORT_PADDING;
    }
    // 防止左边界溢出
    if (left < VIEWPORT_PADDING) {
      left = VIEWPORT_PADDING;
    }
    const top = rect.bottom + 6; // 6px gap
    setCoords({
      top: top + window.scrollY,
      left: left + window.scrollX,
      width,
    });
  }, []);

  const cancelClose = useCallback(() => {
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  }, []);

  const openTooltip = useCallback(() => {
    cancelClose();
    computeCoords();
    setOpen(true);
  }, [cancelClose, computeCoords]);

  const scheduleClose = useCallback(() => {
    cancelClose();
    closeTimerRef.current = window.setTimeout(() => {
      setOpen(false);
    }, CLOSE_DELAY_MS);
  }, [cancelClose]);

  // 点击外部关闭 (mobile)
  useEffect(() => {
    if (!open) return;
    const handler = (e: Event) => {
      const target = e.target as Node;
      if (ref.current && ref.current.contains(target)) return;
      if (tooltipRef.current && tooltipRef.current.contains(target)) return;
      setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    document.addEventListener("touchstart", handler);
    return () => {
      document.removeEventListener("mousedown", handler);
      document.removeEventListener("touchstart", handler);
    };
  }, [open]);

  // 滚动 / 改窗口大小时重新计算位置
  useEffect(() => {
    if (!open) return;
    const handler = () => computeCoords();
    window.addEventListener("scroll", handler, true);
    window.addEventListener("resize", handler);
    return () => {
      window.removeEventListener("scroll", handler, true);
      window.removeEventListener("resize", handler);
    };
  }, [open, computeCoords]);

  // 没有解释 → fallback 为纯文本
  if (!def) {
    return <span>{children ?? term}</span>;
  }

  const tooltipNode =
    mounted && open
      ? createPortal(
          <span
            ref={tooltipRef}
            role="tooltip"
            style={{
              position: "absolute",
              top: coords.top,
              left: coords.left,
              width: coords.width,
              zIndex: 100,
            }}
            className="block p-3 text-xs leading-relaxed bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 rounded-lg shadow-xl whitespace-pre-line normal-case pointer-events-auto"
            onMouseEnter={cancelClose}
            onMouseLeave={scheduleClose}
            onClick={(e) => e.stopPropagation()}
          >
            <span className="block font-semibold mb-1">{t(term)}</span>
            <span className="block">{t(def)}</span>
          </span>,
          document.body
        )
      : null;

  return (
    <span
      ref={ref}
      className="relative inline-block align-baseline"
      onMouseEnter={openTooltip}
      onMouseLeave={scheduleClose}
    >
      <span className="underline decoration-dotted decoration-slate-400 dark:decoration-slate-500 underline-offset-2 cursor-help">
        {children ?? term}
      </span>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          if (open) {
            setOpen(false);
          } else {
            openTooltip();
          }
        }}
        className="ml-0.5 inline-flex items-center justify-center w-3.5 h-3.5 text-[10px] rounded-full bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-400 hover:bg-indigo-200 dark:hover:bg-indigo-700 hover:text-indigo-700 dark:hover:text-indigo-200 transition align-super leading-none"
        aria-label={t("术语解释")}
        aria-expanded={open}
      >
        ?
      </button>
      {tooltipNode}
    </span>
  );
}
