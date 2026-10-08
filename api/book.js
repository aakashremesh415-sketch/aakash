// POST /api/book -> reserves a slot, emails Aakash, then sends the visitor a confirmation + invite.
import { randomUUID } from "node:crypto";
import { BOOKING, mailConfigured } from "./_lib/config.js";
import { isOfferedSlot, slotEnd } from "./_lib/slots.js";
import { busyBetween, release, reserve, upcomingCountForEmail } from "./_lib/store.js";
import { sendBookingConfirmation, sendBookingToOwner } from "./_lib/mail.js";
import { createTeamsMeeting, deleteTeamsMeeting, teamsConfigured } from "./_lib/teams.js";
import { createMeetMeeting, deleteMeetMeeting, meetConfigured } from "./_lib/meet.js";
import { EMAIL_RE, clean, cleanText, clientIp, json, limited, looksLikeBot, readJson, sameOrigin, validTz } from "./_lib/http.js";

async function handler(req) {
  if (!sameOrigin(req)) return json(403, { ok: false, error: "Forbidden." });
  if (limited("book", clientIp(req), 5)) return json(429, { ok: false, error: "Too many requests. Please try again in a few minutes." });
  if (!mailConfigured()) return json(503, { ok: false, error: "Online booking isn't available right now. Please send a message instead." });

  const { body, error } = await readJson(req);
  if (error) return error;
  // Pretend success so bots learn nothing.
  if (looksLikeBot(body)) return json(200, { ok: true, booking: { start: clean(body.start, 40) } });

  const fullName = clean(body.fullName, 120);
  const email = clean(body.email, 160).toLowerCase();
  const company = clean(body.company, 160);
  const notes = cleanText(body.notes, 1500);
  const tzIn = clean(body.timeZone, 64);
  const clientTz = validTz(tzIn) ? tzIn : BOOKING.hostTimeZone;
  const start = new Date(clean(body.start, 40));

  if (!fullName || !company || !EMAIL_RE.test(email) || isNaN(start.getTime())) {
    return json(400, { ok: false, error: "Please fill in your name, work email, company and a time." });
  }

  try {
    if ((await upcomingCountForEmail(email)) >= BOOKING.maxUpcomingPerEmail) {
      return json(409, { ok: false, error: "You already have upcoming calls booked. Reply to your confirmation email to change them." });
    }
    const busy = await busyBetween(new Date(start.getTime() - 86400_000), new Date(start.getTime() + 86400_000));
    if (!isOfferedSlot(start, busy)) {
      return json(409, { ok: false, error: "That time is no longer available. Please pick another slot." });
    }

    const booking = {
      uid: `${randomUUID()}@aakashremesh.com`,
      start: start.toISOString(),
      end: slotEnd(start).toISOString(),
      fullName, email, company, notes, clientTz,
      createdAt: new Date().toISOString(),
    };
    if (!(await reserve(booking))) {
      return json(409, { ok: false, error: "Someone just took that slot. Please pick another time." });
    }

    // A unique meeting for this call: Google Meet when connected, else Teams (Microsoft 365).
    // If the provider can't be reached the booking still goes ahead with MEETING_URL (or "link to follow").
    const provider = meetConfigured()
      ? { name: "Google Meet", create: createMeetMeeting, remove: deleteMeetMeeting }
      : teamsConfigured() ? { name: "Microsoft Teams", create: createTeamsMeeting, remove: deleteTeamsMeeting } : null;
    let eventId = null;
    if (provider) {
      try {
        const meeting = await provider.create(booking);
        booking.meetingUrl = meeting.joinUrl;
        booking.meetingProvider = provider.name;
        eventId = meeting.eventId;
      } catch (err) {
        console.error(`[book] ${provider.name} meeting creation failed; using the fallback link`, err);
      }
    }

    // If Aakash can't be told, the booking would be lost, so undo it and say so.
    try {
      await sendBookingToOwner(booking);
    } catch (err) {
      console.error("[book] owner email failed", err);
      await release(booking).catch(() => {});
      if (eventId) await provider.remove(eventId).catch(() => {});
      return json(502, { ok: false, error: "Your booking couldn't be completed. Please try again, or send a message instead." });
    }
    try {
      await sendBookingConfirmation(booking);
    } catch (err) {
      // Aakash already has the details and can follow up by email.
      console.error("[book] confirmation email failed", err);
    }
    return json(200, { ok: true, booking: { start: booking.start, end: booking.end } });
  } catch (err) {
    console.error("[book]", err);
    return json(500, { ok: false, error: "Something went wrong. Please try again, or send a message instead." });
  }
}

export const POST = handler;
