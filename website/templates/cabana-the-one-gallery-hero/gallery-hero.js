const app = document.querySelector("#app");
const LANGUAGE_STORAGE_KEY = "galleryHeroLanguage";

let activeConfig = null;
let activeLocale = "ro";

const escapeHtml = (value = "") => String(value)
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;")
  .replaceAll("'", "&#039;");

const fallbackUi = {
  ro: {
    loading: "Se incarca galeria...",
    loadErrorTitle: "Template-ul nu a putut fi incarcat.",
    menuOpen: "Deschide meniul",
    navigation: "Navigatie",
    propertyLabel: "Proprietate",
    contactCta: "Contactați-ne",
    heroReviewSuffix: "din 30+ oaspeti fericiti",
    reviewsAria: "Vezi recenziile pe Google Maps",
    propertyHighlights: "Imagini reprezentative ale proprietatii",
    quickDetails: "Detalii rapide despre proprietate",
    galleryImageOpen: "Deschide imaginea",
    galleryCountPrefix: "Vezi toate",
    lightboxLabel: "Galerie foto",
    lightboxClose: "Inchide galeria",
    lightboxPrevious: "Imaginea precedenta",
    lightboxNext: "Imaginea urmatoare",
    lightboxThumbs: "Miniaturi galerie",
    lightboxThumbGoTo: "Mergi la imaginea",
    locationActions: "Navigatie catre proprietate",
    priceAction: "Verifica disponibilitatea",
    languageLabel: "Schimba limba",
    languageName: {
      ro: "Romana",
      en: "Engleza"
    }
  },
  en: {
    loading: "Loading gallery...",
    loadErrorTitle: "The template could not load.",
    menuOpen: "Open menu",
    navigation: "Navigation",
    propertyLabel: "Property",
    contactCta: "Contact us",
    heroReviewSuffix: "from 30+ happy guests",
    reviewsAria: "View reviews on Google Maps",
    propertyHighlights: "Property highlights",
    quickDetails: "Quick property details",
    galleryImageOpen: "Open image",
    galleryCountPrefix: "View all",
    lightboxLabel: "Photo gallery",
    lightboxClose: "Close gallery",
    lightboxPrevious: "Previous image",
    lightboxNext: "Next image",
    lightboxThumbs: "Gallery thumbnails",
    lightboxThumbGoTo: "Go to image",
    locationActions: "Navigation to the property",
    priceAction: "Check availability",
    languageLabel: "Change language",
    languageName: {
      ro: "Romanian",
      en: "English"
    }
  }
};

const fallbackNavItems = {
  ro: [
    ["Galerie", "#gallery"],
    ["Experiențe", "#experiences"],
    ["Preț", "#prices"],
    ["Locație", "#location"]
  ],
  en: [
    ["Gallery", "#gallery"],
    ["Experiences", "#experiences"],
    ["Price", "#prices"],
    ["Location", "#location"]
  ]
};

async function loadConfig() {
  app.innerHTML = `<div class="gh-loading">${escapeHtml(fallbackUi.ro.loading)}</div>`;

  const configUrl = document.body.dataset.propertyConfig || "./property.json";
  const response = await fetch(configUrl, { cache: "no-store" });

  if (!response.ok) {
    throw new Error(`Could not load ${configUrl}`);
  }

  return response.json();
}

function getSupportedLocales(config = {}) {
  const locales = Object.keys(config.locales || {});
  return locales.length ? locales : ["ro", "en"];
}

function normalizeLocale(locale, config = {}) {
  const supportedLocales = getSupportedLocales(config);
  return supportedLocales.includes(locale) ? locale : (config.defaultLocale || supportedLocales[0] || "ro");
}

function getStoredLocale(config = {}) {
  try {
    return normalizeLocale(window.localStorage.getItem(LANGUAGE_STORAGE_KEY), config);
  } catch {
    return normalizeLocale(config.defaultLocale, config);
  }
}

function mergeArrayByIndex(baseItems = [], localizedItems = []) {
  if (!baseItems.length) return localizedItems;

  return baseItems.map((item, index) => ({
    ...item,
    ...(localizedItems[index] || {}),
    image: item.image || localizedItems[index]?.image
      ? {
        ...(item.image || {}),
        ...(localizedItems[index]?.image || {})
      }
      : undefined,
    points: localizedItems[index]?.points || item.points
  }));
}

