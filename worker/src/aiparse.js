/**
 * LLM fallback for AMBIGUOUS plank reports. Called from bot.js ONLY when the
 * algorithmic parser (parser.js) returned null but a time token is present — so
 * the model handles the messy conversational cases ("держал 10 минут сегодня",
 * "10 минут, тяжело было") while clean reports never hit the LLM.
 *
 * Returns seconds:int (a confident report) or null (not a report / unsure).
 */
const MODEL = "@cf/meta/llama-3.3-70b-instruct-fp8-fast";

const SYS =
  "You classify ONE message from a daily plank-challenge group chat. Decide if it " +
  "is the author reporting THEIR OWN plank time held today (an actual result), as " +
  "opposed to discussing, asking, planning, joking, quoting, or mentioning a time " +
  "in general. If — and only if — it is a real report, give the duration in WHOLE " +
  "SECONDS (1 минута/min = 60 s). Reply with ONLY compact JSON, nothing else: " +
  '{"report": <true|false>, "seconds": <integer or null>}.';

// Few-shot anchors (cover RU/EN, with/without trailing chatter, and non-reports).
const EXAMPLES = [
  ["10 минут", '{"report": true, "seconds": 600}'],
  ["3 мин 20 сек 💪", '{"report": true, "seconds": 200}'],
  ["сегодня держал 5 минут, было тяжело но дотерпел", '{"report": true, "seconds": 300}'],
  ["finally hit 4:30 today!", '{"report": true, "seconds": 270}'],
  ["давай встретимся в 5:01", '{"report": false, "seconds": null}'],
  ["я обычно делаю по 3 минуты", '{"report": false, "seconds": null}'],
  ["а сколько вы держите?", '{"report": false, "seconds": null}'],
];

export async function aiClassifyReport(env, text) {
  if (!env.AI || !text) return null;
  try {
    const messages = [{ role: "system", content: SYS }];
    for (const [u, a] of EXAMPLES) {
      messages.push({ role: "user", content: u }, { role: "assistant", content: a });
    }
    messages.push({ role: "user", content: String(text).slice(0, 400) });

    const r = await env.AI.run(MODEL, { messages, max_tokens: 40, temperature: 0 });
    const out = (r && (r.response || (r.result && r.result.response))) || "";
    const m = out.match(/\{[^{}]*\}/);
    if (!m) return null;
    const j = JSON.parse(m[0]);
    if (j.report !== true) return null;
    const sec = Math.round(Number(j.seconds));
    return Number.isFinite(sec) && sec >= 3 && sec <= 3600 ? sec : null;
  } catch (e) {
    console.error("aiClassifyReport error", e);
    return null;
  }
}
