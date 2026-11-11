"""Build the blog (/blog and /blog/<slug>) from src/posts.json.

Each post is a LinkedIn post or video, republished here as an article with the
video (self-hosted in assets/blog/), its transcript and BlogPosting/VideoObject
structured data. Called from tools/build.py.

Body format in posts.json (one string per block):
  "## Heading"        -> <h2>
  "- item"            -> bulleted list item (consecutive items are grouped)
  "1. item"           -> numbered list item (consecutive items are grouped)
  anything else       -> paragraph
Inline: **bold** and [text](/url).
"""
import html
import json
import re
from pathlib import Path

CSP = "default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self'; media-src 'self'; font-src 'self'; connect-src 'self'; manifest-src 'self'; base-uri 'none'; form-action 'self'; object-src 'none'; upgrade-insecure-requests"
BLOG_TITLE = "Blog — Aakash Remesh"
BLOG_DESC = "Short, plain-English explainers on bookkeeping and accounting systems: deferred revenue, cash vs accrual, prepaid expenses, month-end close, multi-entity books and system migrations."


def inline(text):
    t = html.escape(text, quote=False)
    t = re.sub(r"\*\*(.+?)\*\*", r"<strong>\1</strong>", t)
    t = re.sub(r"\[([^\]]+)\]\(([^)\s]+)\)", lambda m: f'<a href="{html.escape(m[2])}">{m[1]}</a>', t)
    return t


def plain(text):
    return re.sub(r"\[([^\]]+)\]\([^)]+\)", r"\1", text.replace("**", ""))


def render_body(blocks):
    out, lst = [], None
    for b in blocks:
        kind = "ul" if b.startswith("- ") else "ol" if re.match(r"\d+\. ", b) else None
        if lst and kind != lst:
            out.append(f"</{lst}>")
            lst = None
        if kind:
            if not lst:
                out.append(f"<{kind}>")
                lst = kind
            out.append(f"<li>{inline(b.split(' ', 1)[1])}</li>")
        elif b.startswith("## "):
            out.append(f"<h2>{inline(b[3:])}</h2>")
        else:
            out.append(f"<p>{inline(b)}</p>")
    if lst:
        out.append(f"</{lst}>")
    return "\n        ".join(out)


def nice_date(iso):
    y, m, d = iso.split("-")
    months = "January February March April May June July August September October November December".split()
    return f"{int(d)} {months[int(m) - 1]} {y}"


def page(*, title, desc, canonical, og_type, image, image_alt, jsonld, main):
    e = lambda s: html.escape(s)
    return f"""<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta http-equiv="Content-Security-Policy" content="{CSP}">
  <meta name="referrer" content="strict-origin-when-cross-origin">
  <title>{e(title)}</title>
  <meta name="description" content="{e(desc)}">
  <meta name="author" content="Aakash Remesh">
  <meta name="robots" content="index, follow, max-image-preview:large, max-video-preview:-1">
  <link rel="canonical" href="{canonical}">
  <meta property="og:type" content="{og_type}">
  <meta property="og:site_name" content="Aakash Remesh">
  <meta property="og:locale" content="en_US">
  <meta property="og:url" content="{canonical}">
  <meta property="og:title" content="{e(title)}">
  <meta property="og:description" content="{e(desc)}">
  <meta property="og:image" content="{image}">
  <meta property="og:image:alt" content="{e(image_alt)}">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="{e(title)}">
  <meta name="twitter:description" content="{e(desc)}">
  <meta name="twitter:image" content="{image}">
  <link rel="icon" href="/favicon.ico" sizes="any">
  <link rel="icon" type="image/svg+xml" href="/assets/favicon.svg">
  <link rel="apple-touch-icon" href="/assets/apple-touch-icon.png">
  <meta name="theme-color" content="#f7f5f0" media="(prefers-color-scheme: light)">
  <meta name="theme-color" content="#0b1222" media="(prefers-color-scheme: dark)">
  <link rel="preload" href="/assets/fonts/inter-var.woff2" as="font" type="font/woff2" crossorigin>
  <link rel="preload" href="/assets/fonts/source-serif-4-var.woff2" as="font" type="font/woff2" crossorigin>
  <link rel="stylesheet" href="/assets/styles.css">
  <script type="application/ld+json">
{json.dumps(jsonld, indent=2, ensure_ascii=False).replace("</", "<\\/")}
  </script>
</head>
<body>
  <a class="skip" href="#main">Skip to content</a>
  <header class="bhead">
    <div class="bhead__in">
      <a class="bhead__brand" href="/"><img src="/assets/favicon.svg" width="32" height="32" alt="">Aakash Remesh</a>
      <nav aria-label="Site">
        <a href="/blog">Blog</a>
        <a class="btn btn--small" href="/#contact">Book a Free Call</a>
      </nav>
    </div>
  </header>
  <main id="main" class="blog">
{main}
  </main>
  <footer class="footer">
    <div class="blog__foot footer__inner">
      <span>&copy; 2026 Aakash Remesh · Books in Balance</span>
      <span class="footer__links">
        <a href="/">Home</a>
        <a href="/blog">Blog</a>
        <a href="https://www.linkedin.com/in/aakashremesh/" target="_blank" rel="noopener noreferrer me">LinkedIn<span class="sr-only"> (opens in a new tab)</span></a>
        <a href="/privacy">Privacy</a>
      </span>
    </div>
  </footer>
</body>
</html>
"""


