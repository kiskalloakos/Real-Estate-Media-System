from pathlib import Path

from reportlab.lib.colors import Color, HexColor
from reportlab.lib.pagesizes import A4, landscape
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen import canvas


ROOT = Path(__file__).resolve().parents[2]
OUTPUT = ROOT / "output" / "pdf" / "realty-media-brand-map.pdf"
FONT_DIR = ROOT / "website-v2" / "assets" / "fonts"

PAGE_W, PAGE_H = landscape(A4)

BLACK = HexColor("#0A0A0A")
PAPER = HexColor("#F3EFE7")
MUTED = HexColor("#A7A198")
CARMINE = HexColor("#D62828")
CARMINE_BRIGHT = HexColor("#E23434")
CHARCOAL = HexColor("#111111")
DEEP_CARMINE = HexColor("#7A1111")
ENERGY_RED = HexColor("#FF3B3B")
WHITE = HexColor("#FFFFFF")


def register_fonts():
    pdfmetrics.registerFont(
        TTFont("InstrumentSerif", FONT_DIR / "instrument-serif-regular.ttf")
    )
    pdfmetrics.registerFont(
        TTFont("InstrumentSerifItalic", FONT_DIR / "instrument-serif-italic.ttf")
    )
    pdfmetrics.registerFont(
        TTFont("IBMPlexCondensed", FONT_DIR / "ibm-plex-sans-condensed-regular.ttf")
    )
    pdfmetrics.registerFont(
        TTFont("IBMPlexCondensedMedium", FONT_DIR / "ibm-plex-sans-condensed-medium.ttf")
    )
    pdfmetrics.registerFont(
        TTFont("IBMPlexCondensedSemibold", FONT_DIR / "ibm-plex-sans-condensed-semibold.ttf")
    )


def label(c, text, x, y, color=CARMINE, size=7.4, tracking=1.35):
    t = c.beginText(x, y)
    t.setFont("IBMPlexCondensedSemibold", size)
    t.setFillColor(color)
    t.setCharSpace(tracking)
    t.textLine(text.upper())
    c.drawText(t)
    # PDF text state persists across text objects, so explicitly clear tracking.
    reset = c.beginText(0, 0)
    reset.setCharSpace(0)
    c.drawText(reset)


def rule(c, x1, y, x2, color=Color(10 / 255, 10 / 255, 10 / 255, alpha=0.16)):
    c.setStrokeColor(color)
    c.setLineWidth(0.55)
    c.line(x1, y, x2, y)


def wordmark(c, x, baseline, size, color, centered_in=None):
    c.setFillColor(color)
    c.setFont("InstrumentSerif", size)
    mark = "Realty Media"
    mark_w = pdfmetrics.stringWidth(mark, "InstrumentSerif", size)
    copy_size = size * 0.29
    copy_gap = size * 0.13
    total_w = mark_w + copy_gap + pdfmetrics.stringWidth("©", "IBMPlexCondensedMedium", copy_size)
    if centered_in is not None:
        x = x + (centered_in - total_w) / 2
    c.drawString(x, baseline, mark)
    c.setFont("IBMPlexCondensedMedium", copy_size)
    c.drawString(x + mark_w + copy_gap, baseline + size * 0.48, "©")


def swatch(c, x, y, w, h, fill, name, hex_value, light_text=False, border=False):
    c.setFillColor(fill)
    if border:
        c.setStrokeColor(Color(10 / 255, 10 / 255, 10 / 255, alpha=0.18))
        c.setLineWidth(0.55)
        c.rect(x, y, w, h, fill=1, stroke=1)
    else:
        c.rect(x, y, w, h, fill=1, stroke=0)
    ink = PAPER if light_text else BLACK
    c.setFillColor(ink)
    c.setFont("IBMPlexCondensedSemibold", 7.2)
    c.drawString(x + 8, y + 17, name.upper())
    c.setFont("IBMPlexCondensed", 7.2)
    c.drawString(x + 8, y + 7, hex_value.upper())


