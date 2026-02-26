export function createHud() {
  const goldEl = document.getElementById("gold");
  const heightEl = document.getElementById("height");
  const overlayEl = document.getElementById("overlay");

  const state = {
    gold: null,
    height: null
  };

  function setGold(value) {
    if (value === state.gold) return;
    state.gold = value;
    goldEl.textContent = String(value);
  }

  function setHeight(value) {
    if (value === state.height) return;
    state.height = value;
    heightEl.textContent = String(value);
  }

  function showMessage(title, subtitle) {
    overlayEl.innerHTML = `<h1>${title}</h1><p>${subtitle}</p>`;
    overlayEl.classList.add("visible");
  }

  function hideMessage() {
    overlayEl.classList.remove("visible");
  }

  return {
    setGold,
    setHeight,
    showMessage,
    hideMessage
  };
}
