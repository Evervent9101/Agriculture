const fs = require('fs');
const path = require('path');
const { Pool, types } = require('pg');

// Return DATE columns as plain 'YYYY-MM-DD' strings (no timezone shifting)
// and NUMERIC / COUNT values as JavaScript numbers.
types.setTypeParser(1082, (v) => v);
types.setTypeParser(1700, (v) => parseFloat(v));
types.setTypeParser(20, (v) => parseInt(v, 10));

// Starter list of farm activities. Farmers can add their own from the app.
const DEFAULT_ACTIVITY_TYPES = [
  'Land preparation',
  'Sowing',
  'Irrigation',
  'Fertilizer',
  'Pesticide',
  'Weeding',
  'Harvesting',
  'Other',
];

function createPool() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error('DATABASE_URL is not set (see README: setup-database.sh)');
  }
  return new Pool({ connectionString: url, max: 10 });
}

// Databases created before logins existed have no crops.user_id yet. New ones already do.
async function addUserColumn(client) {
  try {
    await client.query('SELECT user_id FROM crops LIMIT 0');
  } catch (_) {
    await client.query('ALTER TABLE crops ADD COLUMN user_id INTEGER REFERENCES users(id) ON DELETE CASCADE');
  }
  await client.query('CREATE INDEX IF NOT EXISTS idx_crops_user ON crops(user_id)');
}

// Creates the tables if they do not exist yet. Safe to run on every start.
// An advisory lock makes the two PM2 instances take turns instead of racing.
async function migrate(pool, { lock = true } = {}) {
  const client = await pool.connect();
  try {
    if (lock) await client.query('SELECT pg_advisory_lock(727274)');

    const sql = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
    const statements = sql
      .split(';')
      .map((s) => s.trim())
      .filter(Boolean);
    for (const statement of statements) {
      await client.query(statement);
    }

    await addUserColumn(client);

    const { rows } = await client.query('SELECT COUNT(*) AS n FROM activity_types');
    if (Number(rows[0].n) === 0) {
      for (const name of DEFAULT_ACTIVITY_TYPES) {
        await client.query('INSERT INTO activity_types (name) VALUES ($1)', [name]);
      }
    }
  } finally {
    if (lock) {
      try {
        await client.query('SELECT pg_advisory_unlock(727274)');
      } catch (_) {
        /* connection is being released anyway */
      }
    }
    client.release();
  }
}

module.exports = { createPool, migrate, DEFAULT_ACTIVITY_TYPES };
