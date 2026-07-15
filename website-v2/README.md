# Realty Media — website v2

This folder contains the new one-page Realty Media website. The current production website remains separate in `../website` and is not modified by this prototype.

## Locked brand direction

- Brand colour: **R3 / Gallery Carmine / `#D62828`**
- Canvas: `#0A0A0A`
- Primary text: `#F3EFE7`
- Muted text: `#A7A198`
- Display typography and wordmark: **Instrument Serif**
- Navigation and interface typography: **IBM Plex Sans Condensed**

Both font families are open-source and self-hosted in `assets/fonts/`. Their SIL Open Font License notices are stored beside the font files.

## Local preview

The website is served directly from this folder at:

`http://127.0.0.1:4175/`

The existing Python localhost server reads file changes on refresh; no build step or external runtime dependency is required.

## One-page structure

The website has no secondary pages. The sticky navbar exposes the Realty Media wordmark/home link and Contact only:

- `#acasa` — hero/home
- `#contact` — combined contact and footer chapter

The legacy `#servicii` and `#portofoliu` targets remain in the document for direct links, but they are intentionally absent from desktop and mobile navigation. The combined work sequence runs from `Cu ce ne ocupăm` through Fotografie, the pinned two-project phone reel, the light Mac Studio feature, and Web design before reaching Contact.

The active hero headline is: `Doar niște cărămizi daca nu ai storytelling`, followed by the subheadline `Cele mai corecte prețuri pentru cea mai bună calitate`.

