"use client";

import { createContext, useContext, useEffect, useState } from "react";
import * as OpenCC from "opencc-js";

export type Locale = "zh-CN" | "zh-HK";

interface LocaleContextType {
  locale: Locale;
  setLocale: (l: Locale) => void;
  t: (text: string) => string; // 简体到繁体的转换函数
}

const LocaleContext = createContext<LocaleContextType>({
  locale: "zh-CN",
  setLocale: () => {},
  t: (s) => s,
});

// 简体 → 繁体（香港）转换器
const toHK = OpenCC.Converter({ from: "cn", to: "hk" });

export function LocaleProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>("zh-CN");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem("locale") as Locale | null;
    if (stored === "zh-CN" || stored === "zh-HK") {
      setLocaleState(stored);
    }
    setMounted(true);
  }, []);

  const setLocale = (l: Locale) => {
    setLocaleState(l);
    localStorage.setItem("locale", l);
  };

  // 简体内容自动转换为繁体（用户选香港时）
  const t = (text: string): string => {
    if (!mounted) return text;
    if (locale === "zh-HK") return toHK(text);
    return text;
  };

  return (
    <LocaleContext.Provider value={{ locale, setLocale, t }}>
      {children}
    </LocaleContext.Provider>
  );
}

export function useLocale() {
  return useContext(LocaleContext);
}
