export function createHud() {
  const scoreNumEl = document.getElementById("score-num");
  const overlayEl  = document.getElementById("overlay");

  let currentScore = null;

  function setGold(value) {
    if (value === currentScore) return;
    currentScore = value;
    scoreNumEl.textContent = String(value);

    // Quick scale-bounce feedback on every point scored
    scoreNumEl.style.transform = "scale(1.22)";
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        scoreNumEl.style.transform = "scale(1)";
      });
    });
  }

  // Height is no longer displayed separately; keep API compat for main.js
  function setHeight() {}

  function showMessage(title, subtitle, action) {
    let html = `<h1>${title}</h1>`;
    if (subtitle) html += `<p>${subtitle}</p>`;
    if (action)   html += `<p class="action">${action}</p>`;
    overlayEl.innerHTML = html;
    overlayEl.classList.add("visible");
  }

  function hideMessage() {
    overlayEl.classList.remove("visible");
  }

  return { setGold, setHeight, showMessage, hideMessage };
}
