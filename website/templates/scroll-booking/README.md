# Scroll Booking Property Template

Cinematic self-hosted property landing page template with:

- Scroll-controlled walkthrough frame sequence generated from a walkthrough video.
- Bottom-left editorial copy overlays.
- Airbnb-style clickable gallery.
- Simple visitor-facing availability checker.
- Inquiry form confirmation state.

## Folder Shape

For a new property, copy this folder and replace the config/assets:

```text
website/properties/property-name/
  index.html
  property.json
  sections.json
  scroll.mp4
  assets/frames/frame-0001.jpg
  assets/
    fonts/Eczar-VariableFont_wght.ttf
    images/property-name/
```

## Config Files

### `sections.json`

Controls the scroll frame sequence and copy that appears during the cinematic intro.

```json
{
  "framePattern": "assets/frames/frame-{{index}}.jpg",
  "frameCount": 125,
  "scrollHeight": "760vh",
  "sections": [
    {
      "id": "living",
      "start": 0.22,
      "end": 0.38,
      "eyebrow": "Living",
      "title": "Spatiu deschis, luminos",
      "text": "Zona principala este prezentata ca un loc primitor, premium si pregatit pentru momente memorabile."
    }
  ]
}
```

### `property.json`

Controls the hero, property details, gallery, facts, WhatsApp CTA, and blocked calendar ranges.

Use `property.sample.json` as the starting point.

## Inputs Needed For A New Property

Send me:

1. Property name and location.
2. WhatsApp phone number for booking.
3. Final scroll video, preferably MP4. I will convert it into scroll frames.
4. Video scene list with rough timestamps or percentages.
5. Hero headline, subhead, and CTA wording, or just the vibe and I can write it.
6. Short property description.
7. Key facts: guests, bedrooms, bathrooms, kitchen, jacuzzi, grill, parking, pet policy, etc.
8. Gallery photos, ideally 8-12 images.
9. Blocked/unavailable date ranges if you want the demo calendar to show unavailable dates.
10. Tone/language: Romanian, English, Hungarian, mixed; premium, cozy, rustic, minimal, party-friendly, romantic, family-friendly.

## Notes

- The availability checker is an inquiry flow, not instant booking.
- The calendar is local/static in this template. Real sync or backend booking logic should be added separately only if needed.
- `scrollHeight` controls how long the cinematic intro feels. Start with `760vh`; increase for slower/luxury pacing.
- Generate frames with a command like:

```bash
ffmpeg -y -i scroll.mp4 -vf "fps=12,scale=1600:-2" -q:v 5 assets/frames/frame-%04d.jpg
```

Then set `frameCount` to the number of generated files.
