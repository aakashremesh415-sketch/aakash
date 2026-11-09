// Cancel-link signatures and encryption for the contact details kept until a call
// (used only to send the reminder and handle a cancellation; deleted after the call).
// Both use BOOKING_SECRET; nothing here works without it.
import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { BOOKING } from "./config.js";

const b64url = (buf) => Buffer.from(buf).toString("base64url");
const key = (purpose) => createHash("sha256").update(`${BOOKING.secret}:${purpose}`).digest();

/** AES-256-GCM. Output: base64url(iv | tag | ciphertext). */
export function seal(obj) {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", key("contacts"), iv);
  const data = Buffer.concat([c.update(JSON.stringify(obj), "utf8"), c.final()]);
  return b64url(Buffer.concat([iv, c.getAuthTag(), data]));
}

/** Reverses seal(); returns null if the data was tampered with or the secret changed. */
export function open(text) {
  try {
    const raw = Buffer.from(String(text), "base64url");
    const d = createDecipheriv("aes-256-gcm", key("contacts"), raw.subarray(0, 12));
    d.setAuthTag(raw.subarray(12, 28));
    return JSON.parse(Buffer.concat([d.update(raw.subarray(28)), d.final()]).toString("utf8"));
  } catch {
    return null;
  }
}

const sig = (start, uid) => createHmac("sha256", key("cancel")).update(`${start}|${uid}`).digest().subarray(0, 18);

/** Token for the cancel link: base64url(start ISO) "." signature over start + the booking's uid. */
export function cancelToken(start, uid) {
  return `${b64url(start)}.${b64url(sig(start, uid))}`;
}

/** The start ISO named by a token (not yet trusted; check it with tokenMatches). */
export function tokenStart(token) {
  const [a] = String(token || "").split(".");
  try {
    const s = Buffer.from(a, "base64url").toString("utf8");
    return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(s) ? s : null;
  } catch {
    return null;
  }
}

export function tokenMatches(token, start, uid) {
  const [, b] = String(token || "").split(".");
  if (!b) return false;
  const given = Buffer.from(b, "base64url");
  const want = sig(start, uid);
  return given.length === want.length && timingSafeEqual(given, want);
}
