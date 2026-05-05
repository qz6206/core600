#!/usr/bin/env python3
"""补漏脚本：修复 audit 发现的可修复缺失数据

任务：
1. Options: BF-B/BRK-B (Polygon 用 . 代替 -)
2. Description CN: TYL (Kimi 重试)
3. Transcripts CN: 失败列表里的所有股票（解析 transcripts.json stats.translation_failed + 文件中没有但 stocks.json 里有的）

每个任务独立，互不影响。结束后报告修复了多少。
"""
import json
import os
import time
import threading
import urllib.request
import urllib.error
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone, timedelta
from pathlib import Path
from statistics import median

ROOT = Path(__file__).parent.parent
STOCKS_JSON = ROOT / "data" / "stocks.json"
ENV_LOCAL = ROOT / ".env.local"


def load_keys():
    keys = {}
    for var in ["FMP_API_KEY", "POLYGON_API_KEY", "SILICONFLOW_API_KEY"]:
        keys[var] = os.environ.get(var)
    if any(v is None for v in keys.values()) and ENV_LOCAL.exists():
        for line in ENV_LOCAL.read_text().splitlines():
            line = line.strip()
            for var in keys:
                if line.startswith(f"{var}="):
                    if not keys[var]:
                        keys[var] = line.split("=", 1)[1].strip().strip('"').strip("'")
    return keys


KEYS = load_keys()
KIMI_URL = "https://api.siliconflow.cn/v1/chat/completions"
KIMI_MODEL = "Pro/moonshotai/Kimi-K2.5"

with open(STOCKS_JSON) as f:
    STOCKS = {s["ticker"]: s for s in json.load(f)["stocks"]}


# ============================================
# 任务 1: Options BF-B / BRK-B（用 . 替代 -）
# ============================================

def patch_options():
    """重新抓 Polygon options for BF-B / BRK-B 用 BF.B / BRK.B 格式"""
    print("\n========== 任务 1: Options BF-B / BRK-B ==========")
    options_path = ROOT / "data" / "options.json"
    options = json.loads(options_path.read_text())

    # 替换映射
    fixes = [("BF-B", "BF.B"), ("BRK-B", "BRK.B")]
    fixed_count = 0

    for orig_ticker, polygon_ticker in fixes:
        if orig_ticker in options["by_ticker"]:
            print(f"  {orig_ticker}: 已有数据，跳过")
            continue
        print(f"  {orig_ticker} → 用 Polygon ticker {polygon_ticker} 抓取...", flush=True)

        # 1. spot price
        url = f"https://api.polygon.io/v2/aggs/ticker/{polygon_ticker}/prev?apiKey={KEYS['POLYGON_API_KEY']}"
        try:
            with urllib.request.urlopen(url, timeout=30) as r:
                data = json.loads(r.read())
            spot = data["results"][0]["c"] if data.get("results") else None
        except Exception as e:
            print(f"    ❌ spot 失败: {e}")
            continue

        # 2. options chain
        today = datetime.now().date()
        end_date = (today + timedelta(days=90)).strftime("%Y-%m-%d")
        contracts = []
        cursor = None
        for page in range(4):
            if cursor:
                url = cursor + f"&apiKey={KEYS['POLYGON_API_KEY']}"
            else:
                url = (f"https://api.polygon.io/v3/snapshot/options/{polygon_ticker}"
                       f"?expiration_date.gte={today.strftime('%Y-%m-%d')}"
                       f"&expiration_date.lte={end_date}&limit=250"
                       f"&apiKey={KEYS['POLYGON_API_KEY']}")
            try:
                with urllib.request.urlopen(url, timeout=30) as r:
                    data = json.loads(r.read())
            except Exception as e:
                print(f"    ❌ chain page {page+1}: {e}")
                break
            results = data.get("results") or []
            if not results:
                break
            contracts.extend(results)
            next_url = data.get("next_url")
            if not next_url:
                break
            cursor = next_url

        if not contracts:
            print(f"    ❌ 无合约")
            continue

        # 3. process（参考 fetch_polygon_options.py 的 process_chain 简化版）
        active = [c for c in contracts if (c.get("day", {}) or {}).get("volume", 0) > 0]
        active.sort(key=lambda c: c["day"]["volume"], reverse=True)

        total_vol = sum(c["day"]["volume"] for c in active)
        call_vol = sum(c["day"]["volume"] for c in active if c["details"]["contract_type"] == "call")
        put_vol = sum(c["day"]["volume"] for c in active if c["details"]["contract_type"] == "put")
        pc_ratio = (put_vol / call_vol) if call_vol else None

        atm_iv = None
        atm_iv_count = 0
        if spot:
            cands = []
            for c in contracts:
                det = c["details"]
                iv = c.get("implied_volatility")
                oi = c.get("open_interest", 0) or 0
                strike = det.get("strike_price")
                exp = det.get("expiration_date")
                if not (iv and strike and exp and oi >= 100):
                    continue
                try:
                    exp_dt = datetime.strptime(exp, "%Y-%m-%d").date()
                except:
                    continue
                dte = (exp_dt - today).days
                if not (14 <= dte <= 45):
                    continue
                if abs(strike - spot) / spot > 0.05:
                    continue
                if iv < 0.01 or iv > 5.0:
                    continue
                cands.append(iv)
            if cands:
                atm_iv = median(cands)
                atm_iv_count = len(cands)

        top_contracts = []
        for c in active[:10]:
            det = c["details"]
            day = c["day"]
            oi = c.get("open_interest") or 0
            vol = day.get("volume", 0)
            top_contracts.append({
                "ticker": det.get("ticker"),
                "type": det.get("contract_type"),
                "strike": det.get("strike_price"),
                "exp": det.get("expiration_date"),
                "vol": vol,
                "oi": oi,
                "vol_oi_ratio": (vol / oi) if oi else None,
                "iv": c.get("implied_volatility"),
                "delta": (c.get("greeks") or {}).get("delta"),
                "last_price": day.get("close"),
                "change_pct": day.get("change_percent"),
            })

        options["by_ticker"][orig_ticker] = {
            "spot": spot,
            "atm_iv": atm_iv,
            "atm_iv_count": atm_iv_count,
            "total_vol": total_vol,
            "call_vol": call_vol,
            "put_vol": put_vol,
            "put_call_ratio": pc_ratio,
            "top_contracts": top_contracts,
            "active_count": len(active),
            "total_chain_count": len(contracts),
        }
        fixed_count += 1
        print(f"    ✅ {orig_ticker}: spot ${spot}, {len(contracts)} 合约, top {len(top_contracts)}", flush=True)

    if fixed_count > 0:
        options_path.write_text(json.dumps(options, ensure_ascii=False, indent=2))
        print(f"  💾 写回 options.json，新增 {fixed_count} 只")
    return fixed_count


