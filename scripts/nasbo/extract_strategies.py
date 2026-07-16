"""Extract NASBO 'Strategies Used to Manage Budget' X-grid tables via pdfplumber.

Fall 2025 Table 7  (pdf idx 39-40): FY2026 enacted strategies
Spring 2026 Table 7 (pdf idx 42-43): FY2027 recommended strategies
Each spans two pages with different strategy columns.
"""
import json
import os
import re

import pdfplumber

# source PDFs and extracted JSON intermediates live in raw/
DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "raw")

STATES = [
    "Alabama", "Alaska", "Arizona", "Arkansas", "California", "Colorado",
    "Connecticut", "Delaware", "Florida", "Georgia", "Hawaii", "Idaho",
    "Illinois", "Indiana", "Iowa", "Kansas", "Kentucky", "Louisiana",
    "Maine", "Maryland", "Massachusetts", "Michigan", "Minnesota",
    "Mississippi", "Missouri", "Montana", "Nebraska", "Nevada",
    "New Hampshire", "New Jersey", "New Mexico", "New York",
    "North Carolina", "North Dakota", "Ohio", "Oklahoma", "Oregon",
    "Pennsylvania", "Rhode Island", "South Carolina", "South Dakota",
    "Tennessee", "Texas", "Utah", "Vermont", "Virginia", "Washington",
    "West Virginia", "Wisconsin", "Wyoming",
]

# (anchor_word, strategy_key) — anchor is a distinctive header word whose
# x-center approximates the column center
PAGE_A = [
    ("Across-the-", "acrossBoardCuts"),
    ("Targeted", "targetedCuts"),
    ("Layoffs", "layoffs"),
    ("Furloughs", "furloughs"),
    ("Early", "earlyRetirement"),
    ("Salary", "salaryReductions"),
    ("Benefits", "benefitCuts"),
    ("Eliminating", "hiringFreeze"),
    ("Pension/", "pensionAdjustments"),
]
PAGE_A_SPRING = [
    ("Across-the-", "acrossBoardCuts"),
    ("Targeted", "targetedCuts"),
    ("Layoffs", "layoffs"),
    ("Furloughs", "furloughs"),
    ("Early", "earlyRetirement"),
    ("Salary", "salaryReductions"),
    ("Benefits", "benefitCuts"),
    ("Hiring", "hiringFreeze"),
    ("Eliminate", "eliminateVacancies"),
    ("OPEB", "pensionAdjustments"),
]
PAGE_B = [
    ("Reduce", "reduceLocalAid"),
    ("Reorganize", "reorganizeAgencies"),
    ("Privatization", "privatization"),
    ("Rainy", "rainyDayFund"),
    ("Transfers", "fundTransfers"),
    ("Prior-year", "priorYearBalance"),
    ("Deferred", "deferredPayments"),
    ("Revenue", "revenueIncrease"),
    ("Medicaid", "medicaidChanges"),
    ("Other", "other"),
]


def center(w):
    return (w["x0"] + w["x1"]) / 2


def parse_grid(page, anchors):
    # drop ghost words bled in from the previous page at negative/near-zero x
    words = [w for w in page.extract_words() if w["x0"] > 20]
    # first state row y — header band is everything above it
    state_ys = {}
    for i, w in enumerate(words):
        for st in STATES:
            first = st.split()[0]
            if w["text"] == first or w["text"] == first + "*":
                # confirm multi-word states
                name = st
                if len(st.split()) > 1:
                    nxt = words[i + 1]["text"] if i + 1 < len(words) else ""
                    if not nxt.rstrip("*").startswith(st.split()[1]):
                        continue
                if w["x0"] < 120 and name not in state_ys:  # left column only
                    state_ys[name] = w["top"]
    if not state_ys:
        return None, "no state rows"
    header_bottom = min(state_ys.values()) - 2

    cols = {}
    for anchor, key in anchors:
        cands = [w for w in words if w["top"] < header_bottom
                 and w["text"].strip() == anchor]
        if not cands:
            cands = [w for w in words if w["top"] < header_bottom
                     and w["text"].strip().startswith(anchor)]
        if not cands:
            return None, f"anchor {anchor!r} not found"
        # rightmost occurrence wins (handles 'Other' also matching earlier cols)
        w = max(cands, key=lambda w: w["x0"])
        cols[key] = center(w)

    def nearest(x):
        return min(cols, key=lambda k: abs(cols[k] - x))

    grid = {st: [] for st in STATES}
    for w in words:
        if w["text"].strip() == "X":
            y = w["top"]
            matches = [st for st, sy in state_ys.items() if abs(sy - y) < 4]
            if matches:
                grid[matches[0]].append(nearest(center(w)))

    # validate against TOTAL row
    total_y = None
    for w in words:
        if w["text"].strip() == "TOTAL":
            total_y = w["top"]
            break
    validation = {}
    if total_y is not None:
        for w in words:
            if abs(w["top"] - total_y) < 4 and re.fullmatch(r"\d+", w["text"].strip()):
                validation[nearest(center(w))] = int(w["text"])
    computed = {k: sum(1 for st in STATES for c in grid[st] if c == k) for k in cols}
    mismatches = {k: (computed.get(k, 0), v) for k, v in validation.items()
                  if computed.get(k, 0) != v}
    return grid, {"computed": computed, "reportedTotals": validation,
                  "mismatches": mismatches}


def extract(pdf_path, pages_ab):
    out = {st: [] for st in STATES}
    diags = []
    with pdfplumber.open(pdf_path) as pdf:
        for (idx, anchors) in pages_ab:
            grid, diag = parse_grid(pdf.pages[idx], anchors)
            diags.append((idx, diag))
            if grid:
                for st, keys in grid.items():
                    out[st].extend(keys)
    return out, diags


def main():
    fall, fall_diag = extract(os.path.join(DIR, "fall2025_full.pdf"),
                              [(39, PAGE_A), (40, PAGE_B)])
    spring, spring_diag = extract(os.path.join(DIR, "spring2026_full.pdf"),
                                  [(42, PAGE_A_SPRING), (43, PAGE_B)])
    for label, diags in [("FALL(FY2026 enacted)", fall_diag),
                         ("SPRING(FY2027 recommended)", spring_diag)]:
        print(label)
        for idx, d in diags:
            if isinstance(d, str):
                print("  page", idx, "ERROR:", d)
            else:
                print("  page", idx, "mismatches:", d["mismatches"])
                print("    computed:", d["computed"])
                print("    reported:", d["reportedTotals"])
    with open(os.path.join(DIR, "strategies.json"), "w") as f:
        json.dump({"fy2026_enacted": fall, "fy2027_recommended": spring}, f, indent=1)
    print("sample MD fall:", fall["Maryland"])
    print("sample CA fall:", fall["California"])
    print("Wrote strategies.json")


if __name__ == "__main__":
    main()
