import { NextRequest, NextResponse } from "next/server";
import { checkAllLimits } from "@/lib/rate-limit";
import { buildContext } from "@/lib/qa-context";

/**
 * AskAI 服务端 API
 *
 * POST /api/ask
 * body: { ticker: string, question: string }
 *
 * 防御层 (从外到内):
 * 1. CORS / method 校验
 * 2. body 大小 + 格式
 * 3. ticker 必须在 stocks.json 里 (516 只)
 * 4. question 长度 ≤ 200 字
 * 5. rate limit (3/min IP, 20/day IP, 1000/day global)
 * 6. system prompt 强约束
 * 7. max_tokens 500 (单次成本封顶 ¥0.005)
 *
 * key 在服务端环境变量, 前端拿不到
 */

const SF_KEY = process.env.SILICONFLOW_API_KEY;
const LLM_URL = "https://api.siliconflow.cn/v1/chat/completions";
const LLM_MODEL = "deepseek-ai/DeepSeek-V3";

const QUESTION_MAX_LEN = 200;
const RESPONSE_MAX_TOKENS = 500;

export const runtime = "nodejs"; // 用 Node, 因为要 import JSON 数据
export const maxDuration = 30;   // 30s timeout

function getIP(req: NextRequest): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "unknown"
  );
}

export async function POST(req: NextRequest) {
  if (!SF_KEY) {
    return NextResponse.json(
      { error: "service_not_configured", hint: "AI 问答服务未配置, 请联系管理员" },
      { status: 503 }
    );
  }

  // 1. parse body
  let body: { ticker?: string; question?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const ticker = (body.ticker || "").toString().trim().toUpperCase();
  const question = (body.question || "").toString().trim();

  // 2. validation
  if (!ticker) {
    return NextResponse.json({ error: "ticker_required", hint: "请指定股票代码" }, { status: 400 });
  }
  if (!question) {
    return NextResponse.json({ error: "question_required", hint: "请输入你的问题" }, { status: 400 });
  }
  if (question.length > QUESTION_MAX_LEN) {
    return NextResponse.json(
      { error: "question_too_long", hint: `问题不能超过 ${QUESTION_MAX_LEN} 字`, limit: QUESTION_MAX_LEN },
      { status: 400 }
    );
  }

  // 3. rate limit (前置, 防恶意构造大 ticker / question)
  const ip = getIP(req);
  const rl = await checkAllLimits(ip);
  if (!rl.ok) {
    const hint = {
      "global": "今日访问量已达全站上限, 请明天再试",
      "ip-minute": "提问太快了, 请等 1 分钟再试",
      "ip-day": "您今日提问次数已达 20 次上限, 请明天再试",
    }[rl.reason!];
    return NextResponse.json({ error: rl.reason, hint }, { status: 429 });
  }

  // 4. 构建 ticker 的精简 context
  const built = buildContext(ticker);
  if (!built) {
    return NextResponse.json(
      { error: "ticker_not_found", hint: `未找到 ${ticker}, 仅支持 S&P 500 + 纳指 100 成分股` },
      { status: 404 }
    );
  }

  // 5. 强约束 system prompt
  const systemPrompt = `你是 Core 600 的财务问答助手, 服务于美股投资者。

【硬性限制】
1. 你只能回答关于 ${ticker} (${built.stockName}) 这只股票的财务 / 基本面 / 财报相关问题
2. 必须基于下方给出的数据回答, 数据外的具体数字一律说 "我没有这方面具体数据"
3. **严禁** 输出代码 / 诗歌 / 故事 / 翻译 / 数学题答案 / 任何与 ${ticker} 财务无关的内容
4. **严禁** 给出投资建议 (买入 / 卖出 / 目标价等) — 你只能描述事实, 不评判好坏
5. 用户问 ${ticker} 之外的股票或无关问题, 一律回 "我只能回答 ${ticker} 的财务相关问题"
6. 回答用简洁中文, 关键数字精确, 必要时分点列出, 不超过 300 字

【关于 ${ticker} 的数据】
${built.ctx}`;

  // 6. 调 LLM
  const llmBody = {
    model: LLM_MODEL,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: question },
    ],
    max_tokens: RESPONSE_MAX_TOKENS,
    temperature: 0.3,
  };

  try {
    const llmResp = await fetch(LLM_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${SF_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(llmBody),
      signal: AbortSignal.timeout(25000),
    });

    if (!llmResp.ok) {
      const errText = await llmResp.text().catch(() => "");
      console.error("[/api/ask] LLM error:", llmResp.status, errText.slice(0, 200));

      // 401/402/403 表示 key 失效 / 余额耗尽
      if (llmResp.status === 401 || llmResp.status === 402 || llmResp.status === 403) {
        return NextResponse.json(
          { error: "llm_auth_error", hint: "AI 服务暂时不可用 (账号问题), 请稍后" },
          { status: 503 }
        );
      }
      return NextResponse.json(
        { error: "llm_error", hint: "AI 服务暂时不可用, 请稍后再试" },
        { status: 503 }
      );
    }

    const data = await llmResp.json();
    const answer: string = data?.choices?.[0]?.message?.content?.trim() || "";

    if (!answer) {
      return NextResponse.json({ error: "empty_answer", hint: "AI 没给出有效回答" }, { status: 503 });
    }

    return NextResponse.json({
      answer,
      ticker,
      remaining: rl.remaining,
    });
  } catch (e: unknown) {
    console.error("[/api/ask] exception:", e);
    return NextResponse.json({ error: "llm_exception", hint: "AI 调用异常, 请稍后再试" }, { status: 503 });
  }
}
