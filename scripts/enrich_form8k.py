#!/usr/bin/env python3
"""增量为 8-K / 6-K 公告生成中文一句话总结 → 写回 edgar_filings.json

为什么独立：
- fetch_edgar.py 每次重建 edgar_filings.json
- 用 accessionNumber 作 cache key 增量处理：第一次全量 ~60 min ¥185，后续 cron 只处理新增 (~1-2 min)

每个 8-K / 6-K entry 加 `summary_cn` 字段：

  "summary_cn": "Donald Robertson 升任首席会计官，接替 Tim Teter，自 2026-04-24 生效"

要求 LLM 输出：
- ≤80 字
- 保留人名/公司名英文
- 不要套话开头
- 直接陈述关键事实

成本：单次 DeepSeek-V3 ~¥0.024（输入 5K + 输出 0.3K tokens）
"""
import json
import os
import re
import time
import threading
import urllib.request
import urllib.error
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone
from pathlib import Path

USER_AGENT = os.environ.get("EDGAR_USER_AGENT", "Core600 Research qz6206@gmail.com")
ROOT = Path(__file__).parent.parent
STOCKS_JSON = ROOT / "data" / "stocks.json"
EDGAR_JSON = ROOT / "data" / "edgar_filings.json"
ENV_LOCAL = ROOT / ".env.local"

# SEC 抓 HTML 用 4 线程；LLM 总结独立 8 线程并行（IO 密集，CPU 闲）
NUM_WORKERS_FETCH = 4
MIN_INTERVAL_SEC = 0.5
NUM_WORKERS_LLM = 8
MAX_RETRIES = 3
LLM_URL = "https://api.siliconflow.cn/v1/chat/completions"
# 成本对比 (per 1M tokens, 2026-05 SiliconFlow):
#   Pro/moonshotai/Kimi K2.5         ¥4 in / ¥16 out  ← 最贵, 上次用这个超支
#   Pro/moonshotai/Kimi-K2-Instruct  ¥4 in / ¥16 out  ← 同价 (老版本)
#   deepseek-ai/DeepSeek-V3          ¥2 in / ¥8 out   ← 便宜一半, 短摘要够用 ✅
#   Qwen/Qwen2.5-72B-Instruct        ¥1.26 / ¥1.26    ← 最便宜, 但中文质量一般
LLM_MODEL = "deepseek-ai/DeepSeek-V3"
MAX_TEXT_CHARS = 8000  # 从 12000 降到 8000 (约 2K tokens 输入), 8-K 关键事实通常在前面

# 熔断: 连续失败 N 次后立即停 (防止余额耗尽时浪费 retry token)
CIRCUIT_BREAKER_THRESHOLD = 30

# Form 4/13F/季报这种格式化重复内容跳过摘要（仍保留 Item 中文标签）
# 重点摘要的 8-K Items（覆盖 ~70%）：
SUMMARY_WORTH_ITEMS = {
    "1.01", "1.02", "1.03",   # 重大合同 / 终止 / 破产
    "2.01", "2.03", "2.04", "2.05", "2.06",  # 收购/债务/重组/资产
    "3.01", "3.02", "3.03",   # 退市/股票发行/股东权利
    "4.01", "4.02",           # 审计师变动/财报不可靠
    "5.01", "5.02", "5.03",   # 控制权 / 高管变动 / 章程
    "5.04", "5.05", "5.07", "5.08",
    "6.01",
    "7.01",                   # Reg FD 披露
    "8.01",                   # 其他事项
}


def load_sf_key():
    key = os.environ.get("SILICONFLOW_API_KEY")
    if key:
        return key
    if ENV_LOCAL.exists():
        for line in ENV_LOCAL.read_text().splitlines():
            line = line.strip()
            if line.startswith("SILICONFLOW_API_KEY="):
                return line.split("=", 1)[1].strip().strip('"').strip("'")
    raise SystemExit("❌ SILICONFLOW_API_KEY 未设置")


SF_KEY = load_sf_key()
_thread_local = threading.local()


def _throttle():
    last = getattr(_thread_local, "last_request", 0.0)
    elapsed = time.time() - last
    if elapsed < MIN_INTERVAL_SEC:
        time.sleep(MIN_INTERVAL_SEC - elapsed)
    _thread_local.last_request = time.time()


