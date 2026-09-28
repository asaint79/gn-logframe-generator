export const SECTORS = [
  "Child Protection",
  "Education",
  "Health and Well-being",
  "Economic Empowerment",
  "Climate Change",
  "Humanitarian Assistance",
  "Community Engagement",
];

// Good Change Framework sectors that don't have a dedicated PPF sector sheet —
// these fall back to the "Others" sheet when injecting into the PPF template.
export const PPF_SHEET_BY_SECTOR = {
  "Child Protection": "3. Sector_Child Protection",
  "Education": "3. Sector_Education",
  "Health and Well-being": "3. Sector_Health & Well-being",
  "Economic Empowerment": "3. Sector_Economic Empowerment",
  "Climate Change": "3. Sector_Others",
  "Humanitarian Assistance": "3. Sector_Others",
  "Community Engagement": "3. Sector_Others",
};

// Shared column order for the M&E Framework fields, used by the preview table and every export.
export const INDICATOR_COLUMNS = [
  ["objective", "Objective"],
  ["indicator", "Indicator"],
  ["definition", "Definition"],
  ["unit", "Unit"],
  ["baseline", "Baseline"],
  ["target", "Target"],
  ["meansOfVerification", "Means of Verification"],
  ["frequency", "Frequency of Data Collection"],
];

export const CLAUDE_MODEL = "claude-sonnet-5";
export const ANTHROPIC_VERSION = "2023-06-01";
export const API_KEY_STORAGE_KEY = "gn-logframe:api-key";
export const SESSION_STORAGE_KEY = "gn-logframe:session";
