// One-time helper: gets the Google refresh token that lets the booking function create
// Google Meet links in your calendar. Run it on your own computer, never on a server:
//
//   GOOGLE_CLIENT_ID=… GOOGLE_CLIENT_SECRET=… node tools/google-auth.mjs
//
// It opens a sign-in link, you approve "See, edit, share and delete events on your calendars",
// and it prints the refresh token. Paste that into Vercel as GOOGLE_REFRESH_TOKEN; don't
// save it anywhere else. Only the calendar-events scope is requested.
import { createServer } from "node:http";
import { createHash, randomBytes } from "node:crypto";

const clientId = process.env.GOOGLE_CLIENT_ID;
const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
if (!clientId || !clientSecret) {
  console.error("Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET first (from Google Cloud → Credentials → your Desktop app client).");
  process.exit(1);
}

const b64url = (buf) => buf.toString("base64url");
const verifier = b64url(randomBytes(48));
const challenge = b64url(createHash("sha256").update(verifier).digest());
const state = b64url(randomBytes(24));

const server = createServer(async (req, res) => {
  const url = new URL(req.url, "http://127.0.0.1");
  if (url.pathname !== "/callback") { res.writeHead(404).end(); return; }
  const done = (msg) => { res.writeHead(200, { "content-type": "text/plain; charset=utf-8" }).end(msg); server.close(); };
  if (url.searchParams.get("state") !== state) return done("State mismatch. Run the script again.");
  if (url.searchParams.get("error")) return done(`Google said: ${url.searchParams.get("error")}`);

  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code: url.searchParams.get("code") ?? "",
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
      code_verifier: verifier,
    }),
  });
  const body = await tokenRes.json();
  if (!body.refresh_token) {
    console.error("No refresh token returned:", body.error || body);
    return done("Something went wrong; see the terminal.");
  }
  console.log("\nGOOGLE_REFRESH_TOKEN (paste into Vercel → Settings → Environment Variables):\n");
  console.log(body.refresh_token + "\n");
  done("Done. You can close this tab and go back to the terminal.");
});

let redirectUri;
server.listen(0, "127.0.0.1", () => {
  redirectUri = `http://127.0.0.1:${server.address().port}/callback`;
  const auth = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  auth.search = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "https://www.googleapis.com/auth/calendar.events",
    access_type: "offline",
    prompt: "consent",
    code_challenge: challenge,
    code_challenge_method: "S256",
    state,
  }).toString();
  console.log("Open this link in your browser and sign in with the Google account whose calendar should host the calls:\n");
  console.log(auth.toString() + "\n");
});
