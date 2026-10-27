// Verification of the read API (M2): compares API answers with direct SQL queries on the same database.
//
// Requirements: the API is running, the database is seeded with the default 100,000 requests,
// Node.js 18+ and sqlcmd on the PATH. Read-only – changes no data.
//
//   node scripts/dev/verify-read-api.js
//
// Environment variables (optional):
//   API_URL     default http://localhost:5084
//   SQL_SERVER  default (localdb)\MSSQLLocalDB  – the SQL Server instance the API uses (e.g. "." for a local default instance)
//
// Logs in as a demo user first: every endpoint requires a token (D-10).
const { execFileSync } = require('child_process');

const BASE = process.env.API_URL ?? 'http://localhost:5084';
const SQL_SERVER = process.env.SQL_SERVER ?? '(localdb)\\MSSQLLocalDB';

const sql = q => execFileSync('sqlcmd',
  ['-S', SQL_SERVER, '-E', '-d', 'RequestsManagement', '-h', '-1', '-W', '-b', '-t', '600', '-Q', 'SET NOCOUNT ON; ' + q],
  { encoding: 'utf8', timeout: 600000 }).split(/\r?\n/).map(s => s.trim()).filter(Boolean);

// Text from the database. sqlcmd prints '?' for Hebrew whatever the code page, so the column comes back as the hex
// of its UTF-16 bytes and is decoded here. (Hebrew in a query that is SENT to sqlcmd works as is.)
const hexToText = hex => Buffer.from(hex, 'hex').toString('utf16le');
const hexOf = column => `CONVERT(varchar(max), CAST(${column} AS varbinary(max)), 2)`;
const sqlText = (column, where) => hexToText(sql(`SELECT ${hexOf(column)} FROM Requests WHERE ${where}`)[0]);
const enc = encodeURIComponent;

let TOKEN = '';
const get = async (path, anonymous = false) => {
  const t0 = performance.now();
  const r = await fetch(BASE + path, { signal: AbortSignal.timeout(60000), headers: anonymous || !TOKEN ? {} : { Authorization: `Bearer ${TOKEN}` } });
  const elapsed = performance.now() - t0;
  if (elapsed > 2000) console.log(`      (slow call: ${path.slice(0, 80)} took ${elapsed.toFixed(0)} ms)`);
  const text = await r.text();
  let body; try { body = JSON.parse(text); } catch { body = text; }
  return { status: r.status, body, contentType: r.headers.get('content-type') };
};

let failed = 0;
const check = (name, ok, detail = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  – ' + detail : ''}`);
  if (!ok) failed++;
};
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const section = t => console.log(`\n== ${t}`);

