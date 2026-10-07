// Booking and mail settings. Everything can be overridden with environment
// variables in Netlify (Site configuration → Environment variables).

const env = (k, d) => (process.env[k] ?? "").trim() || d;
const num = (k, d) => {
  const n = Number(env(k, ""));
  return Number.isFinite(n) && n > 0 ? n : d;
};

// "10:00-13:00,18:30-22:00" -> [[600, 780], [1110, 1320]] (minutes after midnight)
function parseWindows(spec) {
  return spec.split(",").map((w) => w.trim()).filter(Boolean).map((w) => {
    const [a, b] = w.split("-").map((t) => {
      const [h, m = "0"] = t.trim().split(":");
      return Number(h) * 60 + Number(m);
    });
    if (!(a >= 0 && b > a && b <= 24 * 60)) throw new Error(`Bad BOOKING_WINDOWS entry: ${w}`);
    return [a, b];
  });
}

export const BOOKING = {
  title: "Call with Aakash Remesh",
  durationMin: num("BOOKING_DURATION_MIN", 20),
  bufferMin: num("BOOKING_BUFFER_MIN", 10),
  // Availability is defined in this time zone; visitors see slots in their own.
  hostTimeZone: env("BOOKING_TZ", "Asia/Kolkata"),
  // Mon-Fri by default (0 = Sunday … 6 = Saturday).
  workingDays: env("BOOKING_DAYS", "1,2,3,4,5").split(",").map(Number),
  // Default windows overlap New Zealand/Europe (morning IST) and the US (evening IST).
  windows: parseWindows(env("BOOKING_WINDOWS", "10:00-13:00,18:30-22:00")),
  minNoticeHours: num("BOOKING_MIN_NOTICE_HOURS", 12),
  horizonDays: num("BOOKING_HORIZON_DAYS", 14),
  maxUpcomingPerEmail: 2,
  meetingUrl: env("MEETING_URL", ""),
};

export const MAIL = {
  host: env("SMTP_HOST", ""),
  port: num("SMTP_PORT", 587),
  // true for port 465 (implicit TLS); 587 upgrades with STARTTLS.
  secure: env("SMTP_SECURE", "") ? env("SMTP_SECURE", "") === "true" : num("SMTP_PORT", 587) === 465,
  user: env("SMTP_USER", ""),
  pass: env("SMTP_PASS", ""),
  from: env("MAIL_FROM", ""), // e.g. "Aakash Remesh <hello@aakashremesh.com>"
  owner: env("OWNER_EMAIL", ""), // where bookings and messages are delivered; never sent to the browser
  ownerName: "Aakash Remesh",
};

export function mailConfigured() {
  return Boolean(MAIL.host && MAIL.from && MAIL.owner);
}
