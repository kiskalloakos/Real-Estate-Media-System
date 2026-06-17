const app = document.querySelector("#app");
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
const mobileViewport = window.matchMedia("(max-width: 760px)");

const navItems = [
  ["Galerie", "#gallery"],
  ["Contact", "#contact"]
];

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);
const escapeHtml = (value = "") => String(value)
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;")
  .replaceAll("'", "&#039;");

function propertySlug() {
  const params = new URLSearchParams(window.location.search);
  return params.get("property") || document.body.dataset.property || "mountain-view-apuseni";
}

function resolveImagePath(path = "") {
  if (!path || /^(?:https?:|data:|blob:|\/|\.\/|\.\.\/)/.test(path)) return path;
  if (window.location.pathname.includes("/templates/property/") && path.startsWith("images/")) {
    return `assets/${path}`;
  }
  return path;
}

async function loadProperty() {
  app.innerHTML = '<div class="pt-loading">Loading property template...</div>';

  const slug = propertySlug();
  const configUrl = document.body.dataset.propertyConfig || `../../properties/${slug}/data.json`;
  const response = await fetch(configUrl, { cache: "no-store" });

  if (!response.ok) {
    throw new Error(`Could not load ${configUrl}`);
  }

  return response.json();
}

function renderNav(property) {
  return `
    <header class="pt-nav" aria-label="Main navigation">
      <a class="pt-brand" href="#top" aria-label="${escapeHtml(property.name)} home">${escapeHtml(property.name)}</a>
      <nav class="pt-links" aria-label="Page sections">
        ${navItems.map(([label, href]) => `<a href="${href}">${label}</a>`).join("")}
      </nav>
      <a class="pt-button pt-button-small" href="${escapeHtml(property.whatsapp)}" target="_blank" rel="noopener">Rezerva</a>
    </header>
  `;
}

function renderReviewBadge(property) {
  if (!property.reviews || !property.googleMapsUrl) return "";

  return `
    <a class="pt-review-badge" href="${escapeHtml(property.googleMapsUrl)}" target="_blank" rel="noopener" aria-label="${escapeHtml(property.ui?.reviewsAria || "Vezi recenziile pe Google Maps")}">
      <span class="pt-stars" aria-hidden="true">★★★★★</span>
      <strong>${escapeHtml(property.reviews.rating)}</strong>
      ${property.ui?.heroReviewSuffix ? `<span>${escapeHtml(property.ui.heroReviewSuffix)}</span>` : ""}
    </a>
  `;
}

function renderHero(property) {
  const mobileImage = property.hero.mobileImage || property.hero.image;
  const heroImage = resolveImagePath(property.hero.image);

  return `
    <section class="pt-hero" id="top" aria-label="${escapeHtml(property.name)}">
      <picture>
        <source media="(max-width: 760px)" srcset="${escapeHtml(resolveImagePath(mobileImage))}">
        <img class="pt-hero-image" src="${escapeHtml(heroImage)}" alt="${escapeHtml(property.hero.alt)}">
      </picture>
      <div class="pt-hero-shade"></div>
      <div class="pt-hero-content">
        ${renderReviewBadge(property)}
        <h1>${escapeHtml(property.hero.title)}</h1>
        <p class="pt-hero-text">${escapeHtml(property.hero.text)}</p>
        <div class="pt-hero-actions">
          <a class="pt-button" href="${escapeHtml(property.whatsapp)}" target="_blank" rel="noopener">Rezerva pe WhatsApp</a>
          <a class="pt-text-link" href="#gallery">Vezi galeria</a>
        </div>
      </div>
    </section>
  `;
}

