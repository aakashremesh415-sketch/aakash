// Booking upgrades: 45-minute calls, prep questions, cancel links, reminders, encrypted contacts.
// Run: npm test
import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";

process.env.SMTP_HOST = "127.0.0.1";
process.env.MAIL_FROM = "Sanskar Mittal <hello@sanskarmittal.com>";
process.env.OWNER_EMAIL = "owner@example.com";
process.env.MEETING_URL = "https://meet.example.com/sanskar";
process.env.BOOKING_SECRET = "test-secret-0123456789abcdef";
process.env.CRON_SECRET = "cron-secret";
delete process.env.MS_TENANT_ID; delete process.env.GOOGLE_CLIENT_ID;

const { BOOKING } = await import("../api/_lib/config.js");
const store = await import("../api/_lib/store.js");
const mail = await import("../api/_lib/mail.js");
const secure = await import("../api/_lib/secure.js");
const slotsFn = (await import("../api/slots.js")).GET;
const bookFn = (await import("../api/book.js")).POST;
const cancelFn = (await import("../api/cancel.js")).POST;
const remindMod = await import("../api/remind.js");

let sent = [];
let mem;
mail.useTransport({ async sendMail(m) { sent.push(m); return { messageId: "x" }; } });
beforeEach(() => { sent = []; mem = store.memoryStore(); store.useStore(mem); });

