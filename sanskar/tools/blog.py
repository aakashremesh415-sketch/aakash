"""Build the blog (/blog and /blog/<slug>) for sanskarmittal.com from src/posts.json.

Posts are Sanskar's own articles (the first one also appears under his byline on
the Renocrew blog). Pages reuse the site's head, header and footer, so they
get the Renocrew colours, Montserrat type and the light/dark toggle. Called from
tools/build.py.

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

BLOG_DESC = "Plain-English write-ups on bookkeeping, MIS reporting and financial planning by Sanskar Mittal."


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


def build(root, site, person_id, full_name, head, header, footer):
    posts = json.loads((root / "src" / "posts.json").read_text(encoding="utf-8"))
    posts = [p for _, p in sorted(enumerate(posts), key=lambda ip: (ip[1]["date"], ip[0]), reverse=True)]
    out = root / "blog"
    if out.exists():
        for f in out.glob("*.html"):
            f.unlink()
    out.mkdir(exist_ok=True)
    image = f"{site}/assets/img/og-card.jpg"
    author = {"@type": "Person", "@id": person_id, "name": full_name.removeprefix("CA "), "url": f"{site}/"}

    def shell(title, desc, path, jsonld, main):
        return head(title, desc, path, jsonld=jsonld) + f"""<body>
{header(home=False)}
  <main id="main" class="blog">
{main}
  </main>
{footer(home=False)}  <script src="/assets/app.js" defer></script>
</body>
</html>
"""

    for p in posts:
        path = f"/blog/{p['slug']}"
        url = f"{site}{path}"
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
            "image": image,
            "mainEntityOfPage": url,
            "isPartOf": {"@id": f"{site}/blog#blog"},
            "inLanguage": "en",
            "articleBody": "\n".join(plain(re.sub(r"^(## |- |\d+\. )", "", b)) for b in p["body"]),
        }
        crumbs = {
            "@type": "BreadcrumbList",
            "itemListElement": [
                {"@type": "ListItem", "position": 1, "name": "Home", "item": f"{site}/"},
                {"@type": "ListItem", "position": 2, "name": "Blog", "item": f"{site}/blog"},
                {"@type": "ListItem", "position": 3, "name": p["title"], "item": url},
            ],
        }
        main = f"""    <article class="blog__post">
      <nav class="blog__crumbs" aria-label="Breadcrumb"><a href="/blog">&larr; All posts</a></nav>
      <p class="eyebrow">Article · <time datetime="{p['date']}">{nice_date(p['date'])}</time></p>
      <h1>{html.escape(p['title'])}</h1>
      <p class="blog__lede">{html.escape(p['description'])}</p>
      <div class="blog__body">
        {render_body(p['body'])}
      </div>
      <aside class="blog__cta" aria-label="Book a call">
        <p>{html.escape(p['cta'])}</p>
        <a class="btn btn-brand" href="/#contact">Book a Free Call</a>
      </aside>
    </article>"""
        (out / f"{p['slug']}.html").write_text(
            shell(f"{p['seo_title']} — {full_name}", p["description"], path,
                  {"@context": "https://schema.org", "@graph": [posting, crumbs]}, main),
            encoding="utf-8",
        )

    cards = "\n".join(f"""        <li class="card bcard">
          <a href="/blog/{p['slug']}">
            <span class="bcard__kicker" aria-hidden="true">{html.escape(p['kicker'])}</span>
            <span class="bcard__meta"><time datetime="{p['date']}">{nice_date(p['date'])}</time></span>
            <span class="bcard__title">{html.escape(p['title'])}</span>
            <span class="bcard__desc">{html.escape(p['description'])}</span>
            <span class="bcard__more">Read the article <span aria-hidden="true">→</span></span>
          </a>
        </li>""" for p in posts)
    index_main = f"""    <div class="blog__index">
      <span class="eyebrow">Blog</span>
      <h1>Finance, Explained Plainly</h1>
      <p class="blog__lede">Short, practical write-ups on the numbers founders should be looking at, and how to get them every month without a scramble.</p>
      <ul class="bgrid">
{cards}
      </ul>
    </div>"""
    blog_ld = {
        "@context": "https://schema.org",
        "@graph": [
            {
                "@type": "Blog",
                "@id": f"{site}/blog#blog",
                "url": f"{site}/blog",
                "name": f"{full_name} — Blog",
                "description": BLOG_DESC,
                "author": author,
                "publisher": {"@id": person_id},
                "inLanguage": "en",
                "blogPost": [
                    {"@type": "BlogPosting", "@id": f"{site}/blog/{p['slug']}#article", "headline": p["title"],
                     "url": f"{site}/blog/{p['slug']}", "datePublished": p["date"], "image": image}
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
    (out / "index.html").write_text(shell(f"Blog — {full_name}", BLOG_DESC, "/blog", blog_ld, index_main), encoding="utf-8")

    latest = max(p.get("updated", p["date"]) for p in posts)
    sitemap = [(f"{site}/blog", latest)] + [(f"{site}/blog/{p['slug']}", p.get("updated", p["date"])) for p in posts]
    llms = "\n## Blog\n\nPlain-English finance write-ups by Sanskar:\n\n" + "".join(
        f"- [{p['title']}]({site}/blog/{p['slug']}): {p['description']}\n" for p in posts
    )
    print(f"blog built: {len(posts)} posts")
    return sitemap, llms
