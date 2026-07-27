from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "output" / "social" / "realty-media-instagram-profile.png"
FONT = ROOT / "website-v2" / "assets" / "fonts" / "instrument-serif-regular.ttf"

SIZE = 1080
SCALE = 4
BACKGROUND = "#D62828"  # Gallery Carmine
FOREGROUND = "#F3EFE7"  # Warm Paper
FONT_SIZE = 300
LINE_GAP = 22


def main() -> None:
    canvas_size = SIZE * SCALE
    image = Image.new("RGB", (canvas_size, canvas_size), BACKGROUND)
    draw = ImageDraw.Draw(image)
    font = ImageFont.truetype(str(FONT), FONT_SIZE * SCALE)

    lines = ("Realty", "Media")
    boxes = [draw.textbbox((0, 0), line, font=font) for line in lines]
    visual_heights = [box[3] - box[1] for box in boxes]
    total_height = sum(visual_heights) + LINE_GAP * SCALE
    current_top = (canvas_size - total_height) / 2

    for line, box, visual_height in zip(lines, boxes, visual_heights):
        visual_width = box[2] - box[0]
        x = (canvas_size - visual_width) / 2 - box[0]
        y = current_top - box[1]
        draw.text((round(x), round(y)), line, font=font, fill=FOREGROUND)
        current_top += visual_height + LINE_GAP * SCALE

    image = image.resize((SIZE, SIZE), Image.Resampling.LANCZOS)
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    image.save(OUTPUT, format="PNG", optimize=True)


if __name__ == "__main__":
    main()
