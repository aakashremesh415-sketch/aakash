"""Build shreeyamundade.com from src/profile.json into public/.

Everything a visitor or a crawler sees comes from one place (src/profile.json):
the visible page, the schema.org JSON-LD (Person, ProfessionalService, FAQPage),
llms.txt for AI assistants, and the sitemap. Usage: python3 tools/build.py
"""
import html
import json
import shutil
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "src"
OUT = ROOT / "public"
SITE = "https://www.shreeyamundade.com"
PERSON_ID = f"{SITE}/#person"
TODAY = date.today().isoformat()
INDEXNOW_KEY = "bcb0939613a88a144bf5b5726871166f"

P = json.loads((SRC / "profile.json").read_text(encoding="utf-8"))
e = lambda s: html.escape(str(s))
FULL = f"{P['credential']} {P['name']}"
CSP = "default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self'; font-src 'self'; connect-src 'self'; manifest-src 'self'; base-uri 'none'; form-action 'self'; object-src 'none'; upgrade-insecure-requests"


def ext(href, label, cls="", me=False):
    rel = "noopener noreferrer me" if me else "noopener noreferrer"
    c = f' class="{cls}"' if cls else ""
    return f'<a href="{e(href)}"{c} target="_blank" rel="{rel}">{label} <span aria-hidden="true">↗</span><span class="sr-only"> (opens in a new tab)</span></a>'


def head(title, desc, path, *, robots="index, follow, max-image-preview:large", og=True, jsonld=None):
    url = f"{SITE}{path}"
    meta = f"""<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta http-equiv="Content-Security-Policy" content="{CSP}">
  <meta name="referrer" content="strict-origin-when-cross-origin">
  <title>{e(title)}</title>
  <meta name="description" content="{e(desc)}">
  <meta name="author" content="{e(P['name'])}">
  <meta name="robots" content="{robots}">
  <link rel="canonical" href="{url}">
  <link rel="icon" href="/favicon.ico" sizes="any">
  <link rel="icon" type="image/svg+xml" href="/assets/brand/sm.svg">
  <link rel="apple-touch-icon" href="/assets/apple-touch-icon.png">
  <meta name="theme-color" content="#ffffff">
  <script src="/assets/theme.js"></script>
  <link rel="preload" href="/assets/fonts/montserrat-latin.woff2" as="font" type="font/woff2" crossorigin>
  <link rel="stylesheet" href="/assets/styles.css">
"""
    if og:
        meta += f"""  <meta property="og:type" content="profile">
  <meta property="og:site_name" content="{e(FULL)}">
  <meta property="og:locale" content="en_US">
  <meta property="og:url" content="{url}">
  <meta property="og:title" content="{e(P['ogTitle'])}">
  <meta property="og:description" content="{e(P['ogDescription'])}">
  <meta property="og:image" content="{SITE}/assets/img/og-card.jpg">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta property="og:image:alt" content="{e(FULL)}, Chartered Accountant: illustrated portrait beside her name">
  <meta property="profile:first_name" content="{e(P['givenName'])}">
  <meta property="profile:last_name" content="{e(P['familyName'])}">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="{e(P['ogTitle'])}">
  <meta name="twitter:description" content="{e(P['ogDescription'])}">
  <meta name="twitter:image" content="{SITE}/assets/img/og-card.jpg">
  <link rel="alternate" type="text/markdown" href="/llms.txt" title="Summary for AI assistants">
"""
    if jsonld:
        meta += '  <script type="application/ld+json">\n' + json.dumps(jsonld, indent=2, ensure_ascii=False).replace("</", "<\\/") + "\n  </script>\n"
    return meta + "</head>\n"


LOGO = f'<a href="/" class="logo"><img src="/assets/brand/sm.svg" width="40" height="40" alt=""><span>{e(P["name"])}<small>Chartered Accountant</small></span></a>'

NAV = [("#services", "Services"), ("#feedback", "Reviews"), ("#experience", "Experience"), ("#faq", "FAQ")]


