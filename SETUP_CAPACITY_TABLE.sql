-- ================================================================
-- CAPACITY TARGETS TABLE SETUP
-- ================================================================
-- Run this SQL in Supabase Studio SQL Editor before using the
-- capacity features (Delivery page & Admin capacity settings)
-- ================================================================

-- Create the capacity_targets table
CREATE TABLE IF NOT EXISTS capacity_targets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service TEXT UNIQUE NOT NULL,
  monthly_target NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default capacity targets
INSERT INTO capacity_targets (service, monthly_target)
VALUES
  ('paid-advertising', 15000),
  ('seo', 10000),
  ('social-media', 12000),
  ('creative', 5000),
  ('__team_total__', 45000)
ON CONFLICT (service) DO NOTHING;

-- Enable Row Level Security
ALTER TABLE capacity_targets ENABLE ROW LEVEL SECURITY;

-- Policy: Anyone can read capacity targets
DROP POLICY IF EXISTS "Anyone can read capacity targets" ON capacity_targets;
CREATE POLICY "Anyone can read capacity targets" ON capacity_targets
  FOR SELECT USING (true);

-- Policy: Service role can modify capacity targets
DROP POLICY IF EXISTS "Service role can modify" ON capacity_targets;
CREATE POLICY "Service role can modify" ON capacity_targets
  FOR ALL USING (true);

-- ================================================================
-- VERIFICATION
-- ================================================================
-- Run this to verify the setup:
-- SELECT * FROM capacity_targets ORDER BY service;
-- ================================================================
