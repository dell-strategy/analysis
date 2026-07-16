"""Merge extracted NASBO datasets into data/budget-shifts.json for the SLG Hub."""
import json
import os

DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "raw")
REPO = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

fs = json.load(open(os.path.join(DIR, "fiscal_survey.json")))
ser = json.load(open(os.path.join(DIR, "ser.json")))
strat = json.load(open(os.path.join(DIR, "strategies.json")))
manifest = json.load(open(os.path.join(REPO, "data", "states.json")))

slug_by_name = {s["name"]: s["slug"] for s in manifest["states"]}

FUNCTION_LABELS = {
    "k12": "K-12 Education",
    "higherEd": "Higher Education",
    "medicaid": "Medicaid",
    "corrections": "Corrections",
    "transportation": "Transportation",
    "allOther": "All Other",
    "capital": "Capital (all program areas)",
}
STRATEGY_LABELS = {
    "acrossBoardCuts": "Across-the-board cuts",
    "targetedCuts": "Targeted cuts",
    "layoffs": "Layoffs",
    "furloughs": "Furloughs",
    "earlyRetirement": "Early retirement",
    "salaryReductions": "Salary reductions",
    "benefitCuts": "Employee benefit cuts",
    "hiringFreeze": "Hiring freeze / vacancy elimination",
    "eliminateVacancies": "Eliminating vacant positions",
    "pensionAdjustments": "Pension / OPEB adjustments",
    "reduceLocalAid": "Reduce local aid",
    "reorganizeAgencies": "Agency reorganization",
    "privatization": "Privatization",
    "rainyDayFund": "Rainy day fund draw",
    "fundTransfers": "Other fund transfers",
    "priorYearBalance": "Prior-year fund balance",
    "deferredPayments": "Deferred payments",
    "revenueIncrease": "Revenue increases",
    "medicaidChanges": "Medicaid program changes",
    "other": "Other",
}
# merge spring's split hiring-freeze columns into one signal for display parity
MERGE_SPRING = {"eliminateVacancies": "hiringFreeze"}

CAPITAL_LABELS = {
    "transportation": "Transportation",
    "allOther": "All Other",
    "higherEd": "Higher Education",
    "environment": "Environmental",
    "k12": "K-12 Construction",
    "housing": "Housing",
    "corrections": "Corrections",
}

# Distilled from the 2025 State Expenditure Report chapter "At a Glance" pages.
FUNCTION_NARRATIVES = {
    "k12": "Total K-12 spending was nearly flat (+0.8%) in FY2025: state funds grew 4.6% (median +6.0%) while federal funds fell 15.9% as temporary pandemic education aid wound down. Federal dollars are still 15.6% of K-12 spending vs. 13.6% pre-pandemic — more decline is coming.",
    "higherEd": "Total higher-ed spending rose 3.9% in FY2025; general fund support grew 2.6% after +7.6% in FY2024, as states propped up affordability and institutions facing enrollment declines (public FTE enrollment fell in 41 states over the past decade).",
    "medicaid": "The fastest-growing category: +8.4% total in FY2025 with state funds up 13.2%, as the expired enhanced federal match shifted costs onto states amid provider rate increases and rising long-term-care, pharmacy, and behavioral-health costs.",
    "corrections": "Total corrections spending rose 4.0% in FY2025 (general fund +4.1%). It is the most general-fund-reliant category (84.7% GF), and pay raises for recruitment and retention were a priority in many states' FY2025 budgets.",
    "transportation": "+7.0% total in FY2025 after +15.5% in FY2024 — second-fastest growth behind Medicaid, powered by IIJA federal dollars and states steering surpluses to infrastructure. Over 60% is funded from earmarked revenues like motor-fuel taxes.",
    "allOther": "+6.3% in FY2025. The catch-all for most state agencies — CHIP, behavioral health, public health, child welfare, courts, constitutional officers — still normalizing after CARES/ARPA-driven swings.",
    "capital": "Capital spending grew 5.9% in FY2025 (state funds +10.7%; federal funds −0.9% as ARPA winds down). Transportation is ~63% of all state capital outlays; higher education is the next largest at ~10%.",
}

