// Verification of the bulk status update (M4, D-08): validation, Partial Success with a result per item,
// ChangedBy from the token, audit rows, and a bulk update racing against single PATCH calls on the same requests.
// Complements scripts/dev/verify-status-update.js (single update) and scripts/dev/ConcurrencyProof.cs.
//
// Requirements: the API is running, the database is seeded, Node.js 18+ and sqlcmd on the PATH.
// CHANGES DATA: it changes the status of a few hundred requests (as dana.cohen and yossi.friedman).
// Run "dotnet run --project src/RequestsManagement.API -- seed --reset" afterwards to restore the original data.
//
//   node scripts/dev/verify-bulk-status.js
//
// Environment variables (optional):
//   API_URL     default http://localhost:5084
//   SQL_SERVER  default (localdb)\MSSQLLocalDB  – the SQL Server instance the API uses (e.g. "." for a local default instance)
//   RACE_REQUESTS  requests per round in the concurrency test, default 50
//   RACE_ROUNDS    rounds in the concurrency test, default 3
const { execFileSync } = require('child_process');

const BASE = process.env.API_URL ?? 'http://localhost:5084';
const SQL_SERVER = process.env.SQL_SERVER ?? '(localdb)\\MSSQLLocalDB';
const RACE_REQUESTS = Number(process.env.RACE_REQUESTS ?? 50);
const RACE_ROUNDS = Number(process.env.RACE_ROUNDS ?? 3);

const sql = q => execFileSync('sqlcmd',
  ['-S', SQL_SERVER, '-E', '-d', 'RequestsManagement', '-h', '-1', '-W', '-b', '-t', '600', '-Q', 'SET NOCOUNT ON; ' + q],
  { encoding: 'utf8', timeout: 600000 }).split(/\r?\n/).map(s => s.trim()).filter(Boolean);

let token = '', token2 = '';
const call = async (method, path, body, tk = token, raw) => {
  const headers = {};
  if (tk) headers.Authorization = `Bearer ${tk}`;
  if (body !== undefined || raw !== undefined) headers['Content-Type'] = 'application/json';
  const r = await fetch(BASE + path, { method, headers, body: raw ?? (body === undefined ? undefined : JSON.stringify(body)), signal: AbortSignal.timeout(120000) });
  const text = await r.text();
  let json; try { json = JSON.parse(text); } catch { json = text; }
  return { status: r.status, body: json, type: r.headers.get('content-type') ?? '' };
};
const bulk = (newStatus, items, tk = token) => call('POST', '/api/requests/bulk-status', { newStatus, items }, tk);
const patch = (id, newStatus, version, tk = token) => call('PATCH', `/api/requests/${id}/status`, { newStatus, version }, tk);
const get = async id => (await call('GET', `/api/requests/${id}`)).body;
const history = async id => (await call('GET', `/api/requests/${id}/history`)).body;
const item = r => ({ id: r.id, version: r.version });

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
// `count` requests in the given status(es), the ones changed longest ago (starting at a random page so
// repeated runs and sections use different requests). Fresh versions: always read right before use.
const used = new Set(); // a request is used by one scenario only, so scenarios cannot disturb each other
const pick = async (status, count = 1, maxPage = 40) => {
  const statuses = [].concat(status).map(s => `status=${s}`).join('&');
  for (let attempt = 0; attempt < 10; attempt++) {
    const page = 1 + Math.floor(Math.random() * maxPage);
    const r = await call('GET', `/api/requests?${statuses}&sortBy=updatedAt&sortDir=Asc&pageSize=${count}&page=${page}`);
    if (r.body.items.every(i => !used.has(i.id))) {
      r.body.items.forEach(i => used.add(i.id));
      return r.body.items;
    }
  }
  throw new Error('Could not find unused requests to test with');
};
const historyCount = () => Number(sql('SELECT COUNT(*) FROM RequestStatusHistory')[0]);
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const FAKE_VERSION = 'AAAAAAAAB9E='; // 8 bytes, a well-formed version that matches nothing

