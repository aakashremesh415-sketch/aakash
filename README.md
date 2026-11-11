# aakashremesh.com

Personal website of Aakash Remesh, bookkeeping and accounting systems consultant.
A static page (HTML/CSS/JS) plus three small serverless functions for call booking and
the contact form.

```
index.html              the page (generated: edit src/, then run the build)
404.html                not-found page
llms.txt                plain summary for AI assistants
src/index.html          page template
src/faq.json            FAQ: rendered as visible Q&A and as FAQPage structured data
src/contact.html        booking + message panel markup
src/seal.svg            inline logo seal used on the portrait
src/resume.html         source of assets/Aakash-Remesh-Resume.pdf
src/js/                 page script (Motion animations, WebGL portrait, booking UI)
tools/bundle.mjs        bundles src/js into assets/app.js (esbuild)
tools/build.py          builds index.html from src/
assets/                 styles, script, fonts (self-hosted), images, résumé PDF
api/                    Vercel functions: /api/slots, /api/book, /api/message
api/_lib/               booking config, slot logic, calendar invites, SMTP mail, storage
tests/                  backend tests (npm test)
tools/google-auth.mjs   one-time helper for the Google Meet refresh token (run locally)
brand/                  logo set and concepts
vercel.json             Vercel settings: output directory, security headers
public/                 build output (generated, not committed)
```

## Editing

1. Edit files in `src/` (copy, sections, FAQ answers).
2. Run `npm run build` (bundles the script, regenerates `index.html`).
3. Commit both.

The FAQ lives only in `src/faq.json`; the build writes it into the page twice (visible and
as structured data), so they always match.

### Adding a newer certificate

Certificates are shown as stacks: the newest sits in front and older ones fan out behind,
so the original issue date stays visible. To add one (e.g. a renewed QuickBooks or Xero
certificate):

1. Save it as WebP in `assets/img/certs/` (about 1100px on the long side; strip metadata).
2. In `src/index.html`, find that certificate's `<span class="cert__stack">` and add a new
   `<img …>` **as the first child**, with `data-caption` (shown in the viewer) and `alt`.
3. Update the `cert__meta` line if needed (e.g. "Intuit · Since 2025 · Renewed 2026"),
   then run the build.

### Adding a testimonial

