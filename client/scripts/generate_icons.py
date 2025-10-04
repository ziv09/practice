from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

OUTPUT_DIR = Path(__file__).resolve().parent.parent / "public"
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

# 綠底白字 P
COLORS = {
    "bg": (34, 197, 94, 255),   # #22c55e
    "text": (255, 255, 255, 255),
}

def load_font(px: int):
    for name in ["arial.ttf", "DejaVuSans.ttf"]:
        try:
            return ImageFont.truetype(name, px)
        except Exception:
            continue
    return ImageFont.load_default()

def draw_icon(size: int, char: str = "P") -> Image.Image:
    img = Image.new("RGBA", (size, size), COLORS["bg"])
    draw = ImageDraw.Draw(img)
    font = load_font(int(size * 0.65))
    bbox = draw.textbbox((0, 0), char, font=font)
    tw, th = bbox[2] - bbox[0], bbox[3] - bbox[1]
    draw.text(((size - tw) / 2, (size - th) / 2 - 4), char, fill=COLORS["text"], font=font)
    return img

for size, name in [
    (192, "pwa-192x192.png"),
    (512, "pwa-512x512.png"),
    (1024, "pwa-maskable.png"),
]:
    draw_icon(size).save(OUTPUT_DIR / name)

draw_icon(180).save(OUTPUT_DIR / "apple-touch-icon.png")
draw_icon(32).save(OUTPUT_DIR / "favicon.ico", format="ICO", sizes=[(16, 16), (32, 32)])

