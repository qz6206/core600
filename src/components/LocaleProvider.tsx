"use client";

import { createContext, useContext, useEffect, useState } from "react";
import * as OpenCC from "opencc-js";
import { T_EN } from "@/lib/i18n";

export type Locale = "zh-CN" | "zh-HK" | "en";

interface LocaleContextType {
  locale: Locale;
  setLocale: (l: Locale) => void;
  t: (text: string) => string;                 // 静态 UI 文案: 查 T_EN 字典 / opencc / 原样
  tCn: (text: string | null | undefined) => string; // ⭐ 动态简体内容: HK 模式跑 opencc, 否则原样
  isEnglish: boolean;                          // 给数据层用 (切换 content_cn / content_en)
}

const LocaleContext = createContext<LocaleContextType>({
  locale: "zh-CN",
  setLocale: () => {},
  t: (s) => s,
  tCn: (s) => s || "",
  isEnglish: false,
});

// 简体 → 繁体（香港）转换器
const toHK = OpenCC.Converter({ from: "cn", to: "hk" });

export function LocaleProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>("zh-CN");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem("locale") as Locale | null;
    if (stored === "zh-CN" || stored === "zh-HK" || stored === "en") {
      setLocaleState(stored);
    }
    setMounted(true);
  }, []);

  const setLocale = (l: Locale) => {
    setLocaleState(l);
    localStorage.setItem("locale", l);
  };

  // 静态 UI 文案
  // - en: 查 T_EN 字典, 查不到 fallback 原中文
  // - zh-HK: opencc 转繁
  // - zh-CN: 原样
  const t = (text: string): string => {
    if (!mounted) return text;
    if (locale === "en") return T_EN[text] || text;
    if (locale === "zh-HK") return toHK(text);
    return text;
  };

  // ⭐ 动态简体内容 (公司简介/EQR narrative/transcript summary 等)
  // - en 模式: 用不到 (调用方应该已经走 _en 分支)
  // - zh-HK: opencc 简→繁
  // - zh-CN: 原样
  // 注意: SSR 阶段 mounted=false 返回原文 (避免 hydration mismatch)
  const tCn = (text: string | null | undefined): string => {
    if (!text) return "";
    if (!mounted) return text;
    if (locale === "zh-HK") return toHK(text);
    return text;
  };

  const isEnglish = mounted && locale === "en";

  return (
    <LocaleContext.Provider value={{ locale, setLocale, t, tCn, isEnglish }}>
      {children}
    </LocaleContext.Provider>
  );
}

export function useLocale() {
  return useContext(LocaleContext);
}