function mergeImages(baseImages = [], localizedImages = []) {
  if (!baseImages.length) return localizedImages;

  return baseImages.map((image, index) => ({
    ...image,
    ...(localizedImages[index] || {})
  }));
}

function getLocaleConfig(config = {}, locale = "ro") {
  const selectedLocale = normalizeLocale(locale, config);
  const defaultLocale = normalizeLocale(config.defaultLocale, config);
  const defaultContent = config.locales?.[defaultLocale] || {};
  const localizedContent = config.locales?.[selectedLocale] || defaultContent;
  const ui = {
    ...(fallbackUi[selectedLocale] || fallbackUi.ro),
    ...(defaultContent.ui || {}),
    ...(localizedContent.ui || {})
  };

  return {
    ...config,
    ...defaultContent,
    ...localizedContent,
    locale: selectedLocale,
    ui,
    navItems: localizedContent.navItems || defaultContent.navItems || fallbackNavItems[selectedLocale] || fallbackNavItems.ro,
    reviews: {
      ...(config.reviews || {}),
      ...(defaultContent.reviews || {}),
      ...(localizedContent.reviews || {})
    },
    hero: {
      ...(config.hero || {}),
      ...(defaultContent.hero || {}),
      ...(localizedContent.hero || {}),
      images: mergeImages(config.hero?.images || [], localizedContent.hero?.images || defaultContent.hero?.images || [])
    },
    facts: localizedContent.facts || defaultContent.facts || config.facts || [],
    experiences: {
      ...(config.experiences || {}),
      ...(defaultContent.experiences || {}),
      ...(localizedContent.experiences || {}),
      items: mergeArrayByIndex(config.experiences?.items || [], localizedContent.experiences?.items || defaultContent.experiences?.items || [])
    },
    location: {
      ...(config.location || {}),
      ...(defaultContent.location || {}),
      ...(localizedContent.location || {})
    },
    prices: {
      ...(config.prices || {}),
      ...(defaultContent.prices || {}),
      ...(localizedContent.prices || {})
    },
    gallery: {
      ...(config.gallery || {}),
      ...(defaultContent.gallery || {}),
      ...(localizedContent.gallery || {}),
      images: mergeImages(config.gallery?.images || [], localizedContent.gallery?.images || defaultContent.gallery?.images || [])
    }
  };
}

function renderImages(images = []) {
  return images.map((image, index) => `
    <figure class="gh-card gh-card-${index + 1}">
      ${image.mobileSrc ? `
        <picture>
          <source media="(max-width: 640px)" srcset="${escapeHtml(image.mobileSrc)}">
          <img src="${escapeHtml(image.src)}" alt="${escapeHtml(image.alt)}" loading="${index < 3 ? "eager" : "lazy"}">
        </picture>
      ` : `
        <img src="${escapeHtml(image.src)}" alt="${escapeHtml(image.alt)}" loading="${index < 3 ? "eager" : "lazy"}">
      `}
    </figure>
  `).join("");
}

function renderGalleryImages(images = [], ui = fallbackUi.ro) {
  return images.map((image, index) => `
    <button class="gh-gallery-tile" type="button" data-gallery-index="${index}" aria-label="${escapeHtml(ui.galleryImageOpen)} ${index + 1}">
      <img src="${escapeHtml(image.src)}" alt="${escapeHtml(image.alt)}" loading="lazy">
      ${index === 5 ? `<span class="gh-gallery-tile-cta">${escapeHtml(ui.galleryCountPrefix)} ${images.length}</span>` : ""}
    </button>
  `).join("");
}

function renderLanguageSwitcher(config, placement = "desktop") {
  const supportedLocales = getSupportedLocales(activeConfig || config);
  const ui = config.ui || fallbackUi.ro;

  return `
    <div class="gh-language-switcher gh-language-switcher--${escapeHtml(placement)}" role="group" aria-label="${escapeHtml(ui.languageLabel)}">
      <span class="gh-language-icon" aria-hidden="true">
        <svg viewBox="0 0 24 24" focusable="false">
          <circle cx="12" cy="12" r="9"></circle>
          <path d="M3 12h18"></path>
          <path d="M12 3c2.4 2.5 3.6 5.5 3.6 9s-1.2 6.5-3.6 9c-2.4-2.5-3.6-5.5-3.6-9S9.6 5.5 12 3Z"></path>
        </svg>
      </span>
      ${supportedLocales.map((locale) => `
        <button
          class="gh-language-option${locale === config.locale ? " is-active" : ""}"
          type="button"
          data-locale="${escapeHtml(locale)}"
          aria-label="${escapeHtml(ui.languageName?.[locale] || locale.toUpperCase())}"
          aria-pressed="${locale === config.locale ? "true" : "false"}">
          ${escapeHtml(locale.toUpperCase())}
        </button>
      `).join("")}
    </div>
  `;
}

