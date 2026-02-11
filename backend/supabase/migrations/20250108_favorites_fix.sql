-- Fix favorites system by adding missing columns and functions
-- Run this in your Supabase SQL Editor

-- 1. Add missing columns to existing tables
ALTER TABLE playlists ADD COLUMN IF NOT EXISTS is_favorites BOOLEAN DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS show_activity BOOLEAN DEFAULT true;

-- 2. Create unique index for one favorites playlist per user
CREATE UNIQUE INDEX IF NOT EXISTS playlists_one_favorites_per_user
  ON playlists (creator_id)
  WHERE (is_favorites = true);

-- 3. Create the ensure_favorites_playlist function
CREATE OR REPLACE FUNCTION ensure_favorites_playlist(p_user_id uuid)
RETURNS uuid
LANGUAGE plpgsql
AS $$
DECLARE
  fav_id uuid;
BEGIN
  SELECT id INTO fav_id FROM playlists WHERE creator_id = p_user_id AND is_favorites = true LIMIT 1;
  IF fav_id IS NULL THEN
    INSERT INTO playlists (name, description, creator_id, is_public, is_favorites)
    VALUES ('Favorites', NULL, p_user_id, false, true)
    RETURNING id INTO fav_id;
  END IF;
  RETURN fav_id;
END;
$$;

-- 4. Create function to prevent modification of Favorites playlists
CREATE OR REPLACE FUNCTION prevent_modify_favorites()
RETURNS trigger AS $$
BEGIN
  IF (tg_op = 'UPDATE') THEN
    IF old.is_favorites AND (
         COALESCE(new.name, '') <> COALESCE(old.name, '')
      OR COALESCE(new.is_public, false) <> COALESCE(old.is_public, false)
      OR new.creator_id <> old.creator_id
      OR new.is_favorites <> old.is_favorites
    ) THEN
      RAISE EXCEPTION 'Favorites playlist is immutable';
    END IF;
    RETURN new;
  ELSIF (tg_op = 'DELETE') THEN
    IF old.is_favorites THEN
      RAISE EXCEPTION 'Cannot delete Favorites playlist';
    END IF;
    RETURN old;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- 5. Create triggers to prevent modification of Favorites playlists
DROP TRIGGER IF EXISTS trg_prevent_modify_favorites_update ON playlists;
CREATE TRIGGER trg_prevent_modify_favorites_update
  BEFORE UPDATE ON playlists
  FOR EACH ROW EXECUTE FUNCTION prevent_modify_favorites();

DROP TRIGGER IF EXISTS trg_prevent_modify_favorites_delete ON playlists;
CREATE TRIGGER trg_prevent_modify_favorites_delete
  BEFORE DELETE ON playlists
  FOR EACH ROW EXECUTE FUNCTION prevent_modify_favorites();

-- 6. Add RLS policies for Favorites playlists
DROP POLICY IF EXISTS "Users can view their Favorites playlist" ON playlists;
CREATE POLICY "Users can view their Favorites playlist" ON playlists
  FOR SELECT USING (auth.uid() = creator_id AND is_favorites = true);

DROP POLICY IF EXISTS "Users can manage Favorites playlist songs" ON playlist_songs;
CREATE POLICY "Users can manage Favorites playlist songs" ON playlist_songs
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM playlists 
      WHERE playlists.id = playlist_songs.playlist_id 
      AND playlists.creator_id = auth.uid() 
      AND playlists.is_favorites = true
    )
  );

-- 7. Migrate existing user_favorites data to Favorites playlists
DO $$
DECLARE
  r record;
  fav_id uuid;
  pos integer;
BEGIN
  -- Only run if user_favorites table exists
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'user_favorites') THEN
    FOR r IN (
      SELECT uf.user_id, uf.song_id, uf.created_at
      FROM user_favorites uf
      ORDER BY uf.user_id, uf.created_at
    ) LOOP
      -- Get or create favorites playlist for this user
      fav_id := ensure_favorites_playlist(r.user_id);
      
      -- Get next position
      SELECT COALESCE(MAX(position), 0) INTO pos FROM playlist_songs WHERE playlist_id = fav_id;
      
      -- Insert into favorites playlist
      INSERT INTO playlist_songs (playlist_id, song_id, position)
      VALUES (fav_id, r.song_id, pos + 1)
      ON CONFLICT (playlist_id, song_id) DO NOTHING;
    END LOOP;
    
    RAISE NOTICE 'Migrated % favorites entries to Favorites playlists', (SELECT COUNT(*) FROM user_favorites);
  END IF;
END $$;

-- 8. Test the function
SELECT ensure_favorites_playlist('00000000-0000-0000-0000-000000000000'::uuid) as test_result;