def is_summary_worth(items_str: str | None) -> bool:
    """判断 8-K Item 编号是否值得 LLM 总结

    - "2.02,9.01" 这种纯业绩公告（无 SUMMARY_WORTH_ITEMS 任何项）→ 跳过
    - "5.02,9.01" 这种含高管变动 → 总结
    - 6-K 没有 items 字段 → 总结（因为外国发行人重要事件多样）
    """
    if not items_str:
        return True  # 没有 items（如 6-K）一律总结
    items = [x.strip() for x in items_str.split(",")]
    return any(item in SUMMARY_WORTH_ITEMS for item in items)


def fetch_filing_html(cik: str, accession_number: str, primary_document: str) -> str | None:
    """抓 8-K 主文档 HTML"""
    accession_no_dash = accession_number.replace("-", "")
    cik_no_lead = str(int(cik))
    url = f"https://www.sec.gov/Archives/edgar/data/{cik_no_lead}/{accession_no_dash}/{primary_document}"

    for attempt in range(MAX_RETRIES):
        _throttle()
        try:
            req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT, "Accept": "*/*"})
            with urllib.request.urlopen(req, timeout=30) as r:
                content = r.read()
                # 自动检测编码
                try:
                    return content.decode("utf-8", errors="ignore")
                except Exception:
                    return content.decode("latin-1", errors="ignore")
        except urllib.error.HTTPError as e:
            if e.code in (429, 500, 502, 503, 504):
                time.sleep(2 ** attempt * 2)
                continue
            return None
        except Exception:
            time.sleep(2 ** attempt)
    return None


def html_to_text(html: str) -> str:
    """简易 HTML → plain text"""
    # 移除 script/style
    text = re.sub(r"<style[^>]*>.*?</style>", " ", html, flags=re.DOTALL | re.IGNORECASE)
    text = re.sub(r"<script[^>]*>.*?</script>", " ", text, flags=re.DOTALL | re.IGNORECASE)
    # 块级标签换成换行（保留段落感）
    text = re.sub(r"<(?:p|div|br|tr|h[1-6])[^>]*>", "\n", text, flags=re.IGNORECASE)
    text = re.sub(r"</(?:p|div|tr|h[1-6])>", "\n", text, flags=re.IGNORECASE)
    # 去掉所有标签
    text = re.sub(r"<[^>]+>", " ", text)
    # HTML entities
    text = text.replace("&nbsp;", " ").replace("&amp;", "&").replace("&lt;", "<").replace("&gt;", ">").replace("&#160;", " ").replace("&#8217;", "'").replace("&#8220;", '"').replace("&#8221;", '"')
    text = re.sub(r"&#\d+;", " ", text)
    # 收敛空白
    text = re.sub(r"[ \t]+", " ", text)
    text = re.sub(r"\n\s*\n+", "\n\n", text)
    return text.strip()


def summarize_llm(ticker: str, name: str, item_codes: str | None, text: str, form_type: str) -> tuple[str | None, str | None]:
    """
    调 LLM 出 ≤80 字中文摘要

    返回 (summary, error_kind):
      summary 非 None  → 成功
      error_kind != None → 失败, kind 用来判断要不要触发熔断:
        "auth"   - 401/402/403 余额耗尽 / key 无效 → 熔断器立即打开
        "transient" - 429/5xx → retry 后仍失败, 单次失败计数
        "other"  - 其他 → 单次失败计数
    """
    if len(text) > MAX_TEXT_CHARS:
        text = text[:MAX_TEXT_CHARS] + "..."

    # 精简 prompt: 从 ~150 token 缩到 ~50 token
    items_hint = f"({item_codes})" if item_codes else ""
    prompt = f"""美股 {ticker} {form_type}{items_hint} 关键事实，≤80 字中文。
公司名/人名/职位保留英文，数字精确，直接陈述事实，不加冗余开头。

{text}"""

    body = {
        "model": LLM_MODEL,
        "messages": [{"role": "user", "content": prompt}],
        "max_tokens": 200,
        "temperature": 0.3,
    }

    for attempt in range(MAX_RETRIES):
        try:
            req = urllib.request.Request(
                LLM_URL,
                data=json.dumps(body).encode(),
                headers={"Authorization": f"Bearer {SF_KEY}", "Content-Type": "application/json"},
                method="POST",
            )
            with urllib.request.urlopen(req, timeout=120) as r:
                data = json.loads(r.read())
            text = data["choices"][0]["message"]["content"].strip()
            text = re.sub(r"^[\"\'`]+|[\"\'`]+$", "", text).strip()
            text = re.sub(r"\s+", " ", text)
            return text, None
        except urllib.error.HTTPError as e:
            # 401/402/403 = 余额 / key / 权限问题, 立刻熔断 (不重试)
            if e.code in (401, 402, 403):
                return None, "auth"
            if e.code in (429, 500, 502, 503, 504):
                time.sleep(2 ** attempt * 3)
                continue
            return None, "other"
        except Exception:
            time.sleep(2 ** attempt * 2)
    return None, "transient"


