"""Swap the illustration's flat lavender background for a professional grey.

The background is removed by colour distance, limited to the region connected to the
image border, and edge pixels are colour-decontaminated (pixel = a*fg + (1-a)*bg), so
anti-aliased hair edges don't keep a purple fringe.

Usage: python3 grey_background.py <in.webp> <out.png> [--alpha <alpha.png>]
"""
import sys
import numpy as np
from PIL import Image, ImageFilter
from scipy import ndimage

src, out = sys.argv[1], sys.argv[2]
alpha_out = sys.argv[sys.argv.index("--alpha") + 1] if "--alpha" in sys.argv else None

img = np.asarray(Image.open(src).convert("RGB")).astype(np.float32)
h, w, _ = img.shape
BG = np.array([215, 202, 254], np.float32)

# Distance from the background colour (0 = pure background).
d = np.linalg.norm(img - BG, axis=2)
core = d < 28                        # pure background, wherever it is (incl. pockets between hair strands)
# ...except inside the glasses, where lens glare can be lavender-blue.
y0, y1, x0, x1 = int(h * .28), int(h * .40), int(w * .355), int(w * .70)
core[y0:y1, x0:x1] = False
core = ndimage.binary_opening(core, iterations=1)

# Edge pixels: anything within a few pixels of pure background that is still lavender-ish.
# Kept narrow so light-grey clothing that touches the border isn't treated as background.
band = ndimage.binary_dilation(core, iterations=5) & (d < 140)
bgw = np.where(core, 1.0, np.where(band, np.clip((140 - d) / (140 - 28), 0, 1), 0.0)).astype(np.float32)
bgw = ndimage.gaussian_filter(bgw, 0.7)

# Professional grey: a soft vertical gradient with a gentle light from upper left.
yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)
top, bottom = np.array([218, 220, 224], np.float32), np.array([176, 179, 186], np.float32)
t = (yy / h)[..., None]
grey = top * (1 - t) + bottom * t
light = np.exp(-(((xx - w * 0.3) / (w * 0.55)) ** 2 + ((yy - h * 0.2) / (h * 0.55)) ** 2))[..., None]
grey = grey + light * 14

a = bgw[..., None]
outimg = img - a * BG + a * grey     # decontaminate edges, replace background
outimg = np.clip(outimg, 0, 255).astype(np.uint8)
Image.fromarray(outimg).save(out)
if alpha_out:
    Image.fromarray(((1 - bgw) * 255).astype(np.uint8)).save(alpha_out)
print("saved", out, outimg.shape)
