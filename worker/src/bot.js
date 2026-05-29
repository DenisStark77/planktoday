/** Telegram update handling: group report parsing + DM claim/onboarding flow. */
import { extractReport } from "./parser.js";
import { sendMessage, answerCallback, downloadFile } from "./telegram.js";
import {
  ensureUser, getUserByUid, getEntries, upsertEntry, registerUser, setPhoto,
  computeStats, fmt,
} from "./db.js";

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

const WELCOME_FALLBACKS = [
  (n) => `С возвращением, ${n}! 🙌 Рад снова видеть тебя в планке.`,
  (n) => `${n}, ты вернулся! 💪 Снова начать — это и есть победа.`,
  (n) => `Снова в строю, ${n}! 🔥 Маленький шаг — уже большой.`,
  (n) => `Здорово, что ты здесь, ${n}! 🌱 Продолжаем расти.`,
  (n) => `С возвращением! 👏 Пауза — не провал. Ты снова в деле, ${n}.`,
];

function pickFallback(name) {
  return WELCOME_FALLBACKS[Math.floor(Math.random() * WELCOME_FALLBACKS.length)](name);
}

async function welcomeBack(env, name, gapDays, currentSec) {
  const fallback = pickFallback(name);
  if (!env.AI) return fallback;
  try {
    const prompt =
      `Ты — тёплый, поддерживающий голос сообщества «Планка +1%», где люди ежедневно стоят в планке ` +
      `и увеличивают время на 1% в день. Участник ${name} вернулся после паузы (${gapDays} дн.) ` +
      `и снова сделал планку ${fmt(currentSec)}. Напиши ОДНУ короткую тёплую фразу-приветствие на русском ` +
      `(до 12 слов), без осуждения за пропуск, обратись по имени, добавь 1–2 эмодзи. ` +
      `Верни только саму фразу, без кавычек.`;
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
  if (!msg.from || msg.from.is_bot) return;
  const uid = String(msg.from.id);
  const text = msg.text || msg.caption || "";
  if (!text) return;
  const user = await ensureUser(env, uid, fullNameOf(msg.from)); // tracked, hidden
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
      const greeting = await welcomeBack(env, user.first_name, gap, sec);
      if (greeting) await sendMessage(env, msg.chat.id, greeting, { reply_to_message_id: msg.message_id });
    }
  }
}

async function handleDM(env, msg) {
  const uid = String(msg.from.id);
  const chatId = msg.chat.id;
  const text = msg.text || "";
  const fullName = fullNameOf(msg.from);

  // Any photo / video-circle in a DM (any time) updates the profile media.
  if (msg.photo || msg.video_note || msg.video) {
    await ensureUser(env, uid, fullName);
    await clearStep(env, uid);
    return handleMedia(env, msg, uid, chatId);
  }
  // skip media prompt after claiming
  if (await getStep(env, uid) === "awaiting_photo" && text.startsWith("/skip")) {
    await clearStep(env, uid);
    const u = await getUserByUid(env, uid);
    const base = env.PUBLIC_BASE || "https://plank.today";
    return sendMessage(env, chatId, `Ок! Твоя страница готова:\n${base}/u/${u.slug}`);
  }

  if (text.startsWith("/start")) {
    const u = await ensureUser(env, uid, fullName);
    const entries = await getEntries(env, uid);
    if (entries.length) return showClaimCard(env, chatId, uid);
    await setStep(env, uid, "awaiting_first_time");
    return sendMessage(env, chatId,
      "Привет! 🙌 Это <b>Планка +1%</b>.\n\nВстань в планку и продержись сколько сможешь — потом пришли результат: например <b>0:30</b> или просто <b>30</b> (секунды). Это будет твой День 1.");
  }

  if (await getStep(env, uid) === "awaiting_first_time") {
    const sec = onboardSeconds(text);
    if (!sec) return sendMessage(env, chatId, "Не понял время 🤔 Пришли в формате <b>0:30</b> или просто <b>30</b> (секунды).");
    await ensureUser(env, uid, fullName);
    await upsertEntry(env, uid, new Date().toISOString().slice(0, 10), sec, "dm");
    await clearStep(env, uid);
    return showClaimCard(env, chatId, uid, true);
  }

  // default: show card if we have data, else start onboarding
  await ensureUser(env, uid, fullName);
  if ((await getEntries(env, uid)).length) return showClaimCard(env, chatId, uid);
  await setStep(env, uid, "awaiting_first_time");
  return sendMessage(env, chatId, "Пришли своё текущее время в планке — например <b>0:30</b> или <b>30</b>.");
}

