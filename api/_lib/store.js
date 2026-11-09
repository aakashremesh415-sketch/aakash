// Booking storage on Vercel Blob (private store).
//   bookings/slots/<startISO>.json          -> a reserved 30-minute cell (no personal data).
//                                               A 45-minute call reserves two cells.
//   bookings/emails/<sha256>/<startISO>      -> marker used to cap upcoming calls per address
//   bookings/contacts/<startISO>.json        -> the visitor's name, email and company, ENCRYPTED with
//                                               BOOKING_SECRET; used only for the reminder and the
//                                               cancel link, and deleted after the call
//   bookings/reminded/<startISO>             -> marker: the reminder for this call has been sent
// Blob refuses to overwrite an existing pathname, so creating the slot file is the
// reservation: two visitors racing for the same time can't both win.
import { createHash } from "node:crypto";
import { BOOKING, secretConfigured } from "./config.js";
import { cellStarts } from "./slots.js";
import { open, seal } from "./secure.js";

let override = null;
/** Tests inject an in-memory store with the same surface. */
export function useStore(store) { override = store; }

const SLOTS = "bookings/slots/";
const EMAILS = "bookings/emails/";
const CONTACTS = "bookings/contacts/";
const REMINDED = "bookings/reminded/";
const emailKey = (email) => createHash("sha256").update(email.toLowerCase()).digest("hex").slice(0, 32);

async function vercelStore() {
  const blob = await import("@vercel/blob");
  const opts = { access: "private", addRandomSuffix: false, allowOverwrite: false, contentType: "application/json" };
  return {
    async keys(prefix) {
      const out = [];
      let cursor;
      do {
        const page = await blob.list({ prefix, cursor, limit: 1000 });
        for (const b of page.blobs) out.push(b.pathname);
        cursor = page.hasMore ? page.cursor : undefined;
      } while (cursor);
      return out;
    },
    /** true if created, false if the pathname already exists. */
    async create(pathname, body) {
      try {
        await blob.put(pathname, body, opts);
        return true;
      } catch (err) {
        // Not-overwritable put failed: was it because the blob exists?
        try { await blob.head(pathname); return false; } catch { throw err; }
      }
    },
    /** File contents as text, or null if it doesn't exist. */
    async read(pathname) {
      try {
        const res = await blob.get(pathname, { access: "private", useCache: false });
        if (!res || !res.stream) return null;
        return await new Response(res.stream).text();
      } catch (err) {
        if (/not.?found|404/i.test(String(err && (err.name || err.message)))) return null;
        throw err;
      }
    },
    async remove(pathnames) { if (pathnames.length) await blob.del(pathnames); },
  };
}

async function store() {
  return override || vercelStore();
}

const startOf = (pathname, prefix) => new Date(pathname.slice(prefix.length).replace(/\.json$/, ""));
const cellKeys = (booking) =>
  cellStarts(new Date(booking.start), booking.durationMin || BOOKING.durationMin).map((d) => `${SLOTS}${d.toISOString()}.json`);

export async function busyBetween(from, to) {
  const s = await store();
  const out = [];
  for (const key of await s.keys(SLOTS)) {
    const start = startOf(key, SLOTS);
    if (isNaN(start)) continue;
    if (start >= new Date(from.getTime() - 86400_000) && start <= to) {
      out.push({ start, end: new Date(start.getTime() + BOOKING.durationMin * 60_000) });
    }
  }
  return out;
}

export async function upcomingCountForEmail(email, now = new Date()) {
  const s = await store();
  const prefix = `${EMAILS}${emailKey(email)}/`;
  return (await s.keys(prefix)).filter((k) => startOf(k, prefix) > now).length;
}

/** Returns true if every cell of the call was reserved, false if someone already holds one. */
export async function reserve(booking) {
  const s = await store();
  const taken = [];
  const marker = JSON.stringify({ start: booking.start, end: booking.end, createdAt: booking.createdAt });
  for (const key of cellKeys(booking)) {
    if (!(await s.create(key, marker))) {
      await s.remove(taken).catch(() => {});
      return false;
    }
    taken.push(key);
  }
  await s.create(`${EMAILS}${emailKey(booking.email)}/${booking.start}`, "1");
  return true;
}

/**
 * Keeps the visitor's details (encrypted) until the call, for the reminder and the cancel link.
 * Returns false when there's no BOOKING_SECRET, so the caller leaves those features out.
 */
export async function saveContact(booking) {
  if (!secretConfigured()) return false;
  const s = await store();
  const { uid, start, end, durationMin, fullName, email, company, clientTz, meetingUrl, meetingProvider, eventId } = booking;
  return s.create(`${CONTACTS}${start}.json`, JSON.stringify({
    v: 1, data: seal({ uid, start, end, durationMin, fullName, email, company, clientTz, meetingUrl, meetingProvider, eventId }),
  }));
}

/** The decrypted contact record for a call, or null. */
export async function readContact(start) {
  if (!secretConfigured()) return null;
  const s = await store();
  const text = await s.read(`${CONTACTS}${start}.json`);
  if (!text) return null;
  try { return open(JSON.parse(text).data); } catch { return null; }
}

/** Start times (ISO) of every call that still has a contact record. */
export async function contactStarts() {
  const s = await store();
  return (await s.keys(CONTACTS)).map((k) => k.slice(CONTACTS.length).replace(/\.json$/, ""));
}

export async function wasReminded(start) {
  const s = await store();
  return (await s.keys(`${REMINDED}${start}`)).length > 0;
}

/** true the first time; false if a reminder was already recorded (two cron runs can't both send). */
export async function markReminded(start) {
  const s = await store();
  return s.create(`${REMINDED}${start}`, "1");
}

/** Deletes the contact record and reminder marker once a call is over. */
export async function forgetContact(start) {
  const s = await store();
  await s.remove([`${CONTACTS}${start}.json`, `${REMINDED}${start}`]);
}

/** Frees every cell of the call and removes everything stored about it. */
export async function release(booking) {
  const s = await store();
  await s.remove([
    ...cellKeys(booking),
    `${EMAILS}${emailKey(booking.email)}/${booking.start}`,
    `${CONTACTS}${booking.start}.json`,
    `${REMINDED}${booking.start}`,
  ]);
}

/** In-memory implementation for tests and local runs. */
export function memoryStore() {
  const m = new Map();
  return {
    async keys(prefix) { return [...m.keys()].filter((k) => k.startsWith(prefix)); },
    async create(k, v) { if (m.has(k)) return false; m.set(k, v); return true; },
    async read(k) { return m.has(k) ? m.get(k) : null; },
    async remove(ks) { ks.forEach((k) => m.delete(k)); },
    _map: m,
  };
}
