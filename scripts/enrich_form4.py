#!/usr/bin/env python3
"""增量解析 Form 4 XML，提取人名/职位/动作/股数/价格 → 写回 edgar_filings.json

为什么独立：
- fetch_edgar.py 每次重建 edgar_filings.json，但解析 Form 4 XML 要 ~7700 次 SEC 调用（16 min）
- 用 accessionNumber 作 cache key 增量处理：第一次全量 ~16 min，后续每次 cron 只处理新增的 Form 4 (~1 min)

输出：在每个 form4 entry 加 `parsed` 字段：
{
  "accessionNumber": "...",
  "filingDate": "2026-04-30",
  ...
  "parsed": {
    "owner_name": "HUANG JEN-HSUN",
    "owner_title_cn": "President & CEO",
    "is_director": true,
    "is_officer": true,
    "is_ten_pct": false,
    "transactions": [
      {
        "kind": "non-derivative",  // 普通股 / 衍生品
        "security": "Common Stock",
        "date": "2026-04-28",
        "code": "S",
        "code_label_cn": "公开市场卖出",
        "shares": 700000,
        "price": 110.50,
        "value": 77350000,
        "acquired_disposed": "D",
        "shares_owned_after": 858820000
      }
    ]
  }
}
"""
import json
import os
import time
import threading
import urllib.request
import urllib.error
import xml.etree.ElementTree as ET
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone
from pathlib import Path

USER_AGENT = os.environ.get("EDGAR_USER_AGENT", "Core600 Research qz6206@gmail.com")
ROOT = Path(__file__).parent.parent
STOCKS_JSON = ROOT / "data" / "stocks.json"
EDGAR_JSON = ROOT / "data" / "edgar_filings.json"

NUM_WORKERS = 4
MIN_INTERVAL_PER_WORKER = 0.5
MAX_RETRIES = 3

# Transaction code → 中文标签（Form 4 transaction codes per SEC）
CODE_LABELS_CN = {
    "P": "公开市场买入",
    "S": "公开市场卖出",
    "A": "授予/奖励",
    "M": "期权行权（衍生品 → 普通股）",
    "F": "代扣股票（用于缴税）",
    "D": "处置给发行人",
    "G": "赠予",
    "I": "其他获取",
    "J": "其他处置",
    "C": "证券转换",
    "X": "实值期权行权",
    "W": "继承",
    "K": "股权互换",
    "U": "要约收购出售",
    "L": "短期掉期",
    "V": "自愿申报",
    "Z": "信托存放",
    "E": "短期期权到期",
}

_thread_local = threading.local()


def _throttle():
    last = getattr(_thread_local, "last_request", 0.0)
    elapsed = time.time() - last
    if elapsed < MIN_INTERVAL_PER_WORKER:
        time.sleep(MIN_INTERVAL_PER_WORKER - elapsed)
    _thread_local.last_request = time.time()


def fetch_form4_xml(cik: str, accession_number: str, primary_document: str) -> bytes | None:
    """拉单个 Form 4 XML"""
    accession_no_dash = accession_number.replace("-", "")
    cik_no_lead = str(int(cik))
    # primary_document 形如 "xslF345X06/wk-form4_xxx.xml"，去掉 xsl 前缀拿原始 XML
    if "/" in primary_document:
        filename = primary_document.split("/", 1)[1]
    else:
        filename = primary_document
    url = f"https://www.sec.gov/Archives/edgar/data/{cik_no_lead}/{accession_no_dash}/{filename}"

    for attempt in range(MAX_RETRIES):
        _throttle()
        try:
            req = urllib.request.Request(url, headers={
                "User-Agent": USER_AGENT,
                "Accept": "application/xml",
            })
            with urllib.request.urlopen(req, timeout=30) as r:
                return r.read()
        except urllib.error.HTTPError as e:
            if e.code in (429, 500, 502, 503, 504):
                time.sleep(2 ** attempt * 2)
                continue
            return None
        except Exception:
            time.sleep(2 ** attempt)
    return None


def _ftext(elem, path, default=""):
    """findtext with default"""
    if elem is None:
        return default
    val = elem.findtext(path)
    return val if val is not None else default


def _ffloat(elem, path):
    val = _ftext(elem, path)
    if not val:
        return None
    try:
        return float(val)
    except ValueError:
        return None


