"""Home page in the aakashremesh.com layout: a fixed profile panel on the left with
numbered navigation, a cover, then numbered chapters. Renocrew colours and type."""

CHAPTERS = [
    ("about", "About"),
    ("services", "What I do"),
    ("feedback", "Track record"),
    ("experience", "Experience"),
    ("platforms", "Platforms"),
    ("faq", "FAQ"),
    ("contact", "Book a call"),
]


def build_home(P, e, ext, head, graph, parts):
    FULL = f"{P['credential']} {P['name']}"
    num = {cid: f"{i + 1:02d}" for i, (cid, _) in enumerate(CHAPTERS)}
    nav = "\n".join(f'          <li><a href="#{cid}"><span>{num[cid]}</span>{label}</a></li>' for cid, label in CHAPTERS)
    certs = "\n".join(
        f'        <li><a href="#experience">{e(n)}{f" <span>{e(s)}</span>" if s else ""}</a></li>'
        for n, s in [("Chartered Accountant", "ICAI"), ("QuickBooks", "ProAdvisor"), ("Xero", "Certified"), ("Upwork", "Top Rated Plus")]
    )
    upwork_list = "\n".join(
        f'            <li><b>{e(s["value"])}</b><span>{e(s["label"])}</span></li>' for s in P["feedbackStats"]
    )

    def chap(cid, eyebrow, heading, body, tint=False, extra_cls=""):
        cls = " ".join(x for x in ["chapter", "alt" if tint else "", extra_cls] if x)
        return f"""    <section id="{cid}" class="{cls}" aria-labelledby="{cid}-h">
      <div class="wrap chap">
        <span class="chap__num" aria-hidden="true">{num[cid]}</span>
        <div class="chap__body">
          <span class="eyebrow">{e(eyebrow)}</span>
          <h2 id="{cid}-h">{e(heading)}</h2>
{body}
        </div>
      </div>
    </section>
"""

    about = f"""          <div class="pf-aboutBody chap__lead">
            {''.join(f'<p>{e(t)}</p>' for t in P['about']['paragraphs'])}
            <p class="pf-note">{e(P['about']['note'])}</p>
          </div>"""
    services = f"""          <ol class="grid g3 pf-cards chap__gap">
{parts['services']}
          </ol>"""
    feedback = f"""          <dl class="pf-feedStats chap__gap">
{parts['fstats']}
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
{parts['reviews']}
            </ul>
          </div>
          <h3 class="pf-subhead">Recent Upwork Engagements</h3>
          <ul class="pf-engagements">
{parts['engagements']}
          </ul>
          <p class="pf-more">{ext(P['upworkUrl'], 'Read all reviews on Upwork')}</p>"""
    experience = f"""          <div class="pf-experience chap__gap">
            <div>
              <h3 class="pf-groupLabel">Certifications</h3>
              <ul class="pf-creds">
{parts['certs']}
              </ul>
              <h3 class="pf-groupLabel">Education</h3>
              <ul class="pf-creds">
{parts['edu']}
              </ul>
            </div>
            <ol class="pf-timeline">
{parts['timeline']}
            </ol>
          </div>"""
    platforms = f"""          <div class="pf-groups">
{parts['groups']}
          </div>"""
    faq = f"""          <div class="faq chap__gap">
{parts['faqs']}
          </div>"""
    contact = f"""          <div class="contact-wrap chap__gap">
            <div>
              <p class="contact-lead">{e(P['contact']['lead'])}</p>
              <ul class="checks">
                <li>Free video call, 20 or 45 minutes</li>
                <li>Pick a time in your own time zone</li>
                <li>Calendar invite and video link by email</li>
              </ul>
              <div class="pf-ctas">
                {ext(P['linkedinUrl'], 'LinkedIn', 'btn btn-ghost', me=True)}
                {ext(P['upworkUrl'], 'Upwork', 'btn btn-ghost', me=True)}
              </div>
              <p class="pf-note">{e(P['location']['label'])} · Speaks {' · '.join(P['languages'])}</p>
            </div>
            <div class="bk">
{parts['contact_widget']}
            </div>
          </div>"""

    return head(P["title"], P["description"], "/", jsonld=graph) + f"""<body class="home">
  <a class="skip" href="#main">Skip to content</a>
  <div class="progress" aria-hidden="true"></div>
<div class="shell">
  <aside class="side" aria-label="About {e(P['name'])}">
    <div class="side__in">
      <div class="side__top">
        <a class="side__mono" href="/" aria-label="Home"><img src="/assets/brand/sm.svg" width="36" height="36" alt=""></a>
        <button class="theme-toggle" type="button" aria-label="Switch to dark theme">☾</button>
      </div>
      <div class="side__portrait">
        <div class="look">
{parts['portrait']}
        </div>
      </div>
      <div class="side__id">
        <p class="side__name"><a href="/">{e(FULL)}</a></p>
        <p class="side__role">Chartered Accountant · Bookkeeping &amp; Virtual CFO</p>
        <p class="side__tagline">Messy books. <span>Numbers you can trust.</span></p>
      </div>
      <div class="side__cta">
        <a class="btn btn-brand" href="#contact">Book a Free Call</a>
        {ext(P['upworkUrl'], 'Upwork', 'btn btn-ghost', me=True)}
      </div>
      <ul class="side__certs" aria-label="Credentials">
{certs}
      </ul>
      <nav class="side__nav" aria-label="Sections">
        <ol>
{nav}
        </ol>
      </nav>
      <p class="side__meta">{e(P['renocrewRole'])}, Renocrew Solutions · {e(P['location']['label'])}, working remotely with clients worldwide.</p>
    </div>
  </aside>

  <main id="main">
    <section class="cover" aria-labelledby="cover-h">
      <div class="wrap cover__inner">
        <div class="cover__copy">
          <span class="pill">{e(P['jobTitle'])}</span>
          <h1 id="cover-h"><span class="pf-hello">{e(P['hello'])}</span>I Turn Messy Books Into <span class="accent">Numbers You Can Trust.</span></h1>
          <p class="pf-lead">{e(P['lead'])}</p>
          <div class="pf-ctas">
            <a href="#contact" class="btn btn-brand">Book a Free Call</a>
            <a href="#feedback" class="btn btn-ghost">See My Track Record</a>
          </div>
          <dl class="cover__stats">
{parts['stats']}
          </dl>
        </div>
        <aside class="deliver" aria-labelledby="deliver-h">
          <p class="deliver__label" id="deliver-h">On Upwork</p>
          <ul class="deliver__list">
{upwork_list}
          </ul>
          <p class="deliver__foot">{ext(P['upworkUrl'], 'Read the reviews')}</p>
        </aside>
      </div>
    </section>

{chap('about', 'About', P['about']['heading'], about, tint=True)}
{chap('services', 'What I Do', 'Where I Can Help', services)}
{chap('feedback', 'Client Feedback', 'Trusted by Clients on Upwork', feedback, tint=True)}
{chap('experience', 'Experience', '7+ Years on the Books.', experience)}
{chap('platforms', 'Platforms & Tools', 'The Stack I Work In', platforms, tint=True)}
{chap('faq', 'FAQ', 'Questions Clients Ask', faq)}
{chap('contact', 'Contact', P['contact']['heading'], contact, tint=True, extra_cls='contact')}
    <footer class="foot-simple">
      <div class="wrap foot-simple__in">
        <span>© <span id="year">2026</span> {e(P['name'])} · Chartered Accountant</span>
        <span class="foot-simple__links">
          <a href="{e(P['linkedinUrl'])}" target="_blank" rel="noopener noreferrer me">LinkedIn<span class="sr-only"> (opens in a new tab)</span></a>
          <a href="{e(P['upworkUrl'])}" target="_blank" rel="noopener noreferrer me">Upwork<span class="sr-only"> (opens in a new tab)</span></a>
          <a href="/privacy">Privacy</a>
          <a href="#main">Back to Top</a>
        </span>
      </div>
    </footer>
  </main>
</div>

  <div class="mbar" data-mbar><a class="btn btn-brand" href="#contact">Book a Free Call</a></div>
  <script src="/assets/app.js" defer></script>
</body>
</html>
"""
