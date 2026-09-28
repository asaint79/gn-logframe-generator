# GN Logframe Generator (MVP)

A single static web page that helps build a Good Neighbors project's "Log Frame + M&E Framework"
(Outcome → Output → Activity, with Indicator / Definition / Unit / Baseline / Target / Means of
Verification / Frequency of Data Collection) through a chat with Claude, starting from either a
specific activity idea or a specific donor requirement. Outcome indicators are checked against
GN's own 141-indicator Good Change Framework.

No backend, no build step, no server-side cost. Each user brings their own Anthropic API key,
stored only in their own browser.

## Running locally

Any static file server works, e.g.:

```bash
python3 -m http.server 8765
```

Then open `http://localhost:8765/index.html` in Chrome. On first visit you'll be asked for your
Claude API key (get one at [console.anthropic.com](https://console.anthropic.com)) — it's stored
in `localStorage` in your browser only, and sent directly to `api.anthropic.com` with every chat
message. Don't use this on a shared or public computer.

## How it works

1. Pick a sector. This filters which Good Change Framework indicators are offered as Outcome
   indicator suggestions, and which PPF sheet gets targeted by "Inject into PPF".
2. Describe your starting point — an activity idea, or a specific donor requirement — in the chat.
   Claude figures out which direction to work from and asks whatever follow-up questions it needs.
3. The right-hand table fills in live as Claude extracts structured data. Add as many
   Outcomes/Outputs/Activities as your project needs.
4. Export with any of: **Copy table** (pastes as a real table into Word/Excel/Sheets),
   **Download .xlsx** (a clean standalone workbook), or **Inject into PPF** (writes your logframe
   directly into a bundled copy of the official 2026 draft PPF template, sector sheet and all).
5. Your draft (chat + table) autosaves to `localStorage`, so reloading the page doesn't lose it.
   "New session" clears it and starts over.

## Updating the Good Change Framework indicator pool

When GN publishes an updated Good Change Framework workbook, regenerate `data/gcf_indicators.json`:

```bash
python3 scripts/extract_gcf_indicators.py "/path/to/Good Change Framework_Indicators.xlsx"
```

## Updating the PPF template

Replace `templates/PPF_2026_Draft_Template.xlsx` with the new official file, keeping the same
filename. The "Inject into PPF" export locates the Outcome/Output/Activity rows dynamically by
scanning each sector sheet for GN's own row-numbering (`1`..`5`, `1.1`..`5.3`, `1.1.1`..`5.3.2`),
so it should keep working as long as that numbering convention is unchanged; if GN restructures the
sector sheet layout, re-check `src/export-ppf.js`.

## Known limitations (MVP)

- One session covers one sector at a time.
- "Inject into PPF" only fills the Log Frame + M&E Framework block — Situation Analysis, Problem/
  Objective Tree, Budget Plan, and MLTSP alignment are out of scope and must still be filled in
  manually in the PPF.
- The PPF template has a fixed number of slots (5 Outcomes, 3 Outputs per Outcome, 2 Activities per
  Output); anything beyond that is skipped on export, with a warning shown in the UI.
- Rewriting the `.xlsx` template via SheetJS can occasionally lose non-essential formatting quirks
  on a read/write round trip — always spot-check the exported file before submitting it.
