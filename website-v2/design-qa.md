# Contact/footer design QA

final result: passed

## Comparison target

- Source visual truth: `qa/contact-footer-reference-vivid-motion.png`
- Browser-rendered implementation: `qa/contact-footer-desktop-2048x993.png`
- Mobile implementation: `qa/contact-footer-mobile-390x844.png`
- Pointer-response evidence: `qa/contact-footer-pointer-interaction-2048x993.png`
- Full-view comparison: `qa/contact-footer-comparison-full.png`
- Focused wordmark comparison: `qa/contact-footer-comparison-wordmark.png`
- Browser viewport: 2048 × 993 desktop and 390 × 844 mobile. The in-app browser capture surface exported the desktop PNG at 1899 × 986 while retaining the same desktop layout state.
- State: final page position, contact/footer fully visible, Liquid Ether active, mobile menu closed.

## Findings

No actionable P0, P1, or P2 differences remain.

- Fonts and typography: the implementation uses the site's self-hosted Instrument Serif for the oversized wordmark and IBM Plex Sans Condensed for links and legal copy. The wordmark has comparable editorial scale and bottom anchoring to the source, remains fully visible, and contains no copyright superscript.
- Spacing and layout rhythm: the requested four actions form the source-inspired contact row, with the legal line directly beneath it. The omitted city/address columns intentionally leave open space above the wordmark. Desktop and mobile have no horizontal overflow.
- Colors and visual tokens: the black, paper-white, muted text, and Carmine motion field use the existing Realty Media palette. The reference's warmer brown surface was intentionally translated into the established site tokens.
- Image quality and asset fidelity: the reference contains no required raster asset beyond its overall background treatment. The implementation reuses the site's real WebGL Liquid Ether effect; no CSS illustration, placeholder, fake icon, or custom SVG substitute was introduced.
- Copy and content: WhatsApp, Instagram, Email, `+40 732 775 601`, and `Realty Media is operated by Mint Studios Agency SRL © All Rights Reserved 2026` match the requested content. The large `Realty Media` wordmark has no appended copyright mark.
- Responsiveness and accessibility: the four actions collapse to a clean two-column grid at 390px, the legal line wraps without overlap, the wordmark stays readable, and reduced-motion behavior continues to disable Liquid Ether. Semantic navigation, `mailto:`, `tel:`, external-link safety attributes, and visible keyboard focus styles are present.
- Interaction and runtime: the footer Liquid Ether canvas initialized independently from the hero canvas and visibly changed after pointer movement. The four destinations were verified in the rendered DOM. The browser console reported no errors.

The persistent site navigation is intentionally retained over the final chapter because it is an established Version 2 pattern, rather than a footer element from the visual reference.

## Comparison history

1. Initial comparison found a P2 wordmark baseline crop and an undersized desktop lockup. The wordmark sizing, line metrics, horizontal scaling, and bottom positioning were adjusted.
2. The next comparison found P2 right-edge glyph clipping at the widest desktop viewport. Letter spacing and scale were rebalanced; post-fix bounds showed no horizontal overflow.
3. A P2 layer transition exposed a sliver of the outgoing portfolio phone before the footer fully covered it. The combined contact/footer chapter received its own stacking context above portfolio content.
4. Final desktop and mobile captures show the complete wordmark, stable contact hierarchy, responsive wrapping, active motion background, and no P0/P1/P2 findings.

## Focused comparison evidence

The focused wordmark comparison was required because the full-view pair makes the serif baseline and edge clearance difficult to judge. `qa/contact-footer-comparison-wordmark.png` confirms that both the source and implementation use a full-width editorial serif lockup anchored to the lower region, while the implementation preserves the requested Realty Media name and removes the small copyright mark.

## Primary interactions tested

- WhatsApp destination: `https://wa.me/40732775601`
- Instagram destination: `https://www.instagram.com/realtymedia.ro/`
- Email destination: `mailto:contact@realtymedia.ro`
- Telephone destination: `tel:+40732775601`
- Pointer movement across the footer changed the rendered Liquid Ether frame.
- Both Liquid Ether layers reported ready canvases.
- Browser console errors checked: none.

## Follow-up polish

- P3: the exact Instagram profile URL was inferred from the brand name because the prompt did not provide a handle. Confirm the handle before production launch if it differs from `realtymedia.ro`.
