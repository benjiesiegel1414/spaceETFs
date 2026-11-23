#!/usr/bin/env python3
"""Build one static page per fund (TICKER.html, served at topspaceetfs.com/TICKER) from
data/funds.json, data/etf/*.json and the fund sheet. Run after update_funds.py."""
import csv, io, json, re, os, glob, html, math, datetime, urllib.request

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
CSV = "https://docs.google.com/spreadsheets/d/e/2PACX-1vSrmLZYgKhMuwExsTbxDBBrN0aTAj0KIlFH5kPeZblp_7FXO7AGfgwilgbt3qCKF9XIir_QTNeYRpqy/pub?gid=0&single=true&output=csv"
SITE = "https://topspaceetfs.com"
POSTS = {"SPCX": "spacex", "RKLB": "rocket-lab", "ASTS": "ast-spacemobile", "LUNR": "intuitive-machines", "KTOS": "kratos",
         "MDA": "mda-space", "BKSY": "blacksky", "VOYG": "voyager-technologies", "GSAT": "globalstar", "IRDM": "iridium",
         "ECHO": "echostar", "SATS": "echostar", "VSAT": "viasat", "RDW": "redwire", "PL": "planet-labs", "FLY": "firefly-aerospace"}
E = html.escape

def cat(n):
    if re.search(r"\b2x\b|short|leverag|daily target|daily 2x", n, re.I): return "Leveraged & Inverse"
    if re.search(r"income|enhanced", n, re.I): return "Income"
    if re.search(r"aerospace|defense|drone|warfare", n, re.I) and not re.search(r"\bspace\b", n, re.I): return "Aerospace & Defense"
    return "Space"

def aumn(s):
    m = re.match(r"\$?([\d.]+)\s*([BMK])", s or "")
    return float(m.group(1)) * {"B": 1e9, "M": 1e6, "K": 1e3}[m.group(2)] if m else 0

def aumf(s):
    m = re.match(r"\$?([\d.]+)\s*([BMK])", s or "")
    if not m: return s or "n/a"
    n, u = float(m.group(1)), m.group(2)
    if u == "B": return "$%.2fB" % n if n < 10 else "$%.1fB" % n
    if u == "M": return "$%d M" % round(n) if False else ("$%dM" % round(n) if n >= 10 else "$%.1fM" % n)
    return "$%dK" % round(n)

def pct(v, d=1):
    return "n/a" if v is None else ("+" if v >= 0 else "") + ("%.*f" % (d, v)) + "%"

def pill(v, d=1):
    if v is None: return '<span class="fl">n/a</span>'
    return '<span class="pill %s">%s</span>' % ("up" if v >= 0 else "dn", pct(v, d))

def cls(v): return "fl" if v is None else ("up" if v >= 0 else "dn")
def money(v): return "$" + format(round(v), ",")
def dfmt(d): return d.strftime("%b %-d, %Y")

def ord_(n): return "%d%s" % (n, "th" if 10 <= n % 100 <= 20 else {1: "st", 2: "nd", 3: "rd"}.get(n % 10, "th"))

def load_rows():
    try:
        txt = urllib.request.urlopen(urllib.request.Request(CSV, headers={"User-Agent": "Mozilla/5.0"}), timeout=30).read().decode()
        rows = [r for r in csv.DictReader(io.StringIO(txt)) if r.get("Symbol", "").strip()]
        json.dump([{k: r.get(k, "") for k in ("Symbol", "Name", "Fund Provider")} for r in rows], open(os.path.join(ROOT, "data", "names.json"), "w"))
        return rows
    except Exception:
        return json.load(open(os.path.join(ROOT, "data", "names.json")))

