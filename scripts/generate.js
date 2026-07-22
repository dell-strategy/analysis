#!/usr/bin/env node
/* ============================================================================
   Dell SLG Strategy Hub — static site generator
   Reads data/ + templates/ and writes index.html and states/<slug>.html.
   Run:  node scripts/generate.js
   No dependencies. Output is plain, fully-rendered HTML (SharePoint / file:// safe).
   ========================================================================== */
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const p = (...a) => path.join(ROOT, ...a);

/* ---- helpers ------------------------------------------------------------- */
const esc = (s) => String(s == null ? '' : s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const read = (f) => fs.readFileSync(p(f), 'utf8');
const readJSON = (f) => JSON.parse(read(f));
const ref = (n) => (n ? `<sup class="ref"><a href="#src-${n}">${n}</a></sup>` : '');

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
function fmtDate(d) {
  const [y, m, day] = String(d).split('-');
  const mon = m ? MONTHS[parseInt(m, 10) - 1] : '';
  return { top: day ? `${mon} ${parseInt(day, 10)}` : mon, yr: y };
}
const fmtLong = (d) => { const { top, yr } = fmtDate(d); return `${top}, ${yr}`; };

/* ---- inline icon set (no CDN; stroke = currentColor) --------------------- */
const ICONS = {
  summary: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4',
  budget: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z',
  initiatives: 'M5 3v4M3 5h4M6.5 17.5v3M5 19h3M13 3l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z',
  procurement: 'M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z',
  power: 'M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z',
  news: 'M12 7.5h1.5m-1.5 3h1.5m-7.5 3h7.5m-7.5 3h7.5m3-9h3.375c.621 0 1.125.504 1.125 1.125V18a2.25 2.25 0 01-2.25 2.25M16.5 7.5V4.875c0-.621-.504-1.125-1.125-1.125H4.125C3.504 3.75 3 4.254 3 4.875V18a2.25 2.25 0 002.25 2.25h13.5M6 7.5h3v3H6v-3z',
  bolt: 'M13 10V3L4 14h7v7l9-11h-7z',
  check: 'M4.5 12.75l6 6 9-13.5',
  search: 'M21 21l-5.2-5.2m0 0A7.5 7.5 0 105.2 5.2a7.5 7.5 0 0010.6 10.6z',
  go: 'M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3',
  chevron: 'M8.25 4.5l7.5 7.5-7.5 7.5',
  pin: 'M15 10.5a3 3 0 11-6 0 3 3 0 016 0zM19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z',
  calendar: 'M6.75 3v2.25M17.25 3v2.25M3 11.25h18M5.25 5.25h13.5A2.25 2.25 0 0121 7.5v11.25A2.25 2.25 0 0118.75 21H5.25A2.25 2.25 0 013 18.75V7.5a2.25 2.25 0 012.25-2.25z',
};
function icon(name, cls) {
  const d = ICONS[name] || '';
  return `<svg class="icon${cls ? ' ' + cls : ''}" viewBox="0 0 24 24" fill="none" stroke="currentColor" ` +
    `stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${d}"/></svg>`;
}

/* ---- shared chrome ------------------------------------------------------- */
function head(title, cssHref) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${esc(title)}</title>
<link rel="stylesheet" href="${cssHref}">
</head>`;
}

function siteHeader(rootPrefix, showBack) {
  return `<header class="site-header">
  <div class="site-header__inner">
    <a class="brand" href="${rootPrefix}index.html" style="text-decoration:none">
      <img class="brand__logo" src="${rootPrefix}assets/img/SLG-Strategy-Team_F_Chevron_dark-bg-web.png" alt="SLG Strategy Team — State, Local &amp; Government">
    </a>
    ${showBack ? `<div class="header-actions"><a class="btn btn--ghost" href="${rootPrefix}index.html">${icon('chevron')} All States</a></div>` : ''}
  </div>
</header>`;
}

function siteFooter(rootPrefix, updated, usesGovspend) {
  const stamp = updated ? `Last updated ${esc(fmtLong(updated))}.` : '';
  const gs = usesGovspend
    ? `<span class="footer-govspend">Includes data from <img class="gs-logo" src="${rootPrefix}assets/img/govspend-web.png" alt="GovSpend"></span>`
    : '';
  return `<footer class="site-footer">
  <div class="site-footer__inner">
    <div class="site-footer__brand">
      <img class="footer-logo" src="${rootPrefix}assets/img/SLG-Strategy-Team_F_Chevron_dark-bg-web.png" alt="SLG Strategy Team — State, Local &amp; Government">
    </div>
    <div class="site-footer__meta">
      ${gs}
      ${stamp ? `<span>${stamp}</span>` : ''}
    </div>
  </div>
</footer>`;
}

/* ====================================================================== */
/*  LANDING PAGE                                                           */
/* ====================================================================== */
function buildMapSvg(svgRaw, states) {
  let svg = svgRaw.replace(
    '<svg id="us-map" xmlns="http://www.w3.org/2000/svg"',
    '<svg id="us-map" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"');
  for (const st of states) {
    const re = new RegExp(`<path class="state" id="${st.code}"([^>]*?)/>`);
    if (!re.test(svg)) continue;
    if (st.available) {
      svg = svg.replace(re,
        `<a class="state-link" href="states/${st.slug}.html" xlink:href="states/${st.slug}.html" aria-label="${esc(st.name)} report">` +
        `<path class="state is-available" id="${st.code}"$1><title>${esc(st.name)} — view report</title></path></a>`);
    } else {
      svg = svg.replace(re,
        `<path class="state" id="${st.code}"$1><title>${esc(st.name)} — coming soon</title></path>`);
    }
  }
  // Any shape still tagged .state is a non-state decorative artifact (inset
  // frames, DC dot) — these are still self-closing since the loop never touched
  // them. Neutralize so they don't render in the "coming soon" grey.
  svg = svg.replace(/<(path|circle) class="state" (id="[^"]*"[^>]*?)\/>/g, '<$1 class="map-decor" $2/>');
  return svg;
}

function buildStateOptions(states) {
  return states.slice().sort((a, b) => a.name.localeCompare(b.name))
    .filter((st) => st.available)
    .map((st) => `          <li class="picker-option" role="option" data-name="${esc(st.name.toLowerCase())}" data-href="states/${st.slug}.html">${esc(st.name)}</li>`)
    .join('\n');
}

function feature(iconName, title, body) {
  return `<div class="feature">
    <div class="feature__icon">${icon(iconName)}</div>
    <h3>${esc(title)}</h3>
    <p>${esc(body)}</p>
  </div>`;
}

function renderIndex(manifest, svgRaw, hasBudgetShifts) {
  const states = manifest.states;
  const live = states.filter((s) => s.available).length;
  const map = buildMapSvg(svgRaw, states);
  const options = buildStateOptions(states);
  const nationalReports = hasBudgetShifts ? `
  <div class="panel national-reports">
    <div class="national-reports__inner">
      <div class="national-reports__text">
        <span class="browse-bar__label">National reports</span>
        <h3>50-State Budget Shifts</h3>
        <p class="muted">Prior vs. current budgets for every state — which program areas gained or lost funding, and which states are cutting. Sourced from NASBO enacted-budget and expenditure surveys.</p>
      </div>
      <a class="btn btn--primary" href="reports/budget-shifts.html">Open report ${icon('go')}</a>
    </div>
  </div>` : '';

  return `${head('Dell SLG Strategy Hub | Interactive State Map', 'assets/css/styles.css')}
<body>
${siteHeader('', false)}

<section class="landing-hero">
  <div class="landing-hero__inner">
    <p class="eyebrow">Field &amp; District Sales Enablement</p>
    <h1>State &amp; Local Government strategy, state by state.</h1>
    <p class="lede">Budgets, initiatives, procurement paths, and the signals that shape each state's ability to buy technology &mdash; built for Dell sellers and district managers.</p>
  </div>
</section>

<section class="wrap map-section">
  <div class="panel map-panel">
    <div class="map-panel__title">
      <h2>Select a state</h2>
      <span class="hint">Click any state to open its report</span>
    </div>
    ${map}
  </div>

  <div class="panel browse-bar">
    <div class="browse-bar__inner">
      <span class="browse-bar__label">Find a state <span class="live-count">${live} live</span></span>
      <div class="picker-wrap">
        ${icon('search')}
        <input type="text" id="statePicker" class="state-picker" autocomplete="off"
               placeholder="Type or select a state&hellip;" aria-label="Find a state"
               role="combobox" aria-expanded="false" aria-controls="stateMenu" aria-autocomplete="list">
        <ul class="picker-menu" id="stateMenu" role="listbox" hidden>
${options}
        </ul>
      </div>
      <button type="button" id="statePickerGo" class="btn btn--primary">Open report</button>
    </div>
    <p class="browse-bar__hint">Choose a state, or click any state on the map above.</p>
  </div>
${nationalReports}
  <div class="features">
    ${feature('budget', 'Budget & fiscal', 'Where the money is — IT budgets, fiscal cycles, and funding news that affects buying power.')}
    ${feature('initiatives', 'Initiatives & policy', 'Modernization, AI, and cyber programs — scored for Dell fit and budget strength.')}
    ${feature('procurement', 'Procurement & competition', 'Contract vehicles, key buying entities, and how Dell sells in each state.')}
  </div>
</section>

${siteFooter('', '')}
<script src="assets/js/map.js"></script>
</body>
</html>`;
}

/* ====================================================================== */
/*  BUDGET SHIFTS REPORT (50-state, NASBO-sourced)                         */
/* ====================================================================== */
function fmtM(n) {
  if (n == null) return '&mdash;';
  if (n >= 1e6) return '$' + (n / 1e6).toFixed(2) + 'T';
  return n >= 1000
    ? '$' + (n / 1000).toFixed(n >= 100000 ? 0 : 1) + 'B'
    : '$' + Math.round(n) + 'M';
}
function fmtPct(v, digits) {
  if (v == null) return '<span class="muted">&mdash;</span>';
  const cls = v > 0 ? 'delta-pos' : (v < 0 ? 'delta-neg' : 'delta-flat');
  const s = (v > 0 ? '+' : '') + v.toFixed(digits == null ? 1 : digits) + '%';
  return `<span class="${cls}">${s}</span>`;
}
function median(arr) {
  const a = arr.filter((v) => v != null).sort((x, y) => x - y);
  if (!a.length) return null;
  const m = Math.floor(a.length / 2);
  return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2;
}

function renderBudgetShifts(bs, manifest, agencyData) {
  agencyData = agencyData || {};
  const codeBySlug = {};
  for (const st of manifest.states) codeBySlug[st.slug] = st.code;
  const entries = Object.entries(bs.states)
    .map(([slug, s]) => ({ slug, ...s }))
    .sort((a, b) => a.name.localeCompare(b.name));
  const n = bs.national;

  /* -- headline numbers ---------------------------------------------------- */
  const gf26Delta = (n.gfFy2026Enacted / n.gfFy2025 - 1) * 100;
  const cutting26 = entries.filter((s) => (s.pctChange.fy2026Enacted || 0) < 0);
  const cutting27 = entries.filter((s) => s.pctChange.fy2027Proposed != null && s.pctChange.fy2027Proposed < 0);
  const targeted26 = entries.filter((s) => s.strategiesFy2026.includes('targetedCuts'));
  const freeze26 = entries.filter((s) => s.strategiesFy2026.includes('hiringFreeze'));

  /* -- state-by-state general fund table ----------------------------------- */
  const CHIP_SHORT = {
    acrossBoardCuts: 'Across-the-board',
    targetedCuts: 'Targeted cuts',
    hiringFreeze: 'Hiring freeze',
    layoffs: 'Layoffs',
    furloughs: 'Furloughs',
  };
  const rows = entries.map((s) => {
    const chips = s.strategiesFy2026
      .filter((k) => CHIP_SHORT[k])
      .map((k) => `<span class="strat-chip">${esc(CHIP_SHORT[k])}</span>`).join('');
    const my = s.midYearFy2026 && s.midYearFy2026.netChange != null ? s.midYearFy2026.netChange : null;
    const mid = my != null
      ? `<span class="${my < 0 ? 'delta-neg' : 'delta-pos'}">${my < 0 ? '−' : '+'}$${Math.abs(my) >= 1000 ? (Math.abs(my) / 1000).toFixed(1) + 'B' : Math.round(Math.abs(my)) + 'M'}</span>`
      : '<span class="muted">&mdash;</span>';
    const drill = agencyData[s.slug]
      ? ` <a class="code-chip" href="../states/${esc(s.slug)}.html#budget" title="Agency-level budget shifts available">agencies</a>`
      : '';
    return `<tr>
      <td class="rowhead"><b><a href="../states/${esc(s.slug)}.html">${esc(s.name)}</a></b>${drill}</td>
      <td class="num" data-label="FY2025">${fmtM(s.generalFund.fy2025Prelim != null ? s.generalFund.fy2025Prelim : s.generalFund.fy2025)}</td>
      <td class="num" data-label="FY2026 enacted">${fmtM(s.generalFund.fy2026Enacted)}</td>
      <td class="num" data-label="FY26 &Delta;">${fmtPct(s.pctChange.fy2026Enacted)}</td>
      <td class="num" data-label="FY27 proposed &Delta;">${fmtPct(s.pctChange.fy2027Proposed)}</td>
      <td class="num" data-label="Mid-year FY26">${mid}</td>
      <td data-label="FY26 actions">${chips ? `<span class="chip-wrap">${chips}</span>` : '<span class="muted">&mdash;</span>'}</td>
    </tr>`;
  }).join('');

  /* -- agency drill-down summary (phase-2 states) ---------------------------- */
  const drillSlugs = Object.keys(agencyData).sort((a, b) =>
    (agencyData[a].state || a).localeCompare(agencyData[b].state || b));
  const drillRows = drillSlugs.map((slug) => {
    const as = agencyData[slug];
    const rows = (as.agencies || []).map((a) => ({ ...a, change: (a.current || 0) - (a.prior || 0) }));
    const totP = rows.reduce((t, a) => t + (a.prior || 0), 0);
    const totC = rows.reduce((t, a) => t + (a.current || 0), 0);
    const pct = totP ? (totC / totP - 1) * 100 : null;
    const up = rows.slice().sort((x, y) => y.change - x.change)[0];
    const down = rows.slice().sort((x, y) => x.change - y.change)[0];
    const mv = (a, sign) => a ? `${esc(a.name)} <span class="${sign < 0 ? 'delta-neg' : 'delta-pos'}">${a.change < 0 ? '−' : '+'}${moneyShort(Math.abs(a.change))}</span>` : '&mdash;';
    return `<tr>
      <td class="rowhead"><b><a href="../states/${esc(slug)}.html#budget">${esc(as.state)}</a></b><br><small class="muted">${esc(as.priorLabel || 'prior')} &rarr; ${esc(as.currentLabel || 'current')}</small></td>
      <td class="num" data-label="Statewide">${moneyShort(totP)} &rarr; ${moneyShort(totC)} ${pct != null ? fmtPct(pct) : ''}</td>
      <td data-label="Biggest increase">${mv(up, 1)}</td>
      <td data-label="Biggest cut">${down && down.change < 0 ? mv(down, -1) : '<span class="muted">none</span>'}</td>
    </tr>`;
  }).join('');
  const drillSection = drillSlugs.length ? `
  <section class="section" id="agencies">
    ${sectionHead('power', 'Agency Drill-Downs')}
    <p class="lead">For ${drillSlugs.length} states so far, we've parsed the actual enacted budget documents to agency level &mdash; every agency's prior vs. current funding, validated against each document's own totals. Each state's page carries the full table; the biggest movers are below. <b>Bases differ by state</b> (all funds vs. state funds vs. general fund; annual vs. biennial) &mdash; compare within a state, not across states.</p>
    <div class="card table-card bsr-table bsr-stack" style="margin-top:16px">
      <table class="data-table">
        <thead><tr><th>State (drill in)</th><th class="num">Statewide</th><th>Biggest increase</th><th>Biggest cut</th></tr></thead>
        <tbody>${drillRows}</tbody>
      </table>
    </div>
  </section>` : '';

  /* -- program-area cards --------------------------------------------------- */
  const funcCards = Object.entries(bs.functionLabels).map(([key, label]) => {
    const vals = entries
      .map((s) => ({ name: s.name, slug: s.slug, f: s.functions[key] }))
      .filter((x) => x.f && x.f.pct2025 && x.f.pct2025.total != null);
    const med = median(vals.map((x) => x.f.pct2025.total));
    const sorted = vals.slice().sort((a, b) => b.f.pct2025.total - a.f.pct2025.total);
    const rowCells = (x) => {
      const gf = x.f.pct2025.gf;
      return `<a class="ft-name" href="../states/${esc(x.slug)}.html">${esc(x.name)}</a>` +
        `<span class="ft-num">${fmtPct(x.f.pct2025.total)}</span>` +
        `<span class="ft-num ft-sub">${gf != null ? (gf > 0 ? '+' : '') + gf.toFixed(1) + '%' : '&mdash;'}</span>` +
        `<span class="ft-num ft-sub">${x.f.fy2025Total != null ? fmtM(x.f.fy2025Total) : '&mdash;'}</span>`;
    };
    const top = sorted.slice(0, 4).map(rowCells).join('');
    const bottom = sorted.slice(-4).reverse().map(rowCells).join('');
    const note = (bs.functionNarratives || {})[key];
    return `<div class="card func-card">
      <div class="func-card__head"><h3>${esc(label)}</h3><span class="func-card__med">median ${fmtPct(med)}</span></div>
      ${note ? `<p class="func-card__note">${esc(note)}</p>` : ''}
      <div class="func-table">
        <span class="ft-h"></span><span class="ft-h">Total &Delta;</span><span class="ft-h">GF &Delta;</span><span class="ft-h">FY25 $</span>
        <span class="ft-group delta-pos-h">Adding most</span>
        ${top}
        <span class="ft-group delta-neg-h">Cutting most</span>
        ${bottom}
      </div>
    </div>`;
  }).join('');

  /* -- where the money goes: FY2025 spending mix + debt service ------------- */
  const MIX_KEYS = [
    ['k12', 'K-12'], ['higherEd', 'Higher Ed'], ['medicaid', 'Medicaid'],
    ['corrections', 'Corrections'], ['transportation', 'Transportation'], ['allOther', 'All Other'],
  ];
  const mixLegend = MIX_KEYS.map(([k, l]) =>
    `<span class="mix-key"><span class="mix-swatch mix-seg--${k}"></span>${l}</span>`).join('');
  const mixRows = entries.filter((s) => s.mix).map((s) => {
    const segs = MIX_KEYS.map(([k, l]) => {
      const v = s.mix[k] || 0;
      return `<span class="mix-seg mix-seg--${k}" style="width:${v}%" title="${esc(l)} ${v}% of ${esc(s.name)} FY2025 spending"></span>`;
    }).join('');
    const ds = s.debtServiceFy2025;
    const dsPct = ds && ds.total && s.totalFy2025 ? (ds.total / s.totalFy2025 * 100).toFixed(1) : null;
    const debt = ds && ds.total != null
      ? `<span title="FY2025 debt service${dsPct ? ` — ${dsPct}% of total spending` : ''}">${fmtM(ds.total)}</span>`
      : '<span class="muted">&mdash;</span>';
    return `<div class="mix-row">
      <a class="mix-row__name" href="../states/${esc(s.slug)}.html">${esc(s.name)}</a>
      <div class="mix-bar">${segs}</div>
      <span class="mix-row__debt">${debt}</span>
    </div>`;
  }).join('');

  /* -- capital programs ------------------------------------------------------ */
  const capOrder = Object.entries(bs.capitalNational || {})
    .sort((a, b) => (b[1].fy2025Total || 0) - (a[1].fy2025Total || 0));
  const capTotal = capOrder.reduce((t, [, v]) => t + (v.fy2025Total || 0), 0);
  const capCards = capOrder.map(([key, nat]) => {
    const share = capTotal ? (nat.fy2025Total / capTotal * 100).toFixed(1) : null;
    const states = entries
      .filter((s) => s.capitalPrograms[key] && s.capitalPrograms[key].fy2025Total)
      .sort((a, b) => b.capitalPrograms[key].fy2025Total - a.capitalPrograms[key].fy2025Total)
      .slice(0, 4)
      .map((s) => {
        const c = s.capitalPrograms[key];
        return `<a class="ft-name" href="../states/${esc(s.slug)}.html">${esc(s.name)}</a>` +
          `<span class="ft-num">${fmtM(c.fy2025Total)}</span>` +
          `<span class="ft-num ft-sub">${c.pct2025 != null ? (c.pct2025 > 0 ? '+' : '') + c.pct2025.toFixed(1) + '%' : '&mdash;'}</span>`;
      }).join('');
    return `<div class="card func-card">
      <div class="func-card__head"><h3>${esc(nat.label)}</h3><span class="func-card__med">${fmtM(nat.fy2025Total)}${share ? ` &middot; ${share}% of capital` : ''}${nat.pct2025 != null ? ` &middot; ${(nat.pct2025 > 0 ? '+' : '') + nat.pct2025.toFixed(1)}%` : ''}</span></div>
      <div class="func-table func-table--3">
        <span class="ft-h"></span><span class="ft-h">FY25 $</span><span class="ft-h">YoY &Delta;</span>
        <span class="ft-group delta-pos-h">Biggest FY2025 programs</span>
        ${states}
      </div>
    </div>`;
  }).join('');

  /* -- strategy matrix ------------------------------------------------------ */
  const stratBlock = (title, field, note) => {
    const counts = {};
    for (const s of entries) for (const k of s[field]) (counts[k] = counts[k] || []).push(s.slug);
    const rows2 = Object.keys(bs.strategyLabels)
      .filter((k) => counts[k] && counts[k].length)
      .sort((a, b) => counts[b].length - counts[a].length)
      .map((k) => `<tr><td class="rowhead"><b>${esc(bs.strategyLabels[k])}</b> <span class="muted" style="font-weight:400">&middot; ${counts[k].length} state${counts[k].length === 1 ? '' : 's'}</span></td>
        <td data-label="Where"><span class="chip-wrap">${counts[k].map((slug) => `<a class="code-chip" href="../states/${esc(slug)}.html">${esc(codeBySlug[slug] || slug)}</a>`).join('')}</span></td></tr>`).join('');
    return `<div class="card table-card bsr-table bsr-stack" style="margin-bottom:18px">
      <div class="card__title">${icon('budget')} ${esc(title)}</div>
      ${note ? `<p class="muted" style="font-size:.85rem;margin:0 16px 10px">${esc(note)}</p>` : ''}
      <table class="data-table"><thead><tr><th>Strategy</th><th>Where</th></tr></thead><tbody>${rows2}</tbody></table>
    </div>`;
  };

  /* -- Dell angle ------------------------------------------------------------ */
  const k12Adders = entries
    .filter((s) => s.functions.k12 && s.functions.k12.pct2025 && s.functions.k12.pct2025.total > 0)
    .sort((a, b) => b.functions.k12.pct2025.total - a.functions.k12.pct2025.total).slice(0, 5);
  const capAdders = entries
    .filter((s) => s.functions.capital && s.functions.capital.pct2025 && s.functions.capital.pct2025.total > 0)
    .sort((a, b) => b.functions.capital.pct2025.total - a.functions.capital.pct2025.total).slice(0, 5);
  const dellAngle = [
    `Flat is the new up: with 50-state general fund growth at ${gf26Delta.toFixed(1)}% for FY2026 and ${cutting26.length} states spending less than last year, lead with consolidation, lifecycle extension, and cost-takeout economics &mdash; not net-new programs.`,
    `${targeted26.length} states enacted targeted cuts and ${freeze26.length} are freezing hiring or eliminating vacant positions for FY2026 &mdash; position automation, managed services, and AI-assisted operations as the answer to "do more with fewer people."`,
    `Growth pockets remain: K-12 spending is still rising fastest in ${k12Adders.map((s) => s.name).join(', ')}; capital programs are growing in ${capAdders.map((s) => s.name).join(', ')}.`,
    `Mid-year FY2026 actions are already underway in ${entries.filter((s) => s.midYearFy2026 && s.midYearFy2026.netChange != null && s.midYearFy2026.netChange < 0).length} states that trimmed budgets after enactment &mdash; expect procurement slowdowns and re-scoping in those states; protect renewals early.`,
  ].map((t) => `<li>${icon('go')}<span>${t}</span></li>`).join('');

  const notes = (n.notes || []).map((x) => `<li>${esc(x)}</li>`).join('');
  const sources = (bs.sources || []).map((s, i) =>
    `<li id="src-${i + 1}"><a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.label)}</a></li>`).join('');

  const toc = [
    tocLink('summary', 'summary', 'Summary'),
    tocLink('statewide', 'budget', 'General Fund by State'),
    drillSlugs.length ? tocLink('agencies', 'power', 'Agency Drill-Downs') : '',
    tocLink('programs', 'initiatives', 'Program Areas'),
    tocLink('mix', 'budget', 'Where the Money Goes'),
    tocLink('capital', 'procurement', 'Capital Programs'),
    tocLink('strategies', 'bolt', 'Cut Strategies'),
    tocLink('method', 'news', 'Methodology'),
  ].filter(Boolean).join('\n      ');

  return `${head('50-State Budget Shifts | Dell SLG Strategy Hub', '../assets/css/styles.css')}
