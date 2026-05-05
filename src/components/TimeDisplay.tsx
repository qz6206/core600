"use client";

import { useEffect, useState } from "react";
import { useLocale } from "./LocaleProvider";

function formatTime(date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("zh-CN", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}

function getMarketStatus(date: Date): { open: boolean; label: string } {
  // 用 Intl.DateTimeFormat 取美东时间字段（避免脆弱的 toLocaleString round-trip）
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    weekday: "short",
    hour: "numeric",
    minute: "numeric",
    hour12: false,
  });
  const parts = fmt.formatToParts(date);
  const get = (type: string) => parts.find(p => p.type === type)?.value ?? "";

  const weekday = get("weekday"); // Mon, Tue, ... Sat, Sun
  const hour = parseInt(get("hour") || "0", 10);
  const min = parseInt(get("minute") || "0", 10);
  const totalMin = hour * 60 + min;

  if (weekday === "Sat" || weekday === "Sun") {
    return { open: false, label: "周末休市" };
  }
  // 美股盘前 4:00-9:30，正常 9:30-16:00，盘后 16:00-20:00 (美东时间)
  if (totalMin >= 240 && totalMin < 570) return { open: true, label: "盘前" };
  if (totalMin >= 570 && totalMin < 960) return { open: true, label: "开市中" };
  if (totalMin >= 960 && totalMin < 1200) return { open: true, label: "盘后" };
  return { open: false, label: "已收市" };
}

export default function TimeDisplay() {
  const { t } = useLocale();
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    setNow(new Date());
    const timer = setInterval(() => setNow(new Date()), 30000); // 30 秒更新一次
    return () => clearInterval(timer);
  }, []);

  if (!now) return null;

  const beijing = formatTime(now, "Asia/Shanghai");
  const newYork = formatTime(now, "America/New_York");
  const status = getMarketStatus(now);

  const statusColor = status.label === "开市中"
    ? "text-emerald-600 dark:text-emerald-400"
    : status.label === "盘前" || status.label === "盘后"
    ? "text-amber-600 dark:text-amber-400"
    : "text-slate-500 dark:text-slate-500";

  return (
    <div className="flex items-center gap-3 text-xs text-slate-600 dark:text-slate-400">
      <div className="flex items-center gap-1.5">
        <span className="w-1.5 h-1.5 rounded-full bg-current opacity-60" />
        <span>{t("北京")} {beijing}</span>
      </div>
      <div className="text-slate-300 dark:text-slate-600">·</div>
      <div className="flex items-center gap-1.5">
        <span>{t("美东")} {newYork}</span>
      </div>
      <div className="text-slate-300 dark:text-slate-600">·</div>
      <div className={`flex items-center gap-1 font-medium ${statusColor}`}>
        <span className={`w-1.5 h-1.5 rounded-full ${status.open ? "bg-current animate-pulse" : "bg-current"}`} />
        <span>{t(status.label)}</span>
      </div>
    </div>
  );
}
