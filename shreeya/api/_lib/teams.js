// Optional: a unique Microsoft Teams meeting for every booking, via Microsoft Graph.
// Needs a Microsoft 365 business account with Teams and an Entra ID app registration
// (see README → "Teams meeting links"). When these variables aren't set, bookings
// fall back to MEETING_URL.
//
// The meeting is created as an event in the organizer's own Outlook calendar with no attendees;
// once the owner has been emailed, inviteGuest() adds the visitor and Outlook sends them a
// calendar invitation that Gmail, Outlook and others add to their calendar (no .ics needed).
import { BOOKING, MAIL } from "./config.js";

const env = (k) => (process.env[k] ?? "").trim();

export const TEAMS = {
  tenantId: env("MS_TENANT_ID"),
  clientId: env("MS_CLIENT_ID"),
  clientSecret: env("MS_CLIENT_SECRET"),
  organizer: env("MS_ORGANIZER"), // the Microsoft 365 user who hosts the calls, e.g. shreeya@yourcompany.com
};

export const teamsConfigured = () =>
  Boolean(TEAMS.tenantId && TEAMS.clientId && TEAMS.clientSecret && TEAMS.organizer);

let fetchImpl = (...a) => fetch(...a);
/** Tests inject a fake fetch. */
export function useFetch(f) { fetchImpl = f; tokenCache = null; }

let tokenCache = null; // { token, expires }

async function token() {
  if (tokenCache && tokenCache.expires > Date.now() + 60_000) return tokenCache.token;
  const res = await fetchImpl(`https://login.microsoftonline.com/${encodeURIComponent(TEAMS.tenantId)}/oauth2/v2.0/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: TEAMS.clientId,
      client_secret: TEAMS.clientSecret,
      scope: "https://graph.microsoft.com/.default",
      grant_type: "client_credentials",
    }),
    signal: AbortSignal.timeout(10_000),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok || !body.access_token) throw new Error(`Teams token request failed (${res.status}): ${body.error || "unknown"}`);
  tokenCache = { token: body.access_token, expires: Date.now() + (Number(body.expires_in) || 3600) * 1000 };
  return tokenCache.token;
}

const graphUser = () => `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(TEAMS.organizer)}`;
const site = () => BOOKING.siteUrl.replace(/^https?:\/\/(www\.)?/, "");
const eventBody = (b) => ({
  contentType: "text",
  content: `Booked on ${site()} by ${b.fullName} (${b.email}), ${b.company}.${b.notes ? `\nNotes: ${b.notes}` : ""}` +
    (b.cancelUrl ? `\n\nCancel or reschedule: ${b.cancelUrl}` : ""),
});
const graphTime = (iso) => ({ dateTime: new Date(iso).toISOString().replace("Z", ""), timeZone: "UTC" });

/** Creates the Teams meeting for a booking. Returns { joinUrl, eventId }. */
export async function createTeamsMeeting(b) {
  const res = await fetchImpl(`${graphUser()}/events`, {
    method: "POST",
    headers: { Authorization: `Bearer ${await token()}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      subject: `${MAIL.ownerName} & ${b.fullName} (${b.company})`,
      body: eventBody(b),
      start: graphTime(b.start),
      end: graphTime(b.end),
      isOnlineMeeting: true,
      onlineMeetingProvider: "teamsForBusiness",
      allowNewTimeProposals: false,
      showAs: "busy",
      // Makes a retried request return the same event instead of creating a second one.
      transactionId: b.uid,
    }),
    signal: AbortSignal.timeout(15_000),
  });
  const body = await res.json().catch(() => ({}));
  const joinUrl = body?.onlineMeeting?.joinUrl;
  if (!res.ok || !joinUrl) throw new Error(`Teams meeting creation failed (${res.status}): ${body?.error?.code || "no join link returned"}`);
  if (!/^https:\/\/teams\.(microsoft|live)\.com\//.test(joinUrl)) throw new Error("Unexpected Teams join link");
  return { joinUrl, eventId: body.id };
}

/** Adds the visitor as an attendee; Outlook then emails them the meeting invitation. */
export async function inviteGuest(eventId, b) {
  const res = await fetchImpl(`${graphUser()}/events/${encodeURIComponent(eventId)}`, {
    method: "PATCH",
    headers: { Authorization: `Bearer ${await token()}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      body: eventBody(b),
      attendees: [{ emailAddress: { address: b.email, name: b.fullName }, type: "required" }],
    }),
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(`Teams guest invite failed (${res.status}): ${body?.error?.code || "unknown"}`);
  }
}

/**
 * Removes the meeting. With notify, the attendee gets an Outlook cancellation (which also
 * takes it out of their calendar); without, it is deleted silently.
 */
export async function deleteTeamsMeeting(eventId, { notify = false } = {}) {
  if (!eventId) return;
  const url = `${graphUser()}/events/${encodeURIComponent(eventId)}`;
  const res = await fetchImpl(notify ? `${url}/cancel` : url, {
    method: notify ? "POST" : "DELETE",
    headers: { Authorization: `Bearer ${await token()}`, ...(notify ? { "Content-Type": "application/json" } : {}) },
    ...(notify ? { body: JSON.stringify({ comment: "This call has been cancelled." }) } : {}),
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok && res.status !== 404) throw new Error(`Teams event delete failed (${res.status})`);
}
