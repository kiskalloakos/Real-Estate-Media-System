const app = document.querySelector("#app");

const escapeHtml = (value = "") => String(value)
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;")
  .replaceAll("'", "&#039;");

const navItems = [
  ["Galerie", "#top"],
  ["Recenzii", "#reviews"],
  ["Locație", "#top"],
  ["Preț", "#top"],
  ["Contact", "#top"]
];

async function loadConfig() {
  app.innerHTML = '<div class="gh-loading">Loading gallery hero...</div>';

  const configUrl = document.body.dataset.propertyConfig || "./property.json";
  const response = await fetch(configUrl, { cache: "no-store" });

  if (!response.ok) {
    throw new Error(`Could not load ${configUrl}`);
  }

  return response.json();
}

function renderImages(images = []) {
  return images.map((image, index) => `
    <figure class="gh-card gh-card-${index + 1}">
      <img src="${escapeHtml(image.src)}" alt="${escapeHtml(image.alt)}" loading="${index < 3 ? "eager" : "lazy"}">
    </figure>
  `).join("");
}

function renderFacts(facts = []) {
  return facts.map((fact) => `<li>${escapeHtml(fact)}</li>`).join("");
}

function renderTitle(title = "") {
  const words = String(title).trim().split(/\s+/);
  if (words.length < 3) return escapeHtml(title);

  return words.map((word) => `<span>${escapeHtml(word)}</span>`).join(" ");
}

function renderReviewBadge(config) {
  if (!config.reviews) return "";

  return `
    <a class="gh-review-badge" href="${escapeHtml(config.googleMapsUrl)}" target="_blank" rel="noopener" aria-label="Vezi recenziile pe Google Maps">
      <span class="gh-stars" aria-hidden="true">★★★★★</span>
      <strong>${escapeHtml(config.reviews.rating)}</strong>
      <span>${escapeHtml(config.reviews.source)}</span>
    </a>
  `;
}

function renderReviews(config) {
  if (!config.reviews) return "";

  return `
    <section class="gh-reviews" id="reviews" aria-label="Recenzii Google">
      <div class="gh-reviews-copy">
        <p class="gh-kicker">Recenzii</p>
        <h2>${escapeHtml(config.reviews.title)}</h2>
        <p>${escapeHtml(config.reviews.text)}</p>
        <a class="gh-review-link" href="${escapeHtml(config.googleMapsUrl)}" target="_blank" rel="noopener">
          Vezi recenziile pe Google
        </a>
      </div>
      <div class="gh-map-card">
        <iframe
          title="Mountain View Apuseni pe Google Maps"
          src="${escapeHtml(config.googleMapsEmbedUrl)}"
          loading="lazy"
          referrerpolicy="no-referrer-when-downgrade"
          allowfullscreen>
        </iframe>
      </div>
    </section>
  `;
}

function render(config) {
  document.title = config.title || config.hero?.title || "Gallery Hero";

  const metaDescription = document.querySelector('meta[name="description"]');
  if (metaDescription && config.hero?.subhead) {
    metaDescription.setAttribute("content", config.hero.subhead);
  }

  app.innerHTML = `
    <main class="gh-page">
      <header class="gh-header" aria-label="Property">
        <div class="gh-header-spacer" aria-hidden="true"></div>
        <nav class="gh-nav" aria-label="Navigatie">
          ${navItems.map(([label, href]) => `<a href="${href}">${escapeHtml(label)}</a>`).join("")}
        </nav>
        <a class="gh-reserve-card" href="${escapeHtml(config.whatsappUrl)}" target="_blank" rel="noopener">
          Rezerva
        </a>
      </header>

      <section class="gh-hero" id="top" aria-label="${escapeHtml(config.hero?.title)}">
        <div class="gh-copy">
          <p class="gh-kicker">Dealu Negru / Muntii Apuseni</p>
          <h1>${renderTitle(config.hero?.title)}</h1>
          <p>${escapeHtml(config.hero?.subhead)}</p>
          ${renderReviewBadge(config)}
        </div>

        <div class="gh-gallery" aria-label="Property highlights">
          ${renderImages(config.hero?.images)}
        </div>

        <ul class="gh-facts" aria-label="Quick property details">
          ${renderFacts(config.facts)}
        </ul>
      </section>

      ${renderReviews(config)}
    </main>
  `;

  window.requestAnimationFrame(() => {
    document.body.classList.add("is-ready");

    if (window.location.hash) {
      document.querySelector(window.location.hash)?.scrollIntoView();
    }
  });
}

loadConfig()
  .then(render)
  .catch((error) => {
    app.innerHTML = `<div class="gh-error"><h1>Template could not load.</h1><p>${escapeHtml(error.message)}</p></div>`;
  });
