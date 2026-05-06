/**
 * AskAI 三层限流 (基于 Upstash Redis)
 *
 * - 单 IP 每分钟 ≤ 3 次  (防脚本刷)
 * - 单 IP 每天 ≤ 20 次   (防同一人滥用)
 * - 全站每天 ≤ 1000 次   (¥10/天硬封顶, 防 DDoS / 多 IP 攻击)
 *
 * 触发任一层 → 返回 429 + 中文提示
 *
 * 数据存 Upstash Redis (免费 10k commands/day, Vercel 兼容)
 * 环境变量:
 *   UPSTASH_REDIS_REST_URL
 *   UPSTASH_REDIS_REST_TOKEN
 *
 * 没配 Upstash 时, 限流静默 fallback 为允许 (开发环境 / 本地测试)
 */

import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

const url = process.env.UPSTASH_REDIS_REST_URL;
const token = process.env.UPSTASH_REDIS_REST_TOKEN;

const redis = url && token
  ? new Redis({ url, token })
  : null;

function makeLimit(name: string, limit: number, window: "1 m" | "1 d"): Ratelimit | null {
  if (!redis) return null;
  return new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(limit, window),
    prefix: `core600:ask:${name}`,
  });
}

export const perIpMinute = makeLimit("ip-1m", 3, "1 m");
export const perIpDay = makeLimit("ip-1d", 20, "1 d");
export const globalDay = makeLimit("global-1d", 1000, "1 d");

export type RateLimitCheck = {
  ok: boolean;
  reason?: "global" | "ip-minute" | "ip-day";
  remaining?: { ipMinute: number; ipDay: number };
};

export async function checkAllLimits(ip: string): Promise<RateLimitCheck> {
  // 没配 Upstash → 直接放行 (本地开发)
  if (!perIpMinute || !perIpDay || !globalDay) {
    return { ok: true, remaining: { ipMinute: 999, ipDay: 999 } };
  }

  // 全站日限放最前 (一旦达上限, 整个网站无人能用)
  const [g, m, d] = await Promise.all([
    globalDay.limit("global"),
    perIpMinute.limit(ip),
    perIpDay.limit(ip),
  ]);

  if (!g.success) return { ok: false, reason: "global" };
  if (!m.success) return { ok: false, reason: "ip-minute" };
  if (!d.success) return { ok: false, reason: "ip-day" };

  return {
    ok: true,
    remaining: { ipMinute: m.remaining, ipDay: d.remaining },
  };
}
