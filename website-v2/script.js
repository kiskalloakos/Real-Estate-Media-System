import Lenis from "./assets/vendor/lenis/lenis.mjs";

const header = document.querySelector("[data-site-header]");
const menuToggle = document.querySelector("[data-menu-toggle]");
const menuLabel = document.querySelector("[data-menu-label]");
const mobileNavigation = document.querySelector("[data-mobile-nav]");
const desktopBreakpoint = window.matchMedia("(min-width: 56.01rem)");
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
let lenis = null;

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

function setMenuState(isOpen, { returnFocus = false } = {}) {
  if (!header || !menuToggle || !mobileNavigation || !menuLabel) return;

  header.dataset.menuOpen = String(isOpen);
  menuToggle.setAttribute("aria-expanded", String(isOpen));
  mobileNavigation.setAttribute("aria-hidden", String(!isOpen));
  mobileNavigation.inert = !isOpen;
  menuLabel.textContent = isOpen ? "ÎNCHIDE" : "MENU";

  if (returnFocus) menuToggle.focus();
}

menuToggle?.addEventListener("click", () => {
  const isOpen = menuToggle.getAttribute("aria-expanded") !== "true";
  setMenuState(isOpen);
});

mobileNavigation?.querySelectorAll("a").forEach((link) => {
  link.addEventListener("click", () => setMenuState(false));
});

document.addEventListener("pointerdown", (event) => {
  if (menuToggle?.getAttribute("aria-expanded") !== "true") return;
  if (header?.contains(event.target)) return;
  setMenuState(false);
});

document.addEventListener("keydown", (event) => {
  if (event.key !== "Escape") return;
  if (menuToggle?.getAttribute("aria-expanded") !== "true") return;
  setMenuState(false, { returnFocus: true });
});

desktopBreakpoint.addEventListener("change", (event) => {
  if (event.matches) setMenuState(false);
  syncSmoothScroll();
});

reducedMotion.addEventListener("change", syncSmoothScroll);

window.addEventListener("pageshow", () => setMenuState(false));
syncSmoothScroll();

const portfolio = document.querySelector("[data-portfolio]");
const portfolioIntro = document.querySelector("[data-portfolio-intro]");
const portfolioIntroVideo = portfolioIntro?.querySelector("[data-portfolio-intro-video]");
const lightHeaderSurfaces = [...document.querySelectorAll('[data-header-theme="light"]')];
const portfolioReelTrack = portfolio?.querySelector("[data-portfolio-reel-track]");
const portfolioReels = portfolio ? [...portfolio.querySelectorAll("[data-portfolio-reel]")] : [];
const portfolioCases = portfolio ? [...portfolio.querySelectorAll("[data-portfolio-case]")] : [];
const portfolioVideos = portfolioReels.map((reel) => reel.querySelector("video")).filter(Boolean);
let activePortfolioIndex = 0;
let portfolioFrame = null;
let portfolioVisible = false;
let portfolioIntroVisible = false;

function syncPortfolioVideoPlayback() {
  portfolioVideos.forEach((video, index) => {
    if (portfolioVisible && index === activePortfolioIndex) {
      const playRequest = video.play();
      playRequest?.catch(() => {});
    } else {
      video.pause();
    }
  });
}

function setActivePortfolioCase(nextIndex) {
  const clampedIndex = Math.max(0, Math.min(portfolioReels.length - 1, nextIndex));

  if (clampedIndex === activePortfolioIndex && portfolioCases.length > 0) return;

  activePortfolioIndex = clampedIndex;
  portfolioCases.forEach((item) => {
    const isActive = Number(item.dataset.caseIndex) === clampedIndex;
    item.classList.toggle("is-active", isActive);
    item.setAttribute("aria-hidden", String(!isActive));
  });

  syncPortfolioVideoPlayback();
}

function updatePortfolio() {
  portfolioFrame = null;
  if (!portfolio || !portfolioReelTrack || portfolioReels.length === 0) return;

  const rect = portfolio.getBoundingClientRect();
  const navHeight = header?.getBoundingClientRect().height || 0;
  const isUnderHeader = rect.top <= navHeight + 2 && rect.bottom > navHeight;
  const isOverIntro = lightHeaderSurfaces.some((surface) => {
    const surfaceRect = surface.getBoundingClientRect();
    return surfaceRect.top <= navHeight + 2 && surfaceRect.bottom > navHeight;
  });
  header?.classList.toggle("is-over-portfolio", isUnderHeader);
  header?.classList.toggle("is-over-portfolio-intro", isOverIntro);

  if (reducedMotion.matches) {
    portfolioReelTrack.style.setProperty("--portfolio-reel-offset", "0%");
    setActivePortfolioCase(0);
    return;
  }

  const scrollDistance = Math.max(1, portfolio.offsetHeight - window.innerHeight);
  const progress = Math.max(0, Math.min(1, -rect.top / scrollDistance));
  const nextIndex = Math.min(
    portfolioReels.length - 1,
    Math.floor(progress * portfolioReels.length),
  );

  portfolioReelTrack.style.setProperty(
    "--portfolio-reel-offset",
    `${Math.min(nextIndex, 1) * -100}%`,
  );
  setActivePortfolioCase(nextIndex);
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

function schedulePortfolioUpdate() {
  if (portfolioFrame !== null) return;
  portfolioFrame = window.requestAnimationFrame(updatePortfolio);
}

if (portfolio && portfolioReels.length > 0) {
  const portfolioObserver = new IntersectionObserver(
    ([entry]) => {
      portfolioVisible = entry.isIntersecting;
      syncPortfolioVideoPlayback();
    },
    { threshold: 0.01 },
  );

  portfolioObserver.observe(portfolio);
  setActivePortfolioCase(0);
  window.addEventListener("scroll", schedulePortfolioUpdate, { passive: true });
  window.addEventListener("resize", schedulePortfolioUpdate, { passive: true });
  reducedMotion.addEventListener("change", schedulePortfolioUpdate);
  schedulePortfolioUpdate();
}

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
          colors: ["#7A1111", "#D62828", "#FF3B3B"],
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