Desktop scrolling uses the established [Lenis](https://github.com/darkroomengineering/lenis) `1.3.23` library with a low `0.075` interpolation value for a deliberate, weighty inertial feel. Lenis is self-hosted in `assets/vendor/lenis/`, with its MIT license retained beside the runtime. Sticky-header anchor offsets remain correct. Mobile and reduced-motion users keep native scrolling and immediate reduced-motion anchor behavior. At mobile sizes, the fixed header exposes a compact Contact CTA directly beside the wordmark; no expandable menu is rendered.

## Client logo assets

Logo assets live in:

`assets/images/client-logos/`

The populated slots use:

`transilvania-fashion-white.png`, `elite-city-white.png`, `alpine-car-meet-white.png`, `UBB.png`, `brick depot.png`, `tiff-logo-centered.png`, and `tvr cluj.png`

`logo-08.svg` and `logo-09.svg` remain reserved files for future client artwork but are intentionally excluded from the live marquee so empty slots cannot create a blank interval. SVG is preferred for new logos. Each file should have a transparent background and a tight canvas around the artwork. The marquee displays supplied artwork in monochrome white, constrains every asset inside a fixed contain box, and preserves its aspect ratio; the duplicated animation group remains hidden from assistive technology. TIFF uses a tightly cropped transparent source, while TIFF and Brick Depot are deliberately scaled down inside their unchanged centered slots.

## Motion system

The hero and combined contact/footer use the selected [React Bits Liquid Ether](https://www.reactbits.dev/backgrounds/liquid-ether) background, adapted locally from the published component into a framework-free module at `assets/js/liquid-ether.js`. The complete unmodified source snapshot and its license are retained in `assets/vendor/react-bits-liquid-ether/`. Its Three.js `0.179.1` renderer is also self-hosted in `assets/vendor/three/`, with the Three.js MIT license kept beside it.

The interaction follows the published Liquid Ether demo, with a restrained Realty Media tuning: mouse force `24`, cursor size `104`, simulation step `0.011`, resolution `0.5`, BFECC enabled, and automatic motion at `0.58` speed / `2.45` intensity. The output keeps a quiet low-velocity Carmine afterglow so the liquid field settles more gradually after a gesture without adding a separate trail layer. Only its palette changes to Realty Media's `#7A1111`, `#D62828`, and `#FF3B3B`. Device pixel ratio is capped at `1.5` for stable full-hero performance. No font, animation, or runtime file is requested from an external origin.

At desktop sizes the hero deliberately leaves roughly `9svh` visible for the top of the next section, matching the approved reference composition.

## Services experience

The section immediately after the hero opens with a two-column editorial introduction: `Cu ce ne ocupăm` in Instrument Serif on the left and a large Romanian studio statement on the right. Fotografie follows in the established desktop service layout, now using the same paper-white and Carmine treatment as the Mac chapter, with the supplied property photograph on the right. The phone and Mac chapters then interrupt the service presentation before Web design returns in the same visual setup as a closing bookend. The obsolete Social Media service card and numeric service progress rail are not rendered.

Fotografie, the Mac showcase, and Web design each receive a modest sticky hold after entering the viewport, giving the scroll narrative time to settle without adding hard snap points. At tablet and mobile sizes each service bookend becomes a clear stacked title-and-artboard presentation with a shorter hold. Reduced-motion users receive the same document order without sticky holds, service-title motion, or artboard transitions.

The `Fotografie` artboard uses the optimized `assets/images/services/fotografie.jpg` property photograph. The original 4472px source is preserved outside the site; the 2560px website copy is lazy-loaded and cover-cropped around the central A-frame cabin. No hover effect is applied to the image.

The Web design artboard plays the supplied Mountain View Apuseni website capture only while visible. Its browser-optimized H.264 MP4 and poster live in `assets/videos/services/`; reduced-motion users receive the poster frame without autoplay.

The previously tested Unicorn Studio runtime remains archived in `assets/vendor/unicorn-studio/`, but the page does not reference or load it.

## Portfolio experience

The portfolio begins with the full-height pinned dark chapter where `Conținut care oprește scroll-ul.` sits above two projects scrolling inside the supplied iPhone mockup. Continued page scrolling snaps the phone reel stack to exact full-video positions and updates the Social Media project and view-count metadata on both sides. The first reel shows `5,400` views and the second `26,000`, while their existing descriptive sublines remain unchanged. The device stage is constrained by the remaining viewport height so it stays clear of the heading and metadata. Only the visible active reel plays, and playback pauses when the chapter leaves the viewport.

After the second phone reel, the sequence moves to the brand paper colour `#F3EFE7` with the single italic headline `O experiență.` and the supplied Mac Studio mockup playing the complete landscape reel without CSS cropping. The video surface extends beneath the monitor bezel, allowing the PNG frame to mask its edges cleanly, and the monitor is sized to keep the complete stand and feet visible. The Mac video also pauses when its chapter leaves the viewport.

The supplied `iphone-mockup.png` and `mac-studio-mockup.png` are stored in `assets/images/portfolio/`. The optimized videos and matching posters live in `assets/videos/portfolio/`. Tablet and mobile layouts keep each device centered and move the phone metadata beneath it. Reduced-motion users receive the first phone reel as a static, non-pinned portfolio view with all scroll-driven transforms disabled.

The hero display headline is `145.53px` at the 1470px QA viewport. The fixed navigation has no surface, blur, shadow, or lower rule, and the hero canvas begins at the top of the page so Liquid Ether remains visible beneath it even at scroll position zero. The hero copy retains a navigation-height inset to avoid obscuring its opening line. The desktop Contact CTA is a compact `40.8px` high and keeps its translucent Carmine treatment with a small sparkle icon.

Rendering pauses when the hero leaves the viewport or the browser tab is hidden. The original Liquid Ether touch interaction remains available on touch/coarse-pointer devices. Reduced-motion users and browsers without the required WebGL support receive the intended pure black hero instead.

The Contact sparkle is an official [Phosphor Icons](https://phosphoricons.com/) asset, stored locally at `assets/icons/sparkle.svg`; its MIT license is retained in `assets/licenses/PHOSPHOR-ICONS-LICENSE`.

## Contact and footer

The final chapter merges contact and footer content into one Liquid Ether surface. It contains WhatsApp, Instagram, email, and telephone links, followed by:

`Realty Media is operated by Mint Studios Agency SRL © All Rights Reserved 2026`

On standard phone widths, all four contact links and the legal copy remain centered on one line. Screens narrower than `21rem` stack the contact links vertically and allow the legal copy to wrap so nothing clips.

An oversized `Realty Media` wordmark anchors the bottom edge without a copyright mark.
On desktop, the wordmark spans nearly the full viewport width and sits directly on the lower edge, following the supplied Vivid Motion reference.

## Archived brand board

The complete colour and typography selection board that preceded this direction is preserved at:

`../_references/realty-media-brand-board-2026-07-14/`
