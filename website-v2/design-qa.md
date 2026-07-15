# Portfolio device and media design QA

final result: passed

## Comparison target

- Source visual truth: `assets/images/portfolio/iphone-mockup.png`, `assets/images/portfolio/mac-studio-mockup.png`, the supplied `Reel 1.mp4`, and the supplied `Mac-be.mov`.
- Browser-rendered implementation: `qa/portfolio-after-state-2-phone.png`, `qa/portfolio-after-state-3-mac.png`, `qa/portfolio-mobile-phone.png`, and `qa/portfolio-mobile-mac.png`.
- Full-view comparisons: `qa/portfolio-state-2-before-after.png` and `qa/portfolio-state-3-before-after.png`.
- Focused asset comparisons: `qa/portfolio-phone-asset-comparison.png` and `qa/portfolio-mac-asset-comparison.png`.
- Transition evidence: `qa/portfolio-phone-to-mac-transition.png`.
- Viewports: 1470 × 803 desktop and 390 × 844 phone.
- State: portfolio pinned chapter at reels two and three, mobile menu closed, active media playing.

## Findings

No actionable P0, P1, or P2 differences remain for the requested portfolio media update.

- Fonts and typography: the existing Instrument Serif project metadata, IBM Plex Sans Condensed labels, hierarchy, line height, wrapping, and copy remain unchanged.
- Spacing and layout rhythm: the first two projects remain centered in a portrait device. The third project expands into a centered landscape Mac display while retaining balanced gaps to the metadata columns. The complete Mac bezel now fits at phone width.
- Colors and visual tokens: the black portfolio surface, paper typography, muted metadata, Carmine heading accent, and device shadows remain consistent with the existing Realty Media system.
- Image quality and asset fidelity: the supplied 1882 × 3878 iPhone and 1000 × 741 Mac PNGs are used directly with their transparency intact. The screen masks align with the real frame openings and retain the supplied Dynamic Island and Mac bezel details. No replacement or code-drawn device artwork was introduced.
- Copy and content: visible project and format copy remains unchanged. Reel two now uses the supplied vertical video; reel three uses the supplied landscape video inside the Mac mockup.
- Responsiveness and accessibility: desktop and 390px phone checks show no horizontal overflow. Device-specific screen crops remain within their real frame openings. Video labels describe the updated media while the visible copy stays unchanged.
- Interaction and runtime: all three scroll states activate the correct video. Only the active video plays; measured playback advanced in every state. Reel two resolves to `documentar-reel.mp4`, reel three resolves to `mac-be-reel.mp4`, and no browser console or failed-response errors were reported.

## Comparison history

1. The current production capture showed the old phone frame and old video in reel two, while reel three remained a portrait phone presentation.
2. The supplied iPhone frame replaced the old device art, reel two received the optimized supplied vertical video, and reel three received a dedicated Mac device layer with the optimized supplied landscape video.
3. The first responsive pass found a P2 phone-width issue: the Mac display was intentionally oversized but cropped its outer bezel by roughly 29px per side.
4. The phone-width Mac rule was reduced from `115vw` to `98vw`. The final 390 × 844 capture shows the full bezel and stand with no horizontal overflow.
5. The transition capture measured the phone at 0.15 opacity and the Mac at 0.85 opacity during the morph, confirming the devices crossfade, scale, blur, and settle rather than abruptly swapping.

## Focused comparison evidence

- `qa/portfolio-phone-asset-comparison.png` places the supplied transparent iPhone frame beside the implemented video-filled result at matched proportions.
- `qa/portfolio-mac-asset-comparison.png` places the supplied transparent Mac frame beside the implemented landscape video result at matched proportions.

## Primary interactions tested

- Scroll state one: original Social Media reel plays inside the new iPhone frame.
- Scroll state two: supplied vertical video plays inside the new iPhone frame while visible copy remains `Documentar` / `4K`.
- Scroll transition two to three: phone exits and Mac enters with an interpolated transform and opacity transition.
- Scroll state three: supplied landscape video plays inside the Mac frame while existing visible copy remains unchanged.
- Phone layout checked for both the iPhone and Mac states at 390px width.
- Horizontal overflow checked: none.
- Browser console errors and failed media responses checked: none.

## Follow-up polish

- None required for this asset and device transition update.