async function showClaimCard(env, chatId, uid, justStarted = false) {
  const u = await getUserByUid(env, uid);
  const st = computeStats(await getEntries(env, uid));
  const base = env.PUBLIC_BASE || "https://plank.today";
  if (u.registered) {
    return sendMessage(env, chatId,
      `Твоя страница уже опубликована:\n${base}/u/${u.slug}\n\nДержишь <b>${fmt(st.current)}</b>, ×${st.multiplier}. Делись ссылкой! 🚀`);
  }
  const intro = justStarted ? "Готово, День 1 зафиксирован! 🎉\n\n" : "Я нашёл твою статистику в группе 👇\n\n";
  const body =
    `${intro}<b>${esc(u.first_name)}</b>\n` +
    `Сейчас: <b>${fmt(st.current)}</b>\n` +
    `Старт: ${fmt(st.start)} · рост ×${st.multiplier} · ${st.reports} дней\n\n` +
    `Опубликовать твою страницу и добавить в рейтинг на plank.today?`;
  return sendMessage(env, chatId, body, {
    reply_markup: {
      inline_keyboard: [[
        { text: "✅ Опубликовать", callback_data: "pub" },
        { text: "🔒 Приватно", callback_data: "priv" },
      ]],
    },
  });
}

async function handleCallback(env, cq) {
  const uid = String(cq.from.id);
  const data = cq.data;
  const chatId = cq.message?.chat?.id;
  if (data === "pub" || data === "priv") {
    await ensureUser(env, uid, fullNameOf(cq.from));
    await registerUser(env, uid, data === "pub");
    const u = await getUserByUid(env, uid);
    const base = env.PUBLIC_BASE || "https://plank.today";
    await answerCallback(env, cq.id, data === "pub" ? "Опубликовано!" : "Сохранено");
    const where = data === "pub"
      ? "Опубликовано и добавлено в рейтинг! 🏆"
      : "Сохранено как приватная страница (не в рейтинге).";
    await setStep(env, uid, "awaiting_photo");
    return sendMessage(env, chatId,
      `${where}\n\nТвоя ссылка:\n${base}/u/${u.slug}\n\n📸 Хочешь оживить страницу? Пришли мне фото или видео-кружок — добавлю на профиль. Или напиши /skip.`);
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

async function handleMedia(env, msg, uid, chatId) {
  if (!env.MEDIA) return sendMessage(env, chatId, "Загрузка медиа пока недоступна 🙏");

  let fileId, ext, ct;
  if (msg.video_note) { fileId = msg.video_note.file_id; ext = "mp4"; ct = "video/mp4"; }
  else if (msg.video) { fileId = msg.video.file_id; ext = "mp4"; ct = "video/mp4"; }
  else if (msg.photo) { fileId = msg.photo[msg.photo.length - 1].file_id; ext = "jpg"; ct = "image/jpeg"; }
  else return;

  const dl = await downloadFile(env, fileId);
  if (!dl) return sendMessage(env, chatId, "Не получилось скачать файл, попробуй ещё раз 🙏");
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
    return sendMessage(env, chatId, "Хранилище временно заполнено — загрузка на паузе. Мы уже знаем 🙏");
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
  return sendMessage(env, chatId, `Добавил на твою страницу ✅\n${base}/u/${u.slug}`);
}
