/** Bot message translations. t(lang, key, params) with {placeholder} interpolation. */

const STR = {
  ru: {
    onboard: "Привет! 🙌 Это <b>Планка +1%</b>.\n\nВстань в планку и продержись сколько сможешь — потом пришли результат: например <b>0:30</b> или просто <b>30</b> (секунды). Это будет твой День 1.",
    bad_time: "Не понял время 🤔 Пришли в формате <b>0:30</b> или просто <b>30</b> (секунды).",
    ask_time: "Пришли своё текущее время в планке — например <b>0:30</b> или <b>30</b>.",
    already: "Твоя страница уже опубликована:\n{url}\n\nДержишь <b>{cur}</b>, ×{mult}. Делись ссылкой! 🚀",
    intro_started: "Готово, День 1 зафиксирован! 🎉\n\n",
    intro_found: "Я нашёл твою статистику в группе 👇\n\n",
    card_body: "{intro}<b>{name}</b>\nСейчас: <b>{cur}</b>\nСтарт: {start} · рост ×{mult} · {days}\n\nОпубликовать твою страницу и добавить в рейтинг на plank.today?",
    btn_publish: "✅ Опубликовать",
    btn_private: "🔒 Приватно",
    cb_published: "Опубликовано!",
    cb_saved: "Сохранено",
    where_public: "Опубликовано и добавлено в рейтинг! 🏆",
    where_private: "Сохранено как приватная страница (не в рейтинге).",
    after_claim: "{where}\n\nТвоя ссылка:\n{url}\n\n👥 Ежедневное сообщество (на русском): {group}\n\n📸 Хочешь оживить страницу? Пришли фото или видео-кружок. Или напиши /skip.",
    media_unavailable: "Загрузка медиа пока недоступна 🙏",
    media_dl_fail: "Не получилось скачать файл, попробуй ещё раз 🙏",
    storage_full: "Хранилище временно заполнено — загрузка на паузе. Мы уже знаем 🙏",
    media_added: "Добавил на твою страницу ✅\n{url}",
    skip_done: "Ок! Твоя страница готова:\n{url}",
  },
  en: {
    onboard: "Hi! 🙌 This is <b>Plank +1%</b>.\n\nHold a plank as long as you can, then send me the result — e.g. <b>0:30</b> or just <b>30</b> (seconds). That's your Day 1.",
    bad_time: "I didn't get the time 🤔 Send it as <b>0:30</b> or just <b>30</b> (seconds).",
    ask_time: "Send your current plank time — e.g. <b>0:30</b> or <b>30</b>.",
    already: "Your page is already published:\n{url}\n\nYou're holding <b>{cur}</b>, ×{mult}. Share the link! 🚀",
    intro_started: "Done — Day 1 logged! 🎉\n\n",
    intro_found: "I found your stats in the group 👇\n\n",
    card_body: "{intro}<b>{name}</b>\nNow: <b>{cur}</b>\nStart: {start} · growth ×{mult} · {days}\n\nPublish your page and add you to the leaderboard on plank.today?",
    btn_publish: "✅ Publish",
    btn_private: "🔒 Private",
    cb_published: "Published!",
    cb_saved: "Saved",
    where_public: "Published and added to the leaderboard! 🏆",
    where_private: "Saved as a private page (not on the leaderboard).",
    after_claim: "{where}\n\nYour link:\n{url}\n\n👥 Daily community (in Russian): {group}\n\n📸 Want to bring your page to life? Send a photo or a video circle. Or type /skip.",
    media_unavailable: "Media upload isn't available yet 🙏",
    media_dl_fail: "Couldn't download the file, try again 🙏",
    storage_full: "Storage is temporarily full — uploads paused. We're on it 🙏",
    media_added: "Added to your page ✅\n{url}",
    skip_done: "OK! Your page is ready:\n{url}",
  },
  es: {
    onboard: "¡Hola! 🙌 Esto es <b>Plancha +1%</b>.\n\nHaz la plancha el máximo que puedas y envíame el resultado — p. ej. <b>0:30</b> o solo <b>30</b> (segundos). Será tu Día 1.",
    bad_time: "No entendí el tiempo 🤔 Envíalo como <b>0:30</b> o solo <b>30</b> (segundos).",
    ask_time: "Envía tu tiempo actual de plancha — p. ej. <b>0:30</b> o <b>30</b>.",
    already: "Tu página ya está publicada:\n{url}\n\nAguantas <b>{cur}</b>, ×{mult}. ¡Comparte el enlace! 🚀",
    intro_started: "¡Listo, Día 1 registrado! 🎉\n\n",
    intro_found: "Encontré tus estadísticas en el grupo 👇\n\n",
    card_body: "{intro}<b>{name}</b>\nAhora: <b>{cur}</b>\nInicio: {start} · crecimiento ×{mult} · {days}\n\n¿Publicar tu página y añadirte al ranking en plank.today?",
    btn_publish: "✅ Publicar",
    btn_private: "🔒 Privado",
    cb_published: "¡Publicado!",
    cb_saved: "Guardado",
    where_public: "¡Publicado y añadido al ranking! 🏆",
    where_private: "Guardado como página privada (no en el ranking).",
    after_claim: "{where}\n\nTu enlace:\n{url}\n\n👥 Comunidad diaria (en ruso): {group}\n\n📸 ¿Quieres dar vida a tu página? Envía una foto o un video círculo. O escribe /skip.",
    media_unavailable: "La subida de medios aún no está disponible 🙏",
    media_dl_fail: "No se pudo descargar el archivo, inténtalo de nuevo 🙏",
    storage_full: "El almacenamiento está lleno temporalmente — subidas en pausa. Ya lo sabemos 🙏",
    media_added: "Añadido a tu página ✅\n{url}",
    skip_done: "¡Listo! Tu página está lista:\n{url}",
  },
  ar: {
    onboard: "مرحبًا! 🙌 هذا <b>بلانك ‎+1%‎</b>.\n\nثبّت وضعية البلانك أطول ما تستطيع، ثم أرسل لي النتيجة — مثلاً <b>0:30</b> أو فقط <b>30</b> (ثانية). سيكون هذا يومك الأول.",
    bad_time: "لم أفهم الوقت 🤔 أرسله بصيغة <b>0:30</b> أو فقط <b>30</b> (ثانية).",
    ask_time: "أرسل وقت البلانك الحالي — مثلاً <b>0:30</b> أو <b>30</b>.",
    already: "صفحتك منشورة بالفعل:\n{url}\n\nتثبت <b>{cur}</b>، ×{mult}. شارك الرابط! 🚀",
    intro_started: "تم — تسجيل اليوم الأول! 🎉\n\n",
    intro_found: "وجدت إحصائياتك في المجموعة 👇\n\n",
    card_body: "{intro}<b>{name}</b>\nالآن: <b>{cur}</b>\nالبداية: {start} · النمو ×{mult} · {days}\n\nهل تنشر صفحتك وتنضم إلى التصنيف على plank.today؟",
    btn_publish: "✅ نشر",
    btn_private: "🔒 خاص",
    cb_published: "تم النشر!",
    cb_saved: "تم الحفظ",
    where_public: "تم النشر وأُضيفت إلى التصنيف! 🏆",
    where_private: "حُفظت كصفحة خاصة (ليست في التصنيف).",
    after_claim: "{where}\n\nرابطك:\n{url}\n\n👥 مجتمع يومي (بالروسية): {group}\n\n📸 هل تريد إثراء صفحتك؟ أرسل صورة أو مقطع فيديو دائري. أو اكتب ‎/skip‎.",
    media_unavailable: "رفع الوسائط غير متاح بعد 🙏",
    media_dl_fail: "تعذّر تنزيل الملف، حاول مرة أخرى 🙏",
    storage_full: "التخزين ممتلئ مؤقتًا — الرفع متوقف. نحن على علم 🙏",
    media_added: "أُضيف إلى صفحتك ✅\n{url}",
    skip_done: "تمام! صفحتك جاهزة:\n{url}",
  },
};

