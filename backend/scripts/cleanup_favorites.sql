-- Cleanup script to merge multiple favorites playlists into a single one per user
-- Run this script to fix any existing multiple favorites playlists

-- Step 1: Identify users with multiple favorites playlists
WITH multiple_favorites AS (
  SELECT creator_id, COUNT(*) as favorites_count
  FROM playlists 
  WHERE is_favorites = true OR name ILIKE '%favorites%'
  GROUP BY creator_id 
  HAVING COUNT(*) > 1
)
SELECT 
  mf.creator_id,
  mf.favorites_count,
  string_agg(p.id::text || ' (' || p.name || ')', ', ' ORDER BY p.created_at) as playlist_details
FROM multiple_favorites mf
JOIN playlists p ON p.creator_id = mf.creator_id 
WHERE p.is_favorites = true OR p.name ILIKE '%favorites%'
GROUP BY mf.creator_id, mf.favorites_count;

-- Step 2: For each user with multiple favorites, merge them into one
-- This function will:
-- 1. Find the oldest favorites playlist for each user
-- 2. Move all songs from other favorites playlists to the oldest one
-- 3. Delete the duplicate favorites playlists
-- 4. Ensure the remaining one has is_favorites = true

DO $$
DECLARE
  user_record RECORD;
  oldest_playlist_id UUID;
  duplicate_playlist RECORD;
  max_position INTEGER;
BEGIN
  -- Loop through each user with multiple favorites playlists
  FOR user_record IN (
    SELECT creator_id
    FROM playlists 
    WHERE is_favorites = true OR name ILIKE '%favorites%'
    GROUP BY creator_id 
    HAVING COUNT(*) > 1
  ) LOOP
    
    -- Find the oldest favorites playlist for this user
    SELECT id INTO oldest_playlist_id
    FROM playlists 
    WHERE creator_id = user_record.creator_id 
      AND (is_favorites = true OR name ILIKE '%favorites%')
    ORDER BY created_at ASC
    LIMIT 1;
    
    -- Get the current max position in the oldest playlist
    SELECT COALESCE(MAX(position), 0) INTO max_position
    FROM playlist_songs
    WHERE playlist_id = oldest_playlist_id;
    
    -- Process each duplicate playlist
    FOR duplicate_playlist IN (
      SELECT id, name
      FROM playlists 
      WHERE creator_id = user_record.creator_id 
        AND (is_favorites = true OR name ILIKE '%favorites%')
        AND id != oldest_playlist_id
    ) LOOP
      
      -- Move songs from duplicate to oldest playlist
      WITH moved_songs AS (
        SELECT song_id, ROW_NUMBER() OVER (ORDER BY position, created_at) as rn
        FROM playlist_songs
        WHERE playlist_id = duplicate_playlist.id
      )
      INSERT INTO playlist_songs (playlist_id, song_id, position)
      SELECT oldest_playlist_id, song_id, max_position + rn
      FROM moved_songs
      ON CONFLICT (playlist_id, song_id) DO NOTHING; -- Skip duplicates
      
      -- Update max position counter
      SELECT COALESCE(MAX(position), max_position) INTO max_position
      FROM playlist_songs
      WHERE playlist_id = oldest_playlist_id;
      
      -- Delete the duplicate playlist (cascade will handle playlist_songs)
      DELETE FROM playlists WHERE id = duplicate_playlist.id;
      
      RAISE NOTICE 'Merged playlist % into oldest favorites playlist %', 
        duplicate_playlist.id, oldest_playlist_id;
      
    END LOOP;
    
    -- Ensure the remaining playlist is properly marked as favorites
    UPDATE playlists 
    SET 
      name = 'Favorites',
      is_favorites = true,
      is_public = false
    WHERE id = oldest_playlist_id;
    
    RAISE NOTICE 'Completed cleanup for user %. Kept playlist %', 
      user_record.creator_id, oldest_playlist_id;
      
  END LOOP;
END $$;

-- Step 3: Verify cleanup - this should return no rows if successful
SELECT creator_id, COUNT(*) as favorites_count
FROM playlists 
WHERE is_favorites = true
GROUP BY creator_id 
HAVING COUNT(*) > 1;

-- Step 4: Create favorites playlists for users who don't have any
-- This ensures every user has exactly one favorites playlist
INSERT INTO playlists (name, description, creator_id, is_public, is_favorites)
SELECT 'Favorites', 'Your liked songs', u.id, false, true
FROM auth.users u
WHERE NOT EXISTS (
  SELECT 1 FROM playlists p 
  WHERE p.creator_id = u.id AND p.is_favorites = true
)
ON CONFLICT DO NOTHING;

RAISE NOTICE 'Favorites playlist cleanup completed successfully!';
