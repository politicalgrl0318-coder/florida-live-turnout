import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

const root = fileURLToPath(new URL('..', import.meta.url));
const require = createRequire(import.meta.url);
const snapshot = require('../public/data/general-official-snapshot.json');
const parties = ['rep', 'dem', 'npa', 'other'];
// Test pre-opening behavior independently of the current dated snapshot.
for (const county of snapshot.counties) county.early = {rep:0,dem:0,npa:0,other:0,total:0};
snapshot.totals.early = {rep:0,dem:0,npa:0,other:0,total:0};
const format = n => n.toLocaleString('en-US');
const sum = split => parties.reduce((n, p) => n + split[p], 0);

// Render the actual dashboard and comparison component with deterministic feed
// state. No network or browser timing is needed to exercise both selected views.
function renderDashboard(view, counties = [], state = snapshot) {
  let stateIndex = 0;
  const modules = new Map();
  const hooks = {
    ...React,
    useEffect() {},
    useMemo: fn => fn(),
    useState(initial) {
      const index = stateIndex++;
      return [index === 0 ? view : index === 1 ? state : index === 7 ? { counties } : initial, () => {}];
    },
  };
  function load(filename) {
    if (modules.has(filename)) return modules.get(filename).exports;
    const module = { exports: {} };
    modules.set(filename, module);
    const result = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
      compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
      fileName: filename,
    });
    const localRequire = specifier => {
      if (specifier === 'react') return hooks;
      if (specifier.endsWith('.css')) return {};
      if (specifier.startsWith('.')) {
        const resolved = path.resolve(path.dirname(filename), specifier);
        return specifier.endsWith('.json') ? require(resolved) : load(resolved + (fs.existsSync(resolved + '.tsx') ? '.tsx' : '.ts'));
      }
      return require(specifier);
    };
    vm.runInThisContext(`(function(require,module,exports){${result.outputText}\n})`, { filename })(localRequire, module, module.exports);
    return module.exports;
  }
  const Page = load(path.join(root, 'app/general/page.tsx')).default;
  return renderToStaticMarkup(React.createElement(Page));
}

