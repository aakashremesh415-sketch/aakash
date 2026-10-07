"""Generate the Audit Seal logo set as pure-path SVGs (no font dependency).

Usage: python3 build_seal.py <Manrope[wght].ttf> <IBMPlexMono-Medium.ttf> <out_dir>
Fonts: https://github.com/google/fonts (ofl/manrope, ofl/ibmplexmono)
"""
import math, sys, os
from fontTools.ttLib import TTFont
from fontTools.varLib import instancer
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen

manrope_path, plex_path, out = sys.argv[1:4]
os.makedirs(out, exist_ok=True)

manrope = instancer.instantiateVariableFont(TTFont(manrope_path), {"wght": 800})
manrope500 = instancer.instantiateVariableFont(TTFont(manrope_path), {"wght": 500})
plex = TTFont(plex_path)

INK, LAV, VIO, VIO2, WHITE = "#15121f", "#d9ccff", "#5b3df5", "#a48cff", "#ffffff"


def glyph_path(font, ch, x, y, size):
    """Path data for one character with its baseline-left at (x, y)."""
    gs = font.getGlyphSet()
    name = font.getBestCmap()[ord(ch)]
    upm = font["head"].unitsPerEm
    s = size / upm
    pen = SVGPathPen(gs)
    gs[name].draw(TransformPen(pen, (s, 0, 0, -s, x, y)))
    return pen.getCommands(), gs[name].width * s


def text_path(font, text, x, y, size, tracking=0.0, anchor="start"):
    widths = []
    for ch in text:
        _, w = glyph_path(font, ch, 0, 0, size)
        widths.append(w)
    total = sum(widths) + tracking * (len(text) - 1)
    if anchor == "middle":
        x -= total / 2
    d = []
    for ch, w in zip(text, widths):
        if ch != " ":
            d.append(glyph_path(font, ch, x, y, size)[0])
        x += w + tracking
    return " ".join(d), total


def star(cx, cy, r):
    """Four-point sparkle (✦)."""
    k = r * 0.28
    return (f"M{cx:.2f} {cy - r:.2f} Q{cx + k:.2f} {cy - k:.2f} {cx + r:.2f} {cy:.2f} "
            f"Q{cx + k:.2f} {cy + k:.2f} {cx:.2f} {cy + r:.2f} "
            f"Q{cx - k:.2f} {cy + k:.2f} {cx - r:.2f} {cy:.2f} "
            f"Q{cx - k:.2f} {cy - k:.2f} {cx:.2f} {cy - r:.2f}Z")


RING = "AAKASH REMESH * BOOKS IN BALANCE * "


def ring_text(cx=60, cy=60, r=44, size=9.6):
    """Glyphs set evenly around a circle, 'AAKASH REMESH' centred at the top."""
    n = len(RING)
    step = 360 / n
    start = -90 - 6 * step  # slot 6 = middle of 'AAKASH REMESH'
    parts = []
    upm = plex["head"].unitsPerEm
    for i, ch in enumerate(RING):
        if ch == " ":
            continue
        th = start + i * step
        px, py = cx + r * math.cos(math.radians(th)), cy + r * math.sin(math.radians(th))
        if ch == "*":
            # sparkle sits at cap-height midpoint, pushed outward
            mx = cx + (r + 3.3) * math.cos(math.radians(th))
            my = cy + (r + 3.3) * math.sin(math.radians(th))
            parts.append(f'<path d="{star(mx, my, 2.6)}"/>')
            continue
        d, w = glyph_path(plex, ch, 0, 0, size)
        parts.append(f'<path transform="translate({px:.3f} {py:.3f}) rotate({th + 90:.3f}) '
                     f'translate({-w / 2:.3f} 0)" d="{d}"/>')
    return "\n    ".join(parts)


AR_D, _ = text_path(manrope, "AR", 60, 66, 27, tracking=-1, anchor="middle")
RING_D = ring_text()


def seal(bg, fg, accent, *, ring_class=""):
    disc = f'<circle cx="60" cy="60" r="57" fill="{bg}"/>' if bg else \
           f'<circle cx="60" cy="60" r="57" fill="none" stroke="{fg}" stroke-width="2.4"/>'
    return f"""{disc}
  <circle cx="60" cy="60" r="35" fill="none" stroke="{accent}" stroke-width="1.5"/>
  <g fill="{fg}"{f' class="{ring_class}"' if ring_class else ''}>
    {RING_D}
  </g>
  <path fill="{fg}" d="{AR_D}"/>
  <path d="M44 74 H76 M44 78.5 H76" stroke="{accent}" stroke-width="2" stroke-linecap="round"/>"""


MINI_AR, _ = text_path(manrope, "AR", 60, 70, 44, tracking=-1.5, anchor="middle")


def mini(bg, fg, accent):
    """Simplified seal for ≤48px: no ring text, bigger letters."""
    return f"""<circle cx="60" cy="60" r="58" fill="{bg}"/>
  <circle cx="60" cy="60" r="49" fill="none" stroke="{accent}" stroke-width="3"/>
  <path fill="{fg}" d="{MINI_AR}"/>
  <path d="M36 82 H84 M36 89 H84" stroke="{accent}" stroke-width="3.6" stroke-linecap="round"/>"""


def svg(body, vb="0 0 120 120", label="Aakash Remesh — audit seal logo"):
    return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{vb}" role="img" aria-label="{label}">\n  {body}\n</svg>\n'


files = {
    "seal.svg": seal(INK, LAV, VIO2),
    "seal-lavender.svg": seal(LAV, INK, VIO),
    "seal-violet.svg": seal(VIO, WHITE, LAV),
    "seal-outline-ink.svg": seal(None, INK, VIO),
    "seal-outline-white.svg": seal(None, WHITE, LAV),
    "seal-mini.svg": mini(INK, LAV, VIO2),
    "seal-mini-lavender.svg": mini(LAV, INK, VIO),
}
for name, body in files.items():
    open(os.path.join(out, name), "w").write(svg(body))

# Horizontal lockups
NAME_D, name_w = text_path(manrope, "Aakash Remesh", 0, 0, 46, tracking=-1.2)
TAG_D, tag_w = text_path(plex, "ACCOUNTING SYSTEMS CONSULTANT", 0, 0, 13.2, tracking=2.4)
W = 150 + max(name_w, tag_w) + 24


def lockup(seal_body, name_c, tag_c, bg=None):
    back = f'<rect width="{W:.0f}" height="150" rx="24" fill="{bg}"/>' if bg else ""
    return svg(f"""{back}
  <g transform="translate(15 15)">{seal_body}</g>
  <path fill="{name_c}" transform="translate(150 78)" d="{NAME_D}"/>
  <path fill="{tag_c}" transform="translate(152 106)" d="{TAG_D}"/>""",
               vb=f"0 0 {W:.0f} 150", label="Aakash Remesh — Accounting Systems Consultant")


open(os.path.join(out, "logo-horizontal.svg"), "w").write(lockup(seal(INK, LAV, VIO2), INK, VIO))
open(os.path.join(out, "logo-horizontal-dark.svg"), "w").write(lockup(seal(LAV, INK, VIO), "#f3f0ff", VIO2, bg=INK))
print("wrote", len(files) + 2, "files to", out)
