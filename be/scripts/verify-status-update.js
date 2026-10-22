// Verification of status updates (M3): transition rules, error responses, history, authentication and
// database consistency. Complements scripts/ConcurrencyProof.cs (the no-lost-update proof).
//
// Requirements: the API is running, the database is seeded, Node.js 18+ and sqlcmd on the PATH.
// CHANGES DATA: it changes the status of a few dozen requests (as dana.cohen and yossi.friedman).
// Run "dotnet run --project src/RequestsManagement.API -- seed --reset" afterwards to restore the original data.
//
//   node scripts/verify-status-update.js
//
// Environment variables (optional):
//   API_URL     default http://localhost:5084
//   SQL_SERVER  default (localdb)\MSSQLLocalDB  – the SQL Server instance the API uses (e.g. "." for a local default instance)
const { execFileSync } = require('child_process');

const BASE = process.env.API_URL ?? 'http://localhost:5084';
const SQL_SERVER = process.env.SQL_SERVER ?? '(localdb)\\MSSQLLocalDB';

const sql = q => execFileSync('sqlcmd',
  ['-S', SQL_SERVER, '-E', '-d', 'RequestsManagement', '-h', '-1', '-W', '-b', '-t', '600', '-Q', 'SET NOCOUNT ON; ' + q],
  { encoding: 'utf8', timeout: 600000 }).split(/\r?\n/).map(s => s.trim()).filter(Boolean);

let token = '', token2 = '';
const call = async (method, path, body, tk = token, raw) => {
  const headers = {};
  if (tk) headers.Authorization = `Bearer ${tk}`;
  if (body !== undefined || raw !== undefined) headers['Content-Type'] = 'application/json';
  const r = await fetch(BASE + path, { method, headers, body: raw ?? (body === undefined ? undefined : JSON.stringify(body)), signal: AbortSignal.timeout(60000) });
  const text = await r.text();
  let json; try { json = JSON.parse(text); } catch { json = text; }
  return { status: r.status, body: json, type: r.headers.get('content-type') ?? '' };
};

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
// A random request in the given status (a random page, so repeated runs use different requests)
const pick = async status =>
  (await call('GET', `/api/requests?status=${status}&sortBy=updatedAt&sortDir=Asc&pageSize=1&page=${1 + Math.floor(Math.random() * 50)}`)).body.items[0];