# ============================================
# 任务 2: Description CN TYL（Kimi 重试）
# ============================================

def translate_kimi(prompt: str, max_tokens: int) -> str | None:
    """通用 Kimi 调用"""
    body = {
        "model": KIMI_MODEL,
        "messages": [{"role": "user", "content": prompt}],
        "max_tokens": max_tokens,
        "temperature": 0.3,
    }
    for attempt in range(3):
        try:
            req = urllib.request.Request(
                KIMI_URL,
                data=json.dumps(body).encode(),
                headers={"Authorization": f"Bearer {KEYS['SILICONFLOW_API_KEY']}",
                         "Content-Type": "application/json"},
                method="POST",
            )
            with urllib.request.urlopen(req, timeout=600) as r:
                data = json.loads(r.read())
            return data["choices"][0]["message"]["content"].strip()
        except Exception as e:
            print(f"      Kimi 重试 {attempt+1}: {e}")
            time.sleep(5 * (attempt + 1))
    return None


def patch_descriptions():
    """重译 TYL 公司简介"""
    print("\n========== 任务 2: Description CN (TYL) ==========")
    desc_path = ROOT / "data" / "descriptions_cn.json"
    desc = json.loads(desc_path.read_text())

    missing = [t for t in STOCKS if t not in desc.get("by_ticker", {})]
    print(f"  缺失: {missing}")
    if not missing:
        print("  无需修复")
        return 0

    fixed = 0
    for ticker in missing:
        # 先抓 FMP profile
        url = f"https://financialmodelingprep.com/api/v3/profile/{ticker}?apikey={KEYS['FMP_API_KEY']}"
        try:
            with urllib.request.urlopen(url, timeout=30) as r:
                data = json.loads(r.read())
            profile = data[0] if data else None
        except Exception as e:
            print(f"    ❌ {ticker} FMP profile 失败: {e}")
            continue

        if not profile or not profile.get("description"):
            print(f"    ❌ {ticker} 无 description")
            continue

        name = profile.get("companyName") or ticker
        prompt = f"""你是一位专业财经译者，请把下面这段美股 {ticker}（{name}）的公司简介翻译成简洁、准确、自然的中文。

要求：
1. 公司名（{name}）保留英文原文，不要翻译
2. 产品名、品牌名保留英文原文
3. 中文行文像中信证券研究报告，不要有翻译腔
4. 直接输出译文，不要前后加任何说明

英文原文：
{profile['description']}"""

        cn = translate_kimi(prompt, max_tokens=2000)
        if cn:
            desc["by_ticker"][ticker] = cn
            fixed += 1
            print(f"    ✅ {ticker}: {len(cn)} 字 — {cn[:40]}...")
        else:
            print(f"    ❌ {ticker} 翻译失败")

    if fixed > 0:
        desc["stats"]["translated"] += fixed
        desc["stats"]["failed"] -= fixed
        desc_path.write_text(json.dumps(desc, ensure_ascii=False, indent=2))
        print(f"  💾 写回 descriptions_cn.json，新增 {fixed} 只")
    return fixed


