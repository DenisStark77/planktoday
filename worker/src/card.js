/**
 * Dynamic share cards per profile, rendered at the edge with workers-og
 * (Satori + resvg). Light theme so it pops in link previews and Stories.
 *   variant "og"    → 1200x630  (link unfurls / OG image)
 *   variant "story" → 1080x1920 (Instagram/Stories portrait)
 * Satori note: any element with >1 child must set display:flex.
 */
import { ImageResponse } from "workers-og";
import fontData from "../assets/font.ttf";
import { getUserBySlug, getEntries, computeStats, fmt, pluralRu } from "./db.js";

const esc = (s) => String(s).replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));

// Per-variant geometry. Sizes are tuned so the big number never overflows the
// inner width (width - 2*pad) for typical "M:SS" / "Hч Mм" values.
const VARIANTS = {
  og:    { width: 1200, height: 630,  pad: 80,  bar: 64,  logo: 36, name: 56, sub: 34, big: 248, meta: 40, tag: 32 },
  story: { width: 1080, height: 1920, pad: 96,  bar: 96,  logo: 44, name: 84, sub: 46, big: 300, meta: 46, tag: 36 },
};

function cardHtml(v, { name, cur, meta }) {
  return `
  <div style="display:flex;flex-direction:column;width:${v.width}px;height:${v.height}px;background:#faf7f0;color:#15110a;padding:${v.pad}px;font-family:Inter;justify-content:space-between;">
    <div style="display:flex;align-items:center;">
      <div style="display:flex;width:18px;height:${v.bar}px;background:#15a34a;border-radius:6px;margin-right:24px;"></div>
      <div style="display:flex;font-size:${v.logo}px;letter-spacing:6px;color:#6b6458;">PLANK +1%</div>
    </div>
    <div style="display:flex;flex-direction:column;">
      <div style="display:flex;font-size:${v.name}px;color:#3a352c;">${name}</div>
      <div style="display:flex;font-size:${v.sub}px;color:#8a8276;margin-top:8px;">сейчас держит планку</div>
      <div style="display:flex;font-size:${v.big}px;line-height:1;font-weight:700;">${cur}</div>
    </div>
    <div style="display:flex;flex-direction:column;">
      <div style="display:flex;font-size:${v.meta}px;color:#15a34a;">${esc(meta)}</div>
      <div style="display:flex;font-size:${v.tag}px;color:#8a8276;margin-top:18px;">plank.today · маленький шаг каждый день</div>
    </div>
  </div>`;
}

export async function renderCard(env, slug, variant = "og") {
  const v = VARIANTS[variant] || VARIANTS.og;
  const u = await getUserBySlug(env, slug);
  if (!u || !u.registered) return new Response("not found", { status: 404 });
  const st = computeStats(await getEntries(env, u.uid));
  if (!st) return new Response("not found", { status: 404 });

  const data = {
    name: esc(u.first_name),
    cur: fmt(st.current),
    meta: `${fmt(st.start)} → ${fmt(st.peak)} · ×${st.multiplier} · ${st.reports} ${pluralRu(st.reports, "день", "дня", "дней")}`,
  };

  const img = new ImageResponse(cardHtml(v, data), {
    width: v.width,
    height: v.height,
    fonts: [{ name: "Inter", data: fontData, weight: 700, style: "normal" }],
  });
  // add caching (stats change ~daily); unfurlers refetch as needed
  return new Response(img.body, {
    headers: {
      "content-type": "image/png",
      "cache-control": "public, max-age=3600",
    },
  });
}