def analytics(hist, today):
    """hist: [[iso, close]] oldest first"""
    pts = [(datetime.date.fromisoformat(d), c) for d, c in hist]
    last_d, last = pts[-1]
    anchor = datetime.date.fromisoformat(today) if today else last_d
    def at(target):
        prev = None
        for d, c in pts:
            if d > target: break
            prev = c
        return prev
    out = {"last": last, "last_d": last_d, "first": pts[0][1], "first_d": pts[0][0]}
    per = {}
    for k, days in (("1W", 7), ("1M", 30), ("3M", 91), ("6M", 182), ("1Y", 365), ("3Y", 1096), ("5Y", 1826)):
        t = anchor - datetime.timedelta(days=days)
        if t >= pts[0][0]:
            b = at(t); per[k] = (last / b - 1) * 100 if b else None
        else: per[k] = None
    b = at(datetime.date(last_d.year - 1, 12, 31))
    per["YTD"] = (last / b - 1) * 100 if b and pts[0][0] <= datetime.date(last_d.year - 1, 12, 31) else None
    per["MAX"] = (last / pts[0][1] - 1) * 100
    out["per"] = per
    yrs = (last_d - pts[0][0]).days / 365.25
    out["yrs"] = yrs
    out["cagr"] = ((last / pts[0][1]) ** (1 / yrs) - 1) * 100 if yrs >= 1 else None
    daily = [(d, c) for d, c in pts if d >= last_d - datetime.timedelta(days=365)]
    rets = [(daily[i][0], daily[i][1] / daily[i - 1][1] - 1) for i in range(1, len(daily)) if (daily[i][0] - daily[i - 1][0]).days <= 5]
    if len(rets) >= 20:
        mu = sum(r for _, r in rets) / len(rets)
        sd = math.sqrt(sum((r - mu) ** 2 for _, r in rets) / len(rets))
        out["vol"] = sd * math.sqrt(252) * 100
        out["best"] = max(rets, key=lambda x: x[1]); out["worst"] = min(rets, key=lambda x: x[1])
        out["updays"] = sum(1 for _, r in rets if r > 0) / len(rets) * 100
        out["big"] = sum(1 for _, r in rets if abs(r) >= 0.03); out["ndays"] = len(rets)
    peak, mdd, mdd_d, peak_d, ath, ath_d = pts[0][1], 0, None, pts[0][0], pts[0][1], pts[0][0]
    for d, c in pts:
        if c > peak: peak, peak_d = c, d
        dd = c / peak - 1
        if dd < mdd: mdd, mdd_d, out["mdd_from"] = dd, d, peak_d
    out["mdd"] = mdd * 100; out["mdd_d"] = mdd_d
    out["ath"] = max(pts, key=lambda x: x[1]); out["atl"] = min(pts, key=lambda x: x[1])
    out["from_ath"] = (last / out["ath"][1] - 1) * 100
    cal = {}
    for d, c in pts: cal.setdefault(d.year, [None, None]); cal[d.year][1] = c
    years = sorted(cal); prevc = None; cy = []
    for y in years:
        endc = cal[y][1]
        if prevc: cy.append((y, (endc / prevc - 1) * 100))
        prevc = endc
    out["cal"] = cy[-6:]
    return out