# ============================================
# 任务 3: Transcripts CN（重试失败的）
# ============================================

def patch_transcripts():
    """重试 transcripts.json 中失败的股票"""
    print("\n========== 任务 3: Transcripts CN（重试失败） ==========")
    tr_path = ROOT / "data" / "transcripts.json"
    tr = json.loads(tr_path.read_text())

    # 从 by_ticker 找出所有 stocks 中没有 transcript_cn 的
    missing = []
    for ticker in STOCKS:
        entry = tr.get("by_ticker", {}).get(ticker)
        if not entry:
            missing.append(ticker)
        elif "content_cn" not in entry:
            # 之前 failed_translation: True 的 partial 数据
            missing.append(ticker)

    print(f"  缺失/未译: {len(missing)} 只")
    print(f"  样本: {missing[:20]}")

    if not missing:
        print("  无需修复")
        return 0

    # 这部分量大，用 4 线程谨慎处理
    fixed = 0

    def fetch_and_translate(ticker):
        """先抓 FMP transcript，再翻译"""
        thread_id = threading.get_ident() % 1000
        # 找最新 transcript
        today = datetime.now()
        for year in [today.year, today.year - 1]:
            for q in [4, 3, 2, 1]:
                url = f"https://financialmodelingprep.com/api/v3/earning_call_transcript/{ticker}?year={year}&quarter={q}&apikey={KEYS['FMP_API_KEY']}"
                try:
                    with urllib.request.urlopen(url, timeout=30) as r:
                        data = json.loads(r.read())
                    if data and isinstance(data, list) and data and data[0].get("content"):
                        content = data[0]["content"]
                        date = data[0].get("date")
                        # Translate
                        name = STOCKS[ticker].get("name") or ticker
                        prompt = f"""你是一位专业财经译者，下面是美股 {ticker}（{name}）的财报会议（earnings call）transcript 全文。请翻译成中文。

要求：
1. 公司名/人名/产品名保留英文原文
2. 财务术语用准确中文（revenue→营收，YoY→同比，fiscal Q1→财年第一季度，guidance→业绩指引）
3. 数字精确（$44 billion → 440 亿美元）
4. 保留说话人标记（"XXX：" 格式）
5. 中文要自然
6. 直接输出译文

英文原文：
{content}"""
                        cn = translate_kimi(prompt, max_tokens=12000)
                        if cn:
                            return ticker, {
                                "year": year,
                                "quarter": q,
                                "date": date,
                                "content_cn": cn,
                                "content_en_chars": len(content),
                            }
                        return ticker, None
                except Exception:
                    pass
        return ticker, None

    with ThreadPoolExecutor(max_workers=4) as pool:
        futures = {pool.submit(fetch_and_translate, t): t for t in missing}
        for fut in as_completed(futures):
            ticker = futures[fut]
            try:
                _, data = fut.result()
                if data:
                    tr["by_ticker"][ticker] = data
                    fixed += 1
                    print(f"    ✅ {ticker}: {data['year']} Q{data['quarter']} 中文 {len(data['content_cn'])} 字", flush=True)
                else:
                    print(f"    ❌ {ticker} 仍失败", flush=True)
            except Exception as e:
                print(f"    ❌ {ticker} 异常: {e}", flush=True)

    if fixed > 0:
        tr["stats"]["translated"] += fixed
        tr["stats"]["translation_failed"] = max(0, tr["stats"].get("translation_failed", 0) - fixed)
        tr_path.write_text(json.dumps(tr, ensure_ascii=False, indent=2))
        print(f"  💾 写回 transcripts.json，新增 {fixed} 只")
    return fixed


# ============================================
# 主流程
# ============================================

if __name__ == "__main__":
    print("🩹 Core 600 数据补漏脚本")
    t0 = time.time()
    n1 = patch_options()
    n2 = patch_descriptions()
    n3 = patch_transcripts()
    print(f"\n✅ 完成（耗时 {(time.time()-t0)/60:.1f} min）")
    print(f"   Options 补: {n1}")
    print(f"   Descriptions 补: {n2}")
    print(f"   Transcripts 补: {n3}")