<body>
${siteHeader('../', true)}

<section class="report-hero">
  <div class="report-hero__inner">
    <div class="crumbs"><a href="../index.html">All States</a> ${icon('chevron')} <span>50-State Budget Shifts</span></div>
    <p class="eyebrow">${icon('budget')} National Report &middot; SLG Market Intelligence</p>
    <h1>50-State Budget Shifts</h1>
    <p class="tagline">Who's adding, who's cutting: prior-year vs. current state budgets, by state and program area &mdash; from enacted FY2026 budgets and governors' FY2027 proposals.</p>
    <div class="report-hero__meta">
      <span class="updated-pill"><span class="dot"></span> Last updated ${esc(fmtLong(bs.updated))}</span>
    </div>
  </div>
</section>

<div class="report-shell">
  <nav class="toc" aria-label="Sections">
    <div class="toc__label">On this page</div>
      ${toc}
  </nav>
  <main class="report-main">

  <section class="section" id="summary">
    ${sectionHead('summary', 'Executive Summary')}
    <div class="grid grid-4">
      ${statTile({ value: fmtM(n.gfFy2026Enacted).replace('&mdash;', ''), label: 'FY2026 enacted general fund (50 states)', note: (gf26Delta > 0 ? '+' : '') + gf26Delta.toFixed(1) + '% vs. FY2025 — essentially flat' }, 'budget')}
      ${statTile({ value: String(cutting26.length) + ' states', label: 'Enacted FY2026 general fund below FY2025', note: 'Nominal decline, before inflation' }, 'bolt')}
      ${statTile({ value: String(targeted26.length) + ' states', label: 'Targeted cuts in enacted FY2026 budgets', note: String(freeze26.length) + ' states also freezing hiring / cutting vacancies' }, 'initiatives')}
      ${statTile({ value: String(cutting27.length) + ' states', label: 'Governors proposing FY2027 general fund cuts', note: 'Spring 2026 recommended budgets' }, 'calendar')}
    </div>
    <div class="summary-prose"><p>After three years of record growth, state budgets have shifted into belt-tightening. Enacted FY2026 general fund spending across the 50 states is essentially flat versus FY2025, and nearly half the states enacted nominal spending cuts. Governors' FY2027 proposals continue the squeeze. But the picture is uneven by program area: K-12, Medicaid, and capital programs kept growing in most states through FY2025, while higher education and corrections flattened. This report shows, state by state, where funding was added and where it was cut &mdash; and which budget-management levers each state is pulling.</p></div>
    <div class="highlight-panel">
      <div class="highlight-panel__head">${icon('bolt')} What it means for Dell sellers</div>
      <ul class="opp-list">${dellAngle}</ul>
    </div>
  </section>

  <section class="section" id="statewide">
    ${sectionHead('budget', 'General Fund, State by State')}
    <p class="lead">General fund expenditures: FY2025 (preliminary actual, the fall-survey basis for the FY26 change), FY2026 enacted, and the governor's FY2027 proposal. Mid-year shows net post-enactment FY2026 spending changes reported to NASBO (supplementals net of cuts).</p>
    <div class="card table-card bsr-table bsr-stack" style="margin-top:16px">
      <table class="data-table">
        <thead><tr><th>State</th><th class="num">FY2025</th><th class="num">FY2026 enacted</th><th class="num">FY26 &Delta;</th><th class="num">FY27 proposed &Delta;</th><th class="num">Mid-year FY26</th><th>FY26 actions</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  </section>