states_out = {}
for name, slug in slug_by_name.items():
    gf = {
        "fy2024": fs["fy2024_actual"].get(name, {}).get("expenditures"),
        "fy2025": fs["fy2025_actual"].get(name, {}).get("expenditures"),
        # basis for the FY2026-enacted % change in the fall survey
        "fy2025Prelim": fs["fy2025_prelim"].get(name, {}).get("expenditures"),
        "fy2026Enacted": fs["fy2026_enacted"].get(name, {}).get("expenditures"),
        "fy2026Estimated": fs["fy2026_estimated"].get(name, {}).get("expenditures"),
        "fy2027Proposed": fs["fy2027_recommended"].get(name, {}).get("expenditures"),
    }
    pct_fall = fs["gf_pct_change_fall"].get(name, {})
    pct_spring = fs["gf_pct_change_spring"].get(name, {})
    pct = {
        "fy2025": pct_spring.get("fy2025"),          # FY24 -> FY25 (actual)
        "fy2026Enacted": pct_fall.get("fy2026"),     # FY25 prelim -> FY26 enacted
        "fy2026Estimated": pct_spring.get("fy2026"), # FY25 -> FY26 current estimate
        "fy2027Proposed": pct_spring.get("fy2027"),  # FY26 est -> FY27 recommended
    }
    rdf = fs["fy2026_enacted"].get(name, {}).get("rainyDayFund")

    funcs = {}
    for key in FUNCTION_LABELS:
        f = ser["functions"][key]
        d = f.get("dollars", {}).get(name)
        pc = f.get("pctChange", {}).get(name)
        if not (d or pc):
            continue
        funcs[key] = {
            "fy2025Total": d["fy2025"].get("total") if d else None,
            "fy2025Gf": d["fy2025"].get("gf") if d else None,
            "pct2024": pc.get("fy2024") if pc else None,
            "pct2025": pc.get("fy2025") if pc else None,
        }

    def strategies(block):
        keys = strat[block].get(name, [])
        keys = [MERGE_SPRING.get(k, k) for k in keys]
        return sorted(set(keys), key=lambda k: list(STRATEGY_LABELS).index(k))

    # capital by program area: FY2025 total + change vs FY2024
    cap_programs = {}
    for key in CAPITAL_LABELS:
        d = ser["capitalByProgram"].get(key, {}).get(name)
        if not d:
            continue
        t24, t25 = d["fy2024"].get("total"), d["fy2025"].get("total")
        cap_programs[key] = {
            "fy2025Total": t25,
            "pct2025": round((t25 - t24) / t24 * 100, 1) if t24 else None,
        }

    ds = ser["debtService"].get(name)

    states_out[slug] = {
        "name": name,
        "generalFund": gf,
        "pctChange": pct,
        "rainyDayFy2026": rdf,
        "midYearFy2026": fs["fy2026_midyear_actions"].get(name),
        "strategiesFy2026": strategies("fy2026_enacted"),
        "strategiesFy2027": strategies("fy2027_recommended"),
        "functions": funcs,
        "mix": ser["mix"].get(name),                     # FY2025 % of total spend
        "totalFy2025": (ser["total"]["dollars"].get(name) or {}).get("fy2025", {}).get("total"),
        "debtServiceFy2025": ds,                         # $M: gf / of / total
        "capitalPrograms": cap_programs,
    }

# national aggregates (50-state sums of extracted values)
def total(d):
    vals = [v.get("expenditures") for k, v in d.items()
            if k in slug_by_name and v.get("expenditures") is not None]
    return sum(vals)


