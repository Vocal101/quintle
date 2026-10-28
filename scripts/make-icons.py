# Draws the app icons: a green tile with a white "Q", like a solved letter.
# Usage: python scripts/make-icons.py
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

OUT = Path(__file__).resolve().parent.parent / 'icons'
GREEN = (106, 170, 100)
FONT = 'C:/Windows/Fonts/arialbd.ttf'


def icon(size, maskable=False, radius_frac=0.18):
    scale = 4  # supersample for smooth edges
    s = size * scale
    img = Image.new('RGBA', (s, s), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    if maskable:
        d.rectangle([0, 0, s, s], fill=GREEN)
        glyph = 0.42
    else:
        d.rounded_rectangle([0, 0, s - 1, s - 1], radius=int(s * radius_frac), fill=GREEN)
        glyph = 0.62
    font = ImageFont.truetype(FONT, int(s * glyph))
    box = d.textbbox((0, 0), 'Q', font=font)
    w, h = box[2] - box[0], box[3] - box[1]
    d.text(((s - w) / 2 - box[0], (s - h) / 2 - box[1]), 'Q', font=font, fill='white')
    return img.resize((size, size), Image.LANCZOS)


OUT.mkdir(exist_ok=True)
icon(192).save(OUT / 'icon-192.png')
icon(512).save(OUT / 'icon-512.png')
icon(512, maskable=True).save(OUT / 'icon-maskable-512.png')
# iOS draws its own rounded corners, so the touch icon is a full square.
icon(180, maskable=True).convert('RGB').save(OUT / 'apple-touch-icon.png')
print('icons written to', OUT)