${drillSection}

  <section class="section" id="programs">
    ${sectionHead('initiatives', 'Program Areas: Added vs. Cut')}
    <p class="lead">Total-fund spending change in FY2025 (latest 50-state actuals/estimates, all fund sources) by program area &mdash; the categories NASBO tracks across every state. "GF" shows the state's own general fund change &mdash; the cleaner policy signal, since total-fund swings often reflect federal aid timing (e.g., the K-12 ESSER expiration).</p>
    <div class="func-grid">${funcCards}</div>
  </section>

  <section class="section" id="mix">
    ${sectionHead('budget', 'Where the Money Goes')}
    <p class="lead">Each state's FY2025 spending mix across NASBO's six program areas (all fund sources), with FY2025 debt service alongside. States that spend a bigger share on Medicaid or K-12 have less discretionary room when budgets tighten &mdash; hover any bar segment for exact shares.</p>
    <div class="card mix-card">
      <div class="mix-legend">${mixLegend}<span class="mix-key mix-key--debt">right column: FY2025 debt service</span></div>
      ${mixRows}
    </div>
  </section>

  <section class="section" id="capital">
    ${sectionHead('procurement', 'Capital Programs')}
    <p class="lead">${esc((bs.functionNarratives || {}).capital || 'State capital spending by program area, FY2025.')}</p>
    <div class="func-grid">${capCards}</div>
  </section>

  <section class="section" id="strategies">
    ${sectionHead('procurement', 'Budget-Management Strategies')}
    <p class="lead">The levers each state is pulling &mdash; from NASBO's survey of enacted FY2026 budgets and governors' FY2027 recommendations. Targeted cuts and hiring freezes are the strongest "do more with less" buying signals.</p>
    ${stratBlock('Enacted FY2026 budgets', 'strategiesFy2026', null)}
    ${stratBlock("Governors' FY2027 recommendations", 'strategiesFy2027', 'Proposed, not enacted — legislatures may change these.')}
  </section>

  <section class="section" id="method">
    ${sectionHead('news', 'Methodology & Caveats')}
    <ul class="muted" style="font-size:.88rem">${notes}
      <li>General fund figures exclude federal funds and other/dedicated funds; program-area figures are all-funds unless noted. Dollar figures are millions, as reported to NASBO by state budget offices.</li>
      <li>Program-area detail runs through FY2025 (NASBO's latest State Expenditure Report); statewide general fund figures run through enacted FY2026 and proposed FY2027.</li>
      <li>Spending mix, debt service, and capital-by-program figures are FY2025 estimates from the State Expenditure Report (Tables 4, 29, and 33&ndash;39); capital "programs" are construction/infrastructure outlays, not operating budgets. Program-area commentary is condensed from NASBO's chapter narratives.</li>
    </ul>
    <div class="sources"><h3>Sources</h3><ol>${sources}</ol></div>
  </section>

  </main>
</div>

${siteFooter('../', bs.updated, true)}
<script src="../assets/js/nav.js"></script>
</body>
</html>`;
}

/* ====================================================================== */
/*  STATE REPORT PAGE                                                      */
/* ====================================================================== */
function statTile(s, iconName) {
  return `<div class="stat">
    ${iconName ? `<div class="stat__icon">${icon(iconName)}</div>` : ''}
    <div class="stat__value">${esc(s.value)}${ref(s.ref)}</div>
    <div class="stat__label">${esc(s.label)}</div>
    ${s.note ? `<div class="stat__note">${esc(s.note)}</div>` : ''}
  </div>`;
}
function meter(label, val, type) {
  const cls = type ? ` meter__fill--${type}` : '';
  const v = Math.max(0, Math.min(100, val || 0));
  return `<div class="meter">
    <div class="meter__top"><span>${esc(label)}</span><b>${v}</b></div>
    <div class="meter__track"><div class="meter__fill${cls}" style="width:${v}%"></div></div>
  </div>`;
}
const badge = (text, type) => `<span class="badge${type ? ' badge--' + type : ''}"><span class="dot"></span>${esc(text)}</span>`;
const sectionHead = (iconName, title) =>
  `<div class="section__head"><span class="section__icon">${icon(iconName)}</span><h2>${esc(title)}</h2></div>`;

function renderExecSummary(d) {
  const e = d.execSummary || {};
  const statIcons = ['budget', 'bolt', 'initiatives', 'calendar'];
  const stats = (e.stats || []).map((s, i) => statTile(s, statIcons[i % statIcons.length])).join('');
  const opps = (e.opportunities || []).map((o) => `<li>${icon('go')}<span>${esc(o)}</span></li>`).join('');
  const actions = (d.dellActions || []).map((a) => `<li>${icon('check')}<span>${esc(a)}</span></li>`).join('');
  return `<section class="section" id="summary">
  ${sectionHead('summary', 'Executive Summary')}
  <div class="grid grid-4">${stats}</div>
  <div class="summary-prose"><p>${esc(e.summary)}</p></div>
  ${opps ? `<div class="highlight-panel">
    <div class="highlight-panel__head">${icon('bolt')} Where Dell can play</div>
    <ul class="opp-list">${opps}</ul>
  </div>` : ''}
  ${actions ? `<div class="callout" style="margin-top:20px">
    <div class="callout__head"><span class="section__icon">${icon('bolt')}</span><h3>Dell Action Plan</h3></div>
    <ul class="action-list">${actions}</ul>
  </div>` : ''}
</section>`;
}

function renderBudget(d) {
  const b = d.budget || {};
  const stats = (b.stats || []).map((s) => statTile(s, 'budget')).join('');
  const max = Math.max(1, ...(b.breakdown || []).map((x) => x.amount || 0));
  const bars = (b.breakdown || []).map((x) => {
    const w = Math.max(3, Math.round((x.amount || 0) / max * 100));
    return `<div class="barlist__row">
      <span>${esc(x.label)}${x.note ? `<br><small class="muted">${esc(x.note)}</small>` : ''}</span>
      <span class="barlist__track"><span class="barlist__bar" style="width:${w}%"></span></span>
      <span class="barlist__val">${esc(x.display || x.amount)}</span>
    </div>`;
  }).join('');
  const notes = (b.notes || []).map((n) => `<li>${esc(n)}</li>`).join('');
  return `<section class="section" id="budget">
  ${sectionHead('budget', 'Budget & Fiscal')}
  ${b.intro ? `<p class="lead">${esc(b.intro)}</p>` : ''}
  <div class="grid grid-3" style="margin:18px 0">${stats}</div>
  ${bars ? `<div class="card">
    <div class="card__title">${icon('budget')} Technology &amp; security funding this biennium</div>
    <div class="barlist">${bars}</div>
  </div>` : ''}
  ${notes ? `<ul class="muted" style="font-size:.85rem;margin-top:14px">${notes}</ul>` : ''}
  ${renderAgencyShifts(d.agencyShifts)}
</section>`;
}

/* Agency-level budget shifts (data/budget-agencies/<slug>.json, phase-2) */
function renderAgencyShifts(as) {
  if (!as || !(as.agencies || []).length) return '';
  const rows = as.agencies
    .map((a) => ({ ...a, change: (a.current || 0) - (a.prior || 0) }))
    .sort((x, y) => Math.abs(y.change) - Math.abs(x.change));
  const shown = rows.slice(0, 12);
  const totP = rows.reduce((t, a) => t + (a.prior || 0), 0);
  const totC = rows.reduce((t, a) => t + (a.current || 0), 0);
  const totPct = totP ? ((totC / totP - 1) * 100) : null;
  const tr = (a) => {
    const pct = a.prior ? (a.change / a.prior * 100) : null;
    return `<tr>
      <td class="rowhead"><b>${esc(a.name)}</b></td>
      <td class="num" data-label="${esc(as.priorLabel || 'Prior')}">${moneyShort(a.prior)}</td>
      <td class="num" data-label="${esc(as.currentLabel || 'Current')}">${moneyShort(a.current)}</td>
      <td class="num" data-label="&Delta; $"><span class="${a.change < 0 ? 'delta-neg' : 'delta-pos'}">${a.change < 0 ? '−' : '+'}${moneyShort(Math.abs(a.change)).replace('$', '$')}</span></td>
      <td class="num" data-label="&Delta; %">${pct != null ? fmtPct(pct) : '<span class="muted">&mdash;</span>'}</td>
    </tr>`;
  };
  const srcs = (as.sources || []).map((s) =>
    `<a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.label)}</a>`).join(' &middot; ');
  const notes = (as.notes || []).map((n) => `<li>${esc(n)}</li>`).join('');
  return `<div class="card table-card bsr-table bsr-stack" style="margin-top:18px">
    <div class="card__title">${icon('budget')} Agency budget shifts &mdash; ${esc(as.priorLabel || 'prior')} vs. ${esc(as.currentLabel || 'current')}</div>
    <p class="muted" style="font-size:.85rem;margin:0 16px 10px">${esc(as.basis || '')} Statewide: ${moneyShort(totP)} &rarr; ${moneyShort(totC)}${totPct != null ? ` (${(totPct > 0 ? '+' : '') + totPct.toFixed(1)}%)` : ''}. Top ${shown.length} movers of ${rows.length} agencies.</p>
    <table class="data-table">
      <thead><tr><th>Agency</th><th class="num">Prior</th><th class="num">Current</th><th class="num">&Delta; $</th><th class="num">&Delta; %</th></tr></thead>
      <tbody>${shown.map(tr).join('')}</tbody>
    </table>
    ${notes ? `<ul class="muted" style="font-size:.8rem;margin:10px 16px">${notes}</ul>` : ''}
    ${srcs ? `<p class="muted" style="font-size:.78rem;margin:6px 16px 14px">Source: ${srcs}</p>` : ''}
  </div>`;
}

function renderInitiatives(d) {
  const cards = (d.initiatives || []).map((i) => {
    const tags = (i.tags || []).map((t) => `<span class="tag">${esc(t)}</span>`).join('');
    return `<div class="card card--hover init-card">
      <div class="init-card__head">
        <h3>${esc(i.name)}${ref(i.ref)}</h3>
        ${badge(i.status, i.statusType)}
      </div>
      <p>${esc(i.summary)}</p>
      <div class="init-card__meters">
        ${meter('Dell fit', i.dellFit, i.dellFit >= 75 ? 'good' : (i.dellFit >= 50 ? '' : 'warn'))}
        ${meter('Budget strength', i.budgetStrength, 'good')}
      </div>
      ${tags ? `<div class="init-card__tags">${tags}</div>` : ''}
    </div>`;
  }).join('');
  return `<section class="section" id="initiatives">
  ${sectionHead('initiatives', 'Initiatives & Policy')}
  <div class="grid grid-2">${cards}</div>
