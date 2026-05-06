"use client";

import { useState } from "react";
import { useLocale } from "./LocaleProvider";

/**
 * AI 问答组件 — 单只股票上下文
 *
 * 用户输入问题 → POST /api/ask → DeepSeek-V3 回答
 *
 * 防御 (前端):
 * - 输入框硬限制 200 字
 * - submit 时 disable 防双击
 * - 错误清晰展示 (限流 / 服务异常 / 输入问题)
 */

export default function AskAI({ ticker, stockName }: { ticker: string; stockName: string }) {
  const { t } = useLocale();
  const [q, setQ] = useState("");
  const [a, setA] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // 推荐问题 (每只股都通用)
  const suggestions = [
    `${ticker} 最近一次财报表现怎么样?`,
    `${ticker} 内部人最近在买还是在卖?`,
    `${ticker} 同行业里位置如何?`,
    `${ticker} 营收和利润率趋势?`,
  ];

  const submit = async (overrideQ?: string) => {
    const question = (overrideQ ?? q).trim();
    if (!question) return;
    if (loading) return;
    setLoading(true);
    setError(null);
    setA(null);
    try {
      const r = await fetch("/api/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ticker, question }),
      });
      const data = await r.json();
      if (!r.ok) {
        setError(data.hint || data.error || `${t("请求失败")} (${r.status})`);
      } else {
        setA(data.answer || "");
      }
    } catch {
      setError(t("网络错误, 请检查连接"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
        {t(`基于 ${ticker} 的财报 / 同业 / 内部人 / 期权等数据回答, 不构成投资建议. 单 IP 每日限 20 次提问.`)}
      </div>

      {/* 推荐问题 */}
      <div className="flex flex-wrap gap-2">
        {suggestions.map((s, i) => (
          <button
            key={i}
            type="button"
            onClick={() => {
              setQ(s);
              submit(s);
            }}
            disabled={loading}
            className="px-3 py-1.5 text-xs bg-slate-100 dark:bg-white/5 hover:bg-indigo-100 dark:hover:bg-indigo-500/20 border border-slate-200 dark:border-white/10 rounded-full text-slate-600 dark:text-slate-300 hover:text-indigo-700 dark:hover:text-indigo-300 transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {s}
          </button>
        ))}
      </div>

      {/* 输入框 */}
      <div className="relative">
        <textarea
          value={q}
          onChange={(e) => setQ(e.target.value.slice(0, 200))}
          placeholder={t(`关于 ${ticker} 你想问什么? (≤200 字)`)}
          disabled={loading}
          rows={2}
          className="w-full px-3 py-2 pr-16 text-sm bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-lg placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-indigo-500/50 focus:bg-white dark:focus:bg-white/10 resize-none disabled:opacity-50"
          onKeyDown={(e) => {
            // Ctrl/Cmd + Enter 提交
            if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
              e.preventDefault();
              submit();
            }
          }}
        />
        <div className="absolute bottom-2 right-2 text-[10px] tabular-nums text-slate-400 dark:text-slate-500">
          {q.length}/200
        </div>
      </div>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => submit()}
          disabled={loading || !q.trim()}
          className="px-4 py-2 text-sm bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 dark:disabled:bg-white/10 disabled:text-slate-400 disabled:cursor-not-allowed text-white rounded-lg font-medium transition"
        >
          {loading ? `🤔 ${t("思考中...")}` : t("提问")}
        </button>
        <span className="text-xs text-slate-400 dark:text-slate-500">
          {t("Ctrl/Cmd + Enter 快捷提交")}
        </span>
      </div>

      {/* 错误 */}
      {error && (
        <div className="p-3 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 rounded-lg text-sm text-red-700 dark:text-red-300">
          ⚠️ {error}
        </div>
      )}

      {/* 回答 */}
      {a && (
        <div className="p-4 bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-200 dark:border-indigo-500/30 rounded-lg">
          <div className="text-xs text-indigo-600 dark:text-indigo-400 font-medium mb-2">
            🤖 AI 回答 (基于 {ticker} {stockName} 公开数据):
          </div>
          <div className="text-sm text-slate-800 dark:text-slate-200 leading-relaxed whitespace-pre-wrap">
            {a}
          </div>
        </div>
      )}

      <div className="pt-2 text-xs text-slate-400 dark:text-slate-500 leading-relaxed">
        {t("AI 回答可能包含错误或过时信息. 投资决策请以原始财报、官方公告及独立研究为准.")}
      </div>
    </div>
  );
}
