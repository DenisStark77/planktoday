/**
 * Daily reminder feature — see worker/NOTES.md → "Daily reminders".
 *
 * Timezones: only 4 coarse zones (decision — keep the picker tiny). The zone +
 * hour live on ONE screen so a user in e.g. Berlin can pick "London" and nudge
 * the hour to compensate. IANA zones make DST correct; the hourly cron sends the
 * nudge during the chosen local hour (exact minute varies by the zone's offset).
 */
import { sendMessage, answerCallback, editMessageText } from "./telegram.js";
import {
  getUserByUid, setReminder, disableReminder, markReminderOffered,
  setReminderLast, reminderCandidates, reminderOfferTargets, fmt,
} from "./db.js";
import { t } from "./i18n.js";

export const ZONES = [
  { code: "lon", iana: "Europe/London",    label: { ru: "Лондон",   en: "London",   es: "Londres",    ar: "لندن" } },
  { code: "nyc", iana: "America/New_York", label: { ru: "Нью-Йорк", en: "New York", es: "Nueva York", ar: "نيويورك" } },
  { code: "msk", iana: "Europe/Moscow",    label: { ru: "Москва",   en: "Moscow",   es: "Moscú",      ar: "موسكو" } },
  { code: "syd", iana: "Australia/Sydney", label: { ru: "Сидней",   en: "Sydney",   es: "Sídney",     ar: "سيدني" } },
];
const HOURS = [6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23];
const INACTIVE_PAUSE_DAYS = 12;

const byCode = (code) => ZONES.find((z) => z.code === code);
const byIana = (iana) => ZONES.find((z) => z.iana === iana);
const zoneLabel = (z, lang) => (z && (z.label[lang] || z.label.en)) || "";
const hh = (h) => String(h).padStart(2, "0");

/** Local {date:'YYYY-MM-DD', hour:Number} for an instant in an IANA zone. */
export function localParts(date, iana) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: iana, year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", hour12: false,
  }).formatToParts(date);
  const get = (type) => parts.find((x) => x.type === type)?.value;
  let hour = parseInt(get("hour"), 10);
  if (hour === 24) hour = 0; // some ICU builds emit '24' at midnight
  return { date: `${get("year")}-${get("month")}-${get("day")}`, hour };
}

function defaultSel(lang) {
  return { code: lang === "ru" ? "msk" : "lon", hour: 8 };
}

/** Combined zone+hour picker on one screen: {text, reply_markup}. */
function picker(lang, code, hour) {
  const z = byCode(code) || ZONES[0];
  const text = t(lang, "reminder_pick", { zone: zoneLabel(z, lang), hour: hh(hour) });
  const zoneRow = ZONES.map((zz) => ({
    text: (zz.code === code ? "✅ " : "") + zoneLabel(zz, lang),
    callback_data: `rz:${zz.code}:${hour}`,
  }));
  const hourRows = [];
  for (let i = 0; i < HOURS.length; i += 6) {
    hourRows.push(HOURS.slice(i, i + 6).map((h) => ({
      text: h === hour ? `· ${h} ·` : `${h}`,
      callback_data: `rh:${h}:${code}`,
    })));
  }
  return {
    text,
    reply_markup: {
      inline_keyboard: [
        zoneRow,
        ...hourRows,
        [
          { text: t(lang, "btn_save"), callback_data: `rk:${code}:${hour}` },
          { text: t(lang, "btn_off"), callback_data: "rx" },
        ],
      ],
    },
  };
}

/** /remind — open the picker as a fresh message, prefilled with current setting. */
export async function openPicker(env, chatId, u) {
  const lang = (u && u.lang) || "ru";
  let code, hour;
  if (u && u.tz && u.reminder_hour != null) {
    code = (byIana(u.tz) || ZONES[0]).code;
    hour = u.reminder_hour;
  } else {
    ({ code, hour } = defaultSel(lang));
  }
  const p = picker(lang, code, hour);
  return sendMessage(env, chatId, p.text, { reply_markup: p.reply_markup });
}

/** One-time opt-in offer with Yes/No. */
export async function offerReminder(env, chatId, lang) {
  return sendMessage(env, chatId, t(lang, "reminder_offer"), {
    reply_markup: { inline_keyboard: [[
      { text: t(lang, "btn_yes"), callback_data: "ro:y" },
      { text: t(lang, "btn_no"), callback_data: "ro:n" },
    ]] },
  });
}

