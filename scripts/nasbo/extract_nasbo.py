"""Extract NASBO Fiscal Survey + State Expenditure Report tables to JSON.

Sources (downloaded 2026-07-16):
  fall2025_full.pdf   - NASBO Fall 2025 Fiscal Survey of States (full report)
  spring2026_full.pdf - NASBO Spring 2026 Fiscal Survey of States (full report)
  ser2025.pdf         - NASBO 2025 State Expenditure Report (FY2023-2025)
"""
import json
import os
import re

from pypdf import PdfReader

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
EXTRAS = ["District of Columbia", "Guam", "Puerto Rico", "U.S. Virgin Islands"]
ALL_JURIS = STATES + EXTRAS

NUM = r"(-?[\d,]+(?:\.\d+)?|N/A|NA|-{2,})"


def parse_num(tok):
    tok = tok.replace(",", "").replace("$", "").replace("%", "").strip()
    if tok in ("N/A", "NA", "") or set(tok) == {"-"}:
        return None
    try:
        v = float(tok)
        return int(v) if v == int(v) and "." not in tok else v
    except ValueError:
        return None


def page_text(reader, i):
    return reader.pages[i].extract_text() or ""


def find_page(reader, marker, start=0, end=None):
    end = end or len(reader.pages)
    for i in range(start, end):
        if marker in page_text(reader, i):
            return i
    return None


def state_rows(text, after_marker=None):
    """Yield (state, rest_of_line) for lines starting with a known jurisdiction.

    If a state matches multiple lines (e.g. it is named in a notes paragraph),
    keep the line with the most numeric tokens. after_marker restricts parsing
    to text following that substring (for pages holding two stacked tables).
    """
    if after_marker and after_marker in text:
        text = text.split(after_marker, 1)[1]
    best = {}
    for line in text.split("\n"):
        s = line.strip()
        for st in ALL_JURIS:
            # avoid "New Hampshire" matching before "New Hampshire*" etc. and
            # "Virginia" matching inside "West Virginia" (startswith on full name)
            if re.match(re.escape(st) + r"\*{0,4}(\s|$)", s):
                rest = s[len(st):].lstrip("* ").strip()
                n = len(re.findall(NUM, rest))
                if st not in best or n > best[st][0]:
                    best[st] = (n, rest)
                break
    for st, (_, rest) in best.items():
        yield st, rest


def parse_gf_table(text, has_date=False):
    """Fiscal Survey Tables 1-3: 8 numeric cols; col 5 (idx 4) = Expenditures."""
    out = {}
    for st, rest in state_rows(text):
        rest = rest.replace("$", "")
        if has_date:
            rest = re.sub(r"[A-Z][a-z]{2}\S{0,3}\d{2}\s*$", "", rest).strip()
        toks = re.findall(NUM, rest)
        if len(toks) >= 7:
            nums = [parse_num(t) for t in toks]
            out[st] = {
                "revenues": nums[1],
                "expenditures": nums[4],
                "endingBalance": nums[6],
                "rainyDayFund": nums[7] if len(nums) > 7 else None,
            }
    return out


def parse_pct_table(text, ncols, after_marker=None):
    """Percent-change tables: state + ncols floats."""
    out = {}
    for st, rest in state_rows(text, after_marker=after_marker):
        toks = re.findall(NUM, rest.replace("%", " "))
        if len(toks) >= ncols:
            out[st] = [parse_num(t) for t in toks[:ncols]]
        elif toks and st == "Virginia":  # FY2027 N/A (no proposed budget)
            out[st] = [parse_num(t) for t in toks] + [None] * (ncols - len(toks))
    return out


def parse_midyear_table(text):
    """Fiscal Survey Table 5: net mid-year $ change (millions) + shortfall flag."""
    out = {}
    for st, rest in state_rows(text):
        m = re.match(r"\$?(-?[\d,]+(?:\.\d+)?)\s*(Yes|No)?", rest)
        if m and m.group(1):
            out[st] = {
                "netChange": parse_num(m.group(1)),
                "revenueShortfall": m.group(2) or None,
            }
        elif rest.startswith("N/A") or rest == "":
            out[st] = {"netChange": None, "revenueShortfall": None}
    return out


def parse_ser_dollar_table(text, cols=("gf", "ff", "of", "bonds", "total")):
    """SER $ tables: 3 years x fund-source columns (Medicaid has no bonds col)."""
    n = len(cols)
    out = {}
    for st, rest in state_rows(text):
        toks = re.findall(NUM, rest.replace("$", ""))
        if len(toks) >= 3 * n:
            nums = [parse_num(t) for t in toks[: 3 * n]]
            out[st] = {
                "fy2023": dict(zip(cols, nums[0:n])),
                "fy2024": dict(zip(cols, nums[n : 2 * n])),
                "fy2025": dict(zip(cols, nums[2 * n : 3 * n])),
            }
    return out


