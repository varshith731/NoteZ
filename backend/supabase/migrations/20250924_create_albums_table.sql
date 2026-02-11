-- Create albums table for Supabase

-- Albums table
CREATE TABLE albums (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title VARCHAR(255) NOT NULL,
  description TEXT,
  creator_id UUID REFERENCES users(id) ON DELETE CASCADE,
  cover_url TEXT,
  release_date DATE,
  is_public BOOLEAN DEFAULT true,
  total_songs INTEGER DEFAULT 0,
  total_listens INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Album songs junction table
CREATE TABLE album_songs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  album_id UUID REFERENCES albums(id) ON DELETE CASCADE,
  song_id UUID REFERENCES songs(id) ON DELETE CASCADE,
  position INTEGER NOT NULL,
  added_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(album_id, song_id)
);

-- Indexes for better performance
CREATE INDEX idx_albums_creator_id ON albums(creator_id);
CREATE INDEX idx_albums_release_date ON albums(release_date);
CREATE INDEX idx_album_songs_album_id ON album_songs(album_id);
CREATE INDEX idx_album_songs_song_id ON album_songs(song_id);

-- Function to update album song count
CREATE OR REPLACE FUNCTION update_album_song_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE albums 
    SET total_songs = total_songs + 1,
        updated_at = NOW()
    WHERE id = NEW.album_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE albums 
    SET total_songs = total_songs - 1,
        updated_at = NOW()
    WHERE id = OLD.album_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Trigger to maintain song count
CREATE TRIGGER album_song_count_trigger
AFTER INSERT OR DELETE ON album_songs
FOR EACH ROW
EXECUTE FUNCTION update_album_song_count();