def enrich_one(cik: str, ticker: str, name: str, entry: dict, form_type: str, circuit: dict) -> dict:
    """如果 entry 没有 summary_cn 字段，抓 HTML + 总结。
    circuit 是熔断器状态字典 (跨线程共享): {"open": False, "consecutive_failures": 0, "lock": Lock}
    """
    if "summary_cn" in entry:
        return entry  # 已总结过

    items = entry.get("items", "")
    # 业绩公告类（仅 2.02 / 9.01 没有别的）跳过总结
    if not is_summary_worth(items):
        entry["summary_cn"] = None  # 标记为"故意不做"
        entry["summary_skipped"] = "routine"
        return entry

    # 熔断检查: 如果断路器打开, 直接返回失败 (不烧 token)
    if circuit.get("open"):
        entry["summary_cn"] = None
        entry["summary_skipped"] = "circuit_breaker"
        return entry

    html = fetch_filing_html(cik, entry["accessionNumber"], entry["primaryDocument"])
    if not html:
        entry["summary_cn"] = None
        entry["summary_skipped"] = "fetch_failed"
        return entry

    text = html_to_text(html)
    if len(text) < 200:  # 文档异常短，可能是空 cover sheet
        entry["summary_cn"] = None
        entry["summary_skipped"] = "text_too_short"
        return entry

    summary, err = summarize_llm(ticker, name, items, text, form_type)

    # 熔断器: 401/402/403 直接打开断路器 (余额 / key 问题, 后面所有都会失败)
    if err == "auth":
        with circuit["lock"]:
            if not circuit["open"]:
                circuit["open"] = True
                print(f"   🚨 熔断打开: {ticker} 收到 4xx (余额/key 问题), 后续全部跳过", flush=True)
        entry["summary_cn"] = None
        entry["summary_skipped"] = "auth_failed"
        return entry

    # 累计连续失败 → 触发熔断
    if not summary:
        with circuit["lock"]:
            circuit["consecutive_failures"] += 1
            if circuit["consecutive_failures"] >= CIRCUIT_BREAKER_THRESHOLD and not circuit["open"]:
                circuit["open"] = True
                print(f"   🚨 熔断打开: 连续 {CIRCUIT_BREAKER_THRESHOLD} 条失败", flush=True)
    else:
        # 成功 → 重置连续失败计数
        with circuit["lock"]:
            circuit["consecutive_failures"] = 0

    entry["summary_cn"] = summary or None
    if not summary:
        entry["summary_skipped"] = "llm_failed"
    return entry