def parse_ser_pct_table(text):
    """SER % tables: 6 cols = FY24 (GF, FF, Total), FY25 (GF, FF, Total)."""
    out = {}
    for st, rest in state_rows(text):
        toks = re.findall(NUM, rest.replace("%", " "))
        if len(toks) >= 6:
            n = [parse_num(t) for t in toks[:6]]
            out[st] = {
                "fy2024": {"gf": n[0], "ff": n[1], "total": n[2]},
                "fy2025": {"gf": n[3], "ff": n[4], "total": n[5]},
            }
    return out


def extract_fiscal_survey():
    result = {}

    fall = PdfReader(os.path.join(DIR, "fall2025_full.pdf"))
    spring = PdfReader(os.path.join(DIR, "spring2026_full.pdf"))

    # --- Fall 2025: pdf pages 33-36 (printed 26-29) = Tables 1-4
    result["fy2024_actual"] = parse_gf_table(page_text(fall, 32))
    result["fy2025_prelim"] = parse_gf_table(page_text(fall, 33))
    result["fy2026_enacted"] = parse_gf_table(page_text(fall, 34), has_date=True)
    result["gf_pct_change_fall"] = {  # FY24, FY25, FY26 nominal % change
        st: dict(zip(["fy2024", "fy2025", "fy2026"], v))
        for st, v in parse_pct_table(page_text(fall, 35), 3).items()
    }

    # --- Spring 2026: locate tables by title
    p1 = find_page(spring, "Fiscal 2025 State General Fund, Actual", 28)
    p2 = find_page(spring, "Fiscal 2026 State General Fund, Estimated", 28)
    p3 = find_page(spring, "Fiscal 2027 State General Fund, Recommended", 28)
    p4 = find_page(spring, "General Fund Expenditure Nominal Percentage Changes", 28)
    p5 = find_page(spring, "For Decreases Only", 28)
    result["_spring_pages"] = [p1, p2, p3, p4, p5]
    result["fy2025_actual"] = parse_gf_table(page_text(spring, p1))
    result["fy2026_estimated"] = parse_gf_table(page_text(spring, p2))
    result["fy2027_recommended"] = parse_gf_table(page_text(spring, p3), has_date=True)
    result["gf_pct_change_spring"] = {  # FY25, FY26, FY27 nominal % change
        st: dict(zip(["fy2025", "fy2026", "fy2027"], v))
        for st, v in parse_pct_table(page_text(spring, p4), 3, after_marker="TABLE 4").items()
    }
    # Table 5: FY2026 mid-year / post-enacted spending actions ($M net change),
    # spans two pages
    mid = parse_midyear_table(page_text(spring, p5).split("TABLE 4")[0])
    if p5 is not None:
        mid.update(parse_midyear_table(page_text(spring, p5 + 1).split("TABLE")[0]))
    result["fy2026_midyear_actions"] = mid
    return result


SER_FUNCTIONS = [
    ("Elementary and Secondary Education", "k12"),
    ("Higher Education", "higherEd"),
    ("Medicaid", "medicaid"),
    ("Corrections", "corrections"),
    ("Transportation", "transportation"),
    ("All Other", "allOther"),
    ("Capital", "capital"),
]


