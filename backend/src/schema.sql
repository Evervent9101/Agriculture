CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  full_name TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS crops (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  variety TEXT,
  field_name TEXT,
  area_acres NUMERIC(10,2),
  season TEXT,
  sowing_date DATE,
  expected_harvest_date DATE,
  status TEXT NOT NULL DEFAULT 'planned',
  notes TEXT,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS crop_details (
  id SERIAL PRIMARY KEY,
  crop_id INTEGER NOT NULL REFERENCES crops(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS activity_types (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS activities (
  id SERIAL PRIMARY KEY,
  crop_id INTEGER NOT NULL REFERENCES crops(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  activity_date DATE NOT NULL,
  description TEXT,
  quantity NUMERIC(12,2),
  unit TEXT,
  cost NUMERIC(12,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS sales (
  id SERIAL PRIMARY KEY,
  crop_id INTEGER NOT NULL REFERENCES crops(id) ON DELETE CASCADE,
  sale_date DATE NOT NULL,
  quantity NUMERIC(12,2) NOT NULL,
  unit TEXT NOT NULL DEFAULT 'kg',
  price_per_unit NUMERIC(12,2) NOT NULL,
  buyer TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_details_crop ON crop_details(crop_id);

CREATE INDEX IF NOT EXISTS idx_activities_crop ON activities(crop_id);

CREATE INDEX IF NOT EXISTS idx_sales_crop ON sales(crop_id);
