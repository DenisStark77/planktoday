/**
 * Dynamic OG share card (1200x630 PNG) per profile, rendered at the edge with
 * workers-og (Satori + resvg). Light theme so it pops in link previews.
 * Satori note: any element with >1 child must set display:flex.
 */
import { ImageResponse } from "workers-og";
import fontData from "../assets/font.ttf";
import { getUserBySlug, getEntries, computeStats, fmt } from "./db.js";

const esc = (s) => String(s).replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));

export async function renderCard(env, slug) {
  const u = await getUserBySlug(env, slug);
  if (!u || !u.registered) return new Response("not found", { status: 404 });
  const st = computeStats(await getEntries(env, u.uid));
  if (!st) return new Response("not found", { status: 404 });

  const name = esc(u.first_name);
  const cur = fmt(st.current);
  const meta = `${fmt(st.start)} → ${cur} · ×${st.multiplier} · ${st.reports} дней`;

  const html = `
  <div style="display:flex;flex-direction:column;width:1200px;height:630px;background:#faf7f0;color:#15110a;padding:80px;font-family:Inter;justify-content:space-between;">
    <div style="display:flex;align-items:center;">
      <div style="display:flex;width:18px;height:64px;background:#15a34a;border-radius:6px;margin-right:24px;"></div>
      <div style="display:flex;font-size:36px;letter-spacing:6px;color:#6b6458;">PLANK +1%</div>
    </div>
    <div style="display:flex;flex-direction:column;">
      <div style="display:flex;font-size:56px;color:#3a352c;">${name}</div>
      <div style="display:flex;font-size:34px;color:#8a8276;margin-top:8px;">сейчас держит планку</div>
      <div style="display:flex;font-size:248px;line-height:1;font-weight:700;">${cur}</div>
    </div>
    <div style="display:flex;flex-direction:column;">
      <div style="display:flex;font-size:40px;color:#15a34a;">${esc(meta)}</div>
      <div style="display:flex;font-size:32px;color:#8a8276;margin-top:18px;">plank.today · маленький шаг каждый день</div>
    </div>
  </div>`;

  const img = new ImageResponse(html, {
    width: 1200,
    height: 630,
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
