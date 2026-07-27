from pathlib import Path
from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import A4
from reportlab.lib.colors import HexColor, Color
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.lib.utils import ImageReader
from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
OUT = Path(__file__).with_name("realty-media-pentru-agenti-imobiliari.pdf")
ASSETS = ROOT / "website" / "assets"
FOREST = HexColor("#0D241C")
IVORY = HexColor("#F5EFE4")
GOLD = HexColor("#D9AD52")
INK = HexColor("#10100E")
MUTED = HexColor("#6F6558")
WHITE = HexColor("#FFFFFF")
W, H = A4

FONT_DIR = Path(__file__).with_name("fonts")
pdfmetrics.registerFont(TTFont("Editorial", str(FONT_DIR / "PlayfairDisplay-Variable.ttf")))
pdfmetrics.registerFont(TTFont("BrandSans", str(FONT_DIR / "Inter-Variable.ttf")))
pdfmetrics.registerFont(TTFont("BrandSansBold", str(FONT_DIR / "Inter-Variable.ttf")))
pdfmetrics.registerFont(TTFont("BrandSansItalic", str(FONT_DIR / "Inter-Variable.ttf")))


def cover_image(c, path, x, y, w, h, darken=0.0):
    img = Image.open(path)
    iw, ih = img.size
    scale = max(w / iw, h / ih)
    crop_w, crop_h = w / scale, h / scale
    left, top = (iw - crop_w) / 2, (ih - crop_h) / 2
    cropped = img.crop((left, top, left + crop_w, top + crop_h))
    c.drawImage(ImageReader(cropped), x, y, w, h, mask="auto")
    if darken:
        c.setFillColor(Color(0, 0, 0, alpha=darken))
        c.rect(x, y, w, h, fill=1, stroke=0)


def line(c, x1, y, x2, color=GOLD, width=1):
    c.setStrokeColor(color)
    c.setLineWidth(width)
    c.line(x1, y, x2, y)


def rm_mark(c, x, y, color=IVORY, size=24):
    c.setFillColor(color)
    c.setFont("Editorial", size)
    c.drawString(x, y, "RM")


def footer(c, page, dark=False):
    color = Color(1, 1, 1, alpha=.62) if dark else MUTED
    c.setFillColor(color)
    c.setFont("BrandSans", 7.5)
    c.drawString(42, 26, "REALTY MEDIA  ·  CLUJ-NAPOCA")
    c.drawRightString(W - 42, 26, f"0{page}")


def wrap(c, text, x, y, max_width, font, size, leading, color, max_lines=None):
    words = text.split()
    lines, current = [], ""
    for word in words:
        trial = word if not current else current + " " + word
        if pdfmetrics.stringWidth(trial, font, size) <= max_width:
            current = trial
        else:
            if current:
                lines.append(current)
            current = word
    if current:
        lines.append(current)
    if max_lines:
        lines = lines[:max_lines]
    c.setFillColor(color)
    c.setFont(font, size)
    for row in lines:
        c.drawString(x, y, row)
        y -= leading
    return y


def page_one(c):
    photo = ROOT / "website" / "properties" / "cabana-the-one" / "images" / "hero-exterior.jpeg"
    cover_image(c, photo, 0, 0, W, H, darken=.46)
    c.setFillColor(Color(0.05, .14, .11, alpha=.68))
    c.rect(0, 0, W, H, fill=1, stroke=0)
    rm_mark(c, 44, H - 64, size=25)
    c.setFillColor(GOLD)
    c.setFont("BrandSansBold", 8)
    c.drawString(44, H - 108, "REALTY MEDIA · PREZENTARE")
    y = H - 190
    y = wrap(c, "Conținut și prezență online", 44, y, 500, "Editorial", 38, 44, WHITE)
    y = wrap(c, "pentru agenți imobiliari.", 44, y + 2, 500, "Editorial", 38, 44, GOLD)
    line(c, 44, y - 6, 124, GOLD, 2)
    c.setFillColor(WHITE)
    c.setFont("BrandSans", 12)
    c.drawString(44, y - 40, "Fotografie · video · dronă · social media · website")
    c.setFont("BrandSansBold", 9)
    c.drawString(44, 52, "REALTYMEDIA.RO")
    c.linkURL("https://www.realtymedia.ro/", (44, 44, 132, 62), relative=0)
    footer(c, 1, dark=True)


def page_two(c):
    c.setFillColor(IVORY)
    c.rect(0, 0, W, H, fill=1, stroke=0)
    rm_mark(c, 44, H - 62, color=FOREST, size=22)
    c.setFillColor(GOLD)
    c.setFont("BrandSansBold", 8)
    c.drawString(44, H - 112, "SERVICII PENTRU AGENȚI ȘI PROPRIETĂȚI")
    y = H - 180
    y = wrap(c, "Materiale produse pentru", 44, y, 500, "Editorial", 34, 40, FOREST)
    y = wrap(c, "canalele pe care le folosești.", 44, y - 2, 500, "Editorial", 34, 40, GOLD)
    line(c, 44, y - 10, W - 44, HexColor("#CDBFAD"), .8)
    items = [
        ("01", "Fotografie și video", "Cadre de interior, exterior și prezentări în mișcare."),
        ("02", "Dronă și formate verticale", "Materiale pentru listări, Reels, TikTok și stories."),
        ("03", "Social media", "Plan de conținut, editare și publicare pentru contul agentului."),
        ("04", "Anunțuri și prezentare online", "Selecția materialelor, structură clară și contact direct."),
    ]
    yy = y - 78
    for number, title, body in items:
        c.setFillColor(GOLD)
        c.setFont("BrandSansBold", 9)
        c.drawString(44, yy + 3, number)
        c.setFillColor(FOREST)
        c.setFont("BrandSansBold", 14)
        c.drawString(92, yy, title)
        c.setFillColor(MUTED)
        c.setFont("BrandSans", 10)
        c.drawString(92, yy - 20, body)
        yy -= 72
    footer(c, 2)