</section>`;
}

function renderProcurement(d) {
  const pr = d.procurement || {};
  const vehicles = (pr.vehicles || []).map((v) =>
    `<tr><td><b>${esc(v.name)}</b></td><td>${esc(v.detail)}</td></tr>`).join('');
  const entities = (pr.entities || []).map((e) =>
    `<tr><td><b>${esc(e.name)}</b></td><td>${esc(e.role)}</td></tr>`).join('');
  return `<section class="section" id="procurement">
  ${sectionHead('procurement', 'Procurement & Competition')}
  ${pr.intro ? `<p class="lead">${esc(pr.intro)}</p>` : ''}
  <div class="card table-card" style="margin:18px 0">
    <table class="data-table"><thead><tr><th>Vehicle / gate</th><th>What it means for Dell</th></tr></thead>
    <tbody>${vehicles}</tbody></table>
  </div>
  <div class="grid grid-2">
    <div class="card table-card">
      <table class="data-table"><thead><tr><th>Key buying entity</th><th>Role</th></tr></thead>
      <tbody>${entities}</tbody></table>
    </div>
    ${pr.competition ? `<div class="highlight-panel">
      <div class="highlight-panel__head">${icon('procurement')} Competitive landscape</div>
      <p style="font-size:.93rem;color:var(--c-ink-2)">${esc(pr.competition)}</p>
    </div>` : ''}
  </div>
