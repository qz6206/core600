#!/usr/bin/env python3
"""
对比国产大模型 vs Claude 在美股研究简报生成上的表现
"""
import json
import os
import time
import urllib.request
from pathlib import Path

SILICONFLOW_KEY = os.environ.get("SILICONFLOW_API_KEY")
FMP_KEY = os.environ.get("FMP_API_KEY")
if not SILICONFLOW_KEY or not FMP_KEY:
    raise SystemExit("请设置环境变量 SILICONFLOW_API_KEY 和 FMP_API_KEY")

OUTPUT_DIR = Path(__file__).parent / "results"
OUTPUT_DIR.mkdir(exist_ok=True)

MODELS = [
    {"name": "Qwen2.5-72B", "id": "Qwen/Qwen2.5-72B-Instruct"},
    {"name": "DeepSeek-V3", "id": "deepseek-ai/DeepSeek-V3"},
]

STOCKS = ["NVDA", "PLTR", "MSTR"]


def fetch_fmp(endpoint):
    # 处理 endpoint 中已有的 ? 参数
    sep = "&" if "?" in endpoint else "?"
    url = f"https://financialmodelingprep.com/api/v3/{endpoint}{sep}apikey={FMP_KEY}"
    req = urllib.request.Request(url, headers={
        "User-Agent": "Mozilla/5.0 Core600/1.0",
        "Accept": "application/json",
    })
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.loads(r.read())


def safe_fetch(endpoint, fallback=None):
    """容错版本，单个端点失败不中断流程"""
    try:
        return fetch_fmp(endpoint)
    except Exception as e:
        print(f"     ⚠️ {endpoint} 失败: {e}")
        return fallback if fallback is not None else []


def get_stock_data(ticker):
    """收集一只股票的研究素材（容错版）"""
    print(f"  📥 拉取 {ticker} 数据...")

    profile = safe_fetch(f"profile/{ticker}", [{}])
    profile = profile[0] if profile else {}

    quote = safe_fetch(f"quote/{ticker}", [{}])
    quote = quote[0] if quote else {}

    time.sleep(0.3)  # 避免触发 rate limit
    income = safe_fetch(f"income-statement/{ticker}?period=quarter&limit=4")
    time.sleep(0.3)
    estimates = safe_fetch(f"analyst-estimates/{ticker}?period=quarter&limit=2")
    time.sleep(0.3)
    consensus = safe_fetch(f"price-target-consensus/{ticker}")

    # 8-K
    try:
        url = f"https://financialmodelingprep.com/api/v3/sec_filings/{ticker}?type=8-K&page=0&apikey={FMP_KEY}"
        with urllib.request.urlopen(url, timeout=30) as r:
            filings = json.loads(r.read())[:5]
    except Exception:
        filings = []

    return {
        "ticker": ticker,
        "profile": profile,
        "quote": quote,
        "recent_quarters": income,
        "estimates": estimates,
        "consensus": consensus[0] if consensus else {},
        "recent_8k": filings,
    }


def build_prompt(stock_data):
    """统一的研究简报 prompt"""
    p = stock_data["profile"]
    q = stock_data["quote"]
    quarters = stock_data["recent_quarters"][:4]

    # 提取关键财务
    quarters_summary = []
    for qtr in quarters:
        quarters_summary.append({
            "period": f"{qtr.get('calendarYear')} {qtr.get('period')}",
            "revenue": qtr.get("revenue"),
            "net_income": qtr.get("netIncome"),
            "eps": qtr.get("epsdiluted"),
            "operating_income": qtr.get("operatingIncome"),
            "gross_margin": (qtr.get("grossProfit", 0) / qtr.get("revenue", 1) * 100) if qtr.get("revenue") else None,
        })

    return f"""你是一位资深的美股研究分析师，请基于下列数据生成一份**中文研究简报（L1 级别）**。

# 公司信息
- 代码: {p.get('symbol')}
- 名称: {p.get('companyName')}
- 行业: {p.get('industry')} / {p.get('sector')}
- 描述: {p.get('description', '')[:500]}

# 当前市场数据
- 股价: ${q.get('price')}
- 涨跌幅: {q.get('changesPercentage', 0):.2f}%
- 市值: ${q.get('marketCap', 0) / 1e9:.1f}B
- PE: {q.get('pe')}
- 52周高/低: ${q.get('yearHigh')} / ${q.get('yearLow')}
- 平均成交量: {q.get('avgVolume', 0) / 1e6:.1f}M

# 最近 4 季财务（最新在前）
{json.dumps(quarters_summary, indent=2, ensure_ascii=False)}

# 分析师共识目标价
{json.dumps(stock_data['consensus'], indent=2, ensure_ascii=False)}

# 最近 5 份 8-K（重大事项）
{json.dumps([{"date": f.get("acceptedDate"), "title": f.get("title", "")[:200]} for f in stock_data['recent_8k']], indent=2, ensure_ascii=False)}

# 任务

请生成一份**约 800-1200 字的中文研究简报**，包含以下章节：

## 一、公司一句话介绍（30 字内）
## 二、最近一季财务亮点（数据支撑）
## 三、增长趋势分析（环比 + 同比）
## 四、关键观察点 / 风险（2-3 个）
## 五、近期重大事项点评
## 六、当前估值评估（PE 是否合理）

要求：
1. 用地道的中文，不要翻译腔
2. 所有数据必须从给定的输入中取，不要编造
3. 不要给出"建议买入/卖出"等投资建议，只展示数据 + 分析
4. 关键数据用 **加粗** 标注
5. 结构清晰，专业但易懂"""


