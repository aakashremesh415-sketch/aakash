// Booking and mail settings. Everything can be overridden with environment
// variables in Vercel (Project → Settings → Environment Variables).

const env = (k, d) => (process.env[k] ?? "").trim() || d;
const num = (k, d) => {
  const n = Number(env(k, ""));
  return Number.isFinite(n) && n > 0 ? n : d;
};

// Like num(), but 0 is a valid value.
const whole = (k, d) => {
  const v = env(k, "");
  const n = Number(v);
  return v !== "" && Number.isInteger(n) && n >= 0 ? n : d;
};

// "10:00-13:00,18:30-22:00" -> [[600, 780], [1110, 1320]] (minutes after midnight).
// A window may run past midnight: "17:00-01:00" -> [[1020, 1500]]. It belongs to the day it starts on.
function parseWindows(spec) {
  return spec.split(",").map((w) => w.trim()).filter(Boolean).map((w) => {
    const [a, b] = w.split("-").map((t) => {
      const [h, m = "0"] = t.trim().split(":");
      return Number(h) * 60 + Number(m);
    });
    const end = b <= a ? b + 24 * 60 : b;
    if (!(a >= 0 && a < 24 * 60 && b >= 0 && b <= 24 * 60 && end - a <= 24 * 60)) throw new Error(`Bad BOOKING_WINDOWS entry: ${w}`);
    return [a, end];
  });
}

const baseDuration = num("BOOKING_DURATION_MIN", 20);
// Call lengths a visitor can choose, e.g. "20,45". The first is the default.
// Every length must be at least the base one; longer calls take more than one 30-minute cell.
const durations = [...new Set(env("BOOKING_DURATIONS", `${baseDuration},45`).split(",").map((v) => Number(v.trim())))]
  .filter((n) => Number.isInteger(n) && n >= baseDuration && n <= 120);

export const BOOKING = {
  title: "Call with Shreeya Mundade",
  // The base call length; slot cells are this long plus the buffer (20 + 10 = a 30-minute grid).
  durationMin: baseDuration,
  durations: durations.length ? durations : [baseDuration],
  bufferMin: num("BOOKING_BUFFER_MIN", 10),
  // Availability is defined in this time zone; the page shows slots in DISPLAY_TZ.
  hostTimeZone: env("BOOKING_TZ", "Asia/Kolkata"),
  // Mon-Fri by default (0 = Sunday … 6 = Saturday): the day a window starts on.
  workingDays: env("BOOKING_DAYS", "1,2,3,4,5").split(",").map(Number),
  // 5 PM to 1 AM IST = US Eastern morning to mid-afternoon.
  windows: parseWindows(env("BOOKING_WINDOWS", "17:00-01:00")),
  // Time zone the booking calendar and emails show times in (besides the visitor's own).
  displayTimeZone: env("BOOKING_DISPLAY_TZ", "America/New_York"),
  // Earliest bookable day = today + leadDays (in hostTimeZone). 2 = book today, meet in two days at the earliest.
  leadDays: whole("BOOKING_LEAD_DAYS", 2),
  minNoticeHours: num("BOOKING_MIN_NOTICE_HOURS", 1),
  horizonDays: num("BOOKING_HORIZON_DAYS", 21),
  maxUpcomingPerEmail: 2,
  meetingUrl: env("MEETING_URL", ""),
  // Public address of the site, used in links inside emails (cancel / reschedule).
  siteUrl: env("SITE_URL", "https://www.shreeyamundade.com").replace(/\/+$/, ""),
  // Long random string. Signs cancel links and encrypts the contact details kept for reminders.
  // Without it, bookings still work but emails carry no cancel link and no reminders are sent.
  secret: env("BOOKING_SECRET", ""),
  // Reminders go out for calls starting between these many hours from the cron run.
  // The default cron runs once a day at 11:00 UTC, so 12-36 h covers the next day's calls.
  remindFromHours: num("REMIND_FROM_HOURS", 12),
  remindToHours: num("REMIND_TO_HOURS", 36),
};

/** Booking settings for one call length (falls back to the base length). */
export function bookingFor(durationMin) {
  const d = BOOKING.durations.includes(Number(durationMin)) ? Number(durationMin) : BOOKING.durations[0];
  return { ...BOOKING, durationMin: d };
}

export const secretConfigured = () => BOOKING.secret.length >= 16;

export const MAIL = {
  host: env("SMTP_HOST", ""),
  port: num("SMTP_PORT", 587),
  // true for port 465 (implicit TLS); 587 upgrades with STARTTLS.
  secure: env("SMTP_SECURE", "") ? env("SMTP_SECURE", "") === "true" : num("SMTP_PORT", 587) === 465,
  user: env("SMTP_USER", ""),
  pass: env("SMTP_PASS", ""),
  from: env("MAIL_FROM", ""), // e.g. "Shreeya Mundade <hello@shreeyamundade.com>"
  owner: env("OWNER_EMAIL", ""), // where bookings and messages are delivered; never sent to the browser
  ownerName: "Shreeya Mundade",
};

export function mailConfigured() {
  return Boolean(MAIL.host && MAIL.from && MAIL.owner);
}
