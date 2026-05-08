"use client";

import { useLocale } from "./LocaleProvider";
import { useEffect, useState } from "react";

export default function LocaleToggle() {
  const { locale, setLocale } = useLocale();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  if (!mounted) return <div className="w-16 h-9" />;

  const btnClass = (active: boolean) =>
    `px-2.5 py-1.5 text-xs font-medium transition ${
      active
        ? "bg-indigo-600 text-white"
        : "text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
    }`;

  return (
    <div className="flex items-center bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden">
      <button onClick={() => setLocale("zh-CN")} className={btnClass(locale === "zh-CN")}>
        简
      </button>
      <button onClick={() => setLocale("zh-HK")} className={btnClass(locale === "zh-HK")}>
        繁
      </button>
      <button onClick={() => setLocale("en")} className={btnClass(locale === "en")}>
        EN
      </button>
    </div>
  );
}
