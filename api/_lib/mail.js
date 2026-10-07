// SMTP email via nodemailer. Settings come from environment variables (see config.js).
import { BOOKING, MAIL } from "./config.js";
import { buildIcs } from "./ics.js";
import { escapeHtml } from "./http.js";

let transportOverride = null;
/** Tests inject a transport with a sendMail() method. */
export function useTransport(t) { transportOverride = t; }

let cached = null;
async function transport() {
  if (transportOverride) return transportOverride;
  if (!cached) {
    const nodemailer = (await import("nodemailer")).default;
    cached = nodemailer.createTransport({
      host: MAIL.host,
      port: MAIL.port,
      secure: MAIL.secure,
      requireTLS: !MAIL.secure,
      auth: MAIL.user ? { user: MAIL.user, pass: MAIL.pass } : undefined,
      connectionTimeout: 10_000,
      greetingTimeout: 10_000,
      socketTimeout: 15_000,
    });
  }
  return cached;
}

const fromAddress = () => {
  const m = /^\s*(.*?)\s*<([^>]+)>\s*$/.exec(MAIL.from);
  return m ? { name: m[1].replace(/^"|"$/g, "") || MAIL.ownerName, address: m[2] } : { name: MAIL.ownerName, address: MAIL.from };
};
const owner = () => ({ name: MAIL.ownerName, address: MAIL.owner });
/** The join link for this booking: its own Teams meeting if one was created, else MEETING_URL. */
const joinUrl = (b) => b.meetingUrl || BOOKING.meetingUrl || "";

const when = (date, tz) =>
  new Intl.DateTimeFormat("en-US", { timeZone: tz, weekday: "long", day: "numeric", month: "long", year: "numeric", hour: "numeric", minute: "2-digit", timeZoneName: "short" }).format(date);

function layout(title, bodyHtml) {
  return `<!doctype html><html><body style="margin:0;background:#f4f1ff;font-family:Inter,Segoe UI,Arial,sans-serif;color:#15121f">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:28px 12px">
<table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:16px;padding:28px">
<tr><td>
<p style="margin:0 0 4px;font:600 12px/1.4 monospace;letter-spacing:.12em;text-transform:uppercase;color:#5b3df5">Aakash Remesh · Accounting Systems</p>
<h1 style="margin:0 0 16px;font:600 24px/1.25 Georgia,serif">${escapeHtml(title)}</h1>
${bodyHtml}
<p style="margin:24px 0 0;color:#625c7a;font-size:13px">aakashremesh.com</p>
</td></tr></table></td></tr></table></body></html>`;
}

const row = (k, v) => `<tr><td style="padding:6px 12px 6px 0;color:#625c7a;vertical-align:top;white-space:nowrap">${escapeHtml(k)}</td><td style="padding:6px 0">${escapeHtml(v)}</td></tr>`;
const table = (rows) => `<table role="presentation" cellpadding="0" cellspacing="0" style="font-size:15px;line-height:1.5">${rows.join("")}</table>`;

export function bookingIcs(b) {
  return buildIcs({
    uid: b.uid,
    start: new Date(b.start),
    end: new Date(b.end),
    summary: `${BOOKING.title}: ${b.company}`,
    description:
      `${BOOKING.durationMin}-minute call with Aakash Remesh.\n` +
      (joinUrl(b) ? `Join: ${joinUrl(b)}\n` : "A video link will follow by email.\n") +
      `Booked by ${b.fullName} (${b.email}), ${b.company}.` +
      (b.notes ? `\nNotes: ${b.notes}` : ""),
    location: b.meetingUrl ? "Microsoft Teams meeting" : (BOOKING.meetingUrl || "Video call"),
    url: joinUrl(b) || undefined,
    organizer: { name: MAIL.ownerName, email: fromAddress().address },
    attendees: [{ name: b.fullName, email: b.email }, { name: MAIL.ownerName, email: MAIL.owner }],
  });
}

