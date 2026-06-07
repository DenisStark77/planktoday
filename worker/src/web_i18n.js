/** Web (profile + leaderboard) translations, by VIEWER language.
 * Detected from Accept-Language; falls back to English. Bot strings live in i18n.js. */

export const WLANGS = ["ru", "en", "es", "ar"];

/** Pick ru/en/es/ar from an Accept-Language header; default English. */
export function pickLang(accept) {
  if (!accept) return "en";
  for (const part of String(accept).toLowerCase().split(",")) {
    const code = part.split(";")[0].trim().slice(0, 2);
    if (WLANGS.includes(code)) return code;
  }
  return "en";
}

/** Localized "N days" (full word). */
export function daysWord(lang, n) {
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

const WSTR = {
  ru: {
    brand: "Планка +1%",
    profile_tag: "/ профиль",
    status_active: "практикует сейчас",
    status_paused: "пауза {n} дн.",
    holding_now: "сейчас держит",
    stat_start: "Старт",
    stat_growth: "Рост",
    stat_days: "Дней практики",
    stat_streak: "Лучшая серия",
    stat_comebacks: "Возвращений",
    cta_start: "Начать свою планку →",
    btn_share: "Поделиться",
    title_ig: "Поделиться картинкой (Instagram, Stories)",
    title_copy: "Скопировать ссылку",
    chart_title: "Рост по дням",
    chart_nodata: "Недостаточно данных для графика",
    chart_aria: "Рост времени планки",
    chart_day0: "день 0",
    chart_today: "сегодня",
    chart_plus: "+{n} дн.",
    legend_path: "твой путь",
    legend_proj: "прогноз +1%/день на 70 дней вперёд",
    toast_copied: "Ссылка скопирована",
    toast_img: "Картинка открыта — сохрани и выложи в Stories",
    days_short: "дн.",
    prof_meta: "{start} → {peak}, ×{mult} за {days}.",
    share_text: "{name}: планка {start} → {peak} (×{mult}). Маленький шаг каждый день. {base}",
    lb_h1: "Рейтинг участников",
    lb_desc: "Реальные результаты практикующих планку +1% каждый день.",
    lb_summary: "{n} в рейтинге · {dot_a} {a} активны · {dot_p} {p} на паузе",
    lb_empty_list: "Пока никого нет",
    lb_empty_all: "Пока никто не зарегистрировался. Откройте бота @plank_today_bot и нажмите «Опубликовать».",
    methodology: "← о методологии «Планка +1%»",
    nf_title: "Не найдено — Планка +1%",
    nf_h1: "Не найдено",
    nf_body: "Эта страница не существует или участник ещё не зарегистрировался.",
  },
  en: {
    brand: "Plank +1%",
    profile_tag: "/ profile",
    status_active: "practicing now",
    status_paused: "paused {n}d",
    holding_now: "holding now",
    stat_start: "Start",
    stat_growth: "Growth",
    stat_days: "Days practiced",
    stat_streak: "Best streak",
    stat_comebacks: "Comebacks",
    cta_start: "Start your plank →",
    btn_share: "Share",
    title_ig: "Share image (Instagram, Stories)",
    title_copy: "Copy link",
    chart_title: "Daily growth",
    chart_nodata: "Not enough data for a chart",
    chart_aria: "Plank time growth",
    chart_day0: "day 0",
    chart_today: "today",
    chart_plus: "+{n}d",
    legend_path: "your path",
    legend_proj: "+1%/day projection, 70 days ahead",
    toast_copied: "Link copied",
    toast_img: "Image opened — save it and post to Stories",
    days_short: "d",
    prof_meta: "{start} → {peak}, ×{mult} over {days}.",
    share_text: "{name}: plank {start} → {peak} (×{mult}). A small step every day. {base}",
    lb_h1: "Leaderboard",
    lb_desc: "Real results from people doing the +1% plank every day.",
    lb_summary: "{n} ranked · {dot_a} {a} active · {dot_p} {p} paused",
    lb_empty_list: "Nobody yet",
    lb_empty_all: "No one has registered yet. Open @plank_today_bot and tap «Publish».",
    methodology: "← about the «Plank +1%» method",
    nf_title: "Not found — Plank +1%",
    nf_h1: "Not found",
    nf_body: "This page doesn't exist or the member hasn't registered yet.",
  },
  es: {
    brand: "Plancha +1%",
    profile_tag: "/ perfil",
    status_active: "practicando ahora",
    status_paused: "pausa {n}d",
    holding_now: "aguanta ahora",
    stat_start: "Inicio",
    stat_growth: "Crecimiento",
    stat_days: "Días practicados",
    stat_streak: "Mejor racha",
    stat_comebacks: "Regresos",
    cta_start: "Empieza tu plancha →",
    btn_share: "Compartir",
    title_ig: "Compartir imagen (Instagram, Stories)",
    title_copy: "Copiar enlace",
    chart_title: "Crecimiento diario",
    chart_nodata: "Datos insuficientes para el gráfico",
    chart_aria: "Crecimiento del tiempo de plancha",
    chart_day0: "día 0",
    chart_today: "hoy",
    chart_plus: "+{n}d",
    legend_path: "tu camino",
    legend_proj: "proyección +1%/día, 70 días",
    toast_copied: "Enlace copiado",
    toast_img: "Imagen abierta — guárdala y publícala en Stories",
    days_short: "d",
    prof_meta: "{start} → {peak}, ×{mult} en {days}.",
    share_text: "{name}: plancha {start} → {peak} (×{mult}). Un pequeño paso cada día. {base}",
    lb_h1: "Clasificación",
    lb_desc: "Resultados reales de quienes hacen la plancha +1% cada día.",
    lb_summary: "{n} en la clasificación · {dot_a} {a} activos · {dot_p} {p} en pausa",
    lb_empty_list: "Nadie todavía",
    lb_empty_all: "Nadie se ha registrado aún. Abre @plank_today_bot y pulsa «Publicar».",
    methodology: "← sobre el método «Plancha +1%»",
    nf_title: "No encontrado — Plancha +1%",
    nf_h1: "No encontrado",
    nf_body: "Esta página no existe o el miembro aún no se ha registrado.",
  },
  ar: {
    brand: "بلانك +1%",
    profile_tag: "/ الملف",
    status_active: "يمارس الآن",
    status_paused: "متوقّف {n} ي",
    holding_now: "يثبت الآن",
    stat_start: "البداية",
    stat_growth: "النمو",
    stat_days: "أيام الممارسة",
    stat_streak: "أفضل سلسلة",
    stat_comebacks: "العودات",
    cta_start: "ابدأ تمرينك →",
    btn_share: "مشاركة",
    title_ig: "مشاركة صورة (Instagram، Stories)",
    title_copy: "نسخ الرابط",
    chart_title: "النمو اليومي",
    chart_nodata: "بيانات غير كافية للرسم البياني",
    chart_aria: "نمو زمن البلانك",
    chart_day0: "اليوم 0",
    chart_today: "اليوم",
    chart_plus: "+{n} ي",
    legend_path: "مسارك",
    legend_proj: "توقّع +1%/يوم، 70 يومًا",
    toast_copied: "تم نسخ الرابط",
    toast_img: "فُتحت الصورة — احفظها وانشرها في Stories",
    days_short: "ي",
    prof_meta: "{start} → {peak}، ×{mult} خلال {days}.",
    share_text: "{name}: بلانك {start} → {peak} (×{mult}). خطوة صغيرة كل يوم. {base}",
    lb_h1: "التصنيف",
    lb_desc: "نتائج حقيقية لممارسي بلانك +1% كل يوم.",
    lb_summary: "{n} في التصنيف · {dot_a} {a} نشِط · {dot_p} {p} متوقّف",
    lb_empty_list: "لا أحد بعد",
    lb_empty_all: "لم يسجّل أحد بعد. افتح @plank_today_bot واضغط «نشر».",
    methodology: "← عن منهجية «بلانك +1%»",
    nf_title: "غير موجود — بلانك +1%",
    nf_h1: "غير موجود",
    nf_body: "هذه الصفحة غير موجودة أو لم يسجّل العضو بعد.",
  },
};

/** Leaderboard board name + description by language, keyed by board.key. */
export const BOARD_T = {
  endurance: {
    ru: { name: "Выносливость", desc: "Способность продолжительное время преодолевать дискомфорт для достижения цели." },
    en: { name: "Endurance", desc: "The ability to push through discomfort for a long time to reach a goal." },
    es: { name: "Resistencia", desc: "La capacidad de superar la incomodidad durante mucho tiempo para alcanzar una meta." },
    ar: { name: "التحمّل", desc: "القدرة على تحمّل الانزعاج لفترة طويلة لبلوغ الهدف." },
  },
  exp: {
    ru: { name: "Экспонента", desc: "Многократно вырасти можно, делая малые шаги каждый день." },
    en: { name: "Exponent", desc: "You can grow many times over by taking small steps every day." },
    es: { name: "Exponente", desc: "Puedes crecer muchas veces dando pequeños pasos cada día." },
    ar: { name: "الأُسّ", desc: "يمكنك أن تنمو أضعافًا مضاعفة بخطوات صغيرة كل يوم." },
  },
  discipline: {
    ru: { name: "Дисциплина", desc: "Продолжать без пропусков несмотря ни на какие обстоятельства." },
    en: { name: "Discipline", desc: "Keep going without skipping, no matter the circumstances." },
    es: { name: "Disciplina", desc: "Continuar sin faltar, pase lo que pase." },
    ar: { name: "الانضباط", desc: "الاستمرار دون انقطاع مهما كانت الظروف." },
  },
  commitment: {
    ru: { name: "Приверженность", desc: "Результат от планки накапливается, даже если ты делаешь пропуски." },
    en: { name: "Commitment", desc: "Plank results add up even if you miss some days." },
    es: { name: "Compromiso", desc: "Los resultados de la plancha se acumulan aunque faltes algunos días." },
    ar: { name: "الالتزام", desc: "نتائج البلانك تتراكم حتى لو فاتتك بعض الأيام." },
  },
  comebacks: {
    ru: { name: "Возвращения", desc: "Начать заново после того, как бросил — редкая способность." },
    en: { name: "Comebacks", desc: "Starting again after quitting is a rare ability." },
    es: { name: "Regresos", desc: "Empezar de nuevo tras abandonar es una habilidad rara." },
    ar: { name: "العودات", desc: "البدء من جديد بعد التوقّف قدرة نادرة." },
  },
  firststep: {
    ru: { name: "Первый шаг", desc: "Самое трудное — это первый раз встать в планку." },
    en: { name: "First step", desc: "The hardest part is getting into a plank for the first time." },
    es: { name: "Primer paso", desc: "Lo más difícil es ponerse en plancha por primera vez." },
    ar: { name: "الخطوة الأولى", desc: "الأصعب هو الدخول في البلانك لأول مرة." },
  },
  invites: {
    ru: { name: "Приглашения", desc: "Сколько практикующих ты привёл. Рост сообщества — общее дело." },
    en: { name: "Invitations", desc: "How many practitioners you brought in. Growing the community is a shared effort." },
    es: { name: "Invitaciones", desc: "Cuántos practicantes trajiste. Hacer crecer la comunidad es cosa de todos." },
    ar: { name: "الدعوات", desc: "كم ممارسًا جلبت. نمو المجتمع مسؤولية مشتركة." },
  },
};

export function boardName(lang, key) { return (BOARD_T[key]?.[lang] || BOARD_T[key]?.en).name; }
export function boardDesc(lang, key) { return (BOARD_T[key]?.[lang] || BOARD_T[key]?.en).desc; }

/** Translate web key with {placeholder} interpolation. */
export function tw(lang, key, p = {}) {
  const l = WSTR[lang] ? lang : "en";
  const s = (WSTR[l] && WSTR[l][key]) || WSTR.en[key] || key;
  return s.replace(/\{(\w+)\}/g, (_, k) => (p[k] != null ? p[k] : ""));
}
