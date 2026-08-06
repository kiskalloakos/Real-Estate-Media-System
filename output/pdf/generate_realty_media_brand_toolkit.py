"""Generate the Realty Media brand toolkit PDFs.

These are operational guides: a visual identity source of truth, an editorial
guide, and a property-content production guide.  They deliberately avoid UI
prescriptions and promotional filler.
"""
from functools import lru_cache
from io import BytesIO
from pathlib import Path

from PIL import Image
from reportlab.lib.colors import HexColor
from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib.utils import ImageReader
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen import canvas

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "output" / "pdf"
FONT_DIR = OUT / "fonts"
LOGO_LIGHT_FILE = ROOT / "website-v2" / "assets" / "images" / "brand" / "realty-media-brandmark.png"
LOGO_DARK_FILE = ROOT / "webapp" / "assets" / "images" / "realty-media-mark-black.png"
W, H = landscape(A4)

BLUE = HexColor("#5256E0")
BLACK = HexColor("#000000")
WHITE = HexColor("#FFFFFF")
GREY = HexColor("#EEEEEE")
MID = HexColor("#5E5E65")
LINE = HexColor("#C9C9CD")


def register_fonts():
    pdfmetrics.registerFont(TTFont("Outfit", FONT_DIR / "Outfit-Regular.ttf"))
    pdfmetrics.registerFont(TTFont("OutfitSemiBold", FONT_DIR / "Outfit-SemiBold.ttf"))


def font(weight=400):
    return "OutfitSemiBold" if weight == 600 else "Outfit"


def draw_text(c, value, x, y, size, color=BLACK, weight=400, align="left"):
    c.setFont(font(weight), size)
    c.setFillColor(color)
    if align == "right":
        c.drawRightString(x, y, value)
    elif align == "center":
        c.drawCentredString(x, y, value)
    else:
        c.drawString(x, y, value)


def lines(value, size, width, weight=400):
    result, current = [], ""
    for word in value.split():
        attempt = f"{current} {word}".strip()
        if current and pdfmetrics.stringWidth(attempt, font(weight), size) > width:
            result.append(current)
            current = word
        else:
            current = attempt
    if current:
        result.append(current)
    return result


def paragraph(c, value, x, y, width, size=9, color=MID, weight=400, leading=None):
    leading = leading or size * 1.42
    for n, line in enumerate(lines(value, size, width, weight)):
        draw_text(c, line, x, y - n * leading, size, color, weight)
    return y - len(lines(value, size, width, weight)) * leading


def box(c, x, y, w, h, fill=WHITE, stroke=None, radius=12, line_width=.7):
    c.setFillColor(fill)
    if stroke:
        c.setStrokeColor(stroke)
        c.setLineWidth(line_width)
        c.roundRect(x, y, w, h, radius, fill=1, stroke=1)
    else:
        c.roundRect(x, y, w, h, radius, fill=1, stroke=0)


@lru_cache(maxsize=2)
def logo_bytes(variant):
    im = Image.open(LOGO_LIGHT_FILE if variant == "light" else LOGO_DARK_FILE).convert("RGBA")
    if variant == "dark":
        # The black master has a white RGB background rather than alpha.
        alpha = Image.new("L", im.size, 0)
        alpha.paste(255, mask=Image.eval(im.convert("L"), lambda value: 255 if value < 240 else 0))
        im.putalpha(alpha)
    crop = im.getchannel("A").getbbox()
    buf = BytesIO()
    im.crop(crop).save(buf, "PNG")
    return buf.getvalue()


def logo(c, x, y, w=44, h=27, variant="dark"):
    """Place the mark directly on the chosen surface - it owns no background."""
    image = ImageReader(BytesIO(logo_bytes(variant)))
    iw, ih = image.getSize()
    scale = min(w / iw, h / ih)
    c.drawImage(image, x + (w - iw * scale) / 2, y + (h - ih * scale) / 2,
                iw * scale, ih * scale, mask="auto")


def header(c, title, page, total, dark=False):
    ink = WHITE if dark else BLACK
    logo(c, 34, H - 53, variant="light" if dark else "dark")
    draw_text(c, title.upper(), 91, H - 39, 7.5, ink, 600)
    draw_text(c, f"{page:02d} / {total:02d}", W - 34, H - 39, 7.5, ink, 600, "right")


def footer(c, label, page, dark=False):
    ink = GREY if dark else MID
    draw_text(c, label.upper(), 34, 27, 6.5, ink, 600)
    draw_text(c, f"REALTY MEDIA / {page:02d}", W - 34, 27, 6.5, ink, 600, "right")


