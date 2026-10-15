// Tests run against pg-mem: an in-memory PostgreSQL look-alike, so Jenkins
// does not need a real database to run them.
const { test, before, after } = require('node:test');
const assert = require('node:assert');
const { newDb } = require('pg-mem');
const { createApp } = require('../src/app');
const { migrate } = require('../src/db');

const SECRET = 'test-secret-test-secret-1234';

let server;
let base;
let pool;
let token; // login token of the main test user

before(async () => {
  const mem = newDb();
  const { Pool } = mem.adapters.createPg();
  pool = new Pool();
  await migrate(pool, { lock: false });
  server = createApp({ pool, authSecret: SECRET }).listen(0);
  await new Promise((r) => server.once('listening', r));
  base = `http://127.0.0.1:${server.address().port}`;

  const reg = await fetch(`${base}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'ramesh', full_name: 'Ramesh Kumar', password: 'correct-horse-1' }),
  });
  token = (await reg.json()).token;
});

after(async () => {
  server.close();
  await pool.end();
});

// Sends requests as the main test user unless another token (or null for none) is given.
async function api(method, path, body, withToken = token) {
  const res = await fetch(`${base}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(withToken ? { Authorization: `Bearer ${withToken}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const raw = await res.text();
  return { status: res.status, body: raw ? JSON.parse(raw) : null };
}

async function newCrop(overrides = {}) {
  const res = await api('POST', '/api/crops', { name: 'Wheat', ...overrides });
  assert.strictEqual(res.status, 201);
  return res.body;
}

test('health check reports the database is up', async () => {
  const res = await api('GET', '/api/health');
  assert.strictEqual(res.status, 200);
  assert.strictEqual(res.body.status, 'ok');
  assert.strictEqual(res.body.db, 'up');
});

test('a crop needs a name', async () => {
  const res = await api('POST', '/api/crops', { variety: 'HD-2967' });
  assert.strictEqual(res.status, 400);
  assert.match(res.body.error, /name/i);
});

test('rejects bad dates, areas and statuses', async () => {
  assert.strictEqual((await api('POST', '/api/crops', { name: 'Rice', sowing_date: '15/06/2026' })).status, 400);
  assert.strictEqual((await api('POST', '/api/crops', { name: 'Rice', area_acres: -3 })).status, 400);
  assert.strictEqual((await api('POST', '/api/crops', { name: 'Rice', status: 'dead' })).status, 400);
});

test('creates a crop and lists it with totals', async () => {
  const crop = await newCrop({
    name: 'Basmati rice',
    variety: 'Pusa 1121',
    field_name: 'North field',
    area_acres: 2.5,
    season: 'Kharif',
    sowing_date: '2026-06-20',
    expected_harvest_date: '2026-10-25',
    status: 'growing',
  });
  assert.strictEqual(crop.name, 'Basmati rice');
  assert.strictEqual(crop.area_acres, 2.5);

  const list = await api('GET', '/api/crops');
  assert.strictEqual(list.status, 200);
  const found = list.body.find((c) => c.id === crop.id);
  assert.ok(found);
  assert.strictEqual(found.total_cost, 0);
  assert.match(found.sowing_date, /^\d{4}-\d{2}-\d{2}$/);
});

test('unknown crop returns 404', async () => {
  assert.strictEqual((await api('GET', '/api/crops/999999')).status, 404);
  assert.strictEqual((await api('GET', '/api/crops/abc')).status, 404);
});

test('updates a crop', async () => {
  const crop = await newCrop();
  const res = await api('PUT', `/api/crops/${crop.id}`, { name: 'Wheat', status: 'harvested', notes: 'Good yield' });
  assert.strictEqual(res.status, 200);
  assert.strictEqual(res.body.status, 'harvested');
  assert.strictEqual(res.body.notes, 'Good yield');
});

test('records activities, adds new types, and totals the cost', async () => {
  const crop = await newCrop({ name: 'Cotton' });
  const first = await api('POST', `/api/crops/${crop.id}/activities`, {
    type: 'Irrigation',
    activity_date: '2026-07-01',
    description: 'Canal water, 4 hours',
    cost: 300,
  });
  assert.strictEqual(first.status, 201);

  const second = await api('POST', `/api/crops/${crop.id}/activities`, {
    type: 'Bird scaring',
    activity_date: '2026-07-05',
    quantity: 2,
    unit: 'workers',
    cost: 450.5,
  });
  assert.strictEqual(second.status, 201);

  const types = await api('GET', '/api/activity-types');
  assert.ok(types.body.includes('Irrigation'));
  assert.ok(types.body.includes('Bird scaring'));

  const detail = await api('GET', `/api/crops/${crop.id}`);
  assert.strictEqual(detail.body.activities.length, 2);
  assert.strictEqual(detail.body.summary.total_cost, 750.5);
});

test('activity needs a type and a valid date', async () => {
  const crop = await newCrop();
  const noType = await api('POST', `/api/crops/${crop.id}/activities`, { activity_date: '2026-07-01' });
  assert.strictEqual(noType.status, 400);
  const badDate = await api('POST', `/api/crops/${crop.id}/activities`, { type: 'Sowing', activity_date: 'yesterday' });
  assert.strictEqual(badDate.status, 400);
  const noCrop = await api('POST', '/api/crops/999999/activities', { type: 'Sowing', activity_date: '2026-07-01' });
  assert.strictEqual(noCrop.status, 404);
});

test('edits and deletes an activity', async () => {
  const crop = await newCrop();
  const act = (
    await api('POST', `/api/crops/${crop.id}/activities`, { type: 'Weeding', activity_date: '2026-07-10', cost: 100 })
  ).body;
  const edited = await api('PUT', `/api/activities/${act.id}`, { type: 'Weeding', activity_date: '2026-07-11', cost: 120 });
  assert.strictEqual(edited.status, 200);
  assert.strictEqual(edited.body.cost, 120);
  assert.strictEqual((await api('DELETE', `/api/activities/${act.id}`)).status, 204);
  assert.strictEqual((await api('DELETE', `/api/activities/${act.id}`)).status, 404);
});

test('sales add up to income and profit', async () => {
  const crop = await newCrop({ name: 'Maize' });
  await api('POST', `/api/crops/${crop.id}/activities`, { type: 'Sowing', activity_date: '2026-06-01', cost: 1000 });
  const sale = await api('POST', `/api/crops/${crop.id}/sales`, {
    sale_date: '2026-10-20',
    quantity: 500,
    unit: 'kg',
    price_per_unit: 22,
    buyer: 'Local mandi',
  });
  assert.strictEqual(sale.status, 201);
  assert.strictEqual(sale.body.amount, 11000);

  const detail = await api('GET', `/api/crops/${crop.id}`);
  assert.strictEqual(detail.body.summary.total_income, 11000);
  assert.strictEqual(detail.body.summary.profit, 10000);

  const bad = await api('POST', `/api/crops/${crop.id}/sales`, { sale_date: '2026-10-20', quantity: 0, price_per_unit: 5 });
  assert.strictEqual(bad.status, 400);
});

test('farmers can attach their own details to a crop', async () => {
  const crop = await newCrop();
  const added = await api('POST', `/api/crops/${crop.id}/details`, { label: 'Soil type', value: 'Black cotton soil' });
  assert.strictEqual(added.status, 201);

  let detail = await api('GET', `/api/crops/${crop.id}`);
  assert.strictEqual(detail.body.details.length, 1);
  assert.strictEqual(detail.body.details[0].label, 'Soil type');

  assert.strictEqual((await api('DELETE', `/api/details/${added.body.id}`)).status, 204);
  detail = await api('GET', `/api/crops/${crop.id}`);
  assert.strictEqual(detail.body.details.length, 0);

  const missing = await api('POST', `/api/crops/${crop.id}/details`, { label: 'Only a label' });
  assert.strictEqual(missing.status, 400);
});

test('deleting a crop removes its activities, sales and details', async () => {
  const crop = await newCrop();
  await api('POST', `/api/crops/${crop.id}/activities`, { type: 'Sowing', activity_date: '2026-06-01', cost: 10 });
  await api('POST', `/api/crops/${crop.id}/sales`, { sale_date: '2026-10-01', quantity: 1, price_per_unit: 1 });
  await api('POST', `/api/crops/${crop.id}/details`, { label: 'a', value: 'b' });

  assert.strictEqual((await api('DELETE', `/api/crops/${crop.id}`)).status, 204);
  assert.strictEqual((await api('GET', `/api/crops/${crop.id}`)).status, 404);
  const left = await pool.query('SELECT COUNT(*) AS c FROM activities WHERE crop_id = $1', [crop.id]);
  assert.strictEqual(Number(left.rows[0].c), 0);
});

test('summary reflects new spending and income', async () => {
  const before = (await api('GET', '/api/summary')).body;
  const crop = await newCrop({ name: 'Mustard', area_acres: 1 });
  await api('POST', `/api/crops/${crop.id}/activities`, { type: 'Fertilizer', activity_date: '2026-11-01', cost: 500 });
  await api('POST', `/api/crops/${crop.id}/sales`, { sale_date: '2027-03-01', quantity: 10, price_per_unit: 100 });
  const after = (await api('GET', '/api/summary')).body;

  assert.strictEqual(after.crops.total, before.crops.total + 1);
  assert.strictEqual(after.total_cost, before.total_cost + 500);
  assert.strictEqual(after.total_income, before.total_income + 1000);
  assert.ok(Array.isArray(after.cost_by_type));
  assert.ok(Array.isArray(after.recent_activities));
});

test('invalid JSON gets a clear 400, unknown API routes a 404', async () => {
  const res = await fetch(`${base}/api/crops`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{not json',
  });
  assert.strictEqual(res.status, 400);
  assert.strictEqual((await api('GET', '/api/nothing-here')).status, 404);
});

test('metrics expose request timings and farm counters', async () => {
  await api('GET', '/api/health');
  const res = await fetch(`${base}/metrics`);
  const body = await res.text();
  assert.strictEqual(res.status, 200);
  assert.match(body, /http_request_duration_seconds/);
  assert.match(body, /farm_records_created_total/);
});

// ---------- login ----------

test('API needs a login, but health and metrics stay open', async () => {
  assert.strictEqual((await api('GET', '/api/crops', undefined, null)).status, 401);
  assert.strictEqual((await api('GET', '/api/summary', undefined, 'garbage.token')).status, 401);
  assert.strictEqual((await api('GET', '/api/health', undefined, null)).status, 200);
  assert.strictEqual((await fetch(`${base}/metrics`)).status, 200);
});

test('register validates input and refuses duplicate usernames', async () => {
  const post = (b) => api('POST', '/api/auth/register', b, null);
  assert.strictEqual((await post({ username: 'ab', full_name: 'X', password: 'longenough1' })).status, 400);
  assert.strictEqual((await post({ username: 'sita', full_name: '', password: 'longenough1' })).status, 400);
  assert.strictEqual((await post({ username: 'sita', full_name: 'Sita', password: 'short' })).status, 400);
  assert.strictEqual((await post({ username: 'RAMESH', full_name: 'Other', password: 'longenough1' })).status, 409);
});

test('login works, the password is not stored in plain text, wrong passwords fail', async () => {
  const ok = await api('POST', '/api/auth/login', { username: ' Ramesh ', password: 'correct-horse-1' }, null);
  assert.strictEqual(ok.status, 200);
  assert.ok(ok.body.token);
  assert.strictEqual(ok.body.user.full_name, 'Ramesh Kumar');
  assert.strictEqual(ok.body.user.password_hash, undefined);

  const me = await api('GET', '/api/auth/me', undefined, ok.body.token);
  assert.strictEqual(me.body.user.username, 'ramesh');

  const stored = await pool.query("SELECT password_hash FROM users WHERE username = 'ramesh'");
  assert.ok(stored.rows[0].password_hash.startsWith('scrypt$'));
  assert.ok(!stored.rows[0].password_hash.includes('correct-horse-1'));

  assert.strictEqual((await api('POST', '/api/auth/login', { username: 'ramesh', password: 'wrong-password' }, null)).status, 401);
  assert.strictEqual((await api('POST', '/api/auth/login', { username: 'nobody', password: 'whatever123' }, null)).status, 401);
});

test('too many wrong passwords are blocked for a while', async () => {
  await api('POST', '/api/auth/register', { username: 'locked', full_name: 'Locked', password: 'right-password' }, null);
  let last;
  for (let i = 0; i < 9; i += 1) {
    last = await api('POST', '/api/auth/login', { username: 'locked', password: `wrong-${i}` }, null);
  }
  assert.strictEqual(last.status, 429);
  // even the right password is refused during the lock
  assert.strictEqual((await api('POST', '/api/auth/login', { username: 'locked', password: 'right-password' }, null)).status, 429);
});

test('a token signed with another secret, or expired, is rejected', async () => {
  const { createToken, readToken } = require('../src/auth');
  const forged = createToken(1, 'a-different-secret-entirely');
  assert.strictEqual((await api('GET', '/api/crops', undefined, forged)).status, 401);
  const old = createToken(1, SECRET, Date.now() - 8 * 24 * 60 * 60 * 1000);
  assert.strictEqual(readToken(old, SECRET), null);
  assert.strictEqual((await api('GET', '/api/crops', undefined, old)).status, 401);
});

test('each farmer only sees and changes their own data', async () => {
  const other = (await api('POST', '/api/auth/register', { username: 'sita', full_name: 'Sita Devi', password: 'another-pass-1' }, null)).body.token;

  const mine = await newCrop({ name: 'Private wheat', area_acres: 2 });
  const act = (await api('POST', `/api/crops/${mine.id}/activities`, { type: 'Sowing', activity_date: '2026-11-01', cost: 100 })).body;
  const sale = (await api('POST', `/api/crops/${mine.id}/sales`, { sale_date: '2027-03-01', quantity: 5, price_per_unit: 10 })).body;
  const detail = (await api('POST', `/api/crops/${mine.id}/details`, { label: 'Soil', value: 'Loam' })).body;

  const theirs = (await api('GET', '/api/crops', undefined, other)).body;
  assert.strictEqual(theirs.length, 0);
  assert.strictEqual((await api('GET', `/api/crops/${mine.id}`, undefined, other)).status, 404);
  assert.strictEqual((await api('PUT', `/api/crops/${mine.id}`, { name: 'Stolen' }, other)).status, 404);
  assert.strictEqual((await api('DELETE', `/api/crops/${mine.id}`, undefined, other)).status, 404);
  assert.strictEqual((await api('POST', `/api/crops/${mine.id}/activities`, { type: 'Sowing', activity_date: '2026-11-01' }, other)).status, 404);
  assert.strictEqual((await api('PUT', `/api/activities/${act.id}`, { type: 'Sowing', activity_date: '2026-11-02' }, other)).status, 404);
  assert.strictEqual((await api('DELETE', `/api/activities/${act.id}`, undefined, other)).status, 404);
  assert.strictEqual((await api('DELETE', `/api/sales/${sale.id}`, undefined, other)).status, 404);
  assert.strictEqual((await api('DELETE', `/api/details/${detail.id}`, undefined, other)).status, 404);
  assert.strictEqual((await api('GET', `/api/crops/${mine.id}/guidance`, undefined, other)).status, 404);

  const summary = (await api('GET', '/api/summary', undefined, other)).body;
  assert.strictEqual(summary.crops.total, 0);
  assert.strictEqual(summary.total_cost, 0);

  // and everything is still intact for the owner
  const still = (await api('GET', `/api/crops/${mine.id}`)).body;
  assert.strictEqual(still.name, 'Private wheat');
  assert.strictEqual(still.activities.length, 1);
  assert.strictEqual(still.sales.length, 1);
  assert.strictEqual(still.details.length, 1);
});

test('the first account takes over crops created before logins existed', async () => {
  const mem = newDb();
  const { Pool } = mem.adapters.createPg();
  const p2 = new Pool();
  await migrate(p2, { lock: false });
  await p2.query("INSERT INTO crops (name, area_acres) VALUES ('Old wheat', 3)");
  const srv = createApp({ pool: p2, authSecret: SECRET }).listen(0);
  await new Promise((r) => srv.once('listening', r));
  const url = `http://127.0.0.1:${srv.address().port}`;
  const post = (path, body, t) =>
    fetch(`${url}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(t ? { Authorization: `Bearer ${t}` } : {}) },
      body: JSON.stringify(body),
    }).then((r) => r.json());
  try {
    const first = await post('/api/auth/register', { username: 'owner', full_name: 'Owner', password: 'long-password-1' });
    const list = await fetch(`${url}/api/crops`, { headers: { Authorization: `Bearer ${first.token}` } }).then((r) => r.json());
    assert.deepStrictEqual(list.map((c) => c.name), ['Old wheat']);

    const second = await post('/api/auth/register', { username: 'newcomer', full_name: 'New', password: 'long-password-2' });
    const none = await fetch(`${url}/api/crops`, { headers: { Authorization: `Bearer ${second.token}` } }).then((r) => r.json());
    assert.strictEqual(none.length, 0);
  } finally {
    srv.close();
    await p2.end();
  }
});

test('registration can be switched off', async () => {
  const mem = newDb();
  const { Pool } = mem.adapters.createPg();
  const p3 = new Pool();
  await migrate(p3, { lock: false });
  const srv = createApp({ pool: p3, authSecret: SECRET, allowRegistration: false }).listen(0);
  await new Promise((r) => srv.once('listening', r));
  try {
    const res = await fetch(`http://127.0.0.1:${srv.address().port}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'someone', full_name: 'Someone', password: 'long-password-1' }),
    });
    assert.strictEqual(res.status, 403);
  } finally {
    srv.close();
    await p3.end();
  }
});

test('the app refuses to start without a proper secret', () => {
  assert.throws(() => createApp({ pool }), /AUTH_SECRET/);
  assert.throws(() => createApp({ pool, authSecret: 'short' }), /AUTH_SECRET/);
});

// ---------- guidance ----------

test('guidance scales seed, fertilizer, water and yield to the crop area', async () => {
  const crop = await newCrop({ name: 'Wheat (HD-2967)', area_acres: 2.5, sowing_date: '2026-11-10' });
  const res = await api('GET', `/api/crops/${crop.id}/guidance`);
  assert.strictEqual(res.status, 200);
  const g = res.body;
  assert.strictEqual(g.matched, true);
  assert.strictEqual(g.slug, 'wheat');
  assert.deepStrictEqual(g.total.seed, { min: 100, max: 125, unit: 'kg' });
  assert.deepStrictEqual(g.total.nutrients, { n: 120, p: 60, k: 40 });
  const dap = g.total.products.find((p) => p.name === 'DAP');
  const urea = g.total.products.find((p) => p.name === 'Urea');
  assert.strictEqual(dap.kg, 130.4);
  assert.strictEqual(urea.kg, 209.8);

  // the dated plan: sowing day is day 0, the first irrigation is 21 days later
  const first = g.tasks.find((t) => t.type === 'irrigation');
  assert.strictEqual(first.date, '2026-12-01');
  assert.strictEqual(first.water_litres, 506000);
  const sorted = [...g.tasks].sort((a, b) => a.das - b.das).map((t) => t.das);
  assert.deepStrictEqual(g.tasks.map((t) => t.das), sorted);

  // the urea in the top-dress steps adds up to the total
  const urea2 = g.tasks.filter((t) => t.type === 'fertilizer').flatMap((t) => t.products).filter((p) => p.name === 'Urea');
  assert.ok(Math.abs(urea2.reduce((s, p) => s + p.kg, 0) - urea.kg) < 0.2);
});

test('guidance works without area or sowing date, and knows local crop names', async () => {
  const crop = await newCrop({ name: 'Gehu' });
  const g = (await api('GET', `/api/crops/${crop.id}/guidance`)).body;
  assert.strictEqual(g.matched, true);
  assert.strictEqual(g.per_acre_only, true);
  assert.strictEqual(g.tasks[0].date, null);
  assert.deepStrictEqual(g.total.seed, { min: 40, max: 50, unit: 'kg' });
});

test('guidance for an unknown crop lists the crops it does know', async () => {
  const crop = await newCrop({ name: 'Dragon fruit' });
  const g = (await api('GET', `/api/crops/${crop.id}/guidance`)).body;
  assert.strictEqual(g.matched, false);
  assert.ok(g.available.length >= 10);
  assert.strictEqual((await api('GET', '/api/crops/99999/guidance')).status, 404);
});

test('every built-in crop has sane, complete data', () => {
  const { GUIDE, buildGuidance } = require('../src/guide');
  const slugs = new Set();
  for (const g of GUIDE) {
    assert.ok(!slugs.has(g.slug), `duplicate ${g.slug}`);
    slugs.add(g.slug);
    assert.ok(g.seed.min > 0 && g.seed.max >= g.seed.min, `${g.slug} seed`);
    assert.ok(g.water_mm[1] >= g.water_mm[0] && g.yield_quintal[1] >= g.yield_quintal[0], `${g.slug} ranges`);
    assert.ok(g.schedule.some((t) => t.type === 'harvest'), `${g.slug} has no harvest step`);
    assert.ok(g.schedule.some((t) => t.type === 'sowing' && t.das <= 0), `${g.slug} has no sowing step`);

    // fertilizer shares never add up to more than 100 percent of each nutrient
    for (const nutrient of ['n', 'p', 'k']) {
      const sum = g.schedule.filter((t) => t.type === 'fertilizer').reduce((s, t) => s + (t.share[nutrient] || 0), 0);
      assert.ok(sum <= 1.0001, `${g.slug} ${nutrient} shares add up to ${sum}`);
      assert.ok(sum >= 0.99 || g.nutrients[nutrient] === 0, `${g.slug} ${nutrient} is never fully applied (${sum})`);
    }
    const built = buildGuidance(g, { area_acres: 1, sowing_date: '2026-06-01' }, '2026-06-01');
    assert.ok(built.tasks.every((t) => /^\d{4}-\d{2}-\d{2}$/.test(t.date)));
  }
});

test('the dashboard lists tasks due soon for crops with a sowing date', async () => {
  const today = new Date();
  const sown = new Date(today.getTime() - 20 * 86400000).toISOString().slice(0, 10); // 20 days ago
  const crop = await newCrop({ name: 'Wheat for reminders', area_acres: 1, sowing_date: sown, status: 'growing' });
  const summary = (await api('GET', '/api/summary')).body;
  const due = summary.due_tasks.filter((t) => t.crop_id === crop.id);
  assert.ok(due.some((t) => t.type === 'irrigation' && t.days_from_today === 1), 'first irrigation is due tomorrow');
});
