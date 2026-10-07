// Run: npm test   (uses node:test; no Netlify account or real mailbox needed)
import { test, before, after } from "node:test";
import assert from "node:assert/strict";

process.env.SMTP_HOST = "127.0.0.1";
process.env.MAIL_FROM = "Aakash Remesh <hello@aakashremesh.com>";
process.env.OWNER_EMAIL = "owner@example.com";
process.env.MEETING_URL = "https://meet.example.com/aakash";

const { BOOKING } = await import("../api/_lib/config.js");
const { generateSlots, isOfferedSlot } = await import("../api/_lib/slots.js");
const { buildIcs } = await import("../api/_lib/ics.js");
const store = await import("../api/_lib/store.js");
const mail = await import("../api/_lib/mail.js");
const slotsFn = (await import("../api/slots.js")).GET;
const bookFn = (await import("../api/book.js")).POST;
const messageFn = (await import("../api/message.js")).POST;

let sent = [];
let failOwner = false;
before(() => {
  mail.useTransport({
    async sendMail(m) {
      if (failOwner && m.to.address === "owner@example.com") throw new Error("smtp down");
      sent.push(m);
      return { messageId: "x" };
    },
  });
});
const reset = () => { sent = []; failOwner = false; store.useStore(store.memoryStore()); };

let ipN = 0;
const req = (path, body, { origin = "https://aakashremesh.com", method = "POST" } = {}) =>
  new Request(`https://aakashremesh.com${path}`, {
    method,
    headers: { "content-type": "application/json", origin, "x-real-ip": `10.0.0.${++ipN}` },
    body: method === "POST" ? JSON.stringify(body) : undefined,
  });

const human = { elapsedMs: 9000, website: "" };
async function firstSlot() {
  const res = await slotsFn(new Request("https://aakashremesh.com/api/slots"));
  const data = await res.json();
  return data.slots[0];
}

// ---- Slot generation ----------------------------------------------------------

test("nothing is bookable today or tomorrow; the first day is two days out (IST)", () => {
  const now = new Date("2026-10-07T05:00:00Z"); // Wednesday 10:30 IST
  const slots = generateSlots([], now);
  const istDay = (d) => new Date(d.getTime() + 5.5 * 3600_000).toISOString().slice(0, 10);
  assert.equal(istDay(slots[0]), "2026-10-09"); // Friday
  assert.ok(!slots.some((s) => ["2026-10-07", "2026-10-08"].includes(istDay(s))));
});

test("Saturday and Sunday (IST) are never offered", () => {
  const slots = generateSlots([], new Date("2026-10-07T05:00:00Z"));
  for (const s of slots) {
    const d = new Date(s.getTime() + 5.5 * 3600_000).getUTCDay();
    assert.ok(d >= 1 && d <= 5, `weekend slot ${s.toISOString()}`);
  }
});

test("slots fall inside the IST windows on weekdays, after the notice period", () => {
  const now = new Date("2026-10-07T00:00:00Z"); // Wednesday
  const slots = generateSlots([], now);
  assert.ok(slots.length > 50);
  for (const s of slots) {
    const ist = new Date(s.getTime() + 5.5 * 3600_000);
    const mins = ist.getUTCHours() * 60 + ist.getUTCMinutes();
    const inWindow = BOOKING.windows.some(([a, b]) => mins >= a && mins + BOOKING.durationMin <= b);
    assert.ok(inWindow, `slot ${s.toISOString()} outside windows`);
    assert.ok([1, 2, 3, 4, 5].includes(ist.getUTCDay()), "weekend slot");
    assert.ok(s - now >= BOOKING.minNoticeHours * 3600_000, "inside notice period");
  }
});

test("a booked slot and its buffer are removed", () => {
  const now = new Date("2026-10-07T00:00:00Z");
  const all = generateSlots([], now);
  const taken = all[3];
  const busy = [{ start: taken, end: new Date(taken.getTime() + BOOKING.durationMin * 60_000) }];
  assert.equal(isOfferedSlot(taken, busy, now), false);
  assert.equal(isOfferedSlot(all[0], busy, now), true);
});

