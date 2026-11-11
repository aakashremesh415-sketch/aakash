// POST /api/cancel { token, action: "lookup" | "cancel", rebooking? }
// The token comes from the link in the confirmation email (/cancel#<token>). It is signed with
// BOOKING_SECRET over the call's start time and its private uid, so it can't be guessed or edited.
import { mailConfigured } from "./_lib/config.js";
import { readContact, release } from "./_lib/store.js";
import { sendCancellation } from "./_lib/mail.js";
import { deleteMeetMeeting } from "./_lib/meet.js";
import { deleteTeamsMeeting } from "./_lib/teams.js";
import { tokenMatches, tokenStart } from "./_lib/secure.js";
import { clean, clientIp, json, limited, readJson, sameOrigin } from "./_lib/http.js";

const NOT_FOUND = { ok: false, error: "This link is no longer valid. The call may already be cancelled or over. Reply to your confirmation email if you need help." };

async function handler(req) {
  if (!sameOrigin(req)) return json(403, { ok: false, error: "Forbidden." });
  if (limited("cancel", clientIp(req), 10)) return json(429, { ok: false, error: "Too many requests. Please try again in a few minutes." });
  if (!mailConfigured()) return json(503, { ok: false, error: "This isn't available right now. Please reply to your confirmation email." });

  const { body, error } = await readJson(req);
  if (error) return error;
  const token = clean(body.token, 200);
  const start = tokenStart(token);
  if (!start) return json(404, NOT_FOUND);

  try {
    const contact = await readContact(start);
    if (!contact || !tokenMatches(token, start, contact.uid)) return json(404, NOT_FOUND);
    if (new Date(contact.start) <= new Date()) {
      return json(410, { ok: false, error: "This call has already started or finished, so it can't be cancelled online." });
    }
    const summary = { start: contact.start, end: contact.end, durationMin: contact.durationMin, firstName: contact.fullName.split(" ")[0] };
    if (body.action !== "cancel") return json(200, { ok: true, booking: summary });

    await release(contact);
    if (contact.eventId) {
      const remove = contact.meetingProvider === "Microsoft Teams" ? deleteTeamsMeeting : deleteMeetMeeting;
      await remove(contact.eventId).catch((err) => console.error("[cancel] couldn't delete the meeting", err));
    }
    await sendCancellation(contact, { rebooking: Boolean(body.rebooking) });
    return json(200, { ok: true, cancelled: true, booking: summary });
  } catch (err) {
    console.error("[cancel]", err);
    return json(500, { ok: false, error: "Something went wrong. Please try again, or reply to your confirmation email." });
  }
}

export const POST = handler;
