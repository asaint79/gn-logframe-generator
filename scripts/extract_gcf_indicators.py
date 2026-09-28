#!/usr/bin/env python3
"""One-off dev script: converts the Good Change Framework indicator workbook into
data/gcf_indicators.json for the logframe tool. Re-run manually whenever GN
publishes an updated Good Change Framework workbook.

Usage:
    python3 scripts/extract_gcf_indicators.py <path-to-source.xlsx>
"""
import json
import sys
from pathlib import Path

import openpyxl

SECTOR_SHEETS = [
    "Child Protection",
    "Education",
    "Health and Well-being",
    "Economic Empowerment",
    "Climate Change",
    "Humanitarian Assistance",
    "Community Engagement",
]

FIELDS = [
    "sector",
    "indicator",
    "level",
    "outputOrOutcome",
    "definition",
    "methodOfCalculation",
    "methods",
    "notes",
]


def extract(src_path: Path) -> list[dict]:
    wb = openpyxl.load_workbook(src_path, data_only=True)
    indicators = []
    next_id = 1
    for sheet_name in SECTOR_SHEETS:
        ws = wb[sheet_name]
        for row in ws.iter_rows(min_row=4, values_only=True):
            # Column A only holds GN's internal shorthand on a sheet's first data row
            # (e.g. "Health" for "Health and Well-being"); the sheet name is canonical.
            _sector_cell, indicator, level, output_or_outcome, definition, method, methods, notes = row[:8]
            if not indicator:
                continue
            indicators.append(
                {
                    "id": next_id,
                    "sector": sheet_name,
                    "indicator": indicator,
                    "level": level,
                    "outputOrOutcome": output_or_outcome,
                    "definition": definition,
                    "methodOfCalculation": method,
                    "methods": methods,
                    "notes": notes,
                }
            )
            next_id += 1
    return indicators


def main():
    if len(sys.argv) != 2:
        print(__doc__)
        sys.exit(1)
    src_path = Path(sys.argv[1])
    out_path = Path(__file__).resolve().parent.parent / "data" / "gcf_indicators.json"
    indicators = extract(src_path)
    out_path.write_text(json.dumps(indicators, indent=2, ensure_ascii=False), encoding="utf-8")
    print(f"Wrote {len(indicators)} indicators to {out_path}")


if __name__ == "__main__":
    main()