def call_siliconflow(model_id, prompt):
    """调用硅基流动 API"""
    payload = {
        "model": model_id,
        "messages": [{"role": "user", "content": prompt}],
        "temperature": 0.5,
        "max_tokens": 4000,
    }

    req = urllib.request.Request(
        "https://api.siliconflow.cn/v1/chat/completions",
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "Authorization": f"Bearer {SILICONFLOW_KEY}",
            "Content-Type": "application/json",
        },
    )

    start = time.time()
    with urllib.request.urlopen(req, timeout=120) as r:
        result = json.loads(r.read())
    elapsed = time.time() - start

    return {
        "content": result["choices"][0]["message"]["content"],
        "usage": result.get("usage", {}),
        "elapsed": elapsed,
    }


def main():
    print("🚀 开始 LLM 对比测试")
    print("=" * 60)

    summary = []

    for ticker in STOCKS:
        print(f"\n📊 测试股票: {ticker}")
        stock_data = get_stock_data(ticker)
        prompt = build_prompt(stock_data)

        # 保存原始数据 + prompt 供参考
        with open(OUTPUT_DIR / f"{ticker}_data.json", "w", encoding="utf-8") as f:
            json.dump(stock_data, f, ensure_ascii=False, indent=2, default=str)
        with open(OUTPUT_DIR / f"{ticker}_prompt.txt", "w", encoding="utf-8") as f:
            f.write(prompt)

        for model in MODELS:
            print(f"  🤖 调用 {model['name']}...")
            try:
                result = call_siliconflow(model["id"], prompt)
                output_file = OUTPUT_DIR / f"{ticker}_{model['name']}.md"
                with open(output_file, "w", encoding="utf-8") as f:
                    f.write(f"# {ticker} - {model['name']}\n\n")
                    f.write(f"**耗时:** {result['elapsed']:.1f}s\n")
                    f.write(f"**输入 tokens:** {result['usage'].get('prompt_tokens', '?')}\n")
                    f.write(f"**输出 tokens:** {result['usage'].get('completion_tokens', '?')}\n\n")
                    f.write("---\n\n")
                    f.write(result["content"])

                # 算成本
                usage = result["usage"]
                in_tk = usage.get("prompt_tokens", 0)
                out_tk = usage.get("completion_tokens", 0)
                if "Qwen" in model["name"]:
                    cost = in_tk * 0.05 / 1e6 + out_tk * 0.10 / 1e6
                else:  # DeepSeek-V3
                    cost = in_tk * 0.27 / 1e6 + out_tk * 1.10 / 1e6

                summary.append({
                    "ticker": ticker,
                    "model": model["name"],
                    "elapsed": result["elapsed"],
                    "input_tokens": in_tk,
                    "output_tokens": out_tk,
                    "cost_usd": round(cost, 5),
                })
                print(f"     ✓ {result['elapsed']:.1f}s, in={in_tk}, out={out_tk}, ${cost:.5f}")
            except Exception as e:
                print(f"     ✗ 失败: {e}")
                summary.append({"ticker": ticker, "model": model["name"], "error": str(e)})

    # 打印汇总
    print("\n" + "=" * 60)
    print("📊 对比汇总")
    print("=" * 60)
    print(f"{'股票':<6} {'模型':<15} {'耗时':<8} {'输入':<7} {'输出':<7} {'成本($)':<10}")
    print("-" * 60)
    for s in summary:
        if "error" in s:
            print(f"{s['ticker']:<6} {s['model']:<15} 失败")
        else:
            print(f"{s['ticker']:<6} {s['model']:<15} {s['elapsed']:.1f}s   {s['input_tokens']:<7} {s['output_tokens']:<7} ${s['cost_usd']:.5f}")

    # 保存汇总
    with open(OUTPUT_DIR / "_summary.json", "w") as f:
        json.dump(summary, f, indent=2)

    print(f"\n所有报告保存在: {OUTPUT_DIR}")


if __name__ == "__main__":
    main()