national = {
    "gfFy2024": total(fs["fy2024_actual"]),
    "gfFy2025": total(fs["fy2025_actual"]),
    "gfFy2026Enacted": total(fs["fy2026_enacted"]),
    "gfFy2027Proposed": total(fs["fy2027_recommended"]),
    "notes": [
        "Fiscal 2026 general fund totals include Pennsylvania's proposed (not enacted) budget; the state had not enacted a FY2026 budget at NASBO's fall reporting deadline.",
        "Fiscal 2027 figures are governors' recommended budgets, not enacted appropriations. Virginia did not report a FY2027 proposal.",
        "States with biennial budgets (e.g., Texas) show large alternating year-over-year swings; compare across the full biennium.",
    ],
}

# national capital totals per program (50-state sums, FY2024/FY2025)
capital_national = {}
for key in CAPITAL_LABELS:
    d = ser["capitalByProgram"].get(key, {})
    t24 = sum((v["fy2024"].get("total") or 0) for st, v in d.items() if st in slug_by_name)
    t25 = sum((v["fy2025"].get("total") or 0) for st, v in d.items() if st in slug_by_name)
    capital_national[key] = {
        "label": CAPITAL_LABELS[key],
        "fy2025Total": t25,
        "pct2025": round((t25 - t24) / t24 * 100, 1) if t24 else None,
    }

out = {
    "updated": "2026-07-16",
    "title": "50-State Budget Shifts",
    "functionLabels": FUNCTION_LABELS,
    "strategyLabels": STRATEGY_LABELS,
    "functionNarratives": FUNCTION_NARRATIVES,
    "capitalLabels": CAPITAL_LABELS,
    "capitalNational": capital_national,
    "national": national,
    "states": states_out,
    "sources": [
        {"label": "NASBO, The Fiscal Survey of States: Fall 2025 (enacted FY2026 budgets; FY2024-25 actuals)",
         "url": "https://higherlogicdownload.s3.amazonaws.com/NASBO/9d2d2db1-c943-4f1b-b750-0fca152d64c2/UploadedImages/Fiscal%20Survey/NASBO_Fall_2025_Fiscal_Survey_Full_Report_S.pdf"},
        {"label": "NASBO, The Fiscal Survey of States: Spring 2026 (governors' recommended FY2027 budgets; FY2026 estimates)",
         "url": "https://higherlogicdownload.s3.amazonaws.com/NASBO/9d2d2db1-c943-4f1b-b750-0fca152d64c2/UploadedImages/Fiscal%20Survey/Spring_2026_Fiscal_Survey_Full_Report_S.pdf"},
        {"label": "NASBO, 2025 State Expenditure Report (spending by program area, FY2023-2025)",
         "url": "https://higherlogicdownload.s3.amazonaws.com/NASBO/9d2d2db1-c943-4f1b-b750-0fca152d64c2/UploadedImages/SER%20Archive/2025_SER/2025_NASBO_State_Expenditure_Report_S.pdf"},
        {"label": "NASBO Fiscal Survey of States (report hub)",
         "url": "https://www.nasbo.org/reports-data/fiscal-survey-of-states"},
    ],
}

dest = os.path.join(REPO, "data", "budget-shifts.json")
with open(dest, "w") as f:
    json.dump(out, f, indent=1)

n_cut26 = sum(1 for s in states_out.values()
              if (s["pctChange"]["fy2026Enacted"] or 0) < 0)
n_cut27 = sum(1 for s in states_out.values()
              if s["pctChange"]["fy2027Proposed"] is not None and s["pctChange"]["fy2027Proposed"] < 0)
print("Wrote", dest)
print("states:", len(states_out))
print("GF FY2025 total: $%.2fB" % (national["gfFy2025"] / 1000))
print("GF FY2026 enacted total: $%.2fB (%+.1f%%)" % (
    national["gfFy2026Enacted"] / 1000,
    (national["gfFy2026Enacted"] / national["gfFy2025"] - 1) * 100))
print("states cutting GF in FY2026 enacted:", n_cut26)
print("states with GF cut in FY2027 proposals:", n_cut27)
