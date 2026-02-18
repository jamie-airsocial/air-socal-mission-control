ALTER TABLE app_users ADD COLUMN IF NOT EXISTS last_active_at timestamptz;

-- Add a policy to allow users to update their own last_active_at
CREATE POLICY IF NOT EXISTS "Users can update own last_active_at" ON app_users
  FOR UPDATE USING (auth_user_id = auth.uid())
  WITH CHECK (auth_user_id = auth.uid());
