"use client";

import Link from "next/link";
import { useLocale } from "./LocaleProvider";
import Term from "./Term";

/**
 * 同业对比表 — 同 industry 的 5-8 只股票，对比关键指标
 *
 * 数据源: data/peer_comparison.json (预生成)
 */

export type PeerMetrics = {
  ticker: string;
  name_cn: string;
  sector: string | null;
  industry: string | null;
  is_self: boolean;
  rev_ttm: number | null;
  rev_yoy_pct: number | null;
  gross_margin: number | null;
  net_margin: number | null;
  beat_count_4q: number;
  atm_iv: number | null;
  ratings_30d_upgrade: number;
  ratings_30d_downgrade: number;
  buyback_4q: number;
  sbc_to_ni_pct: number | null;
};

export type PeerComparisonData = {
  ticker: string;
  industry: string | null;
  sector: string | null;
  peer_count: number;
  peers: PeerMetrics[];
};

function fmtUSD(n: number | null | undefined): string {
  if (n == null) return "—";
  if (Math.abs(n) >= 1e9) return `$${(n / 1e9).toFixed(1)}B`;
  if (Math.abs(n) >= 1e6) return `$${(n / 1e6).toFixed(0)}M`;
  return `$${n}`;
}

function fmtPct(p: number | null | undefined, decimals = 1): string {
  if (p == null) return "—";
  return `${p > 0 ? "+" : ""}${p.toFixed(decimals)}%`;
}

function colorClass(v: number | null | undefined): string {
  if (v == null) return "";
  if (v > 0) return "text-emerald-600 dark:text-emerald-400";
  if (v < 0) return "text-red-600 dark:text-red-400";
  return "";
}

