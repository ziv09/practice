from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

OUTPUT_DIR = Path(__file__).resolve().parent.parent / "public"
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

COLORS = {
    "bg": (31, 41, 55, 255),
    "accent": (168, 85, 247, 255),
    "text": (255, 255, 255, 255),
}

try:
    base_font = ImageFont.truetype("msjh.ttc", 200)
except Exception:
    base_font = ImageFont.load_default()

for size, name in [
    (192, "pwa-192x192.png"),
    (512, "pwa-512x512.png"),
    (1024, "pwa-maskable.png"),
]:
    img = Image.new("RGBA", (size, size), COLORS["bg"])
    draw = ImageDraw.Draw(img)
    radius = int(size * 0.35)
    draw.ellipse(
        (size / 2 - radius, size / 2 - radius, size / 2 + radius, size / 2 + radius),
        fill=COLORS["accent"],
    )
    text = "修"
    if hasattr(base_font, "font_variant"):
        font = base_font.font_variant(size=int(size * 0.6))
    else:
        font = base_font
    bbox = draw.textbbox((0, 0), text, font=font)
    tw, th = bbox[2] - bbox[0], bbox[3] - bbox[1]
    draw.text(
        ((size - tw) / 2, (size - th) / 2 - 5),
        text,
        fill=COLORS["text"],
        font=font,
    )
    img.save(OUTPUT_DIR / name)

Image.new("RGBA", (180, 180), COLORS["accent"]).save(OUTPUT_DIR / "apple-touch-icon.png")
