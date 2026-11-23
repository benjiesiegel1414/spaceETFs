#!/usr/bin/env python3
"""Refresh data/funds.json (AUM, yield, expense ratio, holdings, inception) for every
fund in the TopSpaceETFs sheet. Keeps the previous value when a lookup fails."""
import csv, io, json, re, sys, time, urllib.request, datetime, os

CSV = "https://docs.google.com/spreadsheets/d/e/2PACX-1vSrmLZYgKhMuwExsTbxDBBrN0aTAj0KIlFH5kPeZblp_7FXO7AGfgwilgbt3qCKF9XIir_QTNeYRpqy/pub?gid=0&single=true&output=csv"
UA = {"User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36"}
OUT = os.path.join(os.path.dirname(__file__), "..", "data", "funds.json")

def get(url):
    return urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=30).read().decode("utf-8", "ignore")

def field(html, key, num=False):
    m = re.search(r'[,{]%s:("([^"]*)"|(-?\.?[\d.]+))' % re.escape(key), html)
    if not m: return None
    v = m.group(2) if m.group(2) is not None else m.group(3)
    if v in ("", "n/a", "-"): return None
    return int(float(v)) if num else v

def num(html, key):
    v = field(html, key)
    try: return round(float(v), 4)
    except Exception: return None

def main():
    tickers = sys.argv[1:]
    if not tickers:
        rows = list(csv.DictReader(io.StringIO(get(CSV))))
        tickers = [r["Symbol"].strip().upper() for r in rows if r.get("Symbol", "").strip()]
    try: old = json.load(open(OUT)).get("funds", {})
    except Exception: old = {}
    funds = {}
    for t in tickers:
        prev = old.get(t, {})
        try:
            h = get("https://stockanalysis.com/etf/%s/" % t.lower())
            cur = {
                "aum": field(h, "aum"), "expense": field(h, "expenseRatio"),
                "yield": field(h, "dividendYield"), "holdings": field(h, "holdings", True),
                "inception": field(h, "inception"), "freq": field(h, "payoutFrequency"),
                "exchange": field(h, "exchange"), "price": num(h, "pd"), "asof": field(h, "td"),
                "ytd": num(h, "trYTD"), "y1": num(h, "tr1y"),
                "pYTD": num(h, "priceYTD"), "p1y": num(h, "price1y"), "pMAX": num(h, "priceMAX"),
            }
            if not cur["aum"] and not cur["expense"]: raise ValueError("no data")
            funds[t] = {k: (v if v is not None else prev.get(k)) for k, v in cur.items()}
            funds[t] = {k: v for k, v in funds[t].items() if v is not None}
        except Exception as e:
            print("keep", t, e, file=sys.stderr)
            if prev: funds[t] = prev
        time.sleep(1.2)
    if len(funds) < max(3, len(tickers) // 2):
        print("too few results, not writing", file=sys.stderr); sys.exit(0)
    json.dump({"updated": datetime.date.today().isoformat(), "funds": funds}, open(OUT, "w"), indent=1, sort_keys=True)
    print("wrote", len(funds))

if __name__ == "__main__":
    main()
