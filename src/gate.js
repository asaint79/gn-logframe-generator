// A lightweight client-side password gate. This deters casual/search-engine access to the
// bundled GN internal files (PPF template, Good Change Framework indicators) once deployed
// publicly — it is NOT real security, since the check runs in the user's own browser and can
// be bypassed by anyone who reads the page source.
import { GATE_PASSWORD_HASH, GATE_UNLOCKED_KEY } from "./constants.js";

async function sha256Hex(text) {
  const bytes = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Resolves once the user has entered the correct password (or already unlocked it earlier
 * this browser session). Shows a full-page overlay in the meantime.
 */
export function waitForUnlock() {
  if (sessionStorage.getItem(GATE_UNLOCKED_KEY) === "1") {
    return Promise.resolve();
  }

  return new Promise((resolve) => {
    const overlay = document.createElement("div");
    overlay.className = "gate-overlay";
    overlay.innerHTML = `
      <form class="gate-card">
        <h2>GN Logframe Generator</h2>
        <p class="hint">Enter the access password shared with your team.</p>
        <input id="gate-password" type="password" autocomplete="off" autofocus />
        <p id="gate-error" class="gate-error hidden">Incorrect password.</p>
        <button type="submit" class="btn btn-primary">Unlock</button>
      </form>
    `;
    document.body.appendChild(overlay);

    const form = overlay.querySelector("form");
    const input = overlay.querySelector("#gate-password");
    const error = overlay.querySelector("#gate-error");

    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const hash = await sha256Hex(input.value);
      if (hash === GATE_PASSWORD_HASH) {
        sessionStorage.setItem(GATE_UNLOCKED_KEY, "1");
        overlay.remove();
        resolve();
      } else {
        error.classList.remove("hidden");
        input.select();
      }
    });
  });
}
