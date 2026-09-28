// Clipboard export: copies the logframe as an HTML table (pastes as a real table into
// Word/Excel/Google Docs/Sheets) with a tab-separated plain-text fallback.
import { INDICATOR_COLUMNS as COLUMNS } from "./constants.js";

export function buildRows(state) {
  const rows = [];
  state.outcomes.forEach((outcome, oi) => {
    rows.push({ level: "Outcome", no: String(oi + 1), row: outcome });
    outcome.outputs.forEach((output, pi) => {
      rows.push({ level: "Output", no: `${oi + 1}.${pi + 1}`, row: output });
      output.activities.forEach((activity, ai) => {
        rows.push({ level: "Activity", no: `${oi + 1}.${pi + 1}.${ai + 1}`, activity: activity.text });
      });
    });
  });
  return rows;
}

function toHtml(state) {
  const rows = buildRows(state);
  const header = `<tr><th>Level</th><th>No.</th>${COLUMNS.map(([, l]) => `<th>${l}</th>`).join("")}</tr>`;
  const body = rows
    .map((r) => {
      if (r.level === "Activity") {
        return `<tr><td>${r.level}</td><td>${r.no}</td><td colspan="${COLUMNS.length}">${r.activity ?? ""}</td></tr>`;
      }
      const cells = COLUMNS.map(([key]) => `<td>${r.row[key] ?? ""}</td>`).join("");
      return `<tr><td>${r.level}</td><td>${r.no}</td>${cells}</tr>`;
    })
    .join("");
  return `<table>${header}${body}</table>`;
}

function toTsv(state) {
  const rows = buildRows(state);
  const header = ["Level", "No.", ...COLUMNS.map(([, l]) => l)];
  const lines = [header.join("\t")];
  for (const r of rows) {
    const values =
      r.level === "Activity"
        ? [r.level, r.no, r.activity ?? ""]
        : [r.level, r.no, ...COLUMNS.map(([key]) => (r.row[key] ?? "").replace(/\t|\n/g, " "))];
    lines.push(values.join("\t"));
  }
  return lines.join("\n");
}

/**
 * Copies the logframe table to the clipboard. Must be called from a user-gesture handler.
 * Falls back from the rich HTML clipboard write, to a plain-text write, to selecting the
 * text in a hidden textarea (so the browser's native Ctrl/Cmd+C still works) if the
 * Clipboard API is blocked entirely (e.g. by browser/OS permission policy).
 */
export async function copyLogframeToClipboard(state) {
  const html = toHtml(state);
  const tsv = toTsv(state);

  if (window.ClipboardItem) {
    try {
      const item = new ClipboardItem({
        "text/html": new Blob([html], { type: "text/html" }),
        "text/plain": new Blob([tsv], { type: "text/plain" }),
      });
      await navigator.clipboard.write([item]);
      return;
    } catch {
      // Fall through to the plain-text and manual-selection fallbacks below.
    }
  }

  try {
    await navigator.clipboard.writeText(tsv);
    return;
  } catch {
    // Fall through to manual selection.
  }

  selectTextForManualCopy(tsv);
  throw new Error("Automatic clipboard access is blocked here — the table text is selected, press Ctrl/Cmd+C to copy it.");
}

function selectTextForManualCopy(text) {
  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.style.position = "fixed";
  textarea.style.top = "0";
  textarea.style.left = "0";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.focus();
  textarea.select();
  textarea.addEventListener("blur", () => textarea.remove(), { once: true });
}