def header(home=True):
    pre = "" if home else "/"
    links = "\n".join(f'          <a href="{pre}{h}">{t}</a>' for h, t in NAV)
    return f"""  <a class="skip" href="#main">Skip to content</a>
  <div class="progress" aria-hidden="true"></div>
  <header class="site-header">
    <div class="container">
      {LOGO}
      <button class="menu-toggle" type="button" aria-label="Open menu" aria-expanded="false" aria-controls="site-nav"><span></span><span></span><span></span></button>
      <nav class="nav" id="site-nav" aria-label="Main">
{links}
          <button class="theme-toggle" type="button" aria-label="Switch to dark theme">☾</button>
          <a href="{pre}#contact" class="btn btn-brand">Book a Call</a>
      </nav>
    </div>
  </header>
"""


def footer(home=True):
    pre = "" if home else "/"
    return f"""  <footer class="site-footer">
    <div class="container">
      <div class="foot">
        <div>
          {LOGO}
          <p class="addr"><strong>{e(FULL)}</strong>Chartered Accountant · {e(P['renocrewRole'])}, Renocrew Solutions<br>{e(P['location']['label'])} · Working remotely with clients worldwide</p>
        </div>
        <div>
          <h3>On This Site</h3>
          <ul>
            <li><a href="{pre}#services">Services</a></li>
            <li><a href="{pre}#feedback">Reviews</a></li>
            <li><a href="{pre}#faq">FAQ</a></li>
            <li><a href="{pre}#contact">Book a Call</a></li>
            <li><a href="/privacy">Privacy</a></li>
          </ul>
        </div>
        <div>
          <h3>Elsewhere</h3>
          <ul>
            <li><a href="{e(P['linkedinUrl'])}" target="_blank" rel="noopener noreferrer me">LinkedIn<span class="sr-only"> (opens in a new tab)</span></a></li>
            <li><a href="{e(P['upworkUrl'])}" target="_blank" rel="noopener noreferrer me">Upwork<span class="sr-only"> (opens in a new tab)</span></a></li>
            <li><a href="{e(P['renocrewUrl'])}" target="_blank" rel="noopener noreferrer">Renocrew Solutions<span class="sr-only"> (opens in a new tab)</span></a></li>
          </ul>
        </div>
      </div>
      <div class="copy">© <span id="year">2026</span> {e(P['name'])}. All rights reserved.</div>
      <div class="bigword" aria-hidden="true">Shreeya</div>
    </div>
  </footer>
"""


def sec_head(eyebrow, heading, hid, intro=None):
    i = f"\n            <p>{e(intro)}</p>" if intro else ""
    return f"""          <div class="pf-head">
            <span class="eyebrow">{e(eyebrow)}</span>
            <h2 id="{hid}">{e(heading)}</h2>{i}
          </div>"""


# ---------------------------------------------------------------- structured data
person = {
    "@type": "Person",
    "@id": PERSON_ID,
    "name": P["name"],
    "givenName": P["givenName"],
    "familyName": P["familyName"],
    "honorificPrefix": P["credential"],
    "jobTitle": P["jobTitle"],
    "description": P["description"],
    "url": f"{SITE}/",
    "image": f"{SITE}/assets/img/shreeya-c.webp",
    "address": {"@type": "PostalAddress", "addressLocality": P["location"]["locality"], "addressRegion": P["location"]["region"], "addressCountry": P["location"]["country"]},
    "worksFor": {"@type": "Organization", "name": "Renocrew Solutions", "url": P["renocrewUrl"]},
    "hasOccupation": {"@type": "Occupation", "name": "Chartered Accountant", "occupationalCategory": "13-2011.00 Accountants and Auditors",
                      "skills": "Bookkeeping, month-end close, financial reporting, virtual CFO, budgeting and forecasting, eCommerce reconciliation, accounting software migration"},
    "alumniOf": [{"@type": "EducationalOrganization", "name": n} for n in P["alumniOf"]],
    "hasCredential": [
        {"@type": "EducationalOccupationalCredential", "name": c["name"], "credentialCategory": "certification",
         "recognizedBy": {"@type": "Organization", "name": c["issuer"]}, "dateCreated": c["date"]}
        for c in P["certifications"]
    ],
    "knowsAbout": P["knowsAbout"],
    "knowsLanguage": P["languages"],
    "makesOffer": [
        {"@type": "Offer", "itemOffered": {"@type": "Service", "name": s["title"], "description": s["body"], "provider": {"@id": PERSON_ID}}}
        for s in P["services"]
    ],
    "sameAs": [P["linkedinUrl"], P["upworkUrl"]],
}
graph = {
    "@context": "https://schema.org",
    "@graph": [
        {"@type": "WebSite", "@id": f"{SITE}/#website", "url": f"{SITE}/", "name": FULL, "inLanguage": "en", "publisher": {"@id": PERSON_ID}},
        {"@type": "ProfilePage", "@id": f"{SITE}/#webpage", "url": f"{SITE}/", "name": P["title"], "description": P["description"],
         "isPartOf": {"@id": f"{SITE}/#website"}, "about": {"@id": PERSON_ID}, "mainEntity": {"@id": PERSON_ID},
         "primaryImageOfPage": f"{SITE}/assets/img/og-card.jpg", "dateModified": P["updated"], "inLanguage": "en"},
        person,
        {"@type": "ProfessionalService", "@id": f"{SITE}/#business", "name": f"{FULL} — Bookkeeping & Virtual CFO", "url": f"{SITE}/",
         "description": "Remote bookkeeping, month-end close, cleanups and migrations, eCommerce and payment reconciliation, and virtual CFO support (budgets, cash flow forecasts, MIS and dashboards) for eCommerce brands and growing businesses.",
         "image": f"{SITE}/assets/img/og-card.jpg", "logo": f"{SITE}/assets/brand/sm.svg",
         "address": {"@type": "PostalAddress", "addressLocality": P["location"]["locality"], "addressRegion": P["location"]["region"], "addressCountry": P["location"]["country"]},
         "areaServed": {"@type": "Place", "name": "Worldwide"}, "founder": {"@id": PERSON_ID}, "employee": {"@id": PERSON_ID},
         "knowsLanguage": P["languages"], "serviceType": [s["title"] for s in P["services"]], "sameAs": [P["upworkUrl"]]},
        {"@type": "FAQPage", "@id": f"{SITE}/#faq", "isPartOf": {"@id": f"{SITE}/#webpage"},
         "mainEntity": [{"@type": "Question", "name": f["q"], "acceptedAnswer": {"@type": "Answer", "text": f["a"]}} for f in P["faqs"]]},
    ],
}

