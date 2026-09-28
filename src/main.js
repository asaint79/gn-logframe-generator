import { SECTORS, API_KEY_STORAGE_KEY, SESSION_STORAGE_KEY } from "./constants.js";
import { waitForUnlock } from "./gate.js";
import { createEmptyState, applyUpdate } from "./logframe-state.js";
import { renderLogframe } from "./render.js";
import { buildSystemPrompt, runTurn, loadGcfIndicators } from "./claude.js";
import { copyLogframeToClipboard } from "./export-table.js";
import { downloadLogframeXlsx } from "./export-xlsx.js";
import { downloadPpfWithLogframe } from "./export-ppf.js";

const el = (id) => document.getElementById(id);

const sectorPickerEl = el("sector-picker");
const sectorButtonsEl = el("sector-buttons");
const appMainEl = el("app-main");
const chatLogEl = el("chat-log");
const chatFormEl = el("chat-form");
const chatInputEl = el("chat-input");
const chatSendBtn = el("chat-send-btn");
const previewEl = el("logframe-preview");
const warningsEl = el("export-warnings");

const settingsModal = el("settings-modal");
const apiKeyInput = el("api-key-input");

/** @type {{ sector: string|null, gcfIndicators: any[], logframe: any, messages: any[], chatLog: any[] }} */
let app = {
  sector: null,
  gcfIndicators: [],
  logframe: createEmptyState(),
  messages: [],
  chatLog: [],
};

function saveSession() {
  localStorage.setItem(
    SESSION_STORAGE_KEY,
    JSON.stringify({ sector: app.sector, logframe: app.logframe, messages: app.messages, chatLog: app.chatLog })
  );
}

function clearSession() {
  localStorage.removeItem(SESSION_STORAGE_KEY);
}

function getApiKey() {
  return localStorage.getItem(API_KEY_STORAGE_KEY) || "";
}

function renderAll() {
  renderLogframe(app.logframe, previewEl);
  renderChatLog();
}

function renderChatLog() {
  chatLogEl.innerHTML = app.chatLog
    .map((m) => `<div class="chat-msg ${m.role}">${escapeHtml(m.text)}</div>`)
    .join("");
  chatLogEl.scrollTop = chatLogEl.scrollHeight;
}

function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

function addChatMessage(role, text) {
  app.chatLog.push({ role, text });
  renderChatLog();
}

function showSectorPicker() {
  sectorPickerEl.classList.remove("hidden");
  appMainEl.classList.add("hidden");
}

function showApp() {
  sectorPickerEl.classList.add("hidden");
  appMainEl.classList.remove("hidden");
}

async function startSector(sector) {
  app.sector = sector;
  app.logframe = createEmptyState();
  app.logframe.sector = sector;
  app.messages = [];
  app.chatLog = [];
  try {
    app.gcfIndicators = await loadGcfIndicators(sector);
  } catch (err) {
    app.gcfIndicators = [];
    addChatMessage("error", `Could not load Good Change Framework indicators: ${err.message}`);
  }
  addChatMessage(
    "assistant",
    `Sector set to "${sector}". Describe the activity idea or donor requirement you're starting from, and I'll help you build out the Outcome/Output/Activity logframe.`
  );
  saveSession();
  showApp();
  renderAll();
}

function restoreSession() {
  const raw = localStorage.getItem(SESSION_STORAGE_KEY);
  if (!raw) return false;
  try {
    const saved = JSON.parse(raw);
    if (!saved.sector) return false;
    app = { ...app, ...saved };
    return true;
  } catch {
    return false;
  }
}

async function handleSend(event) {
  event.preventDefault();
  const text = chatInputEl.value.trim();
  if (!text) return;

  const apiKey = getApiKey();
  if (!apiKey) {
    openSettings();
    addChatMessage("error", "Add your Claude API key first (Settings), then send your message again.");
    return;
  }

  chatInputEl.value = "";
  addChatMessage("user", text);
  app.messages.push({ role: "user", content: [{ type: "text", text }] });
  saveSession();

  setSending(true);
  try {
    const systemPrompt = buildSystemPrompt(app.sector, app.gcfIndicators, JSON.stringify(app.logframe, null, 2));
    const { messages, assistantText } = await runTurn({
      apiKey,
      systemPrompt,
      messages: app.messages,
      onToolCall: (input) => {
        const { state, error } = applyUpdate(app.logframe, input);
        if (error) return `Error: ${error}`;
        app.logframe = state;
        renderLogframe(app.logframe, previewEl);
        return "ok";
      },
    });
    app.messages = messages;
    if (assistantText) addChatMessage("assistant", assistantText);
    saveSession();
  } catch (err) {
    addChatMessage("error", err.message);
  } finally {
    setSending(false);
  }
}

function setSending(sending) {
  chatSendBtn.disabled = sending;
  chatInputEl.disabled = sending;
  chatSendBtn.textContent = sending ? "Thinking…" : "Send";
}

function openSettings() {
  apiKeyInput.value = getApiKey();
  settingsModal.classList.remove("hidden");
}

function closeSettings() {
  settingsModal.classList.add("hidden");
}

function showWarnings(warnings) {
  if (!warnings || warnings.length === 0) {
    warningsEl.classList.add("hidden");
    warningsEl.textContent = "";
    return;
  }
  warningsEl.classList.remove("hidden");
  warningsEl.innerHTML = warnings.map((w) => `<div>${escapeHtml(w)}</div>`).join("");
}

function init() {
  SECTORS.forEach((sector) => {
    const btn = document.createElement("button");
    btn.textContent = sector;
    btn.addEventListener("click", () => startSector(sector));
    sectorButtonsEl.appendChild(btn);
  });

  chatFormEl.addEventListener("submit", handleSend);
  chatInputEl.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      chatFormEl.requestSubmit();
    }
  });

  el("new-session-btn").addEventListener("click", () => {
    if (!confirm("Start a new session? This clears the current draft from this browser.")) return;
    clearSession();
    app = { sector: null, gcfIndicators: [], logframe: createEmptyState(), messages: [], chatLog: [] };
    showWarnings([]);
    showSectorPicker();
  });

  el("settings-btn").addEventListener("click", openSettings);
  el("settings-cancel-btn").addEventListener("click", closeSettings);
  el("settings-save-btn").addEventListener("click", () => {
    localStorage.setItem(API_KEY_STORAGE_KEY, apiKeyInput.value.trim());
    closeSettings();
  });

  el("copy-btn").addEventListener("click", async () => {
    try {
      await copyLogframeToClipboard(app.logframe);
      showWarnings(["Copied to clipboard."]);
    } catch (err) {
      showWarnings([`Copy failed: ${err.message}`]);
    }
  });

  el("xlsx-btn").addEventListener("click", () => {
    try {
      downloadLogframeXlsx(app.logframe);
      showWarnings([]);
    } catch (err) {
      showWarnings([`Download failed: ${err.message}`]);
    }
  });

  el("ppf-btn").addEventListener("click", async () => {
    try {
      const warnings = await downloadPpfWithLogframe(app.logframe);
      showWarnings(warnings.length ? warnings : ["Injected into the PPF template."]);
    } catch (err) {
      showWarnings([`PPF export failed: ${err.message}`]);
    }
  });

  if (!getApiKey()) {
    // First-time visitor: prompt for the key up front rather than after their first message.
    setTimeout(openSettings, 300);
  }

  if (restoreSession()) {
    showApp();
    renderAll();
  } else {
    showSectorPicker();
  }
}

waitForUnlock().then(init);
