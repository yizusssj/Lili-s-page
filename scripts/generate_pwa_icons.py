from pathlib import Path
from math import pi, sin, cos

from PIL import Image, ImageDraw, ImageFilter


ROOT = Path(__file__).resolve().parents[1]
PUBLIC = ROOT / "public"
CANVAS = 1024


def interpolate(start, end, amount):
    return tuple(round(a + (b - a) * amount) for a, b in zip(start, end))


def create_background():
    image = Image.new("RGBA", (CANVAS, CANVAS))
    pixels = image.load()
    start = (217, 247, 255, 255)
    middle = (217, 213, 250, 255)
    end = (246, 215, 229, 255)

    for y in range(CANVAS):
        for x in range(CANVAS):
            progress = (x + y) / (2 * (CANVAS - 1))
            if progress < 0.52:
                color = interpolate(start, middle, progress / 0.52)
            else:
                color = interpolate(middle, end, (progress - 0.52) / 0.48)
            pixels[x, y] = color

    return image


def draw_heart(draw, center_x, center_y, size):
    points = []
    for index in range(181):
        angle = 2 * pi * index / 180
        x = 16 * sin(angle) ** 3
        y = 13 * cos(angle) - 5 * cos(2 * angle) - 2 * cos(3 * angle) - cos(4 * angle)
        points.append((center_x + x * size, center_y - y * size))
    draw.polygon(points, fill=(232, 95, 145, 255))


def create_icon():
    image = create_background()
    glass = Image.new("RGBA", image.size)
    glass_draw = ImageDraw.Draw(glass)
    glass_draw.rounded_rectangle(
        (108, 108, 916, 916),
        radius=208,
        fill=(255, 255, 255, 48),
        outline=(255, 255, 255, 150),
        width=10,
    )
    image = Image.alpha_composite(image, glass)

    moon_mask = Image.new("L", image.size)
    moon_draw = ImageDraw.Draw(moon_mask)
    moon_draw.ellipse((224, 232, 752, 760), fill=255)
    moon_draw.ellipse((382, 146, 858, 622), fill=0)

    shadow_mask = moon_mask.filter(ImageFilter.GaussianBlur(38))
    shadow = Image.new("RGBA", image.size, (80, 72, 128, 0))
    shadow.putalpha(shadow_mask.point(lambda value: round(value * 0.2)))
    shadow = shadow.transform(image.size, Image.Transform.AFFINE, (1, 0, 0, 0, 1, -26))
    image = Image.alpha_composite(image, shadow)

    moon = Image.new("RGBA", image.size, (244, 253, 255, 255))
    moon.putalpha(moon_mask)
    image = Image.alpha_composite(image, moon)

    foreground = Image.new("RGBA", image.size)
    draw = ImageDraw.Draw(foreground)
    draw_heart(draw, 700, 700, 8.15)

    draw.line((230, 265, 230, 215), fill=(255, 255, 255, 255), width=16)
    draw.line((205, 240, 255, 240), fill=(255, 255, 255, 255), width=16)
    draw.line((776, 208, 776, 174), fill=(255, 255, 255, 235), width=12)
    draw.line((759, 191, 793, 191), fill=(255, 255, 255, 235), width=12)
    image = Image.alpha_composite(image, foreground)
    return image


def main():
    source = create_icon()
    outputs = {
        "apple-touch-icon.png": 180,
        "pwa-192x192.png": 192,
        "pwa-512x512.png": 512,
        "pwa-maskable-512x512.png": 512,
        "favicon-64.png": 64,
    }

    for filename, size in outputs.items():
        resized = source.resize((size, size), Image.Resampling.LANCZOS)
        resized.save(PUBLIC / filename, optimize=True)

    source.resize((64, 64), Image.Resampling.LANCZOS).save(
        PUBLIC / "favicon.ico",
        sizes=[(16, 16), (32, 32), (48, 48), (64, 64)],
    )


if __name__ == "__main__":
    main()
