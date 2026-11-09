// GET /api/remind — run by Vercel Cron (see "crons" in vercel.json), once a day by default.
// Emails a reminder for every call starting REMIND_FROM_HOURS..REMIND_TO_HOURS from now (12-36 h),
// and deletes the stored contact details of calls that are over.
// Vercel sends "Authorization: Bearer <CRON_SECRET>"; without CRON_SECRET this endpoint stays off.
import { BOOKING, mailConfigured, secretConfigured } from "./_lib/config.js";
import { contactStarts, forgetContact, markReminded, readContact, wasReminded } from "./_lib/store.js";
import { sendReminder } from "./_lib/mail.js";
import { cancelToken } from "./_lib/secure.js";
import { json } from "./_lib/http.js";

export async function runReminders(now = new Date()) {
  const from = now.getTime() + BOOKING.remindFromHours * 3600_000;
  const to = now.getTime() + BOOKING.remindToHours * 3600_000;
  const result = { reminded: [], forgotten: [], failed: [] };
  for (const start of await contactStarts()) {
    const t = new Date(start).getTime();
    if (isNaN(t)) continue;
    // Over (with an hour's grace): delete what was kept for it.
    if (t < now.getTime() - 3600_000) {
      await forgetContact(start);
      result.forgotten.push(start);
      continue;
    }
    if (t < from || t >= to || (await wasReminded(start))) continue;
    const contact = await readContact(start);
    if (!contact) continue;
    if (!(await markReminded(start))) continue; // another run got there first
    try {
      await sendReminder({ ...contact, cancelUrl: `${BOOKING.siteUrl}/cancel#${cancelToken(contact.start, contact.uid)}` });
      result.reminded.push(start);
    } catch (err) {
      console.error("[remind] email failed", start, err);
      result.failed.push(start);
    }
  }
  return result;
}

async function handler(req) {
  const secret = (process.env.CRON_SECRET || "").trim();
  if (!secret) return json(503, { ok: false, error: "Reminders are off (no CRON_SECRET)." });
  if (req.headers.get("authorization") !== `Bearer ${secret}`) return json(401, { ok: false, error: "Unauthorized." });
  if (!mailConfigured() || !secretConfigured()) return json(503, { ok: false, error: "Reminders need mail settings and BOOKING_SECRET." });
  try {
    const r = await runReminders();
    return json(200, { ok: true, reminded: r.reminded.length, forgotten: r.forgotten.length, failed: r.failed.length });
  } catch (err) {
    console.error("[remind]", err);
    return json(500, { ok: false, error: "Reminder run failed." });
  }
}

export const GET = handler;