function renderGallerySection(config) {
  const gallery = config.gallery;
  const ui = config.ui;
  if (!gallery?.images?.length) return "";

  return `
    <section class="gh-full-gallery" id="gallery" aria-label="${escapeHtml(gallery.title)}">
      <div class="gh-gallery-heading">
        <p class="gh-kicker">${escapeHtml(gallery.eyebrow)}</p>
        <h2>${escapeHtml(gallery.title)}</h2>
        <p>${escapeHtml(gallery.text)}</p>
      </div>

      <div class="gh-gallery-grid">
        ${renderGalleryImages(gallery.images, ui)}
      </div>
    </section>

    <div class="gh-lightbox" role="dialog" aria-modal="true" aria-label="${escapeHtml(ui.lightboxLabel)}" hidden>
      <button class="gh-lightbox-close" type="button" aria-label="${escapeHtml(ui.lightboxClose)}">
        <span aria-hidden="true">×</span>
      </button>
      <button class="gh-lightbox-nav gh-lightbox-prev" type="button" aria-label="${escapeHtml(ui.lightboxPrevious)}">
        <span aria-hidden="true">‹</span>
      </button>
      <figure class="gh-lightbox-frame">
        <img class="gh-lightbox-image" src="" alt="">
        <figcaption class="gh-lightbox-caption"></figcaption>
      </figure>
      <button class="gh-lightbox-nav gh-lightbox-next" type="button" aria-label="${escapeHtml(ui.lightboxNext)}">
        <span aria-hidden="true">›</span>
      </button>
      <div class="gh-lightbox-thumbs" aria-label="${escapeHtml(ui.lightboxThumbs)}">
        ${gallery.images.map((image, index) => `
          <button class="gh-lightbox-thumb" type="button" data-gallery-thumb="${index}" aria-label="${escapeHtml(ui.lightboxThumbGoTo)} ${index + 1}">
            <img src="${escapeHtml(image.src)}" alt="">
          </button>
        `).join("")}
      </div>
    </div>
  `;
}

function renderExperiencesSection(config) {
  const experiences = config.experiences;
  if (!experiences?.items?.length) return "";

  const renderExperienceMedia = (item) => {
    if (item.images?.length) {
      return `
        <figure class="gh-experience-media gh-experience-media--split">
          ${item.images.map((image) => `
            <img src="${escapeHtml(image.src)}" alt="${escapeHtml(image.alt)}" loading="lazy">
          `).join("")}
        </figure>
      `;
    }

    return `
      <figure class="gh-experience-media">
        <img src="${escapeHtml(item.image.src)}" alt="${escapeHtml(item.image.alt)}" loading="lazy">
      </figure>
    `;
  };

  return `
    <section class="gh-experiences" id="experiences" aria-label="${escapeHtml(experiences.title)}">
      <div class="gh-experiences-heading">
        <p class="gh-kicker">${escapeHtml(experiences.eyebrow)}</p>
        <h2>${escapeHtml(experiences.title)}</h2>
        <p>${escapeHtml(experiences.text)}</p>
      </div>

      <div class="gh-experience-grid">
        ${experiences.items.map((item, index) => `
          <article class="gh-experience-card">
            ${renderExperienceMedia(item)}
            <div class="gh-experience-copy">
              <span class="gh-experience-index">${String(index + 1).padStart(2, "0")}</span>
              <p class="gh-kicker">${escapeHtml(item.eyebrow)}</p>
              <h3>${escapeHtml(item.title)}</h3>
              <p>${escapeHtml(item.text)}</p>
              <ul>
                ${(item.points || []).map((point) => `<li>${escapeHtml(point)}</li>`).join("")}
              </ul>
            </div>
          </article>
        `).join("")}
      </div>
    </section>
  `;
}