def extract_ser():
    ser = PdfReader(os.path.join(DIR, "ser2025.pdf"))
    # index all TABLE N pages with their titles
    tables = {}  # num -> (page, title)
    for i in range(len(ser.pages)):
        t = page_text(ser, i)
        m = re.search(r"TABLE (\d+)\s*(?:\(CONTINUED\))?\s*\n([^\n]*)", t)
        if m and not m.group(0).find("CONTINUED") > -1:
            tables[int(m.group(1))] = (i, m.group(2).strip())

    out = {"functions": {}, "_tables": {k: v[1] for k, v in sorted(tables.items())}}

    # Total state expenditures
    out["total"] = {
        "dollars": parse_ser_dollar_table(page_text(ser, tables[1][0])),
    }

    # Table 4: spending mix by function, FY2025 (% of total state expenditures).
    # Column order: K-12, Higher Ed, Medicaid, Corrections, Transportation, All Other, Total
    mix = {}
    for st, rest in state_rows(page_text(ser, tables[4][0])):
        toks = re.findall(NUM, rest.replace("%", " "))
        if len(toks) >= 7:
            n = [parse_num(t) for t in toks[:6]]
            mix[st] = dict(zip(
                ["k12", "higherEd", "medicaid", "corrections", "transportation", "allOther"], n))
    out["mix"] = mix

    # Table 29: debt service ($M), 3 years x (GF, Other, Total) — keep FY2025 (last triple)
    debt = {}
    for st, rest in state_rows(page_text(ser, tables[29][0])):
        toks = [parse_num(t) for t in re.findall(NUM, rest.replace("$", ""))]
        if len(toks) >= 3:
            debt[st] = dict(zip(["gf", "of", "total"], toks[-3:]))
    out["debtService"] = debt

    # Tables 33-39: capital expenditures by program area (standard 15-col layout)
    CAP_TABLES = {
        33: "k12", 34: "higherEd", 35: "corrections", 36: "transportation",
        37: "housing", 38: "environment", 39: "allOther",
    }
    cap = {}
    for num, key in CAP_TABLES.items():
        if num in tables:
            cap[key] = parse_ser_dollar_table(page_text(ser, tables[num][0]))
    out["capitalByProgram"] = cap

    # explicit table numbers per function: (dollars, pct, dollar cols)
    FIVE = ("gf", "ff", "of", "bonds", "total")
    FOUR = ("gf", "ff", "of", "total")  # Medicaid table has no bonds column
    mapping = {
        "k12": (5, 7, FIVE),
        "higherEd": (9, 11, FIVE),
        "medicaid": (13, 15, FOUR),
        "corrections": (16, 19, FIVE),
        "transportation": (21, 23, FIVE),
        "allOther": (26, 28, FIVE),
        "capital": (32, None, FIVE),  # no pct table; computed from dollars
    }
    for key, (dnum, pnum, cols) in mapping.items():
        entry = {}
        if dnum in tables:
            entry["dollars"] = parse_ser_dollar_table(page_text(ser, tables[dnum][0]), cols=cols)
        if pnum and pnum in tables:
            entry["pctChange"] = parse_ser_pct_table(page_text(ser, tables[pnum][0]))
        elif "dollars" in entry:  # derive pct from dollar levels
            pct = {}
            for st, yrs in entry["dollars"].items():
                def chg(a, b):
                    return round((b - a) / a * 100, 1) if a else None
                pct[st] = {
                    "fy2024": {"gf": chg(yrs["fy2023"]["gf"], yrs["fy2024"]["gf"]),
                               "ff": chg(yrs["fy2023"]["ff"], yrs["fy2024"]["ff"]),
                               "total": chg(yrs["fy2023"]["total"], yrs["fy2024"]["total"])},
                    "fy2025": {"gf": chg(yrs["fy2024"]["gf"], yrs["fy2025"]["gf"]),
                               "ff": chg(yrs["fy2024"]["ff"], yrs["fy2025"]["ff"]),
                               "total": chg(yrs["fy2024"]["total"], yrs["fy2025"]["total"])},
                }
            entry["pctChange"] = pct
        entry["_pages"] = {"dollars": tables.get(dnum, (None,))[0],
                           "pct": tables.get(pnum, (None,))[0] if pnum else None}
        out["functions"][key] = entry
    return out


def main():
    fs = extract_fiscal_survey()
    ser = extract_ser()

    # sanity checks
    def check(label, d, expect=50):
        n = sum(1 for s in STATES if s in d)
        print(f"{label}: {n}/50 states" + ("  <-- INCOMPLETE" if n < expect else ""))

    check("FY2024 actual", fs["fy2024_actual"])
    check("FY2025 prelim", fs["fy2025_prelim"])
    check("FY2026 enacted", fs["fy2026_enacted"])
    check("FY2025 actual (spring)", fs["fy2025_actual"])
    check("FY2026 estimated", fs["fy2026_estimated"])
    check("FY2027 recommended", fs["fy2027_recommended"])
    check("GF pct fall", fs["gf_pct_change_fall"])
    check("GF pct spring", fs["gf_pct_change_spring"])
    print("spring pages:", fs["_spring_pages"])
    check("SER total $", ser["total"]["dollars"])
    check("SER mix (Table 4)", ser["mix"])
    check("SER debt service (Table 29)", ser["debtService"])
    for k, v in ser["capitalByProgram"].items():
        check(f"SER capital {k}", v)
    for k, v in ser["functions"].items():
        check(f"SER {k} $", v.get("dollars", {}))
        check(f"SER {k} %", v.get("pctChange", {}))
        print(f"  pages: {v['_pages']}")

    # spot checks
    print("\nCA FY2026 enacted exp:", fs["fy2026_enacted"].get("California"))
    print("AL k12 pct:", ser["functions"]["k12"].get("pctChange", {}).get("Alabama"))
    print("AL total $:", ser["total"]["dollars"].get("Alabama"))

    with open(os.path.join(DIR, "fiscal_survey.json"), "w") as f:
        json.dump(fs, f, indent=1)
    with open(os.path.join(DIR, "ser.json"), "w") as f:
        json.dump(ser, f, indent=1)
    print("\nWrote fiscal_survey.json, ser.json")


if __name__ == "__main__":
    main()
