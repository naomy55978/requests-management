// Verification of the summary cache (M5, D-11): a cache hit is faster, a hit does not touch the database,
// the entry expires on its own after 60 seconds, and every successful status change (single and bulk)
// is visible in the summary immediately, while a failed change leaves the cache alone.
//
// Requirements: the API is running, the database is seeded, Node.js 18+ and sqlcmd on the PATH.
// CHANGES DATA: it changes the status of a few dozen requests (as dana.cohen) and, for a moment, the priority of
// two requests directly in the database (restored at the end). It takes about 1.5 minutes: the expiry check
// really waits for 60 seconds.
// Nobody else may change statuses while it runs (no UI, no other script): it aborts with exit code 2 if it sees a status
// change by another user. Its own changes are made as dana.cohen.
// Run "dotnet run --project src/RequestsManagement.API -- seed --reset" afterwards to restore the original data.
//
//   node scripts/verify-summary-cache.js
//
// Environment variables (optional):
//   API_URL      default http://localhost:5084
//   SQL_SERVER   default (localdb)\MSSQLLocalDB  – the SQL Server instance the API uses (e.g. "." for a local default instance)
//   SKIP_EXPIRY  set to 1 to skip the 60 second expiry check (everything else runs in about 20 seconds)
const { execFileSync } = require('child_process');

const BASE = process.env.API_URL ?? 'http://localhost:5084';
const SQL_SERVER = process.env.SQL_SERVER ?? '(localdb)\\MSSQLLocalDB';
const SKIP_EXPIRY = process.env.SKIP_EXPIRY === '1';
const TTL_MS = 60000;

const sql = q => execFileSync('sqlcmd',
  ['-S', SQL_SERVER, '-E', '-d', 'RequestsManagement', '-h', '-1', '-W', '-b', '-f', '65001', '-t', '600', '-Q', 'SET NOCOUNT ON; ' + q],
  { encoding: 'utf8', timeout: 600000 }).split(/\r?\n/).map(s => s.trim()).filter(Boolean);

let token = '';
const call = async (method, path, body, tk = token) => {
  const headers = {};
  if (tk) headers.Authorization = `Bearer ${tk}`;
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  const r = await fetch(BASE + path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(120000) });
  const text = await r.text();
  let json; try { json = JSON.parse(text); } catch { json = text; }
  return { status: r.status, body: json };
};
const patch = (id, newStatus, version) => call('PATCH', `/api/requests/${id}/status`, { newStatus, version });
const bulk = (newStatus, items) => call('POST', '/api/requests/bulk-status', { newStatus, items });
const item = r => ({ id: r.id, version: r.version });
const timedSummary = async () => {
  const started = performance.now();
  const r = await call('GET', '/api/requests/summary');
  return { ms: performance.now() - started, body: r.body, status: r.status };
};
const summary = async () => (await timedSummary()).body;
const median = xs => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)];
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

let failed = 0;
const check = (name, ok, detail = '') => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  – ' + detail : ''}`); if (!ok) failed++; };
const section = t => console.log(`\n== ${t}`);
const login = async userName => {
  const r = await call('POST', '/api/auth/login', { userName, password: 'Demo123!' }, null);
  if (r.status !== 200) {
    console.error(`Login as ${userName} failed (${r.status}). Is the database seeded with the demo users?`);
    process.exit(1);
  }
  return r.body.accessToken;
};

// Requests used by this script are never reused inside it
const used = new Set();
const pick = async (status, count = 1, maxPage = 40) => {
  for (let attempt = 0; attempt < 10; attempt++) {
    const page = 1 + Math.floor(Math.random() * maxPage);
    const r = await call('GET', `/api/requests?status=${status}&sortBy=updatedAt&sortDir=Asc&pageSize=${count}&page=${page}`);
    if (r.body.items.every(i => !used.has(i.id))) {
      r.body.items.forEach(i => used.add(i.id));
      return r.body.items;
    }
  }
  throw new Error('Could not find unused requests to test with');
};
// A successful change through the API: this is what invalidates the cache
const changeThroughApi = async () => {
  const [r] = await pick('New');
  const res = await patch(r.id, 'InProgress', r.version);
  if (res.status !== 200) throw new Error(`Expected 200 for the invalidating PATCH, got ${res.status}`);
};
const count = (s, key, value) => s[key === 'status' ? 'byStatus' : 'byPriority'].find(x => x[key] === value)?.count ?? 0;