(async () => {
  console.log(`API ${BASE}, SQL Server ${SQL_SERVER}`);

  // Bring the database into SQL Server's memory first, so the first API calls measure the API and not disk reads.
  // Done before logging in: a long warm-up would otherwise outlive the HTTP keep-alive connection.
  const warmStart = performance.now();
  // Every index of both tables, read from sys.indexes – the script does not depend on index names (changed in M8)
  sql("DECLARE @s nvarchar(max) = N''; " +
      "SELECT @s += N'SELECT COUNT_BIG(*) FROM ' + QUOTENAME(OBJECT_NAME(object_id)) + N' WITH (INDEX(' + QUOTENAME(name) + N'));' " +
      "FROM sys.indexes WHERE object_id IN (OBJECT_ID('Requests'), OBJECT_ID('RequestStatusHistory')) AND index_id > 0; " +
      'EXEC (@s);');
  console.log(`warm-up of the buffer pool took ${(performance.now() - warmStart).toFixed(0)} ms`);

  const loginResponse = await fetch(BASE + '/api/auth/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userName: 'dana.cohen', password: 'Demo123!' })
  });
  if (!loginResponse.ok) {
    console.error(`Login failed (${loginResponse.status}). Is the database seeded with the demo users?`);
    process.exit(1);
  }
  TOKEN = (await loginResponse.json()).accessToken;

  // ---------- 0. Authentication ----------
  section('0. Authentication (D-10): every endpoint requires a token');
  for (const p of ['/api/requests', '/api/requests/1', '/api/requests/summary']) {
    const r = await get(p, true);
    check(`GET ${p} without token -> 401 ProblemDetails`, r.status === 401 && /problem\+json/.test(r.contentType));
  }

  // ---------- 1. Filters: totalCount must equal a direct COUNT(*) ----------
  section('1. Filters and search – API totalCount vs direct SQL COUNT');
  // A whole organization name that exists, as a phrase to search for (the first Hebrew one in the table)
  const hebrewOrganization = sqlText('OrganizationName', "Id = (SELECT MIN(Id) FROM Requests WHERE OrganizationName LIKE N'[א-ת]%')");
  const countCases = [
    ['status=New', 'Status=1'],
    ['status=New&status=Waiting', 'Status IN (1,3)'],
    ['status=2&status=4', 'Status IN (2,4)'],
    ['priority=High&status=Completed', 'Priority=3 AND Status=4'],
    ['assignedTo=unassigned', 'AssignedTo IS NULL'],
    ['assignedTo=UnAssigned', 'AssignedTo IS NULL'],
    ['assignedTo=noa.carmi', "AssignedTo='noa.carmi'"],
    ['organization=Hermon', "OrganizationName LIKE 'Hermon%'"],
    // Hebrew titles and Hebrew and English organization names (D-33): a Hebrew substring, a phrase, a word that is
    // both in titles and in organization names, the gershayim of "בע״מ", and English organizations
    [`search=${enc('בונוס')}`, "(Title LIKE N'%בונוס%' OR OrganizationName LIKE N'%בונוס%')"],
    [`search=${enc('בונוס שנתי')}`, "(Title LIKE N'%בונוס שנתי%' OR OrganizationName LIKE N'%בונוס שנתי%')"],
    [`search=${enc('לוגיסטיקה')}`, "(Title LIKE N'%לוגיסטיקה%' OR OrganizationName LIKE N'%לוגיסטיקה%')"],
    [`search=${enc(hebrewOrganization)}`, `(Title LIKE N'%${hebrewOrganization}%' OR OrganizationName LIKE N'%${hebrewOrganization}%')`],
    [`search=${enc('בע״מ')}`, "(Title LIKE N'%בע״מ%' OR OrganizationName LIKE N'%בע״מ%')"],
    ['search=LOGISTICS', "(Title LIKE '%logistics%' OR OrganizationName LIKE '%logistics%')"],
    ['search=Hermon%20Agritech', "(Title LIKE '%Hermon Agritech%' OR OrganizationName LIKE '%Hermon Agritech%')"],
    // Organization filter = start of the name, in both languages
    [`organization=${enc('גליל')}`, "OrganizationName LIKE N'גליל%'"],
    [`organization=${enc('ירדן')}`, "OrganizationName LIKE N'ירדן%'"],
    [`organization=${enc('ירוק')}`, "OrganizationName LIKE N'ירוק%'"],
    [`search=${enc('לוגיסטיקה')}&organization=Cedar`, "(Title LIKE N'%לוגיסטיקה%' OR OrganizationName LIKE N'%לוגיסטיקה%') AND OrganizationName LIKE 'Cedar%'"],
    ['createdFrom=2025-01-01&createdTo=2025-01-31', "CreatedAt >= '2025-01-01' AND CreatedAt < '2025-02-01'"],
    ['createdFrom=2026-09-30', "CreatedAt >= '2026-09-30'"],
    ['createdTo=2024-10-01', "CreatedAt < '2024-10-02'"],
    [`status=New&priority=High&assignedTo=unassigned&createdFrom=2026-08-01&createdTo=2026-09-30&search=${enc('בונוס')}`,
      "Status=1 AND Priority=3 AND AssignedTo IS NULL AND CreatedAt >= '2026-08-01' AND CreatedAt < '2026-10-01' AND (Title LIKE N'%בונוס%' OR OrganizationName LIKE N'%בונוס%')"],
    // LIKE wildcards typed by the user must be literal characters, not wildcards
    ['search=%25', "(CHARINDEX('%', Title) > 0 OR CHARINDEX('%', OrganizationName) > 0)"],
    ['search=_', "(CHARINDEX('_', Title) > 0 OR CHARINDEX('_', OrganizationName) > 0)"],
    ['search=%5Ba', "(CHARINDEX('[a', Title) > 0 OR CHARINDEX('[a', OrganizationName) > 0)"],
    ["search=Modi'in", "(Title LIKE '%Modi''in%' OR OrganizationName LIKE '%Modi''in%')"],
    ['search=%20%20', '1=1'], // blank search = no search
  ];
  for (const [query, where] of countCases) {
    const expected = Number(sql(`SELECT COUNT(*) FROM Requests WHERE ${where}`)[0]);
    const r = await get(`/api/requests?${query}&pageSize=1`);
    check(`?${query.length > 70 ? query.slice(0, 67) + '...' : query}`,
      r.status === 200 && r.body.totalCount === expected, `api=${r.body.totalCount} sql=${expected}`);
  }

  // ---------- 2. Sorting and paging ----------
  section('2. Sorting – API page vs ORDER BY (with Id as tie-breaker) in SQL');
  const columns = { createdAt: 'CreatedAt', updatedAt: 'UpdatedAt', priority: 'Priority', status: 'Status', title: 'Title' };
  for (const [field, column] of Object.entries(columns)) {
    for (const dir of ['Asc', 'Desc']) {
      const r = await get(`/api/requests?sortBy=${field}&sortDir=${dir}&page=3&pageSize=7`);
      const expected = sql(`SELECT Id FROM Requests ORDER BY ${column} ${dir}, Id ${dir} OFFSET 14 ROWS FETCH NEXT 7 ROWS ONLY`).map(Number);
      const ids = r.body.items?.map(i => i.id);
      check(`sortBy=${field} ${dir}, page 3`, r.status === 200 && same(ids, expected), `api=[${ids}] sql=[${expected}]`);
    }
  }
  for (const dir of ['Asc', 'Desc']) {
    const titleWalk = [];
    for (let p = 1; p <= 5; p++) titleWalk.push(...(await get(`/api/requests?sortBy=title&sortDir=${dir}&page=${p}&pageSize=100`)).body.items.map(i => i.id));
    const expectedTitles = sql(`SELECT Id FROM Requests ORDER BY Title ${dir}, Id ${dir} OFFSET 0 ROWS FETCH NEXT 500 ROWS ONLY`).map(Number);
    check(`sortBy=title ${dir}: 5 pages x 100 Hebrew titles, same order as SQL`, new Set(titleWalk).size === 500 && same(titleWalk, expectedTitles));
  }
  const defaultSort = await get('/api/requests?pageSize=5');
  const expectedDefault = sql('SELECT TOP 5 Id FROM Requests ORDER BY CreatedAt DESC, Id DESC').map(Number);
  check('default sort = CreatedAt Desc', same(defaultSort.body.items.map(i => i.id), expectedDefault));

  section('3. Paging is stable and complete (sort by Priority – many equal values)');
  const walked = [];
  for (let p = 1; p <= 5; p++) walked.push(...(await get(`/api/requests?sortBy=priority&sortDir=Desc&page=${p}&pageSize=100`)).body.items.map(i => i.id));
  const expectedWalk = sql('SELECT Id FROM Requests ORDER BY Priority DESC, Id DESC OFFSET 0 ROWS FETCH NEXT 500 ROWS ONLY').map(Number);
  check('5 pages x 100 rows: no duplicates, same order as SQL', new Set(walked).size === 500 && same(walked, expectedWalk), `unique=${new Set(walked).size}`);
  const last = await get('/api/requests?page=1000&pageSize=100');
  check('last page (1000) has 100 items, totalPages=1000', last.body.items.length === 100 && last.body.totalPages === 1000);
  const beyond = await get('/api/requests?page=1001&pageSize=100');
  check('page beyond the end: 200 with empty items', beyond.status === 200 && beyond.body.items.length === 0 && beyond.body.totalCount === 100000);
  const none = await get('/api/requests?search=zzzznomatch');
  check('no matches: 200, empty items, totalCount 0', none.status === 200 && none.body.items.length === 0 && none.body.totalCount === 0);
  const defaults = await get('/api/requests');
  check('defaults: page 1, pageSize 20', defaults.body.page === 1 && defaults.body.pageSize === 20 && defaults.body.items.length === 20);
  const max = await get('/api/requests?pageSize=100');
  check('pageSize=100 (the maximum) is accepted', max.status === 200 && max.body.items.length === 100);

  // ---------- 4. Validation and error format ----------
  section('4. Invalid input -> 400 ValidationProblemDetails (same format for our rules and built-in errors)');
  const invalid = [
    ['pageSize=500', 'PageSize'], ['pageSize=0', 'PageSize'], ['pageSize=-5', 'PageSize'], ['page=0', 'Page'],
    ['page=1000001', 'Page'], ['sortBy=foo', 'SortBy'], ['sortBy=99', 'SortBy'], ['sortDir=up', 'SortDir'],
    ['sortDir=7', 'SortDir'], ['status=99', 'Status'], ['status=Foo', 'Status'], ['priority=0', 'Priority'],
    ['priority=Urgent', 'Priority'], ['createdFrom=2026-05-10&createdTo=2026-05-01', 'CreatedFrom'],
    ['createdFrom=notadate', 'CreatedFrom'], ['pageSize=abc', 'PageSize'],
    ['search=' + 'a'.repeat(101), 'Search'], ['organization=' + 'a'.repeat(151), 'Organization'],
    ['assignedTo=' + 'a'.repeat(101), 'AssignedTo'],
  ];
  const shapes = new Set();
  for (const [query, key] of invalid) {
    const r = await get(`/api/requests?${query}`);
    const keys = Object.keys(r.body.errors ?? {});
    const ok = r.status === 400 && /problem\+json/.test(r.contentType) && keys.some(k => k.toLowerCase().includes(key.toLowerCase())) && keys.every(k => /^[a-z]/.test(k)) && r.body.traceId && r.body.title && r.body.status === 400;
    if (r.status === 400) shapes.add(Object.keys(r.body).sort().join(','));
    check(`?${query.length > 60 ? query.slice(0, 57) + '...' : query}`, ok, `${keys.join('|')}: ${(r.body.errors?.[keys[0]] ?? [r.body.title])[0]}`);
  }
  check('all 400 responses have the identical set of fields', shapes.size === 1, [...shapes].join(' / '));
  const multi = await get('/api/requests?pageSize=500&page=0&sortBy=foo&status=99&createdFrom=2026-05-10&createdTo=2026-05-01');
  console.log('      several errors at once ->', JSON.stringify(multi.body.errors));
  check('several errors are reported together', multi.status === 400 && Object.keys(multi.body.errors).length >= 4);

  // ---------- 5. Details, 404 and other errors ----------
  section('5. Details and ProblemDetails for 404 / 405');
  const one = await get('/api/requests/1');
  const title = sqlText('Title', 'Id = 1');
  const status = sql('SELECT Status FROM Requests WHERE Id = 1')[0];
  check('GET /api/requests/1', one.status === 200 && one.body.id === 1 && one.body.title === title && one.body.status === ['', 'New', 'InProgress', 'Waiting', 'Completed'][Number(status)]);
  const hex = sql('SELECT CONVERT(varchar(32), CAST(RowVersion AS binary(8)), 2) FROM Requests WHERE Id = 1')[0];
  check('version is the row version as base64', one.body.version === Buffer.from(hex, 'hex').toString('base64'), `${one.body.version} = 0x${hex}`);
  check('dates are UTC (end with Z)', /Z$/.test(one.body.createdAt) && /Z$/.test(one.body.updatedAt), one.body.createdAt);
  for (const [path, expected] of [['/api/requests/999999', 404], ['/api/requests/0', 404], ['/api/requests/abc', 404], ['/api/nothing-here', 404]]) {
    const r = await get(path);
    check(`GET ${path} -> ${expected} ProblemDetails`, r.status === expected && /problem\+json/.test(r.contentType) && !!r.body.traceId && !!r.body.title, `${r.status} ${JSON.stringify(r.body).slice(0, 110)}`);
  }
  const post = await fetch(`${BASE}/api/requests`, { method: 'POST', headers: { Authorization: `Bearer ${TOKEN}` } });
  check('POST /api/requests -> 405 (no such operation)', post.status === 405, String(post.status));

  // ---------- 6. Summary ----------
  section('6. Summary vs direct SQL');
  const summary = (await get('/api/requests/summary')).body;
  const sqlStatus = Object.fromEntries(sql('SELECT Status, COUNT(*) FROM Requests GROUP BY Status').map(l => l.split(/\s+/).map(Number)));
  const sqlPriority = Object.fromEntries(sql('SELECT Priority, COUNT(*) FROM Requests GROUP BY Priority').map(l => l.split(/\s+/).map(Number)));
  // Names come back as hex (Hebrew), the count after the '|'
  const sqlTop = sql(`SELECT TOP 10 ${hexOf('OrganizationName')} + '|' + CAST(COUNT(*) AS varchar(10)) FROM Requests WHERE Status <> 4 GROUP BY OrganizationName ORDER BY COUNT(*) DESC, OrganizationName`)
    .map(row => { const [name, count] = row.split('|'); return `${hexToText(name)}|${count}`; });
  check('total', summary.total === 100000, String(summary.total));
  check('byStatus (all 4 listed)', same(summary.byStatus.map(s => s.count), [1, 2, 3, 4].map(s => sqlStatus[s])), JSON.stringify(summary.byStatus));
  check('byPriority (all 3 listed)', same(summary.byPriority.map(p => p.count), [1, 2, 3].map(p => sqlPriority[p])), JSON.stringify(summary.byPriority));
  check('topOrganizations (10, open requests only, same order)', same(summary.topOrganizations.map(o => `${o.organizationName}|${o.openRequests}`), sqlTop));
  console.log('      top 3:', summary.topOrganizations.slice(0, 3).map(o => `${o.organizationName} ${o.openRequests}`).join('; '));

  // ---------- 7. OpenAPI description ----------
  section('7. OpenAPI document and Swagger UI');
  const doc = (await get('/openapi/v1.json', true)).body;  // the OpenAPI document is anonymous (Development only)
  const op = doc.paths?.['/api/requests']?.get;
  const params = op?.parameters ?? [];
  console.log('      list parameters:', params.map(p => p.name).join(', '));
  check('documented query parameters are camelCase', params.length > 0 && params.every(p => /^[a-z]/.test(p.name)));
  const text = JSON.stringify(op ?? {});
  check('list operation documents assignedTo=unassigned', /unassigned/.test(text));
  check('list operation documents the pageSize limit', /100/.test(text));
  check('responses documented: 200 and 400', !!op?.responses?.['200'] && !!op?.responses?.['400']);
  check('detail operation documents 200 and 404', !!doc.paths?.['/api/requests/{id}']?.get?.responses?.['404']);
  const statusSchema = doc.components?.schemas?.RequestStatus;
  console.log('      RequestStatus schema:', JSON.stringify(statusSchema));
  check('enums are documented as strings', statusSchema?.type === 'string' || (statusSchema?.enum ?? []).every(v => typeof v === 'string'));
  const ui = await fetch(`${BASE}/swagger/index.html`);
  check('Swagger UI is served at /swagger', ui.status === 200);

  // ---------- 8. Timings (warm) ----------
  section('8. Response times (ms, after warm-up, 15 calls each, whole HTTP round trip)');
  const time = async (label, path) => {
    await get(path); await get(path);
    const times = [];
    for (let i = 0; i < 15; i++) { const t = performance.now(); await get(path); times.push(performance.now() - t); }
    times.sort((a, b) => a - b);
    console.log(`      ${label.padEnd(58)} median ${times[7].toFixed(0).padStart(4)}  max ${times[14].toFixed(0).padStart(4)}`);
  };
  await time('list, defaults (no filter, CreatedAt desc)', '/api/requests');
  await time('list, status=New & priority=High', '/api/requests?status=New&priority=High');
  await time('list, organization=Hermon', '/api/requests?organization=Hermon');
  await time('list, search=בונוס (LIKE %x%)', '/api/requests?search=' + enc('בונוס'));
  await time('list, sortBy=title', '/api/requests?sortBy=title');
  await time('list, page 1000 (deep OFFSET)', '/api/requests?page=1000&pageSize=100');
  await time('summary', '/api/requests/summary');

  console.log(`\n${failed === 0 ? 'ALL CHECKS PASSED' : failed + ' CHECK(S) FAILED'}`);
  process.exit(failed === 0 ? 0 : 1);
})().catch(error => {
  // e.g. the API or SQL Server is not reachable, or sqlcmd failed
  console.error(`\nVerification aborted: ${error.stderr || error.stdout || error.message}`);
  process.exit(2);
});
