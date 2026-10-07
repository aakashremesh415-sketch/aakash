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
netlify/functions/      /api/slots, /api/book, /api/message
netlify/lib/            booking config, slot logic, calendar invites, SMTP mail, storage
tests/                  backend tests (npm test)
brand/                  logo set and concepts
_headers                security headers (Netlify / Cloudflare Pages)
netlify.toml            Netlify settings
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

1. Save it as WebP in `assets/img/certs/` (about 1000px wide; strip metadata).
2. In `src/index.html`, find that certificate's `<span class="cert__stack">` and add a new
   `<img …>` **as the first child**, with `data-caption` (shown in the viewer) and `alt`.
3. Update the `cert__meta` line if needed (e.g. "Intuit · Since 2025 · Renewed 2026"),
   then run the build.

### Regenerating the résumé PDF

`src/resume.html` is the source. Print it to A4 PDF (Chrome → Print → Save as PDF, margins
"Default"), or with Playwright `page.pdf({ format: "A4", preferCSSPageSize: true })`, and save
it as `assets/Aakash-Remesh-Resume.pdf`. It intentionally has no phone number or email.

## Hosting (Netlify)

The booking calendar and contact form need server-side code, so the site is set up for
**Netlify** (free tier is enough). GitHub Pages can still serve the static page, but booking
and messages won't work there: the page detects this and points visitors to LinkedIn.

1. Netlify → **Add new site → Import from Git** → pick this repo. No build command; the
   publish directory is the repo root (already in `netlify.toml`).
2. **Site configuration → Environment variables**, add:

   | Variable | Example | Notes |
   |---|---|---|
   | `SMTP_HOST` | `smtp.zoho.in` | Your mail provider's SMTP server |
   | `SMTP_PORT` | `587` | 587 (STARTTLS) or 465 (TLS) |
   | `SMTP_USER` | `hello@aakashremesh.com` | SMTP login |
   | `SMTP_PASS` | *app password* | Use an app-specific password, never your main one |
   | `MAIL_FROM` | `Aakash Remesh <hello@aakashremesh.com>` | Must be an address your SMTP account may send as |
   | `OWNER_EMAIL` | `you@example.com` | Where bookings and messages arrive. Never sent to browsers |
   | `MEETING_URL` | `https://meet.google.com/abc-defg-hij` | Fixed video link for every call (optional) |

   Optional booking settings (defaults in brackets):
   `BOOKING_TZ` [`Asia/Kolkata`], `BOOKING_WINDOWS` [`10:00-13:00,18:30-22:00`],
   `BOOKING_DAYS` [`1,2,3,4,5` = Mon–Fri], `BOOKING_DURATION_MIN` [`20`],
   `BOOKING_BUFFER_MIN` [`10`], `BOOKING_MIN_NOTICE_HOURS` [`12`], `BOOKING_HORIZON_DAYS` [`14`].
   The default windows overlap New Zealand/Europe mornings and US Eastern mornings.
3. **Domain management** → add `aakashremesh.com`, follow Netlify's DNS steps, and enable HTTPS.
4. Book a test call on the live site and check both emails arrive.

With Gmail, use `smtp.gmail.com`, port 465, and a Google **app password** (needs 2-Step
Verification). A mailbox on your own domain (Zoho Mail, Google Workspace) delivers more
reliably and looks more professional.

### How booking works

- `/api/slots` lists open 20-minute times; the page shows them in the visitor's time zone.
- `/api/book` checks the time is still offered, reserves it (Netlify Blobs, a write that
  only succeeds if the slot is free, so two people can't take the same time), emails you
  first, then sends the visitor a confirmation with a calendar invite. If your email can't
  be delivered, the reservation is undone and the visitor is asked to try again.
- `/api/message` emails you the contact form with Reply-To set to the sender. It sends
  no auto-reply, so the form can't be abused to email strangers.
- Spam protection: hidden honeypot field, minimum fill time, same-origin check, per-IP
  rate limits, max two upcoming calls per email address, and input cleaning against
  email-header and calendar injection.
- To cancel or move a call, reply to the booking email. Bookings are stored in the
  `bookings` Blobs store (Netlify → **Blobs**) if you need to free a slot manually.

## Local development

```sh
npm install
npm test                         # backend tests
python3 tools/build.py           # rebuild index.html
python3 -m http.server 8000      # static preview (booking shows its fallback)
npx netlify dev                  # full preview including /api (needs the Netlify CLI)
```

## Security

The site has no database, logins or cookies. What it does:

- **Content-Security-Policy** in every page and in `_headers`: only this domain's own
  scripts, styles, fonts, images and API calls are allowed; no inline scripts, no
  third-party code, no trackers.
- **Self-hosted fonts** (Inter, Fraunces, IBM Plex Mono; OFL licensed).
- **Clickjacking protection**: `frame-ancestors 'none'` / `X-Frame-Options: DENY`, plus a
  script check that blanks the page if framed.
- Email address assembled at runtime; no phone number anywhere; image metadata stripped.
- Functions validate and clean all input, reject cross-site posts and rate-limit by IP.
- Secrets (SMTP password, your inbox) live only in Netlify environment variables.

Things only you can do: enable two-factor authentication on GitHub, Netlify, your domain
registrar and your email; turn on registrar lock and DNSSEC; keep this repo private if you
prefer (Netlify works with private repos).

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
