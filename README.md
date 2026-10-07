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
