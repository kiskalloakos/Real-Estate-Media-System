const STORAGE_KEY = "realty-media-brand-board";

const colorButtons = Array.from(document.querySelectorAll(".color-card"));
const fontButtons = Array.from(document.querySelectorAll(".font-card"));
const root = document.documentElement;

const elements = {
  headerChoice: document.querySelector("#header-choice-text"),
  heroChoice: document.querySelector("#hero-choice-id"),
  heroColor: document.querySelector("#hero-color-name"),
  heroFont: document.querySelector("#hero-font-name"),
  directionColor: document.querySelector("#direction-color"),
  directionFont: document.querySelector("#direction-font"),
  trayColor: document.querySelector("#tray-color"),
  trayFont: document.querySelector("#tray-font"),
  licenseWarning: document.querySelector("#license-warning"),
  copyStatus: document.querySelector("#copy-status"),
  themeColor: document.querySelector('meta[name="theme-color"]'),
};

const state = {
  color: "R1",
  font: "F1",
};

const displayWeights = {
  F1: "300",
  F2: "400",
  F3: "300",
  F4: "400",
  F5: "400",
};

const lightInkColors = new Set(["R3", "R5"]);

function selectedColorButton() {
  return colorButtons.find((button) => button.dataset.choice === state.color) ?? colorButtons[0];
}

function selectedFontButton() {
  return fontButtons.find((button) => button.dataset.choice === state.font) ?? fontButtons[0];
}

function persistState() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // The board remains fully usable when storage is unavailable.
  }
}

function readStoredState() {
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY));
    const colorExists = colorButtons.some((button) => button.dataset.choice === stored?.color);
    const fontExists = fontButtons.some((button) => button.dataset.choice === stored?.font);

    if (colorExists) state.color = stored.color;
    if (fontExists) state.font = stored.font;
  } catch {
    // Invalid or unavailable local state falls back to the suggested direction.
  }
}

function updatePressedState(buttons, selectedChoice) {
  buttons.forEach((button) => {
    const isSelected = button.dataset.choice === selectedChoice;
    button.classList.toggle("is-selected", isSelected);
    button.setAttribute("aria-pressed", String(isSelected));
  });
}

function renderState({ persist = true } = {}) {
  const colorButton = selectedColorButton();
  const fontButton = selectedFontButton();
  const color = colorButton.dataset.color;
  const colorName = colorButton.dataset.name;
  const fontName = fontButton.dataset.name;
  const isLicensed = fontButton.dataset.licensed === "true";

  root.style.setProperty("--accent", color);
  root.style.setProperty("--accent-ink", lightInkColors.has(state.color) ? "#ffffff" : "#090909");
  root.style.setProperty("--font-display", fontButton.dataset.display);
  root.style.setProperty("--font-ui", fontButton.dataset.ui);
  root.style.setProperty("--display-weight", displayWeights[state.font] ?? "400");
  root.dataset.fontLicensed = String(isLicensed);

  updatePressedState(colorButtons, state.color);
  updatePressedState(fontButtons, state.font);

  elements.headerChoice.textContent = `${state.color} × ${state.font}`;
  elements.heroChoice.textContent = `${state.color} / ${state.font}`;
  elements.heroColor.textContent = colorName;
  elements.heroFont.textContent = isLicensed
    ? fontName.split(" + ")[0]
    : "PP Editorial New / not embedded";
  elements.directionColor.textContent = `${colorName} · ${color}`;
  elements.directionFont.textContent = fontName;
  elements.trayColor.textContent = `${colorName} · ${color}`;
  elements.trayFont.textContent = fontName;
  elements.licenseWarning.hidden = isLicensed;

  if (elements.themeColor) elements.themeColor.setAttribute("content", color);
  if (persist) persistState();
}

function chooseColor(button) {
  state.color = button.dataset.choice;
  renderState();
}

function chooseFont(button) {
  state.font = button.dataset.choice;
  renderState();
}

function resetSuggested() {
  state.color = "R1";
  state.font = "F1";
  elements.copyStatus.textContent = "Suggested direction restored.";
  renderState();
}

async function copyDirection() {
  const colorButton = selectedColorButton();
  const fontButton = selectedFontButton();
  const licensingNote = fontButton.dataset.licensed === "true"
    ? "Open-source fonts, self-hosted locally."
    : "PP Editorial New requires commercial web and logo licences; the font is not embedded.";
  const text = [
    "Realty Media — chosen brand direction",
    `Colour: ${state.color} / ${colorButton.dataset.name} / ${colorButton.dataset.color}`,
    `Typography: ${state.font} / ${fontButton.dataset.name}`,
    licensingNote,
  ].join("\n");

  try {
    await navigator.clipboard.writeText(text);
    elements.copyStatus.textContent = "Direction copied to clipboard.";
  } catch {
    const temporaryField = document.createElement("textarea");
    temporaryField.value = text;
    temporaryField.setAttribute("readonly", "");
    temporaryField.style.position = "fixed";
    temporaryField.style.opacity = "0";
    document.body.appendChild(temporaryField);
    temporaryField.select();
    const copied = document.execCommand("copy");
    temporaryField.remove();
    elements.copyStatus.textContent = copied
      ? "Direction copied to clipboard."
      : "Copy unavailable in this browser.";
  }
}

colorButtons.forEach((button) => {
  button.addEventListener("click", () => chooseColor(button));
});

fontButtons.forEach((button) => {
  button.addEventListener("click", () => chooseFont(button));
});

document.querySelector("#hero-reset").addEventListener("click", resetSuggested);
document.querySelector("#direction-reset").addEventListener("click", resetSuggested);
document.querySelector("#copy-choice").addEventListener("click", copyDirection);

readStoredState();
renderState({ persist: false });
