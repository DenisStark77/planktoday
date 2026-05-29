"""
Build a static prototype (leaderboard + profile pages) from tools/backfill_data.json.
First-name-only display. Output -> prototype/ (gitignored, unlisted).

Run: python3 tools/build_prototype.py   then open prototype/index.html
"""
import json
import re
import os
import datetime
import html

DATA = "tools/backfill_data.json"
OUT = "prototype"
TODAY = datetime.date(2026, 5, 28)
PUBLIC_BASE = "https://plank.today"  # intended public URL (for share text/links)

TRANSLIT = {
    'а': 'a', 'б': 'b', 'в': 'v', 'г': 'g', 'д': 'd', 'е': 'e', 'ё': 'e',
    'ж': 'zh', 'з': 'z', 'и': 'i', 'й': 'y', 'к': 'k', 'л': 'l', 'м': 'm',
    'н': 'n', 'о': 'o', 'п': 'p', 'р': 'r', 'с': 's', 'т': 't', 'у': 'u',
    'ф': 'f', 'х': 'kh', 'ц': 'ts', 'ч': 'ch', 'ш': 'sh', 'щ': 'shch',
    'ъ': '', 'ы': 'y', 'ь': '', 'э': 'e', 'ю': 'yu', 'я': 'ya',
}


def translit(s):
    out = []
    for ch in s.lower():
        if ch in TRANSLIT:
            out.append(TRANSLIT[ch])
        elif ch.isalnum():
            out.append(ch)
        elif ch in ' -_':
            out.append('-')
    slug = re.sub(r'-+', '-', ''.join(out)).strip('-')
    return slug or 'user'


def first_name(name):
    cleaned = re.sub(r'[^\w\s]', ' ', str(name), flags=re.UNICODE)
    toks = cleaned.split()
    return toks[0] if toks else str(name)


def fmt(sec):
    sec = int(round(sec))
    return f"{sec // 60}:{sec % 60:02d}"


def longest_streak(dates):
    ds = sorted({datetime.date.fromisoformat(d) for d in dates})
    if not ds:
        return 0
    best = cur = 1
    for i in range(1, len(ds)):
        if (ds[i] - ds[i - 1]).days == 1:
            cur += 1
            best = max(best, cur)
        else:
            cur = 1
    return best


def comeback(series):
    best, prev = 0, None
    for d, s in series:
        dd = datetime.date.fromisoformat(d)
        if prev and (dd - prev).days >= 5:
            best = max(best, s)
        prev = dd
    return best


def comeback_count(series):
    """Number of returns after a long (>14 day) pause — resilience."""
    n, prev = 0, None
    for d, _ in series:
        dd = datetime.date.fromisoformat(d)
        if prev and (dd - prev).days > 14:
            n += 1
        prev = dd
    return n


PROJ_DAYS = 70  # forward horizon = one +1% doubling