</section>`;
}

function renderPower(d) {
  const rows = (d.powerStructure || []).map((x) =>
    `<tr><td><b>${esc(x.name)}</b>${ref(x.ref)}<br><small class="muted">${esc(x.title)}${x.org ? ` &middot; ${esc(x.org)}` : ''}</small></td><td>${esc(x.note)}</td></tr>`).join('');
  return `<section class="section" id="power">
  ${sectionHead('power', 'Power Structure')}
  <div class="card table-card">
    <table class="data-table"><thead><tr><th>Decision-maker</th><th>Why they matter</th></tr></thead>
    <tbody>${rows}</tbody></table>
  </div>
</section>`;
}

function renderNews(d) {
  const items = (d.news || []).map((n) => {
    const dt = fmtDate(n.date);
    const tags = (n.tags || []).map((t) => `<span class="tag">${esc(t)}</span>`).join('');
    return `<div class="tl-item">
      <div class="tl-date">${esc(dt.top)} ${esc(dt.yr)}</div>
      ${tags ? `<div class="tl-tags">${tags}</div>` : ''}
      <div class="tl-title">${esc(n.title)}${ref(n.ref)}</div>
      <div class="tl-impact">${esc(n.impact)}</div>
    </div>`;
  }).join('');
  const sources = (d.sources || []).map((s, i) =>
    `<li id="src-${i + 1}"><a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.label)}</a></li>`).join('');
  return `<section class="section" id="news">
  ${sectionHead('news', 'News & Signals')}
  <div class="timeline">${items}</div>
  ${sources ? `<div class="sources"><h3>Sources</h3><ol>${sources}</ol></div>` : ''}
