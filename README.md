# Dell SLG Strategy Hub

Interactive, state-by-state intelligence for Dell SLG field sellers and DSMs.
A central landing page with a clickable US map links to a consistent report for
each state (budget, initiatives, procurement, power structure, news & signals).

## How it works

Content is **data-driven**. You edit data; a generator renders the HTML.

```
data/states.json          # manifest: which states are live (clickable)
data/states/<slug>.json   # the source of truth for one state's report
templates/us-map.svg      # the base US map (don't hand-edit)
scripts/generate.js       # renders everything -> index.html + states/*.html
assets/css/styles.css     # the single central stylesheet (theme here)
assets/js/                # small progressive-enhancement scripts
index.html, states/*.html # GENERATED — do not edit by hand
```

## Updating a state (the regular workflow)

1. Edit the state's data file, e.g. `data/states/texas.json` — change numbers,
   add news items, bump `"updated"`.
2. Regenerate:
   ```
   node scripts/generate.js
   ```
3. Preview locally:
   ```
   python -m http.server 8770
   ```
   then open http://localhost:8770/index.html
4. Commit and push.

## Adding a new state

1. Copy `data/states/texas.json` to `data/states/<slug>.json` and fill it in.
2. In `data/states.json`, set that state's `"available": true`.
3. Run `node scripts/generate.js`. The state becomes blue/clickable on the map.

## National report: 50-State Budget Shifts

`reports/budget-shifts.html` compares each state's prior and current budget and
shows which program areas gained or lost funding. It is generated from
`data/budget-shifts.json`, which is built from NASBO's published surveys:

```
scripts/nasbo/raw/*.pdf            # NASBO source reports (Fiscal Survey, State Expenditure Report)
scripts/nasbo/extract_nasbo.py     # PDF -> raw/fiscal_survey.json + raw/ser.json
scripts/nasbo/extract_strategies.py# PDF -> raw/strategies.json (cut-strategy X-grids, needs pdfplumber)
scripts/nasbo/build_budget_shifts.py # merge -> data/budget-shifts.json
```

To refresh when NASBO publishes a new edition (Fiscal Survey: ~June and
~December; State Expenditure Report: ~November):

1. Download the new full-report PDF into `scripts/nasbo/raw/` (links in
   `data/budget-shifts.json` sources; archive at nasbo.org → Reports & Data).
2. Update the page indexes / filenames at the top of the extract scripts if the
   edition changed, then run the three scripts in order (needs `pypdf` and
   `pdfplumber`: `pip install pypdf pdfplumber`).
3. Check the printed sanity counts (every table should say 50/50; the strategy
   grids validate against NASBO's own TOTAL rows), bump `updated`, then
   `node scripts/generate.js`.

## Notes

- **No build tooling, no CDNs.** Output is plain static HTML so it works on
  GitHub Pages, from a local file, and (the goal) inside SharePoint.
- All links are **relative**, so the whole folder can move hosts unchanged.
- Every page shows a **Last updated** date and a numbered **Sources** list.
- Restyle the entire hub from `assets/css/styles.css` (CSS variables at the top).
