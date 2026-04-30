"""
Generate favicons + app icons from the source logo.

- Auto-crops white margins
- Converts white background to transparent
- Generates black version (default) and white version (dark mode)
- Outputs:
    public/favicon.ico         (multi-size: 16, 32, 48)
    public/icon-light.png      (32x32 black on transparent)
    public/icon-dark.png       (32x32 white on transparent)
    public/apple-touch-icon.png (180x180 black on transparent)
    public/icon-512.png        (512x512 black on transparent — for PWA)
    src/app/icon.png           (Next.js app icon)
    src/app/apple-icon.png     (Next.js apple icon)
"""

from PIL import Image, ImageOps
from pathlib import Path

PROJECT_ROOT = Path(__file__).parent.parent
SOURCE = PROJECT_ROOT / "assets" / "motherboard-logo-source.png"
PUBLIC = PROJECT_ROOT / "public"
APP_DIR = PROJECT_ROOT / "src" / "app"

PUBLIC.mkdir(exist_ok=True)


def crop_to_content(img: Image.Image, dark_threshold: int = 100) -> Image.Image:
    """Auto-crop background, keep only the dark logo area."""
    gray = img.convert("L")
    # Mark anything sufficiently dark as content
    binary = gray.point(lambda p: 255 if p < dark_threshold else 0)
    bbox = binary.getbbox()
    if bbox:
        pad = 30
        left = max(0, bbox[0] - pad)
        top = max(0, bbox[1] - pad)
        right = min(img.width, bbox[2] + pad)
        bottom = min(img.height, bbox[3] + pad)
        return img.crop((left, top, right, bottom))
    return img


def make_transparent_black(img: Image.Image) -> Image.Image:
    """
    Convert white-background, dark-logo image to transparent-background,
    pure-black logo. Anti-aliased edges become semi-transparent black.
    """
    img = img.convert("RGBA")
    pixels = img.load()
    width, height = img.size

    for y in range(height):
        for x in range(width):
            r, g, b, a = pixels[x, y]
            # The closer to white, the more transparent
            # The closer to black, the more opaque
            brightness = (r + g + b) / 3
            # Map brightness 0 (black) -> alpha 255, 255 (white) -> alpha 0
            new_alpha = max(0, min(255, int(255 - brightness)))
            pixels[x, y] = (0, 0, 0, new_alpha)

    return img


def make_transparent_white(img: Image.Image) -> Image.Image:
    """
    Same as above but the logo is rendered white (for dark backgrounds).
    """
    img = img.convert("RGBA")
    pixels = img.load()
    width, height = img.size

    for y in range(height):
        for x in range(width):
            r, g, b, a = pixels[x, y]
            brightness = (r + g + b) / 3
            new_alpha = max(0, min(255, int(255 - brightness)))
            pixels[x, y] = (255, 255, 255, new_alpha)

    return img


def square_pad(img: Image.Image) -> Image.Image:
    """Pad the image so it's perfectly square (transparent fill)."""
    w, h = img.size
    if w == h:
        return img
    size = max(w, h)
    new_img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    new_img.paste(img, ((size - w) // 2, (size - h) // 2), img)
    return new_img


def main():
    print(f"Loading source: {SOURCE.name}")
    src = Image.open(SOURCE)
    print(f"  Original size: {src.size}")

    # Step 1: crop white margins
    cropped = crop_to_content(src)
    print(f"  Cropped to:    {cropped.size}")

    # Step 2: build transparent black + white versions
    black = make_transparent_black(cropped)
    white = make_transparent_white(cropped)

    # Step 3: square pad both
    black = square_pad(black)
    white = square_pad(white)
    print(f"  Squared to:    {black.size}")

    # Step 4: generate output sizes
    # ---- favicon.ico (multi-resolution) ----
    favicon_sizes = [(16, 16), (32, 32), (48, 48), (64, 64)]
    favicon_path = PUBLIC / "favicon.ico"
    black.save(favicon_path, format="ICO", sizes=favicon_sizes)
    print(f"[OK] {favicon_path.relative_to(PROJECT_ROOT)}")

    # ---- public/ PNGs ----
    outputs = {
        "icon-light.png": (black, 32),
        "icon-dark.png": (white, 32),
        "apple-touch-icon.png": (black, 180),
        "icon-512.png": (black, 512),
    }
    for name, (img, size) in outputs.items():
        out = img.resize((size, size), Image.LANCZOS)
        out_path = PUBLIC / name
        out.save(out_path, format="PNG", optimize=True)
        print(f"[OK] {out_path.relative_to(PROJECT_ROOT)} ({size}x{size})")

    # ---- src/app/ Next.js auto-discovery icons ----
    # Next.js automatically uses these as favicons via metadata convention
    # https://nextjs.org/docs/app/api-reference/file-conventions/metadata/app-icons
    next_icon = black.resize((32, 32), Image.LANCZOS)
    next_apple = black.resize((180, 180), Image.LANCZOS)
    next_icon.save(APP_DIR / "icon.png", format="PNG", optimize=True)
    next_apple.save(APP_DIR / "apple-icon.png", format="PNG", optimize=True)
    print(f"[OK] src/app/icon.png (32x32)")
    print(f"[OK] src/app/apple-icon.png (180x180)")

    # ---- Remove the old default favicon.ico from src/app/ ----
    # (Next.js prefers app-dir convention; remove the old one to avoid conflict)
    old_favicon = APP_DIR / "favicon.ico"
    if old_favicon.exists():
        old_favicon.unlink()
        print(f"[OK] removed src/app/favicon.ico (replaced by icon.png)")

    print("\nDone! Commit & push to deploy.")


if __name__ == "__main__":
    main()
