// Renders the live logframe preview table from a logframe-state object.
import { INDICATOR_COLUMNS as COLUMNS } from "./constants.js";

function esc(value) {
  const div = document.createElement("div");
  div.textContent = value ?? "";
  return div.innerHTML;
}

function rowHtml(levelLabel, numberLabel, row, levelClass) {
  const cells = COLUMNS.map(([key]) => `<td>${esc(row[key])}</td>`).join("");
  return `<tr class="${levelClass}"><td class="lf-level">${esc(levelLabel)}</td><td class="lf-no">${esc(numberLabel)}</td>${cells}</tr>`;
}

function activityRowHtml(numberLabel, activity) {
  return `<tr class="lf-row-activity"><td class="lf-level">Activity</td><td class="lf-no">${esc(numberLabel)}</td><td colspan="${COLUMNS.length}">${esc(activity.text)}</td></tr>`;
}

/** Renders `state` (see logframe-state.js) as an HTML table into `container`. */
export function renderLogframe(state, container) {
  if (!state.sector || state.outcomes.length === 0) {
    container.innerHTML = `<p class="lf-empty">The logframe will appear here as you chat with Claude.</p>`;
    return;
  }

  const headerCells = COLUMNS.map(([, label]) => `<th>${esc(label)}</th>`).join("");
  let rows = "";

  state.outcomes.forEach((outcome, oi) => {
    rows += rowHtml("Outcome", String(oi + 1), outcome, "lf-row-outcome");
    outcome.outputs.forEach((output, pi) => {
      rows += rowHtml("Output", `${oi + 1}.${pi + 1}`, output, "lf-row-output");
      output.activities.forEach((activity, ai) => {
        rows += activityRowHtml(`${oi + 1}.${pi + 1}.${ai + 1}`, activity);
      });
    });
  });

  const rationale = state.rationale
    ? `<p class="lf-rationale"><strong>Rationale:</strong> ${esc(state.rationale)}</p>`
    : "";

  container.innerHTML = `
    <div class="lf-meta">
      <span class="lf-sector-badge">${esc(state.sector)}</span>
      ${rationale}
    </div>
    <table class="lf-table">
      <thead><tr><th>Level</th><th>No.</th>${headerCells}</tr></thead>
      <tbody>${rows}</tbody>
    </table>
  `;
}
