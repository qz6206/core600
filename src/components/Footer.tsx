"use client";

import { useLocale } from "./LocaleProvider";

export default function Footer() {
  const { t } = useLocale();

  return (
    <footer className="mt-20 pt-10 pb-12 border-t border-slate-200 dark:border-white/10">
      <div className="max-w-5xl mx-auto px-6">
        {/* 免责声明 */}
        <div className="mb-8 text-xs text-slate-500 dark:text-slate-500 leading-relaxed text-center">
          ⚠️ {t("数据来自公开渠道,仅供研究参考,不构成投资建议。投资有风险,决策需谨慎。")}
        </div>

        {/* 底部信息 */}
        <div className="flex flex-col md:flex-row justify-between items-center gap-4 text-xs text-slate-500 dark:text-slate-500">
          <div className="flex items-center gap-2">
            <span>v0.3.0</span>
            <span>·</span>
            <span>© 2026 Core 600</span>
          </div>

          <div className="flex items-center gap-3">
            <span>📧</span>
            <a
              href="mailto:qz6206@gmail.com"
              className="hover:text-indigo-600 dark:hover:text-indigo-400 transition"
            >
              qz6206@gmail.com
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
