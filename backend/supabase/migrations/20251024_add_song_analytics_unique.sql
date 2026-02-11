-- Migration: Add unique constraint/index on song_analytics (song_id, listener_id)
-- Date: 2025-10-24
-- This migration will:
-- 1. Remove duplicate song_analytics rows (keep the latest by last_played or lowest id)
-- 2. Create a unique index on (song_id, listener_id) to support ON CONFLICT in triggers

-- 1. Remove duplicates if any (keep the one with greatest last_played, fallback to MIN(id))
WITH ranked AS (
  SELECT
    id,
    song_id,
    listener_id,
    ROW_NUMBER() OVER (PARTITION BY song_id, listener_id ORDER BY COALESCE(last_played, now()) DESC, id ASC) as rn
  FROM song_analytics
)
DELETE FROM song_analytics s
USING ranked r
WHERE s.id = r.id AND r.rn > 1;

-- 2. Create unique index
CREATE UNIQUE INDEX IF NOT EXISTS idx_song_analytics_song_listener_unique
  ON song_analytics (song_id, listener_id);

-- Optional: verify
SELECT count(*) as total_rows FROM song_analytics;
SELECT count(*) as unique_pairs FROM (SELECT song_id, listener_id FROM song_analytics GROUP BY song_id, listener_id) t;
