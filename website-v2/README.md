# Realty Media — Website v2

This is the production website source. Root Vercel configuration publishes this
directory; the retired \`website/\` source is not part of the deployment.

## Locked brand system

- **Brand blue:** \`#5256E0\`
- **Full white:** \`#FFFFFF\`
- **Full black:** \`#000000\`
- **Alternative grey:** \`#EEEEEE\`
- **Typeface:** Outfit only, weights 400 and 600 only
- **Brandmark:** the supplied mark is always used alone, never beside text
- **Corners:** controls and cards use generous radii; the full-width topbar
  background is the intentional square-edged exception
- **Contrast:** blue and black surfaces carry white text/icons only; white and
  grey surfaces carry black text/icons only

## Website-v2 implementation direction

The site keeps a concise, video-first agency story: hero, proof/client logos,
services, selected work, platform/app proof, and a contact close. It uses the
same simple surface logic as the web app: white topbar, grey content sections,
white cards when needed, and black feature fields.

The hero uses the local Liquid Ether renderer only as a blue-on-black movement
field. Its source palette contains no red, Carmine, cream, or secondary brand
colour. Reduced-motion users receive the static black-and-blue composition.

## Local preview

Serve this directory directly, for example:

    python3 -m http.server 4175 -d website-v2

Then open http://127.0.0.1:4175/.

## Brand check

Run the first-party source check before publishing:

    node website-v2/scripts/check-brand-design.mjs
