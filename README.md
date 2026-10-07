# aakashremesh.com

Personal website of Aakash Remesh — a single static page (HTML/CSS/JS, no build step).

```
index.html          the page
404.html            not-found page
assets/styles.css   styles (light + dark mode)
assets/script.js    portrait that looks toward the cursor, scroll reveals
assets/img/         portraits (center/up/down/left/right) and social preview image
CNAME               custom domain for GitHub Pages
```

## Preview locally

```sh
python3 -m http.server 8000
# open http://localhost:8000
```

## Deploy (GitHub Pages)

1. Repo **Settings → Pages** → Source: *Deploy from a branch*, branch `main`, folder `/ (root)`.
2. Custom domain: `aakashremesh.com` (already set via `CNAME`), then tick **Enforce HTTPS** once the certificate is issued.
3. At your DNS provider:
   - `A` records for `aakashremesh.com` → `185.199.108.153`, `185.199.109.153`, `185.199.110.153`, `185.199.111.153`
   - `CNAME` for `www` → `aakashremesh415-sketch.github.io`

Netlify or Vercel work too — point them at the repo root with no build command.

## Editing

All copy lives in `index.html`. To swap a portrait, replace the matching file in
`assets/img/` (square, ~720px, WebP).

## Brand

The logo is the **Audit Seal**: "AR" with a double-rule (balanced total) inside a stamp
ringed by *AAKASH REMESH ✦ BOOKS IN BALANCE ✦*.

```
brand/seal/                 final logo set (pure-path SVG, no font dependency)
  seal.svg                  primary — ink disc, lavender type
  seal-lavender.svg         lavender disc, ink type
  seal-violet.svg           violet disc, white type
  seal-outline-ink.svg      one-colour, for stamping on light documents
  seal-outline-white.svg    one-colour, for dark backgrounds / photos
  seal-mini*.svg            simplified (no ring text) for 48px and below
  logo-horizontal*.svg      seal + name + "Accounting Systems Consultant"
  png/                      1024px PNG exports of everything above
brand/concepts/             the other directions that were explored
brand/tools/build_seal.py   regenerates brand/seal from the Manrope and IBM Plex Mono fonts
```

Use the full seal at 64px and above, and `seal-mini` below that (favicons, avatars).
Colours: ink `#15121f`, lavender `#d9ccff`, violet `#5b3df5`, soft violet `#a48cff`.