// The summary as the database itself would calculate it (counts and top organizations)
const truth = () => {
  const lines = sql(`
    SELECT 'S', Status, COUNT(*) FROM Requests GROUP BY Status;
    SELECT 'P', Priority, COUNT(*) FROM Requests GROUP BY Priority;
    SELECT TOP 10 'O|' + CAST(COUNT(*) AS varchar(10)) + '|' + OrganizationName FROM Requests
      WHERE Status <> 4 GROUP BY OrganizationName ORDER BY COUNT(*) DESC, OrganizationName;`);
  const byStatus = {}, byPriority = {}, topOrganizations = [];
  for (const line of lines) {
    if (line.startsWith('O|')) {
      // organization names contain spaces and may contain "|": everything after the second "|" is the name
      const [, n, ...name] = line.split('|');
      topOrganizations.push(`${n}:${name.join('|')}`);
      continue;
    }
    const [kind, key, n] = line.split(/\s+/);
    (kind === 'S' ? byStatus : byPriority)[key] = Number(n);
  }
  return { byStatus, byPriority, topOrganizations };
};
const names = { status: { 1: 'New', 2: 'InProgress', 3: 'Waiting', 4: 'Completed' }, priority: { 1: 'Low', 2: 'Medium', 3: 'High' } };
// What differs between a summary and the database (empty = they match). The top organizations are compared in order:
// the API orders by open count (descending) and then by name, the same as the query above (docs/API.md)
const mismatches = s => {
  const t = truth(), diffs = [];
  for (const [k, n] of Object.entries(t.byStatus)) {
    const api = count(s, 'status', names.status[k]);
    if (api !== n) diffs.push(`status ${names.status[k]}: api ${api}, database ${n}`);
  }
  for (const [k, n] of Object.entries(t.byPriority)) {
    const api = count(s, 'priority', names.priority[k]);
    if (api !== n) diffs.push(`priority ${names.priority[k]}: api ${api}, database ${n}`);
  }
  const total = Object.values(t.byStatus).reduce((a, b) => a + b, 0);
  if (s.total !== total) diffs.push(`total: api ${s.total}, database ${total}`);
  const apiTop = (s.topOrganizations ?? []).map(o => `${o.openRequests}:${o.organizationName}`);
  if (apiTop.join(' | ') !== t.topOrganizations.join(' | ')) diffs.push(`top organizations differ: api [${apiTop.join(', ')}], database [${t.topOrganizations.join(', ')}]`);
  return diffs;
};
const matchesDatabase = s => mismatches(s).length === 0;

// This script writes through the API as dana.cohen only. A status change by anyone else while it runs (for example in
// the UI) changes the database behind its back and makes the comparisons meaningless, so that aborts the run
let firstHistoryId = 0;
const foreignChanges = () => Number(sql(`SELECT COUNT(*) FROM RequestStatusHistory WHERE Id > ${firstHistoryId} AND ChangedBy <> 'dana.cohen'`)[0]);
const assertNoForeignChanges = () => {
  const n = foreignChanges();
  if (n > 0) throw new Error(`${n} status change(s) were made by another client during the run (the UI, another script). The results are not valid: close other clients and run again.`);
};

// Direct database changes (they bypass the API, so they never invalidate the cache); all restored in `finally`
const reverts = [];
const changePriorityInDatabase = id => {
  const original = Number(sql(`SELECT Priority FROM Requests WHERE Id = ${id}`)[0]);
  const changed = original === 1 ? 2 : 1;
  sql(`UPDATE Requests SET Priority = ${changed} WHERE Id = ${id}`);
  reverts.push(() => sql(`UPDATE Requests SET Priority = ${original} WHERE Id = ${id}`));
  return { original, changed };
};
const restoreDatabase = () => { while (reverts.length) reverts.pop()(); };

