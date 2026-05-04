import Link from "next/link";

export default function Home() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 text-white">
      <div className="max-w-5xl mx-auto px-6 py-20">
        {/* 标题 */}
        <div className="text-center mb-12">
          <div className="inline-block px-4 py-1 mb-6 bg-indigo-500/20 text-indigo-300 rounded-full text-sm font-medium">
            🚀 即将上线
          </div>
          <h1 className="text-6xl md:text-7xl font-bold mb-4 bg-gradient-to-r from-white via-indigo-200 to-purple-200 bg-clip-text text-transparent">
            Core 600
          </h1>
          <p className="text-xl md:text-2xl text-slate-300 mb-2">
            美股核心 600 强 · 一站式数据中心
          </p>
          <p className="text-base text-slate-400 mb-8">
            标普 500 + 纳斯达克 100 · 中文用户专属
          </p>

          {/* CTA 按钮 */}
          <Link
            href="/stocks"
            className="inline-block px-8 py-3 bg-indigo-500 hover:bg-indigo-600 rounded-lg font-medium transition shadow-lg shadow-indigo-500/30"
          >
            查看 516 只股票列表 →
          </Link>
        </div>

        {/* 功能预览卡片 */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-16">
          {[
            { icon: "🎙️", title: "财报会议", desc: "AI 中文摘要 + 原音对照" },
            { icon: "👤", title: "内部人交易", desc: "高管买卖动向追踪" },
            { icon: "🏛️", title: "机构持仓", desc: "13F 明星基金动态" },
            { icon: "📰", title: "8-K 重大事项", desc: "中文化解读时间线" },
            { icon: "💰", title: "回购执行", desc: "授权 vs 实际执行追踪" },
            { icon: "📉", title: "股本稀释", desc: "SBC + 流通股变化" },
            { icon: "🎯", title: "期权异动", desc: "聪明钱大单监控" },
            { icon: "📅", title: "财报日历", desc: "解禁日历 · 分红日历" },
            { icon: "📊", title: "智能评分", desc: "多维度综合资金评分" },
          ].map((f) => (
            <div
              key={f.title}
              className="p-5 bg-white/5 backdrop-blur border border-white/10 rounded-xl hover:bg-white/10 transition"
            >
              <div className="text-3xl mb-2">{f.icon}</div>
              <div className="font-semibold text-white mb-1">{f.title}</div>
              <div className="text-sm text-slate-400">{f.desc}</div>
            </div>
          ))}
        </div>

        {/* 底部 */}
        <div className="text-center text-slate-500 text-sm">
          <p>v0.0.1 · Built with Claude Code</p>
        </div>
      </div>
    </main>
  );
}
