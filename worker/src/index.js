/**
 * plank.today Worker — entry point.
 * Routes:
 *   POST /api/tg/webhook   Telegram updates (secret-header authenticated)
 *   GET  /                 leaderboard (registered users only)
 *   GET  /u/:slug          public profile page
 *   GET  /api/health       liveness
 * scheduled(): daily reminder / re-activation (stub for now)
 */
import { handleUpdate } from "./bot.js";
import { renderLeaderboard, renderProfile, notFound } from "./render.js";

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const { pathname } = url;

    try {
      if (pathname === "/api/health") {
        return json({ ok: true, ts: Date.now() });
      }

      if (pathname === "/api/tg/webhook" && request.method === "POST") {
        // Authenticate via Telegram's secret-token header.
        const got = request.headers.get("x-telegram-bot-api-secret-token");
        if (!env.TG_WEBHOOK_SECRET || got !== env.TG_WEBHOOK_SECRET) {
          return new Response("forbidden", { status: 403 });
        }
        const update = await request.json();
        // Respond 200 fast; do the work without blocking Telegram's retry logic.
        ctx.waitUntil(handleUpdate(update, env).catch((e) => console.error("update error", e)));
        return new Response("ok");
      }

      // serve uploaded media from R2
      const mm = pathname.match(/^\/api\/media\/(.+)$/);
      if (mm) {
        if (!env.MEDIA) return new Response("media not enabled", { status: 503 });
        const obj = await env.MEDIA.get(mm[1]);
        if (!obj) return new Response("not found", { status: 404 });
        const headers = new Headers();
        obj.writeHttpMetadata(headers);
        headers.set("cache-control", "public, max-age=86400");
        return new Response(obj.body, { headers });
      }

      if (pathname === "/board" || pathname === "/board/" || pathname === "/" || pathname === "/index.html") {
        return html(await renderLeaderboard(env, url.searchParams.get("cat")));
      }

      const m = pathname.match(/^\/u\/([a-z0-9-]+)\/?$/i);
      if (m) {
        const page = await renderProfile(env, m[1]);
        return page ? html(page) : html(notFound(), 404);
      }

      return html(notFound(), 404);
    } catch (err) {
      console.error("fetch error", err);
      return new Response("internal error", { status: 500 });
    }
  },

  async scheduled(event, env, ctx) {
    // TODO: daily reminders + re-activation nudges. Stub keeps cron wired.
    console.log("scheduled tick", event.cron);
  },
};

function html(body, status = 200) {
  return new Response(body, {
    status,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}
function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}
