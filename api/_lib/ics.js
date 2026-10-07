// RFC 5545 calendar invite (works with Google Calendar, Outlook and Apple Calendar).

// Quoted parameter values with quotes/control characters dropped, so a name
// containing ';' ':' or ',' can't break the property.
const param = (s) => `"${String(s).replace(/["\u0000-\u001f\u007f]/g, "")}"`;
const stamp = (d) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
const esc = (s) => String(s).replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");

// Fold lines longer than 75 octets (continuation lines start with a space).
function fold(line) {
  if (Buffer.byteLength(line, "utf8") <= 75) return line;
  const chunks = [];
  let cur = "";
  for (const ch of line) {
    const limit = chunks.length === 0 ? 75 : 74;
    if (Buffer.byteLength(cur + ch, "utf8") > limit) { chunks.push(cur); cur = ""; }
    cur += ch;
  }
  if (cur) chunks.push(cur);
  return chunks.join("\r\n ");
}

export function buildIcs({ uid, start, end, summary, description, location, url, organizer, attendees, method = "REQUEST" }) {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//aakashremesh.com//Booking//EN",
    "CALSCALE:GREGORIAN",
    `METHOD:${method}`,
    "BEGIN:VEVENT",
    `UID:${uid}`,
    "SEQUENCE:0",
    `DTSTAMP:${stamp(new Date())}`,
    `DTSTART:${stamp(start)}`,
    `DTEND:${stamp(end)}`,
    `SUMMARY:${esc(summary)}`,
    `DESCRIPTION:${esc(description)}`,
    location ? `LOCATION:${esc(location)}` : "",
    url ? `URL:${url}` : "",
    `ORGANIZER;CN=${param(organizer.name)}:mailto:${organizer.email}`,
    ...attendees.map((a) => `ATTENDEE;CN=${param(a.name)};ROLE=REQ-PARTICIPANT;PARTSTAT=NEEDS-ACTION;RSVP=TRUE:mailto:${a.email}`),
    "STATUS:CONFIRMED",
    "TRANSP:OPAQUE",
    "BEGIN:VALARM",
    "ACTION:DISPLAY",
    "DESCRIPTION:Call with Aakash Remesh in 15 minutes",
    "TRIGGER:-PT15M",
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR",
  ].filter(Boolean);
  return lines.map(fold).join("\r\n") + "\r\n";
}
