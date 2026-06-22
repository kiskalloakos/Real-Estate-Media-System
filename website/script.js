const menuButton = document.querySelector(".menu-toggle");
const body = document.body;
const menuLinks = document.querySelectorAll(".main-nav a, .nav-cta");
const disabledLinks = document.querySelectorAll("[data-disabled-link]");

disabledLinks.forEach((link) => {
  link.addEventListener("click", (event) => {
    event.preventDefault();
  });
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

const autoplayVideos = document.querySelectorAll(".hero-video, .service-video");
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
