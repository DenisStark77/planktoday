/** Telegram update handling: group report parsing + DM claim/onboarding flow. */
import { extractReport } from "./parser.js";
import { sendMessage, answerCallback, downloadFile } from "./telegram.js";
import {
  ensureUser, getUserByUid, getUserBySlug, getEntries, upsertEntry, registerUser, setPhoto,
  setReferral, computeStats, fmt, normLang,
} from "./db.js";
import { t, daysStr, langName, welcomeFallback } from "./i18n.js";

/** Resolve a user's language for bot messages. */
function langOf(u, from) {
  return (u && u.lang) || normLang(from && from.language_code) || "ru";
}

const GROUP_INVITE = "https://t.me/+oF9GH9olL5JiYWFk"; // RU daily community

async function applyReferral(env, uid, param) {
  if (!param) return;
  if (param.startsWith("u_")) {
    const ref = await getUserBySlug(env, param.slice(2));
    if (ref) await setReferral(env, uid, ref.uid, "profile");
  } else if (param === "board") {
    await setReferral(env, uid, null, "board");
  } else if (param === "site") {
    await setReferral(env, uid, null, "site");
  }
}

const esc = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

function fullNameOf(from) {
  return [from.first_name, from.last_name].filter(Boolean).join(" ") || from.username || String(from.id);
}

function dayFromUnix(sec) {
  return new Date(sec * 1000).toISOString().slice(0, 10);
}

// --- "welcome back" greeting for returners after a long pause ---
const RETURN_GREET_AFTER_DAYS = 14;

async function welcomeBack(env, lang, name, gapDays, currentSec) {
  const fallback = welcomeFallback(lang, name, gapDays + currentSec); // vary by index
  if (!env.AI) return fallback;
  try {
    const prompt =
      `You are the warm, supportive voice of the "Plank +1%" community, where people hold a plank ` +
      `daily and add 1% to their time each day. Member ${name} returned after a ${gapDays}-day break ` +
      `and did a ${fmt(currentSec)} plank. Write ONE short warm welcome-back phrase in ${langName(lang)} ` +
      `(max 12 words), no judgment about the pause, address them by name, add 1–2 emoji. ` +
      `Return only the phrase, no quotes.`;
    const r = await env.AI.run("@cf/meta/llama-3.3-70b-instruct-fp8-fast", {
      messages: [{ role: "user", content: prompt }],
      max_tokens: 60,
      temperature: 0.9,
    });
    let out = ((r && (r.response || (r.result && r.result.response))) || "").trim();
    out = out.replace(/^["“«]+|["”»]+$/g, "").split("\n")[0].trim();
    return out || fallback;
  } catch (e) {
    console.error("welcomeBack AI error", e);
    return fallback;
  }
}

/** Onboarding: accept "0:30", "30 сек", or a bare "30" as seconds. */
function onboardSeconds(text) {
  const r = extractReport(text, false);
  if (r) return r;
  const m = /^\s*(\d{1,4})\s*$/.exec(text || "");
  if (m) {
    const n = +m[1];
    if (n >= 3 && n <= 3600) return n;
  }
  return null;
}

// --- claim conversation state (D1) ---
async function getStep(env, uid) {
  const r = await env.DB.prepare("SELECT step FROM claim_state WHERE uid=?").bind(String(uid)).first();
  return r?.step || null;
}
async function setStep(env, uid, step) {
  await env.DB.prepare(
    "INSERT OR REPLACE INTO claim_state (uid, step, updated_at) VALUES (?,?,datetime('now'))"
  ).bind(String(uid), step).run();
}
async function clearStep(env, uid) {
  await env.DB.prepare("DELETE FROM claim_state WHERE uid=?").bind(String(uid)).run();
}

export async function handleUpdate(update, env) {
  if (update.callback_query) return handleCallback(env, update.callback_query);
  if (update.message) {
    const msg = update.message;
    const type = msg.chat?.type;
    if (type === "private") return handleDM(env, msg);
    if (type === "group" || type === "supergroup") return handleGroup(env, msg);
  }
}