let ip = 0;
const post = (fn, path, body) => fn(new Request(`https://sanskarmittal.com${path}`, {
  method: "POST",
  headers: { "content-type": "application/json", origin: "https://www.sanskarmittal.com", "x-real-ip": `10.9.${Math.floor(++ip / 200)}.${ip % 200}` },
  body: JSON.stringify(body),
}));
const slots = async (duration) => (await (await slotsFn(new Request(`https://sanskarmittal.com/api/slots${duration ? `?duration=${duration}` : ""}`))).json());
const visitor = (over = {}) => ({ fullName: "Test Visitor", email: `visitor${++ip}@example.com`, company: "Acme Ltd", timeZone: "Europe/London", elapsedMs: 9000, website: "", ...over });
const linkIn = (m) => (/https:\/\/www\.sanskarmittal\.com\/cancel#[\w.-]+/.exec(m.text) || [])[0];
const tokenOf = (url) => url.split("#")[1];
const ics = (m) => m.icalEvent.content.replace(/\r\n /g, ""); // unfold wrapped lines

test("call lengths: 20 and 45 minutes are offered; unknown lengths fall back to 20", async () => {
  assert.deepEqual(BOOKING.durations, [20, 45]);
  const d20 = await slots(20), d45 = await slots(45), dBad = await slots(37);
  assert.equal(d20.durationMin, 20);
  assert.equal(d45.durationMin, 45);
  assert.equal(dBad.durationMin, 20);
  assert.deepEqual(d20.durations, [20, 45]);
  // Each evening window fits fewer 45-minute calls (one less at the end).
  assert.ok(d45.slots.length < d20.slots.length && d45.slots.length > 0);
});

test("a 45-minute call reserves two cells and blocks the overlapping 20-minute slot", async () => {
  const s45 = (await slots(45)).slots[0];
  const res = await post(bookFn, "/api/book", visitor({ start: s45, durationMin: 45 }));
  const body = await res.json();
  assert.equal(res.status, 200, JSON.stringify(body));
  assert.equal(body.booking.durationMin, 45);
  assert.equal(new Date(body.booking.end) - new Date(body.booking.start), 45 * 60_000);
  const cells = [...mem._map.keys()].filter((k) => k.startsWith("bookings/slots/"));
  assert.equal(cells.length, 2);
  const next = new Date(new Date(s45).getTime() + 30 * 60_000).toISOString();
  const after = (await slots(20)).slots;
  assert.ok(!after.includes(s45) && !after.includes(next), "both covered times disappear");
  const clash = await post(bookFn, "/api/book", visitor({ start: next, durationMin: 20 }));
  assert.equal(clash.status, 409);
});

test("if the second cell of a 45-minute call is already taken, nothing is kept", async () => {
  const s45 = (await slots(45)).slots[0];
  const next = new Date(new Date(s45).getTime() + 30 * 60_000).toISOString();
  await mem.create(`bookings/slots/${next}.json`, "{}"); // someone grabbed it in the same instant
  const ok = await store.reserve({ start: s45, end: next, durationMin: 45, email: "a@example.com", createdAt: "" });
  assert.equal(ok, false);
  assert.ok(!mem._map.has(`bookings/slots/${s45}.json`), "first cell rolled back");
});

test("prep questions reach the owner email; unknown values are dropped", async () => {
  const s = (await slots()).slots[0];
  const res = await post(bookFn, "/api/book", visitor({ start: s, software: ["Xero", "NetSuite", "<script>"], entities: "2-3" }));
  assert.equal(res.status, 200);
  const owner = sent.find((m) => m.to.address === "owner@example.com");
  assert.match(owner.text, /Setup: Xero, NetSuite · 2-3 entities/);
  assert.doesNotMatch(owner.text, /script/);
  assert.match(ics(owner), /Setup: Xero\\, NetSuite/);
  const bad = await post(bookFn, "/api/book", visitor({ start: (await slots()).slots[0], entities: "lots" }));
  assert.equal(bad.status, 200);
  assert.doesNotMatch(sent.at(-2).text, /entities/);
});

test("contact details are stored encrypted, never in plain text", async () => {
  const v = visitor({ start: (await slots()).slots[0] });
  await post(bookFn, "/api/book", v);
  const raw = [...mem._map.entries()].find(([k]) => k.startsWith("bookings/contacts/"))[1];
  assert.ok(!raw.includes(v.email) && !raw.includes("Test Visitor") && !raw.includes("Acme"));
  assert.equal((await store.readContact(JSON.parse(JSON.stringify(v)).start)).email, v.email);
});

test("seal/open round-trips and rejects tampering", () => {
  const box = secure.seal({ a: 1 });
  assert.deepEqual(secure.open(box), { a: 1 });
  const flipped = box.slice(0, -2) + (box.at(-2) === "A" ? "B" : "A") + box.at(-1);
  assert.equal(secure.open(flipped), null);
});

test("confirmation email carries a cancel link that works exactly once", async () => {
  const s = (await slots()).slots[0];
  const v = visitor({ start: s });
  await post(bookFn, "/api/book", v);
  const confirm = sent.find((m) => m.to.address === v.email);
  const url = linkIn(confirm);
  assert.ok(url, "cancel link in the confirmation");
  assert.match(confirm.html, /Cancel or reschedule/);
  assert.match(ics(confirm), /Cancel or reschedule/);

  const look = await (await post(cancelFn, "/api/cancel", { token: tokenOf(url), action: "lookup" })).json();
  assert.equal(look.ok, true);
  assert.equal(look.booking.start, s);
  assert.equal(look.booking.firstName, "Test");
  assert.ok(!JSON.stringify(look).includes(v.email), "lookup doesn't reveal the email");

  sent = [];
  const done = await (await post(cancelFn, "/api/cancel", { token: tokenOf(url), action: "cancel" })).json();
  assert.equal(done.cancelled, true);
  assert.equal(sent.length, 2, "owner + visitor told");
  for (const m of sent) { assert.equal(m.icalEvent.method, "CANCEL"); assert.match(ics(m), /STATUS:CANCELLED/); }
  assert.ok((await slots()).slots.includes(s), "slot is free again");
  assert.equal([...mem._map.keys()].filter((k) => k.startsWith("bookings/")).length, 0, "nothing left in storage");

  const again = await post(cancelFn, "/api/cancel", { token: tokenOf(url), action: "cancel" });
  assert.equal(again.status, 404);
});

test("forged or edited cancel tokens are refused", async () => {
  const s = (await slots()).slots[0];
  const v = visitor({ start: s });
  await post(bookFn, "/api/book", v);
  const token = tokenOf(linkIn(sent.find((m) => m.to.address === v.email)));
  const [a, b] = token.split(".");
  for (const bad of [`${a}.${b.slice(0, -1)}${b.at(-1) === "A" ? "B" : "A"}`, `${a}.`, "nonsense", secure.cancelToken(s, "guessed-uid")]) {
    assert.equal((await post(cancelFn, "/api/cancel", { token: bad, action: "cancel" })).status, 404, bad);
  }
  assert.ok(!(await slots()).slots.includes(s), "booking untouched");
});

test("reminders: sent once for tomorrow's calls, and old details are deleted", async () => {
  const s = (await slots()).slots[0];
  const v = visitor({ start: s });
  await post(bookFn, "/api/book", v);
  sent = [];
  const start = new Date(s).getTime();

  const tooEarly = await remindMod.runReminders(new Date(start - 40 * 3600_000));
  assert.equal(tooEarly.reminded.length, 0);
  const dayBefore = new Date(start - 24 * 3600_000);
  const r1 = await remindMod.runReminders(dayBefore);
  assert.deepEqual(r1.reminded, [s]);
  assert.equal(sent.length, 1);
  assert.equal(sent[0].to.address, v.email);
  assert.match(sent[0].subject, /^Reminder:/);
  assert.ok(linkIn(sent[0]), "reminder has the cancel link");
  const r2 = await remindMod.runReminders(new Date(dayBefore.getTime() + 3600_000));
  assert.equal(r2.reminded.length, 0, "no second reminder");

  const r3 = await remindMod.runReminders(new Date(start + 2 * 3600_000));
  assert.deepEqual(r3.forgotten, [s]);
  assert.equal([...mem._map.keys()].filter((k) => k.startsWith("bookings/contacts/") || k.startsWith("bookings/reminded/")).length, 0);
});

test("the reminder endpoint needs the cron secret", async () => {
  const call = (auth) => remindMod.GET(new Request("https://sanskarmittal.com/api/remind", { headers: auth ? { authorization: auth } : {} }));
  assert.equal((await call()).status, 401);
  assert.equal((await call("Bearer wrong")).status, 401);
  assert.equal((await call("Bearer cron-secret")).status, 200);
});
