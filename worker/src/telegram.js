/** Thin Telegram Bot API helpers. */

export async function tg(env, method, params) {
  const res = await fetch(`https://api.telegram.org/bot${env.TG_BOT_TOKEN}/${method}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(params),
  });
  const data = await res.json();
  if (!data.ok) console.error("tg", method, JSON.stringify(data).slice(0, 300));
  return data;
}

export const sendMessage = (env, chatId, text, extra = {}) =>
  tg(env, "sendMessage", {
    chat_id: chatId, text, parse_mode: "HTML", disable_web_page_preview: true, ...extra,
  });

export const answerCallback = (env, id, text = "") =>
  tg(env, "answerCallbackQuery", { callback_query_id: id, text });

/** Resolve a Telegram file_id to a downloadable bytes Response. */
export async function downloadFile(env, fileId) {
  const f = await tg(env, "getFile", { file_id: fileId });
  if (!f.ok) return null;
  const path = f.result.file_path;
  const url = `https://api.telegram.org/file/bot${env.TG_BOT_TOKEN}/${path}`;
  const res = await fetch(url);
  if (!res.ok) return null;
  return { body: await res.arrayBuffer(), contentType: res.headers.get("content-type") || "application/octet-stream", path };
}
