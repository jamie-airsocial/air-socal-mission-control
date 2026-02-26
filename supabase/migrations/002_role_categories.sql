-- Add category column to roles table
ALTER TABLE roles ADD COLUMN IF NOT EXISTS category text;

-- Set categories for existing roles
UPDATE roles SET category = 'delivery' WHERE name IN ('Account Manager', 'Paid Ads Manager', 'Social Media Manager');
UPDATE roles SET category = 'admin' WHERE name = 'Admin';
UPDATE roles SET category = 'sales' WHERE name = 'Sales';

-- Insert new roles
INSERT INTO roles (id, name, permissions, category) VALUES 
  ('00000000-0000-0000-0000-000000000006', 'Creative', '{"tasks":true,"clients":true,"pipeline":false,"teams":true,"xero":false,"settings":false}', 'delivery'),
  ('00000000-0000-0000-0000-000000000007', 'SEO', '{"tasks":true,"clients":true,"pipeline":false,"teams":true,"xero":false,"settings":false}', 'delivery'),
  ('00000000-0000-0000-0000-000000000008', 'Management', '{"tasks":true,"clients":true,"pipeline":true,"teams":true,"xero":true,"settings":true}', 'management')
ON CONFLICT (id) DO NOTHING;
