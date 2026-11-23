#!/usr/bin/env python3
"""Refresh fund data for TopSpaceETFs.com.
Writes data/funds.json (summary for every fund in the sheet) and data/etf/<TICKER>.json
(price history, top holdings, dividends). Keeps the previous values when a lookup fails."""
import csv, io, json, re, sys, time, urllib.request, datetime, os

CSV = "https://docs.google.com/spreadsheets/d/e/2PACX-1vSrmLZYgKhMuwExsTbxDBBrN0aTAj0KIlFH5kPeZblp_7FXO7AGfgwilgbt3qCKF9XIir_QTNeYRpqy/pub?gid=0&single=true&output=csv"
UA = {"User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36"}
ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
OUT = os.path.join(ROOT, "data", "funds.json")
DET = os.path.join(ROOT, "data", "etf")

def get(url):
    return urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=30).read().decode("utf-8", "ignore")

def field(html, key, num=False):
    m = re.search(r'[,{]%s:("((?:[^"\\]|\\.)*)"|(-?\.?[\d.]+))' % re.escape(key), html)
    if not m: return None
    v = m.group(2) if m.group(2) is not None else m.group(3)
    if v in ("", "n/a", "-"): return None
    return int(float(v)) if num else v

def num(html, key):
    v = field(html, key)
    try: return round(float(str(v).replace("%", "").replace("+", "").replace(",", "")), 4)
    except Exception: return None

def info_table(html):
    m = re.search(r'infoTable:\[(.*?)\]\]', html)
    out = {}
    if m:
        for k, v in re.findall(r'\["([^"]+)","([^"]*)"', m.group(1) + "]"):
            out[k] = v
    return out

def holdings(sym):
    try:
        h = get("https://stockanalysis.com/etf/%s/holdings/" % sym.lower())
    except Exception:
        return None
    rows = re.findall(r'\{no:(\d+),s:"([^"]*)",n:"((?:[^"\\]|\\.)*)",holdingWeight:(-?[\d.]+)', h)
    return [{"s": re.sub(r'^[$!]', '', s).split("/")[-1].upper(), "n": n.replace('\\"', '"'), "w": float(w)} for _, s, n, w in rows][:25] or None

def history(sym):
    try:
        d = json.loads(get("https://stockanalysis.com/api/symbol/e/%s/history?type=chart" % sym.lower()))["data"]
    except Exception:
        return None
    pts = [(datetime.datetime.utcfromtimestamp(t / 1000).date(), c) for t, c in d if c]
    if not pts: return None
    cut = pts[-1][0] - datetime.timedelta(days=400)
    out, lastwk = [], None
    for dt, c in pts:
        wk = dt.isocalendar()[:2]
        if dt >= cut or wk != lastwk:
            out.append([dt.isoformat(), round(c, 3)])
        elif out:
            out[-1] = [dt.isoformat(), round(c, 3)]   # keep the last close of each older week
        lastwk = wk
    return out

def load(path):
    try: return json.load(open(path))
    except Exception: return {}

def main():
    tickers = [t.upper() for t in sys.argv[1:]]
    if not tickers:
        rows = list(csv.DictReader(io.StringIO(get(CSV))))
        tickers = [r["Symbol"].strip().upper() for r in rows if r.get("Symbol", "").strip()]
    old = load(OUT).get("funds", {})
    os.makedirs(DET, exist_ok=True)
    funds = {}
    for t in tickers:
        prev = old.get(t, {})
        dpath = os.path.join(DET, t + ".json")
        det = load(dpath)
        try:
            h = get("https://stockanalysis.com/etf/%s/" % t.lower())
            it = info_table(h)
            cur = {
                "aum": field(h, "aum"), "expense": field(h, "expenseRatio"),
                "yield": field(h, "dividendYield"), "holdings": field(h, "holdings", True),
                "inception": field(h, "inception"), "freq": field(h, "payoutFrequency"),
                "exchange": field(h, "exchange"), "price": num(h, "pd"), "asof": field(h, "td"),
                "chg": num(h, "cp"), "ytd": num(h, "trYTD"), "y1": num(h, "tr1y"), "m1": num(h, "tr1m"),
                "pYTD": num(h, "priceYTD"), "p1y": num(h, "price1y"), "pMAX": num(h, "priceMAX"),
                "h52": num(h, "h52"), "l52": num(h, "l52"), "vol": num(h, "v"), "beta": num(h, "beta"),
                "pe": num(h, "peRatio"), "shares": field(h, "sharesOut"), "dps": field(h, "dps"),
                "exdiv": field(h, "exDivDate"), "top10": num(h, "top10"), "site": field(h, "etf_website"),
                "index": it.get("Index Tracked"), "asset": it.get("Asset Class"), "issuer": field(h, "provider"),
            }
            if not cur["aum"] and not cur["expense"]: raise ValueError("no data")
            funds[t] = {k: (v if v is not None else prev.get(k)) for k, v in cur.items()}
            funds[t] = {k: v for k, v in funds[t].items() if v is not None}
            m = re.search(r'dividendTable:\[(.*?)\]', h)
            divs = [[d, float(a)] for d, a in re.findall(r'\{dt:"([^"]+)",amt:(-?\.?[\d.]+)', m.group(1))] if m else []
            time.sleep(1.0)
            hd = holdings(t); time.sleep(1.0)
            hs = history(t)
            det = {"symbol": t, "updated": datetime.date.today().isoformat(),
                   "holdings": hd or det.get("holdings", []), "hupdated": field(h, "updated") or det.get("hupdated"),
                   "divs": divs or det.get("divs", []), "hist": hs or det.get("hist", [])}
            json.dump(det, open(dpath, "w"), separators=(",", ":"))
        except Exception as e:
            print("keep", t, e, file=sys.stderr)
            if prev: funds[t] = prev
        time.sleep(1.0)
    if len(funds) < max(3, len(tickers) // 2):
        print("too few results, not writing", file=sys.stderr); sys.exit(0)
    if sys.argv[1:]:
        merged = dict(old); merged.update(funds); funds = merged
    json.dump({"updated": datetime.date.today().isoformat(), "funds": funds}, open(OUT, "w"), indent=1, sort_keys=True)
    print("wrote", len(funds))

if __name__ == "__main__":
    main()
