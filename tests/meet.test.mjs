// Google Meet links per booking (separate file: the provider is chosen from env at import).
import { test, before } from "node:test";
import assert from "node:assert/strict";

process.env.SMTP_HOST = "127.0.0.1";
process.env.MAIL_FROM = "Aakash Remesh <hello@aakashremesh.com>";
process.env.OWNER_EMAIL = "owner@example.com";
process.env.MEETING_URL = "https://meet.google.com/fix-edli-nkk";
process.env.GOOGLE_CLIENT_ID = "gid";
process.env.GOOGLE_CLIENT_SECRET = "gsecret";
process.env.GOOGLE_REFRESH_TOKEN = "grefresh";
// Teams is also configured: Google Meet must win.
process.env.MS_TENANT_ID = "t"; process.env.MS_CLIENT_ID = "c"; process.env.MS_CLIENT_SECRET = "s"; process.env.MS_ORGANIZER = "o@example.com";

const store = await import("../api/_lib/store.js");
const mail = await import("../api/_lib/mail.js");
const meet = await import("../api/_lib/meet.js");
const teams = await import("../api/_lib/teams.js");
const slotsFn = (await import("../api/slots.js")).GET;
const bookFn = (await import("../api/book.js")).POST;

let g;
const reply = (status, obj) => new Response(JSON.stringify(obj), { status, headers: { "content-type": "application/json" } });
const fakeGoogle = async (url, init = {}) => {
  url = String(url);
  g.calls.push({ url, method: init.method || "GET", body: init.body });
  if (url.startsWith("https://oauth2.googleapis.com/token")) return reply(200, { access_token: "gtok", expires_in: 3600 });
  if (init.method === "DELETE") return new Response(null, { status: 204 });
  if (g.fail) return reply(500, { error: { status: "INTERNAL" } });
  if (init.method === "POST") {
    g.n += 1;
    // The second booking simulates a conference still being set up when the event returns.
    return g.n === 2 ? reply(200, { id: `gev-${g.n}`, conferenceData: { createRequest: { status: { statusCode: "pending" } } } })
      : reply(200, { id: `gev-${g.n}`, hangoutLink: `https://meet.google.com/abc-defg-00${g.n}` });
  }
  return reply(200, { id: url.split("/").pop(), hangoutLink: "https://meet.google.com/abc-defg-002" });
};
let teamsCalls = 0;

let sent = [];
let failOwner = false;
before(() => {
  mail.useTransport({ async sendMail(m) { if (failOwner && m.to.address === "owner@example.com") throw new Error("down"); sent.push(m); return {}; } });
});
const reset = () => {
  sent = []; failOwner = false; g = { calls: [], n: 0, fail: false }; teamsCalls = 0;
  meet.useFetch(fakeGoogle); teams.useFetch(async () => { teamsCalls++; return reply(500, {}); });
  store.useStore(store.memoryStore());
};
let ip = 0;
const book = (body) => bookFn(new Request("https://aakashremesh.com/api/book", {
  method: "POST", headers: { "content-type": "application/json", origin: "https://aakashremesh.com", "x-real-ip": `10.9.0.${++ip}` },
  body: JSON.stringify({ elapsedMs: 9000, website: "", timeZone: "UTC", ...body }),
}));
const slots = async () => (await (await slotsFn(new Request("https://aakashremesh.com/api/slots"))).json()).slots;

test("each booking gets its own Google Meet link in both emails and the invite", async () => {
  reset();
  const s = await slots();
  assert.equal((await book({ fullName: "A", email: "a@a.com", company: "A", start: s[0] })).status, 200);
  assert.equal((await book({ fullName: "B", email: "b@b.com", company: "B", start: s[4] })).status, 200);
  const links = sent.map((m) => (m.text.match(/https:\/\/meet\.google\.com\/\S+/) || [])[0]);
  assert.deepEqual(links, ["https://meet.google.com/abc-defg-001", "https://meet.google.com/abc-defg-001",
    "https://meet.google.com/abc-defg-002", "https://meet.google.com/abc-defg-002"]);
  assert.match(sent[1].html, /Join the Google Meet/);
  assert.match(sent[1].icalEvent.content, /LOCATION:Google Meet meeting/);
  const create = JSON.parse(g.calls.find((c) => c.method === "POST" && c.url.includes("/events")).body);
  assert.equal(create.conferenceData.createRequest.conferenceSolutionKey.type, "hangoutsMeet");
  assert.equal(create.attendees, undefined, "Google must not email anyone itself");
  assert.ok(g.calls.find((c) => c.method === "POST" && c.url.includes("/events")).url.includes("sendUpdates=none"));
  assert.equal(g.calls.filter((c) => c.url.startsWith("https://oauth2.googleapis.com")).length, 1, "token reused");
  assert.equal(teamsCalls, 0, "Teams is not used when Google Meet is connected");
});

test("if Google is down the booking still succeeds with MEETING_URL", async () => {
  reset();
  g.fail = true;
  const res = await book({ fullName: "A", email: "a@a.com", company: "A", start: (await slots())[0] });
  assert.equal(res.status, 200);
  assert.match(sent[1].text, /Join: https:\/\/meet\.google\.com\/fix-edli-nkk/);
  assert.match(sent[1].html, /Join the Google Meet/);
});

test("a rolled-back booking also deletes its Google event", async () => {
  reset();
  failOwner = true;
  const res = await book({ fullName: "A", email: "a@a.com", company: "A", start: (await slots())[0] });
  assert.equal(res.status, 502);
  assert.ok(g.calls.some((c) => c.method === "DELETE" && c.url.includes("/events/gev-1")));
});
