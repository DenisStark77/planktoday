/** Server-rendered profile + leaderboard HTML (live from D1). */
import { fmt, getUserBySlug, getEntries, computeStats, listPublicWithStats } from "./db.js";

const CSS = `
:root{--bg:#0a0a0a;--fg:#f2f2f2;--muted:#9b9b9b;--line:#1f1f1f;--maxw:980px}
*,*::before,*::after{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--fg);font-family:Inter,system-ui,-apple-system,Segoe UI,Roboto,"Helvetica Neue",Arial,"Apple Color Emoji","Segoe UI Emoji";line-height:1.5;-webkit-font-smoothing:antialiased}
a{color:var(--fg)}
.container{max-width:var(--maxw);margin-inline:auto;padding:24px}
.brand{font-weight:800;letter-spacing:.04em;text-decoration:none}
.muted{color:var(--muted)}
.mono{font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace}
.card{border:1px solid var(--line);border-radius:18px;padding:20px;background:radial-gradient(80% 120% at 10% 0%,rgba(255,255,255,.03),rgba(255,255,255,0))}
.dot{display:inline-block;width:8px;height:8px;border-radius:999px;vertical-align:middle}
.dot.active{background:#3ddc84}.dot.paused{background:#6a6a6a}
.badge{display:inline-flex;gap:6px;align-items:center;border:1px solid var(--line);border-radius:999px;padding:5px 10px;font-size:13px;color:#cfcfcf}
.hero{display:grid;grid-template-columns:1fr;gap:20px;margin-top:8px}
@media(min-width:760px){.hero{grid-template-columns:1.1fr .9fr}}
.bignum{font-size:clamp(56px,12vw,104px);font-weight:900;line-height:1;letter-spacing:-.02em}
.statline{display:flex;flex-wrap:wrap;gap:18px;margin-top:14px}
.stat b{font-size:22px}
.chart{width:100%;height:auto;display:block}
.cta-row{display:flex;flex-wrap:wrap;gap:10px;margin-top:18px}
.btn{display:inline-flex;align-items:center;gap:8px;border:1px solid #f2f2f2;background:#f2f2f2;color:#0a0a0a;padding:11px 15px;border-radius:12px;font-weight:800;text-decoration:none;font-size:14px}
.btn.ghost{background:transparent;color:var(--fg);border-color:#2a2a2a}
.sharecard{background:#faf7f0;color:#111;border-radius:16px;padding:26px 28px;max-width:520px;border:1px solid #e6e0d4}
.sharecard .num{font-size:64px;font-weight:900;line-height:1}
.sharecard .meta{color:#555;font-weight:700;margin-top:6px}
.sharecard .foot{margin-top:18px;font-weight:800;letter-spacing:.02em;color:#111}
.avatar{width:64px;height:64px;border-radius:999px;object-fit:cover;border:1px solid var(--line)}
.tabs{display:flex;flex-wrap:wrap;gap:8px;margin:18px 0}
.tab{border:1px solid var(--line);background:#0e0e0e;color:#cfcfcf;border-radius:999px;padding:8px 14px;font-weight:700;cursor:pointer;font-size:14px}
.tab.on{background:#f2f2f2;color:#0a0a0a;border-color:#f2f2f2}
.lb{list-style:none;margin:0;padding:0}
.lb li{display:flex;align-items:center;gap:14px;padding:12px 10px;border-bottom:1px solid var(--line)}
.lb .rank{width:30px;font-weight:900;color:var(--muted);text-align:right}
.lb .nm{flex:1;font-weight:700;text-decoration:none}
.lb .val{font-weight:900;font-variant-numeric:tabular-nums}
.lb li:hover{background:#0e0e0e}
h1{font-size:clamp(30px,5vw,52px);font-weight:900;margin:.2em 0}
.title-row{display:flex;align-items:baseline;gap:12px;flex-wrap:wrap}
.badges{display:flex;flex-wrap:wrap;gap:8px;margin-top:16px}
.rankbadge{display:inline-flex;align-items:center;gap:6px;border:1px solid #2a2a2a;border-radius:999px;padding:7px 13px;font-weight:800;font-size:13px;text-decoration:none;color:#f2f2f2;background:#0e0e0e}
.rankbadge:hover{border-color:#3ddc84;color:#fff}
.board-desc{font-size:15px;margin:2px 0 16px;max-width:62ch;color:#c9c9c9}
`;