def title(c, kicker, heading, body, page, total, dark=False):
    bg, ink, soft = (BLACK, WHITE, GREY) if dark else (WHITE, BLACK, MID)
    c.setFillColor(bg); c.rect(0, 0, W, H, fill=1, stroke=0)
    header(c, kicker, page, total, dark)
    draw_text(c, heading, 34, 330, 38, ink, 600)
    paragraph(c, body, 34, 292, 430, 12, soft, leading=17)
    logo(c, W - 196, 218, 120, 74, variant="light" if dark else "dark")
    footer(c, kicker, page, dark)
    c.showPage()


def section_head(c, label, heading, body):
    draw_text(c, label.upper(), 34, H - 91, 7.5, BLUE, 600)
    draw_text(c, heading, 34, H - 126, 27, BLACK, 600)
    paragraph(c, body, 34, H - 153, 520, 9.5, MID, leading=13)


def rule(c, x, y, w):
    c.setStrokeColor(LINE); c.setLineWidth(.7); c.line(x, y, x + w, y)


def brand_map(path):
    c = canvas.Canvas(str(path), pagesize=(W, H), pageCompression=1)
    c.setTitle("Realty Media - Brand Map")
    c.setAuthor("Realty Media")
    c.setSubject("Core visual identity and asset-use guide")
    c.setKeywords("Realty Media, brand identity, logo, colour, typography")
    title(c, "Brand map", "Core visual identity", "The source of truth for Realty Media names, mark, colour, typography and basic layout across client-facing communication.", 1, 4)

    header(c, "Brand map", 2, 4)
    section_head(c, "01 / Identity", "What stays consistent", "Use this guide when creating a website, proposal, social post, production credit, client portal or printed document.")
    entries = [
        ("Name", "Realty Media", "Use title case in running text. Do not add a descriptor to the name in a logo treatment."),
        ("Descriptor", "Digital Marketing & Development", "Use where context is needed: website metadata, proposal cover, directory listing and first reference in a document."),
        ("Legal line", "Realty Media is operated by Mint Studios Agency SRL © All Rights Reserved 2026", "Use in website footers and formal documents when a legal ownership line is required."),
        ("Primary mark", "Supplied symbol asset", "The mark is used by itself. Keep its original proportions; do not redraw, outline, crop or combine it with a new wordmark."),
    ]
    y = 348
    for name, value, note in entries:
        box(c, 34, y - 65, 774, 57, WHITE, LINE, 10)
        draw_text(c, name.upper(), 50, y - 29, 7, BLUE, 600)
        draw_text(c, value, 186, y - 29, 11, BLACK, 600)
        paragraph(c, note, 186, y - 46, 560, 7.8, MID, leading=10)
        y -= 73
    footer(c, "Brand map", 2); c.showPage()

    header(c, "Brand map", 3, 4)
    section_head(c, "02 / Mark and colour", "Mark placement and palette", "The mark may appear on any surface. Use black or white artwork that remains clearly visible; do not add a colour block behind it by default.")
    box(c, 34, 178, 220, 185, GREY, None, 22); logo(c, 84, 234, 120, 64, "dark")
    draw_text(c, "CLEAR SPACE", 34, 145, 7, BLUE, 600)
    paragraph(c, "Leave space equal to the mark icon's height on every side. In small placements, preserve at least 16 px of clear space.", 34, 129, 220, 8.3, MID, leading=11)
    palette = [("Brand blue", "#5256E0", "RGB 82 86 224", BLUE, WHITE), ("Black", "#000000", "RGB 0 0 0", BLACK, WHITE), ("White", "#FFFFFF", "RGB 255 255 255", WHITE, BLACK), ("Grey", "#EEEEEE", "RGB 238 238 238", GREY, BLACK)]
    x = 286
    for name, hexv, rgb, fill, ink in palette:
        box(c, x, 244, 122, 119, fill, BLACK if fill in (WHITE, GREY) else None, 14)
        draw_text(c, name, x + 13, 329, 9, ink, 600); draw_text(c, hexv, x + 13, 302, 8.5, ink, 600); draw_text(c, rgb, x + 13, 285, 7, ink)
        x += 130
    draw_text(c, "COLOUR USE", 286, 211, 7, BLUE, 600)
    paragraph(c, "Blue identifies Realty Media. Black and white provide primary contrast. Grey is a background surface, not a text colour. Select black or white logo artwork based on the actual surface; the logo does not require a purple background.", 286, 195, 510, 8.5, MID, leading=11.5)
    footer(c, "Brand map", 3); c.showPage()

    header(c, "Brand map", 4, 4)
    section_head(c, "03 / Typography and layout", "A single type family", "Outfit is the brand typeface. It is available through Google Fonts and in the brand package.")
    box(c, 34, 197, 365, 162, WHITE, LINE, 16)
    draw_text(c, "OUTFIT SEMIBOLD / 600", 54, 332, 7.5, BLUE, 600)
    draw_text(c, "Marketing complet", 54, 286, 25, BLACK, 600)
    paragraph(c, "Use for headings, navigation, labels and short calls to action. Set sentence case unless a file or platform requires capitals.", 54, 249, 295, 8.5, MID, leading=11.5)
    box(c, 418, 197, 389, 162, BLACK, radius=16)
    draw_text(c, "OUTFIT REGULAR / 400", 438, 332, 7.5, WHITE, 600)
    draw_text(c, "Pentru proprietatea ta", 438, 286, 21, WHITE, 400)
    paragraph(c, "Use for body copy, captions, data and longer descriptions. Keep text readable; do not use the grey palette colour for body copy.", 438, 249, 315, 8.5, GREY, leading=11.5)
    draw_text(c, "LAYOUT", 34, 155, 7, BLUE, 600)
    paragraph(c, "Use a simple grid, generous outside margins and clear distinction between a primary heading, supporting copy and action. The brand does not require a fixed corner radius; choose a radius that belongs to the product or format and use it consistently within that piece.", 34, 139, 750, 8.5, MID, leading=11.5)
    footer(c, "Brand map", 4); c.showPage(); c.save()


