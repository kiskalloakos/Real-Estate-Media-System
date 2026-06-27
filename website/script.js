const menuButton = document.querySelector(".menu-toggle");
const body = document.body;
const menuLinks = document.querySelectorAll(".main-nav a, .nav-cta");
const disabledLinks = document.querySelectorAll("[data-disabled-link]");
const portfolioToggles = document.querySelectorAll("[data-portfolio-toggle]");
const portfolioModal = document.querySelector("[data-portfolio-modal]");
const portfolioModalFrame = document.querySelector("[data-portfolio-modal-frame]");
const portfolioModalTitle = document.getElementById("portfolio-modal-title");
const portfolioModalCaption = document.querySelector("[data-portfolio-modal-caption]");
const portfolioModalAction = document.querySelector("[data-portfolio-modal-action]");
const portfolioModalThumbs = document.querySelector("[data-portfolio-modal-thumbs]");
const portfolioModalPrev = document.querySelector("[data-portfolio-modal-prev]");
const portfolioModalNext = document.querySelector("[data-portfolio-modal-next]");
const portfolioModalCloseButtons = document.querySelectorAll("[data-portfolio-modal-close]");
const portfolioModalTriggers = document.querySelectorAll("[data-portfolio-modal-trigger]");

const makeImageSlides = (basePath, captions, altPrefix) => Array.from({ length: captions.length }, (_, index) => {
  const number = String(index + 1).padStart(2, "0");
  return {
    type: "image",
    src: `${basePath}-${number}.jpg`,
    alt: `${altPrefix} ${number}`,
    caption: captions[index]
  };
});

const cabanaPhotoCaptions = [
  "Exterior drone picture",
  "Exterior drone picture",
  "Exterior drone picture",
  "Exterior drone picture",
  "Yard",
  "Yard",
  "Yard",
  "Yard",
  "Yard",
  "Exterior drone picture",
  "Exterior drone picture",
  "View",
  "Exterior kitchen",
  "Exterior kitchen",
  "Interior living room",
  "Interior living room",
  "Interior living room",
  "Interior living room",
  "Bathroom",
  "Bedroom",
  "Bathroom 2",
  "Bedroom 2",
  "Corridor",
  "Bathroom",
  "Bathroom",
  "Bedroom",
  "Bedroom",
  "Living room",
  "Sauna",
  "Jacuzzi"
];

const mountainViewPhotoCaptions = [
  "Exterior",
  "Exterior",
  "Exterior",
  "Exterior",
  "Exterior",
  "Exterior",
  "Exterior",
  "Interior",
  "Interior",
  "Interior",
  "Interior",
  "Interior",
  "Interior",
  "Interior",
  "Interior",
  "Interior",
  "Interior"
];

const portfolioModalSets = {
  "cabana-website": {
    title: "Website",
    action: {
      label: "Vezi website-ul live",
      href: "/portofoliu/cabana-the-one/"
    },
    slides: [
      {
        type: "iframe",
        src: "/portofoliu/cabana-the-one/",
        caption: "Cabana The One"
      }
    ]
  },
  "cabana-photos": {
    title: "Fotografii",
    slides: makeImageSlides("properties/cabana-the-one/images/gallery/ordered-gallery/ordered-gallery", cabanaPhotoCaptions, "Cabana The One fotografie")
  },
  "cabana-videos": {
    title: "Video de prezentare",
    slides: [
      {
        type: "video",
        src: "assets/videos/cabana-the-one-website.mp4",
        caption: "Video de prezentare"
      },
      {
        type: "video",
        src: "assets/videos/cabana-the-one-drone-portofoliu.mp4",
        caption: "Cadre dronă"
      }
    ]
  },
  "mountain-website": {
    title: "Website",
    action: {
      label: "Vezi website-ul live",
      href: "/portofoliu/mountain-view-apuseni/"
    },
    slides: [
      {
        type: "iframe",
        src: "/portofoliu/mountain-view-apuseni/",
        caption: "Mountain View Apuseni"
      }
    ]
  },
  "mountain-photos": {
    title: "Fotografii",
    slides: mountainViewPhotoCaptions.map((caption, index) => ({
      type: "image",
      src: `portofoliu/mountain-view-apuseni/assets/gallery/drive-${String(index + 1).padStart(2, "0")}.jpg`,
      alt: `Mountain View Apuseni fotografie ${index + 1}`,
      caption
    }))
  },
  "mountain-videos": {
    title: "Video de prezentare",
    slides: [
      {
        type: "video",
        src: "portofoliu/mountain-view-apuseni/assets/videos/drone-hero.mp4",
        caption: "Video de prezentare"
      }
    ]
  },
  "mountain-social-clips": {
    title: "",
    slides: [
      {
        type: "blank",
        caption: ""
      }
    ]
  }
};

