// SEC EDGAR API 封装（仅服务端使用）
//
// 重要：SEC 限制 10 req/s。本模块用 token-bucket 全局节流到 ~7 req/s
// + 指数退避重试，确保 next build 期间 522 页并行也不会被限流。

const EDGAR_BASE = "https://data.sec.gov";
// 注意：next build 时 Next.js 默认起 8 worker 并行，每个 worker 有独立模块实例
// 所以单 worker 间隔需 × worker 数才不会超 SEC 10 req/s 限制
// 当前：1200ms × 8 worker = 6.6 req/s 全局，留 30% 余量
const MIN_INTERVAL_MS = 1200;
// SEC 触发限流后冷却 ~60s，我们用 2/4/8/16/32s 退避 ≈ 62s 总窗口覆盖
const MAX_RETRIES = 5;

function getUserAgent(): string {
  const ua = process.env.EDGAR_USER_AGENT;
  if (!ua) {
    return "Core600 Research contact@core600.com";
  }
  return ua;
}

// 模块级令牌桶：所有 edgar 请求都从这里串行获取"许可"
let lastRequestAt = 0;
let pending: Promise<void> = Promise.resolve();

async function acquireSlot(): Promise<void> {
  const myTurn = pending.then(async () => {
    const elapsed = Date.now() - lastRequestAt;
    if (elapsed < MIN_INTERVAL_MS) {
      await new Promise(r => setTimeout(r, MIN_INTERVAL_MS - elapsed));
    }
    lastRequestAt = Date.now();
  });
  pending = myTurn.catch(() => {}); // 异常不阻塞下一个
  return myTurn;
}

async function edgarFetch<T = unknown>(url: string): Promise<T> {
  let lastErr: Error | null = null;
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    await acquireSlot();
    try {
      const res = await fetch(url, {
        headers: {
          "User-Agent": getUserAgent(),
          Accept: "application/json",
        },
        next: { revalidate: 3600 }, // ISR：1 小时缓存
      });
      if (res.status === 429 || res.status >= 500) {
        // 限流 / 服务器错误 → 退避重试（2/4/8/16/32s）
        const retryAfter = Number(res.headers.get("Retry-After")) || 0;
        const backoff = Math.max(retryAfter * 1000, 2000 * Math.pow(2, attempt));
        console.warn(`[edgar] ${res.status} on ${url}, retry ${attempt + 1}/${MAX_RETRIES} in ${backoff}ms`);
        await new Promise(r => setTimeout(r, backoff));
        lastErr = new Error(`EDGAR ${url} → ${res.status}`);
        continue;
      }
      if (!res.ok) {
        throw new Error(`EDGAR ${url} → ${res.status}`);
      }
      // SEC 限流时偶尔返回 200 但 body 是 HTML 错误页 → JSON 解析失败时也走重试
      const text = await res.text();
      if (text.startsWith("<")) {
        const backoff = 2000 * Math.pow(2, attempt);
        console.warn(`[edgar] HTML body on ${url}, retry ${attempt + 1}/${MAX_RETRIES} in ${backoff}ms`);
        await new Promise(r => setTimeout(r, backoff));
        lastErr = new Error(`EDGAR ${url} → HTML body`);
        continue;
      }
      return JSON.parse(text);
    } catch (e) {
      lastErr = e as Error;
      // 网络错误也退避一下
      const backoff = 2000 * Math.pow(2, attempt);
      console.warn(`[edgar] error on ${url}: ${(e as Error).message}, retry in ${backoff}ms`);
      await new Promise(r => setTimeout(r, backoff));
    }
  }
  throw lastErr || new Error(`EDGAR ${url} failed after ${MAX_RETRIES} retries`);
}

// === 类型 ===

export interface EdgarFiling {
  accessionNumber: string;
  filingDate: string;
  reportDate: string;
  form: string;
  primaryDocument: string;
  primaryDocDescription: string;
  size: number;
}

