// Booking storage on Netlify Blobs.
//   slot/<startISO>             -> the booking (the key itself is the reservation)
//   email/<sha256>/<startISO>   -> marker used to cap upcoming calls per address
// Writes use `onlyIfNew`, so two visitors racing for the same time can't both win.
import { createHash } from "node:crypto";

let override = null;
/** Tests inject an in-memory store with the same surface. */
export function useStore(store) { override = store; }

async function store() {
  if (override) return override;
  const { getStore } = await import("@netlify/blobs");
  return getStore({ name: "bookings", consistency: "strong" });
}

const emailKey = (email) => createHash("sha256").update(email.toLowerCase()).digest("hex").slice(0, 32);

export async function busyBetween(from, to) {
  const s = await store();
  const { blobs } = await s.list({ prefix: "slot/" });
  const out = [];
  for (const { key } of blobs) {
    const start = new Date(key.slice(5));
    if (isNaN(start)) continue;
    if (start >= new Date(from.getTime() - 86400_000) && start <= to) {
      const rec = await s.get(key, { type: "json" });
      out.push({ start, end: new Date(rec?.end ?? start.getTime() + 30 * 60_000) });
    }
  }
  return out;
}

export async function upcomingCountForEmail(email, now = new Date()) {
  const s = await store();
  const { blobs } = await s.list({ prefix: `email/${emailKey(email)}/` });
  return blobs.filter(({ key }) => new Date(key.split("/").pop()) > now).length;
}

/** Returns true if the slot was reserved, false if someone already holds it. */
export async function reserve(booking) {
  const s = await store();
  const res = await s.setJSON(`slot/${booking.start}`, booking, { onlyIfNew: true });
  if (res && res.modified === false) return false;
  await s.set(`email/${emailKey(booking.email)}/${booking.start}`, "1");
  return true;
}

export async function release(booking) {
  const s = await store();
  await s.delete(`slot/${booking.start}`);
  await s.delete(`email/${emailKey(booking.email)}/${booking.start}`);
}

/** Minimal in-memory implementation for tests and local runs. */
export function memoryStore() {
  const m = new Map();
  return {
    async list({ prefix }) { return { blobs: [...m.keys()].filter((k) => k.startsWith(prefix)).map((key) => ({ key })) }; },
    async get(key, { type } = {}) { const v = m.get(key); return v === undefined ? null : type === "json" ? JSON.parse(v) : v; },
    async set(key, v, o = {}) { if (o.onlyIfNew && m.has(key)) return { modified: false }; m.set(key, String(v)); return { modified: true }; },
    async setJSON(key, v, o = {}) { return this.set(key, JSON.stringify(v), o); },
    async delete(key) { m.delete(key); },
    _map: m,
  };
}
