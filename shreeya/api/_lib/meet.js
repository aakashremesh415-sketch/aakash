// Google Calendar for bookings: every call becomes a real event in the owner's Google Calendar
// (Gmail or Google Workspace), with its own Google Meet link, and the visitor is added as a guest
// so Google sends them a proper invitation. Gmail, Outlook, Apple Mail and the rest put that
// invitation straight into the visitor's calendar; no .ics attachment is needed.
// Uses a one-time OAuth consent (refresh token, see README → "Google Calendar" and
// tools/google-auth.mjs). When these variables aren't set, bookings fall back to MEETING_URL
// and the emails carry an .ics invite instead.
//
// Order of work in /api/book: createMeetMeeting() (no guests, Google emails nobody) →
// owner is emailed → inviteGuest() (Google emails the visitor). So a booking that is rolled
// back never sends the visitor an invite followed by a cancellation.
import { BOOKING, MAIL } from "./config.js";

const env = (k) => (process.env[k] ?? "").trim();

export const GOOGLE = {
  clientId: env("GOOGLE_CLIENT_ID"),
  clientSecret: env("GOOGLE_CLIENT_SECRET"),
  refreshToken: env("GOOGLE_REFRESH_TOKEN"),
  calendarId: env("GOOGLE_CALENDAR_ID") || "primary",
};

export const meetConfigured = () => Boolean(GOOGLE.clientId && GOOGLE.clientSecret && GOOGLE.refreshToken);

let fetchImpl = (...a) => fetch(...a);
/** Tests inject a fake fetch. */
export function useFetch(f) { fetchImpl = f; tokenCache = null; }

let tokenCache = null; // { token, expires }

async function token() {
  if (tokenCache && tokenCache.expires > Date.now() + 60_000) return tokenCache.token;
  const res = await fetchImpl("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: GOOGLE.clientId,
      client_secret: GOOGLE.clientSecret,
      refresh_token: GOOGLE.refreshToken,
      grant_type: "refresh_token",
    }),
    signal: AbortSignal.timeout(10_000),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok || !body.access_token) throw new Error(`Google token request failed (${res.status}): ${body.error || "unknown"}`);
  tokenCache = { token: body.access_token, expires: Date.now() + (Number(body.expires_in) || 3600) * 1000 };
  return tokenCache.token;
}

const eventsUrl = () => `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(GOOGLE.calendarId)}/events`;
const meetLink = (ev) =>
  ev?.hangoutLink || ev?.conferenceData?.entryPoints?.find((e) => e.entryPointType === "video")?.uri || "";
const site = () => BOOKING.siteUrl.replace(/^https?:\/\/(www\.)?/, "");
const mins = (b) => b.durationMin || BOOKING.durationMin;

/** Event title, as both the owner and the visitor see it in their calendars. */
export const eventTitle = (b) => `${MAIL.ownerName} & ${b.fullName} (${b.company})`;

/** Event description: what the visitor sees in their calendar too, so only their own details. */
export function eventDescription(b) {
  const prep = [Array.isArray(b.software) && b.software.length ? b.software.join(", ") : "", b.entities ? `${b.entities} ${b.entities === "1" ? "entity" : "entities"}` : ""].filter(Boolean).join(" · ");
  return `${mins(b)}-minute call with ${MAIL.ownerName}, booked on ${site()}.\n` +
    (b.meetingUrl ? `Join: ${b.meetingUrl}\n` : "") +
    `\nBooked by ${b.fullName} (${b.email}), ${b.company}.` +
    (prep ? `\nSetup: ${prep}` : "") +
    (b.notes ? `\nNotes: ${b.notes}` : "") +
    (b.cancelUrl ? `\n\nCancel or reschedule: ${b.cancelUrl}` : "");
}

/** Creates the event + Google Meet in the owner's calendar, with no guests yet. Returns { joinUrl, eventId }. */
export async function createMeetMeeting(b) {
  const auth = { Authorization: `Bearer ${await token()}` };
  const res = await fetchImpl(`${eventsUrl()}?conferenceDataVersion=1&sendUpdates=none`, {
    method: "POST",
    headers: { ...auth, "Content-Type": "application/json" },
    body: JSON.stringify({
      summary: eventTitle(b),
      description: eventDescription(b),
      start: { dateTime: new Date(b.start).toISOString() },
      end: { dateTime: new Date(b.end).toISOString() },
      transparency: "opaque",
      guestsCanInviteOthers: false,
      guestsCanModify: false,
      reminders: { useDefault: true },
      // requestId makes a retried request reuse the same conference instead of making a second one.
      conferenceData: { createRequest: { requestId: b.uid, conferenceSolutionKey: { type: "hangoutsMeet" } } },
    }),
    signal: AbortSignal.timeout(15_000),
  });
  let ev = await res.json().catch(() => ({}));
  if (!res.ok || !ev.id) throw new Error(`Google Meet creation failed (${res.status}): ${ev?.error?.status || ev?.error?.message || "no event returned"}`);

  // Google usually returns the link at once; if the conference is still being set up, ask again briefly.
  for (let i = 0; i < 3 && !meetLink(ev); i++) {
    await new Promise((r) => setTimeout(r, 700));
    const again = await fetchImpl(`${eventsUrl()}/${encodeURIComponent(ev.id)}`, { headers: auth, signal: AbortSignal.timeout(10_000) });
    ev = await again.json().catch(() => ev);
  }
  const joinUrl = meetLink(ev);
  if (!/^https:\/\/meet\.google\.com\/[a-z0-9-]+$/i.test(joinUrl)) {
    await deleteMeetMeeting(ev.id).catch(() => {});
    throw new Error("Google returned no Meet link");
  }
  return { joinUrl, eventId: ev.id };
}

/**
 * Adds the visitor as a guest. Google then emails them a calendar invitation (from the owner's
 * Google account) that Gmail, Outlook and others add to their calendar. The owner is the
 * organizer, so the event is already in the owner's own calendar.
 */
export async function inviteGuest(eventId, b) {
  const res = await fetchImpl(`${eventsUrl()}/${encodeURIComponent(eventId)}?sendUpdates=all`, {
    method: "PATCH",
    headers: { Authorization: `Bearer ${await token()}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      description: eventDescription(b),
      attendees: [{ email: b.email, displayName: b.fullName }],
    }),
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(`Google guest invite failed (${res.status}): ${body?.error?.status || body?.error?.message || "unknown"}`);
  }
}

/**
 * Deletes the event from the owner's calendar. With notify, Google also sends the guest a
 * cancellation, which takes the event out of their calendar.
 */
export async function deleteMeetMeeting(eventId, { notify = false } = {}) {
  if (!eventId) return;
  const res = await fetchImpl(`${eventsUrl()}/${encodeURIComponent(eventId)}?sendUpdates=${notify ? "all" : "none"}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${await token()}` },
    signal: AbortSignal.timeout(10_000),
  });
  // 410: already deleted (e.g. by hand in Google Calendar).
  if (!res.ok && res.status !== 404 && res.status !== 410) throw new Error(`Google event delete failed (${res.status})`);
}