</section>`;
}

function tocLink(id, iconName, label) {
  return `<a href="#${id}">${icon(iconName)}<span class="toc-label">${label}</span></a>`;
}

/* ---- Top Accounts directory (state breakout pages) ----------------------- */
const ACCT_TYPE_ORDER = ['State Agency', 'Higher Ed', 'County', 'City', 'Special District', 'Court', 'K-12', 'Other'];
const ACCT_TYPE_LABEL = {
  'State Agency': 'State Agencies', 'Higher Ed': 'Higher Education', 'County': 'Counties',
  'City': 'Cities', 'Special District': 'Special Districts & Authorities', 'Court': 'Courts', 'K-12': 'K-12 Districts', 'Other': 'Other',
};
const ACCT_TYPE_KEY = {
  'State Agency': 'agency', 'Higher Ed': 'highered', 'County': 'county', 'City': 'city',
  'Special District': 'district', 'Court': 'court', 'K-12': 'k12',
};

let _focused = null;
function focusedAccounts(slug) {
  if (_focused === null) {
    try { _focused = readJSON('data/focused-accounts.json'); } catch (e) { _focused = {}; }
  }
  return _focused[slug] || null;
}

function renderAccounts(d) {
  const accts = focusedAccounts(d.slug) || d.accounts || [];
  if (!accts.length) return '';
  const href = (a) => `${d.slug}/${a.slug}.html`;
  const present = [...new Set(accts.map((a) => a.type || 'Other'))];
  const types = ACCT_TYPE_ORDER.filter((t) => present.includes(t))
    .concat(present.filter((t) => !ACCT_TYPE_ORDER.includes(t)));
  const card = (a) => {
    const tkey = ACCT_TYPE_KEY[a.type] || 'other';
    const inner = `
        <div class="acct-card__top">
          <span class="acct-badge acct-badge--${tkey}">${esc(a.type || 'Account')}</span>
          ${a.available ? icon('go', 'acct-go') : '<span class="soon-tag">soon</span>'}
        </div>
        <div class="acct-card__name">${esc(a.name)}</div>
        ${a.hq ? `<div class="acct-card__hq">${icon('pin')} ${esc(a.hq)}</div>` : ''}
        ${a.blurb ? `<div class="acct-card__blurb">${esc(a.blurb)}</div>` : ''}`;
    return a.available
      ? `<a class="acct-card" href="${esc(href(a))}">${inner}</a>`
      : `<div class="acct-card is-soon">${inner}</div>`;
  };
  const groups = types.map((t) => {
    const items = accts.filter((a) => (a.type || 'Other') === t);
    return `<div class="acct-group">
        <h3>${esc(ACCT_TYPE_LABEL[t] || t)} <span class="acct-count">${items.length}</span></h3>
        <div class="acct-grid">${items.map(card).join('')}</div>
      </div>`;
  }).join('');
  return `<section class="accounts">
  <div class="accounts__inner">
    <div class="accounts__head">
      <h2>${icon('procurement')} Top Accounts in ${esc(d.name)}</h2>
      <span class="muted">${accts.length} account${accts.length === 1 ? '' : 's'} &middot; market intel companion</span>
    </div>
    ${groups}
  </div>
</section>`;
}

function renderState(d) {
  const chips = (d.snapshot || []).map((c) =>
    `<span class="chip"><b>${esc(c.value)}</b><span>${esc(c.label)}</span></span>`).join('');
  const toc = [
    tocLink('summary', 'summary', 'Summary'),
    tocLink('budget', 'budget', 'Budget'),
    tocLink('initiatives', 'initiatives', 'Initiatives'),
    tocLink('procurement', 'procurement', 'Procurement'),
    tocLink('power', 'power', 'Power Structure'),
    tocLink('news', 'news', 'Signals'),
  ].join('\n      ');

  return `${head(`${d.name} | Dell SLG Strategy Hub`, '../assets/css/styles.css')}