export function t(lang, key, p = {}) {
  const l = STR[lang] ? lang : "en";
  let s = (STR[l] && STR[l][key]) || STR.en[key] || key;
  return s.replace(/\{(\w+)\}/g, (_, k) => (p[k] != null ? p[k] : ""));
}

/** Localized day count, e.g. daysStr('ru',274) -> '274 дня'. */
export function daysStr(lang, n) {
  if (lang === "ru") {
    const m10 = n % 10, m100 = n % 100;
    const w = (m10 === 1 && m100 !== 11) ? "день"
      : (m10 >= 2 && m10 <= 4 && !(m100 >= 12 && m100 <= 14)) ? "дня" : "дней";
    return `${n} ${w}`;
  }
  if (lang === "es") return `${n} ${n === 1 ? "día" : "días"}`;
  if (lang === "ar") return `${n} يوم`;
  return `${n} ${n === 1 ? "day" : "days"}`;
}

/** Human language name for the welcome-back AI prompt. */
export function langName(lang) {
  return { ru: "русском", en: "English", es: "español", ar: "العربية" }[lang] || "English";
}

/** Rotating warm fallbacks if the AI greeting fails. */
const FALLBACKS = {
  ru: [
    (n) => `С возвращением, ${n}! 🙌 Рад снова видеть тебя в планке.`,
    (n) => `${n}, ты вернулся! 💪 Снова начать — это и есть победа.`,
    (n) => `Снова в строю, ${n}! 🔥 Маленький шаг — уже большой.`,
  ],
  en: [
    (n) => `Welcome back, ${n}! 🙌 Great to see you planking again.`,
    (n) => `${n}, you're back! 💪 Starting again is the real win.`,
    (n) => `Back in action, ${n}! 🔥 A tiny step is already big.`,
  ],
  es: [
    (n) => `¡Bienvenido de nuevo, ${n}! 🙌 Me alegra verte otra vez en la plancha.`,
    (n) => `¡${n}, has vuelto! 💪 Empezar de nuevo ya es ganar.`,
    (n) => `¡De vuelta, ${n}! 🔥 Un paso pequeño ya es grande.`,
  ],
  ar: [
    (n) => `أهلاً بعودتك يا ${n}! 🙌 سعيد برؤيتك في البلانك من جديد.`,
    (n) => `${n}، لقد عدت! 💪 أن تبدأ من جديد هو الانتصار الحقيقي.`,
    (n) => `عدت إلى الميدان يا ${n}! 🔥 خطوة صغيرة تكفي.`,
  ],
};

export function welcomeFallback(lang, name, idx) {
  const arr = FALLBACKS[lang] || FALLBACKS.en;
  return arr[idx % arr.length](name);
}
