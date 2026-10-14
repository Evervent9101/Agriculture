const express = require('express');
const cors = require('cors');
const client = require('prom-client');

const CROP_STATUSES = ['planned', 'growing', 'harvested'];

// ---------- small helpers ----------

const text = (v, max = 200) => {
  if (v === undefined || v === null) return null;
  const s = String(v).trim();
  return s === '' ? null : s.slice(0, max);
};

// Returns null for empty input, NaN for invalid or negative numbers.
const number = (v) => {
  if (v === undefined || v === null || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? n : NaN;
};

const isDate = (v) => {
  if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
  const d = new Date(`${v}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v;
};

// Optional date: returns undefined when the value is present but invalid.
const optDate = (v) => {
  if (v === undefined || v === null || v === '') return null;
  return isDate(v) ? v : undefined;
};

const n = (v) => (v === null || v === undefined ? null : Number(v));

const d = (v) => {
  if (v === null || v === undefined) return null;
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  return String(v).slice(0, 10);
};

const idOf = (value) => {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
};

const mapCrop = (r) => ({
  id: r.id,
  name: r.name,
  variety: r.variety,
  field_name: r.field_name,
  area_acres: n(r.area_acres),
  season: r.season,
  sowing_date: d(r.sowing_date),
  expected_harvest_date: d(r.expected_harvest_date),
  status: r.status,
  notes: r.notes,
});

const mapActivity = (r) => ({
  id: r.id,
  crop_id: r.crop_id,
  type: r.type,
  activity_date: d(r.activity_date),
  description: r.description,
  quantity: n(r.quantity),
  unit: r.unit,
  cost: n(r.cost) || 0,
});

const mapSale = (r) => {
  const quantity = n(r.quantity);
  const price = n(r.price_per_unit);
  return {
    id: r.id,
    crop_id: r.crop_id,
    sale_date: d(r.sale_date),
    quantity,
    unit: r.unit,
    price_per_unit: price,
    amount: Math.round(quantity * price * 100) / 100,
    buyer: r.buyer,
  };
};

const round2 = (x) => Math.round(x * 100) / 100;

// Validates the body of POST/PUT /api/crops. Returns { error } or { value }.
function readCrop(body) {
  const b = body || {};
  const name = text(b.name, 100);
  if (!name) return { error: 'Crop name is required' };

  const area = number(b.area_acres);
  if (Number.isNaN(area)) return { error: 'Area must be a positive number' };

  const sowing = optDate(b.sowing_date);
  if (sowing === undefined) return { error: 'Sowing date must look like 2026-06-15' };
  const harvest = optDate(b.expected_harvest_date);
  if (harvest === undefined) return { error: 'Harvest date must look like 2026-10-30' };

  const status = b.status ? String(b.status) : 'planned';
  if (!CROP_STATUSES.includes(status)) {
    return { error: `Status must be one of: ${CROP_STATUSES.join(', ')}` };
  }

  return {
    value: {
      name,
      variety: text(b.variety, 100),
      field_name: text(b.field_name, 100),
      area_acres: area,
      season: text(b.season, 50),
      sowing_date: sowing,
      expected_harvest_date: harvest,
      status,
      notes: text(b.notes, 2000),
    },
  };
}

// Validates the body of POST/PUT activities.
function readActivity(body) {
  const b = body || {};
  const type = text(b.type, 60);
  if (!type) return { error: 'Activity type is required' };
  if (!isDate(b.activity_date)) return { error: 'Activity date must look like 2026-06-15' };
  const quantity = number(b.quantity);
  if (Number.isNaN(quantity)) return { error: 'Quantity must be a positive number' };
  const cost = number(b.cost);
  if (Number.isNaN(cost)) return { error: 'Cost must be a positive number' };
  return {
    value: {
      type,
      activity_date: b.activity_date,
      description: text(b.description, 1000),
      quantity,
      unit: text(b.unit, 20),
      cost: cost === null ? 0 : cost,
    },
  };
}

function readSale(body) {
  const b = body || {};
  if (!isDate(b.sale_date)) return { error: 'Sale date must look like 2026-11-05' };
  const quantity = number(b.quantity);
  if (quantity === null || Number.isNaN(quantity) || quantity <= 0) {
    return { error: 'Quantity must be a number above zero' };
  }
  const price = number(b.price_per_unit);
  if (price === null || Number.isNaN(price)) {
    return { error: 'Price per unit must be a number' };
  }
  return {
    value: {
      sale_date: b.sale_date,
      quantity,
      unit: text(b.unit, 20) || 'kg',
      price_per_unit: price,
      buyer: text(b.buyer, 100),
    },
  };
}

// ---------- the app ----------

function createApp({ pool }) {
  const app = express();
  app.use(cors());
  app.use(express.json());

  // ----- Prometheus metrics -----
  const register = new client.Registry();
  client.collectDefaultMetrics({ register });

  const httpDuration = new client.Histogram({
    name: 'http_request_duration_seconds',
    help: 'HTTP request duration in seconds',
    labelNames: ['method', 'route', 'status'],
    buckets: [0.005, 0.01, 0.05, 0.1, 0.3, 0.5, 1, 2, 5],
    registers: [register],
  });

  const recordsCreated = new client.Counter({
    name: 'farm_records_created_total',
    help: 'Records created through the API',
    labelNames: ['kind'],
    registers: [register],
  });

  // Gauge read from the database every time Prometheus scrapes /metrics
  new client.Gauge({
    name: 'farm_crops',
    help: 'Number of crops by status',
    labelNames: ['status'],
    registers: [register],
    async collect() {
      try {
        const { rows } = await pool.query('SELECT status, COUNT(*) AS total FROM crops GROUP BY status');
        this.reset();
        for (const row of rows) this.set({ status: row.status }, Number(row.total));
      } catch (_) {
        /* database down: leave the gauge empty, /api/health reports it */
      }
    },
  });

  app.use((req, res, next) => {
    const end = httpDuration.startTimer();
    res.on('finish', () => {
      const route = req.route ? req.baseUrl + req.route.path : req.path;
      end({ method: req.method, route, status: res.statusCode });
    });
    next();
  });

  const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
  const bad = (res, message) => res.status(400).json({ error: message });
  const notFound = (res, what = 'Not found') => res.status(404).json({ error: what });

  // ----- health / info -----
  app.get(
    '/api/health',
    wrap(async (req, res) => {
      try {
        await pool.query('SELECT 1');
        res.json({ status: 'ok', db: 'up', uptime: process.uptime(), time: new Date().toISOString() });
      } catch (err) {
        res.status(503).json({ status: 'error', db: 'down' });
      }
    })
  );

  app.get('/api/info', (req, res) => {
    res.json({
      app: 'farm-crop-manager',
      version: process.env.APP_VERSION || 'dev',
      build: process.env.BUILD_NUMBER || 'local',
      node: process.version,
    });
  });

  // ----- crops -----
  app.get(
    '/api/crops',
    wrap(async (req, res) => {
      const crops = (await pool.query('SELECT * FROM crops ORDER BY id DESC')).rows;
      const costs = (await pool.query('SELECT crop_id, SUM(cost) AS total, COUNT(*) AS cnt FROM activities GROUP BY crop_id')).rows;
      const sales = (await pool.query('SELECT * FROM sales')).rows;

      const costBy = new Map(costs.map((r) => [r.crop_id, { total: Number(r.total), count: Number(r.cnt) }]));
      const incomeBy = new Map();
      for (const s of sales.map(mapSale)) {
        incomeBy.set(s.crop_id, (incomeBy.get(s.crop_id) || 0) + s.amount);
      }

      res.json(
        crops.map((row) => {
          const c = costBy.get(row.id) || { total: 0, count: 0 };
          const income = incomeBy.get(row.id) || 0;
          return {
            ...mapCrop(row),
            activity_count: c.count,
            total_cost: round2(c.total),
            total_income: round2(income),
            profit: round2(income - c.total),
          };
        })
      );
    })
  );

  app.post(
    '/api/crops',
    wrap(async (req, res) => {
      const { error, value: v } = readCrop(req.body);
      if (error) return bad(res, error);
      const { rows } = await pool.query(
        `INSERT INTO crops (name, variety, field_name, area_acres, season, sowing_date, expected_harvest_date, status, notes)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
        [v.name, v.variety, v.field_name, v.area_acres, v.season, v.sowing_date, v.expected_harvest_date, v.status, v.notes]
      );
      recordsCreated.inc({ kind: 'crop' });
      res.status(201).json({ ...mapCrop(rows[0]), activity_count: 0, total_cost: 0, total_income: 0, profit: 0 });
    })
  );

  app.get(
    '/api/crops/:id',
    wrap(async (req, res) => {
      const id = idOf(req.params.id);
      if (!id) return notFound(res, 'Crop not found');
      const found = await pool.query('SELECT * FROM crops WHERE id = $1', [id]);
      if (found.rows.length === 0) return notFound(res, 'Crop not found');

      const details = (await pool.query('SELECT id, label, value FROM crop_details WHERE crop_id = $1 ORDER BY id', [id])).rows;
      const activities = (
        await pool.query('SELECT * FROM activities WHERE crop_id = $1 ORDER BY activity_date DESC, id DESC', [id])
      ).rows.map(mapActivity);
      const sales = (
        await pool.query('SELECT * FROM sales WHERE crop_id = $1 ORDER BY sale_date DESC, id DESC', [id])
      ).rows.map(mapSale);

      const totalCost = activities.reduce((sum, a) => sum + a.cost, 0);
      const totalIncome = sales.reduce((sum, s) => sum + s.amount, 0);

      res.json({
        ...mapCrop(found.rows[0]),
        details,
        activities,
        sales,
        summary: {
          total_cost: round2(totalCost),
          total_income: round2(totalIncome),
          profit: round2(totalIncome - totalCost),
        },
      });
    })
  );

  app.put(
    '/api/crops/:id',
    wrap(async (req, res) => {
      const id = idOf(req.params.id);
      if (!id) return notFound(res, 'Crop not found');
      const { error, value: v } = readCrop(req.body);
      if (error) return bad(res, error);
      const { rows } = await pool.query(
        `UPDATE crops SET name = $1, variety = $2, field_name = $3, area_acres = $4, season = $5,
           sowing_date = $6, expected_harvest_date = $7, status = $8, notes = $9
         WHERE id = $10 RETURNING *`,
        [v.name, v.variety, v.field_name, v.area_acres, v.season, v.sowing_date, v.expected_harvest_date, v.status, v.notes, id]
      );
      if (rows.length === 0) return notFound(res, 'Crop not found');
      res.json(mapCrop(rows[0]));
    })
  );

  app.delete(
    '/api/crops/:id',
    wrap(async (req, res) => {
      const id = idOf(req.params.id);
      if (!id) return notFound(res, 'Crop not found');
      const result = await pool.query('DELETE FROM crops WHERE id = $1 RETURNING id', [id]);
      if (result.rows.length === 0) return notFound(res, 'Crop not found');
      res.status(204).end();
    })
  );

  // ----- extra details on a crop (soil type, seed supplier, anything the farmer wants) -----
  app.post(
    '/api/crops/:id/details',
    wrap(async (req, res) => {
      const id = idOf(req.params.id);
      if (!id) return notFound(res, 'Crop not found');
      const label = text(req.body && req.body.label, 60);
      const value = text(req.body && req.body.value, 500);
      if (!label || !value) return bad(res, 'Both a label and a value are required');
      const crop = await pool.query('SELECT id FROM crops WHERE id = $1', [id]);
      if (crop.rows.length === 0) return notFound(res, 'Crop not found');
      const { rows } = await pool.query(
        'INSERT INTO crop_details (crop_id, label, value) VALUES ($1, $2, $3) RETURNING id, label, value',
        [id, label, value]
      );
      res.status(201).json(rows[0]);
    })
  );

  app.delete(
    '/api/details/:id',
    wrap(async (req, res) => {
      const id = idOf(req.params.id);
      if (!id) return notFound(res);
      const result = await pool.query('DELETE FROM crop_details WHERE id = $1 RETURNING id', [id]);
      if (result.rows.length === 0) return notFound(res);
      res.status(204).end();
    })
  );

  // ----- activity types (the list farmers pick from; new ones are added automatically) -----
  app.get(
    '/api/activity-types',
    wrap(async (req, res) => {
      const { rows } = await pool.query('SELECT name FROM activity_types ORDER BY id');
      res.json(rows.map((r) => r.name));
    })
  );

  async function ensureActivityType(name) {
    const existing = await pool.query('SELECT id FROM activity_types WHERE name = $1', [name]);
    if (existing.rows.length === 0) {
      try {
        await pool.query('INSERT INTO activity_types (name) VALUES ($1)', [name]);
      } catch (_) {
        /* added by a parallel request, fine */
      }
    }
  }

  // ----- activities (the farming process: sowing, irrigation, spraying, harvest...) -----
  app.post(
    '/api/crops/:id/activities',
    wrap(async (req, res) => {
      const id = idOf(req.params.id);
      if (!id) return notFound(res, 'Crop not found');
      const { error, value: v } = readActivity(req.body);
      if (error) return bad(res, error);
      const crop = await pool.query('SELECT id FROM crops WHERE id = $1', [id]);
      if (crop.rows.length === 0) return notFound(res, 'Crop not found');

      await ensureActivityType(v.type);
      const { rows } = await pool.query(
        `INSERT INTO activities (crop_id, type, activity_date, description, quantity, unit, cost)
         VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
        [id, v.type, v.activity_date, v.description, v.quantity, v.unit, v.cost]
      );
      recordsCreated.inc({ kind: 'activity' });
      res.status(201).json(mapActivity(rows[0]));
    })
  );

  app.put(
    '/api/activities/:id',
    wrap(async (req, res) => {
      const id = idOf(req.params.id);
      if (!id) return notFound(res, 'Activity not found');
      const { error, value: v } = readActivity(req.body);
      if (error) return bad(res, error);
      await ensureActivityType(v.type);
      const { rows } = await pool.query(
        `UPDATE activities SET type = $1, activity_date = $2, description = $3, quantity = $4, unit = $5, cost = $6
         WHERE id = $7 RETURNING *`,
        [v.type, v.activity_date, v.description, v.quantity, v.unit, v.cost, id]
      );
      if (rows.length === 0) return notFound(res, 'Activity not found');
      res.json(mapActivity(rows[0]));
    })
  );

  app.delete(
    '/api/activities/:id',
    wrap(async (req, res) => {
      const id = idOf(req.params.id);
      if (!id) return notFound(res, 'Activity not found');
      const result = await pool.query('DELETE FROM activities WHERE id = $1 RETURNING id', [id]);
      if (result.rows.length === 0) return notFound(res, 'Activity not found');
      res.status(204).end();
    })
  );

  // ----- sales (income from the harvest) -----
  app.post(
    '/api/crops/:id/sales',
    wrap(async (req, res) => {
      const id = idOf(req.params.id);
      if (!id) return notFound(res, 'Crop not found');
      const { error, value: v } = readSale(req.body);
      if (error) return bad(res, error);
      const crop = await pool.query('SELECT id FROM crops WHERE id = $1', [id]);
      if (crop.rows.length === 0) return notFound(res, 'Crop not found');
      const { rows } = await pool.query(
        `INSERT INTO sales (crop_id, sale_date, quantity, unit, price_per_unit, buyer)
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
        [id, v.sale_date, v.quantity, v.unit, v.price_per_unit, v.buyer]
      );
      recordsCreated.inc({ kind: 'sale' });
      res.status(201).json(mapSale(rows[0]));
    })
  );

  app.delete(
    '/api/sales/:id',
    wrap(async (req, res) => {
      const id = idOf(req.params.id);
      if (!id) return notFound(res, 'Sale not found');
      const result = await pool.query('DELETE FROM sales WHERE id = $1 RETURNING id', [id]);
      if (result.rows.length === 0) return notFound(res, 'Sale not found');
      res.status(204).end();
    })
  );

  // ----- dashboard summary -----
  app.get(
    '/api/summary',
    wrap(async (req, res) => {
      const crops = (await pool.query('SELECT * FROM crops')).rows.map(mapCrop);
      const byType = (
        await pool.query('SELECT type, SUM(cost) AS total, COUNT(*) AS cnt FROM activities GROUP BY type ORDER BY type')
      ).rows.map((r) => ({ type: r.type, total: round2(Number(r.total)), count: Number(r.cnt) }));
      const sales = (await pool.query('SELECT * FROM sales')).rows.map(mapSale);
      const recent = (
        await pool.query(
          `SELECT a.*, c.name AS crop_name FROM activities a
           JOIN crops c ON c.id = a.crop_id
           ORDER BY a.activity_date DESC, a.id DESC LIMIT 5`
        )
      ).rows.map((r) => ({ ...mapActivity(r), crop_name: r.crop_name }));

      const totalCost = byType.reduce((sum, t) => sum + t.total, 0);
      const totalIncome = sales.reduce((sum, s) => sum + s.amount, 0);
      const today = new Date().toISOString().slice(0, 10);

      const upcoming = crops
        .filter((c) => c.status !== 'harvested' && c.expected_harvest_date && c.expected_harvest_date >= today)
        .sort((a, b) => a.expected_harvest_date.localeCompare(b.expected_harvest_date))
        .slice(0, 5)
        .map((c) => ({ id: c.id, name: c.name, expected_harvest_date: c.expected_harvest_date, status: c.status }));

      res.json({
        crops: {
          total: crops.length,
          planned: crops.filter((c) => c.status === 'planned').length,
          growing: crops.filter((c) => c.status === 'growing').length,
          harvested: crops.filter((c) => c.status === 'harvested').length,
        },
        total_area: round2(crops.reduce((sum, c) => sum + (c.area_acres || 0), 0)),
        total_cost: round2(totalCost),
        total_income: round2(totalIncome),
        profit: round2(totalIncome - totalCost),
        cost_by_type: byType,
        upcoming_harvests: upcoming,
        recent_activities: recent,
      });
    })
  );

  // ----- Prometheus scrape endpoint -----
  app.get(
    '/metrics',
    wrap(async (req, res) => {
      res.set('Content-Type', register.contentType);
      res.end(await register.metrics());
    })
  );

  // ----- errors -----
  app.use('/api', (req, res) => notFound(res, 'Unknown API route'));

  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    if (err.type === 'entity.parse.failed') return bad(res, 'Request body is not valid JSON');
    console.error(err);
    res.status(500).json({ error: 'Something went wrong on the server' });
  });

  return app;
}

module.exports = { createApp };