/** Handle reminder callback queries. Returns true iff it handled cq.data. */
export async function handleReminderCallback(env, cq) {
  const data = cq.data || "";
  if (!(data === "rx" || /^(rz|rh|rk|ro):/.test(data))) return false;
  const uid = String(cq.from.id);
  const chatId = cq.message?.chat?.id;
  const msgId = cq.message?.message_id;
  const u = await getUserByUid(env, uid);
  const lang = (u && u.lang) || "ru";

  if (data.startsWith("rz:")) {
    const [, code, hour] = data.split(":");
    const p = picker(lang, code, parseInt(hour, 10));
    await editMessageText(env, chatId, msgId, p.text, { reply_markup: p.reply_markup });
    await answerCallback(env, cq.id);
    return true;
  }
  if (data.startsWith("rh:")) {
    const [, hour, code] = data.split(":");
    const p = picker(lang, code, parseInt(hour, 10));
    await editMessageText(env, chatId, msgId, p.text, { reply_markup: p.reply_markup });
    await answerCallback(env, cq.id);
    return true;
  }
  if (data.startsWith("rk:")) {
    const [, code, hourS] = data.split(":");
    const z = byCode(code) || ZONES[0];
    const hour = parseInt(hourS, 10);
    await setReminder(env, uid, z.iana, hour);
    await answerCallback(env, cq.id, t(lang, "cb_saved"));
    await editMessageText(env, chatId, msgId,
      t(lang, "reminder_saved", { zone: zoneLabel(z, lang), hour: hh(hour) }),
      { reply_markup: { inline_keyboard: [] } });
    return true;
  }
  if (data === "rx") {
    await disableReminder(env, uid);
    await answerCallback(env, cq.id, t(lang, "cb_saved"));
    await editMessageText(env, chatId, msgId, t(lang, "reminder_off_done"),
      { reply_markup: { inline_keyboard: [] } });
    return true;
  }
  if (data === "ro:y") {
    await markReminderOffered(env, uid);
    await answerCallback(env, cq.id);
    const { code, hour } = defaultSel(lang);
    const p = picker(lang, code, hour);
    await editMessageText(env, chatId, msgId, p.text, { reply_markup: p.reply_markup });
    return true;
  }
  if (data === "ro:n") {
    await markReminderOffered(env, uid);
    await answerCallback(env, cq.id);
    await editMessageText(env, chatId, msgId, t(lang, "reminder_offer_declined"),
      { reply_markup: { inline_keyboard: [] } });
    return true;
  }
  return false;
}

function daysBetween(a, b) {
  return Math.round((Date.parse(b) - Date.parse(a)) / 86400000);
}

/** Returns true if delivered; auto-disables on a hard send failure (e.g. blocked). */
async function deliver(env, uid, text) {
  const r = await sendMessage(env, uid, text);
  if (r && r.ok) return true;
  // 403 = bot blocked / can't initiate; 400 = chat not found. Stop nagging.
  if (r && (r.error_code === 403 || r.error_code === 400)) await disableReminder(env, uid);
  return false;
}

/** Hourly cron: nudge users at their local hour who haven't planked today. */
export async function runReminderTick(env, now = new Date()) {
  const rows = await reminderCandidates(env);
  let sent = 0;
  for (const u of rows) {
    const { date: localDate, hour: localHour } = localParts(now, u.tz);
    if (localHour !== u.reminder_hour) continue;       // not their hour
    if (u.reminder_last === localDate) continue;        // already nudged today (dedupe)
    const lang = u.lang || "ru";

    // Auto-pause after a long absence: one warm farewell, then off.
    if (u.last_day && daysBetween(u.last_day, localDate) > INACTIVE_PAUSE_DAYS) {
      await deliver(env, u.uid, t(lang, "reminder_final"));
      await disableReminder(env, u.uid);
      continue;
    }
    if (u.last_day === localDate) continue;             // already planked today → no nag

    const target = u.last_sec ? fmt(Math.round(u.last_sec * 1.01)) : null;
    const text = target
      ? t(lang, "reminder_nudge", { target })
      : t(lang, "reminder_nudge_first");
    if (await deliver(env, u.uid, text)) {
      await setReminderLast(env, u.uid, localDate);
      sent++;
    }
  }
  return sent;
}

/** One-time opt-in broadcast (admin-triggered). Marks each user offered so it
 * never double-sends; skips unreachable users. */
export async function broadcastReminderOffer(env, limit = 1000) {
  const targets = (await reminderOfferTargets(env)).slice(0, limit);
  let delivered = 0;
  for (const u of targets) {
    const r = await offerReminder(env, u.uid, u.lang || "ru");
    await markReminderOffered(env, u.uid); // mark regardless: don't retry unreachable users
    if (r && r.ok) delivered++;
  }
  return { attempted: targets.length, delivered };
}