def svg_chart(p, w=560, h=200, pad=28):
    series = p["series"]
    if len(series) < 2:
        return "<p class='muted'>Недостаточно данных для графика</p>"
    d0 = datetime.date.fromisoformat(series[0][0])
    pts = [((datetime.date.fromisoformat(d) - d0).days, s) for d, s in series]
    today_x = pts[-1][0]
    current = p["last_sec"]

    # Forward projection from TODAY only (not a backward ideal line).
    pstep = max(1, PROJ_DAYS // 40)
    proj = [(today_x + dd, current * (1.01 ** dd)) for dd in range(0, PROJ_DAYS + 1, pstep)]
    proj_end = current * (1.01 ** PROJ_DAYS)

    xmax = today_x + PROJ_DAYS
    actual_max = max(s for _, s in pts)
    ymax = max(actual_max, proj_end) * 1.06

    def X(x):
        return pad + (w - 2 * pad) * x / xmax

    def Y(y):
        return h - pad - (h - 2 * pad) * y / ymax

    # Actual data = dots only (no connecting line) so gaps read as real gaps.
    proj_path = " ".join(f"{X(x):.1f},{Y(y):.1f}" for x, y in proj)
    dots = "".join(f'<circle cx="{X(x):.1f}" cy="{Y(y):.1f}" r="2" fill="#f2f2f2"/>' for x, y in pts)
    tx = X(today_x)
    return f'''<svg viewBox="0 0 {w} {h}" class="chart" role="img" aria-label="Рост времени планки">
  <line x1="{tx:.1f}" y1="{pad-8}" x2="{tx:.1f}" y2="{h-pad}" stroke="#2a2a2a" stroke-width="1" stroke-dasharray="2 3"/>
  <polyline fill="none" stroke="#3ddc84" stroke-width="2" stroke-dasharray="5 4" points="{proj_path}"/>
  {dots}
  <circle cx="{tx:.1f}" cy="{Y(current):.1f}" r="3.4" fill="#3ddc84"/>
  <text x="{pad}" y="{h-6}" fill="#8a8a8a" font-size="11">день 0</text>
  <text x="{tx:.1f}" y="{h-6}" fill="#8a8a8a" font-size="11" text-anchor="middle">сегодня</text>
  <text x="{w-pad}" y="{h-6}" fill="#8a8a8a" font-size="11" text-anchor="end">+{PROJ_DAYS} дн.</text>
  <text x="{w-pad}" y="{Y(proj_end)-6:.1f}" fill="#3ddc84" font-size="12" text-anchor="end" font-weight="700">{fmt(proj_end)}</text>
  <text x="{pad-6}" y="{Y(ymax)+10:.0f}" fill="#8a8a8a" font-size="11">{fmt(ymax)}</text>
</svg>'''


PAGE_HEAD = '''<!DOCTYPE html>
<html lang="ru"><head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>{title}</title>
<meta name="description" content="{desc}"/>
<meta property="og:title" content="{title}"/>
<meta property="og:description" content="{desc}"/>
<meta property="og:type" content="website"/>
<style>{css}</style>
</head><body>'''

CSS = '''
:root{--bg:#0a0a0a;--fg:#f2f2f2;--muted:#9b9b9b;--line:#1f1f1f;--maxw:980px}
*,*::before,*::after{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--fg);font-family:Inter,system-ui,-apple-system,Segoe UI,Roboto,"Helvetica Neue",Arial,"Apple Color Emoji","Segoe UI Emoji";line-height:1.5;-webkit-font-smoothing:antialiased}
a{color:var(--fg)}
.container{max-width:var(--maxw);margin-inline:auto;padding:24px}
.brand{font-weight:800;letter-spacing:.04em}
.muted{color:var(--muted)}
.mono{font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace}
.card{border:1px solid var(--line);border-radius:18px;padding:20px;background:radial-gradient(80% 120% at 10% 0%,rgba(255,255,255,.03),rgba(255,255,255,0))}
.dot{display:inline-block;width:8px;height:8px;border-radius:999px;vertical-align:middle}
.dot.active{background:#3ddc84}.dot.paused{background:#6a6a6a}
.badge{display:inline-flex;gap:6px;align-items:center;border:1px solid var(--line);border-radius:999px;padding:5px 10px;font-size:13px;color:#cfcfcf}
/* profile */
.hero{display:grid;grid-template-columns:1fr;gap:20px;margin-top:8px}
@media(min-width:760px){.hero{grid-template-columns:1.1fr .9fr}}
.bignum{font-size:clamp(56px,12vw,104px);font-weight:900;line-height:1;letter-spacing:-.02em}
.statline{display:flex;flex-wrap:wrap;gap:18px;margin-top:14px}
.stat b{font-size:22px}
.chart{width:100%;height:auto;display:block}
.cta-row{display:flex;flex-wrap:wrap;gap:10px;margin-top:18px}
.btn{display:inline-flex;align-items:center;gap:8px;border:1px solid #f2f2f2;background:#f2f2f2;color:#0a0a0a;padding:11px 15px;border-radius:12px;font-weight:800;text-decoration:none;font-size:14px}
.btn.ghost{background:transparent;color:var(--fg);border-color:#2a2a2a}
/* share card (light) */
.sharecard{background:#faf7f0;color:#111;border-radius:16px;padding:26px 28px;max-width:520px;border:1px solid #e6e0d4}
.sharecard .num{font-size:64px;font-weight:900;line-height:1}
.sharecard .meta{color:#555;font-weight:700;margin-top:6px}
.sharecard .foot{margin-top:18px;font-weight:800;letter-spacing:.02em;color:#111}
/* leaderboard */
.tabs{display:flex;flex-wrap:wrap;gap:8px;margin:18px 0}
.tab{border:1px solid var(--line);background:#0e0e0e;color:#cfcfcf;border-radius:999px;padding:8px 14px;font-weight:700;cursor:pointer;font-size:14px}
.tab.on{background:#f2f2f2;color:#0a0a0a;border-color:#f2f2f2}
.lb{list-style:none;margin:0;padding:0}
.lb li{display:flex;align-items:center;gap:14px;padding:12px 10px;border-bottom:1px solid var(--line)}
.lb .rank{width:30px;font-weight:900;color:var(--muted);text-align:right}
.lb .nm{flex:1;font-weight:700}
.lb .val{font-weight:900;font-variant-numeric:tabular-nums}
.lb a{text-decoration:none}
.lb li:hover{background:#0e0e0e}
h1{font-size:clamp(30px,5vw,52px);font-weight:900;margin:.2em 0}
h2{font-weight:900}
.title-row{display:flex;align-items:baseline;gap:12px;flex-wrap:wrap}
'''


def share_links(slug, fname, p):
    url = f"{PUBLIC_BASE}/u/{slug}"
    txt = f"{fname}: планка {fmt(p['start_sec'])} → {fmt(p['last_sec'])} (×{p['multiplier']}). Маленький шаг каждый день. {PUBLIC_BASE}"
    import urllib.parse
    e = urllib.parse.quote
    x = f"https://twitter.com/intent/tweet?text={e(txt)}"
    li = f"https://www.linkedin.com/sharing/share-offsite/?url={e(url)}"
    fb = f"https://www.facebook.com/sharer/sharer.php?u={e(url)}"
    tg = f"https://t.me/share/url?url={e(url)}&text={e(txt)}"
    return x, li, fb, tg


def profile_html(p, slug, fname):
    status = "active" if p["active"] else "paused"
    status_ru = "практикует сейчас" if p["active"] else f"пауза {p['days_since_last']} дн."
    streak = longest_streak([d for d, _ in p["series"]])
    cb = comeback_count(p["series"])
    x, li, fb, tg = share_links(slug, fname, p)
    title = f"{fname} — Планка +1%"
    desc = f"{fmt(p['start_sec'])} → {fmt(p['last_sec'])}, ×{p['multiplier']} за {p['reports']} дней практики."
    cb_line = f"<div class='stat'><span class='muted'>Возвращений</span><br><b>{cb}</b></div>" if cb else ""
    return PAGE_HEAD.format(title=html.escape(title), desc=html.escape(desc), css=CSS) + f'''
<div class="container">
  <div class="title-row">
    <a class="brand" href="../index.html">PLANK +1%</a>
    <span class="muted">/ профиль</span>
  </div>

  <div class="hero">
    <div>
      <div class="badge"><span class="dot {status}"></span> {status_ru}</div>
      <h1 style="margin-top:14px">{html.escape(fname)}</h1>
      <div class="muted">сейчас держит</div>
      <div class="bignum mono">{fmt(p['last_sec'])}</div>
      <div class="statline">
        <div class="stat"><span class="muted">Старт</span><br><b class="mono">{fmt(p['start_sec'])}</b></div>
        <div class="stat"><span class="muted">Рост</span><br><b>×{p['multiplier']}</b></div>
        <div class="stat"><span class="muted">Дней практики</span><br><b>{p['reports']}</b></div>
        <div class="stat"><span class="muted">Лучшая серия</span><br><b>{streak}</b></div>
        {cb_line}
      </div>
      <div class="cta-row">
        <a class="btn" href="{x}" target="_blank" rel="noopener">Поделиться в X</a>
        <a class="btn ghost" href="{li}" target="_blank" rel="noopener">LinkedIn</a>
        <a class="btn ghost" href="{tg}" target="_blank" rel="noopener">Telegram</a>
      </div>
    </div>
    <div class="card">
      <h2 style="margin-top:0;font-size:18px">Рост по дням</h2>
      {svg_chart(p)}
      <p class="muted" style="font-size:13px;margin-bottom:0">⬤ твой путь · <span style="color:#3ddc84">▱ прогноз +1%/день на 70 дней вперёд</span></p>
    </div>
  </div>

  <h2 style="margin-top:40px;font-size:18px">Карточка для соцсетей</h2>
  <div class="sharecard">
    <div class="num">{fmt(p['last_sec'])}</div>
    <div class="meta">{html.escape(fname)} · {fmt(p['start_sec'])} → {fmt(p['last_sec'])} · ×{p['multiplier']}</div>
    <div class="foot">plank.today · планка +1% каждый день</div>
  </div>
  <p class="muted" style="font-size:13px">Так будет выглядеть превью ссылки (светлая тема). В финале — авто-картинка PNG.</p>
</div>
</body></html>'''


def leaderboard_html(people, slugmap):
    # build category rankings
    def top(metric, n=8, reverse=True):
        ranked = sorted(people, key=lambda p: metric(p), reverse=reverse)
        ranked = [p for p in ranked if metric(p)]
        return ranked[:n]

    cats = {
        "current": ("Текущее время", lambda p: p["last_sec"], lambda p: fmt(p["last_sec"])),
        "mult": ("Множитель", lambda p: p["multiplier"] or 0, lambda p: f"×{p['multiplier']}"),
        "streak": ("Лучшая серия", lambda p: longest_streak([d for d, _ in p["series"]]), lambda p: f"{longest_streak([d for d, _ in p['series']])} дн."),
        "days": ("Всего дней", lambda p: p["reports"], lambda p: f"{p['reports']}"),
        "comeback": ("Возвращения", lambda p: comeback_count(p["series"]), lambda p: f"{comeback_count(p['series'])}×"),
        "new": ("Только что начал", lambda p: -(TODAY - datetime.date.fromisoformat(p["start_date"])).days, lambda p: p["start_date"]),
    }
    blocks = []
    for key, (label, metric, render) in cats.items():
        ranked = top(metric)
        items = []
        for i, p in enumerate(ranked, 1):
            slug = slugmap[p["uid"]]
            fname = first_name(p["name"])
            st = "active" if p["active"] else "paused"
            items.append(
                f'<li><span class="rank">{i}</span>'
                f'<span class="dot {st}"></span>'
                f'<a class="nm" href="u/{slug}.html">{html.escape(fname)}</a>'
                f'<span class="val mono">{render(p)}</span></li>'
            )
        display = "block" if key == "current" else "none"
        blocks.append(f'<ul class="lb" data-cat="{key}" style="display:{display}">' + "".join(items) + "</ul>")

    tabs = "".join(
        f'<button class="tab {"on" if k=="current" else ""}" data-cat="{k}">{lbl}</button>'
        for k, (lbl, _, _) in cats.items()
    )
    n_active = sum(1 for p in people if p["active"])
    title = "Планка +1% — Рейтинг участников"
    desc = "Реальные результаты практикующих планку +1% каждый день."
    return PAGE_HEAD.format(title=html.escape(title), desc=html.escape(desc), css=CSS) + f'''
<div class="container">
  <a class="brand" href="../index.html">PLANK +1%</a>
  <h1>Рейтинг участников</h1>
  <p class="muted">{len(people)} практикующих · <span class="dot active"></span> {n_active} активны сейчас ·
     <span class="dot paused"></span> {len(people)-n_active} на паузе</p>
  <p class="muted" style="font-size:13px">Прототип на реальных данных группы. Имена — только имя. Люди появляются в рейтинге после регистрации (sign-up).</p>
  <div class="tabs">{tabs}</div>
  {''.join(blocks)}
</div>
<script>
document.querySelectorAll('.tab').forEach(t=>t.addEventListener('click',()=>{{
  const c=t.dataset.cat;
  document.querySelectorAll('.tab').forEach(x=>x.classList.toggle('on',x===t));
  document.querySelectorAll('.lb').forEach(u=>u.style.display=(u.dataset.cat===c)?'block':'none');
}}));
</script>
</body></html>'''


def main():
    with open(DATA, encoding="utf-8") as f:
        people = json.load(f)

    os.makedirs(os.path.join(OUT, "u"), exist_ok=True)

    # unique slugs
    slugmap, used = {}, set()
    for p in people:
        base = translit(first_name(p["name"]))
        slug, i = base, 2
        while slug in used:
            slug = f"{base}-{i}"
            i += 1
        used.add(slug)
        slugmap[p["uid"]] = slug

    for p in people:
        slug = slugmap[p["uid"]]
        fname = first_name(p["name"])
        with open(os.path.join(OUT, "u", f"{slug}.html"), "w", encoding="utf-8") as f:
            f.write(profile_html(p, slug, fname))

    with open(os.path.join(OUT, "index.html"), "w", encoding="utf-8") as f:
        f.write(leaderboard_html(people, slugmap))

    print(f"Built {len(people)} profiles + leaderboard into {OUT}/")
    print(f"Open: {os.path.abspath(os.path.join(OUT, 'index.html'))}")
    print("Sample profiles:")
    for p in people[:5]:
        print(f"  {first_name(p['name']):12} -> {OUT}/u/{slugmap[p['uid']]}.html")


if __name__ == "__main__":
    main()
