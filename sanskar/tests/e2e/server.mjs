// A local copy of the site for browser tests: serves public/ and runs the REAL booking
// functions in-process, with an in-memory store and a fake mailbox (nothing is sent or saved).
import http from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("../../public/", import.meta.url));
const TYPES = { ".html": "text/html; charset=utf-8", ".css": "text/css", ".js": "text/javascript", ".svg": "image/svg+xml", ".webp": "image/webp", ".png": "image/png", ".ico": "image/x-icon", ".woff2": "font/woff2", ".pdf": "application/pdf", ".txt": "text/plain", ".jpg": "image/jpeg", ".mp4": "video/mp4" };

export async function startServer() {
  const server = http.createServer();
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  const origin = `http://127.0.0.1:${server.address().port}`;

  Object.assign(process.env, {
    SMTP_HOST: "127.0.0.1", MAIL_FROM: "Sanskar Mittal <hello@sanskarmittal.com>", OWNER_EMAIL: "owner@example.com",
    MEETING_URL: "https://meet.google.com/test-link-abc", BOOKING_SECRET: "e2e-secret-0123456789abcdef", SITE_URL: origin,
  });
  for (const k of ["GOOGLE_CLIENT_ID", "MS_TENANT_ID"]) delete process.env[k];

  const store = await import("../../api/_lib/store.js");
  const mail = await import("../../api/_lib/mail.js");
  const mem = store.memoryStore();
  store.useStore(mem);
  const outbox = [];
  mail.useTransport({ async sendMail(m) { outbox.push(m); return { messageId: String(outbox.length) }; } });
  const api = {
    "GET /api/slots": (await import("../../api/slots.js")).GET,
    "POST /api/book": (await import("../../api/book.js")).POST,
    "POST /api/cancel": (await import("../../api/cancel.js")).POST,
    "POST /api/message": (await import("../../api/message.js")).POST,
  };

  server.on("request", async (req, res) => {
    try {
      const url = new URL(req.url, origin);
      const fn = api[`${req.method} ${url.pathname}`];
      if (fn) {
        const chunks = [];
        for await (const c of req) chunks.push(c);
        const headers = new Headers();
        for (const [k, v] of Object.entries(req.headers)) headers.set(k, Array.isArray(v) ? v.join(",") : v);
        headers.set("x-real-ip", `127.0.0.${Math.floor(Math.random() * 250) + 1}`); // keep the rate limit out of the way
        const r = await fn(new Request(url, { method: req.method, headers, body: req.method === "POST" ? Buffer.concat(chunks) : undefined }));
        res.writeHead(r.status, Object.fromEntries(r.headers));
        res.end(Buffer.from(await r.arrayBuffer()));
        return;
      }
      // Static files with Vercel-style clean URLs (/cancel -> cancel.html).
      let path = normalize(decodeURIComponent(url.pathname)).replace(/^([/\\])+/, "");
      if (!path) path = "index.html";
      let file = join(ROOT, path);
      if (!file.startsWith(ROOT)) { res.writeHead(403).end(); return; }
      try { if ((await stat(file)).isDirectory()) file = join(file, "index.html"); } catch { file += ".html"; }
      const body = await readFile(file);
      res.writeHead(200, { "Content-Type": TYPES[extname(file)] || "application/octet-stream" });
      res.end(body);
    } catch {
      res.writeHead(404).end("not found");
    }
  });

  return { origin, outbox, mem, store, close: () => new Promise((r) => server.close(r)) };
}
