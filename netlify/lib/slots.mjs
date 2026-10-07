import { BOOKING } from "./config.mjs";

// ---- Time zone helpers (no external dependency, DST-safe) -----------------

function tzOffsetMs(date, tz) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz, hourCycle: "h23",
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  }).formatToParts(date);
  const get = (t) => Number(parts.find((p) => p.type === t).value);
  const asUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
  return asUtc - date.getTime();
}

/** Wall-clock time in `tz` -> UTC Date. */
export function zonedToUtc(y, m, d, hh, mm, tz) {
  const guess = Date.UTC(y, m - 1, d, hh, mm);
  const off1 = tzOffsetMs(new Date(guess), tz);
  let t = guess - off1;
  const off2 = tzOffsetMs(new Date(t), tz);
  if (off2 !== off1) t = guess - off2;
  return new Date(t);
}

function ymdInTz(date, tz) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(date);
  const get = (t) => Number(parts.find((p) => p.type === t).value);
  return { y: get("year"), m: get("month"), d: get("day") };
}

// ---- Slots ------------------------------------------------------------------

/** All bookable start times, minus anything that clashes with `busy` (array of {start, end} Dates). */
export function generateSlots(busy, now = new Date(), cfg = BOOKING) {
  const { hostTimeZone: tz, durationMin, bufferMin, minNoticeHours, horizonDays, workingDays, windows } = cfg;
  const earliest = now.getTime() + minNoticeHours * 3600_000;
  const step = durationMin + bufferMin;
  const today = ymdInTz(now, tz);
  const out = [];

  for (let i = 0; i <= horizonDays; i++) {
    const day = new Date(Date.UTC(today.y, today.m - 1, today.d + i));
    if (!workingDays.includes(day.getUTCDay())) continue;
    const y = day.getUTCFullYear(), m = day.getUTCMonth() + 1, d = day.getUTCDate();
    for (const [startMin, endMin] of windows) {
      for (let t = startMin; t + durationMin <= endMin; t += step) {
        const s = zonedToUtc(y, m, d, Math.floor(t / 60), t % 60, tz);
        const sMs = s.getTime();
        const eMs = sMs + durationMin * 60_000;
        if (sMs < earliest) continue;
        const clash = busy.some((b) =>
          sMs < b.end.getTime() + bufferMin * 60_000 && b.start.getTime() < eMs + bufferMin * 60_000);
        if (!clash) out.push(s);
      }
    }
  }
  return out.sort((a, b) => a - b);
}

export function isOfferedSlot(start, busy, now = new Date(), cfg = BOOKING) {
  return generateSlots(busy, now, cfg).some((s) => s.getTime() === start.getTime());
}

export function slotEnd(start, cfg = BOOKING) {
  return new Date(start.getTime() + cfg.durationMin * 60_000);
}