def parse_form4_xml(xml_bytes: bytes) -> dict | None:
    """解析 Form 4 XML 提取结构化字段"""
    try:
        root = ET.fromstring(xml_bytes)
    except ET.ParseError:
        return None

    out = {
        "owner_name": None,
        "owner_title_cn": None,
        "is_director": False,
        "is_officer": False,
        "is_ten_pct": False,
        "transactions": [],
    }

    # 报告人（可有多个，取第一个）
    for owner in root.findall("reportingOwner"):
        owner_id = owner.find("reportingOwnerId")
        if owner_id is not None and not out["owner_name"]:
            out["owner_name"] = _ftext(owner_id, "rptOwnerName") or None
        rel = owner.find("reportingOwnerRelationship")
        if rel is not None:
            if _ftext(rel, "isDirector") in ("1", "true"):
                out["is_director"] = True
            if _ftext(rel, "isOfficer") in ("1", "true"):
                out["is_officer"] = True
            if _ftext(rel, "isTenPercentOwner") in ("1", "true"):
                out["is_ten_pct"] = True
            title = _ftext(rel, "officerTitle")
            if title and not out["owner_title_cn"]:
                out["owner_title_cn"] = title

    # 普通股交易
    for tx in root.iter("nonDerivativeTransaction"):
        code = _ftext(tx, ".//transactionCoding/transactionCode")
        shares = _ffloat(tx, ".//transactionShares/value") or 0
        price = _ffloat(tx, ".//transactionPricePerShare/value") or 0
        ad = _ftext(tx, ".//transactionAcquiredDisposedCode/value")
        out["transactions"].append({
            "kind": "non-derivative",
            "security": _ftext(tx, ".//securityTitle/value"),
            "date": _ftext(tx, ".//transactionDate/value"),
            "code": code,
            "code_label_cn": CODE_LABELS_CN.get(code, code),
            "shares": shares,
            "price": price,
            "value": round(shares * price, 2) if (shares and price) else 0,
            "acquired_disposed": ad,
            "shares_owned_after": _ffloat(tx, ".//sharesOwnedFollowingTransaction/value") or 0,
        })

    # 衍生品交易（期权/RSU）
    for tx in root.iter("derivativeTransaction"):
        code = _ftext(tx, ".//transactionCoding/transactionCode")
        out["transactions"].append({
            "kind": "derivative",
            "security": _ftext(tx, ".//securityTitle/value"),
            "date": _ftext(tx, ".//transactionDate/value"),
            "code": code,
            "code_label_cn": CODE_LABELS_CN.get(code, code),
            "shares": _ffloat(tx, ".//transactionShares/value") or 0,
            "price": _ffloat(tx, ".//transactionPricePerShare/value") or 0,
            "underlying_shares": _ffloat(tx, ".//underlyingSecurity/underlyingSecurityShares/value") or 0,
            "acquired_disposed": _ftext(tx, ".//transactionAcquiredDisposedCode/value"),
        })

    return out


def enrich_one(cik: str, entry: dict) -> dict:
    """如果 entry 没有 parsed 字段，抓 XML 解析后加上"""
    if "parsed" in entry:
        return entry  # 已解析过，跳过
    xml_bytes = fetch_form4_xml(cik, entry["accessionNumber"], entry["primaryDocument"])
    if xml_bytes is None:
        entry["parsed"] = None  # 标记尝试过但失败
        return entry
    parsed = parse_form4_xml(xml_bytes)
    entry["parsed"] = parsed
    return entry


def main():
    t_start = time.time()
    print("📥 加载 edgar_filings.json...", flush=True)
    if not EDGAR_JSON.exists():
        raise SystemExit("❌ data/edgar_filings.json 不存在，先跑 fetch_edgar.py")
    edgar = json.loads(EDGAR_JSON.read_text())

    # 加载 stocks.json 获取 ticker → cik 映射
    stocks = json.loads(STOCKS_JSON.read_text())["stocks"]
    ticker_to_cik = {s["ticker"]: s["cik"] for s in stocks if s.get("cik")}

    # 收集所有需要 enrich 的 (cik, ticker, idx_in_list, entry) 元组
    todos = []
    total_entries = 0
    already_done = 0
    for ticker, data in edgar.get("by_ticker", {}).items():
        cik = ticker_to_cik.get(ticker)
        if not cik:
            continue
        for i, entry in enumerate(data.get("form4", [])):
            total_entries += 1
            if "parsed" in entry:
                already_done += 1
            else:
                todos.append((cik, ticker, i, entry))

    print(f"   ✓ Form 4 条目总数: {total_entries}", flush=True)
    print(f"   ✓ 已解析: {already_done}", flush=True)
    print(f"   📋 待解析: {len(todos)}", flush=True)
    print(f"   🧵 {NUM_WORKERS} 线程 × {MIN_INTERVAL_PER_WORKER * 1000:.0f}ms 间隔 = {NUM_WORKERS / MIN_INTERVAL_PER_WORKER:.1f} req/s\n", flush=True)

    if not todos:
        print("✅ 全部已解析，无需更新")
        return

    completed = 0
    success = 0
    failed = 0

    def task(item):
        cik, ticker, idx, entry = item
        result = enrich_one(cik, entry)
        return ticker, idx, result

    with ThreadPoolExecutor(max_workers=NUM_WORKERS) as pool:
        futures = [pool.submit(task, item) for item in todos]
        for fut in as_completed(futures):
            completed += 1
            try:
                ticker, idx, enriched = fut.result()
            except Exception as e:
                print(f"   ❌ 异常: {e}", flush=True)
                failed += 1
                continue

            # 写回原数据
            edgar["by_ticker"][ticker]["form4"][idx] = enriched
            if enriched.get("parsed"):
                success += 1
            else:
                failed += 1

            if completed % 100 == 0:
                print(f"[{completed}/{len(todos)}] 进度 (成功 {success} / 失败 {failed})", flush=True)

    # 增量写回（保留原结构）
    EDGAR_JSON.write_text(json.dumps(edgar, ensure_ascii=False, indent=2))

    elapsed = time.time() - t_start
    size_mb = EDGAR_JSON.stat().st_size / 1024 / 1024
    print(f"\n📊 完成（耗时 {elapsed/60:.1f} min）:")
    print(f"   ✅ 解析成功: {success}")
    print(f"   ❌ 解析失败: {failed}")
    print(f"   💾 输出: {EDGAR_JSON} ({size_mb:.2f} MB)")


if __name__ == "__main__":
    main()