async function handleGroup(env, msg) {
  const text = msg.text || msg.caption || "";
  if (!text) return;

  // Resolve the author. Anonymous admins post AS the group (sender_chat === chat)
  // and Telegram hides which admin it was — attribute such posts to a configured
  // fallback admin (env.ANON_ADMIN_UID), e.g. an admin who can't disable anonymity.
  let user;
  const anonAdmin = msg.sender_chat && msg.chat && msg.sender_chat.id === msg.chat.id;
  if (anonAdmin) {
    if (!env.ANON_ADMIN_UID) return;
    user = await getUserByUid(env, String(env.ANON_ADMIN_UID));
    if (!user) return;
  } else {
    if (!msg.from || msg.from.is_bot) return;
    user = await ensureUser(env, String(msg.from.id), fullNameOf(msg.from), msg.from.language_code);
  }
  const uid = user.uid;

  const sec = extractReport(text, !!user.strict);
  if (sec == null) return;                       // not a report -> ignore silently
  const day = dayFromUnix(msg.date);

  // capture previous report date BEFORE inserting, to detect a long-pause return
  const prev = await env.DB.prepare("SELECT MAX(day) AS d FROM entries WHERE uid=?").bind(uid).first();
  const prevDay = prev && prev.d ? prev.d : null;

  await upsertEntry(env, uid, day, sec, "group", msg.message_id);

  if (prevDay && prevDay < day) {
    const gap = Math.round((Date.parse(day) - Date.parse(prevDay)) / 86400000);
    if (gap >= RETURN_GREET_AFTER_DAYS) {
      const greeting = await welcomeBack(env, langOf(user), user.first_name, gap, sec);
      if (greeting) await sendMessage(env, msg.chat.id, greeting, { reply_to_message_id: msg.message_id });
    }
  }
}

async function handleDM(env, msg) {
  const uid = String(msg.from.id);
  const chatId = msg.chat.id;
  const text = msg.text || "";
  const u = await ensureUser(env, uid, fullNameOf(msg.from), msg.from.language_code);
  const lang = langOf(u, msg.from);
  const base = env.PUBLIC_BASE || "https://plank.today";

  // Any photo / video-circle in a DM (any time) updates the profile media.
  if (msg.photo || msg.video_note || msg.video) {
    await clearStep(env, uid);
    return handleMedia(env, msg, uid, chatId, lang);
  }
  // skip media prompt after claiming
  if (await getStep(env, uid) === "awaiting_photo" && text.startsWith("/skip")) {
    await clearStep(env, uid);
    return sendMessage(env, chatId, t(lang, "skip_done", { url: `${base}/u/${u.slug}` }));
  }

  if (text.startsWith("/donate")) {
    const wallet = env.DONATE_TG || "";
    return sendMessage(env, chatId, wallet ? t(lang, "donate", { wallet }) : t(lang, "donate_unavail"));
  }

  if (text.startsWith("/start")) {
    await applyReferral(env, uid, text.split(/\s+/)[1] || "");
    if ((await getEntries(env, uid)).length) return showClaimCard(env, chatId, uid, false, lang);
    await setStep(env, uid, "awaiting_first_time");
    return sendMessage(env, chatId, t(lang, "onboard"));
  }

  if (await getStep(env, uid) === "awaiting_first_time") {
    const sec = onboardSeconds(text);
    if (!sec) return sendMessage(env, chatId, t(lang, "bad_time"));
    await upsertEntry(env, uid, new Date().toISOString().slice(0, 10), sec, "dm");
    await clearStep(env, uid);
    return showClaimCard(env, chatId, uid, true, lang);
  }

  if ((await getEntries(env, uid)).length) return showClaimCard(env, chatId, uid, false, lang);
  await setStep(env, uid, "awaiting_first_time");
  return sendMessage(env, chatId, t(lang, "ask_time"));
}

async function showClaimCard(env, chatId, uid, justStarted = false, lang = "ru") {
  const u = await getUserByUid(env, uid);
  const st = computeStats(await getEntries(env, uid));
  const base = env.PUBLIC_BASE || "https://plank.today";
  if (u.registered) {
    return sendMessage(env, chatId,
      t(lang, "already", { url: `${base}/u/${u.slug}`, cur: fmt(st.current), mult: st.multiplier }));
  }
  const body = t(lang, "card_body", {
    intro: t(lang, justStarted ? "intro_started" : "intro_found"),
    name: esc(u.first_name), cur: fmt(st.current), start: fmt(st.start),
    mult: st.multiplier, days: daysStr(lang, st.reports),
  });
  return sendMessage(env, chatId, body, {
    reply_markup: {
      inline_keyboard: [[
        { text: t(lang, "btn_publish"), callback_data: "pub" },
        { text: t(lang, "btn_private"), callback_data: "priv" },
      ]],
    },
  });
}