// ---- ICS ---------------------------------------------------------------------

test("calendar invite escapes text and can't be broken by names", () => {
  const ics = buildIcs({
    uid: "u@x", start: new Date("2026-10-12T05:00:00Z"), end: new Date("2026-10-12T05:20:00Z"),
    summary: "Call: Acme, Inc; Ltd", description: "line1\nline2",
    organizer: { name: "Aakash", email: "a@x.com" },
    attendees: [{ name: 'Eve"\r\nATTENDEE:mailto:evil@x.com', email: "e@x.com" }],
  });
  assert.match(ics, /SUMMARY:Call: Acme\\, Inc\\; Ltd/);
  assert.match(ics, /DESCRIPTION:line1\\nline2/);
  assert.doesNotMatch(ics, /\r\nATTENDEE:mailto:evil/);
  for (const line of ics.split("\r\n")) assert.ok(Buffer.byteLength(line) <= 75, `long line: ${line}`);
});

// ---- Booking endpoint ----------------------------------------------------------

test("happy path: reserves, emails owner first, then the visitor with an invite", async () => {
  reset();
  const start = await firstSlot();
  const res = await bookFn(req("/api/book", { ...human, fullName: "Jane Doe", email: "Jane@Acme.com", company: "Acme", notes: "QBO cleanup", start, timeZone: "America/New_York" }));
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.ok, true);
  assert.equal(body.booking.start, start);
  assert.equal(sent.length, 2);
  assert.equal(sent[0].to.address, "owner@example.com");
  assert.equal(sent[0].replyTo.address, "jane@acme.com");
  assert.equal(sent[1].to.address, "jane@acme.com");
  assert.match(sent[1].icalEvent.content, /BEGIN:VEVENT/);
  assert.match(sent[1].text, /EDT|EST|GMT-4|GMT-5/);
  // The slot is gone from the public list.
  const after = await (await slotsFn(new Request("https://aakashremesh.com/api/slots"))).json();
  assert.ok(!after.slots.includes(start));
  // The owner's address never appears in what the browser receives.
  assert.doesNotMatch(JSON.stringify(after) + JSON.stringify(body), /owner@example\.com/);
});

test("the same slot can't be booked twice", async () => {
  reset();
  const start = await firstSlot();
  const a = await bookFn(req("/api/book", { ...human, fullName: "A", email: "a@a.com", company: "A", start, timeZone: "UTC" }));
  const b = await bookFn(req("/api/book", { ...human, fullName: "B", email: "b@b.com", company: "B", start, timeZone: "UTC" }));
  assert.equal(a.status, 200);
  assert.equal(b.status, 409);
});

test("concurrent requests for one slot: exactly one wins", async () => {
  reset();
  const start = await firstSlot();
  const results = await Promise.all([1, 2, 3, 4].map((i) =>
    bookFn(req("/api/book", { ...human, fullName: `P${i}`, email: `p${i}@x.com`, company: "X", start, timeZone: "UTC" }))));
  assert.equal(results.filter((r) => r.status === 200).length, 1);
});

test("a time that isn't offered is rejected", async () => {
  reset();
  const res = await bookFn(req("/api/book", { ...human, fullName: "A", email: "a@a.com", company: "A", start: "2026-10-11T03:07:00Z", timeZone: "UTC" }));
  assert.equal(res.status, 409);
});

test("if the owner can't be emailed, the slot is released and the visitor is told", async () => {
  reset();
  failOwner = true;
  const start = await firstSlot();
  const res = await bookFn(req("/api/book", { ...human, fullName: "A", email: "a@a.com", company: "A", start, timeZone: "UTC" }));
  assert.equal(res.status, 502);
  failOwner = false;
  const again = await bookFn(req("/api/book", { ...human, fullName: "B", email: "b@b.com", company: "B", start, timeZone: "UTC" }));
  assert.equal(again.status, 200);
});