# ---------------------------------------------------------------- home page
stats = "\n".join(f'              <div><dt>{e(s["value"])}</dt><dd>{e(s["label"])}</dd></div>' for s in P["stats"])
portrait = "\n".join(
    f'            <img data-dir="{d}" src="/assets/img/shreeya-{d}.webp" width="960" height="960" '
    + ('alt="Illustrated portrait of Shreeya Mundade" fetchpriority="high" class="on"' if d == "c" else 'alt="" aria-hidden="true"')
    + ">"
    for d in "clrtb"
)
services = "\n".join(
    f"""            <li class="card pf-service">
              <span class="pf-num" aria-hidden="true">{i + 1:02d}</span>
              <h3>{e(s['title'])}</h3>
              <p>{e(s['body'])}</p>{f'{chr(10)}              <p class="pf-outcome">{e(s["outcome"])}</p>' if s.get('outcome') else ''}
            </li>"""
    for i, s in enumerate(P["services"])
)
groups = "\n".join(
    f"""            <div>
              <h3 class="pf-groupLabel">{e(g['label'])}</h3>
              <ul class="chips pf-chips">{''.join(f'<li><span>{e(t)}</span></li>' for t in g['items'])}</ul>
            </div>"""
    for g in P["platforms"]
)
fstats = "\n".join(f'            <div class="stat"><dt>{e(s["value"])}</dt><dd>{e(s["label"])}</dd></div>' for s in P["feedbackStats"])


def review(r):
    end = ""
    if r.get("endorsements"):
        end = '\n                <div class="pf-endorsed"><p>Endorsed by client</p><ul>' + "".join(f"<li>{e(x)}</li>" for x in r["endorsements"]) + "</ul></div>"
    return f"""              <li class="card pf-review">
                <p class="pf-rating"><span class="pf-stars" aria-hidden="true">{'★' * round(r['score'])}</span><span class="sr-only">Rated {r['score']:.1f} out of 5</span><strong aria-hidden="true">{r['score']:.1f}</strong><span class="pf-period">{e(r['period'])}</span></p>
                <h3 class="pf-reviewTitle">{e(r['title'])}</h3>
                <blockquote class="pf-reviewText"><p>&ldquo;{e(r['text'])}&rdquo;</p></blockquote>{end}
                <p class="pf-cite">Upwork client</p>
              </li>"""


