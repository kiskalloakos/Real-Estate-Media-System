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

const services = document.querySelector("[data-services]");
const serviceSteps = services ? [...services.querySelectorAll("[data-service-step]")] : [];
const serviceTitleStage = services?.querySelector("[data-service-title-stage]");
const serviceProgress = services?.querySelector("[data-service-progress]");
const serviceProgressFill = services?.querySelector("[data-service-progress-fill]");
let activeServiceIndex = 0;
let servicesFrame = null;
let serviceTitleAnimationId = 0;
let serviceTitleCleanupTimer = null;

function formatServiceIndex(index) {
  return String(index + 1).padStart(2, "0");
}

function animateServiceTitle(nextIndex, previousIndex) {
  if (!serviceTitleStage) return;

  const title = serviceSteps[nextIndex]?.dataset.serviceTitle;
  const previousTitle = serviceSteps[previousIndex]?.dataset.serviceTitle;
  if (!title || !previousTitle || title === previousTitle) return;

  serviceTitleAnimationId += 1;
  const animationId = serviceTitleAnimationId;
  if (serviceTitleCleanupTimer !== null) {
    window.clearTimeout(serviceTitleCleanupTimer);
    serviceTitleCleanupTimer = null;
  }

  const createTitleElement = (text, stateClass = "") => {
    const element = document.createElement("span");
    element.className = `services-title-text${stateClass ? ` ${stateClass}` : ""}`;
    element.dataset.serviceTitleText = "";
    element.textContent = text;
    return element;
  };

  if (reducedMotion.matches) {
    serviceTitleStage.replaceChildren(createTitleElement(title));
    return;
  }

  const direction = nextIndex > previousIndex ? "up" : "down";
  const outgoingTitle = createTitleElement(previousTitle, `is-leaving-${direction}`);
  const incomingTitle = createTitleElement(title, `is-entering-${direction}`);
  serviceTitleStage.replaceChildren(outgoingTitle, incomingTitle);

  const settleTitle = () => {
    if (animationId !== serviceTitleAnimationId || !incomingTitle.isConnected) return;

    incomingTitle.className = "services-title-text";
    serviceTitleStage.replaceChildren(incomingTitle);
    if (serviceTitleCleanupTimer !== null) {
      window.clearTimeout(serviceTitleCleanupTimer);
      serviceTitleCleanupTimer = null;
    }
  };

  incomingTitle.addEventListener("animationend", settleTitle, { once: true });
  serviceTitleCleanupTimer = window.setTimeout(settleTitle, 760);
}

function setActiveService(nextIndex) {
  const clampedIndex = Math.max(0, Math.min(serviceSteps.length - 1, nextIndex));
  const previousIndex = activeServiceIndex;

  serviceSteps.forEach((step, index) => {
    step.classList.toggle("is-active", index === clampedIndex);
    step.classList.toggle("is-before", index < clampedIndex);
    step.classList.toggle("is-after", index > clampedIndex);
  });

  if (clampedIndex !== previousIndex) animateServiceTitle(clampedIndex, previousIndex);

  activeServiceIndex = clampedIndex;
  if (serviceProgress) serviceProgress.textContent = formatServiceIndex(clampedIndex);
  if (serviceProgressFill) {
    serviceProgressFill.style.transform = `scaleX(${(clampedIndex + 1) / serviceSteps.length})`;
  }
}

function updateActiveService() {
  servicesFrame = null;
  if (!services || serviceSteps.length === 0 || !desktopBreakpoint.matches) return;

  const activationLine = window.innerHeight * 0.52;
  let nextIndex = 0;

  serviceSteps.forEach((step, index) => {
    if (step.getBoundingClientRect().top <= activationLine) nextIndex = index;
  });

  setActiveService(nextIndex);
}

function scheduleServicesUpdate() {
  if (servicesFrame !== null) return;
  servicesFrame = window.requestAnimationFrame(updateActiveService);
}

if (services && serviceSteps.length > 0) {
  setActiveService(0);
  window.addEventListener("scroll", scheduleServicesUpdate, { passive: true });
  window.addEventListener("resize", scheduleServicesUpdate, { passive: true });
  desktopBreakpoint.addEventListener("change", scheduleServicesUpdate);
  reducedMotion.addEventListener("change", scheduleServicesUpdate);
  scheduleServicesUpdate();
}

const portfolio = document.querySelector("[data-portfolio]");
const portfolioReelTrack = portfolio?.querySelector("[data-portfolio-reel-track]");
const portfolioReels = portfolio ? [...portfolio.querySelectorAll("[data-portfolio-reel]")] : [];
const portfolioCases = portfolio ? [...portfolio.querySelectorAll("[data-portfolio-case]")] : [];
const portfolioVideos = portfolioReels.map((reel) => reel.querySelector("video")).filter(Boolean);
let activePortfolioIndex = 0;
let portfolioFrame = null;
let portfolioVisible = false;

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
  header?.classList.toggle("is-over-portfolio", isUnderHeader);

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

  portfolioReelTrack.style.setProperty("--portfolio-reel-offset", `${nextIndex * -100}%`);
  setActivePortfolioCase(nextIndex);
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