def voice_guide(path):
    c = canvas.Canvas(str(path), pagesize=(W, H), pageCompression=1)
    c.setTitle("Realty Media - Writing Guide"); c.setAuthor("Realty Media")
    c.setSubject("Practical writing standards for client-facing copy")
    title(c, "Writing guide", "Clear Romanian, useful detail", "A writing guide for pages, proposals, captions and production messages. It protects clarity without forcing a manufactured 'brand voice'.", 1, 4, dark=True)
    header(c, "Writing guide", 2, 4)
    section_head(c, "01 / Editorial standard", "Write for a decision", "Readers should quickly understand what is offered, what is included, when it happens and what the next step is.")
    columns = [("State the service", "Name the deliverable: fotografie imobiliară, video vertical, pagină de prezentare, portal client. Avoid vague labels when a specific service is available."), ("State the scope", "List the property, number or type of deliverables, intended channel, handover date and any exclusions. Use bullets for scope and pricing."), ("State the action", "End operational messages with one next step: confirmă data, trimite materialele, aprobă varianta, alege pachetul. Add the contact or deadline when relevant.")]
    x = 34
    for label, body in columns:
        box(c, x, 186, 244, 165, WHITE, LINE, 16)
        draw_text(c, label.upper(), x + 18, 319, 8, BLUE, 600)
        paragraph(c, body, x + 18, 285, 205, 10, BLACK, leading=14)
        x += 264
    footer(c, "Writing guide", 2); c.showPage()
    header(c, "Writing guide", 3, 4)
    section_head(c, "02 / Copy patterns", "Reusable structures", "Adapt these structures to the actual property, client and deliverables. Do not invent outcomes, availability or performance claims.")
    patterns = [
        ("Service page", "[Serviciu] pentru [tip proprietate]. Include [livrabile]. Pentru ofertă sau programare: [contact]."),
        ("Project caption", "[Numele proiectului], [localitate]. Am realizat [livrabile] pentru a prezenta [detaliu real al proprietății]."),
        ("Client approval", "Bună, [nume]. Varianta [număr] este pregătită pentru aprobare. Include [ce s-a schimbat]. Te rog confirmă până la [data] sau trimite observațiile într-un singur răspuns."),
        ("Offer scope", "Pachetul include: [listă]. Predare: [data / interval]. Clientul furnizează: [listă]. Investiție: [sumă] + TVA, dacă se aplică."),
    ]
    y = 350
    for label, sample in patterns:
        draw_text(c, label.upper(), 34, y, 8, BLUE, 600); paragraph(c, sample, 190, y, 575, 10, BLACK, leading=14); y -= 67; rule(c, 34, y + 19, 740)
    footer(c, "Writing guide", 3); c.showPage()
    header(c, "Writing guide", 4, 4)
    section_head(c, "03 / Names, facts and review", "Accuracy is part of the brand", "Use Romanian diacritics. Verify every property fact with the approved source before publication.")
    checks = [
        ("Property facts", "Address or locality, floor area, room count, amenities, price, availability and viewing details must be supplied or confirmed by the client or listing source."),
        ("Performance claims", "Only publish views, leads, sales results or client names that are supported by the relevant report or written permission."),
        ("Image permissions", "Confirm rights for photography, video, music, floor plans, people and third-party logos before use."),
        ("Language", "Use 'Realty Media' in title case. Service names may be Romanian or English when they match a recognised deliverable; keep one language within a short item of copy."),
    ]
    y = 345
    for label, body in checks:
        box(c, 34, y - 50, 740, 46, GREY, None, 10); draw_text(c, label, 50, y - 23, 9, BLACK, 600); paragraph(c, body, 205, y - 22, 540, 8.2, MID, leading=10.5); y -= 62
    footer(c, "Writing guide", 4); c.showPage(); c.save()


