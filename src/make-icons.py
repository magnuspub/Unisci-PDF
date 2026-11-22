# Unisci PDF
# Copyright (C) 2026 magnuspub
#
# This program is free software: you can redistribute it and/or modify it under the terms of the
# GNU General Public License as published by the Free Software Foundation, version 3 of the License.
#
# This program is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without
# even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU
# General Public License for more details.
#
# You should have received a copy of the GNU General Public License along with this program.
# If not, see https://www.gnu.org/licenses/.

"""Draws the app icons in docs/icons. Needs Pillow: python3 src/make-icons.py"""
import pathlib
from PIL import Image, ImageDraw

BLUE, PAPER, FOLD = (29, 78, 216), (255, 255, 255), (199, 214, 251)
OUT = pathlib.Path(__file__).resolve().parent.parent / 'docs' / 'icons'


def icon(size, maskable):
    k = 4                                   # drawn larger, then reduced, for smooth edges
    s = size * k
    im = Image.new('RGBA', (s, s), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    if maskable:
        d.rectangle([0, 0, s, s], fill=BLUE)        # the system cuts its own shape out of a full square
    else:
        d.rounded_rectangle([0, 0, s - 1, s - 1], radius=int(s * 0.22), fill=BLUE)
    u = s * (0.60 if maskable else 0.78) / 64       # the page is drawn on a 64-unit grid, centred
    ox, oy = (s - 64 * u) / 2, (s - 64 * u) / 2
    P = lambda x, y: (ox + x * u, oy + y * u)
    d.polygon([P(18, 9), P(38, 9), P(48, 19), P(48, 55), P(18, 55)], fill=PAPER)
    d.polygon([P(38, 9), P(48, 19), P(38, 19)], fill=FOLD)
    for y, x2 in ((29, 42), (37, 42), (45, 35)):
        d.line([P(24, y), P(x2, y)], fill=BLUE, width=max(1, int(3.4 * u)))
        r = 1.7 * u
        for x in (24, x2):
            cx, cy = P(x, y)
            d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=BLUE)
    return im.resize((size, size), Image.LANCZOS)


OUT.mkdir(parents=True, exist_ok=True)
icon(192, False).save(OUT / 'icon-192.png')
icon(512, False).save(OUT / 'icon-512.png')
icon(512, True).save(OUT / 'icon-maskable-512.png')
print('icons written to', OUT)