def logo_panel(c, x, y, w, h, fill, ink, caption, border=False):
    c.setFillColor(fill)
    if border:
        c.setStrokeColor(Color(10 / 255, 10 / 255, 10 / 255, alpha=0.2))
        c.setLineWidth(0.55)
        c.rect(x, y, w, h, fill=1, stroke=1)
    else:
        c.rect(x, y, w, h, fill=1, stroke=0)
    wordmark(c, x, y + 27.2, 28, ink, centered_in=w)
    caption_color = PAPER if fill != PAPER else BLACK
    c.setFillColor(caption_color)
    c.setFont("IBMPlexCondensedMedium", 6.6)
    c.drawCentredString(x + w / 2, y + 9, caption.upper())


def wrap_text(text, font_name, font_size, max_width):
    lines = []
    current = ""
    for word in text.split():
        candidate = f"{current} {word}".strip()
        if current and pdfmetrics.stringWidth(candidate, font_name, font_size) > max_width:
            lines.append(current)
            current = word
        else:
            current = candidate
    if current:
        lines.append(current)
    return lines


def draw_pdf():
    register_fonts()
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    c = canvas.Canvas(str(OUTPUT), pagesize=(PAGE_W, PAGE_H), pageCompression=1)
    c.setTitle("Realty Media - Brand Map")
    c.setAuthor("Realty Media")
    c.setSubject("Website Version 2 identity rules")

    c.setFillColor(PAPER)
    c.rect(0, 0, PAGE_W, PAGE_H, fill=1, stroke=0)

    margin = 34
    content_w = PAGE_W - 2 * margin

    # Masthead
    c.setFillColor(BLACK)
    c.rect(0, PAGE_H - 82, PAGE_W, 82, fill=1, stroke=0)
    wordmark(c, margin, PAGE_H - 57, 38, PAPER)
    c.setFillColor(MUTED)
    c.setFont("IBMPlexCondensedMedium", 7.6)
    c.drawRightString(PAGE_W - margin, PAGE_H - 32, "BRAND MAP / WEBSITE V2")
    c.setFillColor(PAPER)
    c.setFont("IBMPlexCondensed", 7.6)
    c.drawRightString(PAGE_W - margin, PAGE_H - 46, "LOCKED DIGITAL IDENTITY / JULY 2026")

    # Color system
    color_top = PAGE_H - 108
    label(c, "01 / Color system", margin, color_top)
    c.setFillColor(BLACK)
    c.setFont("IBMPlexCondensed", 8)
    c.drawRightString(PAGE_W - margin, color_top, "Carmine is the only primary accent.")

    swatch_y = color_top - 69
    gap = 7
    swatch_w = (content_w - 4 * gap) / 5
    swatches = [
        (BLACK, "Canvas", "#0A0A0A", True, False),
        (CARMINE, "Gallery Carmine", "#D62828", True, False),
        (PAPER, "Warm Paper", "#F3EFE7", False, True),
        (MUTED, "Muted Stone", "#A7A198", False, False),
        (CHARCOAL, "Section Surface", "#111111", True, False),
    ]
    for i, (fill, name, value, light, border) in enumerate(swatches):
        swatch(c, margin + i * (swatch_w + gap), swatch_y, swatch_w, 52, fill, name, value, light, border)

    c.setFillColor(BLACK)
    c.setFont("IBMPlexCondensedMedium", 7)
    c.drawString(margin, swatch_y - 14, "DIGITAL STATES")
    c.setFont("IBMPlexCondensed", 7)
    c.drawString(margin + 72, swatch_y - 14, "Deep Carmine  #7A1111")
    c.setFillColor(DEEP_CARMINE)
    c.circle(margin + 66, swatch_y - 11.6, 2.5, fill=1, stroke=0)
    c.setFillColor(BLACK)
    c.drawString(margin + 183, swatch_y - 14, "Energy Red  #FF3B3B")
    c.setFillColor(ENERGY_RED)
    c.circle(margin + 177, swatch_y - 11.6, 2.5, fill=1, stroke=0)
    c.setFillColor(BLACK)
    c.drawString(margin + 287, swatch_y - 14, "Hover Carmine  #E23434")
    c.setFillColor(CARMINE_BRIGHT)
    c.circle(margin + 281, swatch_y - 11.6, 2.5, fill=1, stroke=0)
    c.setFillColor(BLACK)
    c.drawRightString(PAGE_W - margin, swatch_y - 14, "Motion / interaction only")

    # Typography
    type_top = swatch_y - 43
    rule(c, margin, type_top + 12, PAGE_W - margin)
    label(c, "02 / Typography", margin, type_top)
    col_gap = 28
    col_w = (content_w - col_gap) / 2
    left_x = margin
    right_x = margin + col_w + col_gap

    c.setFillColor(BLACK)
    c.setFont("InstrumentSerif", 34)
    c.drawString(left_x, type_top - 38, "Instrument Serif")
    c.setFont("InstrumentSerifItalic", 22)
    c.drawString(left_x, type_top - 63, "Proprietăți care spun povești.")
    c.setFont("IBMPlexCondensedMedium", 7.2)
    c.drawString(left_x, type_top - 79, "DISPLAY / WORDMARK  -  REGULAR 400")
    c.setFont("IBMPlexCondensed", 7.2)
    c.setFillColor(HexColor("#595652"))
    c.drawString(left_x, type_top - 91, "Italic is reserved for editorial emphasis.")

    c.setFillColor(BLACK)
    c.setFont("IBMPlexCondensedSemibold", 18)
    c.drawString(right_x, type_top - 31, "IBM Plex Sans Condensed")
    c.setFont("IBMPlexCondensed", 10.3)
    c.drawString(right_x, type_top - 49, "Regular 400   Body copy and supporting text")
    c.setFont("IBMPlexCondensedMedium", 10.3)
    c.drawString(right_x, type_top - 65, "Medium 500   Navigation, labels and controls")
    c.setFont("IBMPlexCondensedSemibold", 10.3)
    c.drawString(right_x, type_top - 81, "Semibold 600   Small headings and emphasis")
    c.setFont("IBMPlexCondensedMedium", 7.2)
    c.drawString(right_x, type_top - 95, "UI / BODY  -  UPPERCASE LABELS MAY USE +5 TO +10% TRACKING")

    # Logo use
    logo_top = type_top - 125
    rule(c, margin, logo_top + 12, PAGE_W - margin)
    label(c, "03 / Logo on backgrounds", margin, logo_top)
    c.setFillColor(BLACK)
    c.setFont("IBMPlexCondensed", 8)
    c.drawRightString(PAGE_W - margin, logo_top, "One-color wordmark only.")

    panel_y = logo_top - 73
    panel_gap = 8
    panel_w = (content_w - 2 * panel_gap) / 3
    logo_panel(c, margin, panel_y, panel_w, 58, BLACK, PAPER, "Paper on Canvas")
    logo_panel(c, margin + panel_w + panel_gap, panel_y, panel_w, 58, PAPER, BLACK, "Canvas on Paper", border=True)
    logo_panel(c, margin + 2 * (panel_w + panel_gap), panel_y, panel_w, 58, CARMINE, PAPER, "Paper on Carmine")

    # Minimum usage rules
    footer_y = 67
    rule(c, margin, footer_y + 29, PAGE_W - margin)
    label(c, "Minimum rules", margin, footer_y + 16, color=BLACK, size=6.8, tracking=1.1)
    rules = [
        "Keep the wordmark horizontal. Never stretch or distort it.",
        "Use only the three approved logo color combinations.",
        "Keep clear space equal to the cap height of the R.",
        "Never add outlines, shadows, gradients or extra effects.",
    ]
    start_x = margin + 102
    available = PAGE_W - margin - start_x
    item_gap = 12
    item_w = (available - 3 * item_gap) / 4
    for i, text in enumerate(rules):
        x = start_x + i * (item_w + item_gap)
        c.setFillColor(CARMINE)
        c.setFont("IBMPlexCondensedSemibold", 6.8)
        c.drawString(x, footer_y + 16, f"0{i + 1}")
        c.setFillColor(BLACK)
        c.setFont("IBMPlexCondensed", 6.8)
        for line_index, line in enumerate(
            wrap_text(text, "IBMPlexCondensed", 6.8, item_w - 20)[:3]
        ):
            c.drawString(x + 16, footer_y + 16 - (line_index * 8.5), line)

    c.showPage()
    c.save()


if __name__ == "__main__":
    draw_pdf()
    print(OUTPUT)
