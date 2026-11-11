"""Hand-built depth map for the portrait's 2.5D cursor-follow effect.

R = depth (0 background … 1 nose tip), smooth so the WebGL warp never tears.
G = iris mask (1 at each iris centre), used to move the eyes independently.
Coordinates are for the 2000×2000 source illustration.

Usage: python3 depth_map.py <fg-alpha.png> <out.png> [size]
"""
import sys
import numpy as np
from PIL import Image
from scipy import ndimage

alpha = np.asarray(Image.open(sys.argv[1]).convert("L")).astype(np.float32) / 255
out, size = sys.argv[2], int(sys.argv[3]) if len(sys.argv) > 3 else 256
h, w = alpha.shape
yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)
g = lambda cx, cy, sx, sy=None: np.exp(-(((xx - cx) / sx) ** 2 + ((yy - cy) / (sy or sx)) ** 2) / 2)

# Torso: gently rounded, well behind the face.
body = 0.22 + 0.10 * np.clip(1 - ((xx - 1050) / 1100) ** 2, 0, 1)

# Head: an ellipsoid around the face and hair.
cx, cy, rx, ry = 1075, 780, 430, 600
q = 1 - ((xx - cx) / rx) ** 2 - ((yy - cy) / ry) ** 2
head = np.where(q > 0, 0.38 + 0.42 * np.sqrt(np.clip(q, 0, 1)), 0)

face = np.maximum(body, head)
face += 0.22 * g(1087, 790, 60, 85)        # nose
face += 0.10 * g(1080, 1060, 210, 170)     # beard and chin
face += 0.05 * g(1080, 540, 260, 110)      # brow/forehead
face -= 0.14 * g(670, 740, 55, 90)         # left ear (viewer's left)
face -= 0.14 * g(1425, 750, 55, 90)        # right ear

depth = ndimage.gaussian_filter(np.clip(face, 0, 1) * alpha, 22)
depth = depth / depth.max()

iris = np.maximum(g(925, 644, 26), g(1237, 644, 26))

rgb = np.dstack([depth, iris, np.zeros_like(depth)])
img = Image.fromarray((rgb * 255).astype(np.uint8)).resize((size, size), Image.LANCZOS)
img.save(out, optimize=True)
print("saved", out, img.size)
