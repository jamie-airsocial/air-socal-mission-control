-- Migration: Add last_active_at column to app_users
-- Run this in the Supabase SQL Editor at:
-- https://supabase.com/dashboard/project/vnexjslcyvsjqllttwpi/editor

ALTER TABLE public.app_users
  ADD COLUMN IF NOT EXISTS last_active_at timestamptz;

-- Index for performance (sorting active users)
CREATE INDEX IF NOT EXISTS idx_app_users_last_active_at
  ON public.app_users (last_active_at DESC NULLS LAST);
