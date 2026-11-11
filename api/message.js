// POST /api/message -> emails the contact-form message to Aakash (reply-to the sender).
import { mailConfigured } from "./_lib/config.js";
import { sendMessageToOwner } from "./_lib/mail.js";
import { EMAIL_RE, clean, cleanText, clientIp, json, limited, looksLikeBot, readJson, sameOrigin } from "./_lib/http.js";

async function handler(req) {
  if (!sameOrigin(req)) return json(403, { ok: false, error: "Forbidden." });
  if (limited("message", clientIp(req), 5)) return json(429, { ok: false, error: "Too many messages. Please try again in a few minutes." });
  if (!mailConfigured()) return json(503, { ok: false, error: "The contact form isn't available right now. Please reach me on LinkedIn." });

  const { body, error } = await readJson(req);
  if (error) return error;
  if (looksLikeBot(body)) return json(200, { ok: true });

  const fullName = clean(body.fullName, 120);
  const email = clean(body.email, 160).toLowerCase();
  const company = clean(body.company, 160);
  const message = cleanText(body.message, 4000);
  if (!fullName || !EMAIL_RE.test(email) || message.length < 2) {
    return json(400, { ok: false, error: "Please fill in your name, a valid email and a message." });
  }

  try {
    await sendMessageToOwner({ fullName, email, company, message });
    return json(200, { ok: true });
  } catch (err) {
    console.error("[message] send failed", err);
    return json(502, { ok: false, error: "Your message couldn't be sent. Please try again, or reach me on LinkedIn." });
  }
}

export const POST = handler;
