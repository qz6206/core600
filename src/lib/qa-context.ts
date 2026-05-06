/**
 * 给 AskAI 构建单只股票的精简 context
 *
 * 输入: ticker
 * 输出: 1.5-2K tokens 的中文摘要 (含财报数据 / 倾向标签 / 同业对比)
 *
 * 不包含:
 * - 完整 transcript (太长, ~13K tokens)
 * - 完整 8-K 中文摘要 (用 latest 一条即可)
 * - K 线数据 (LLM 处理时间序列效果差, 不如让用户自己看图)
 */

import stocksData from "../../data/stocks.json";
import interpretationsData from "../../data/earnings_interpretations.json";
import peerComparisonData from "../../data/peer_comparison.json";
import edgarData from "../../data/edgar_filings.json";

import type { StockData } from "@/lib/types";
import type { EarningsInterpretation } from "@/lib/fmp";
import type { EdgarFiling } from "@/lib/edgar";

type InterpretationsByTicker = { by_ticker: Record<string, EarningsInterpretation> };
type PeerComparisonByTicker = {
  by_ticker: Record<
    string,
    {
      industry: string | null;
      sector: string | null;
      peers: Array<{
        ticker: string;
        name_cn: string;
        is_self: boolean;
        rev_ttm: number | null;
        rev_yoy_pct: number | null;
        gross_margin: number | null;
        net_margin: number | null;
        beat_count_4q: number;
        atm_iv: number | null;
      }>;
    }
  >;
};
type EdgarByTicker = {
  by_ticker: Record<string, { form4: EdgarFiling[]; form8k: EdgarFiling[]; form6k?: EdgarFiling[] }>;
};

function fmtUSD(n: number | null | undefined): string {
  if (n == null) return "—";
  if (Math.abs(n) >= 1e9) return `$${(n / 1e9).toFixed(1)}B`;
  if (Math.abs(n) >= 1e6) return `$${(n / 1e6).toFixed(0)}M`;
  return `$${n}`;
}

export function buildContext(ticker: string): { ctx: string; stockName: string } | null {
  const stocks = (stocksData as StockData).stocks;
  const stock = stocks.find(s => s.ticker === ticker);
  if (!stock) return null;

  const interp = (interpretationsData as InterpretationsByTicker).by_ticker[ticker];
  const peers = (peerComparisonData as PeerComparisonByTicker).by_ticker[ticker];
  const edgar = (edgarData as EdgarByTicker).by_ticker[ticker];

  const lines: string[] = [];

  // === 公司基本信息 ===
  const cnName = stock.name_cn || stock.name;
  lines.push(`# ${ticker} ${cnName}`);
  lines.push(`板块: ${stock.sector || "—"} · 行业: ${stock.industry || "—"}`);
  if (stock.in_sp500) lines.push(`属于 S&P 500 成分股`);
  if (stock.in_nasdaq100) lines.push(`属于 NASDAQ-100 成分股`);
  lines.push("");

  // === 最新财报 ===
  if (interp) {
    const dc = interp.data_card;
    lines.push(`## 最新财报: ${interp.fiscal_label} (${interp.earnings_date})`);
    const resultCN = { beat: "超预期", miss: "低于预期", mixed: "好坏参半", inline: "符合预期" }[interp.result];
    lines.push(`整体: ${resultCN}`);
    if (dc.eps_actual != null) {
      const surp = dc.eps_surprise_pct != null ? `(${dc.eps_surprise_pct > 0 ? "+" : ""}${dc.eps_surprise_pct.toFixed(1)}%)` : "";
      lines.push(`EPS: $${dc.eps_actual} vs 预期 $${dc.eps_estimate ?? "—"} ${surp}`);
    }
    if (dc.rev_actual != null) {
      const surp = dc.rev_surprise_pct != null ? `(${dc.rev_surprise_pct > 0 ? "+" : ""}${dc.rev_surprise_pct.toFixed(1)}%)` : "";
      const yoy = dc.rev_yoy_pct != null ? ` · 同比 ${dc.rev_yoy_pct > 0 ? "+" : ""}${dc.rev_yoy_pct.toFixed(1)}%` : "";
      lines.push(`营收: ${fmtUSD(dc.rev_actual)} vs 预期 ${fmtUSD(dc.rev_estimate)} ${surp}${yoy}`);
    }
    if (dc.gross_margin != null) {
      const yoyBps = dc.gross_margin_yoy_bps != null ? ` (同比 ${dc.gross_margin_yoy_bps > 0 ? "+" : ""}${dc.gross_margin_yoy_bps.toFixed(0)} bps)` : "";
      lines.push(`毛利率: ${(dc.gross_margin * 100).toFixed(1)}%${yoyBps}`);
    }
    if (dc.net_margin != null) {
      lines.push(`净利率: ${(dc.net_margin * 100).toFixed(1)}%`);
    }
    lines.push("");

    // === 倾向标签 ===
    if (interp.badges && interp.badges.length > 0) {
      lines.push(`## 关键信号`);
      for (const b of interp.badges) {
        lines.push(`- ${b.label}: ${b.hint}`);
      }
      lines.push("");
    }

    // === 基本面信号 ===
    if (interp.fundamentals && interp.fundamentals.length > 0) {
      lines.push(`## 基本面信号`);
      for (const f of interp.fundamentals) {
        lines.push(`- ${f.text}`);
      }
      lines.push("");
    }

    // === 市场反应 ===
    const mr = interp.market_reaction;
    if (mr) {
      lines.push(`## 市场反应`);
      if (mr.atm_iv != null) lines.push(`ATM IV: ${(mr.atm_iv * 100).toFixed(0)}% (${mr.iv_level || "—"})`);
      if (mr.put_call_ratio != null) lines.push(`Put/Call: ${mr.put_call_ratio.toFixed(2)} (${mr.pcr_label || "—"})`);
      if (mr.ratings_30d) {
        const r = mr.ratings_30d;
        if (r.upgrade > 0 || r.downgrade > 0 || r.initiate > 0) {
          lines.push(`财报后 30 天评级: ↑${r.upgrade} / ↓${r.downgrade} / 首次覆盖 ${r.initiate}`);
        }
      }
      lines.push("");
    }
  }

  // === 同业对比 ===
  if (peers && peers.peers.length > 1) {
    lines.push(`## 同业对比 (${peers.industry || peers.sector})`);
    for (const p of peers.peers.slice(0, 6)) {
      const rev = p.rev_ttm ? fmtUSD(p.rev_ttm) : "—";
      const yoy = p.rev_yoy_pct != null ? `${p.rev_yoy_pct > 0 ? "+" : ""}${p.rev_yoy_pct.toFixed(0)}%` : "—";
      const gm = p.gross_margin != null ? `${(p.gross_margin * 100).toFixed(0)}%` : "—";
      const self = p.is_self ? " [当前]" : "";
      lines.push(`- ${p.ticker} ${p.name_cn}: 营收 ${rev}, YoY ${yoy}, 毛利 ${gm}, Beat ${p.beat_count_4q}/4${self}`);
    }
    lines.push("");
  }

  // === 最近 8-K 重大事项 (前 3 条) ===
  if (edgar) {
    const form8k = edgar.form8k || [];
    const recent = form8k
      .filter(f => f.summary_cn && !f.items?.includes("2.02"))
      .slice(0, 3);
    if (recent.length > 0) {
      lines.push(`## 最近重大事项 (8-K)`);
      for (const f of recent) {
        lines.push(`- ${f.filingDate}: ${f.summary_cn}`);
      }
      lines.push("");
    }
  }

  return {
    ctx: lines.join("\n"),
    stockName: cnName,
  };
}