test("one address can hold at most two upcoming calls", async () => {
  reset();
  const { slots } = await (await slotsFn(new Request("https://aakashremesh.com/api/slots"))).json();
  const codes = [];
  for (const s of [slots[0], slots[5], slots[10]]) {
    codes.push((await bookFn(req("/api/book", { ...human, fullName: "A", email: "same@x.com", company: "A", start: s, timeZone: "UTC" }))).status);
  }
  assert.deepEqual(codes, [200, 200, 409]);
});

test("bots get a silent fake success and nothing is sent", async () => {
  reset();
  const start = await firstSlot();
  const honeypot = await bookFn(req("/api/book", { elapsedMs: 9000, website: "spam.com", fullName: "A", email: "a@a.com", company: "A", start, timeZone: "UTC" }));
  const tooFast = await bookFn(req("/api/book", { elapsedMs: 300, website: "", fullName: "A", email: "a@a.com", company: "A", start, timeZone: "UTC" }));
  assert.equal(honeypot.status, 200);
  assert.equal(tooFast.status, 200);
  assert.equal(sent.length, 0);
});

test("cross-site posts are refused", async () => {
  reset();
  const res = await bookFn(req("/api/book", { ...human }, { origin: "https://evil.example" }));
  assert.equal(res.status, 403);
});

test("header injection through the name is neutralised", async () => {
  reset();
  const start = await firstSlot();
  await bookFn(req("/api/book", { ...human, fullName: "Eve\r\nBcc: victim@x.com", email: "eve@x.com", company: "E", start, timeZone: "UTC" }));
  for (const m of sent) {
    assert.doesNotMatch(m.subject, /[\r\n]/);
    assert.doesNotMatch(JSON.stringify(m.to) + JSON.stringify(m.replyTo || {}), /\\r|\\n/);
  }
});

test("missing fields and bad emails are rejected", async () => {
  reset();
  const start = await firstSlot();
  const r1 = await bookFn(req("/api/book", { ...human, fullName: "", email: "a@a.com", company: "A", start }));
  const r2 = await bookFn(req("/api/book", { ...human, fullName: "A", email: "not-an-email", company: "A", start }));
  assert.equal(r1.status, 400);
  assert.equal(r2.status, 400);
});

test("rate limit kicks in for one IP", async () => {
  reset();
  const make = () => new Request("https://aakashremesh.com/api/book", {
    method: "POST", headers: { "content-type": "application/json", origin: "https://aakashremesh.com", "x-real-ip": "9.9.9.9" },
    body: JSON.stringify({ ...human }),
  });
  const codes = [];
  for (let i = 0; i < 7; i++) codes.push((await bookFn(make())).status);
  assert.ok(codes.includes(429));
});

// ---- Message endpoint -----------------------------------------------------------

test("contact message goes only to the owner, reply-to the sender, HTML-escaped", async () => {
  reset();
  const res = await messageFn(req("/api/message", { ...human, fullName: "Sam", email: "sam@x.com", company: "", message: "<script>alert(1)</script>\nHello" }));
  assert.equal(res.status, 200);
  assert.equal(sent.length, 1);
  assert.equal(sent[0].to.address, "owner@example.com");
  assert.equal(sent[0].replyTo.address, "sam@x.com");
  assert.doesNotMatch(sent[0].html, /<script>/);
});

test("without mail settings the endpoints say they're unavailable", async () => {
  const saved = process.env.OWNER_EMAIL;
  // config is read at import time, so check the guard function directly.
  const { mailConfigured, MAIL } = await import("../api/_lib/config.js");
  const keep = MAIL.owner;
  MAIL.owner = "";
  assert.equal(mailConfigured(), false);
  const res = await slotsFn(new Request("https://aakashremesh.com/api/slots"));
  assert.equal(res.status, 503);
  MAIL.owner = keep;
  process.env.OWNER_EMAIL = saved;
});
