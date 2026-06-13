const menuButton = document.querySelector(".menu-toggle");
const body = document.body;
const menuLinks = document.querySelectorAll(".main-nav a, .nav-cta");

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

document.querySelectorAll(".service-video").forEach((video) => {
  const play = () => video.play().catch(() => {});
  video.addEventListener("mouseenter", play);
  video.addEventListener("focus", play);
});

const contactForm = document.querySelector(".contact-form");
if (contactForm) {
  contactForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const note = document.querySelector("[data-form-note]");
    if (note) note.textContent = "Mulțumim. Cererea demo a fost înregistrată local.";
  });
}
