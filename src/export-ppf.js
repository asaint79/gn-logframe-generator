// Injects the logframe into a copy of the bundled official PPF template (SheetJS, loaded
// globally as `XLSX`). Row positions are discovered dynamically by scanning column A for
// the id strings GN's template already pre-fills ("1".."5" for Outcomes, "1.1".."5.3" for
// Outputs, "1.1.1".."5.3.2" for Activities) rather than hardcoded row numbers, since the
// exact offset differs slightly from sheet to sheet.
import { PPF_SHEET_BY_SECTOR } from "./constants.js";

const TEMPLATE_URL = "templates/PPF_2026_Draft_Template.xlsx";

const OUTCOME_ID_RE = /^\d+$/;
const OUTPUT_ID_RE = /^\d+\.\d+$/;
const ACTIVITY_ID_RE = /^\d+\.\d+\.\d+$/;

// The template has a fixed number of pre-formatted slots per level.
const MAX_OUTCOMES = 5;
const MAX_OUTPUTS_PER_OUTCOME = 3;
const MAX_ACTIVITIES_PER_OUTPUT = 2;

function scanColumnA(sheet, regex) {
  const range = XLSX.utils.decode_range(sheet["!ref"]);
  const map = new Map();
  for (let r = range.s.r; r <= range.e.r; r++) {
    const cell = sheet[XLSX.utils.encode_cell({ r, c: 0 })];
    if (cell && typeof cell.v === "string") {
      const v = cell.v.trim();
      if (regex.test(v)) map.set(v, r + 1); // 1-based row number
    }
  }
  return map;
}

function setCellValue(sheet, addr, value) {
  if (!value) return;
  const existing = sheet[addr];
  if (existing) {
    existing.v = value;
    existing.t = "s";
    delete existing.f;
  } else {
    sheet[addr] = { t: "s", v: value };
  }
}

function writeIndicatorRow(sheet, row, data) {
  setCellValue(sheet, `B${row}`, data.objective);
  setCellValue(sheet, `E${row}`, data.indicator);
  setCellValue(sheet, `G${row}`, data.definition);
  setCellValue(sheet, `I${row}`, data.unit);
  setCellValue(sheet, `J${row}`, data.baseline);
  setCellValue(sheet, `K${row}`, data.target);
  setCellValue(sheet, `L${row}`, data.meansOfVerification);
  setCellValue(sheet, `O${row}`, data.frequency);
}

/**
 * Fills a fresh copy of the bundled PPF template with `state` and triggers a download.
 * Returns a list of warning strings (e.g. items that didn't fit the template's fixed
 * number of slots) so the caller can show them to the user.
 */
export async function downloadPpfWithLogframe(state) {
  const sheetName = PPF_SHEET_BY_SECTOR[state.sector];
  if (!sheetName) throw new Error(`No PPF sheet mapping for sector "${state.sector}".`);

  const res = await fetch(TEMPLATE_URL);
  if (!res.ok) throw new Error(`Could not load the PPF template (${TEMPLATE_URL}).`);
  const buf = await res.arrayBuffer();
  const workbook = XLSX.read(buf, { type: "array", cellStyles: true });

  const sheet = workbook.Sheets[sheetName];
  if (!sheet) throw new Error(`Sheet "${sheetName}" was not found in the PPF template.`);

  const outcomeRows = scanColumnA(sheet, OUTCOME_ID_RE);
  const outputRows = scanColumnA(sheet, OUTPUT_ID_RE);
  const activityRows = scanColumnA(sheet, ACTIVITY_ID_RE);

  const warnings = [];

  state.outcomes.forEach((outcome, oi) => {
    if (oi >= MAX_OUTCOMES) {
      warnings.push(`Outcome ${oi + 1} was skipped — the PPF template only has room for ${MAX_OUTCOMES} Outcomes per sector.`);
      return;
    }
    const row = outcomeRows.get(String(oi + 1));
    if (row) writeIndicatorRow(sheet, row, outcome);

    outcome.outputs.forEach((output, pi) => {
      if (pi >= MAX_OUTPUTS_PER_OUTCOME) {
        warnings.push(`Output ${oi + 1}.${pi + 1} was skipped — the template only has room for ${MAX_OUTPUTS_PER_OUTCOME} Outputs per Outcome.`);
        return;
      }
      const outputRow = outputRows.get(`${oi + 1}.${pi + 1}`);
      if (outputRow) writeIndicatorRow(sheet, outputRow, output);

      output.activities.forEach((activity, ai) => {
        if (ai >= MAX_ACTIVITIES_PER_OUTPUT) {
          warnings.push(`Activity ${oi + 1}.${pi + 1}.${ai + 1} was skipped — the template only has room for ${MAX_ACTIVITIES_PER_OUTPUT} Activities per Output.`);
          return;
        }
        const activityRow = activityRows.get(`${oi + 1}.${pi + 1}.${ai + 1}`);
        if (activityRow) setCellValue(sheet, `B${activityRow}`, activity.text);
      });
    });
  });

  const fileName = `PPF_${(state.sector || "project").replace(/\s+/g, "_")}.xlsx`;
  XLSX.writeFile(workbook, fileName);
  return warnings;
}
