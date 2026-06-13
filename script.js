const menuButton = document.querySelector(".menu-toggle");
const body = document.body;

if (menuButton) {
  menuButton.addEventListener("click", () => {
    const isOpen = body.classList.toggle("nav-open");
    menuButton.setAttribute("aria-expanded", String(isOpen));
  });
}

document.querySelectorAll(".service-video").forEach((video) => {
  const play = () => video.play().catch(() => {});
  video.addEventListener("mouseenter", play);
  video.addEventListener("focus", play);
});

const parallaxCards = document.querySelectorAll("[data-parallax]");

function updateParallax() {
  if (!parallaxCards.length || window.innerWidth < 901) return;
  const viewport = window.innerHeight;
  parallaxCards.forEach((card, index) => {
    const rect = card.getBoundingClientRect();
    const progress = Math.max(-1, Math.min(1, (rect.top - viewport * 0.18) / viewport));
    const scale = 0.94 + Math.max(0, 1 - Math.abs(progress)) * 0.04;
    const y = progress * -18 + index * 3;
    card.style.transform = `translateY(${y}px) scale(${scale})`;
  });
}

window.addEventListener("scroll", updateParallax, { passive: true });
window.addEventListener("resize", updateParallax);
updateParallax();

const contactForm = document.querySelector(".contact-form");
if (contactForm) {
  contactForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const note = document.querySelector("[data-form-note]");
    if (note) note.textContent = "Mulțumim. Cererea demo a fost înregistrată local.";
  });
}