function renderGallery(property) {
  const gallery = property.gallery;

  return `
    <section class="pt-gallery-section" id="gallery" data-horizontal-gallery aria-label="Galerie">
      <div class="pt-gallery-sticky">
        <div class="pt-gallery-heading pt-rail">
          <p class="pt-kicker">${escapeHtml(gallery.kicker)}</p>
          <h2 class="pt-section-title">${escapeHtml(gallery.title)}</h2>
          <p class="pt-section-text">${escapeHtml(gallery.text)}</p>
        </div>
        <div class="pt-gallery-window">
          <div class="pt-gallery-track" data-gallery-track>
            ${gallery.items.map((item, index) => `
              <figure class="pt-gallery-card">
                <button class="pt-gallery-open" type="button" data-gallery-index="${index}" aria-label="Deschide imaginea: ${escapeHtml(item.caption)}">
                  <img src="${escapeHtml(resolveImagePath(item.image))}" alt="${escapeHtml(item.alt)}" loading="lazy">
                </button>
                <figcaption>${escapeHtml(item.caption)}</figcaption>
              </figure>
            `).join("")}
          </div>
        </div>
      </div>
      ${renderLightbox(gallery.items)}
    </section>
  `;
}

function renderLightbox(items = []) {
  return `
    <div class="pt-lightbox" data-lightbox role="dialog" aria-modal="true" aria-label="Galerie foto" hidden>
      <button class="pt-lightbox-close" type="button" data-lightbox-close aria-label="Inchide galeria">×</button>
      <button class="pt-lightbox-arrow pt-lightbox-prev" type="button" data-lightbox-prev aria-label="Imaginea precedenta">‹</button>
      <figure class="pt-lightbox-stage">
        <img data-lightbox-image src="" alt="">
        <figcaption data-lightbox-caption></figcaption>
      </figure>
      <button class="pt-lightbox-arrow pt-lightbox-next" type="button" data-lightbox-next aria-label="Imaginea urmatoare">›</button>
      <div class="pt-lightbox-thumbs" aria-label="Alege imaginea">
        ${items.map((item, index) => `
          <button class="pt-lightbox-thumb" type="button" data-lightbox-thumb="${index}" aria-label="Arata imaginea: ${escapeHtml(item.caption)}">
            <img src="${escapeHtml(resolveImagePath(item.image))}" alt="">
          </button>
        `).join("")}
      </div>
    </div>
  `;
}

