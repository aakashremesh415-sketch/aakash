// Booking storage on Vercel Blob (private store).
//   bookings/slots/<startISO>.json         -> the reservation (no personal data)
//   bookings/emails/<sha256>/<startISO>     -> marker used to cap upcoming calls per address
// Blob refuses to overwrite an existing pathname, so creating the slot file is the
// reservation: two visitors racing for the same time can't both win.
// Names and emails are never stored; they only travel in the emails.
import { createHash } from "node:crypto";
import { BOOKING } from "./config.js";

let override = null;
/** Tests inject an in-memory store with the same surface. */
export function useStore(store) { override = store; }

const SLOTS = "bookings/slots/";
const EMAILS = "bookings/emails/";
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
    async remove(pathnames) { await blob.del(pathnames); },
  };
}

async function store() {
  return override || vercelStore();
}

const startOf = (pathname, prefix) => new Date(pathname.slice(prefix.length).replace(/\.json$/, ""));

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

/** Returns true if the slot was reserved, false if someone already holds it. */
export async function reserve(booking) {
  const s = await store();
  const ok = await s.create(`${SLOTS}${booking.start}.json`, JSON.stringify({ start: booking.start, end: booking.end, createdAt: booking.createdAt }));
  if (!ok) return false;
  await s.create(`${EMAILS}${emailKey(booking.email)}/${booking.start}`, "1");
  return true;
}

export async function release(booking) {
  const s = await store();
  await s.remove([`${SLOTS}${booking.start}.json`, `${EMAILS}${emailKey(booking.email)}/${booking.start}`]);
}

/** In-memory implementation for tests and local runs. */
export function memoryStore() {
  const m = new Map();
  return {
    async keys(prefix) { return [...m.keys()].filter((k) => k.startsWith(prefix)); },
    async create(k, v) { if (m.has(k)) return false; m.set(k, v); return true; },
    async remove(ks) { ks.forEach((k) => m.delete(k)); },
    _map: m,
  };
}
