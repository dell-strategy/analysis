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

function renderIndex(manifest, svgRaw) {
  const states = manifest.states;
  const live = states.filter((s) => s.available).length;
  const map = buildMapSvg(svgRaw, states);
  const options = buildStateOptions(states);

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
</section>`;
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
/* GovSpend "Procurement & Spend Signals" — renders on any account that has a
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
  const mans = (s.manufacturerShare || []).map((m) => `<tr${m.tag === 'dell' ? ' class="is-dell-row"' : ''}><td>${esc(m.name)}</td><td class="num">${moneyShort(m.amount)}</td></tr>`).join('');
  const cats = (s.categories || []).map((c) => `<div class="ss-cat"><b>${moneyShort(c.amount)}</b><span>${esc(c.name)}</span></div>`).join('');
  const contracts = (s.expiringContracts || []).map((c) =>
    `<tr><td><b>${c.url ? `<a href="${esc(c.url)}" target="_blank" rel="noopener">${esc(c.title)}</a>` : esc(c.title)}</b>${c.vendor ? `<br><small class="muted">${esc(c.vendor)}</small>` : ''}</td><td class="nowrap">${esc(fmtLong(c.endDate))}</td></tr>`).join('');
  const bids = (s.openBids || []).map((b) =>
    `<tr><td><b>${b.url ? `<a href="${esc(b.url)}" target="_blank" rel="noopener">${esc(b.title)}</a>` : esc(b.title)}</b>${b.agency ? `<br><small class="muted">${esc(b.agency)}</small>` : ''}</td><td class="nowrap">${esc(fmtLong(b.dueDate))}</td></tr>`).join('');
  const notes = (s.notes || []).map((n) => `<li>${esc(n)}</li>`).join('');
  const fp = s.dellFootprint;
  const footprint = fp ? `<div class="ss-footprint"><div class="ss-footprint__val">${moneyShort(fp.allChannels)}</div><div class="ss-footprint__body"><div class="ss-footprint__lbl">Dell footprint &mdash; all channels${s.window ? ` (${esc(s.window)})` : ''}, est.</div><div class="ss-footprint__break">Direct <b>${moneyShort(fp.direct)}</b>${fp.viaResellers != null ? ` &middot; via resellers <b>~${moneyShort(fp.viaResellers)}</b>` : ''}${(fp.topResellers || []).length ? ` &middot; ${fp.topResellers.map((r) => `${esc(r.name)} ~${moneyShort(r.amount)}`).join(', ')}` : ''}</div></div></div>` : '';
  const col = (title, body) => body ? `<div class="ss-col"><h3 class="ss-col__title">${esc(title)}</h3>${body}</div>` : '';
  return `<section class="section ss-section">
    <div class="section__head"><span class="section__icon">${icon('budget')}</span><h2>Procurement &amp; Spend Signals</h2><span class="ss-flag">${esc(s.source || 'GovSpend')}${s.updated ? ` &middot; as of ${esc(fmtLong(s.updated))}` : ''}</span></div>
    ${meta ? `<p class="muted ss-meta">${meta}</p>` : ''}
    ${footprint}
    <div class="ss-grid">
      ${col('Dell vs. competitors (spend, payee)', vendorRows ? `<div class="card"><div class="ss-bars">${vendorRows}</div></div>` : '')}
      ${col('Manufacturer spend (who made it)', mans ? `<div class="card table-card"><table class="data-table"><tbody>${mans}</tbody></table></div>` : '')}
    </div>
    ${cats ? `<div class="ss-col ss-col--full"><h3 class="ss-col__title">Top categories</h3><div class="card"><div class="ss-cat-grid">${cats}</div></div></div>` : ''}
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

  fs.writeFileSync(p('index.html'), renderIndex(manifest, svgRaw));
  console.log('  index.html');

  let built = 0, accts = 0;
  for (const st of manifest.states) {
    if (!st.available) continue;
    const dataPath = `data/states/${st.slug}.json`;
    if (!fs.existsSync(p(dataPath))) {
      console.warn(`  ! ${st.name}: marked available but ${dataPath} is missing — skipped`);
      continue;
    }
    const d = readJSON(dataPath);
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
