-- Migration: Optimize recent activity query for user profiles
-- Date: 2025-10-30

-- Add a composite index for (user_id, listened_at DESC) on listening_history for fast recent activity fetch
CREATE INDEX IF NOT EXISTS idx_listening_history_user_id_listened_at_desc 
  ON listening_history (user_id, listened_at DESC);