/** Tells Aakash about a new booking. Throws if it can't be delivered (the booking is then released). */
export async function sendBookingToOwner(b) {
  const start = new Date(b.start);
  const rows = [
    row("When (IST)", when(start, BOOKING.hostTimeZone)),
    row("Their time", when(start, b.clientTz)),
    row("Name", b.fullName), row("Email", b.email), row("Company", b.company),
  ];
  if (b.notes) rows.push(row("Notes", b.notes));
  if (joinUrl(b)) rows.push(row(b.meetingUrl ? "Teams link" : "Video link", joinUrl(b)));
  const t = await transport();
  return t.sendMail({
    from: fromAddress(),
    to: owner(),
    replyTo: { name: b.fullName, address: b.email },
    subject: `New booking: ${b.fullName} (${b.company}), ${when(start, BOOKING.hostTimeZone)}`,
    text: `New ${BOOKING.durationMin}-minute call booked.\n\nWhen (IST): ${when(start, BOOKING.hostTimeZone)}\nTheir time: ${when(start, b.clientTz)}\nName: ${b.fullName}\nEmail: ${b.email}\nCompany: ${b.company}\n${b.notes ? `Notes: ${b.notes}\n` : ""}${joinUrl(b) ? `Join: ${joinUrl(b)}\n` : ""}\nReply to this email to reach them.`,
    html: layout("New Booking", table(rows) + `<p style="margin:16px 0 0">Reply to this email to reach ${escapeHtml(b.fullName)}.</p>`),
    icalEvent: { method: "REQUEST", filename: "invite.ics", content: bookingIcs(b) },
  });
}

/** Confirmation + calendar invite to the visitor. */
export async function sendBookingConfirmation(b) {
  const start = new Date(b.start);
  const link = joinUrl(b)
    ? `<p style="margin:16px 0"><a href="${escapeHtml(joinUrl(b))}" style="display:inline-block;background:#15121f;color:#fbfaff;text-decoration:none;font-weight:700;padding:12px 20px;border-radius:999px">${b.meetingUrl ? "Join the Teams Meeting" : "Join the Video Call"}</a></p>`
    : `<p style="margin:16px 0">I'll send the video link before the call.</p>`;
  const t = await transport();
  return t.sendMail({
    from: fromAddress(),
    to: { name: b.fullName, address: b.email },
    replyTo: owner(),
    subject: `Confirmed: ${BOOKING.durationMin}-minute call with Aakash Remesh, ${when(start, b.clientTz)}`,
    text: `Hi ${b.fullName},\n\nThanks for booking a ${BOOKING.durationMin}-minute call.\n\nWhen: ${when(start, b.clientTz)}\n${joinUrl(b) ? `Join: ${joinUrl(b)}\n` : "I'll send the video link before the call.\n"}\nThe calendar invite is attached. Need a different time? Just reply to this email.\n\nAakash Remesh\nhttps://aakashremesh.com`,
    html: layout("Your Call Is Booked", `<p style="margin:0 0 12px">Hi ${escapeHtml(b.fullName)}, thanks for booking a ${BOOKING.durationMin}-minute call.</p>` +
      table([row("When", when(start, b.clientTz)), row("With", "Aakash Remesh")]) + link +
      `<p style="margin:0">The calendar invite is attached. Need a different time? Just reply to this email.</p>`),
    icalEvent: { method: "REQUEST", filename: "invite.ics", content: bookingIcs(b) },
  });
}

/** Contact-form message to Aakash. No auto-reply, so the form can't be used to email strangers. */
export async function sendMessageToOwner(m) {
  const rows = [row("Name", m.fullName), row("Email", m.email)];
  if (m.company) rows.push(row("Company", m.company));
  const t = await transport();
  return t.sendMail({
    from: fromAddress(),
    to: owner(),
    replyTo: { name: m.fullName, address: m.email },
    subject: `Website message from ${m.fullName}${m.company ? ` (${m.company})` : ""}`,
    text: `Name: ${m.fullName}\nEmail: ${m.email}\n${m.company ? `Company: ${m.company}\n` : ""}\n${m.message}\n\nReply to this email to answer.`,
    html: layout("New Message", table(rows) +
      `<div style="margin:16px 0 0;padding:14px 16px;background:#f4f1ff;border-radius:12px;white-space:pre-wrap;font-size:15px;line-height:1.55">${escapeHtml(m.message)}</div>`),
  });
}
