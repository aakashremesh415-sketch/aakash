// Optional: a unique Google Meet link for every booking, via the Google Calendar API.
// Works with a regular Gmail account or Google Workspace. Uses a one-time OAuth consent
// (refresh token, see README → "Google Meet links" and tools/google-auth.mjs). When these
// variables aren't set, bookings fall back to MEETING_URL.
//
// The meeting is created as an event in Aakash's own Google Calendar with no attendees and
// sendUpdates=none, so Google sends nothing itself; the visitor gets the site's invite.

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

/** Creates the Google Meet for a booking. Returns { joinUrl, eventId }. */
export async function createMeetMeeting(b) {
  const auth = { Authorization: `Bearer ${await token()}` };
  const res = await fetchImpl(`${eventsUrl()}?conferenceDataVersion=1&sendUpdates=none`, {
    method: "POST",
    headers: { ...auth, "Content-Type": "application/json" },
    body: JSON.stringify({
      summary: `Call with ${b.fullName} (${b.company})`,
      description: `Booked on aakashremesh.com by ${b.fullName} (${b.email}), ${b.company}.${b.notes ? `\nNotes: ${b.notes}` : ""}`,
      start: { dateTime: new Date(b.start).toISOString() },
      end: { dateTime: new Date(b.end).toISOString() },
      transparency: "opaque",
      guestsCanInviteOthers: false,
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

/** Removes a meeting created for a booking that was then rolled back. */
export async function deleteMeetMeeting(eventId) {
  if (!eventId) return;
  await fetchImpl(`${eventsUrl()}/${encodeURIComponent(eventId)}?sendUpdates=none`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${await token()}` },
    signal: AbortSignal.timeout(10_000),
  });
}