reviews = "\n".join(review(r) for r in P["reviews"])
engagements = "\n".join(f'            <li><span class="pf-tag">{e(x["tag"])}</span>{e(x["text"])}</li>' for x in P["engagements"])
certs = "\n".join(f'              <li><strong>{e(c["name"])}</strong><span>{e(c["detail"])}</span></li>' for c in P["certifications"])
edu = "\n".join(f'              <li><strong>{e(c["name"])}</strong><span>{e(c["detail"])}</span></li>' for c in P["education"])
timeline = "\n".join(
    f"""            <li>
              <span class="pf-when">{e(t['when'])}</span>
              <h3>{e(t['role'])}</h3>
              <p class="pf-org">{e(t['org'])}</p>{f'{chr(10)}              <p>{e(t["body"])}</p>' if t.get('body') else ''}
            </li>"""
    for t in P["timeline"]
)
faqs = "\n".join(f"            <details><summary>{e(f['q'])}</summary><p>{e(f['a'])}</p></details>" for f in P["faqs"])
jump = "\n".join(f'        <a href="{h}">{t}</a>' for h, t in [("#about", "About"), ("#services", "Services"), ("#platforms", "Platforms"), ("#feedback", "Reviews"), ("#experience", "Experience"), ("#faq", "FAQ"), ("#contact", "Book a Call")])
contact_widget = (SRC / "contact.html").read_text(encoding="utf-8").rstrip()

page = head(P["title"], P["description"], "/", jsonld=graph) + f"""<body>
{header()}
  <main id="main">
    <section class="page-hero pf-hero" aria-labelledby="profile-h1">
      <div class="container pf-heroGrid">
        <div class="pf-heroCopy">
          <span class="pill">{e(P['jobTitle'])}</span>
          <h1 id="profile-h1" class="pf-h1"><span class="pf-hello">{e(P['hello'])}</span>{e(P['h1'])}</h1>
          <p class="pf-role"><strong>{e(FULL)}</strong> · {e(P['renocrewRole'])}, Renocrew Solutions</p>
          <p class="pf-lead">{e(P['lead'])}</p>
          <div class="pf-ctas">
            <a href="#contact" class="btn btn-brand">Book a Free Call</a>
            {ext(P['upworkUrl'], 'Upwork', 'btn btn-ghost', me=True)}
            {ext(P['linkedinUrl'], 'LinkedIn', 'btn btn-ghost', me=True)}
          </div>
          <dl class="pf-heroStats" data-count="{len(P['stats'])}">
{stats}
          </dl>
        </div>
        <div class="pf-heroArt">
          <div class="look">
{portrait}
          </div>
        </div>
      </div>
      <nav aria-label="On this page" class="container pf-jump">
{jump}
      </nav>
    </section>

    <section id="about" aria-labelledby="about-h">
      <div class="container pf-about">
{sec_head('About', P['about']['heading'], 'about-h')}
        <div class="pf-aboutBody">
          {''.join(f'<p>{e(t)}</p>' for t in P['about']['paragraphs'])}
          <p class="pf-note">{e(P['about']['note'])}</p>
        </div>
      </div>
    </section>

    <section id="services" class="alt" aria-labelledby="services-h">
      <div class="container">
{sec_head('What I Do', 'Where I Can Help', 'services-h')}
        <ol class="grid g3 pf-cards">
{services}
        </ol>
      </div>
    </section>

    <section id="platforms" aria-labelledby="platforms-h">
      <div class="container">
{sec_head('Platforms & Tools', 'The Stack I Work In', 'platforms-h')}
        <div class="pf-groups">
{groups}
        </div>
      </div>
    </section>

    <section id="feedback" class="alt" aria-labelledby="feedback-h">
      <div class="container">
{sec_head('Client Feedback', 'Trusted by Clients on Upwork', 'feedback-h')}
        <dl class="pf-feedStats">
{fstats}
        </dl>
        <div class="pf-reviews">
          <div class="pf-reviewsBar">
            <p class="pf-reviewsCount">{len(P['reviews'])} client reviews</p>
            <div class="pf-reviewsNav">
              <button type="button" class="pf-navBtn" data-review-prev aria-controls="review-track" aria-label="Previous review">←</button>
              <button type="button" class="pf-navBtn" data-review-next aria-controls="review-track" aria-label="Next review">→</button>
            </div>
          </div>
          <ul id="review-track" class="pf-reviewTrack" tabindex="0" aria-label="Client reviews for {e(P['givenName'])}">
{reviews}
          </ul>
        </div>
        <h3 class="pf-subhead">Recent Upwork Engagements</h3>
        <ul class="pf-engagements">
{engagements}
        </ul>
        <p class="pf-more">{ext(P['upworkUrl'], 'Read all reviews on Upwork')}</p>
      </div>
    </section>

    <section id="experience" aria-labelledby="experience-h">
      <div class="container pf-experience">
        <div>
{sec_head('Experience', '7+ Years on the Books.', 'experience-h')}
          <h3 class="pf-groupLabel">Certifications</h3>
          <ul class="pf-creds">
{certs}
          </ul>
          <h3 class="pf-groupLabel">Education</h3>
          <ul class="pf-creds">
{edu}
          </ul>
        </div>
        <ol class="pf-timeline">
{timeline}
        </ol>
      </div>
    </section>

    <section id="faq" class="alt" aria-labelledby="faq-h">
      <div class="container faq-wrap">
{sec_head('FAQ', 'Questions Clients Ask', 'faq-h')}
        <div class="faq">
{faqs}
        </div>
      </div>
    </section>

    <section id="contact" aria-labelledby="contact-h">
      <div class="container contact-wrap">
        <div>
          <span class="eyebrow">Contact</span>
          <h2 id="contact-h">{e(P['contact']['heading'])}</h2>
          <p class="contact-lead">{e(P['contact']['lead'])}</p>
          <div class="pf-ctas">
            {ext(P['linkedinUrl'], 'LinkedIn', 'btn btn-ghost', me=True)}
            {ext(P['upworkUrl'], 'Upwork', 'btn btn-ghost', me=True)}
          </div>
          <p class="pf-note">{e(P['location']['label'])} · Speaks {' · '.join(P['languages'])}</p>
        </div>
        <div class="bk">
{contact_widget}
        </div>
      </div>
    </section>
  </main>
{footer()}  <script src="/assets/app.js" defer></script>
</body>
</html>
"""
(ROOT / "index.html").write_text(page, encoding="utf-8")

