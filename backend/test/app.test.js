// Tests run against pg-mem: an in-memory PostgreSQL look-alike, so Jenkins
// does not need a real database to run them.
const { test, before, after } = require('node:test');
const assert = require('node:assert');
const { newDb } = require('pg-mem');
const { createApp } = require('../src/app');
const { migrate } = require('../src/db');

let server;
let base;
let pool;

before(async () => {
  const mem = newDb();
  const { Pool } = mem.adapters.createPg();
  pool = new Pool();
  await migrate(pool, { lock: false });
  server = createApp({ pool }).listen(0);
  await new Promise((r) => server.once('listening', r));
  base = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  server.close();
  await pool.end();
});

async function api(method, path, body) {
  const res = await fetch(`${base}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
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