function renderDescription(property) {
  return `
    <section class="pt-story pt-rail" aria-label="Descriere">
      <div>
        <p class="pt-kicker">${escapeHtml(property.story.kicker)}</p>
        <h2>${escapeHtml(property.story.title)}</h2>
      </div>
      <div class="pt-story-copy">
        ${property.story.paragraphs.map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`).join("")}
      </div>
    </section>
  `;
}

function renderContact(property) {
  return `
    <section class="pt-final" id="contact" aria-label="Contact">
      <img src="${escapeHtml(resolveImagePath(property.finalCta.image))}" alt="" loading="lazy">
      <div class="pt-rail">
        <h2>${escapeHtml(property.finalCta.title)}</h2>
        <p>${escapeHtml(property.finalCta.text)}</p>
        <div class="pt-hero-actions" style="justify-content: center; margin-top: 34px;">
          <a class="pt-button" href="${escapeHtml(property.whatsapp)}" target="_blank" rel="noopener">Rezerva pe WhatsApp</a>
        </div>
      </div>
    </section>
    <a class="pt-mobile-cta" href="${escapeHtml(property.whatsapp)}" target="_blank" rel="noopener">Rezerva pe WhatsApp</a>
  `;
}

function render(property) {
  document.title = property.title;
  const metaDescription = document.querySelector('meta[name="description"]');
  if (metaDescription) {
    metaDescription.setAttribute("content", property.metaDescription || property.description);
  }

  app.innerHTML = `
    ${renderNav(property)}
    <main>
      ${renderHero(property)}
      ${renderGallery(property)}
      ${renderDescription(property)}
      ${renderContact(property)}
    </main>
  `;

  setupGallery();
  setupLightbox(property.gallery.items);
}

function setupGallery() {
  const gallerySection = document.querySelector("[data-horizontal-gallery]");
  const galleryTrack = document.querySelector("[data-gallery-track]");
  if (!gallerySection || !galleryTrack) return;

  function syncGallery() {
    if (reducedMotion.matches || mobileViewport.matches) {
      gallerySection.style.height = "";
      galleryTrack.style.transform = "";
      return;
    }

    const sidePadding = parseFloat(window.getComputedStyle(galleryTrack).paddingLeft) || 20;
    const maxTranslate = Math.max(0, galleryTrack.scrollWidth - window.innerWidth + sidePadding);
    gallerySection.style.height = `${Math.max(window.innerHeight * 2.4, maxTranslate + window.innerHeight)}px`;

    const sectionTop = gallerySection.offsetTop;
    const scrollable = gallerySection.offsetHeight - window.innerHeight;
    const holdDistance = Math.min(window.innerHeight * 0.55, 520);
    const activeScroll = Math.max(scrollable - holdDistance, 1);
    const progress = scrollable > 0 ? clamp((window.scrollY - sectionTop - holdDistance) / activeScroll, 0, 1) : 0;
    galleryTrack.style.transform = `translate3d(${-maxTranslate * progress}px, 0, 0)`;
  }

  let ticking = false;
  function requestGallerySync() {
    if (ticking) return;
    ticking = true;
    window.requestAnimationFrame(() => {
      syncGallery();
      ticking = false;
    });
  }

  window.addEventListener("scroll", requestGallerySync, { passive: true });
  window.addEventListener("resize", requestGallerySync);
  reducedMotion.addEventListener("change", requestGallerySync);
  mobileViewport.addEventListener("change", requestGallerySync);
  window.addEventListener("load", syncGallery);
  syncGallery();
}

function setupLightbox(items = []) {
  const lightbox = document.querySelector("[data-lightbox]");
  const image = document.querySelector("[data-lightbox-image]");
  const caption = document.querySelector("[data-lightbox-caption]");
  const closeButton = document.querySelector("[data-lightbox-close]");
  const prevButton = document.querySelector("[data-lightbox-prev]");
  const nextButton = document.querySelector("[data-lightbox-next]");
  const openButtons = Array.from(document.querySelectorAll("[data-gallery-index]"));
  const thumbButtons = Array.from(document.querySelectorAll("[data-lightbox-thumb]"));
  if (!lightbox || !image || !caption || !items.length) return;

  let activeIndex = 0;
  let previousFocus = null;

  function show(index) {
    activeIndex = (index + items.length) % items.length;
    const item = items[activeIndex];
    image.src = resolveImagePath(item.image);
    image.alt = item.alt || item.caption || "";
    caption.textContent = item.caption || "";

    thumbButtons.forEach((button, thumbIndex) => {
      const isActive = thumbIndex === activeIndex;
      button.classList.toggle("is-active", isActive);
      button.setAttribute("aria-current", isActive ? "true" : "false");
    });
  }

  function open(index) {
    previousFocus = document.activeElement;
    show(index);
    lightbox.hidden = false;
    document.body.classList.add("is-lightbox-open");
    closeButton?.focus({ preventScroll: true });
  }

  function close() {
    lightbox.hidden = true;
    document.body.classList.remove("is-lightbox-open");
    if (previousFocus && typeof previousFocus.focus === "function") {
      previousFocus.focus({ preventScroll: true });
    }
  }

  openButtons.forEach((button) => {
    button.addEventListener("click", () => open(Number(button.dataset.galleryIndex) || 0));
  });

  thumbButtons.forEach((button) => {
    button.addEventListener("click", () => show(Number(button.dataset.lightboxThumb) || 0));
  });

  closeButton?.addEventListener("click", close);
  prevButton?.addEventListener("click", () => show(activeIndex - 1));
  nextButton?.addEventListener("click", () => show(activeIndex + 1));

  lightbox.addEventListener("click", (event) => {
    if (event.target === lightbox) close();
  });

  window.addEventListener("keydown", (event) => {
    if (lightbox.hidden) return;
    if (event.key === "Escape") close();
    if (event.key === "ArrowLeft") show(activeIndex - 1);
    if (event.key === "ArrowRight") show(activeIndex + 1);
  });
}

loadProperty()
  .then(render)
  .catch((error) => {
    app.innerHTML = `<div class="pt-error"><div><h1>Template could not load.</h1><p>${escapeHtml(error.message)}</p></div></div>`;
  });