function renderLocationSection(config) {
  const location = config.location;
  if (!location) return "";

  return `
    <section class="gh-location" id="location" aria-label="${escapeHtml(location.title)}">
      <div class="gh-location-panel">
        <div class="gh-location-copy">
          <address class="gh-address">
            <span>${escapeHtml(location.addressLabel)}</span>
            <strong>${escapeHtml(location.address)}</strong>
            <small>${escapeHtml(location.coordinates)}</small>
          </address>

          <div class="gh-location-actions" aria-label="${escapeHtml(config.ui.locationActions)}">
            <a class="gh-location-button gh-location-button--maps" href="${escapeHtml(location.googleMapsUrl)}" target="_blank" rel="noopener">
              Google Maps
            </a>
            <a class="gh-location-button gh-location-button--waze" href="${escapeHtml(location.wazeUrl)}" target="_blank" rel="noopener">
              Waze
            </a>
          </div>
        </div>

        <div class="gh-location-map" aria-label="${escapeHtml(location.mapLabel)}">
          <iframe
            title="${escapeHtml(location.mapLabel)}"
            src="${escapeHtml(location.embedUrl)}"
            loading="lazy"
            referrerpolicy="no-referrer-when-downgrade"
            allowfullscreen>
          </iframe>
        </div>
      </div>
    </section>
  `;
}

function renderPricesSection(config) {
  const prices = config.prices;
  const rates = prices?.rates || [];
  const bookingLinks = prices?.bookingLinks || [];
  const visibleNotes = prices.notes || [];
  if (!rates.length && !bookingLinks.length && !visibleNotes.length && !prices?.image) return "";

  return `
    <section class="gh-prices" id="prices" aria-label="${escapeHtml(prices.cardLabel || prices.title || "")}">
      <div class="gh-prices-shell">
        ${prices.image ? `
          <figure class="gh-price-media">
            <img src="${escapeHtml(prices.image.src)}" alt="${escapeHtml(prices.image.alt)}" loading="eager" fetchpriority="low" decoding="async">
          </figure>
        ` : ""}
        <div class="gh-price-card" aria-label="${escapeHtml(prices.cardLabel)}">
          <div class="gh-price-content">
            <div class="gh-price-card-header">
              <div>
                <span>${escapeHtml(prices.propertyType || "")}</span>
                <strong>${escapeHtml(prices.propertyLabel || config.brand || "")}</strong>
              </div>
              ${prices.badge ? `<p class="gh-price-badge">${escapeHtml(prices.badge)}</p>` : ""}
            </div>

            ${rates.length ? `
              <div class="gh-price-rate-grid">
                ${rates.map((rate) => `
                <article class="gh-price-rate">
                  <span>${escapeHtml(rate.label)}</span>
                  <strong>${escapeHtml(rate.amount)}</strong>
                  <small>${escapeHtml(rate.period)}</small>
                </article>
                `).join("")}
              </div>
            ` : ""}

            <ul class="gh-price-notes">
              ${visibleNotes.map((note) => `
                <li>
                  <span class="gh-price-note-icon" aria-hidden="true"></span>
                  <div>
                    <strong>${escapeHtml(note.title)}</strong>
                    <span>${escapeHtml(note.text)}</span>
                  </div>
                </li>
              `).join("")}
            </ul>

            ${prices.footnote ? `<p class="gh-price-footnote">${escapeHtml(prices.footnote)}</p>` : ""}

            <a class="gh-price-action" href="${escapeHtml(prices.primaryUrl || config.whatsappUrl)}" target="_blank" rel="noopener">
              ${escapeHtml(config.ui.priceAction)}
            </a>

            ${bookingLinks.length ? `
              <div class="gh-booking-link-list" aria-label="${escapeHtml(prices.bookingLinksLabel || "Platforme de rezervare")}">
                ${bookingLinks.map((link) => `
                  <a class="gh-booking-link" href="${escapeHtml(link.url)}" target="_blank" rel="noopener">
                    <span>${escapeHtml(link.label)}</span>
                    <strong>${escapeHtml(link.text)}</strong>
                  </a>
                `).join("")}
              </div>
            ` : ""}
          </div>
        </div>
      </div>
    </section>
  `;
}

function renderTitle(title = "") {
  const words = String(title).trim().split(/\s+/);
  if (words.length < 3) return escapeHtml(title);

  return words.map((word) => `<span>${escapeHtml(word)}</span>`).join(" ");
}

