"use client";

import { useLocale } from "./LocaleProvider";

export default function Footer() {
  const { t } = useLocale();

  return (
    <footer className="mt-20 pt-10 pb-12 border-t border-slate-200 dark:border-white/10">
      <div className="max-w-5xl mx-auto px-6">
        {/* 免责声明 */}
        <div className="mb-8 p-5 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-2">
            ⚠️ {t("免责声明")}
          </h3>
          <div className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed space-y-1">
            <p>
              {t("本站所有数据来自公开渠道，仅供研究参考，不构成任何投资建议。")}
            </p>
            <p>
              {t("我们尽力保证数据准确，但无法对数据的完整性、及时性、准确性做出保证。")}
            </p>
            <p>
              {t("投资有风险，决策需谨慎。读者据此操作，风险自担。")}
            </p>
            <p>
              {t("如发现数据错误，欢迎邮件反馈。")}
            </p>
          </div>
        </div>

        {/* 底部信息 */}
        <div className="flex flex-col md:flex-row justify-between items-center gap-4 text-xs text-slate-500 dark:text-slate-500">
          <div className="flex items-center gap-2">
            <span>v0.2.0</span>
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