<body>
${siteHeader('../', true)}

<section class="report-hero">
  <div class="report-hero__inner">
    <div class="crumbs"><a href="../index.html">All States</a> ${icon('chevron')} <span>${esc(d.name)}</span></div>
    <p class="eyebrow">${icon('pin')} ${esc(d.region || 'State')} &middot; SLG Market Intelligence</p>
    <h1>${esc(d.name)}</h1>
    ${d.tagline ? `<p class="tagline">${esc(d.tagline)}</p>` : ''}
    <div class="report-hero__meta">
      <span class="updated-pill"><span class="dot"></span> Last updated ${esc(fmtLong(d.updated))}</span>
    </div>
    ${chips ? `<div class="snapshot">${chips}</div>` : ''}
  </div>
</section>

${renderAccounts(d)}

<div class="report-shell">
  <nav class="toc" aria-label="Sections">
    <div class="toc__label">On this page</div>
      ${toc}
  </nav>
  <main class="report-main">
    ${renderExecSummary(d)}
    ${renderBudget(d)}
    ${renderInitiatives(d)}
    ${renderProcurement(d)}
    ${renderPower(d)}
    ${renderNews(d)}
  </main>
</div>

${siteFooter('../', d.updated)}
<script src="../assets/js/nav.js"></script>
</body>
</html>`;
}

/* ====================================================================== */
/*  ACCOUNT BRIEF PAGE                                                     */
/* ====================================================================== */
/* GovSpend "Spend Signals" — renders on any account that has a
   spendSignals block (data sourced from the GovSpend connector). */
function moneyShort(n) {
  if (n == null || isNaN(n)) return '—';
  const a = Math.abs(n);
  if (a >= 1e9) return '$' + (n / 1e9).toFixed(2).replace(/\.?0+$/, '') + 'B';
  if (a >= 1e6) return '$' + (n / 1e6).toFixed(1).replace(/\.0$/, '') + 'M';
  if (a >= 1e3) return '$' + Math.round(n / 1e3) + 'K';
  return '$' + Math.round(n);
}

function renderSpendSignals(a) {
  const s = a.spendSignals;
  if (!s) return '';
  const meta = [s.entity, s.window].filter(Boolean).map(esc).join(' &middot; ');
  const vs = (s.vendorSpend || []).slice().sort((x, y) => (y.amount || 0) - (x.amount || 0));
  const vmax = Math.max(1, ...vs.map((v) => v.amount || 0));
  const vendorRows = vs.map((v) => {
    const cls = v.tag === 'dell' ? ' is-dell' : (v.tag === 'reseller' ? ' is-reseller' : '');
    const w = Math.max(2, Math.round((v.amount || 0) / vmax * 100));
    const badge = v.tag === 'reseller' ? ' <span class="ss-pill ss-pill--reseller">reseller</span>' : '';
    return `<div class="ss-bar${cls}"><div class="ss-bar__label">${esc(v.name)}${badge}${v.dellThru ? `<span class="ss-bar__dell">~${moneyShort(v.dellThru)} Dell</span>` : ''}</div><div class="ss-bar__track"><div class="ss-bar__fill" style="width:${w}%"></div></div><div class="ss-bar__val">${moneyShort(v.amount)}</div></div>`;
  }).join('');
  const bfs = (s.brandFootprint || []).slice().sort((x, y) => (y.amount || 0) - (x.amount || 0));
  const bfmax = Math.max(1, ...bfs.map((b) => b.amount || 0));
  const brandRows = bfs.map((b) => {
    const cls = b.tag === 'dell' ? ' is-dell' : '';
    const w = Math.max(2, Math.round((b.amount || 0) / bfmax * 100));
    return `<div class="ss-bar${cls}"><div class="ss-bar__label">${esc(b.name)}</div><div class="ss-bar__track"><div class="ss-bar__fill" style="width:${w}%"></div></div><div class="ss-bar__val">${moneyShort(b.amount)}</div></div>`;
  }).join('');
  const cats = (s.categories || []).slice().sort((x, y) => (y.amount || 0) - (x.amount || 0)).map((c) => `<div class="ss-cat"><b>${moneyShort(c.amount)}</b><span>${esc(c.name)}</span></div>`).join('');
  const contracts = (s.expiringContracts || []).map((c) =>
    `<tr><td><b>${c.url ? `<a href="${esc(c.url)}" target="_blank" rel="noopener">${esc(c.title)}</a>` : esc(c.title)}</b>${c.vendor ? `<br><small class="muted">${esc(c.vendor)}</small>` : ''}</td><td class="nowrap">${esc(fmtLong(c.endDate))}</td></tr>`).join('');
  const bids = (s.openBids || []).map((b) =>
    `<tr><td><b>${b.url ? `<a href="${esc(b.url)}" target="_blank" rel="noopener">${esc(b.title)}</a>` : esc(b.title)}</b>${b.agency ? `<br><small class="muted">${esc(b.agency)}</small>` : ''}</td><td class="nowrap">${esc(fmtLong(b.dueDate))}</td></tr>`).join('');
  const notes = (s.notes || []).map((n) => `<li>${esc(n)}</li>`).join('');
  const fp = s.dellFootprint;
  const footprint = fp ? `<div class="ss-footprint"><div class="ss-footprint__val">${moneyShort(fp.allChannels)}</div><div class="ss-footprint__body"><div class="ss-footprint__lbl">Dell footprint &mdash; all channels${s.window ? ` (${esc(s.window)})` : ''}, est.</div><div class="ss-footprint__break">Direct <b>${moneyShort(fp.direct)}</b>${fp.viaResellers != null ? ` &middot; via resellers <b>~${moneyShort(fp.viaResellers)}</b>` : ''}${(fp.topResellers || []).length ? ` &middot; ${fp.topResellers.map((r) => `${esc(r.name)} ~${moneyShort(r.amount)}`).join(', ')}` : ''}</div></div></div>` : '';
  const col = (title, body) => body ? `<div class="ss-col"><h3 class="ss-col__title">${esc(title)}</h3>${body}</div>` : '';
  return `<section class="section ss-section">
    <div class="section__head"><span class="section__icon">${icon('budget')}</span><h2>Spend Signals</h2><span class="ss-flag">${esc(s.source || 'GovSpend')}${s.updated ? ` &middot; as of ${esc(fmtLong(s.updated))}` : ''}</span></div>
    ${meta ? `<p class="muted ss-meta">${meta}</p>` : ''}
    ${footprint}
    <div class="ss-grid">
      ${col('Dell vs. competitors (spend, payee)', vendorRows ? `<div class="card"><div class="ss-bars">${vendorRows}</div></div>` : '')}
      ${col('Brand footprint — all channels (est.)', brandRows ? `<div class="card"><div class="ss-bars">${brandRows}</div><p class="ss-hint">Higher of two conservative lenses: product-name match &middot; manufacturer tag. Both undercount &mdash; treat as floors.</p></div>` : '')}
    </div>
    ${cats ? `<div class="ss-col ss-col--full"><h3 class="ss-col__title">Top IT categories</h3><div class="card"><div class="ss-cat-grid">${cats}</div></div></div>` : ''}
    <div class="ss-grid">
      ${col('Expiring contracts (re-compete)', contracts ? `<div class="card table-card"><table class="data-table"><thead><tr><th>Contract</th><th>Expires</th></tr></thead><tbody>${contracts}</tbody></table></div>` : '')}
      ${col('Open bids / RFPs', bids ? `<div class="card table-card"><table class="data-table"><thead><tr><th>Solicitation</th><th>Due</th></tr></thead><tbody>${bids}</tbody></table></div>` : '')}
    </div>
    ${notes ? `<ul class="muted ss-notes">${notes}</ul>` : ''}
  </section>`;
}

function renderAccountBrief(a) {
  const chips = (a.snapshot || []).map((c) =>
    `<span class="chip"><b>${esc(c.value)}</b><span>${esc(c.label)}</span></span>`).join('');
  const power = (a.powerStructure || []).map((b) =>
    `<tr><td><b>${esc(b.name)}</b><br><small class="muted">${esc(b.title)}</small></td><td>${esc(b.note)}</td></tr>`).join('');
  const pr = a.procurement || {};
  const vehicles = (pr.vehicles || []).map((v) =>
    `<tr><td><b>${esc(v.name)}</b></td><td>${esc(v.detail)}</td></tr>`).join('');
  const inits = (a.initiatives || []).map((i) =>
    `<div class="card"><div class="card__title">${esc(i.name)}</div><p style="font-size:.92rem;margin-bottom:10px">${esc(i.summary)}</p>${(i.tags || []).map((t) => `<span class="tag">${esc(t)}</span>`).join(' ')}</div>`).join('');
  const news = (a.news || []).map((n) => {
    const dt = fmtDate(n.date);
    const tags = (n.tags || []).map((t) => `<span class="tag">${esc(t)}</span>`).join('');
    return `<div class="tl-item"><div class="tl-date">${esc(dt.top)} ${esc(dt.yr)}</div>${tags ? `<div class="tl-tags">${tags}</div>` : ''}<div class="tl-title">${esc(n.title)}</div><div class="tl-impact">${esc(n.impact)}</div></div>`;
  }).join('');
  const actions = (a.dellActions || []).map((x) => `<li>${icon('check')}<span>${esc(x)}</span></li>`).join('');
  const sources = (a.sources || []).map((s) => `<li><a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.label)}</a></li>`).join('');
  const bud = a.budget;
  const budStats = bud ? (bud.stats || []).map((s) => statTile(s, 'budget')).join('') : '';
  const budNotes = bud ? (bud.notes || []).map((n) => `<li>${esc(n)}</li>`).join('') : '';
  const tkey = ACCT_TYPE_KEY[a.type] || 'other';
  const spend = renderSpendSignals(a);
  const sec = (iconName, title, body) => `<section class="section"><div class="section__head"><span class="section__icon">${icon(iconName)}</span><h2>${esc(title)}</h2></div>${body}</section>`;
  return `${head(`${a.name} | ${a.stateName} | Dell SLG Strategy Hub`, '../../assets/css/styles.css')}