def main():
    t_start = time.time()
    print("📥 加载 edgar_filings.json...", flush=True)
    if not EDGAR_JSON.exists():
        raise SystemExit("❌ data/edgar_filings.json 不存在，先跑 fetch_edgar.py")
    edgar = json.loads(EDGAR_JSON.read_text())

    stocks = json.loads(STOCKS_JSON.read_text())["stocks"]
    ticker_to_stock = {s["ticker"]: s for s in stocks if s.get("cik")}

    todos = []  # (cik, ticker, name, form_type, key, idx, entry)
    total = 0
    already_done = 0
    routine_skipped = 0
    retry_count = 0  # 之前 llm_failed / auth_failed / circuit_breaker 重新尝试

    # 上次跑因 LLM 问题失败的，本次重试（清除标记，让流程当全新处理）
    RETRY_REASONS = {"llm_failed", "auth_failed", "circuit_breaker"}

    for ticker, data in edgar.get("by_ticker", {}).items():
        stock = ticker_to_stock.get(ticker)
        if not stock:
            continue
        cik = stock["cik"]
        name = stock.get("name") or ticker
        for form_field, form_label in [("form8k", "8-K"), ("form6k", "6-K")]:
            for i, entry in enumerate(data.get(form_field, [])):
                total += 1
                if "summary_cn" in entry:
                    skipped_reason = entry.get("summary_skipped")
                    if skipped_reason == "routine":
                        routine_skipped += 1
                    elif skipped_reason in RETRY_REASONS:
                        # 重试: 清除上次失败标记
                        del entry["summary_cn"]
                        if "summary_skipped" in entry:
                            del entry["summary_skipped"]
                        retry_count += 1
                        todos.append((cik, ticker, name, form_label, form_field, i, entry))
                    else:
                        already_done += 1
                else:
                    todos.append((cik, ticker, name, form_label, form_field, i, entry))

    # DeepSeek-V3 单价: ¥2 in / ¥8 out per 1M tokens
    # 每条平均: ~2K input + ~80 output → ~¥0.005-0.008/条
    est_cost = len(todos) * 0.007
    print(f"   ✓ 8-K + 6-K 总数: {total}", flush=True)
    print(f"   ✓ 已总结: {already_done}", flush=True)
    print(f"   ⊘ 跳过（业绩公告等常规事项）: {routine_skipped}", flush=True)
    print(f"   🔁 重试上次 LLM 失败: {retry_count}", flush=True)
    print(f"   📋 待处理: {len(todos)} (含重试)", flush=True)
    print(f"   🤖 模型: {LLM_MODEL}", flush=True)
    print(f"   🧵 LLM 并发 {NUM_WORKERS_LLM} 线程", flush=True)
    print(f"   🚨 熔断阈值: 连续 {CIRCUIT_BREAKER_THRESHOLD} 失败", flush=True)
    print(f"   💰 预计成本 ¥{est_cost:.1f}\n", flush=True)

    if not todos:
        print("✅ 全部已处理")
        return

    # 熔断器状态 (跨线程共享)
    circuit = {"open": False, "consecutive_failures": 0, "lock": threading.Lock()}

    completed = 0
    success = 0
    skipped = 0
    failed = 0

    def task(item):
        cik, ticker, name, form_label, form_field, idx, entry = item
        result = enrich_one(cik, ticker, name, entry, form_label, circuit)
        return ticker, form_field, idx, result

    with ThreadPoolExecutor(max_workers=NUM_WORKERS_LLM) as pool:
        futures = [pool.submit(task, item) for item in todos]
        for fut in as_completed(futures):
            completed += 1
            try:
                ticker, form_field, idx, enriched = fut.result()
            except Exception as e:
                print(f"   ❌ 异常: {e}", flush=True)
                failed += 1
                continue

            edgar["by_ticker"][ticker][form_field][idx] = enriched
            if enriched.get("summary_cn"):
                success += 1
            elif enriched.get("summary_skipped") == "routine":
                skipped += 1
            else:
                failed += 1

            if completed % 100 == 0:
                cb_msg = " 🚨 熔断已打开" if circuit["open"] else ""
                print(f"[{completed}/{len(todos)}] 进度 (总结 {success} / 跳过 {skipped} / 失败 {failed}){cb_msg}", flush=True)
                # 每 500 条增量保存一次（防中断丢数据）
                if completed % 500 == 0:
                    EDGAR_JSON.write_text(json.dumps(edgar, ensure_ascii=False, indent=2))
                    print(f"   💾 增量保存", flush=True)

    EDGAR_JSON.write_text(json.dumps(edgar, ensure_ascii=False, indent=2))

    elapsed = time.time() - t_start
    size_mb = EDGAR_JSON.stat().st_size / 1024 / 1024
    print(f"\n📊 完成（耗时 {elapsed/60:.1f} min）:")
    if circuit["open"]:
        print(f"   🚨 熔断曾打开 (大概率因余额耗尽 / key 失效)，未处理项标 summary_skipped=auth_failed/circuit_breaker")
    print(f"   ✅ 总结成功: {success}")
    print(f"   ⊘ 跳过: {skipped}")
    print(f"   ❌ 失败: {failed}")
    print(f"   💾 输出: {EDGAR_JSON} ({size_mb:.2f} MB)")


if __name__ == "__main__":
    main()
