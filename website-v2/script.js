import Lenis from "./assets/vendor/lenis/lenis.mjs";

const header = document.querySelector("[data-site-header]");
const desktopBreakpoint = window.matchMedia("(min-width: 56.01rem)");
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
const solutionsDropdown = document.querySelector("[data-solutions-dropdown]");
const solutionsToggle = document.querySelector("[data-solutions-toggle]");
const mobileMenuToggle = document.querySelector("[data-mobile-menu-toggle]");
const mobileMenu = document.querySelector("[data-mobile-menu]");
const galleryModal = document.querySelector("[data-gallery-modal]");
const galleryOpenButton = document.querySelector("[data-gallery-open]");
const galleryCloseControls = [...document.querySelectorAll("[data-gallery-close]")];
let lenis = null;
let galleryLastFocus = null;

function closeSolutionsDropdown() {
  solutionsDropdown?.classList.remove("is-open");
  solutionsToggle?.setAttribute("aria-expanded", "false");
}

solutionsToggle?.addEventListener("click", () => {
  const isOpen = solutionsDropdown?.classList.toggle("is-open");
  solutionsToggle.setAttribute("aria-expanded", String(Boolean(isOpen)));
});

document.addEventListener("click", (event) => {
  if (!solutionsDropdown?.contains(event.target)) {
    closeSolutionsDropdown();
  }
});

function closeMobileMenu() {
  header?.classList.remove("is-mobile-menu-open");
  mobileMenuToggle?.setAttribute("aria-expanded", "false");
  mobileMenu?.setAttribute("aria-hidden", "true");
}

mobileMenuToggle?.addEventListener("click", () => {
  const isOpen = header?.classList.toggle("is-mobile-menu-open");
  mobileMenuToggle.setAttribute("aria-expanded", String(Boolean(isOpen)));
  mobileMenu?.setAttribute("aria-hidden", String(!isOpen));
});

mobileMenu?.addEventListener("click", (event) => {
  if (event.target instanceof Element && event.target.closest("a")) {
    closeMobileMenu();
  }
});

document.addEventListener("keydown", (event) => {
  if (event.key !== "Escape") return;
  closeSolutionsDropdown();
  closeMobileMenu();
  closeGallery();
});

desktopBreakpoint.addEventListener("change", () => {
  closeMobileMenu();
});

function syncSmoothScroll() {
  const shouldSmooth = desktopBreakpoint.matches && !reducedMotion.matches;

  if (shouldSmooth && !lenis) {
    lenis = new Lenis({
      autoRaf: true,
      smoothWheel: true,
      lerp: 0.075,
      wheelMultiplier: 0.9,
      overscroll: true,
      anchors: true,
    });
    return;
  }

  if (!shouldSmooth && lenis) {
    lenis.destroy();
    lenis = null;
  }
}

desktopBreakpoint.addEventListener("change", syncSmoothScroll);

reducedMotion.addEventListener("change", syncSmoothScroll);

syncSmoothScroll();

function getGalleryFocusable() {
  if (!galleryModal) return [];

  return [
    ...galleryModal.querySelectorAll(
      'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])'
    ),
  ].filter((element) => element instanceof HTMLElement && !element.hasAttribute("hidden"));
}

function openGallery() {
  if (!galleryModal) return;

  galleryLastFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  galleryModal.classList.add("is-open");
  galleryModal.removeAttribute("inert");
  galleryModal.setAttribute("aria-hidden", "false");
  document.documentElement.classList.add("is-gallery-open");
  lenis?.stop?.();

  window.setTimeout(() => {
    getGalleryFocusable()[0]?.focus();
  }, 0);
}

function closeGallery() {
  if (!galleryModal?.classList.contains("is-open")) return;

  galleryModal.classList.remove("is-open");
  galleryModal.setAttribute("aria-hidden", "true");
  galleryModal.setAttribute("inert", "");
  document.documentElement.classList.remove("is-gallery-open");
  lenis?.start?.();
  galleryLastFocus?.focus();
}

galleryOpenButton?.addEventListener("click", openGallery);

galleryCloseControls.forEach((control) => {
  control.addEventListener("click", closeGallery);
});

galleryModal?.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    closeGallery();
    return;
  }

  if (event.key !== "Tab") return;

  const focusable = getGalleryFocusable();
  if (focusable.length === 0) return;

  const firstFocusable = focusable[0];
  const lastFocusable = focusable[focusable.length - 1];

  if (event.shiftKey && document.activeElement === firstFocusable) {
    event.preventDefault();
    lastFocusable.focus();
    return;
  }

  if (!event.shiftKey && document.activeElement === lastFocusable) {
    event.preventDefault();
    firstFocusable.focus();
  }
});

const liquidEtherLayers = [...document.querySelectorAll("[data-liquid-ether]")];

if (liquidEtherLayers.length > 0 && !reducedMotion.matches) {
  import("./assets/js/liquid-ether.js")
    .then(({ initLiquidEther }) => {
      const liquidEtherInstances = liquidEtherLayers.map((layer) => {
        const liquidEther = initLiquidEther({
          container: layer,
          mouseForce: 24,
          cursorSize: 104,
          isViscous: false,
          viscous: 30,
          iterationsViscous: 32,
          iterationsPoisson: 32,
          dt: 0.011,
          BFECC: true,
          resolution: 0.5,
          isBounce: false,
          colors: ["#5256E0"],
          autoDemo: true,
          autoSpeed: 0.58,
          autoIntensity: 2.45,
          takeoverDuration: 0.25,
          autoResumeDelay: 1000,
          autoRampDuration: 0.6
        });

        layer.dataset.liquidEtherState = liquidEther ? "ready" : "disabled";
        return liquidEther;
      });

      document.documentElement.dataset.liquidEther = liquidEtherInstances.some(Boolean)
        ? "ready"
        : "disabled";
    })
    .catch(() => {
      liquidEtherLayers.forEach((layer) => {
        layer.dataset.liquidEtherState = "disabled";
      });
      document.documentElement.dataset.liquidEther = "disabled";
    });
} else if (liquidEtherLayers.length > 0) {
  liquidEtherLayers.forEach((layer) => {
    layer.dataset.liquidEtherState = "disabled";
  });
  document.documentElement.dataset.liquidEther = "disabled";
}