function renderReviewBadge(config, className = "", suffix = "") {
  if (!config.reviews) return "";
  const reviewUrl = config.reviews.url || config.googleMapsUrl;

  return `
    <a class="gh-review-badge ${escapeHtml(className)}" href="${escapeHtml(reviewUrl)}" target="_blank" rel="noopener" aria-label="${escapeHtml(config.ui.reviewsAria)}">
      <span class="gh-stars" aria-hidden="true">★★★★★</span>
      <strong>${escapeHtml(config.reviews.rating)}</strong>
      ${suffix ? `<span>${escapeHtml(suffix)}</span>` : ""}
    </a>
  `;
}

function getPageScopedHref(href = "") {
  if (!href.startsWith("#")) return href;

  return `${window.location.pathname}${href}`;
}

function renderFacts(facts = [], config = {}) {
  const factItems = facts.map((fact) => `<li>${escapeHtml(fact)}</li>`);
  const reviewIndex = Math.min(2, factItems.length);

  if (config.reviews) {
    factItems.splice(reviewIndex, 0, `<li class="gh-fact-review">${renderReviewBadge(config, "gh-review-badge--fact")}</li>`);
  }

  return factItems.join("");
}

function bindLanguageSwitcher() {
  document.querySelectorAll("[data-locale]").forEach((button) => {
    button.addEventListener("click", () => {
      const nextLocale = normalizeLocale(button.dataset.locale, activeConfig);
      if (nextLocale === activeLocale) return;

      activeLocale = nextLocale;
      try {
        window.localStorage.setItem(LANGUAGE_STORAGE_KEY, nextLocale);
      } catch {
        // Local storage can be unavailable in strict browsing contexts.
      }
      render(activeConfig, nextLocale);
    });
  });
}

function bindMobileMenu() {
  const menuButton = document.querySelector(".gh-menu-toggle");
  const nav = document.querySelector(".gh-nav");

  if (!menuButton || !nav) return;

  const setMenuOpen = (isOpen) => {
    menuButton.setAttribute("aria-expanded", String(isOpen));
    nav.classList.toggle("is-open", isOpen);
  };

  menuButton.addEventListener("click", () => {
    const isOpen = menuButton.getAttribute("aria-expanded") === "true";
    setMenuOpen(!isOpen);
  });

  nav.addEventListener("click", (event) => {
    if (event.target.closest("a")) setMenuOpen(false);
  });

  document.addEventListener("click", (event) => {
    if (!nav.classList.contains("is-open")) return;
    if (event.target.closest(".gh-nav") || event.target.closest(".gh-menu-toggle")) return;

    setMenuOpen(false);
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") setMenuOpen(false);
  });
}

function bindGallery(config) {
  const images = config.gallery?.images || [];
  const lightbox = document.querySelector(".gh-lightbox");
  const lightboxImage = document.querySelector(".gh-lightbox-image");
  const caption = document.querySelector(".gh-lightbox-caption");
  const closeButton = document.querySelector(".gh-lightbox-close");
  const previousButton = document.querySelector(".gh-lightbox-prev");
  const nextButton = document.querySelector(".gh-lightbox-next");
  const tiles = document.querySelectorAll("[data-gallery-index]");
  const thumbs = document.querySelectorAll("[data-gallery-thumb]");
  let activeIndex = 0;

  if (!images.length || !lightbox || !lightboxImage || !caption) return;

  const setActiveImage = (index) => {
    activeIndex = (index + images.length) % images.length;
    const image = images[activeIndex];

    lightboxImage.src = image.src;
    lightboxImage.alt = image.alt;
    caption.textContent = `${activeIndex + 1} / ${images.length}`;

    thumbs.forEach((thumb, thumbIndex) => {
      thumb.classList.toggle("is-active", thumbIndex === activeIndex);
      thumb.setAttribute("aria-current", thumbIndex === activeIndex ? "true" : "false");
    });

    thumbs[activeIndex]?.scrollIntoView({ block: "nearest", inline: "center" });
  };

  const openGallery = (index) => {
    lightbox.hidden = false;
    document.body.classList.add("has-lightbox");
    setActiveImage(index);
    closeButton?.focus();
  };

  const closeGallery = () => {
    lightbox.hidden = true;
    document.body.classList.remove("has-lightbox");
    tiles[activeIndex]?.focus();
  };

  tiles.forEach((tile) => {
    tile.addEventListener("click", () => openGallery(Number(tile.dataset.galleryIndex || 0)));
  });

  thumbs.forEach((thumb) => {
    thumb.addEventListener("click", () => setActiveImage(Number(thumb.dataset.galleryThumb || 0)));
  });

  previousButton?.addEventListener("click", () => setActiveImage(activeIndex - 1));
  nextButton?.addEventListener("click", () => setActiveImage(activeIndex + 1));
  closeButton?.addEventListener("click", closeGallery);

  lightbox.addEventListener("click", (event) => {
    if (event.target === lightbox) closeGallery();
  });

  document.addEventListener("keydown", (event) => {
    if (lightbox.hidden) return;

    if (event.key === "Escape") closeGallery();
    if (event.key === "ArrowLeft") setActiveImage(activeIndex - 1);
    if (event.key === "ArrowRight") setActiveImage(activeIndex + 1);
  });
}