let activePortfolioSet = null;
let activePortfolioIndex = 0;

disabledLinks.forEach((link) => {
  link.addEventListener("click", (event) => {
    event.preventDefault();
  });
});

portfolioToggles.forEach((toggle) => {
  toggle.addEventListener("click", () => {
    const item = toggle.closest(".portfolio-item");
    if (!item) return;

    const isOpen = item.classList.toggle("is-open");
    const reveal = document.getElementById(toggle.getAttribute("aria-controls"));
    toggle.setAttribute("aria-expanded", String(isOpen));
    if (reveal) reveal.setAttribute("aria-hidden", String(!isOpen));
  });
});

const renderPortfolioModal = () => {
  if (!activePortfolioSet || !portfolioModalFrame) return;

  const slide = activePortfolioSet.slides[activePortfolioIndex];
  portfolioModalTitle.textContent = activePortfolioSet.title;
  portfolioModalCaption.textContent = slide.caption || "";
  portfolioModalFrame.innerHTML = "";

  if (portfolioModalAction) {
    const action = activePortfolioSet.action;
    portfolioModalAction.hidden = !action;
    if (action) {
      portfolioModalAction.href = action.href;
      portfolioModalAction.querySelector("span").textContent = action.label;
    }
  }

  if (slide.type === "image") {
    const image = document.createElement("img");
    image.src = slide.src;
    image.alt = slide.alt || "";
    image.addEventListener("click", () => {
      image.classList.toggle("is-zoomed");
    });
    image.addEventListener("mousemove", (event) => {
      if (!image.classList.contains("is-zoomed")) return;
      const rect = image.getBoundingClientRect();
      const x = ((event.clientX - rect.left) / rect.width) * 100;
      const y = ((event.clientY - rect.top) / rect.height) * 100;
      image.style.transformOrigin = `${x}% ${y}%`;
    });
    portfolioModalFrame.append(image);
  }

  if (slide.type === "video") {
    const video = document.createElement("video");
    video.src = slide.src;
    video.controls = true;
    video.autoplay = true;
    video.muted = true;
    video.playsInline = true;
    video.setAttribute("playsinline", "");
    portfolioModalFrame.append(video);
    playVideo(video);
  }

  if (slide.type === "iframe") {
    const iframe = document.createElement("iframe");
    iframe.src = slide.src;
    iframe.title = slide.caption || activePortfolioSet.title;
    iframe.loading = "eager";
    portfolioModalFrame.append(iframe);
  }

  if (slide.type === "note") {
    const note = document.createElement("div");
    note.className = "portfolio-modal-note";
    const handle = document.createElement("strong");
    handle.textContent = slide.caption || activePortfolioSet.title;
    const copy = document.createElement("span");
    copy.textContent = slide.body || "";
    note.append(handle, copy);
    portfolioModalFrame.append(note);
  }

  const hasMultipleSlides = activePortfolioSet.slides.length > 1;
  portfolioModalPrev.hidden = !hasMultipleSlides;
  portfolioModalNext.hidden = !hasMultipleSlides;
  portfolioModalThumbs.hidden = !hasMultipleSlides;
  portfolioModalThumbs.innerHTML = "";

  if (hasMultipleSlides) {
    activePortfolioSet.slides.forEach((thumbSlide, index) => {
      const thumb = document.createElement("button");
      thumb.className = "portfolio-modal-thumb";
      thumb.type = "button";
      thumb.setAttribute("aria-label", `Deschide ${index + 1}`);
      if (index === activePortfolioIndex) thumb.classList.add("is-active");

      if (thumbSlide.type === "image") {
        const thumbImage = document.createElement("img");
        thumbImage.src = thumbSlide.src;
        thumbImage.alt = "";
        thumb.append(thumbImage);
      } else if (thumbSlide.type === "video") {
        thumb.textContent = String(index + 1);
      }

      thumb.addEventListener("click", () => {
        activePortfolioIndex = index;
        renderPortfolioModal();
      });
      portfolioModalThumbs.append(thumb);
    });
  }
};