Reviews live in `src/testimonials.json`; the Client Feedback section shows them as cards
(nothing is shown while the list is empty). Copy each review **word for word** from your
Upwork profile (Work History → the job → the client's feedback) and add an entry:

```json
[
  {
    "quote": "Exact text of the client's review.",
    "name": "Client name as Upwork shows it, e.g. Thomas O.",
    "project": "QuickBooks Online reconciliation",
    "date": "Jun 2026",
    "rating": 5
  }
]
```

Only use real reviews, unchanged (trimming with "…" is fine). Ask the client first if you
want to show their full name or company. Then run the build.

### Regenerating the résumé PDF

`src/resume.html` is the source. Print it to A4 PDF (Chrome → Print → Save as PDF, margins
"Default"), or with Playwright `page.pdf({ format: "A4", preferCSSPageSize: true })`, and save
it as `assets/Aakash-Remesh-Resume.pdf`. It intentionally has no phone number or email.

## Hosting (Vercel)

The site and the booking/contact functions deploy together on **Vercel**. The build
(`npm run build`) regenerates `index.html` and copies only the public site
into `public/`, which Vercel serves; `src/`, `tools/`, `tests/` and `brand/` are never deployed.

1. Vercel → **Add New → Project** → import this repo. Framework preset **Other**. Build
   command and output directory come from `vercel.json`, so leave them as they are.
2. **Storage → Create → Blob**, choose **Private**, and connect it to this project. This adds
   `BLOB_READ_WRITE_TOKEN` automatically. Bookings are stored there as time-slot markers,
   plus an encrypted contact record (name, email, company) that powers the reminder and
   cancel link and is deleted after the call.
3. **Settings → Environment Variables**, add (for Production and Preview):

   | Variable | Example | Notes |
   |---|---|---|
   | `SMTP_HOST` | `smtpout.secureserver.net` | GoDaddy email outgoing server (the domain's mail is GoDaddy, not Titan: `smtp.titan.email` rejects the login with 535) |
   | `SMTP_PORT` | `465` | 465 (SSL/TLS); 587 (STARTTLS) also works |
   | `SMTP_USER` | `info@aakashremesh.com` | The full mailbox address |
   | `SMTP_PASS` | *mailbox password* | The email password used at GoDaddy's email login; store it only in Vercel |
   | `MAIL_FROM` | `Aakash Remesh <info@aakashremesh.com>` | A real address (not a variable name), the same mailbox as `SMTP_USER` |
   | `OWNER_EMAIL` | `you@example.com` | Where bookings and messages arrive. Never sent to browsers |
   | `MEETING_URL` | `https://meet.google.com/abc-defg-hij` | Fixed video link: used when per-call links aren't set up, or as the backup if Google can't be reached |

   Optional booking settings (defaults in brackets):
   `BOOKING_TZ` [`Asia/Kolkata`], `BOOKING_WINDOWS` [`17:00-01:00` = 5 PM to 1 AM IST; a
   window may cross midnight and belongs to the day it starts], `BOOKING_DAYS` [`1,2,3,4,5` =
   Monday to Friday evenings], `BOOKING_DISPLAY_TZ` [`America/New_York` = the calendar shows
   US Eastern Time], `BOOKING_LEAD_DAYS` [`2` = earliest call is two days after booking],
   `BOOKING_DURATION_MIN` [`20`], `BOOKING_BUFFER_MIN` [`10`], `BOOKING_HORIZON_DAYS` [`21`].
   5 PM to 1 AM IST is 7:30 AM to 3:30 PM Eastern in US summer time and 6:30 AM to 2:30 PM in
   winter. Visitors' confirmation emails show their own time plus US Eastern.
4. Redeploy (environment variables apply to new deployments).
5. **Settings → Domains** → add `aakashremesh.com` and `www.aakashremesh.com`, then set the
   DNS records Vercel shows at your registrar.
6. Book a test call on the live site and check both emails arrive.

With Gmail, use `smtp.gmail.com`, port 465, and a Google **app password** (needs 2-Step
Verification). A mailbox on your own domain (Zoho Mail, Google Workspace) delivers more
reliably and looks more professional.

### Google Meet links (recommended)

Every booking gets its own Google Meet: the site creates an event in your Google Calendar
(no guests, so Google emails nobody) and puts the unique Meet link in both emails and the
calendar invite. Works with a free Gmail account or Google Workspace.

**Quick start (no setup):** in Google Calendar create a recurring event with a Meet link
(or open meet.google.com → *New meeting → Create a meeting for later*) and set that link
as `MEETING_URL`. Every call then uses the same link.

**Unique link per call** (about 10 minutes, once):

1. [console.cloud.google.com](https://console.cloud.google.com) → create a project, e.g.
   `aakashremesh-booking`.
2. **APIs & Services → Library** → enable **Google Calendar API**.
3. **APIs & Services → OAuth consent screen** (Google Auth Platform): User type **External**,
   app name `aakashremesh.com booking`, your email as support and developer contact.
   Under **Data access** add the scope `.../auth/calendar.events`. Then under **Audience**
   press **Publish app** (status *In production*). Leave it unverified: you'll see a
   "Google hasn't verified this app" warning once, which is fine because you're the only user.
   *Don't leave it in "Testing": in testing, the token stops working after 7 days.*
4. **Credentials → Create credentials → OAuth client ID → Desktop app**. Copy the client ID
   and client secret.
5. On your own computer, in this repo folder:
   ```sh
   GOOGLE_CLIENT_ID=… GOOGLE_CLIENT_SECRET=… node tools/google-auth.mjs
   ```
   Open the link it prints, sign in with the Google account whose calendar should host the
   calls, press *Advanced → Go to … (unsafe)* on the unverified-app warning, allow access,
   and copy the refresh token it prints.
6. Add to Vercel environment variables (Production), then redeploy:

   | Variable | Value |
   |---|---|
   | `GOOGLE_CLIENT_ID` | From step 4 |
   | `GOOGLE_CLIENT_SECRET` | From step 4 |
   | `GOOGLE_REFRESH_TOKEN` | From step 5 |
   | `GOOGLE_CALENDAR_ID` | Optional; defaults to `primary` (your main calendar) |

7. Book a test call: the event appears in your Google Calendar with a Meet link, and both
   emails carry the same link.

If Google can't be reached when someone books, the booking still goes through with
`MEETING_URL`, and the error appears in Vercel's function logs. If you ever change your
Google password or remove the app's access (myaccount.google.com → Security → Third-party
access), run step 5 again and replace `GOOGLE_REFRESH_TOKEN`.

### Teams meeting links (alternative)

Used only when the Google variables above are not set.


With a **Microsoft 365 business account** that includes Teams, every booking gets its own
Teams meeting: the site creates it in your Outlook calendar (no attendees, so Outlook sends
nothing) and puts the unique join link in both emails and the calendar invite. Free/personal
Teams accounts can't do this. Without these settings, bookings use `MEETING_URL`.

1. [entra.microsoft.com](https://entra.microsoft.com) → **App registrations → New registration**.
   Name `aakashremesh.com booking`, single tenant, no redirect URI.
2. **API permissions → Add → Microsoft Graph → Application permissions → `Calendars.ReadWrite`**,
   then **Grant admin consent**.
3. **Certificates & secrets → New client secret** (24 months). Copy the secret *value* now.
4. Recommended: limit the app to your own mailbox with an Exchange
   [application access policy](https://learn.microsoft.com/graph/auth-limit-mailbox-access)
   (`New-ApplicationAccessPolicy -AccessRight RestrictAccess …`), so it can't touch other calendars.
5. Add to Vercel environment variables, then redeploy:

   | Variable | Value |
   |---|---|
   | `MS_TENANT_ID` | Directory (tenant) ID from the app's Overview page |
   | `MS_CLIENT_ID` | Application (client) ID |
   | `MS_CLIENT_SECRET` | The secret value from step 3 |
   | `MS_ORGANIZER` | The Microsoft 365 user who hosts the calls, e.g. `aakash@yourcompany.com` |

If Teams can't be reached when someone books, the booking still goes through with
`MEETING_URL`, and the error appears in Vercel's function logs. Renew the client secret
before it expires.

### Email deliverability (GoDaddy: SPF, DKIM, DMARC)

The domain's email is hosted by GoDaddy, which manages these DNS records (GoDaddy → My
Products → DNS). As of 11 Nov 2026 they are in place:

| Type | Name | Value |
|---|---|---|
| MX | `@` | `smtp.secureserver.net` (0), `mailstore1.secureserver.net` (10) |
| TXT | `@` | `v=spf1 include:spf.em.secureserver.net include:secureserver.net ?all` |
| TXT | `_dmarc` | `v=DMARC1; p=quarantine; adkim=r; aspf=r; rua=mailto:dmarc_rua@onsecureserver.net;` |

Only one SPF record is allowed. If you ever switch email providers, update SMTP_HOST and
these records together, then test a login before redeploying.

### How booking works

- `/api/slots?duration=20|45` lists open times for a 20-minute intro or a 45-minute scoping
  call. The page shows them in the **visitor's own time zone**, with a switch to US Eastern,
  one week (five open days) at a time, plus a "Next available" shortcut.
- `/api/book` checks the time is still offered and reserves it. Times sit on a 30-minute grid
  (20 minutes + 10 buffer); a 45-minute call reserves two grid cells. Each cell is a Vercel
  Blob file and Blob refuses to overwrite, so two people can't take overlapping time. It
  emails you first, then sends the visitor a confirmation with a calendar invite, the video
  link and a **cancel / reschedule link**. If your email can't be delivered, the reservation is
  undone and the visitor is asked to try again.
- The form asks two optional prep questions (accounting software, number of entities); the
  answers appear in your booking email and the invite.
- The confirmation screen has **Add to calendar** buttons (Google, Outlook, Apple/.ics).
- **Cancel / reschedule**: the link opens `/cancel#<code>`. The code is signed with
  `BOOKING_SECRET`, so it can't be guessed or edited. Cancelling frees the slot, removes the
  Google Meet event and emails both of you a cancellation (it disappears from calendars).
  "Pick a new time" cancels first, then opens the booking calendar.
- **Reminders**: Vercel Cron calls `/api/remind` daily at 11:00 UTC (`vercel.json`). It emails
  a reminder for every call starting 12 to 36 hours later, which is the next day's calls,
  and deletes stored details of calls that are over.
- **What's stored**: the booked time (no personal data), plus the visitor's name, email and
  company **encrypted** with `BOOKING_SECRET` until the call is over (needed for the reminder
  and the cancel link). See `/privacy`.
- `/api/message` emails you the contact form with Reply-To set to the sender. It sends
  no auto-reply, so the form can't be abused to email strangers.
- Spam protection: hidden honeypot field, minimum fill time, same-origin check, per-IP
  rate limits, max two upcoming calls per email address, and input cleaning against
  email-header and calendar injection.

**Settings for these features** (Vercel → Settings → Environment Variables, Production):

| Variable | Notes |
|---|---|
| `BOOKING_SECRET` | Long random string (`openssl rand -hex 32`). Without it, bookings still work but emails have no cancel link and no reminders go out. Changing it invalidates existing cancel links. |
| `CRON_SECRET` | Long random string. Vercel sends it to `/api/remind`; without it reminders are off. |
| `BOOKING_DURATIONS` | Optional, default `20,45`. |
| `SITE_URL` | Optional, default `https://www.aakashremesh.com` (used in email links). |

## Local development

```sh
npm install
npm test                         # backend tests
npm run test:e2e                 # builds, then clicks through booking in Chrome (set CHROME_PATH if needed)
npm run build                    # bundle script + rebuild index.html
(cd public && python3 -m http.server 8000)   # static preview (booking shows its fallback)
npx vercel dev                   # full preview including /api (needs the Vercel CLI)
```

## Security

The site has no database, logins or cookies. What it does:

- **Content-Security-Policy** in every page and in `vercel.json`: only this domain's own
  scripts, styles, fonts, images and API calls are allowed; no inline scripts, no
  third-party code, no trackers.
- **Self-hosted fonts** (Inter, Fraunces, IBM Plex Mono; OFL licensed).
- **Clickjacking protection**: `frame-ancestors 'none'` / `X-Frame-Options: DENY`, plus a
  script check that blanks the page if framed.
- Email address assembled at runtime; no phone number anywhere; image metadata stripped.
- Functions validate and clean all input, reject cross-site posts and rate-limit by IP.
- Secrets (SMTP password, your inbox) live only in Vercel environment variables.

Things only you can do: enable two-factor authentication on GitHub, Vercel, your domain
registrar and your email; turn on registrar lock and DNSSEC; keep this repo private if you
prefer (Vercel works with private repos).

## Brand

The logo is the **Audit Seal**: "AR" with a double rule (a balanced total) inside a stamp
ringed by *AAKASH REMESH ✦ BOOKS IN BALANCE ✦*.

```
brand/seal/                 final logo set (pure-path SVG, no font dependency)
  seal.svg                  primary: ink disc, lavender type
  seal-lavender.svg         lavender disc, ink type (used in dark mode)
  seal-violet.svg           violet disc, white type
  seal-outline-ink.svg      one colour, for stamping on light documents
  seal-outline-white.svg    one colour, for dark backgrounds / photos
  seal-mini*.svg            simplified (no ring text) for 48px and below
  logo-horizontal*.svg      seal + name + "Accounting Systems Consultant"
  png/                      1024px PNG exports of everything above
brand/concepts/             the other directions that were explored
brand/tools/build_seal.py   regenerates brand/seal from the Manrope and IBM Plex Mono fonts
```

Colours (Navy & Brass, Nov 2026): navy `#14213d`, paper `#f7f5f0`, brass `#b8892f` (fills only),
brass text `#7d5c17` (small) / `#9c7222` (large headings), dark-mode brass `#d4a84f`. Dark mode follows the visitor's device.
Type: Source Serif 4 (headings), Inter (text), IBM Plex Mono (labels).
Layout: a fixed navy profile panel on wide screens (portrait, tagline, certifications, chapter navigation)
beside numbered chapters; on phones the panel becomes a header and a sticky "Book a Free Call" bar appears.
`npm run test:e2e` includes an axe-core WCAG 2.1 AA scan of every page in light and dark mode.

## Portrait

`assets/img/portrait.webp` (grey background, made by `brand/tools/grey_background.py`) plus
`assets/img/portrait-depth.png` (a depth map from `brand/tools/depth_map.py`). The page warps
the single image with WebGL so the head and eyes follow the cursor in any direction; without
WebGL, or with reduced motion, the plain image shows.