# ---------------------------------------------------------------- small pages
(ROOT / "404.html").write_text(head(f"Page not found — {FULL}", "This page doesn't exist.", "/404", robots="noindex", og=False) + f"""<body>
  <main class="solo" id="main">
    <img class="solo__face" src="/assets/img/shreeya-c.webp" width="128" height="128" alt="">
    <p class="eyebrow">404</p>
    <h1>This page doesn't exist.</h1>
    <p class="lead">The link may be old or mistyped.</p>
    <p class="solo__actions"><a class="btn btn-brand" href="/">Go to the home page</a> <a class="btn btn-ghost" href="/#contact">Book a call</a></p>
  </main>
</body>
</html>
""", encoding="utf-8")

(ROOT / "cancel.html").write_text(head(f"Cancel or reschedule — {FULL}", "Cancel or reschedule your call.", "/cancel", robots="noindex", og=False).replace('content="strict-origin-when-cross-origin"', 'content="no-referrer"') + """<body>
  <main class="solo" id="main" data-manage>
    <img class="solo__face" src="/assets/img/shreeya-c.webp" width="128" height="128" alt="">
    <p class="eyebrow">Your call</p>
    <div data-state="loading"><h1>Finding your booking…</h1></div>

    <div data-state="found" hidden>
      <h1>Cancel or reschedule?</h1>
      <p class="lead" data-when></p>
      <div class="solo__actions">
        <button class="btn btn-brand" type="button" data-reschedule>Pick a new time</button>
        <button class="btn btn-ghost" type="button" data-cancel>Cancel the call</button>
      </div>
      <p class="solo__note">Picking a new time cancels this one first, then takes you to the calendar.</p>
      <p class="form-status" role="status" aria-live="polite" data-status></p>
    </div>

    <div data-state="done" hidden>
      <h1>Cancelled.</h1>
      <p class="lead">Your call is cancelled and you'll get an email to confirm. The time is free for someone else.</p>
      <p><a class="btn btn-brand" href="/#contact">Book another time</a></p>
    </div>

    <div data-state="error" hidden>
      <h1>This link doesn't work.</h1>
      <p class="lead" data-error></p>
      <p><a class="btn btn-brand" href="/#contact">Go to the booking page</a></p>
    </div>
  </main>
  <script src="/assets/cancel.js" defer></script>
</body>
</html>
""", encoding="utf-8")

