// Standalone .xlsx export, built fresh with SheetJS (loaded globally as `XLSX` via CDN
// script tag in index.html) — independent of the official PPF template.
import { INDICATOR_COLUMNS as COLUMNS } from "./constants.js";
import { buildRows } from "./export-table.js";

export function downloadLogframeXlsx(state) {
  const header = ["Level", "No.", ...COLUMNS.map(([, l]) => l)];
  const aoa = [header];

  for (const r of buildRows(state)) {
    if (r.level === "Activity") {
      aoa.push([r.level, r.no, r.activity ?? ""]);
    } else {
      aoa.push([r.level, r.no, ...COLUMNS.map(([key]) => r.row[key] ?? "")]);
    }
  }

  const sheet = XLSX.utils.aoa_to_sheet(aoa);
  sheet["!cols"] = [{ wch: 10 }, { wch: 8 }, ...COLUMNS.map(() => ({ wch: 24 }))];

  const sheetName = (state.sector || "Logframe").slice(0, 31);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, sheetName);

  const fileName = `Logframe_${(state.sector || "project").replace(/\s+/g, "_")}.xlsx`;
  XLSX.writeFile(workbook, fileName);
}