(async () => {
  console.log(`API ${BASE}, SQL Server ${SQL_SERVER}`);
  token = await login('dana.cohen');
  token2 = await login('yossi.friedman');

  section('1. Validation: 400 for the whole call, nothing is changed (D-18)');
  const [real] = await pick('InProgress');
  const realBefore = await get(real.id);
  const historyBefore = historyCount();
  const many = [item(real), ...Array.from({ length: 100 }, (_, i) => ({ id: 900000000 + i, version: FAKE_VERSION }))];
  const bad = {
    'empty list': { newStatus: 'Waiting', items: [] },
    'items missing': { newStatus: 'Waiting' },
    'items null': { newStatus: 'Waiting', items: null },
    '101 items': { newStatus: 'Waiting', items: many },
    'repeated id': { newStatus: 'Waiting', items: [item(real), item(real)] },
    'repeated id among others': { newStatus: 'Waiting', items: [item(real), { id: 900000001, version: FAKE_VERSION }, { id: 900000001, version: FAKE_VERSION }] },
    'newStatus missing': { items: [item(real)] },
    'newStatus unknown name': { newStatus: 'Nope', items: [item(real)] },
    'newStatus out of range number': { newStatus: 99, items: [item(real)] },
    'id 0': { newStatus: 'Waiting', items: [{ id: 0, version: real.version }] },
    'negative id': { newStatus: 'Waiting', items: [{ id: -5, version: real.version }] },
    'version missing': { newStatus: 'Waiting', items: [{ id: real.id }] },
    'version not base64': { newStatus: 'Waiting', items: [{ id: real.id, version: '***' }] },
    'version wrong length': { newStatus: 'Waiting', items: [{ id: real.id, version: 'AAAA' }] },
    'null item': { newStatus: 'Waiting', items: [item(real), null] },
    'unknown field on the body (changedBy)': { newStatus: 'Waiting', items: [item(real)], changedBy: 'hacker' },
    'unknown field on an item': { newStatus: 'Waiting', items: [{ ...item(real), changedBy: 'hacker' }] }
  };
  for (const [name, body] of Object.entries(bad)) {
    const r = await call('POST', '/api/requests/bulk-status', body);
    check(`${name} -> 400 ValidationProblemDetails`, r.status === 400 && r.type.includes('application/problem+json') && r.body.errors && r.body.traceId, `${r.status}`);
  }
  const dup = await call('POST', '/api/requests/bulk-status', bad['repeated id']);
  check('repeated id: the message names the id', JSON.stringify(dup.body.errors).includes(String(real.id)));
  const manyErr = await call('POST', '/api/requests/bulk-status', bad['101 items']);
  check('101 items: error is on "items"', Object.keys(manyErr.body.errors).some(k => k === 'items'), Object.keys(manyErr.body.errors).join(','));
  const nested = await call('POST', '/api/requests/bulk-status', { newStatus: 'Waiting', items: [{ id: 0, version: '***' }] });
  check('item errors use camelCase keys (items[0].id, items[0].version)', 'items[0].id' in nested.body.errors && 'items[0].version' in nested.body.errors, Object.keys(nested.body.errors).join(','));
  const noToken = await call('POST', '/api/requests/bulk-status', { newStatus: 'Waiting', items: [item(real)] }, null);
  check('no token -> 401', noToken.status === 401);
  const rawNoType = await fetch(BASE + '/api/requests/bulk-status', { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: '{}' });
  check('body without Content-Type -> 415', rawNoType.status === 415, `${rawNoType.status}`);
  check('nothing changed by any invalid call', same(await get(real.id), realBefore) && historyCount() === historyBefore);
  const maxOk = await bulk('Waiting', Array.from({ length: 100 }, (_, i) => ({ id: 910000000 + i, version: FAKE_VERSION })));
  check('exactly 100 items is accepted (all NotFound -> still 200)', maxOk.status === 200 && maxOk.body.total === 100 && maxOk.body.failed === 100 && maxOk.body.succeeded === 0, `${maxOk.status}`);

  section('2. Partial Success: every outcome in one call, failures do not affect the others');
  // Target InProgress for the whole call. Prepare the requests:
  const [u1] = await pick('New');
  const [u2] = await pick('Waiting');
  const [c1src] = await pick('New');   // will be changed to InProgress -> stale AND InProgress->InProgress is invalid
  const [c2src] = await pick('New');   // will be changed to Waiting -> stale, but New->InProgress... valid
  const [iCompleted] = await pick('Completed');
  const [iInProgress] = await pick('InProgress');
  const c1Stale = item(c1src), c2Stale = item(c2src);
  check('prepare stale request 1', (await patch(c1src.id, 'InProgress', c1src.version)).status === 200);
  check('prepare stale request 2', (await patch(c2src.id, 'Waiting', c2src.version)).status === 200);
  const items = [item(u1), { id: 999999999, version: FAKE_VERSION }, c1Stale, item(iCompleted), item(u2), c2Stale, item(iInProgress)];
  const ids = items.map(i => i.id);
  const before = Object.fromEntries(await Promise.all(ids.filter(id => id !== 999999999).map(async id => [id, { req: await get(id), hist: (await history(id)).length }])));
  const res = await bulk('InProgress', items);
  check('200 with total/succeeded/failed', res.status === 200 && res.body.total === 7 && res.body.succeeded === 2 && res.body.failed === 5, JSON.stringify({ s: res.status, t: res.body.total, ok: res.body.succeeded, f: res.body.failed }));
  const results = res.body.results;
  check('results are in the order of the call', same(results.map(r => r.id), ids));
  check('outcomes: Updated, NotFound, Conflict, InvalidTransition, Updated, Conflict, InvalidTransition',
    same(results.map(r => r.outcome), ['Updated', 'NotFound', 'Conflict', 'InvalidTransition', 'Updated', 'Conflict', 'InvalidTransition']), results.map(r => r.outcome).join(','));
  check('stale AND invalid (InProgress->InProgress) is Conflict, not InvalidTransition (409 before 422, as in PATCH)', results[2].outcome === 'Conflict');
  check('Conflict carries currentStatus, currentVersion, currentUpdatedAt', results[2].currentStatus === 'InProgress' && !!results[2].currentVersion && !!results[2].currentUpdatedAt && results[5].currentStatus === 'Waiting');
  check('InvalidTransition from Completed: allowedStatuses empty', results[3].currentStatus === 'Completed' && same(results[3].allowedStatuses, []));
  check('InvalidTransition from InProgress: allowedStatuses = Waiting, Completed', results[6].currentStatus === 'InProgress' && same(results[6].allowedStatuses, ['Waiting', 'Completed']));
  check('NotFound has no other fields', same(Object.keys(results[1]).sort(), ['id', 'outcome']));
  check('Updated carries the request with a new version', results[0].request?.status === 'InProgress' && results[0].request.version !== u1.version && results[4].request?.status === 'InProgress');
  const after = Object.fromEntries(await Promise.all(Object.keys(before).map(async id => [id, { req: await get(id), hist: await history(id) }])));
  for (const r of results.filter(r => r.outcome === 'Updated')) {
    const b = before[r.id], a = after[r.id], last = a.hist.at(-1);
    check(`request ${r.id}: updated, version = the one returned, one new history row by dana.cohen`,
      a.req.status === 'InProgress' && a.req.version === r.request.version && a.hist.length === b.hist + 1 &&
      last.newStatus === 'InProgress' && last.previousStatus === b.req.status && last.changedBy === 'dana.cohen');
    check(`request ${r.id}: UpdatedAt = ChangedAt of the history row`, a.req.updatedAt === last.changedAt, `${a.req.updatedAt} / ${last.changedAt}`);
  }
  for (const r of results.filter(r => ['Conflict', 'InvalidTransition'].includes(r.outcome))) {
    const b = before[r.id], a = after[r.id];
    check(`request ${r.id} (${r.outcome}): unchanged (status, version, history)`,
      same(a.req, b.req) && a.hist.length === b.hist && r.currentVersion === b.req.version && r.currentStatus === b.req.status);
  }
  const replay = await bulk('InProgress', items);
  check('sending the same call again: nothing is updated twice (the two that succeeded are now Conflict)',
    replay.status === 200 && replay.body.succeeded === 0 && replay.body.results[0].outcome === 'Conflict' && replay.body.results[4].outcome === 'Conflict');

  section('3. ChangedBy comes from the token only');
  const [t1, t2] = await pick('New', 2);
  const byYossi = await bulk('Waiting', [item(t1), item(t2)], token2);
  check('bulk as yossi.friedman: both updated', byYossi.status === 200 && byYossi.body.succeeded === 2);
  const h1 = await history(t1.id), h2 = await history(t2.id);
  check('history rows are written by yossi.friedman', h1.at(-1).changedBy === 'yossi.friedman' && h2.at(-1).changedBy === 'yossi.friedman');
  check('no history row written by "hacker"', Number(sql("SELECT COUNT(*) FROM RequestStatusHistory WHERE ChangedBy = 'hacker'")[0]) === 0);

  section('4. A full call: 100 requests, one call');
  const hundred = await pick('New', 100, 30);
  const started = Date.now();
  const full = await bulk('InProgress', hundred.map(item));
  const ms = Date.now() - started;
  check('100 items -> 200, 100 updated, 0 failed', full.status === 200 && full.body.total === 100 && full.body.succeeded === 100 && full.body.failed === 0, `${full.status} in ${ms} ms`);
  check('each result is Updated with the new status and version', full.body.results.every(r => r.outcome === 'Updated' && r.request.status === 'InProgress'));
  const hundredIds = hundred.map(r => r.id).join(',');
  const rows = sql(`SELECT COUNT(*) FROM RequestStatusHistory WHERE RequestId IN (${hundredIds}) AND NewStatus = 2 AND ChangedBy = 'dana.cohen' AND ChangedAt >= DATEADD(MINUTE, -10, SYSUTCDATETIME())`)[0];
  check('one history row per request', rows === '100', rows);
  console.log(`      100 items took ${ms} ms`);

  section('5. Concurrency: bulk calls racing against single PATCH calls on the same requests');
  // Per request, at the same moment, with the SAME version V and status S:
  //   bulk A (dana)   -> Completed          (valid from InProgress and Waiting), request order
  //   bulk B (yossi)  -> Waiting            (valid only from InProgress), REVERSED order (deadlock check)
  //   3 single PATCHes: first allowed status (yossi), second allowed status (dana), Completed (yossi)
  // Expected per request: exactly ONE winner among all calls; every other call is a Conflict
  // (409 for PATCH); one new history row, of the winner; the final status and version are the winner's.
  const allowedNext = { InProgress: ['Waiting', 'Completed'], Waiting: ['InProgress', 'Completed'] };
  let wonByBulk = 0, wonByPatch = 0;
  for (let round = 1; round <= RACE_ROUNDS; round++) {
    const page = await pick(['InProgress', 'Waiting'], RACE_REQUESTS, 1 + Math.floor(Math.random() * 20));
    const reqs = await Promise.all(page.map(r => get(r.id)));        // current versions, read right before the race
    const hist0 = Object.fromEntries(await Promise.all(reqs.map(async r => [r.id, (await history(r.id)).length])));

    const calls = [];
    const tag = (kind, user, target, ids, p) => calls.push(p.then(r => ({ kind, user, target, ids, r })));
    tag('bulk', 'dana.cohen', 'Completed', reqs.map(r => r.id), bulk('Completed', reqs.map(item), token));
    tag('bulk', 'yossi.friedman', 'Waiting', reqs.map(r => r.id).reverse(), bulk('Waiting', reqs.map(item).reverse(), token2));
    for (const r of reqs) {
      const [first, second] = allowedNext[r.status];
      tag('patch', 'yossi.friedman', first, [r.id], patch(r.id, first, r.version, token2));
      tag('patch', 'dana.cohen', second, [r.id], patch(r.id, second, r.version, token));
      tag('patch', 'yossi.friedman', 'Completed', [r.id], patch(r.id, 'Completed', r.version, token2));
    }
    const done = await Promise.all(calls);

    // Flatten to one attempt per (request, call)
    const attempts = [];
    let serverErrors = 0;
    for (const c of done) {
      if (c.r.status >= 500) serverErrors++;
      if (c.kind === 'bulk') {
        if (c.r.status !== 200) { serverErrors++; continue; }
        for (const it of c.r.body.results) attempts.push({ ...c, id: it.id, outcome: it.outcome, version: it.request?.version, cur: it });
      } else {
        const o = c.r.status === 200 ? 'Updated' : c.r.status === 409 ? 'Conflict' : c.r.status === 422 ? 'InvalidTransition' : 'Other' + c.r.status;
        attempts.push({ ...c, id: c.ids[0], outcome: o, version: c.r.body?.version, cur: c.r.body });
      }
    }
    check(`round ${round}: ${done.length} calls, no 5xx / non-200 bulk (no deadlock victims)`, serverErrors === 0, `${serverErrors}`);
    check(`round ${round}: only Updated / Conflict / InvalidTransition outcomes`, attempts.every(a => ['Updated', 'Conflict', 'InvalidTransition'].includes(a.outcome)), [...new Set(attempts.map(a => a.outcome))].join(','));

    let ok = 0; const problems = [];
    for (const r of reqs) {
      const mine = attempts.filter(a => a.id === r.id);
      const winners = mine.filter(a => a.outcome === 'Updated');
      const final = await get(r.id), hist = await history(r.id);
      if (winners.length !== 1) { problems.push(`#${r.id}: ${winners.length} winners`); continue; }
      const w = winners[0], last = hist.at(-1);
      if (w.kind === 'bulk') wonByBulk++; else wonByPatch++;
      const losersOk = mine.filter(a => a !== w).every(a =>
        a.outcome === 'Conflict' ? (a.kind === 'bulk' ? a.cur.currentVersion : a.cur.currentVersion) === final.version :
        a.outcome === 'InvalidTransition' && !allowedNext[r.status].includes(a.target));  // invalid only if the target was never possible
      if (!losersOk) problems.push(`#${r.id}: a loser reported the wrong outcome or version`);
      if (hist.length !== hist0[r.id] + 1) problems.push(`#${r.id}: ${hist.length - hist0[r.id]} new history rows`);
      else if (last.changedBy !== w.user || last.newStatus !== w.target || last.previousStatus !== r.status) problems.push(`#${r.id}: history row is not the winner's`);
      if (final.status !== w.target || final.version !== w.version || final.updatedAt !== last?.changedAt) problems.push(`#${r.id}: final state is not the winner's`);
      if (!problems.some(p => p.startsWith(`#${r.id}`))) ok++;
    }
    check(`round ${round}: ${reqs.length} requests, each with exactly one winner, one history row, final state = winner's`, ok === reqs.length, problems.slice(0, 5).join('; '));
  }
  console.log(`      winners: ${wonByBulk} by a bulk call, ${wonByPatch} by a single PATCH`);

  section('6. OpenAPI');
  const doc = (await call('GET', '/openapi/v1.json', undefined, null)).body;
  const post = doc.paths['/api/requests/bulk-status']?.post;
  check('bulk-status documented with 200/400/401', !!post && ['200', '400', '401'].every(code => post.responses[code]), post ? Object.keys(post.responses).join(',') : 'missing');
  check('bulk-status requires bearer', JSON.stringify(post?.security ?? []).includes('Bearer'));
  check('body schema has newStatus and items, no changedBy', (() => {
    const schema = doc.components.schemas.BulkStatusRequest;
    return schema && schema.properties.newStatus && schema.properties.items && !schema.properties.changedBy;
  })());

  section('7. Database consistency (whole table)');
  const [u, ill, upd2, last2, untrusted] = sql(`
    SELECT COUNT(*) FROM Requests r WHERE r.Status <> 1 AND r.UpdatedAt <> (SELECT MAX(h.ChangedAt) FROM RequestStatusHistory h WHERE h.RequestId = r.Id);
    SELECT COUNT(*) FROM RequestStatusHistory WHERE NOT ((PreviousStatus = 1 AND NewStatus IN (2,3)) OR (PreviousStatus = 2 AND NewStatus IN (3,4)) OR (PreviousStatus = 3 AND NewStatus IN (2,4)));
    SELECT COUNT(*) FROM Requests WHERE UpdatedAt < CreatedAt;
    SELECT COUNT(*) FROM Requests r WHERE r.Status <> 1 AND r.Status <> (SELECT TOP 1 h.NewStatus FROM RequestStatusHistory h WHERE h.RequestId = r.Id ORDER BY h.ChangedAt DESC, h.Id DESC);
    SELECT (SELECT COUNT(*) FROM sys.check_constraints WHERE is_not_trusted = 1) + (SELECT COUNT(*) FROM sys.foreign_keys WHERE is_not_trusted = 1);`);
  check('UpdatedAt = last ChangedAt for every changed request', u === '0', u);
  check('no illegal transition in the whole history', ill === '0', ill);
  check('UpdatedAt never before CreatedAt', upd2 === '0', upd2);
  check('current status = NewStatus of the last history row', last2 === '0', last2);
  check('constraints still trusted', untrusted === '0', untrusted);

  console.log(`\n${failed === 0 ? 'ALL CHECKS PASSED' : failed + ' CHECK(S) FAILED'}`);
  process.exit(failed ? 1 : 0);
})().catch(error => {
  // e.g. the API or SQL Server is not reachable, or sqlcmd failed
  console.error(`\nVerification aborted: ${error.stderr || error.stdout || error.message}`);
  process.exit(2);
});
