import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import ts from 'typescript';

const source = readFileSync(new URL('../app/general/page.tsx', import.meta.url), 'utf8') + '\n' + readFileSync(new URL('../app/general/county-reports.ts', import.meta.url), 'utf8');
const ast = ts.createSourceFile('page.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const wanted = new Set(['isCurrentGeneral', 'usableCounty', 'mergeCountyRows', 'vbmOnlySource', 'sumParties']);
const functions = ast.statements.filter(node => ts.isFunctionDeclaration(node) && wanted.has(node.name?.text));
assert.equal(functions.length, wanted.size, 'All testable live-feed helpers must be present');
const compiled = ts.transpileModule(functions.map(node => node.getText(ast).replace(/^export /, '')).join('\n'), {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
  reportDiagnostics: true
});
const { isCurrentGeneral, usableCounty, mergeCountyRows, vbmOnlySource, sumParties } =
  new Function(`${compiled.outputText}\nreturn {${[...wanted].join(',')}};`)();

const split = (dem, rep, npa = 0, other = 0) => ({ dem, rep, npa, other });
function row(code, mail = split(20, 15, 4, 1), early = split(8, 6, 2, 0), updated = '2026-10-19T12:30:00Z') {
  const electionDayParty = split(0, 0);
  const counts = sumParties([mail, early, electionDayParty]);
  const sum = value => Object.values(value).reduce((a, b) => a + b, 0);
  return {
    code, name: code, sourceUrl: `https://example.test/${code}`,
    status: 'live', registered: 1000, mail: sum(mail), early: sum(early), electionDay: 0,
    ballots: sum(mail) + sum(early), turnout: (sum(mail) + sum(early)) / 10,
    ...counts, mailParty: mail, earlyParty: early, electionDayParty,
    updated, electionName: '2026 General Election', electionDate: '11/03/2026'
  };
}

test('TSX parses and transpiles without syntax errors', () => {
  const result = ts.transpileModule(source, {
    fileName: 'page.tsx', reportDiagnostics: true,
    compilerOptions: { target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX }
  });
  assert.deepEqual(result.diagnostics?.filter(d => d.category === ts.DiagnosticCategory.Error) || [], []);
});
test('accepts current General Election dates, not the primary or a different date', () => {
  assert.equal(isCurrentGeneral('2026 General Election', '11/03/2026'), true);
  assert.equal(isCurrentGeneral('General', '2026-11-03T00:00:00'), true);
  assert.equal(isCurrentGeneral('2026 Primary Election', '08/18/2026'), false);
  assert.equal(isCurrentGeneral('General', '11/03/2024'), false);
  assert.equal(isCurrentGeneral('General', '11/03/20260'), false);
});
test('validates method totals and all registered-party totals', () => {
  assert.equal(usableCounty(row('DAD')), true);
});
test('rejects inconsistent or missing counts instead of zero-filling them', () => {
  assert.equal(usableCounty({ ...row('DAD'), ballots: 999 }), false);
  assert.equal(usableCounty({ ...row('DAD'), dem: 999 }), false);
  assert.equal(usableCounty({ ...row('DAD'), earlyParty: null }), false);
  assert.equal(usableCounty({ ...row('DAD'), mail: -1 }), false);
  assert.equal(usableCounty({ ...row('DAD'), mail: 1.5 }), false);
  assert.equal(usableCounty(null), false);
});
test('one failed county preserves its prior verified report without erasing another update', () => {
  const old = row('MON');
  const fresh = row('DAD', split(30, 20));
  const results = mergeCountyRows([row('DAD'), old], [fresh, { ...old, status: 'unavailable' }]);
  assert.equal(results.find(r => r.code === 'DAD').ballots, fresh.ballots);
  assert.equal(results.find(r => r.code === 'DAD').stale, false);
  assert.equal(results.find(r => r.code === 'MON').ballots, old.ballots);
  assert.equal(results.find(r => r.code === 'MON').stale, true);
});
test('a failed whole batch leaves last-known counties explicitly stale', () => {
  const results = mergeCountyRows([row('DAD'), row('MON')], [row('ALA')]);
  assert.equal(results.length, 3);
  assert.equal(results.filter(r => r.stale).length, 2);
});
test('all failed batches preserve counts rather than reporting zero', () => {
  const saved = row('DAD');
  const results = mergeCountyRows([saved], []);
  assert.equal(results[0].ballots, saved.ballots);
  assert.equal(results[0].stale, true);
});
test('duplicate counties are counted once', () => {
  const results = mergeCountyRows([], [row('DAD'), row('DAD')]);
  assert.equal(results.length, 1);
});
test('older cached responses cannot replace a newer source report', () => {
  const fresh = row('DAD', split(30, 20), split(8, 6), '2026-10-19T13:00:00Z');
  const results = mergeCountyRows([fresh], [row('DAD')]);
  assert.equal(results[0].ballots, fresh.ballots);
  assert.equal(results[0].stale, true);
});
test('a newer downward correction is allowed; counts are not forced to be monotone', () => {
  const old = row('DAD', split(40, 30));
  const correction = row('DAD', split(20, 15), split(8, 6), '2026-10-19T13:00:00Z');
  const results = mergeCountyRows([old], [correction]);
  assert.equal(results[0].ballots, correction.ballots);
  assert.equal(results[0].stale, false);
});
test('invalid current data cannot overwrite a valid prior report', () => {
  const saved = row('DAD');
  const results = mergeCountyRows([saved], [{ ...saved, early: 100000 }]);
  assert.equal(results[0].ballots, saved.ballots);
  assert.equal(results[0].stale, true);
});
test('an absentee-only source is not treated as complete in-person reporting', () => {
  assert.equal(vbmOnlySource({ ...row('BRO'), sourceUrl: 'https://my.browardvotes.gov/TEDElectionLink/AbsenteeTurnOut/dashboard/view/absturnout-race' }), true);
  assert.equal(vbmOnlySource(row('DAD')), false);
  assert.match(source, /vbmOnlySource\(c\)\?"Not reported"/);
});
test('loading copy does not assert that early voting or live reporting has not begun', () => {
  assert.doesNotMatch(source, /County live-feed reporting has not begun/);
  assert.doesNotMatch(source, /live county feeds not active yet/);
  assert.match(source, /Loading live county reports/);
  assert.match(source, /Promise\.allSettled/);
  assert.match(source, /AbortSignal\.timeout\(20000\)/);
});
test('checks every minute and keeps Live as the default tab', () => {
  assert.match(source, /setInterval\(refresh,60000\)/);
  assert.match(source, /useState<"turnout"\|"state">\("turnout"\)/);
});