def main():
    F = json.load(open(os.path.join(ROOT, "data", "funds.json")))
    updated = F.get("updated"); F = F["funds"]
    rows = load_rows()
    funds = []
    for r in rows:
        t = r["Symbol"].strip().upper()
        if t not in F: continue
        dp = os.path.join(ROOT, "data", "etf", t + ".json")
        if not os.path.exists(dp): continue
        det = json.load(open(dp))
        if len(det.get("hist", [])) < 3: continue
        f = dict(F[t]); f.update(t=t, name=r["Name"].strip(), prov=r["Fund Provider"].strip(), det=det)
        f["cat"] = cat(f["name"]); f["aumn"] = aumn(f.get("aum")); f["aumf"] = aumf(f.get("aum"))
        f["exp"] = float(f["expense"].rstrip("%")) if f.get("expense") else None
        f["yld"] = float(f["yield"].rstrip("%")) if f.get("yield") else 0.0
        f["inc"] = datetime.date.fromisoformat(f["inception"]) if f.get("inception") else None
        f["a"] = analytics(det["hist"], updated)
        if f.get("pMAX"):
            f["a"]["per"]["MAX"] = (f["a"]["last"] / f["pMAX"] - 1) * 100
            if f["a"].get("cagr") is not None: f["a"]["cagr"] = ((f["a"]["last"] / f["pMAX"]) ** (1 / f["a"]["yrs"]) - 1) * 100
        for h in det.get("holdings", []):
            s0 = h.get("s", "")
            if s0[:1] in "@!$": s0 = re.split(r"[-/]", s0)[-1]
            h["s"] = s0 if re.match(r"^[A-Z][A-Z.]{0,5}$", s0) and not (cat(f["name"]) == "Leveraged & Inverse") else ""
        f["hw"] = {h["s"]: h["w"] for h in det.get("holdings", []) if h["s"]}
        funds.append(f)
    funds.sort(key=lambda f: -f["aumn"])
    N = len(funds); bysym = {f["t"]: f for f in funds}
    def rank(key, rev=True, pool=None):
        pool = [f for f in (pool or funds) if key(f) is not None]
        s = sorted(pool, key=key, reverse=rev)
        return {f["t"]: (i + 1, len(s)) for i, f in enumerate(s)}
    R = {"aum": rank(lambda f: f["aumn"]), "fee": rank(lambda f: f["exp"], False), "y1": rank(lambda f: f.get("y1")),
         "ytd": rank(lambda f: f["a"]["per"].get("YTD") if f.get("ytd") is None else f["ytd"]), "yld": rank(lambda f: f["yld"] or None),
         "hold": rank(lambda f: f.get("holdings")), "vol": rank(lambda f: f["a"].get("vol"), False), "m1": rank(lambda f: f["a"]["per"].get("1M"))}
    # articles that mention each ticker
    arts = {}
    for p in glob.glob(os.path.join(ROOT, "*.html")):
        slug = os.path.basename(p)[:-5]
        if slug in bysym or slug in ("index", "blog", "etf", "legal", "privacy-policy", "terms-of-use", "advertise", "404"): continue
        s = open(p, errors="ignore").read()
        if "article-content" not in s: continue
        m = re.search(r"<title>([^<]+)", s); title = html.unescape(m.group(1)).split(" | ")[0].split(" — ")[0].strip() if m else slug
        for t in bysym:
            c = len(re.findall(r"\$" + t + r"\b", s))
            if c: arts.setdefault(t, []).append((c, slug, title))
    tpl = open(os.path.join(ROOT, "scripts", "etf_template.html")).read()
    made = []
    for i, f in enumerate(funds):
        t, a, det = f["t"], f["a"], f["det"]; per = a["per"]
        ytd = f.get("ytd") if f.get("ytd") is not None else per.get("YTD")
        if ytd is None and f["inc"] and f["inc"].year == a["last_d"].year: ytd = per["MAX"]
        y1 = f.get("y1") if f.get("y1") is not None else per.get("1Y")
        peers = [g for g in funds if g["cat"] == f["cat"]]
        cavg = lambda key: (lambda v: sum(v) / len(v) if v else None)([key(g) for g in peers if key(g) is not None])
        is_lev = f["cat"] == "Leveraged & Inverse"
        an = "an" if f["cat"][0] in "AI" else "a"
        kind = {"Space": "space ETF", "Aerospace & Defense": "aerospace and defense ETF", "Leveraged & Inverse": "leveraged or inverse ETF", "Income": "options income ETF"}[f["cat"]]
        # ---------- overview text
        hold = det.get("holdings", [])
        top = hold[0] if hold else None
        spx = f["hw"].get("SPCX")
        desc = "%s ($%s) is %s %s from %s that started trading on %s." % (E(f["name"]), t, an, kind, E(f["prov"]), dfmt(f["inc"]))
        if f.get("index"): desc += " It tracks the %s." % E(f["index"])
        desc += " It holds %s positions, has %s in assets and charges %.2f%% a year, which works out to about $%d on every $10,000 invested." % (f.get("holdings", "n/a"), f["aumf"], f["exp"], round(f["exp"] * 100))
        p2 = ""
        if top and not is_lev: p2 = "Its largest position is %s at %.2f%% of the fund, and the top 10 holdings make up %s of assets." % (E(top["n"]), top["w"], ("%.1f%%" % f["top10"]) if f.get("top10") else "most")
        if spx and not is_lev: p2 += " SpaceX ($SPCX) is %.2f%% of the portfolio." % spx
        if is_lev: p2 = "This fund resets every day. It is built for short term trading, and over longer periods its return can be very different from a simple multiple of the stock or basket it follows. See <a href=\"/leveraged-spacex-etfs-spch-spax-spal-spcu\">how daily leveraged funds work</a>."
        p3 = "$%s ranks %s of %d funds we track by assets and %s by lowest fee." % (t, ord_(R["aum"][t][0]), N, ord_(R["fee"][t][0]))
        if t in R["y1"]: p3 += " Over the past year it ranks %s of %d by total return." % (ord_(R["y1"][t][0]), R["y1"][t][1])
        # ---------- key stats
        def kv(k, v): return "<div><span>%s</span><b>%s</b></div>" % (k, v)
        rng52 = "$%.2f - $%.2f" % (f["l52"], f["h52"]) if f.get("l52") and f.get("h52") else "n/a"
        stats = "".join([
            kv("Assets (AUM)", f["aumf"]), kv("Expense ratio", "%.2f%%" % f["exp"]),
            kv("Dividend yield", ("%.2f%%" % f["yld"]) if f["yld"] else "None"), kv("Payout frequency", f.get("freq") or "None"),
            kv("Holdings", f.get("holdings", "n/a")), kv("Top 10 weight", ("%.1f%%" % f["top10"]) if f.get("top10") else "n/a"),
            kv("Inception", dfmt(f["inc"])), kv("Fund age", "%.1f years" % a["yrs"]),
            kv("52 week range", rng52), kv("From all time high", '<span class="%s">%s</span>' % (cls(a["from_ath"]), pct(a["from_ath"]))),
            kv("Shares outstanding", f.get("shares", "n/a")), kv("Volume (last session)", format(int(f["vol"]), ",") if f.get("vol") else "n/a"),
            kv("Beta", ("%.2f" % f["beta"]) if f.get("beta") else "n/a"), kv("P/E ratio", ("%.1f" % f["pe"]) if f.get("pe") else "n/a"),
            kv("Exchange", {"BATS": "Cboe BZX", "NYSEARCA": "NYSE Arca", "NASDAQ": "Nasdaq"}.get(f.get("exchange"), f.get("exchange", "n/a"))),
            kv("Issuer", '<a href="/?q=%s#rankings">%s</a>' % (E(f["prov"]).replace(" ", "+"), E(f["prov"]))),
            kv("Index tracked", E(f["index"]) if f.get("index") else "n/a"), kv("Fund type", '<a href="/?cat=%s#rankings">%s</a>' % (E(f["cat"]).replace(" ", "%20").replace("&amp;", "%26"), E(f["cat"]))),
        ])
        # ---------- performance
        per = dict(per)
        if f.get("ytd") is not None: per["YTD"] = f["ytd"]
        if f.get("y1") is not None: per["1Y"] = f["y1"]
        labels = [("1W", "1 week"), ("1M", "1 month"), ("3M", "3 months"), ("6M", "6 months"), ("YTD", "Year to date"), ("1Y", "1 year"), ("3Y", "3 years"), ("5Y", "5 years"), ("MAX", "Since inception")]
        prow = "".join("<tr><td class=\"n\">%s</td><td>%s</td><td>%s</td></tr>" % (lab, pill(per.get(k)), ("$%s" % format(round(10000 * (1 + per[k] / 100)), ",")) if per.get(k) is not None else "n/a") for k, lab in labels)
        calrow = "".join("<tr><td class=\"n\">%d%s</td><td>%s</td></tr>" % (y, " (so far)" if y == a["last_d"].year else "", pill(v)) for y, v in reversed(a["cal"]))
        tiles = "".join('<div><b class="%s">%s</b><span>%s</span><small>%s</small></div>' % x for x in [
            (cls(ytd), pct(ytd), "Since launch" if (f["inc"].year == a["last_d"].year) else "Year to date", "Rank %s of %d" % R["ytd"][t] if t in R["ytd"] else ""),
            (cls(y1), pct(y1) if y1 is not None else "New", "1 year", ("Rank %s of %d" % R["y1"][t]) if t in R["y1"] else "Under 1 year old"),
            (cls(per["MAX"]), pct(per["MAX"]), "Since inception", ("%s a year" % pct(a["cagr"])) if a.get("cagr") is not None else "From first close"),
            ("", money(10000 * (1 + per["MAX"] / 100)), "$10,000 at launch", "Worth today, price only")])
        # ---------- risk
        risk = ""
        if a.get("vol") is not None:
            risk = "".join([kv("Volatility (1 year, annualized)", "%.1f%%" % a["vol"]), kv("Volatility rank (1 = calmest)", "%d of %d" % R["vol"][t]),
                kv("Max drawdown", '<span class="dn">%s</span>' % pct(a["mdd"])), kv("Drawdown low date", dfmt(a["mdd_d"]) if a.get("mdd_d") else "n/a"),
                kv("Best day (1 year)", '<span class="up">%s</span> on %s' % (pct(a["best"][1] * 100, 2), a["best"][0].strftime("%b %-d"))),
                kv("Worst day (1 year)", '<span class="dn">%s</span> on %s' % (pct(a["worst"][1] * 100, 2), a["worst"][0].strftime("%b %-d"))),
                kv("Up days", "%.0f%% of %d sessions" % (a["updays"], a["ndays"])), kv("Days moving 3% or more", str(a["big"])),
                kv("All time high close", "$%.2f on %s" % (a["ath"][1], dfmt(a["ath"][0]))), kv("All time low close", "$%.2f on %s" % (a["atl"][1], dfmt(a["atl"][0])))])
        # ---------- holdings
        mx = max([h["w"] for h in hold] or [1])
        def hname(h):
            if h["s"] in POSTS: return '<a href="/etfs-that-hold-%s" title="ETFs that hold %s">%s</a>' % (POSTS[h["s"]], E(h["n"]), E(h["n"]))
            return E(h["n"])
        def others(sym):
            o = sorted([(g["hw"][sym], g["t"]) for g in funds if g["t"] != t and sym in g["hw"] and g["cat"] != "Leveraged & Inverse"], reverse=True)[:4]
            return " ".join('<a href="/%s">%s</a>' % (x, x) for _, x in o) or '<span class="fl">none</span>'
        hrows = "".join('<tr><td>%d</td><td class="n">%s</td><td>%s</td><td><span class="bar" style="width:%dpx"></span>%.2f%%</td><td class="n">%s</td></tr>' % (j + 1, hname(h), E(h["s"]) or "", max(2, round(70 * h["w"] / mx)), h["w"], others(h["s"]) if h["s"] else "") for j, h in enumerate(hold[:15]))
        # ---------- overlap
        ov = []
        for g in funds:
            if g["t"] == t or not g["hw"] or not f["hw"]: continue
            shared = [s for s in f["hw"] if s in g["hw"] and s]
            w = sum(min(f["hw"][s], g["hw"][s]) for s in shared)
            if shared: ov.append((w, len(shared), g))
        ov.sort(key=lambda x: -x[0])
        ovrows = "".join('<tr><td><a href="/%s">%s</a></td><td class="n">%s</td><td>%d</td><td><span class="bar" style="width:%dpx"></span>%.1f%%</td><td>%.2f%%</td><td>%s</td></tr>' % (g["t"], g["t"], E(g["name"]), n, max(2, round(70 * w / max(ov[0][0], 1))), w, g["exp"], pill(g.get("y1") if g.get("y1") is not None else g["a"]["per"]["MAX"])) for w, n, g in ov[:8])
        # ---------- peers
        ps = sorted(peers, key=lambda g: -g["aumn"]); idx = ps.index(f)
        show = ps[:8] if idx < 8 else ps[:7] + [f]
        prows = "".join('<tr%s><td><a href="/%s">%s</a></td><td class="n">%s</td><td>$%.2f</td><td>%s</td><td>%s</td><td>%.2f%%</td><td>%s</td><td>%s</td></tr>' % (' class="me"' if g is f else "", g["t"], g["t"], E(g["name"]), g["a"]["last"], pill(g.get("ytd") if g.get("ytd") is not None else (g["a"]["per"]["YTD"] if g["a"]["per"]["YTD"] is not None else g["a"]["per"]["MAX"])), pill(g.get("y1")) if g.get("y1") is not None else '<span class="fl">New</span>', g["exp"], g["aumf"], g.get("holdings", "")) for g in show)
        avg_fee = cavg(lambda g: g["exp"]); 
        # ---------- dividends
        dv = det.get("divs", [])
        if dv:
            drows = "".join("<tr><td class=\"n\">%s</td><td>$%.4f</td></tr>" % (dfmt(datetime.date.fromisoformat(d)), amt) for d, amt in dv[:10])
            last12 = sum(amt for d, amt in dv if datetime.date.fromisoformat(d) > a["last_d"] - datetime.timedelta(days=365))
            divhtml = '<div class="kv">%s</div><div class="scroll"><table class="t"><thead><tr><th class="n">Ex-dividend date</th><th>Amount per share</th></tr></thead><tbody>%s</tbody></table></div><p class="note">Paid over the last 12 months: $%.2f per share. On $10,000 invested that is about $%s a year at the current yield. Payouts are not guaranteed. See <a href="/do-space-etfs-pay-dividends">which space ETFs pay dividends</a>.</p>' % (
                kv("Dividend yield", "%.2f%%" % f["yld"] if f["yld"] else "n/a") + kv("Frequency", f.get("freq") or "Irregular") + kv("Last ex-dividend date", f.get("exdiv", "n/a")) + kv("Yield rank", ("%d of %d payers" % R["yld"][t]) if t in R["yld"] else "n/a"), drows, last12, format(round(100 * f["yld"]), ","))
        else:
            divhtml = '<div class="pad"><p>$%s has not paid a dividend. Most space funds pay little or nothing because the companies they hold are still investing in growth. See <a href="/do-space-etfs-pay-dividends">every space ETF that pays a dividend</a>.</p></div>' % t
        # ---------- cost
        def cost(e, yrs):
            v = 10000.0
            for _ in range(yrs): v = v * 1.07 * (1 - e / 100)
            return 10000 * 1.07 ** yrs - v
        costhtml = '<div class="kv">%s</div><p class="note">Hypothetical: $10,000 growing 7%% a year before fees. The %s average fee among funds we track is %.2f%%. Compare every fund in <a href="/space-etf-expense-ratios-compared">Space ETF Fees Compared</a>.</p>' % (
            kv("Cost per $10,000 a year", "$%d" % round(f["exp"] * 100)) + kv("Fee rank (1 = cheapest)", "%d of %d" % R["fee"][t]) + kv("Fees over 10 years", money(cost(f["exp"], 10))) + kv("Fees over 20 years", money(cost(f["exp"], 20))) + kv("vs. %s average" % E(f["cat"]), '<span class="%s">%s pts</span>' % ("up" if f["exp"] <= avg_fee else "dn", ("%+.2f" % (f["exp"] - avg_fee)))) + kv("Same fee tier", " ".join('<a href="/%s">%s</a>' % (g["t"], g["t"]) for g in funds if g is not f and abs(g["exp"] - f["exp"]) < 0.006)[:400] or "none"),
            E(f["cat"]).lower(), avg_fee)
        # ---------- side rail
        ranks = "".join('<a class="rank" href="%s"><i>#%d / %d</i><span>%s</span><b>%s</b></a>' % x for x in [
            ("/#rankings", R["aum"][t][0], N, "Assets", f["aumf"]),
            ("/space-etf-expense-ratios-compared", R["fee"][t][0], N, "Lowest fee", "%.2f%%" % f["exp"])] +
            ([("/best-performing-space-etfs-2026", R["y1"][t][0], R["y1"][t][1], "1 year return", pct(f["y1"]))] if t in R["y1"] else []) +
            ([("/best-performing-space-etfs-2026", R["m1"][t][0], R["m1"][t][1], "1 month return", pct(per["1M"]))] if t in R["m1"] else []) +
            ([("/do-space-etfs-pay-dividends", R["yld"][t][0], R["yld"][t][1], "Dividend yield", "%.2f%%" % f["yld"])] if t in R["yld"] else []) +
            ([("/#rankings", R["hold"][t][0], R["hold"][t][1], "Most holdings", str(f["holdings"]))] if t in R["hold"] else []))
        same = [g for g in funds if g["prov"] == f["prov"] and g is not f]
        issuer = "".join('<a href="/%s"><b>%s</b><span>%s</span><em>%s</em></a>' % (g["t"], g["t"], E(g["name"]), g["aumf"]) for g in same)
        al = sorted(arts.get(t, []), reverse=True)[:6]
        artshtml = "".join('<a href="/%s"><img src="/covers/%s.jpg" alt="" loading="lazy" onerror="this.style.visibility=\'hidden\'"><span>%s</span></a>' % (s, s, E(ti)) for _, s, ti in al)
        allchips = "".join('<a href="/%s">%s</a>' % (g["t"], g["t"]) for g in funds if g is not f)
        prev, nxt = funds[i - 1], funds[(i + 1) % N]
        faqs = [("What is the expense ratio of %s?" % t, "%s charges %.2f%% a year, or about $%d for every $10,000 invested. That ranks %s of %d funds tracked on TopSpaceETFs.com from cheapest to most expensive." % (t, f["exp"], round(f["exp"] * 100), ord_(R["fee"][t][0]), N)),
                ("Does %s pay a dividend?" % t, ("Yes. %s has a trailing dividend yield of %.2f%% and pays %s. Its most recent ex-dividend date was %s." % (t, f["yld"], (f.get("freq") or "on an irregular schedule").lower(), f.get("exdiv", "not listed"))) if f["yld"] else "%s has not paid a dividend in the past 12 months." % t),
                ("How many holdings does %s have?" % t, "%s holds %s positions.%s" % (t, f.get("holdings", "n/a"), (" The largest is %s at %.2f%% of the fund." % (top["n"], top["w"])) if top and not is_lev else "")),
                ("When did %s launch?" % t, "%s started trading on %s, which makes the fund %.1f years old. It is issued by %s." % (t, dfmt(f["inc"]), a["yrs"], f["prov"]))]
        if not is_lev: faqs.append(("Does %s hold SpaceX?" % t, ("Yes. SpaceX (SPCX) is %.2f%% of %s based on the latest holdings data." % (spx, t)) if spx else "SpaceX (SPCX) does not appear among the top 25 holdings of %s in the latest holdings data." % t))
        if ov: faqs.append(("What ETFs are similar to %s?" % t, "Based on overlap in top holdings, the closest funds we track are %s." % ", ".join("%s (%.0f%% overlap by weight)" % (g["t"], w) for w, n, g in ov[:3])))
        faqhtml = "".join("<details%s><summary>%s</summary><p>%s</p></details>" % (" open" if j == 0 else "", E(q), E(ans)) for j, (q, ans) in enumerate(faqs))
        ld = {"@context": "https://schema.org", "@graph": [
            {"@type": "BreadcrumbList", "itemListElement": [{"@type": "ListItem", "position": 1, "name": "Space ETF Rankings", "item": SITE + "/"}, {"@type": "ListItem", "position": 2, "name": t, "item": "%s/%s" % (SITE, t)}]},
            {"@type": "FAQPage", "mainEntity": [{"@type": "Question", "name": q, "acceptedAnswer": {"@type": "Answer", "text": ans}} for q, ans in faqs]}]}
        title = "%s ETF: Price, Holdings, Returns & Fees | %s" % (t, f["name"])
        mdesc = "%s (%s) price, top holdings, returns, expense ratio (%.2f%%), dividends, risk stats and similar space ETFs. %s in assets, %s holdings." % (f["name"], t, f["exp"], f["aumf"], f.get("holdings", "n/a"))
        V = {"T": t, "NAME": E(f["name"]), "TITLE": E(title), "MDESC": E(mdesc), "CAT": E(f["cat"]), "CATQ": E(f["cat"]).replace(" ", "%20").replace("&amp;", "%26"),
             "PROV": E(f["prov"]), "PROVQ": E(f["prov"]).replace(" ", "+"), "EXCH": {"BATS": "Cboe BZX", "NYSEARCA": "NYSE Arca", "NASDAQ": "Nasdaq"}.get(f.get("exchange"), f.get("exchange", "")),
             "PRICE": "%.2f" % a["last"], "CHG": pct(f.get("chg"), 2) if f.get("chg") is not None else "", "CHGC": cls(f.get("chg")), "ASOF": dfmt(a["last_d"]),
             "DESC": desc, "P2": p2, "P3": p3, "STATS": stats, "TILES": tiles, "PROW": prow, "CALROW": calrow, "RISK": risk, "HROWS": hrows,
             "HUPD": E(det.get("hupdated") or ""), "HCOUNT": str(f.get("holdings", "")), "OVROWS": ovrows, "PROWS": prows, "DIV": divhtml, "COST": costhtml,
             "RANKS": ranks, "ISSUER": issuer, "ARTS": artshtml, "CHIPS": allchips, "FAQ": faqhtml, "LD": json.dumps(ld),
             "SITEURL": E(f.get("site") or ""), "PREV": prev["t"], "PREVN": E(prev["name"]), "NEXT": nxt["t"], "NEXTN": E(nxt["name"]),
             "UPDATED": dfmt(datetime.date.fromisoformat(updated)) if updated else ""}
        out = re.sub(r"\{\{(\w+)\}\}", lambda m: V.get(m.group(1), ""), tpl)
        for blk, on in (("ISSUERBLOCK", bool(same)), ("ARTSBLOCK", bool(al)), ("RISKBLOCK", bool(risk)), ("OVBLOCK", bool(ovrows)), ("HOLDBLOCK", bool(hrows)), ("SITEBLOCK", bool(f.get("site"))), ("CALBLOCK", bool(calrow))):
            out = re.sub(r"<!--%s-->(.*?)<!--/%s-->" % (blk, blk), (lambda m: m.group(1)) if on else "", out, flags=re.S)
        open(os.path.join(ROOT, t + ".html"), "w").write(out); made.append(t)
    # sitemap
    sp = os.path.join(ROOT, "sitemap.xml"); sm = open(sp).read()
    sm = re.sub(r"\n  <!-- Fund Pages -->.*?<!-- /Fund Pages -->\n", "\n", sm, flags=re.S)
    block = "\n  <!-- Fund Pages -->\n" + "".join("  <url>\n    <loc>%s/%s</loc>\n    <lastmod>%s</lastmod>\n    <changefreq>daily</changefreq>\n    <priority>0.8</priority>\n  </url>\n" % (SITE, t, updated) for t in made) + "  <!-- /Fund Pages -->\n"
    sm = sm.replace("</urlset>", block + "</urlset>") if "<!-- Fund Pages -->" not in sm else sm
    open(sp, "w").write(sm)
    print("built", len(made))

if __name__ == "__main__":
    main()
