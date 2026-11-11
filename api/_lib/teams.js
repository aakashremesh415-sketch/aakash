// Optional: a unique Microsoft Teams meeting for every booking, via Microsoft Graph.
// Needs a Microsoft 365 business account with Teams and an Entra ID app registration
// (see README → "Teams meeting links"). When these variables aren't set, bookings
// fall back to MEETING_URL.
//
// The meeting is created as an event in the organizer's own calendar with no attendees,
// so Outlook sends no invite of its own; the visitor gets the site's invite with the link.

const env = (k) => (process.env[k] ?? "").trim();

export const TEAMS = {
  tenantId: env("MS_TENANT_ID"),
  clientId: env("MS_CLIENT_ID"),
  clientSecret: env("MS_CLIENT_SECRET"),
  organizer: env("MS_ORGANIZER"), // the Microsoft 365 user who hosts the calls, e.g. aakash@yourcompany.com
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
const graphTime = (iso) => ({ dateTime: new Date(iso).toISOString().replace("Z", ""), timeZone: "UTC" });

/** Creates the Teams meeting for a booking. Returns { joinUrl, eventId }. */
export async function createTeamsMeeting(b) {
  const res = await fetchImpl(`${graphUser()}/events`, {
    method: "POST",
    headers: { Authorization: `Bearer ${await token()}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      subject: `Call with ${b.fullName} (${b.company})`,
      body: { contentType: "text", content: `Booked on aakashremesh.com by ${b.fullName} (${b.email}), ${b.company}.${b.notes ? `\nNotes: ${b.notes}` : ""}` },
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

/** Removes a meeting created for a booking that was then rolled back. */
export async function deleteTeamsMeeting(eventId) {
  if (!eventId) return;
  await fetchImpl(`${graphUser()}/events/${encodeURIComponent(eventId)}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${await token()}` },
    signal: AbortSignal.timeout(10_000),
  });
}