(async () => {
  console.log(`API ${BASE}, SQL Server ${SQL_SERVER}`);
  token = await login('dana.cohen');
  token2 = await login('yossi.friedman');

  section('1. Transition matrix through the API (16 combinations, D-05)');
  const statuses = ['New', 'InProgress', 'Waiting', 'Completed'];
  const allowed = { New: ['InProgress', 'Waiting'], InProgress: ['Waiting', 'Completed'], Waiting: ['InProgress', 'Completed'], Completed: [] };
  for (const from of statuses) {
    for (const to of statuses) {
      const req = await pick(from);
      const r = await call('PATCH', `/api/requests/${req.id}/status`, { newStatus: to, version: req.version });
      const expectOk = allowed[from].includes(to);
      const ok = expectOk
        ? r.status === 200 && r.body.status === to && r.body.version !== req.version
        : r.status === 422 && r.body.currentStatus === from && r.body.requestedStatus === to &&
          JSON.stringify(r.body.allowedStatuses) === JSON.stringify(allowed[from]) && r.body.currentVersion === req.version &&
          /problem\+json/.test(r.type) && !!r.body.traceId;
      check(`${from.padEnd(10)} -> ${to.padEnd(10)} expected ${expectOk ? 200 : 422}`, ok, `${r.status} ${expectOk ? '' : JSON.stringify({ d: r.body.detail, allowed: r.body.allowedStatuses })}`);
      if (!expectOk) {
        const after = (await call('GET', `/api/requests/${req.id}`)).body;
        if (after.version !== req.version || after.status !== from) check('  422 left the request unchanged', false);
      }
    }
  }

  section('2. Updated request, history row, UpdatedAt = ChangedAt, ChangedBy from token');
  const req = await pick('New');
  const histBefore = (await call('GET', `/api/requests/${req.id}/history`)).body;
  const upd = await call('PATCH', `/api/requests/${req.id}/status`, { newStatus: 'Waiting', version: req.version }, token2);
  const histAfter = (await call('GET', `/api/requests/${req.id}/history`)).body;
  const last = histAfter.at(-1);
  check('200 returns the updated request', upd.status === 200 && upd.body.status === 'Waiting' && upd.body.id === req.id && upd.body.title === req.title);
  check('version changed and equals the DB rowversion', upd.body.version !== req.version &&
    Buffer.from(sql(`SELECT CONVERT(varchar(32), CAST(RowVersion AS binary(8)), 2) FROM Requests WHERE Id = ${req.id}`)[0], 'hex').toString('base64') === upd.body.version);
  check('New request had no history; now exactly one row', histBefore.length === 0 && histAfter.length === 1, `${histBefore.length} -> ${histAfter.length}`);
  check('history row: New -> Waiting by the token user (yossi.friedman)', last.previousStatus === 'New' && last.newStatus === 'Waiting' && last.changedBy === 'yossi.friedman', JSON.stringify(last));
  check('UpdatedAt = ChangedAt (same timestamp, UTC with Z)', upd.body.updatedAt === last.changedAt && /Z$/.test(last.changedAt), `${upd.body.updatedAt} / ${last.changedAt}`);
  check('UpdatedAt in DB = ChangedAt in DB (to the 100 ns)', sql(`SELECT CASE WHEN r.UpdatedAt = h.ChangedAt THEN 'same' ELSE 'diff' END FROM Requests r JOIN RequestStatusHistory h ON h.RequestId = r.Id WHERE r.Id = ${req.id}`)[0] === 'same');
  const hist2 = await call('GET', `/api/requests/1/history`);
  check('history of a seeded request is ordered by changedAt', hist2.status === 200 && hist2.body.every((h, i, a) => i === 0 || a[i - 1].changedAt <= h.changedAt), `${hist2.body.length} rows`);

  section('3. 404 / 409 / 400 / 401 / 415 – all ProblemDetails');
  const v = (await call('GET', '/api/requests/1')).body.version;
  const nf = await call('PATCH', '/api/requests/999999/status', { newStatus: 'Waiting', version: v });
  check('PATCH unknown id -> 404', nf.status === 404 && /problem\+json/.test(nf.type) && !!nf.body.traceId);
  const nfh = await call('GET', '/api/requests/999999/history');
  check('history unknown id -> 404', nfh.status === 404 && /problem\+json/.test(nfh.type));
  const stale = await pick('InProgress');
  await call('PATCH', `/api/requests/${stale.id}/status`, { newStatus: 'Waiting', version: stale.version });
  const cur = (await call('GET', `/api/requests/${stale.id}`)).body;
  const c = await call('PATCH', `/api/requests/${stale.id}/status`, { newStatus: 'Completed', version: stale.version });
  check('stale version -> 409 with currentStatus/currentVersion/currentUpdatedAt', c.status === 409 && c.body.currentStatus === 'Waiting' && c.body.currentVersion === cur.version && c.body.currentUpdatedAt === cur.updatedAt && !!c.body.traceId && /problem\+json/.test(c.type), JSON.stringify(c.body).slice(0, 260));
  const c2 = await call('PATCH', `/api/requests/${stale.id}/status`, { newStatus: 'New', version: stale.version });
  check('stale version AND invalid transition -> 409 wins over 422', c2.status === 409);
  const badBodies = [
    ['newStatus missing', { version: v }, 'newStatus'], ['version missing', { newStatus: 'Waiting' }, 'version'],
    ['newStatus unknown', { newStatus: 'Done', version: v }, 'newStatus'], ['newStatus 99', { newStatus: 99, version: v }, 'newStatus'],
    ['version not base64', { newStatus: 'Waiting', version: 'not-base64!' }, 'version'], ['version wrong length', { newStatus: 'Waiting', version: 'AAAA' }, 'version'],
    ['changedBy in body (rejected, D-10)', { newStatus: 'Waiting', version: v, changedBy: 'hacker' }, 'changedBy'],
  ];
  for (const [name, body, key] of badBodies) {
    const r = await call('PATCH', '/api/requests/1/status', body);
    const keys = Object.keys(r.body.errors ?? {});
    check(`400: ${name}`, r.status === 400 && /problem\+json/.test(r.type) && keys.some(k => k.toLowerCase().includes(key.toLowerCase())), `${keys.join('|')}: ${(r.body.errors?.[keys[0]] ?? [])[0]}`);
  }
  const malformed = await call('PATCH', '/api/requests/1/status', undefined, token, '{"newStatus":');
  check('400: malformed JSON', malformed.status === 400 && /problem\+json/.test(malformed.type));
  const noContentType = await fetch(`${BASE}/api/requests/1/status`, { method: 'PATCH', headers: { Authorization: `Bearer ${token}` }, body: '{}' });
  check('415: body without Content-Type', noContentType.status === 415 && /problem\+json/.test(noContentType.headers.get('content-type') ?? ''));
  const hacker = (await call('GET', '/api/requests/1/history')).body;
  check('no history row was written by "hacker"', hacker.every(h => h.changedBy !== 'hacker') && Number(sql("SELECT COUNT(*) FROM RequestStatusHistory WHERE ChangedBy = 'hacker'")[0]) === 0);
  for (const [m, p, b] of [['PATCH', '/api/requests/1/status', { newStatus: 'Waiting', version: v }], ['GET', '/api/requests/1/history'], ['GET', '/api/requests?pageSize=1'], ['GET', '/api/requests/summary'], ['GET', '/api/requests/1']]) {
    const r = await call(m, p, b, null);
    check(`401 without token: ${m} ${p}`, r.status === 401 && /problem\+json/.test(r.type));
  }
  const login401 = await call('POST', '/api/auth/login', { userName: 'dana.cohen', password: 'nope' }, null);
  check('login is the only anonymous endpoint (wrong password -> 401 from the login itself)', login401.status === 401 && login401.body.title === 'Invalid user name or password.');

  section('4. OpenAPI');
  const doc = (await call('GET', '/openapi/v1.json', undefined, null)).body;
  const patch = doc.paths['/api/requests/{id}/status'].patch;
  check('PATCH documents 200/400/401/404/409/422', ['200', '400', '401', '404', '409', '422'].every(code => patch.responses[code]), Object.keys(patch.responses).join(','));
  check('bearer scheme defined', doc.components.securitySchemes?.Bearer?.scheme === 'bearer');
  check('PATCH requires bearer, login does not', JSON.stringify(patch.security ?? []).includes('Bearer') && !doc.paths['/api/auth/login'].post.security?.length);
  check('history endpoint documented', !!doc.paths['/api/requests/{id}/history']?.get?.responses?.['404']);

  section('5. Database consistency (whole table)');
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
  // The seed generates dates before 2026-10-01; later rows were written through the API
  console.log('      history rows written through the API since seeding:', sql("SELECT COUNT(*) FROM RequestStatusHistory WHERE ChangedAt >= '2026-10-01'")[0]);

  console.log(`\n${failed === 0 ? 'ALL CHECKS PASSED' : failed + ' CHECK(S) FAILED'}`);
  process.exit(failed ? 1 : 0);
})().catch(error => {
  // e.g. the API or SQL Server is not reachable, or sqlcmd failed
  console.error(`\nVerification aborted: ${error.stderr || error.stdout || error.message}`);
  process.exit(2);
});
