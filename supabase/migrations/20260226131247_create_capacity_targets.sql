-- Create capacity_targets table for storing billing targets per service
CREATE TABLE IF NOT EXISTS capacity_targets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service TEXT UNIQUE NOT NULL,
  monthly_target NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default targets
INSERT INTO capacity_targets (service, monthly_target)
VALUES
  ('paid-advertising', 15000),
  ('seo', 10000),
  ('social-media', 12000),
  ('creative', 5000),
  ('__team_total__', 45000)
ON CONFLICT (service) DO NOTHING;

-- Enable RLS
ALTER TABLE capacity_targets ENABLE ROW LEVEL SECURITY;

-- Policy: anyone can read capacity targets
CREATE POLICY "Anyone can read capacity targets" ON capacity_targets
  FOR SELECT USING (true);

-- Policy: service role can modify capacity targets
CREATE POLICY "Service role can modify capacity targets" ON capacity_targets
  FOR ALL USING (auth.role() = 'service_role' OR auth.jwt()->>'role' = 'service_role');
