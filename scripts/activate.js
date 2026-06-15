#!/usr/bin/env node
/* ============================================================================
   Validate every data/states/<slug>.json and sync data/states.json so that a
   state is "available" iff it has a valid data file. Run before generate.js.
   Usage:  node scripts/activate.js
   ========================================================================== */
'use strict';
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const p = (...a) => path.join(ROOT, ...a);

const REQUIRED = ['code', 'name', 'slug', 'updated', 'execSummary', 'budget', 'initiatives', 'procurement', 'powerStructure', 'news', 'sources'];

function validate(slug) {
  const f = p('data', 'states', `${slug}.json`);
  if (!fs.existsSync(f)) return { ok: false, reason: 'no file' };
  let d;
  try { d = JSON.parse(fs.readFileSync(f, 'utf8')); }
  catch (e) { return { ok: false, reason: 'invalid JSON: ' + e.message }; }
  const missing = REQUIRED.filter((k) => d[k] == null);
  if (missing.length) return { ok: false, reason: 'missing: ' + missing.join(', ') };
  if (d.slug !== slug) return { ok: false, reason: `slug mismatch (${d.slug})` };
  // soft warnings
  const warn = [];
  if ((d.snapshot || []).length !== 4) warn.push(`snapshot=${(d.snapshot || []).length}`);
  if ((d.execSummary.stats || []).length !== 4) warn.push(`execStats=${(d.execSummary.stats || []).length}`);
  const maxRef = Math.max(0, ...JSON.stringify(d).match(/"ref":\s*(\d+)/g)?.map((m) => +m.replace(/\D/g, '')) || [0]);
  if (maxRef > (d.sources || []).length) warn.push(`ref ${maxRef} > ${d.sources.length} sources`);
  return { ok: true, warn };
}

const manifest = JSON.parse(fs.readFileSync(p('data/states.json'), 'utf8'));
let text = fs.readFileSync(p('data/states.json'), 'utf8');
let live = 0, broken = 0;
const rows = [];

for (const st of manifest.states) {
  const r = validate(st.slug);
  const want = r.ok;
  if (want) live++; else if (fs.existsSync(p('data', 'states', `${st.slug}.json`))) broken++;
  // rewrite this state's available flag in the raw text (preserves formatting)
  const re = new RegExp(`("slug":\\s*"${st.slug}",\\s*"available":\\s*)(true|false)`);
  text = text.replace(re, `$1${want}`);
  if (!r.ok && r.reason !== 'no file') rows.push(`  ✗ ${st.slug}: ${r.reason}`);
  else if (r.ok && r.warn.length) rows.push(`  ⚠ ${st.slug}: ${r.warn.join(', ')}`);
  else if (r.ok) rows.push(`  ✓ ${st.slug}`);
}

fs.writeFileSync(p('data/states.json'), text);
console.log(rows.join('\n'));
console.log(`\n${live} live, ${broken} present-but-invalid. Manifest synced.`);