export interface InsiderTrade {
  filingDate: string;
  accessionNumber: string;
  insiderName: string;       // 暂时用 filer name 占位
  url: string;               // 跳转到 EDGAR 详情
}

// === 高层封装 ===

/** 拉取一只股票的 EDGAR submissions（含所有历史 filing 列表）*/
export async function getSubmissions(cik: string) {
  const url = `${EDGAR_BASE}/submissions/CIK${cik}.json`;
  return edgarFetch<{
    name: string;
    cik: string;
    tickers: string[];
    filings: {
      recent: {
        accessionNumber: string[];
        filingDate: string[];
        reportDate: string[];
        form: string[];
        primaryDocument: string[];
        primaryDocDescription: string[];
        size: number[];
      };
    };
  }>(url);
}

/** 拉取一只股票最近的 Form 4（内部人交易）filing 列表 */
export async function getRecentForm4(cik: string, limit = 20): Promise<EdgarFiling[]> {
  try {
    const data = await getSubmissions(cik);
    const recent = data.filings.recent;
    const result: EdgarFiling[] = [];

    for (let i = 0; i < recent.form.length && result.length < limit; i++) {
      if (recent.form[i] === "4") {
        result.push({
          accessionNumber: recent.accessionNumber[i],
          filingDate: recent.filingDate[i],
          reportDate: recent.reportDate[i],
          form: recent.form[i],
          primaryDocument: recent.primaryDocument[i],
          primaryDocDescription: recent.primaryDocDescription[i] || "",
          size: recent.size[i],
        });
      }
    }
    return result;
  } catch {
    return [];
  }
}

/** 拉取一只股票最近的 8-K（重大事项）filing 列表 */
export async function getRecent8K(cik: string, limit = 10): Promise<EdgarFiling[]> {
  try {
    const data = await getSubmissions(cik);
    const recent = data.filings.recent;
    const result: EdgarFiling[] = [];

    for (let i = 0; i < recent.form.length && result.length < limit; i++) {
      if (recent.form[i] === "8-K") {
        result.push({
          accessionNumber: recent.accessionNumber[i],
          filingDate: recent.filingDate[i],
          reportDate: recent.reportDate[i],
          form: recent.form[i],
          primaryDocument: recent.primaryDocument[i],
          primaryDocDescription: recent.primaryDocDescription[i] || "",
          size: recent.size[i],
        });
      }
    }
    return result;
  } catch {
    return [];
  }
}

/** 构造 Filing 在 EDGAR 上的 URL */
export function filingUrl(cik: string, accessionNumber: string, primaryDocument: string): string {
  // accessionNumber 格式: 0001234567-25-000001 → 移除横杠
  const accessionNoDash = accessionNumber.replace(/-/g, "");
  // 去掉 CIK 前导 0
  const cikNoLead = parseInt(cik, 10).toString();
  return `https://www.sec.gov/Archives/edgar/data/${cikNoLead}/${accessionNoDash}/${primaryDocument}`;
}

/** 拉 Form 4 XML 并解析关键字段（v1 版，提取核心信息）*/
export async function parseForm4(cik: string, accessionNumber: string): Promise<{
  reportingOwnerName: string;
  reportingOwnerRelationship: string;
  transactions: Array<{
    securityTitle: string;
    transactionDate: string;
    transactionCode: string;       // P=买, S=卖, A=授予, M=行权 等
    shares: number;
    pricePerShare: number;
    sharesAfter: number;
  }>;
} | null> {
  try {
    const accessionNoDash = accessionNumber.replace(/-/g, "");
    const cikNoLead = parseInt(cik, 10).toString();
    // Form 4 的 XML 文件名通常是 accession 后的 .xml
    const indexUrl = `https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=${cik}&type=4&dateb=&owner=include&count=10&output=atom`;
    // 先简单实现：返回 null，后续详细解析
    return null;
  } catch {
    return null;
  }
}