function tableRows(html, label) {
  const table = html.match(new RegExp(`<table aria-label="${label}">([\\s\\S]*?)</table>`));
  assert.ok(table, `Missing ${label}`);
  return [...table[1].matchAll(/<tr>([\s\S]*?)<\/tr>/g)].slice(1).map(match =>
    [...match[1].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map(cell => cell[1].replace(/<[^>]*>/g, '')),
  );
}

function liveCounty(extraEarly = 0, extraElectionDay = 0) {
  const county = snapshot.counties.find(c => c.code === 'DAD');
  const mailParty = Object.fromEntries(parties.map((p, i) => [p, county.voted[p] + i + 1]));
  const earlyParty = { rep: 0, dem: extraEarly, npa: 0, other: 0 };
  const electionDayParty = { rep: extraElectionDay, dem: 0, npa: 0, other: 0 };
  const mail = sum(mailParty);
  const ballots = mail + extraEarly + extraElectionDay;
  return {
    code: county.code, name: county.name, status: 'live', sourceUrl: 'https://example.com/report',
    registered: 1000000, turnout: ballots / 10000, ballots, mail,
    early: extraEarly, electionDay: extraElectionDay, mailParty, earlyParty, electionDayParty,
    ...Object.fromEntries(parties.map(p => [p, mailParty[p] + earlyParty[p] + electionDayParty[p]])),
    updated: '2026-10-14T03:00:00Z',
  };
}

test('summary card party breakdowns match each method, including state fallback early votes', () => {
  const state = structuredClone(snapshot);
  const fallback = state.counties.find(c => c.code === 'CLL');
  fallback.early.other += 3;
  fallback.early.total += 3;
  const html = renderDashboard('turnout', [liveCounty(7, 5)], state);
  const cards = Object.fromEntries(['Ballots cast', 'Vote by mail', 'Early voting', 'Election Day'].map(label => {
    const block = html.match(new RegExp(`<article><label>${label}</label><strong>([\\s\\S]*?)</strong>([\\s\\S]*?)</article>`));
    assert.ok(block, `Missing ${label} card`);
    const entries = [...block[2].matchAll(/<dt[^>]*>([^<]+)<\/dt><dd><span>([^<]+)<\/span><small[^>]*>([^<]+)<\/small><\/dd>/g)];
    assert.equal(entries.length, 4);
    const values = Object.fromEntries(entries.map(([, party, value]) => [party.toLowerCase(), Number(value.replaceAll(',', ''))]));
    assert.equal(sum(values), Number(block[1].replaceAll(',', '')), `${label} party sum`);
    for (const [, party, , share] of entries) assert.equal(share, sum(values) ? `${(values[party.toLowerCase()] / sum(values) * 100).toFixed(2)}%` : '—');
    return [label, values];
  }));
  assert.deepEqual(cards['Early voting'], { dem: 7, rep: 0, npa: 0, other: 3 });
  assert.deepEqual(cards['Election Day'], { dem: 0, rep: 5, npa: 0, other: 0 });
  for (const p of parties) assert.equal(cards['Ballots cast'][p], cards['Vote by mail'][p] + cards['Early voting'][p] + cards['Election Day'][p]);
});

test('live returns and cast agree before in-person voting, including state fallback counties', () => {
  const html = renderDashboard('turnout', [liveCounty()]);
  const rows = tableRows(html, 'Live turnout and VBM returns by party');
  const liveTotal = snapshot.totals.voted.total + 10;
  for (const [i, p] of parties.entries()) {
    const returned = snapshot.totals.voted[p] + i + 1;
    assert.equal(rows[i][1], format(returned));
    assert.equal(rows[i][2], format(returned));
    assert.equal(rows[i][4], `${(returned / liveTotal * 100).toFixed(2)}%`);
  }
  assert.match(html, new RegExp(`<label>Ballots cast</label><strong>${format(liveTotal)}</strong>`));
  assert.match(html, new RegExp(`<label>Vote by mail</label><strong>${format(liveTotal)}</strong>`));
});

test('live in-person ballots explain the cast-versus-mail difference by party', () => {
  const rows = tableRows(renderDashboard('turnout', [liveCounty(7, 5)]), 'Live turnout and VBM returns by party');
  const count = value => Number(value.replaceAll(',', ''));
  assert.equal(count(rows[0][2]) - count(rows[0][1]), 5);
  assert.equal(count(rows[1][2]) - count(rows[1][1]), 7);
  assert.equal(rows[2][1], rows[2][2]);
  assert.equal(rows[3][1], rows[3][2]);
});

test('live updates do not change matched state conversion counts or rates', () => {
  const html = renderDashboard('turnout', [liveCounty()]);
  const rows = tableRows(html, 'State snapshot VBM conversion by party');
  for (const [i, p] of parties.entries()) {
    const provided = snapshot.totals.provided[p] + snapshot.totals.voted[p];
    assert.equal(rows[i][1], format(provided));
    assert.equal(rows[i][2], format(snapshot.totals.voted[p]));
    assert.equal(rows[i][3], `${(snapshot.totals.voted[p] / provided * 100).toFixed(2)}%`);
  }
  assert.match(html, /State snapshot: VBM conversion by party/);
});

test('no live feed uses state fallback consistently in the live table', () => {
  const rows = tableRows(renderDashboard('turnout'), 'Live turnout and VBM returns by party');
  for (const [i, p] of parties.entries()) {
    assert.equal(rows[i][1], format(snapshot.totals.voted[p]));
    assert.equal(rows[i][2], format(snapshot.totals.voted[p] + snapshot.totals.early[p]));
  }
});

test('state view keeps its reported returns and cast independent of active live feeds', () => {
  const rows = tableRows(renderDashboard('state', [liveCounty(7, 5)]), 'State turnout and VBM conversion by party');
  for (const [i, p] of parties.entries()) {
    assert.equal(rows[i][4], format(snapshot.totals.voted[p]));
    assert.equal(rows[i][5], format(snapshot.totals.voted[p] + snapshot.totals.early[p]));
  }
});

test('county API reconciles party totals with displayed methods when TQV includes provisional records', async () => {
  // Reduced Nassau TQV fixture, 2026-10-14 03:50 UTC: 3,128 mail
  // records and two additional NPA provisional records.
  const feed = {
    Summary: { ElectionName: '2026 General Election', ElectionDate: '11/03/2026', TotalRegisteredVoters: 81805 },
    Turnout: {
      PartyType: { DEM: { Mail: 1026 }, REP: { Mail: 1474 }, NPA: { Mail: 536, Provisional: 2 }, IND: { Mail: 80 }, CSV: { Mail: 3 }, FFP: { Mail: 1 }, LPF: { Mail: 7 }, UNK: { Mail: 1 } },
      DateType: { '10/13/2026': { Mail: 3128, Provisional: 2 } },
    },
  };
  const filename = path.join(root, 'app/api/general-turnout/route.ts');
  const { outputText } = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }, fileName: filename,
  });
  const module = { exports: {} };
  const fetch = async url => {
    if (url.endsWith('/NAS/index.json')) return Response.json([127]);
    if (url.endsWith('/NAS/127/data.json')) return Response.json(feed);
    return new Response('Unavailable', { status: 404 });
  };
  const next = { NextResponse: { json: (body, init) => Response.json(body, init) } };
  vm.runInNewContext(`(function(require,module,exports){${outputText}\n})`, { fetch, Response }, { filename })(() => next, module, module.exports);
  const response = await module.exports.GET({ nextUrl: new URL('https://example.com/api/general-turnout?batch=2') });
  const nassau = (await response.json()).counties.find(c => c.code === 'NAS');
  assert.equal(nassau.status, 'live');
  assert.equal(nassau.ballots, 3128);
  assert.equal(nassau.npa, 536);
  assert.equal(sum(nassau), nassau.ballots);
  for (const p of parties) assert.equal(nassau[p], nassau.mailParty[p] + nassau.earlyParty[p] + nassau.electionDayParty[p]);
});