def page_three(c):
    c.setFillColor(IVORY)
    c.rect(0, 0, W, H, fill=1, stroke=0)
    rm_mark(c, 44, H - 62, color=FOREST, size=22)
    c.setFillColor(GOLD)
    c.setFont("BrandSansBold", 8)
    c.drawString(44, H - 112, "SOCIAL MEDIA PENTRU AGENȚI IMOBILIARI")
    y = H - 166
    y = wrap(c, "Conținut premium pentru", 44, y, 500, "Editorial", 34, 40, FOREST)
    y = wrap(c, "profilul tău și proprietățile tale.", 44, y, 500, "Editorial", 34, 40, GOLD)
    y = wrap(c, "Filmăm și edităm conținut pentru Instagram, TikTok și Facebook, adaptat modului în care oamenii consumă astăzi informația despre proprietăți.", 44, y - 28, 490, "BrandSans", 10.5, 17, MUTED)
    services = [
        "tururi video și prezentări ale proprietăților",
        "clipuri în care agentul vorbește direct cu publicul",
        "Reels cu detalii, avantaje și informații utile",
        "formate verticale, subtitrări și editare pentru social media",
    ]
    yy = y - 42
    for service in services:
        c.setFillColor(GOLD); c.circle(50, yy + 3, 2.2, fill=1, stroke=0)
        c.setFillColor(FOREST); c.setFont("BrandSans", 10.5); c.drawString(66, yy, service)
        yy -= 36
    c.setFillColor(FOREST)
    c.roundRect(44, 116, W - 88, 104, 8, fill=1, stroke=0)
    c.setFillColor(WHITE)
    c.setFont("BrandSansBold", 10.5)
    c.drawString(64, 184, "Mai mult decât imagini frumoase")
    wrap(c, "Conținutul este gândit să prezinte proprietatea clar, să creeze interes și să susțină mai multe conversații, vizionări și vânzări.", 64, 160, W - 128, "BrandSans", 9.5, 15, Color(1, 1, 1, alpha=.76))
    footer(c, 3)


def page_four(c):
    c.setFillColor(IVORY)
    c.rect(0, 0, W, H, fill=1, stroke=0)
    rm_mark(c, 44, H - 62, color=FOREST, size=22)
    c.setFillColor(GOLD)
    c.setFont("BrandSansBold", 8)
    c.drawString(44, H - 112, "DESPRE REALTY MEDIA")
    y = H - 172
    y = wrap(c, "Foto, video și sisteme", 44, y, 500, "Editorial", 31, 37, FOREST)
    y = wrap(c, "digitale pentru imobiliare.", 44, y, 500, "Editorial", 31, 37, GOLD)
    y = wrap(c, "Realty Media este o echipă din Cluj-Napoca, specializată în imagine, video, social media și pagini de prezentare pentru proprietăți.", 44, y - 26, 460, "BrandSans", 10.5, 16, MUTED)
    y = wrap(c, "Pentru agenți, serviciile pot fi folosite separat sau combinate, în funcție de proprietate și de materialele deja disponibile.", 44, y - 12, 460, "BrandSans", 10.5, 16, MUTED)
    c.setFillColor(GOLD)
    c.roundRect(44, 235, 220, 48, 7, fill=1, stroke=0)
    c.setFillColor(INK)
    c.setFont("BrandSansBold", 11)
    c.drawCentredString(154, 254, "REALTYMEDIA.RO")
    c.linkURL("https://www.realtymedia.ro/", (44, 235, 264, 283), relative=0)
    c.setFillColor(FOREST)
    c.setFont("BrandSansBold", 11)
    c.drawString(44, 202, "+40 732 775 601")
    c.linkURL("https://wa.me/40732775601", (44, 194, 160, 214), relative=0)
    c.setFont("BrandSans", 9.5)
    c.drawString(44, 177, "realtymedia.ro")
    c.drawString(44, 157, "contact@realtymedia.ro")
    c.linkURL("https://www.realtymedia.ro/", (44, 169, 122, 185), relative=0)
    c.linkURL("mailto:contact@realtymedia.ro", (44, 149, 170, 165), relative=0)
    c.setFillColor(MUTED)
    c.setFont("BrandSans", 8.5)
    c.drawString(44, 112, "Portofoliu și exemple de servicii disponibile pe website.")
    footer(c, 4)


def build():
    OUT.parent.mkdir(parents=True, exist_ok=True)
    c = canvas.Canvas(str(OUT), pagesize=A4, pageCompression=1)
    c.setTitle("Realty Media pentru agenți imobiliari")
    c.setAuthor("Realty Media")
    c.setSubject("Foto, video și social media pentru agenți imobiliari")
    for page in (page_one, page_two, page_three, page_four):
        page(c)
        c.showPage()
    c.save()
    print(OUT)


if __name__ == "__main__":
    build()
