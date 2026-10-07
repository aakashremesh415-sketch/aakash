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
tools/build.py          builds index.html from src/
assets/                 styles, script, fonts (self-hosted), images, résumé PDF
api/                    Vercel functions: /api/slots, /api/book, /api/message
api/_lib/               booking config, slot logic, calendar invites, SMTP mail, storage
tests/                  backend tests (npm test)
brand/                  logo set and concepts
vercel.json             Vercel settings: output directory, security headers
public/                 build output (generated, not committed)
```

## Editing

1. Edit files in `src/` (copy, sections, FAQ answers).
2. Run `python3 tools/build.py` to regenerate `index.html`.
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

### Regenerating the résumé PDF

`src/resume.html` is the source. Print it to A4 PDF (Chrome → Print → Save as PDF, margins
"Default"), or with Playwright `page.pdf({ format: "A4", preferCSSPageSize: true })`, and save
it as `assets/Aakash-Remesh-Resume.pdf`. It intentionally has no phone number or email.

## Hosting (Vercel)

The site and the booking/contact functions deploy together on **Vercel**. The build
(`python3 tools/build.py`) regenerates `index.html` and copies only the public site
into `public/`, which Vercel serves; `src/`, `tools/`, `tests/` and `brand/` are never deployed.

1. Vercel → **Add New → Project** → import this repo. Framework preset **Other**. Build
   command and output directory come from `vercel.json`, so leave them as they are.
2. **Storage → Create → Blob**, choose **Private**, and connect it to this project. This adds
   `BLOB_READ_WRITE_TOKEN` automatically. Bookings are stored there as time-slot markers
   only; names and emails are never stored, they only travel in the emails.
3. **Settings → Environment Variables**, add (for Production and Preview):

   | Variable | Example | Notes |
   |---|---|---|
   | `SMTP_HOST` | `smtp.titan.email` | Titan Email (GoDaddy) outgoing server |
   | `SMTP_PORT` | `465` | 465 (SSL/TLS) for Titan; 587 (STARTTLS) also works |
   | `SMTP_USER` | `hello@aakashremesh.com` | Your full Titan email address |
   | `SMTP_PASS` | *mailbox password* | The Titan mailbox password; store it only in Vercel |
   | `MAIL_FROM` | `Aakash Remesh <hello@aakashremesh.com>` | Must be the same Titan address as `SMTP_USER` |
   | `OWNER_EMAIL` | `you@example.com` | Where bookings and messages arrive. Never sent to browsers |
   | `MEETING_URL` | `https://meet.google.com/abc-defg-hij` | Fixed video link for every call (optional) |

   Optional booking settings (defaults in brackets):
   `BOOKING_TZ` [`Asia/Kolkata`], `BOOKING_WINDOWS` [`10:00-13:00,18:30-22:00`],
   `BOOKING_DAYS` [`1,2,3,4,5` = Mon–Fri], `BOOKING_LEAD_DAYS` [`2` = earliest call is two
   days after booking], `BOOKING_DURATION_MIN` [`20`], `BOOKING_BUFFER_MIN` [`10`],
   `BOOKING_HORIZON_DAYS` [`21`]. Visitors only see slots between 7 AM and 9 PM in their own
   time zone, and never on their own Saturday or Sunday.
4. Redeploy (environment variables apply to new deployments).
5. **Settings → Domains** → add `aakashremesh.com` and `www.aakashremesh.com`, then set the
   DNS records Vercel shows at your registrar.
6. Book a test call on the live site and check both emails arrive.

With Gmail, use `smtp.gmail.com`, port 465, and a Google **app password** (needs 2-Step
Verification). A mailbox on your own domain (Zoho Mail, Google Workspace) delivers more
reliably and looks more professional.

### How booking works

- `/api/slots` lists open 20-minute times; the page shows them in the visitor's time zone,
  with weekends marked Closed and the next two days marked Not Available.
- `/api/book` checks the time is still offered, reserves it (a Vercel Blob file per slot;
  Blob refuses to overwrite, so two people can't take the same time), emails you first, then
  sends the visitor a confirmation with a calendar invite. If your email can't be delivered,
  the reservation is undone and the visitor is asked to try again.
- `/api/message` emails you the contact form with Reply-To set to the sender. It sends
  no auto-reply, so the form can't be abused to email strangers.
- Spam protection: hidden honeypot field, minimum fill time, same-origin check, per-IP
  rate limits, max two upcoming calls per email address, and input cleaning against
  email-header and calendar injection.
- To cancel or move a call, reply to the booking email, then delete the slot's file
  (`bookings/slots/<time>.json`) in Vercel → Storage → your Blob store to free the time.

## Local development

```sh
npm install
npm test                         # backend tests
python3 tools/build.py           # rebuild index.html
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

Colours: ink `#15121f`, lavender `#d9ccff`, violet `#5b3df5`, soft violet `#a48cff`.
Type: Fraunces (headings), Inter (text), IBM Plex Mono (labels).