def build(root, site, person_id, today):
    posts = json.loads((root / "src" / "posts.json").read_text(encoding="utf-8"))
    # Newest first; posts sharing a date keep the order they were posted (later in the file = newer).
    posts = [p for _, p in sorted(enumerate(posts), key=lambda ip: (ip[1]["date"], ip[0]), reverse=True)]
    out = root / "blog"
    if out.exists():
        for f in out.glob("*.html"):
            f.unlink()
    out.mkdir(exist_ok=True)
    author = {"@type": "Person", "@id": person_id, "name": "Aakash Remesh", "url": f"{site}/"}

    def img_of(p):
        return f"{site}/assets/blog/{p['video']}.jpg" if p.get("video") else f"{site}/assets/blog/{p['image']}"

    for p in posts:
        url = f"{site}/blog/{p['slug']}"
        posting = {
            "@type": "BlogPosting",
            "@id": f"{url}#article",
            "headline": p["title"],
            "alternativeHeadline": p["seo_title"],
            "description": p["description"],
            "datePublished": p["date"],
            "dateModified": p.get("updated", p["date"]),
            "author": author,
            "publisher": {"@id": person_id},
            "image": img_of(p),
            "mainEntityOfPage": url,
            "isPartOf": {"@id": f"{site}/blog#blog"},
            "inLanguage": "en",
            "articleBody": "\n".join(plain(re.sub(r"^(## |- |\d+\. )", "", b)) for b in p["body"]),
        }
        if p.get("video"):
            posting["video"] = {
                "@type": "VideoObject",
                "name": p["title"],
                "description": p["description"],
                "thumbnailUrl": img_of(p),
                "uploadDate": f"{p['date']}T12:00:00+05:30",
                "duration": p["duration"],
                "contentUrl": f"{site}/assets/blog/{p['video']}.mp4",
                "transcript": " ".join(p["transcript"]),
                "inLanguage": "en",
            }
        crumbs = {
            "@type": "BreadcrumbList",
            "itemListElement": [
                {"@type": "ListItem", "position": 1, "name": "Home", "item": f"{site}/"},
                {"@type": "ListItem", "position": 2, "name": "Blog", "item": f"{site}/blog"},
                {"@type": "ListItem", "position": 3, "name": p["title"], "item": url},
            ],
        }
        if p.get("video"):
            v = p["video"]
            media = f"""      <figure class="blog__media">
        <video controls playsinline preload="none" width="1080" height="1080" poster="/assets/blog/{v}.jpg" aria-label="Video: {html.escape(p['title'])} (captions are part of the video)">
          <source src="/assets/blog/{v}.mp4" type="video/mp4">
          <a href="/assets/blog/{v}.mp4">Download the video</a>
        </video>
        <figcaption>Captions are built into the video. The full transcript is below.</figcaption>
      </figure>"""
            transcript = "\n".join(f"          <p>{html.escape(t)}</p>" for t in p["transcript"])
            transcript = f"""
      <details class="blog__transcript">
        <summary>Video transcript</summary>
        <div>
{transcript}
        </div>
      </details>"""
        else:
            w, h = p["image_size"]
            media = f"""      <figure class="blog__media blog__media--image">
        <img src="/assets/blog/{p['image']}" width="{w}" height="{h}" alt="{html.escape(p['image_alt'])}">
      </figure>"""
            transcript = ""
        main = f"""    <article class="blog__post">
      <nav class="blog__crumbs" aria-label="Breadcrumb"><a href="/blog">&larr; All posts</a></nav>
      <p class="eyebrow">{'Video' if p.get('video') else 'Post'} · <time datetime="{p['date']}">{nice_date(p['date'])}</time></p>
      <h1>{html.escape(p['title'])}</h1>
{media}
      <div class="blog__body">
        {render_body(p['body'])}
      </div>{transcript}
      <aside class="blog__cta" aria-label="Book a call">
        <p>{html.escape(p['cta'])}</p>
        <a class="btn" href="/#contact">Book a Free Call</a>
      </aside>
    </article>"""
        (out / f"{p['slug']}.html").write_text(
            page(
                title=f"{p['seo_title']} — Aakash Remesh",
                desc=p["description"],
                canonical=url,
                og_type="article",
                image=img_of(p),
                image_alt=p.get("image_alt", p["title"]),
                jsonld={"@context": "https://schema.org", "@graph": [posting, crumbs]},
                main=main,
            ),
            encoding="utf-8",
        )

    cards = []
    for p in posts:
        thumb = f"/assets/blog/{p['video']}.jpg" if p.get("video") else f"/assets/blog/{p['image']}"
        cards.append(f"""        <li class="bcard">
          <a href="/blog/{p['slug']}">
            <img src="{thumb}" width="1080" height="1080" loading="lazy" alt="">
            <span class="bcard__meta mono">{'Video' if p.get('video') else 'Post'} · <time datetime="{p['date']}">{nice_date(p['date'])}</time></span>
            <span class="bcard__title">{html.escape(p['title'])}</span>
            <span class="bcard__desc">{html.escape(p['description'])}</span>
          </a>
        </li>""")
    index_main = f"""    <div class="blog__index">
      <p class="eyebrow">Blog</p>
      <h1>Accounting, explained plainly</h1>
      <p class="lead">Short explainers from my LinkedIn: one example, one number, no jargon. Most are short videos, written up here with a transcript.</p>
      <ul class="bgrid">
{chr(10).join(cards)}
      </ul>
    </div>"""
    blog_ld = {
        "@context": "https://schema.org",
        "@graph": [
            {
                "@type": "Blog",
                "@id": f"{site}/blog#blog",
                "url": f"{site}/blog",
                "name": "Aakash Remesh — Blog",
                "description": BLOG_DESC,
                "author": author,
                "publisher": {"@id": person_id},
                "inLanguage": "en",
                "blogPost": [
                    {"@type": "BlogPosting", "@id": f"{site}/blog/{p['slug']}#article", "headline": p["title"],
                     "url": f"{site}/blog/{p['slug']}", "datePublished": p["date"], "image": img_of(p)}
                    for p in posts
                ],
            },
            {
                "@type": "BreadcrumbList",
                "itemListElement": [
                    {"@type": "ListItem", "position": 1, "name": "Home", "item": f"{site}/"},
                    {"@type": "ListItem", "position": 2, "name": "Blog", "item": f"{site}/blog"},
                ],
            },
        ],
    }
    (out / "index.html").write_text(
        page(title=BLOG_TITLE, desc=BLOG_DESC, canonical=f"{site}/blog", og_type="website",
             image=img_of(posts[0]), image_alt=posts[0].get("image_alt", posts[0]["title"]),
             jsonld=blog_ld, main=index_main),
        encoding="utf-8",
    )

    # For sitemap.xml and llms.txt.
    latest = max(p.get("updated", p["date"]) for p in posts)
    sitemap = [(f"{site}/blog", latest)] + [(f"{site}/blog/{p['slug']}", p.get("updated", p["date"])) for p in posts]
    llms = "\n## Blog\n\nPlain-English accounting explainers by Aakash (most are short videos with a written version and transcript):\n\n" + "".join(
        f"- [{p['title']}]({site}/blog/{p['slug']}): {p['description']}\n" for p in posts
    )
    print(f"blog built: {len(posts)} posts")
    return sitemap, llms
