# Airbnb Scroll Video Template

This folder is a reusable template for cinematic Airbnb/property landing pages where scroll position controls a walkthrough video.

## Files

- `index.html` is the reusable engine. Usually do not edit this.
- `sections.json` is the project config. Edit this for each property.
- `scroll.mp4` is the current video. Replace it or point `sections.json` to another video file.

## New Project Workflow

1. Put the final video in this folder.
2. Update `video` in `sections.json`.
3. Set `scrollHeight`. Start with `760vh`; use `900vh` for a slower, more luxurious scroll or `600vh` for a faster one.
4. Add sections with `start` and `end` values from `0` to `1`.
5. Edit the room copy.
6. Run a local server and open the page.

Example section:

```json
{
  "id": "living",
  "start": 0.22,
  "end": 0.38,
  "position": "right",
  "eyebrow": "Living",
  "title": "Spatiu deschis, luminos",
  "text": "Zona principala este prezentata ca un loc primitor, premium si pregatit pentru momente memorabile."
}
```

## Position Options

- `left`
- `right`
- `center`
- `bottom-left`
- `bottom-right`

On mobile, all text moves to the lower-left area so it stays readable over the video.

## What To Send Me For Future Footage

You can do the `start` and `end` values yourself. To make it fast, send:

- The video file.
- The property name or short vibe.
- The room/scene list in order.
- Your desired timings as `start` and `end` percentages.
- Any must-say selling points.
- Language: Romanian, English, Hungarian, or mixed.
- Whether the tone should feel luxury, cozy, minimal, rustic, family-friendly, romantic, or investment-grade.

Simple format:

```text
Video: property-name.mp4
Tone: premium cozy, Romanian

Sections:
0.04-0.16 entrance: impressive first view, mountain feeling
0.22-0.38 living: fireplace, big windows, social space
0.48-0.62 bedroom: calm, private, hotel-like sleep
0.68-0.82 kitchen: fully equipped, easy for longer stays
```

I can then turn that into polished `sections.json` copy without touching the template engine.
