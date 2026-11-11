// Request helpers shared by the functions: JSON responses, input cleaning,
// same-origin check, spam traps and a per-instance rate limit.

export const json = (status, body) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" },
  });

// Control characters (including line breaks) are removed so nothing typed into
// a form can reach an email header or calendar line as a new line.
export const clean = (v, max = 200) =>
  typeof v === "string" ? v.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, max) : "";
// Multi-line text keeps its line breaks but nothing else.
export const cleanText = (v, max = 4000) =>
  typeof v === "string" ? v.replace(/\r\n?/g, "\n").replace(/[\u0000-\u0009\u000b-\u001f\u007f]/g, " ").trim().slice(0, max) : "";

export const EMAIL_RE = /^[^\s@<>"',;]+@[^\s@<>"',;]+\.[^\s@<>"',;]+$/;

export const validTz = (tz) => {
  try { new Intl.DateTimeFormat("en-US", { timeZone: tz }); return true; } catch { return false; }
};

const ALLOWED_HOSTS = (process.env.ALLOWED_ORIGINS || "aakashremesh.com,www.aakashremesh.com")
  .split(",").map((s) => s.trim()).filter(Boolean);

/** Rejects cross-site form posts. Vercel preview URLs (*.vercel.app) are allowed too. */
export function sameOrigin(req) {
  const origin = req.headers.get("origin");
  if (!origin) return true; // non-browser clients; the other checks still apply
  try {
    const { hostname } = new URL(origin);
    return ALLOWED_HOSTS.includes(hostname) || hostname.endsWith(".vercel.app") || hostname === "localhost" || hostname === "127.0.0.1";
  } catch { return false; }
}

// Simple per-instance rate limit: `limit` requests / 10 min / IP / bucket.
const hits = new Map();
export function limited(bucket, ip, limit = 5) {
  const key = `${bucket}:${ip}`;
  const now = Date.now();
  const arr = (hits.get(key) || []).filter((t) => now - t < 600_000);
  arr.push(now);
  hits.set(key, arr);
  return arr.length > limit;
}

export const clientIp = (req) =>
  req.headers.get("x-real-ip") || req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";

/** Honeypot filled, or the form was submitted faster than a person could type it. */
export const looksLikeBot = (body) => Boolean(clean(body.website)) || Number(body.elapsedMs) < 2500;

export async function readJson(req) {
  if (req.method !== "POST") return { error: json(405, { ok: false, error: "Method not allowed." }) };
  if (!/application\/json/i.test(req.headers.get("content-type") || "")) return { error: json(415, { ok: false, error: "Expected JSON." }) };
  const text = await req.text();
  if (text.length > 20_000) return { error: json(413, { ok: false, error: "Request too large." }) };
  try {
    const body = JSON.parse(text);
    if (!body || typeof body !== "object" || Array.isArray(body)) throw new Error();
    return { body };
  } catch {
    return { error: json(400, { ok: false, error: "Invalid request." }) };
  }
}

export const escapeHtml = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
