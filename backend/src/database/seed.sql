-- seed.sql — LEGACY PostgreSQL seed (project now uses MongoDB)
-- Use instead: npm run seed  (runs src/database/seed.js)
-- Run after 001_create_tables.sql:
--   psql -U postgres -d deliverypulse -f src/database/seed.sql

INSERT INTO organisations (id, name, industry, team_size)
VALUES (
  '00000000-0000-0000-0000-000000000010',
  'DeliveryPulse Demo',
  'Technology',
  25
)
ON CONFLICT DO NOTHING;

-- bcrypt hash for "password123"
INSERT INTO users (id, org_id, name, email, password, role)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000010',
  'Dev Admin',
  'admin@deliverypulse.com',
  '$2b$10$T57LhdzZx6hfGIIZzrutvOoGhnksBqmsWlUvqUJs2..ZEfltMnq1m',
  'admin'
)
ON CONFLICT (email) DO NOTHING;