(async () => {
  console.log(`API ${BASE}, SQL Server ${SQL_SERVER}`);
  token = await login('dana.cohen');
  await summary(); // warm-up (JIT, connections); its result is irrelevant
  firstHistoryId = Number(sql('SELECT ISNULL(MAX(Id), 0) FROM RequestStatusHistory')[0]);

  try {
    section('1. A cache hit is faster than a miss');
    const misses = [], hits = [];
    let identical = true;
    for (let cycle = 0; cycle < 3; cycle++) {
      await changeThroughApi();                 // empties the cache
      const miss = await timedSummary();
      misses.push(miss.ms);
      for (let i = 0; i < 10; i++) {
        const hit = await timedSummary();
        hits.push(hit.ms);
        identical &&= same(hit.body, miss.body);
      }
    }
    console.log(`      miss median ${median(misses).toFixed(1)} ms (${misses.map(m => m.toFixed(0)).join(', ')}), hit median ${median(hits).toFixed(1)} ms`);
    check('median of hits is less than half of the median of misses', median(hits) < median(misses) / 2);
    check('a hit returns exactly what the miss returned', identical);

    section('2. A hit does not touch the database, and the entry expires on its own after 60 s');
    await changeThroughApi();
    const filledAt = performance.now();
    const filled = await summary();             // miss: the cache is filled now
    const [victim] = await pick('Completed');
    const { original, changed } = changePriorityInDatabase(victim.id);
    const stillCached = await summary();
    check('after a change made directly in the database the summary is still the cached one', same(stillCached, filled));
    check('(and the database really differs from it)', !matchesDatabase(stillCached));
    if (SKIP_EXPIRY) {
      console.log('      SKIP_EXPIRY=1: the 60 second expiry check was skipped');
    } else {
      const waitMs = TTL_MS + 2000 - (performance.now() - filledAt);
      console.log(`      waiting ${(waitMs / 1000).toFixed(0)} s for the entry to expire…`);
      await sleep(waitMs);
      const expired = await summary();
      check('after 60 s the summary is read from the database again (no API call cleared the cache)', !same(expired, filled) && matchesDatabase(expired));
      check('the priority counts moved exactly as the database change',
        count(expired, 'priority', names.priority[changed]) === count(filled, 'priority', names.priority[changed]) + 1 &&
        count(expired, 'priority', names.priority[original]) === count(filled, 'priority', names.priority[original]) - 1);
    }
    restoreDatabase();
    await changeThroughApi();                   // the cache must not keep the temporary database state
    check('cache and database agree again', matchesDatabase(await summary()));

    section('3. A single PATCH is visible in the summary immediately');
    await summary();                            // make sure the cache is filled
    const before = await summary();
    const [one] = await pick('New');
    check('PATCH New -> InProgress succeeds', (await patch(one.id, 'InProgress', one.version)).status === 200);
    const afterPatch = await summary();         // the very next call
    check('New - 1, InProgress + 1, total unchanged',
      count(afterPatch, 'status', 'New') === count(before, 'status', 'New') - 1 &&
      count(afterPatch, 'status', 'InProgress') === count(before, 'status', 'InProgress') + 1 && afterPatch.total === before.total);
    check('the summary equals the database', matchesDatabase(afterPatch));

    section('4. A bulk update is visible in the summary immediately (mixed call: 4 updated, 2 failed)');
    await summary();
    const beforeBulk = await summary();
    const news = await pick('New', 4);
    const [completed] = await pick('Completed');
    const res = await bulk('InProgress', [...news.map(item), { id: 999999999, version: 'AAAAAAAAB9E=' }, item(completed)]);
    check('bulk: 4 updated, 2 failed', res.status === 200 && res.body.succeeded === 4 && res.body.failed === 2, `${res.status}`);
    const afterBulk = await summary();
    check('New - 4, InProgress + 4, total unchanged',
      count(afterBulk, 'status', 'New') === count(beforeBulk, 'status', 'New') - 4 &&
      count(afterBulk, 'status', 'InProgress') === count(beforeBulk, 'status', 'InProgress') + 4 && afterBulk.total === beforeBulk.total);
    check('the summary equals the database', matchesDatabase(afterBulk));

    section('5. Changes that fail do not clear the cache');
    await changeThroughApi();
    const cachedBefore = await summary();       // miss, fills the cache
    const [other] = await pick('Completed');
    changePriorityInDatabase(other.id);         // the cache can no longer be right, so any clearing would show
    const [stale] = await pick('New');
    const [done] = await pick('Completed');
    check('PATCH with a stale version -> 409', (await patch(stale.id, 'InProgress', 'AAAAAAAAB9E=')).status === 409);
    check('PATCH of a request that does not exist -> 404', (await patch(999999999, 'InProgress', 'AAAAAAAAB9E=')).status === 404);
    check('PATCH Completed -> InProgress -> 422', (await patch(done.id, 'InProgress', done.version)).status === 422);
    const failedBulk = await bulk('InProgress', [{ id: 999999999, version: 'AAAAAAAAB9E=' }, { ...item(stale), version: 'AAAAAAAAB9E=' }, item(done)]);
    check('bulk where every item fails -> 200, succeeded 0', failedBulk.status === 200 && failedBulk.body.succeeded === 0 && failedBulk.body.failed === 3);
    check('the summary is still the cached one (nothing was cleared)', same(await summary(), cachedBefore));
    restoreDatabase();
    await changeThroughApi();
    check('after a successful change it matches the database again', matchesDatabase(await summary()));

    section('6. Readers racing a status change never leave a stale summary behind');
    // The cache is emptied first, so all readers MISS and load from the database (~100 ms each). A status change
    // is committed while they are loading. A reader that read the old data must not store it after the
    // invalidation (generation counter); afterwards the summary must equal the database.
    let stale6 = 0, patchFailed6 = 0;
    for (let i = 0; i < 20; i++) {
      await changeThroughApi();                 // empties the cache
      const [r] = await pick('New');
      const readers = Array.from({ length: 8 }, () => summary());
      await sleep(5 + Math.floor(Math.random() * 60)); // lands the change somewhere inside the readers' loading
      const res = await patch(r.id, 'InProgress', r.version);
      await Promise.all(readers);
      if (res.status !== 200) {
        patchFailed6++;
        console.log(`      round ${i + 1}: the PATCH returned ${res.status}`);
        continue;
      }
      const diffs = mismatches(await summary());
      if (diffs.length) {
        assertNoForeignChanges();               // a foreign writer explains a difference: abort instead of failing
        stale6++;
        console.log(`      round ${i + 1}: stale summary – ${diffs.join('; ')}`);
      }
    }
    assertNoForeignChanges();
    check('20 rounds of 8 concurrent cache misses + 1 PATCH in the middle: every PATCH succeeded', patchFailed6 === 0, `${patchFailed6} failed`);
    check('20 rounds of 8 concurrent cache misses + 1 PATCH in the middle: the next read always equals the database', stale6 === 0, `${stale6} stale`);
  } finally {
    restoreDatabase();
  }

  section('7. End state');
  await changeThroughApi();
  check('cache is coherent with the database', matchesDatabase(await summary()));

  console.log(`\n${failed === 0 ? 'ALL CHECKS PASSED' : failed + ' CHECK(S) FAILED'}`);
  process.exit(failed ? 1 : 0);
})().catch(error => {
  // e.g. the API or SQL Server is not reachable, or sqlcmd failed
  try { restoreDatabase(); } catch { /* best effort */ }
  console.error(`\nVerification aborted: ${error.stderr || error.stdout || error.message}`);
  process.exit(2);
});