const openPortfolioModal = (setKey) => {
  activePortfolioSet = portfolioModalSets[setKey];
  if (!portfolioModal || !activePortfolioSet) return;

  activePortfolioIndex = 0;
  portfolioModal.hidden = false;
  portfolioModal.setAttribute("aria-hidden", "false");
  body.classList.add("portfolio-modal-open");
  renderPortfolioModal();
};

const closePortfolioModal = () => {
  if (!portfolioModal) return;

  portfolioModalFrame?.querySelectorAll("video").forEach((video) => video.pause());
  portfolioModal.hidden = true;
  portfolioModal.setAttribute("aria-hidden", "true");
  body.classList.remove("portfolio-modal-open");
  activePortfolioSet = null;
  activePortfolioIndex = 0;
};

portfolioModalTriggers.forEach((trigger) => {
  trigger.addEventListener("click", () => {
    openPortfolioModal(trigger.dataset.portfolioModalTrigger);
  });
});

portfolioModalCloseButtons.forEach((button) => {
  button.addEventListener("click", closePortfolioModal);
});

portfolioModalPrev?.addEventListener("click", () => {
  if (!activePortfolioSet) return;
  activePortfolioIndex = (activePortfolioIndex - 1 + activePortfolioSet.slides.length) % activePortfolioSet.slides.length;
  renderPortfolioModal();
});

portfolioModalNext?.addEventListener("click", () => {
  if (!activePortfolioSet) return;
  activePortfolioIndex = (activePortfolioIndex + 1) % activePortfolioSet.slides.length;
  renderPortfolioModal();
});

document.addEventListener("keydown", (event) => {
  if (!activePortfolioSet) return;
  if (event.key === "Escape") closePortfolioModal();
  if (event.key === "ArrowLeft") portfolioModalPrev?.click();
  if (event.key === "ArrowRight") portfolioModalNext?.click();
});

if (menuButton) {
  menuButton.addEventListener("click", () => {
    const isOpen = body.classList.toggle("nav-open");
    menuButton.setAttribute("aria-expanded", String(isOpen));
    menuButton.textContent = isOpen ? "Închide" : "Meniu";
  });

  menuLinks.forEach((link) => {
    link.addEventListener("click", () => {
      body.classList.remove("nav-open");
      menuButton.setAttribute("aria-expanded", "false");
      menuButton.textContent = "Meniu";
    });
  });

  document.addEventListener("click", (event) => {
    if (!body.classList.contains("nav-open")) return;
    const header = document.querySelector("[data-header]");
    if (header && !header.contains(event.target)) {
      body.classList.remove("nav-open");
      menuButton.setAttribute("aria-expanded", "false");
      menuButton.textContent = "Meniu";
    }
  });
}

const autoplayVideos = document.querySelectorAll(".hero-video, .service-video, .property-card video");
const playVideo = (video) => video.play().catch(() => {});
const playAutoplayVideos = () => {
  autoplayVideos.forEach(playVideo);
};

autoplayVideos.forEach((video) => {
  video.muted = true;
  video.defaultMuted = true;
  video.playsInline = true;
  video.setAttribute("playsinline", "");
  video.setAttribute("webkit-playsinline", "");
  if (video.readyState === 0) video.load();

  video.addEventListener("mouseenter", playAutoplayVideos);
  video.addEventListener("focus", playAutoplayVideos);
  video.addEventListener("touchstart", playAutoplayVideos, { passive: true });
  video.addEventListener("loadeddata", () => playVideo(video));
  video.addEventListener("canplay", () => playVideo(video));
});

if ("IntersectionObserver" in window) {
  const videoObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) playVideo(entry.target);
    });
  }, { threshold: 0.2 });

  autoplayVideos.forEach((video) => videoObserver.observe(video));
}

playAutoplayVideos();
document.addEventListener("visibilitychange", () => {
  if (!document.hidden) playAutoplayVideos();
});
document.addEventListener("pointerdown", playAutoplayVideos, { once: true });
