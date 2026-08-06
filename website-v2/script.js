import Lenis from "./assets/vendor/lenis/lenis.mjs";

const header = document.querySelector("[data-site-header]");
const desktopBreakpoint = window.matchMedia("(min-width: 56.01rem)");
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
const solutionsDropdown = document.querySelector("[data-solutions-dropdown]");
const solutionsToggle = document.querySelector("[data-solutions-toggle]");
const mobileMenuToggle = document.querySelector("[data-mobile-menu-toggle]");
const mobileMenu = document.querySelector("[data-mobile-menu]");
let lenis = null;

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

const portfolio = document.querySelector("[data-portfolio]");
const portfolioIntro = document.querySelector("[data-portfolio-intro]");
const portfolioIntroVideo = portfolioIntro?.querySelector("[data-portfolio-intro-video]");
const lightHeaderSurfaces = [...document.querySelectorAll('[data-header-theme="light"]')];
const portfolioVideo = portfolio?.querySelector("[data-portfolio-video]");
let headerThemeFrame = null;
let portfolioVisible = false;
let portfolioIntroVisible = false;

function syncPortfolioVideoPlayback() {
  if (!portfolioVideo) return;

  if (portfolioVisible && !reducedMotion.matches) {
    const playRequest = portfolioVideo.play();
    playRequest?.catch(() => {});
  } else {
    portfolioVideo.pause();
  }
}

function updateHeaderTheme() {
  headerThemeFrame = null;
  const navHeight = header?.getBoundingClientRect().height || 0;
  const portfolioRect = portfolio?.getBoundingClientRect();
  const isUnderHeader = Boolean(
    portfolioRect &&
      portfolioRect.top <= navHeight + 2 &&
      portfolioRect.bottom > navHeight,
  );
  const isOverIntro = lightHeaderSurfaces.some((surface) => {
    const surfaceRect = surface.getBoundingClientRect();
    return surfaceRect.top <= -navHeight + 2 && surfaceRect.bottom > navHeight;
  });
  header?.classList.toggle("is-over-portfolio", isUnderHeader);
  header?.classList.toggle("is-over-portfolio-intro", isOverIntro);
}

function syncPortfolioIntroVideoPlayback() {
  if (!portfolioIntroVideo) return;

  if (portfolioIntroVisible && !reducedMotion.matches) {
    const playRequest = portfolioIntroVideo.play();
    playRequest?.catch(() => {});
  } else {
    portfolioIntroVideo.pause();
  }
}

if (portfolioIntroVideo && portfolioIntro) {
  const portfolioIntroObserver = new IntersectionObserver(
    ([entry]) => {
      portfolioIntroVisible = entry.isIntersecting;
      syncPortfolioIntroVideoPlayback();
    },
    { threshold: 0.08 },
  );

  portfolioIntroObserver.observe(portfolioIntro);
  reducedMotion.addEventListener("change", syncPortfolioIntroVideoPlayback);
}

const webDesignVideo = document.querySelector("[data-web-design-video]");
let webDesignVideoVisible = false;

function syncWebDesignVideoPlayback() {
  if (!webDesignVideo) return;

  if (webDesignVideoVisible && !reducedMotion.matches) {
    const playRequest = webDesignVideo.play();
    playRequest?.catch(() => {});
  } else {
    webDesignVideo.pause();
  }
}

if (webDesignVideo) {
  const webDesignVideoObserver = new IntersectionObserver(
    ([entry]) => {
      webDesignVideoVisible = entry.isIntersecting;
      syncWebDesignVideoPlayback();
    },
    { threshold: 0.08 },
  );

  webDesignVideoObserver.observe(webDesignVideo);
  reducedMotion.addEventListener("change", syncWebDesignVideoPlayback);
}

function scheduleHeaderThemeUpdate() {
  if (headerThemeFrame !== null) return;
  headerThemeFrame = window.requestAnimationFrame(updateHeaderTheme);
}

if (portfolio && portfolioVideo) {
  const portfolioObserver = new IntersectionObserver(
    ([entry]) => {
      portfolioVisible = entry.isIntersecting;
      syncPortfolioVideoPlayback();
    },
    { threshold: 0.01 },
  );

  portfolioObserver.observe(portfolio);
  reducedMotion.addEventListener("change", syncPortfolioVideoPlayback);
}

window.addEventListener("scroll", scheduleHeaderThemeUpdate, { passive: true });
window.addEventListener("resize", scheduleHeaderThemeUpdate, { passive: true });
scheduleHeaderThemeUpdate();

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