export default function PeerComparisonBlock({ data }: { data: PeerComparisonData }) {
  const { t } = useLocale();
  const peers = data.peers;

  // 算各指标的 max/min 用于排名高亮
  const stats = {
    rev_ttm: peers.map(p => p.rev_ttm).filter((x): x is number => x != null),
    rev_yoy_pct: peers.map(p => p.rev_yoy_pct).filter((x): x is number => x != null),
    gross_margin: peers.map(p => p.gross_margin).filter((x): x is number => x != null),
    net_margin: peers.map(p => p.net_margin).filter((x): x is number => x != null),
    atm_iv: peers.map(p => p.atm_iv).filter((x): x is number => x != null),
  };
  const max = (arr: number[]) => (arr.length ? Math.max(...arr) : null);
  const maxRev = max(stats.rev_ttm);
  const maxYoy = max(stats.rev_yoy_pct);
  const maxGm = max(stats.gross_margin);
  const maxNm = max(stats.net_margin);

  const isMaxClass = "font-semibold text-emerald-600 dark:text-emerald-400";

  return (
    <div className="space-y-3">
      <div className="text-xs text-slate-500 dark:text-slate-400">
        {t("行业")}: {data.industry || "—"} · {t("板块")}: {data.sector || "—"} · {data.peer_count}{" "}
        {t("家公司")}
      </div>

      <div className="overflow-x-auto -mx-2 px-2">
        <table className="w-full text-sm min-w-[760px]">
          <thead>
            <tr className="border-b border-slate-200 dark:border-white/10 text-slate-500 dark:text-slate-400">
              <th className="text-left py-2 pr-3 font-normal">{t("公司")}</th>
              <th className="text-right py-2 px-3 font-normal whitespace-nowrap">
                {t("营收 TTM")}
              </th>
              <th className="text-right py-2 px-3 font-normal whitespace-nowrap">
                {t("营收同比")}
              </th>
              <th className="text-right py-2 px-3 font-normal">{t("毛利率")}</th>
              <th className="text-right py-2 px-3 font-normal">{t("净利率")}</th>
              <th className="text-right py-2 px-3 font-normal whitespace-nowrap">
                <Term term="Beat">Beat</Term>{" "}{t("(近 4 次)")}
              </th>
              <th className="text-right py-2 px-3 font-normal">
                <Term term="ATM IV">ATM IV</Term>
              </th>
              <th className="text-right py-2 pl-3 font-normal whitespace-nowrap">
                {t("评级 30d")}
              </th>
            </tr>
          </thead>
          <tbody>
            {peers.map(p => {
              const isSelf = p.is_self;
              const ratingNet =
                (p.ratings_30d_upgrade || 0) - (p.ratings_30d_downgrade || 0);
              return (
                <tr
                  key={p.ticker}
                  className={`border-b border-slate-100 dark:border-white/5 transition ${
                    isSelf
                      ? "bg-indigo-50 dark:bg-indigo-500/10"
                      : "hover:bg-slate-50 dark:hover:bg-white/5"
                  }`}
                >
                  <td className="py-2 pr-3">
                    <Link
                      href={`/stocks/${p.ticker}`}
                      className="block hover:underline"
                    >
                      <div className="flex items-center gap-2">
                        <span
                          className={`font-semibold ${
                            isSelf
                              ? "text-indigo-700 dark:text-indigo-300"
                              : "text-slate-900 dark:text-white"
                          }`}
                        >
                          {p.ticker}
                        </span>
                        {isSelf && (
                          <span className="text-xs px-1 py-0.5 bg-indigo-100 dark:bg-indigo-500/30 text-indigo-700 dark:text-indigo-300 rounded">
                            {t("当前")}
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-slate-500 dark:text-slate-400 truncate max-w-[160px]">
                        {p.name_cn}
                      </div>
                    </Link>
                  </td>
                  <td
                    className={`py-2 px-3 text-right tabular-nums whitespace-nowrap ${
                      p.rev_ttm === maxRev ? isMaxClass : ""
                    }`}
                  >
                    {fmtUSD(p.rev_ttm)}
                  </td>
                  <td
                    className={`py-2 px-3 text-right tabular-nums whitespace-nowrap ${
                      p.rev_yoy_pct === maxYoy && maxYoy != null && maxYoy > 0
                        ? isMaxClass
                        : colorClass(p.rev_yoy_pct)
                    }`}
                  >
                    {fmtPct(p.rev_yoy_pct)}
                  </td>
                  <td
                    className={`py-2 px-3 text-right tabular-nums ${
                      p.gross_margin === maxGm ? isMaxClass : ""
                    }`}
                  >
                    {p.gross_margin != null ? `${(p.gross_margin * 100).toFixed(1)}%` : "—"}
                  </td>
                  <td
                    className={`py-2 px-3 text-right tabular-nums ${
                      p.net_margin === maxNm ? isMaxClass : ""
                    }`}
                  >
                    {p.net_margin != null ? `${(p.net_margin * 100).toFixed(1)}%` : "—"}
                  </td>
                  <td className="py-2 px-3 text-right tabular-nums">
                    <span
                      className={
                        p.beat_count_4q >= 3
                          ? "text-emerald-600 dark:text-emerald-400 font-medium"
                          : p.beat_count_4q <= 1
                          ? "text-red-600 dark:text-red-400"
                          : "text-slate-600 dark:text-slate-400"
                      }
                    >
                      {p.beat_count_4q}/4
                    </span>
                  </td>
                  <td className="py-2 px-3 text-right tabular-nums">
                    {p.atm_iv != null ? `${(p.atm_iv * 100).toFixed(0)}%` : "—"}
                  </td>
                  <td className="py-2 pl-3 text-right tabular-nums whitespace-nowrap">
                    {p.ratings_30d_upgrade > 0 || p.ratings_30d_downgrade > 0 ? (
                      <span className={colorClass(ratingNet)}>
                        {p.ratings_30d_upgrade > 0 && (
                          <span className="text-emerald-600 dark:text-emerald-400">
                            ↑{p.ratings_30d_upgrade}
                          </span>
                        )}
                        {p.ratings_30d_upgrade > 0 && p.ratings_30d_downgrade > 0 && " "}
                        {p.ratings_30d_downgrade > 0 && (
                          <span className="text-red-600 dark:text-red-400">
                            ↓{p.ratings_30d_downgrade}
                          </span>
                        )}
                      </span>
                    ) : (
                      <span className="text-slate-300 dark:text-slate-600">—</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="text-xs text-slate-500 dark:text-slate-400">
        {t("绿色加粗 = 该指标在同业中最高")} · {t("点击 ticker 跳转该公司详情页")}
      </div>
    </div>
  );
}