function render(config, locale = getStoredLocale(config)) {
  activeConfig = config;
  activeLocale = normalizeLocale(locale, config);
  const localeConfig = getLocaleConfig(config, activeLocale);
  const ui = localeConfig.ui;

  document.documentElement.lang = localeConfig.locale;
  document.title = localeConfig.title || localeConfig.hero?.title || "Gallery Hero";

  const metaDescription = document.querySelector('meta[name="description"]');
  if (metaDescription) {
    metaDescription.setAttribute("content", localeConfig.metaDescription || localeConfig.hero?.subhead || "");
  }

  app.innerHTML = `
    <main class="gh-page">
      <header class="gh-header" aria-label="${escapeHtml(ui.propertyLabel)}">
        <div class="gh-header-spacer">
          ${renderLanguageSwitcher(localeConfig, "desktop")}
        </div>
        <button class="gh-menu-toggle" type="button" aria-label="${escapeHtml(ui.menuOpen)}" aria-expanded="false" aria-controls="gh-navigation">
          <span aria-hidden="true"></span>
        </button>
        <nav class="gh-nav" id="gh-navigation" aria-label="${escapeHtml(ui.navigation)}">
          ${localeConfig.navItems.map(([label, href]) => `<a href="${escapeHtml(getPageScopedHref(href))}">${escapeHtml(label)}</a>`).join("")}
          ${renderLanguageSwitcher(localeConfig, "mobile")}
        </nav>
        <a class="gh-reserve-card" href="${escapeHtml(localeConfig.whatsappUrl)}" target="_blank" rel="noopener">
          ${escapeHtml(ui.contactCta)}
        </a>
      </header>

      <section class="gh-hero" id="top" aria-label="${escapeHtml(localeConfig.hero?.title)}">
        <div class="gh-copy">
          ${renderReviewBadge(localeConfig, "gh-review-badge--hero", ui.heroReviewSuffix)}
          <p class="gh-kicker">${escapeHtml(localeConfig.hero?.kicker || "")}</p>
          <h1>${renderTitle(localeConfig.hero?.title)}</h1>
        </div>

        <div class="gh-gallery" aria-label="${escapeHtml(ui.propertyHighlights)}">
          ${renderImages(localeConfig.hero?.images)}
        </div>

        <ul class="gh-facts" aria-label="${escapeHtml(ui.quickDetails)}">
          ${renderFacts(localeConfig.facts, localeConfig)}
        </ul>
      </section>

      ${renderGallerySection(localeConfig)}
      ${renderExperiencesSection(localeConfig)}
      ${renderPricesSection(localeConfig)}
      ${renderLocationSection(localeConfig)}
    </main>
  `;

  window.requestAnimationFrame(() => {
    document.body.classList.add("is-ready");
    bindMobileMenu();
    bindLanguageSwitcher();
    bindGallery(localeConfig);

    if (window.location.hash) {
      document.querySelector(window.location.hash)?.scrollIntoView();
    }
  });
}

loadConfig()
  .then((config) => render(config))
  .catch((error) => {
    const ui = fallbackUi.ro;
    app.innerHTML = `<div class="gh-error"><h1>${escapeHtml(ui.loadErrorTitle)}</h1><p>${escapeHtml(error.message)}</p></div>`;
  });