const esc = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

function head(title, desc, extraMeta = "") {
  return `<!DOCTYPE html><html lang="ru"><head>
<meta charset="utf-8"/><meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}"/>
<meta property="og:title" content="${esc(title)}"/>
<meta property="og:description" content="${esc(desc)}"/>
<meta property="og:type" content="website"/>
${extraMeta}
<style>${CSS}</style></head><body>`;
}

const PROJ_DAYS = 70; // forward horizon = one +1% doubling (the project's core promise)

function svgChart(stats, w = 560, h = 200, pad = 28) {
  const series = stats.series;
  if (series.length < 2) return "<p class='muted'>Недостаточно данных для графика</p>";
  const d0 = Date.parse(series[0][0]);
  const pts = series.map(([d, s]) => [Math.round((Date.parse(d) - d0) / 86400000), s]);
  const todayX = pts[pts.length - 1][0];
  const current = stats.current;

  // Forward projection from TODAY only (not a backward "ideal" line).
  const proj = [];
  const pstep = Math.max(1, Math.floor(PROJ_DAYS / 40));
  for (let d = 0; d <= PROJ_DAYS; d += pstep) proj.push([todayX + d, current * Math.pow(1.01, d)]);
  const projEnd = current * Math.pow(1.01, PROJ_DAYS);

  const xmax = todayX + PROJ_DAYS;
  const actualMax = Math.max(...pts.map((p) => p[1]));
  const ymax = Math.max(actualMax, projEnd) * 1.06;
  const X = (x) => pad + (w - 2 * pad) * x / xmax;
  const Y = (y) => h - pad - (h - 2 * pad) * y / ymax;

  // Actual data is shown as DOTS only (no connecting line) so skipped days read as
  // real gaps, not implied continuous practice. The forward projection stays a line.
  const projPath = proj.map(([x, y]) => `${X(x).toFixed(1)},${Y(y).toFixed(1)}`).join(" ");
  const dots = pts.map(([x, y]) => `<circle cx="${X(x).toFixed(1)}" cy="${Y(y).toFixed(1)}" r="2" fill="#f2f2f2"/>`).join("");
  const tx = X(todayX).toFixed(1);
  return `<svg viewBox="0 0 ${w} ${h}" class="chart" role="img" aria-label="Рост времени планки">
<line x1="${tx}" y1="${pad - 8}" x2="${tx}" y2="${h - pad}" stroke="#2a2a2a" stroke-width="1" stroke-dasharray="2 3"/>
<polyline fill="none" stroke="#3ddc84" stroke-width="2" stroke-dasharray="5 4" points="${projPath}"/>${dots}
<circle cx="${tx}" cy="${Y(current).toFixed(1)}" r="3.4" fill="#3ddc84"/>
<text x="${pad}" y="${h - 6}" fill="#8a8a8a" font-size="11">день 0</text>
<text x="${tx}" y="${h - 6}" fill="#8a8a8a" font-size="11" text-anchor="middle">сегодня</text>
<text x="${(w - pad).toFixed(1)}" y="${h - 6}" fill="#8a8a8a" font-size="11" text-anchor="end">+${PROJ_DAYS} дн.</text>
<text x="${(w - pad).toFixed(1)}" y="${(Y(projEnd) - 6).toFixed(1)}" fill="#3ddc84" font-size="12" text-anchor="end" font-weight="700">${fmt(projEnd)}</text>
<text x="${pad - 6}" y="${(Y(ymax) + 10).toFixed(0)}" fill="#8a8a8a" font-size="11">${fmt(ymax)}</text></svg>`;
}

function shareLinks(env, slug, fname, st) {
  const base = env.PUBLIC_BASE || "https://plank.today";
  const url = `${base}/u/${slug}`;
  const txt = `${fname}: планка ${fmt(st.start)} → ${fmt(st.current)} (×${st.multiplier}). Маленький шаг каждый день. ${base}`;
  const e = encodeURIComponent;
  return {
    x: `https://twitter.com/intent/tweet?text=${e(txt)}`,
    li: `https://www.linkedin.com/sharing/share-offsite/?url=${e(url)}`,
    tg: `https://t.me/share/url?url=${e(url)}&text=${e(txt)}`,
  };
}