async function handleCallback(env, cq) {
  const uid = String(cq.from.id);
  const data = cq.data;
  const chatId = cq.message?.chat?.id;
  if (data === "pub" || data === "priv") {
    const u0 = await ensureUser(env, uid, fullNameOf(cq.from), cq.from.language_code);
    const lang = langOf(u0, cq.from);
    await registerUser(env, uid, data === "pub");
    const u = await getUserByUid(env, uid);
    const base = env.PUBLIC_BASE || "https://plank.today";
    await answerCallback(env, cq.id, t(lang, data === "pub" ? "cb_published" : "cb_saved"));
    await setStep(env, uid, "awaiting_photo");
    return sendMessage(env, chatId, t(lang, "after_claim", {
      where: t(lang, data === "pub" ? "where_public" : "where_private"),
      url: `${base}/u/${u.slug}`, group: GROUP_INVITE,
    }));
  }
}

function fmtBytes(n) {
  if (n >= 1073741824) return (n / 1073741824).toFixed(2) + " ГБ";
  if (n >= 1048576) return (n / 1048576).toFixed(1) + " МБ";
  if (n >= 1024) return (n / 1024).toFixed(0) + " КБ";
  return n + " Б";
}

async function notifyAdmin(env, text) {
  if (env.ADMIN_UID) await sendMessage(env, env.ADMIN_UID, text);
}

async function handleMedia(env, msg, uid, chatId, lang = "ru") {
  if (!env.MEDIA) return sendMessage(env, chatId, t(lang, "media_unavailable"));

  let fileId, ext, ct;
  if (msg.video_note) { fileId = msg.video_note.file_id; ext = "mp4"; ct = "video/mp4"; }
  else if (msg.video) { fileId = msg.video.file_id; ext = "mp4"; ct = "video/mp4"; }
  else if (msg.photo) { fileId = msg.photo[msg.photo.length - 1].file_id; ext = "jpg"; ct = "image/jpeg"; }
  else return;

  const dl = await downloadFile(env, fileId);
  if (!dl) return sendMessage(env, chatId, t(lang, "media_dl_fail"));
  const newSize = dl.body.byteLength;

  // --- storage cap accounting (per-user delta so overwrites don't inflate the total) ---
  const cap = parseInt(env.R2_CAP_BYTES || "0", 10);
  const warn = parseInt(env.R2_WARN_BYTES || "0", 10);
  const u0 = await getUserByUid(env, uid);
  const oldSize = (u0 && u0.media_bytes) || 0;
  const totalRow = await env.DB.prepare("SELECT v FROM meta WHERE k='media_bytes'").first();
  const curTotal = totalRow ? totalRow.v : 0;
  const newTotal = curTotal - oldSize + newSize;

  if (cap && newTotal > cap) {
    await notifyAdmin(env, `🛑 Хранилище R2 достигло лимита ${fmtBytes(cap)}. Загрузка ${fmtBytes(newSize)} от ${(u0 && u0.first_name) || uid} отклонена. Загрузки на паузе.`);
    return sendMessage(env, chatId, t(lang, "storage_full"));
  }

  const key = `u/${uid}.${ext}`;
  await env.MEDIA.put(key, dl.body, { httpMetadata: { contentType: ct } });
  const base = env.PUBLIC_BASE || "https://plank.today";
  await env.DB.prepare("UPDATE users SET photo_url=?, media_bytes=? WHERE uid=?")
    .bind(`${base}/api/media/${key}`, newSize, uid).run();
  await env.DB.prepare("UPDATE meta SET v=? WHERE k='media_bytes'").bind(newTotal).run();

  // warn once when crossing the warn threshold
  if (warn && curTotal < warn && newTotal >= warn) {
    await notifyAdmin(env, `⚠️ Хранилище медиа: ${fmtBytes(newTotal)} из ${fmtBytes(cap)} (пройден порог ${fmtBytes(warn)}).`);
  }

  const u = await getUserByUid(env, uid);
  return sendMessage(env, chatId, t(lang, "media_added", { url: `${base}/u/${u.slug}` }));
}
