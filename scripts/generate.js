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
      <span class="brand__mark">SLG</span>
      <span>
        <span class="brand__title">SLG Strategy Hub</span><br>
        <span class="brand__sub">State &amp; Local Government Intelligence</span>
      </span>
    </a>
    ${showBack ? `<div class="header-actions"><a class="btn btn--ghost" href="${rootPrefix}index.html">${icon('chevron')} All States</a></div>` : ''}
  </div>
</header>`;
}

function siteFooter(updated) {
  const stamp = updated ? `Last updated ${esc(fmtLong(updated))}. ` : '';
  return `<footer class="site-footer">
  <div class="site-footer__inner">
    <span>Dell SLG Strategy Hub &middot; ${stamp}Internal sales enablement.</span>
    <span class="muted">Synthesized from public sources &middot; verify before customer use.</span>
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
  return svg;
}

function buildStateList(states) {
  return states.slice().sort((a, b) => a.name.localeCompare(b.name)).map((st) => {
    if (st.available) {
      return `      <li data-name="${esc(st.name.toLowerCase())}"><a href="states/${st.slug}.html">` +
        `<span class="name"><span class="pip"></span>${esc(st.name)}</span>${icon('go', 'go')}</a></li>`;
    }
    return `      <li class="is-soon" data-name="${esc(st.name.toLowerCase())}"><a tabindex="-1" aria-disabled="true">` +
      `<span class="name"><span class="pip"></span>${esc(st.name)}</span><span class="soon-tag">soon</span></a></li>`;
  }).join('\n');
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
  const list = buildStateList(states);

  return `${head('Dell SLG Strategy Hub | Interactive State Map', 'assets/css/styles.css')}
<body>
${siteHeader('', false)}

<section class="landing-hero">
  <div class="landing-hero__inner">
    <p class="eyebrow">Field &amp; District Sales Enablement</p>
    <h1>State &amp; Local Government strategy, state by state.</h1>
    <p class="lede">Budgets, initiatives, procurement paths, and the signals that shape each state's ability to buy technology &mdash; built for Dell sellers and district managers.</p>
    <div class="hero-stats">
      <div class="hero-stat"><b>${live}</b><span>States live</span></div>
      <div class="hero-stat"><b>${states.length}</b><span>On the roadmap</span></div>
      <div class="hero-stat"><b>6</b><span>Sections each</span></div>
      <div class="hero-stat"><b>Cited</b><span>Sourced &amp; dated</span></div>
    </div>
  </div>
</section>

<section class="wrap map-section">
  <div class="map-layout">
    <div class="panel map-panel">
      <div class="map-panel__title">
        <h2>Select a state</h2>
        <span class="hint">Click a highlighted state to open its report</span>
      </div>
      ${map}
      <div class="map-legend">
        <span><span class="swatch swatch--avail"></span> Live report</span>
        <span><span class="swatch swatch--hot"></span> Hover / selected</span>
        <span><span class="swatch swatch--soon"></span> Coming soon</span>
      </div>
    </div>

    <aside class="panel index-panel">
      <div class="index-panel__head">
        <div class="label"><h2>Browse states</h2><span class="live-count">${live} live</span></div>
        <div class="index-search-wrap">
          ${icon('search')}
          <input type="text" class="index-search" id="stateSearch" placeholder="Search states&hellip;" aria-label="Search states">
        </div>
      </div>
      <ul class="state-list" id="stateList">
${list}
      </ul>
    </aside>
  </div>

  <div class="features">
    ${feature('budget', 'Budget & fiscal', 'Where the money is — IT budgets, fiscal cycles, and funding news that affects buying power.')}
    ${feature('initiatives', 'Initiatives & policy', 'Modernization, AI, and cyber programs — scored for Dell fit and budget strength.')}
    ${feature('procurement', 'Procurement & competition', 'Contract vehicles, key buying entities, and how Dell sells in each state.')}
  </div>
</section>

${siteFooter('')}
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

${siteFooter(d.updated)}
<script src="../assets/js/nav.js"></script>
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

  let built = 0;
  for (const st of manifest.states) {
    if (!st.available) continue;
    const dataPath = `data/states/${st.slug}.json`;
    if (!fs.existsSync(p(dataPath))) {
      console.warn(`  ! ${st.name}: marked available but ${dataPath} is missing — skipped`);
      continue;
    }
    fs.writeFileSync(p('states', `${st.slug}.html`), renderState(readJSON(dataPath)));
    console.log(`  states/${st.slug}.html`);
    built++;
  }
  console.log(`\nDone. 1 landing page + ${built} state page(s).`);
}
main();