def production_guide(path):
    c = canvas.Canvas(str(path), pagesize=(W, H), pageCompression=1)
    c.setTitle("Realty Media - Property Content Production Guide"); c.setAuthor("Realty Media")
    c.setSubject("Photography and video production standards")
    title(c, "Production guide", "Property content that answers questions", "A shared brief for the team and the property owner. Its job is to prepare a clean shoot, capture the useful details and deliver files that work in the intended channels.", 1, 4)
    header(c, "Production guide", 2, 4)
    section_head(c, "01 / Before the shoot", "Prepare the property and brief", "A production day works best when the client confirms access, styling and the delivery purpose before arrival.")
    items = [
        ("Access and timing", "Confirm address, parking, contact person, access time, keys or entry code, and whether occupants, guests or staff will be present."),
        ("Property readiness", "Clean visible surfaces, remove personal paperwork and bins, open blinds where appropriate, switch on practical lights, and decide which rooms or exterior areas are in scope."),
        ("Brief", "Confirm target buyer or guest, property strengths to show, required formats, platform, deadlines and any mandatory details such as view, parking, terrace or renovation."),
        ("Permissions", "Confirm permission to photograph the premises and any people visible on site. Identify areas, artworks or neighbouring properties that must not be shown."),
    ]
    y = 350
    for n, (label, body) in enumerate(items, 1):
        draw_text(c, f"{n:02d}", 34, y, 9, BLUE, 600); draw_text(c, label, 79, y, 10, BLACK, 600); paragraph(c, body, 240, y, 520, 8.8, MID, leading=12); y -= 68
    footer(c, "Production guide", 2); c.showPage()
    header(c, "Production guide", 3, 4)
    section_head(c, "02 / Capture list", "Show the property in a useful order", "The final selection should allow a viewer to understand arrival, layout, light, key rooms and the strongest differentiators.")
    shots = [("Arrival", "Exterior context, entrance, building or site approach."), ("Overview", "Wide establishing images of main rooms and the primary exterior area."), ("Flow", "Views that connect adjacent spaces and clarify circulation."), ("Details", "Material finishes, kitchen, bathroom, storage, view, terrace, parking or amenities that materially affect a decision."), ("Vertical video", "A short sequence with a clear route: approach, principal room, best feature, close. Capture separate vertical framing when social delivery is required.")]
    x, y = 34, 340
    for n, (label, body) in enumerate(shots, 1):
        box(c, x, y - 94, 235, 82, WHITE, LINE, 14)
        draw_text(c, f"{n:02d}", x + 15, y - 31, 7.5, BLUE, 600); draw_text(c, label, x + 48, y - 31, 10, BLACK, 600); paragraph(c, body, x + 15, y - 51, 196, 7.6, MID, leading=10)
        x += 252
        if x > 600: x, y = 34, y - 102
    footer(c, "Production guide", 3); c.showPage()
    header(c, "Production guide", 4, 4)
    section_head(c, "03 / Edit, deliver, archive", "Keep handover unambiguous", "Edit for accurate representation. Correct exposure, white balance and perspective without changing material property features or misrepresenting scale.")
    rows = [("File names", "YYYY-MM-DD_property-locality_deliverable_version.ext. Example: 2026-08-06_vila-cluj-napoca_hero-photo_v01.jpg."), ("Photography", "Deliver web-ready JPEGs at the agreed dimensions. Retain the edited high-resolution master where the contract requires it."), ("Video", "Deliver the agreed aspect ratios separately. Include captions or on-screen copy only after the factual text is approved."), ("Review", "Send a single review link or folder, identify the version and deadline, and collect comments in one consolidated response."), ("Archive", "Store final approved files and the project brief together. Keep source footage, licences and client approvals according to the agreed retention policy.")]
    y = 348
    for label, body in rows:
        box(c, 34, y - 47, 740, 43, GREY, None, 10); draw_text(c, label.upper(), 50, y - 22, 7.5, BLUE, 600); paragraph(c, body, 184, y - 22, 555, 8.3, BLACK, leading=10.5); y -= 55
    footer(c, "Production guide", 4); c.showPage(); c.save()


if __name__ == "__main__":
    OUT.mkdir(parents=True, exist_ok=True)
    register_fonts()
    brand_map(OUT / "realty-media-brand-map.pdf")
    voice_guide(OUT / "realty-media-writing-guide.pdf")
    production_guide(OUT / "realty-media-property-content-production-guide.pdf")
    print("Generated Realty Media brand toolkit")
