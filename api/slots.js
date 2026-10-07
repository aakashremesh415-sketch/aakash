// GET /api/slots -> { durationMin, timeZone, slots: ISO[] }
import { BOOKING, mailConfigured } from "./_lib/config.js";
import { generateSlots } from "./_lib/slots.js";
import { busyBetween } from "./_lib/store.js";
import { json } from "./_lib/http.js";

async function handler(req) {
  if (req.method !== "GET") return json(405, { ok: false, error: "Method not allowed." });
  // Without mail settings a booking can't be confirmed, so offer no times.
  if (!mailConfigured()) return json(503, { ok: false, error: "Booking is not set up yet." });
  try {
    const now = new Date();
    const until = new Date(now.getTime() + (BOOKING.horizonDays + 1) * 86400_000);
    const busy = await busyBetween(now, until);
    const slots = generateSlots(busy, now).map((d) => d.toISOString());
    return json(200, { ok: true, durationMin: BOOKING.durationMin, slots });
  } catch (err) {
    console.error("[slots]", err);
    return json(500, { ok: false, error: "Couldn't load times." });
  }
}

export const GET = handler;