<body>
${siteHeader('../../', false)}

<section class="report-hero">
  <div class="report-hero__inner">
    <div class="crumbs"><a href="../../index.html">All States</a> ${icon('chevron')} <a href="../${esc(a.state)}.html">${esc(a.stateName)}</a> ${icon('chevron')} <span>${esc(a.name)}</span></div>
    <p class="eyebrow"><span class="acct-badge acct-badge--${tkey}">${esc(a.type)}</span> &nbsp;${esc(a.stateName)} &middot; Account Intelligence</p>
    <h1>${esc(a.name)}</h1>
    ${a.tagline ? `<p class="tagline">${esc(a.tagline)}</p>` : ''}
    <div class="report-hero__meta">
      ${a.hq ? `<span class="updated-pill">${icon('pin')} ${esc(a.hq)}</span>` : ''}
      <span class="updated-pill"><span class="dot"></span> Last updated ${esc(fmtLong(a.updated))}</span>
    </div>
    ${chips ? `<div class="snapshot">${chips}</div>` : ''}
  </div>
</section>

<main class="brief">
  ${a.overview ? sec('summary', 'Overview', `<p class="lead">${esc(a.overview)}</p>`) : ''}
  ${bud ? sec('budget', 'Budget & Fiscal', `${bud.intro ? `<p class="lead">${esc(bud.intro)}</p>` : ''}${budStats ? `<div class="grid grid-3" style="margin:16px 0">${budStats}</div>` : ''}${budNotes ? `<ul class="muted" style="font-size:.85rem;margin:0">${budNotes}</ul>` : ''}`) : ''}
  ${inits ? sec('initiatives', 'Initiatives & Priorities', `<div class="grid grid-2">${inits}</div>`) : ''}
  ${vehicles ? sec('procurement', 'Procurement', `${pr.intro ? `<p class="lead">${esc(pr.intro)}</p>` : ''}<div class="card table-card" style="margin-top:14px"><table class="data-table"><thead><tr><th>Vehicle / gate</th><th>What it means for Dell</th></tr></thead><tbody>${vehicles}</tbody></table></div>`) : ''}${spend}
  ${power ? sec('power', 'Power Structure', `<div class="card table-card"><table class="data-table"><thead><tr><th>Decision-maker</th><th>Why they matter</th></tr></thead><tbody>${power}</tbody></table></div>`) : ''}
  ${news ? sec('news', 'News & Signals', `<div class="timeline">${news}</div>`) : ''}
  ${actions ? `<section class="section"><div class="callout"><div class="callout__head"><span class="section__icon">${icon('bolt')}</span><h3>Where Dell Can Play</h3></div><ul class="action-list">${actions}</ul></div></section>` : ''}
  ${sources ? `<section class="section"><div class="sources"><h3>Sources</h3><ol>${sources}</ol></div></section>` : ''}
</main>

${siteFooter('../../', a.updated, !!a.spendSignals)}
</body>
</html>`;
}

/* ====================================================================== */
/*  MAIN                                                                   */
/* ====================================================================== */
function main() {
  const manifest = readJSON('data/states.json');
  const svgRaw = read('templates/us-map.svg');
  const hasBudgetShifts = fs.existsSync(p('data/budget-shifts.json'));

  fs.writeFileSync(p('index.html'), renderIndex(manifest, svgRaw, hasBudgetShifts));
  console.log('  index.html');

  // agency-level drill-down data (phase 2), keyed by state slug
  const agencyData = {};
  if (fs.existsSync(p('data/budget-agencies'))) {
    for (const f of fs.readdirSync(p('data/budget-agencies'))) {
      if (f.endsWith('.json')) agencyData[f.slice(0, -5)] = readJSON(`data/budget-agencies/${f}`);
    }
  }

  if (hasBudgetShifts) {
    const bs = readJSON('data/budget-shifts.json');
    if (!fs.existsSync(p('reports'))) fs.mkdirSync(p('reports'), { recursive: true });
    fs.writeFileSync(p('reports', 'budget-shifts.html'), renderBudgetShifts(bs, manifest, agencyData));
    console.log('  reports/budget-shifts.html');
  }

  let built = 0, accts = 0;
  for (const st of manifest.states) {
    if (!st.available) continue;
    const dataPath = `data/states/${st.slug}.json`;
    if (!fs.existsSync(p(dataPath))) {
      console.warn(`  ! ${st.name}: marked available but ${dataPath} is missing — skipped`);
      continue;
    }
    const d = readJSON(dataPath);
    if (agencyData[st.slug]) d.agencyShifts = agencyData[st.slug];
    fs.writeFileSync(p('states', `${st.slug}.html`), renderState(d));
    console.log(`  states/${st.slug}.html`);
    built++;

    // Account intelligence pages for this state's available accounts
    for (const acct of (focusedAccounts(st.slug) || d.accounts || [])) {
      if (!acct.available) continue;
      const aPath = `data/accounts/${st.slug}/${acct.slug}.json`;
      if (!fs.existsSync(p(aPath))) {
        console.warn(`  ! ${st.slug}/${acct.slug}: marked available but ${aPath} is missing — skipped`);
        continue;
      }
      const dir = p('states', st.slug);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(p('states', st.slug, `${acct.slug}.html`), renderAccountBrief(readJSON(aPath)));
      console.log(`    states/${st.slug}/${acct.slug}.html`);
      accts++;
    }
  }
  console.log(`\nDone. 1 landing page + ${built} state page(s) + ${accts} account brief(s).`);
}
main();