// Leaderboards. metric/render take a `stats` object. Order = tab order.
const BOARDS = [
  { key: "endurance", name: "Выносливость",
    desc: "Способность продолжительное время преодолевать дискомфорт для достижения цели.",
    metric: (s) => s.current, render: (s) => fmt(s.current) },
  { key: "exp", name: "Экспонента",
    desc: "Многократно вырасти можно, делая малые шаги каждый день.",
    metric: (s) => s.multiplier || 0, render: (s) => `×${s.multiplier}` },
  { key: "discipline", name: "Дисциплина",
    desc: "Продолжать без пропусков несмотря ни на какие обстоятельства.",
    metric: (s) => s.streak, render: (s) => `${s.streak} дн.` },
  { key: "commitment", name: "Приверженность",
    desc: "Результат от планки накапливается, даже если ты делаешь пропуски.",
    metric: (s) => s.reports, render: (s) => `${s.reports}` },
  { key: "comebacks", name: "Возвращения",
    desc: "Начать заново после того, как бросил — редкая способность.",
    metric: (s) => s.comebackCount, render: (s) => `${s.comebackCount}×` },
  { key: "firststep", name: "Первый шаг",
    desc: "Самое трудное — это первый раз встать в планку.",
    metric: (s) => -(Date.now() - Date.parse(s.startDate)), render: (s) => s.startDate },
];

/** This user's RELATIVELY-best placements: the boards where they rank highest
 * compared to their own other ranks (best first) — shown even if it's #23. */
async function rankBadges(env, uid) {
  const pop = await listPublicWithStats(env);
  const placements = [];
  for (const b of BOARDS) {
    const ranked = pop.filter((x) => b.metric(x.stats)).sort((a, c) => b.metric(c.stats) - b.metric(a.stats));
    const idx = ranked.findIndex((x) => x.user.uid === uid);
    if (idx >= 0) placements.push({ b, rank: idx + 1 });
  }
  placements.sort((a, c) => a.rank - c.rank);
  const medals = { 1: "🥇", 2: "🥈", 3: "🥉" };
  const items = placements.slice(0, 3).map(({ b, rank }) =>
    `<a class="rankbadge" href="/board?cat=${b.key}">${medals[rank] || "№" + rank} · ${b.name}</a>`).join("");
  return items ? `<div class="badges">${items}</div>` : "";
}

export async function renderProfile(env, slug) {
  const u = await getUserBySlug(env, slug);
  if (!u || !u.registered) return null;
  const st = computeStats(await getEntries(env, u.uid));
  if (!st) return null;
  const fname = u.first_name;
  const statusCls = st.active ? "active" : "paused";
  const statusRu = st.active ? "практикует сейчас" : `пауза ${st.daysSince} дн.`;
  const s = shareLinks(env, slug, fname, st);
  const og = `<meta property="og:image" content="${env.PUBLIC_BASE}/api/card/${esc(slug)}.png"/>`;
  const cbLine = st.comebackCount
    ? `<div class="stat"><span class="muted">Возвращений</span><br><b>${st.comebackCount}</b></div>` : "";
  const avatar = u.photo_url ? `<img class="avatar" src="${esc(u.photo_url)}" alt=""/> ` : "";
  const badges = u.public ? await rankBadges(env, u.uid) : "";
  return head(`${fname} — Планка +1%`, `${fmt(st.start)} → ${fmt(st.current)}, ×${st.multiplier} за ${st.reports} дней.`, og) + `
<div class="container">
  <div class="title-row"><a class="brand" href="/">PLANK +1%</a><span class="muted">/ профиль</span></div>
  <div class="hero">
    <div>
      <div class="badge"><span class="dot ${statusCls}"></span> ${statusRu}</div>
      <h1 style="margin-top:14px">${avatar}${esc(fname)}</h1>
      <div class="muted">сейчас держит</div>
      <div class="bignum mono">${fmt(st.current)}</div>
      <div class="statline">
        <div class="stat"><span class="muted">Старт</span><br><b class="mono">${fmt(st.start)}</b></div>
        <div class="stat"><span class="muted">Рост</span><br><b>×${st.multiplier}</b></div>
        <div class="stat"><span class="muted">Дней практики</span><br><b>${st.reports}</b></div>
        <div class="stat"><span class="muted">Лучшая серия</span><br><b>${st.streak}</b></div>
        ${cbLine}
      </div>
      ${badges}
      <div class="cta-row">
        <a class="btn" href="${s.x}" target="_blank" rel="noopener">Поделиться в X</a>
        <a class="btn ghost" href="${s.li}" target="_blank" rel="noopener">LinkedIn</a>
        <a class="btn ghost" href="${s.tg}" target="_blank" rel="noopener">Telegram</a>
      </div>
    </div>
    <div class="card">
      <h2 style="margin-top:0;font-size:18px">Рост по дням</h2>
      ${svgChart(st)}
      <p class="muted" style="font-size:13px;margin-bottom:0">⬤ твой путь · <span style="color:#3ddc84">▱ прогноз +1%/день на 70 дней вперёд</span></p>
    </div>
  </div>
  <h2 style="margin-top:40px;font-size:18px">Карточка для соцсетей</h2>
  <div class="sharecard">
    <div class="num">${fmt(st.current)}</div>
    <div class="meta">${esc(fname)} · ${fmt(st.start)} → ${fmt(st.current)} · ×${st.multiplier}</div>
    <div class="foot">plank.today · планка +1% каждый день</div>
  </div>
</div></body></html>`;
}