privacy_body = (SRC / "privacy.html").read_text(encoding="utf-8").replace("{{EMAIL}}", P["email"])
(ROOT / "privacy.html").write_text(head(f"Privacy — {FULL}", "What shreeyamundade.com collects when you book a call or send a message, why, who handles it, how long it's kept and your rights.", "/privacy") + f"""<body>
{header(home=False)}
  <main class="legal" id="main">
{privacy_body}
  </main>
{footer(home=False)}  <script src="/assets/app.js" defer></script>
</body>
</html>
""", encoding="utf-8")

# ---------------------------------------------------------------- crawler files
(ROOT / "robots.txt").write_text(f"""# Search engines and AI assistants are welcome to read and cite this site.
# A summary written for AI assistants is at /llms.txt.
User-agent: *
Allow: /
Disallow: /api/
Disallow: /cancel

# AI search and assistant crawlers: explicitly allowed.
User-agent: GPTBot
User-agent: OAI-SearchBot
User-agent: ChatGPT-User
User-agent: ClaudeBot
User-agent: Claude-SearchBot
User-agent: Claude-User
User-agent: PerplexityBot
User-agent: Perplexity-User
User-agent: Google-Extended
User-agent: Applebot-Extended
User-agent: Bingbot
User-agent: DuckAssistBot
User-agent: CCBot
Allow: /
Disallow: /api/
Disallow: /cancel

Sitemap: {SITE}/sitemap.xml
""", encoding="utf-8")

sitemap = [(f"{SITE}/", TODAY), (f"{SITE}/privacy", P["updated"])]
(ROOT / "sitemap.xml").write_text(
    '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
    + "".join(f"  <url>\n    <loc>{u}</loc>\n    <lastmod>{d}</lastmod>\n  </url>\n" for u, d in sitemap)
    + "</urlset>\n",
    encoding="utf-8",
)

llms = f"""# {FULL}

> {P['name']} is a Chartered Accountant (ICAI) with 7+ years of experience in bookkeeping, month-end close, financial reporting and virtual CFO work for eCommerce, D2C, retail and service businesses. She is an {P['renocrewRole']} at Renocrew Solutions and works with clients on Upwork (Top Rated Plus, 100% Job Success). Based in {P['location']['label']}; works remotely with clients worldwide.

Website: {SITE}/
LinkedIn: {P['linkedinUrl']}
Upwork: {P['upworkUrl']}
Book a call: {SITE}/#contact

## Services

""" + "".join(f"- {s['title']}: {s['body']}\n" for s in P["services"]) + """
## Platforms and Tools

""" + "".join(f"- {g['label']}: {', '.join(g['items'])}.\n" for g in P["platforms"]) + """
## Track Record

""" + "".join(f"- {s['label']}: {s['value']}\n" for s in P["feedbackStats"]) + "".join(f"- {s['label']}: {s['value']}\n" for s in P["stats"]) + """
## Experience

""" + "".join(f"- {t['when']}: {t['role']}, {t['org']}.{(' ' + t['body']) if t.get('body') else ''}\n" for t in P["timeline"]) + """
## Certifications and Education

""" + "".join(f"- {c['name']} ({c['detail']})\n" for c in P["certifications"] + P["education"]) + f"""
Languages: {', '.join(P['languages'])}.

## Frequently Asked Questions
""" + "".join(f"\n### {f['q']}\n\n{f['a']}\n" for f in P["faqs"]) + f"\n---\nLast updated: {TODAY}\n"
(ROOT / "llms.txt").write_text(llms, encoding="utf-8")

# ---------------------------------------------------------------- deployable output
# Vercel serves only public/; functions in api/ deploy separately.
PUBLISH = [f"{INDEXNOW_KEY}.txt", "index.html", "404.html", "cancel.html", "privacy.html", "llms.txt", "robots.txt", "sitemap.xml", "favicon.ico", "assets"]
if OUT.exists():
    shutil.rmtree(OUT)
OUT.mkdir()
for name in PUBLISH:
    src = ROOT / name
    if src.is_dir():
        shutil.copytree(src, OUT / name)
    elif src.exists():
        shutil.copy2(src, OUT / name)
    else:
        raise SystemExit(f"missing site file: {name}")
print(f"index.html built: {len(page) // 1024} KB, {len(P['faqs'])} FAQs; public/ ready: {sum(1 for _ in OUT.rglob('*') if _.is_file())} files")
