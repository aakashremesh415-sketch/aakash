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
/** The join link for this booking: its own Meet/Teams meeting if one was created, else MEETING_URL. */
const joinUrl = (b) => b.meetingUrl || BOOKING.meetingUrl || "";
/** "Google Meet", "Microsoft Teams", or a guess from the fixed MEETING_URL. */
const providerOf = (b) => b.meetingProvider ||
  (/^https:\/\/meet\.google\.com\//.test(joinUrl(b)) ? "Google Meet" : /^https:\/\/teams\.(microsoft|live)\.com\//.test(joinUrl(b)) ? "Microsoft Teams" : "");

const when = (date, tz) =>
  new Intl.DateTimeFormat("en-US", { timeZone: tz, weekday: "long", day: "numeric", month: "long", year: "numeric", hour: "numeric", minute: "2-digit", timeZoneName: "short" }).format(date);

function layout(title, bodyHtml) {
  return `<!doctype html><html><body style="margin:0;background:#f2f2f4;font-family:Montserrat,Segoe UI,Arial,sans-serif;color:#111216">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:28px 12px">
<table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:16px;padding:28px">
<tr><td>
<p style="margin:0 0 4px;font:600 12px/1.4 monospace;letter-spacing:.12em;text-transform:uppercase;color:#0648ae">CA Shreeya Mundade · Chartered Accountant</p>
<h1 style="margin:0 0 16px;font:700 24px/1.25 Montserrat,Segoe UI,Arial,sans-serif">${escapeHtml(title)}</h1>
${bodyHtml}
<p style="margin:24px 0 0;color:#5d616b;font-size:13px">shreeyamundade.com</p>
</td></tr></table></td></tr></table></body></html>`;
}

const row = (k, v) => `<tr><td style="padding:6px 12px 6px 0;color:#5d616b;vertical-align:top;white-space:nowrap">${escapeHtml(k)}</td><td style="padding:6px 0">${escapeHtml(v)}</td></tr>`;
const table = (rows) => `<table role="presentation" cellpadding="0" cellspacing="0" style="font-size:15px;line-height:1.5">${rows.join("")}</table>`;

const mins = (b) => b.durationMin || BOOKING.durationMin;
/** "QuickBooks Online, Xero · 2-3 entities" from the two optional prep questions. */
const prepLine = (b) => [Array.isArray(b.software) && b.software.length ? b.software.join(", ") : "", b.entities ? `${b.entities} ${b.entities === "1" ? "entity" : "entities"}` : ""].filter(Boolean).join(" · ");

export function bookingIcs(b, { method = "REQUEST", sequence = 0 } = {}) {
  return buildIcs({
    uid: b.uid,
    start: new Date(b.start),
    end: new Date(b.end),
    summary: `${BOOKING.title}: ${b.company}`,
    description:
      `${mins(b)}-minute call with Shreeya Mundade.\n` +
      (joinUrl(b) ? `Join: ${joinUrl(b)}\n` : "A video link will follow by email.\n") +
      `Booked by ${b.fullName} (${b.email}), ${b.company}.` +
      (prepLine(b) ? `\nSetup: ${prepLine(b)}` : "") +
      (b.notes ? `\nNotes: ${b.notes}` : "") +
      (b.cancelUrl && method !== "CANCEL" ? `\nCancel or reschedule: ${b.cancelUrl}` : ""),
    location: providerOf(b) ? `${providerOf(b)} meeting` : (joinUrl(b) || "Video call"),
    url: joinUrl(b) || undefined,
    organizer: { name: MAIL.ownerName, email: fromAddress().address },
    attendees: [{ name: b.fullName, email: b.email }, { name: MAIL.ownerName, email: MAIL.owner }],
    method,
    sequence,
  });
}

const button = (href, label) =>
  `<p style="margin:16px 0"><a href="${escapeHtml(href)}" style="display:inline-block;background:#061425;color:#ffffff;text-decoration:none;font-weight:700;padding:12px 20px;border-radius:999px">${escapeHtml(label)}</a></p>`;
const joinLabel = (b) => providerOf(b) === "Google Meet" ? "Join the Google Meet" : providerOf(b) === "Microsoft Teams" ? "Join the Teams Meeting" : "Join the Video Call";
const changeLine = (b) => b.cancelUrl
  ? `<p style="margin:0">Need a different time? <a href="${escapeHtml(b.cancelUrl)}" style="color:#0648ae">Cancel or reschedule</a>, or just reply to this email.</p>`
  : `<p style="margin:0">Need a different time? Just reply to this email.</p>`;
const changeText = (b) => b.cancelUrl ? `Need a different time? Cancel or reschedule: ${b.cancelUrl}\nOr just reply to this email.` : "Need a different time? Just reply to this email.";

/** Tells Shreeya about a new booking. Throws if it can't be delivered (the booking is then released). */
export async function sendBookingToOwner(b) {
  const start = new Date(b.start);
  const rows = [
    row("When (IST)", when(start, BOOKING.hostTimeZone)),
    row("US Eastern", when(start, BOOKING.displayTimeZone)),
    row("Their time", when(start, b.clientTz)),
    row("Length", `${mins(b)} minutes`),
    row("Name", b.fullName), row("Email", b.email), row("Company", b.company),
  ];
  if (prepLine(b)) rows.push(row("Setup", prepLine(b)));
  if (b.notes) rows.push(row("Notes", b.notes));
  if (joinUrl(b)) rows.push(row(providerOf(b) ? `${providerOf(b)} link` : "Video link", joinUrl(b)));
  const t = await transport();
  return t.sendMail({
    from: fromAddress(),
    to: owner(),
    replyTo: { name: b.fullName, address: b.email },
    subject: `New booking: ${b.fullName} (${b.company}), ${mins(b)} min, ${when(start, BOOKING.hostTimeZone)}`,
    text: `New ${mins(b)}-minute call booked.\n\nWhen (IST): ${when(start, BOOKING.hostTimeZone)}\nUS Eastern: ${when(start, BOOKING.displayTimeZone)}\nTheir time: ${when(start, b.clientTz)}\nName: ${b.fullName}\nEmail: ${b.email}\nCompany: ${b.company}\n${prepLine(b) ? `Setup: ${prepLine(b)}\n` : ""}${b.notes ? `Notes: ${b.notes}\n` : ""}${joinUrl(b) ? `Join: ${joinUrl(b)}\n` : ""}\nReply to this email to reach them.`,
    html: layout("New Booking", table(rows) + `<p style="margin:16px 0 0">Reply to this email to reach ${escapeHtml(b.fullName)}.</p>`),
    icalEvent: { method: "REQUEST", filename: "invite.ics", content: bookingIcs(b) },
  });
}

/** The visitor's own time, plus US Eastern when that differs. */
const visitorWhen = (b) => {
  const start = new Date(b.start);
  const theirs = when(start, b.clientTz);
  const eastern = when(start, BOOKING.displayTimeZone);
  return { theirs, eastern: theirs === eastern ? "" : eastern };
};

/** Confirmation + calendar invite to the visitor. */
export async function sendBookingConfirmation(b) {
  const { theirs, eastern } = visitorWhen(b);
  const link = joinUrl(b) ? button(joinUrl(b), joinLabel(b)) : `<p style="margin:16px 0">I'll send the video link before the call.</p>`;
  const t = await transport();
  return t.sendMail({
    from: fromAddress(),
    to: { name: b.fullName, address: b.email },
    replyTo: owner(),
    subject: `Confirmed: ${mins(b)}-minute call with Shreeya Mundade, ${theirs}`,
    text: `Hi ${b.fullName},\n\nThanks for booking a ${mins(b)}-minute call.\n\nWhen: ${theirs}\n${eastern ? `US Eastern: ${eastern}\n` : ""}${joinUrl(b) ? `Join: ${joinUrl(b)}\n` : "I'll send the video link before the call.\n"}\nThe calendar invite is attached. ${changeText(b)}\n\nShreeya Mundade\nhttps://shreeyamundade.com`,
    html: layout("Your Call Is Booked", `<p style="margin:0 0 12px">Hi ${escapeHtml(b.fullName)}, thanks for booking a ${mins(b)}-minute call.</p>` +
      table([row("When", theirs), ...(eastern ? [row("US Eastern", eastern)] : []), row("Length", `${mins(b)} minutes`), row("With", "Shreeya Mundade")]) + link +
      `<p style="margin:0 0 12px">The calendar invite is attached.</p>` + changeLine(b)),
    icalEvent: { method: "REQUEST", filename: "invite.ics", content: bookingIcs(b) },
  });
}

/** The day-before reminder to the visitor (sent by /api/remind). */
export async function sendReminder(b) {
  const { theirs, eastern } = visitorWhen(b);
  const link = joinUrl(b) ? button(joinUrl(b), joinLabel(b)) : `<p style="margin:16px 0">I'll send the video link shortly before we start.</p>`;
  const t = await transport();
  return t.sendMail({
    from: fromAddress(),
    to: { name: b.fullName, address: b.email },
    replyTo: owner(),
    subject: `Reminder: call with Shreeya Mundade, ${theirs}`,
    text: `Hi ${b.fullName},\n\nA reminder about our ${mins(b)}-minute call.\n\nWhen: ${theirs}\n${eastern ? `US Eastern: ${eastern}\n` : ""}${joinUrl(b) ? `Join: ${joinUrl(b)}\n` : ""}\n${changeText(b)}\n\nSee you then,\nShreeya`,
    html: layout("See You Soon", `<p style="margin:0 0 12px">Hi ${escapeHtml(b.fullName)}, a reminder about our ${mins(b)}-minute call.</p>` +
      table([row("When", theirs), ...(eastern ? [row("US Eastern", eastern)] : [])]) + link + changeLine(b)),
  });
}

/** Cancellation: tells Shreeya, and sends the visitor a CANCEL invite so the event leaves their calendar. */
export async function sendCancellation(b, { rebooking = false } = {}) {
  const start = new Date(b.start);
  const t = await transport();
  const { theirs } = visitorWhen(b);
  const cancelIcs = bookingIcs(b, { method: "CANCEL", sequence: 1 });
  const results = await Promise.allSettled([
    t.sendMail({
      from: fromAddress(),
      to: owner(),
      replyTo: { name: b.fullName, address: b.email },
      subject: `Cancelled: ${b.fullName} (${b.company}), ${when(start, BOOKING.hostTimeZone)}`,
      text: `${b.fullName} (${b.company}) cancelled their ${mins(b)}-minute call on ${when(start, BOOKING.hostTimeZone)}.${rebooking ? " They're picking a new time." : ""}\nThe slot is open again.`,
      html: layout("Call Cancelled", table([row("When (IST)", when(start, BOOKING.hostTimeZone)), row("Name", b.fullName), row("Company", b.company), row("Email", b.email)]) +
        `<p style="margin:16px 0 0">${rebooking ? "They're picking a new time on the site. " : ""}The slot is open again.</p>`),
      icalEvent: { method: "CANCEL", filename: "cancel.ics", content: cancelIcs },
    }),
    t.sendMail({
      from: fromAddress(),
      to: { name: b.fullName, address: b.email },
      replyTo: owner(),
      subject: `Cancelled: call with Shreeya Mundade, ${theirs}`,
      text: `Hi ${b.fullName},\n\nYour call on ${theirs} is cancelled.${rebooking ? "" : ` You can book another time at ${BOOKING.siteUrl}/#contact`}\n\nShreeya Mundade`,
      html: layout("Call Cancelled", `<p style="margin:0 0 12px">Hi ${escapeHtml(b.fullName)}, your call on ${escapeHtml(theirs)} is cancelled.</p>` +
        (rebooking ? "" : button(`${BOOKING.siteUrl}/#contact`, "Book another time"))),
      icalEvent: { method: "CANCEL", filename: "cancel.ics", content: cancelIcs },
    }),
  ]);
  for (const r of results) if (r.status === "rejected") console.error("[cancel] email failed", r.reason);
}

/** Contact-form message to Shreeya. No auto-reply, so the form can't be used to email strangers. */
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
      `<div style="margin:16px 0 0;padding:14px 16px;background:#f2f2f4;border-radius:12px;white-space:pre-wrap;font-size:15px;line-height:1.55">${escapeHtml(m.message)}</div>`),
  });
}