export async function renderLeaderboard(env, activeCat) {
  const rows = await listPublicWithStats(env);
  const active = BOARDS.some((b) => b.key === activeCat) ? activeCat : BOARDS[0].key;
  const vis = (k) => (k === active ? "block" : "none");

  const lists = BOARDS.map((b) => {
    const ranked = rows.filter((x) => b.metric(x.stats)).sort((a, c) => b.metric(c.stats) - b.metric(a.stats)).slice(0, 10);
    const items = ranked.map((x, i) => {
      const stt = x.stats.active ? "active" : "paused";
      return `<li><span class="rank">${i + 1}</span><span class="dot ${stt}"></span>` +
        `<a class="nm" href="/u/${esc(x.user.slug)}">${esc(x.user.first_name)}</a>` +
        `<span class="val mono">${b.render(x.stats)}</span></li>`;
    }).join("");
    return `<ul class="lb" data-cat="${b.key}" style="display:${vis(b.key)}">${items || '<li class="muted">Пока никого нет</li>'}</ul>`;
  }).join("");
  const descs = BOARDS.map((b) =>
    `<p class="board-desc" data-cat="${b.key}" style="display:${vis(b.key)}">${b.desc}</p>`).join("");
  const tabs = BOARDS.map((b) =>
    `<button class="tab ${b.key === active ? "on" : ""}" data-cat="${b.key}">${b.name}</button>`).join("");

  const nActive = rows.filter((x) => x.stats.active).length;
  const empty = rows.length ? "" : `<p class="muted">Пока никто не зарегистрировался. Откройте бота @plank_today_bot и нажмите «Опубликовать».</p>`;
  return head("Планка +1% — Рейтинг участников", "Реальные результаты практикующих планку +1% каждый день.") + `
<div class="container">
  <a class="brand" href="/">PLANK +1%</a>
  <h1>Рейтинг участников</h1>
  <p class="muted">${rows.length} в рейтинге · <span class="dot active"></span> ${nActive} активны · <span class="dot paused"></span> ${rows.length - nActive} на паузе</p>
  ${empty}
  <div class="tabs">${tabs}</div>
  ${descs}
  ${lists}
  <p class="muted" style="margin-top:24px;font-size:13px"><a href="/">← о методологии «Планка +1%»</a></p>
</div>
<script>
function showCat(c){
  document.querySelectorAll('.tab').forEach(x=>x.classList.toggle('on',x.dataset.cat===c));
  document.querySelectorAll('.lb').forEach(u=>u.style.display=(u.dataset.cat===c)?'block':'none');
  document.querySelectorAll('.board-desc').forEach(d=>d.style.display=(d.dataset.cat===c)?'block':'none');
}
document.querySelectorAll('.tab').forEach(t=>t.addEventListener('click',()=>showCat(t.dataset.cat)));
</script></body></html>`;
}

export function notFound() {
  return head("Не найдено — Планка +1%", "Страница не найдена") +
    `<div class="container"><a class="brand" href="/">PLANK +1%</a><h1>Не найдено</h1>
     <p class="muted">Эта страница не существует или участник ещё не зарегистрировался.</p></div></body></html>`;
}
