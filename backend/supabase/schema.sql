-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create enum for user roles
CREATE TYPE user_role AS ENUM ('normal_user', 'content_creator');

-- Create enum for user gender
CREATE TYPE user_gender AS ENUM ('male', 'female', 'other', 'prefer_not_to_say');

-- Create enum for song categories
CREATE TYPE song_category AS ENUM (
  'happy', 'sad', 'angry', 'energetic', 'calm', 
  'romantic', 'motivational', 'chill', 'party', 'workout',
  'study', 'sleep', 'travel', 'nostalgic', 'inspirational'
);

-- Create enum for notification types
CREATE TYPE notification_type AS ENUM ('friend_request', 'new_song', 'follow', 'like', 'playlist_share');

-- Create enum for friend request status
CREATE TYPE friend_request_status AS ENUM ('pending', 'accepted', 'rejected');

-- Users table
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email VARCHAR(255) UNIQUE NOT NULL,
  username VARCHAR(100) UNIQUE NOT NULL,
  full_name VARCHAR(255),
  avatar_url TEXT,
  role user_role DEFAULT 'normal_user',
  bio TEXT,
  gender user_gender,
  show_activity BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Song categories table
CREATE TABLE song_categories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name song_category UNIQUE NOT NULL,
  description TEXT,
  color VARCHAR(7) DEFAULT '#6366f1',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Songs table
CREATE TABLE songs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title VARCHAR(255) NOT NULL,
  artist VARCHAR(255) NOT NULL,
  movie VARCHAR(255), 
  category_id UUID REFERENCES song_categories(id),
  creator_id UUID REFERENCES users(id) ON DELETE CASCADE,
  audio_url TEXT NOT NULL,
  cover_url TEXT,
  lyrics TEXT,
  duration INTEGER, -- in seconds
  is_public BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  language VARCHAR(50)
);

-- User song frequency tracking (tracks how many times a user has played a song)
CREATE TABLE user_song_frequency (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  song_id UUID REFERENCES songs(id) ON DELETE CASCADE,
  freq INTEGER DEFAULT 1, -- frequency count
  first_played TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_played TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, song_id)
);

-- Song analytics table
CREATE TABLE song_analytics (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  song_id UUID REFERENCES songs(id) ON DELETE CASCADE,
  listener_id UUID REFERENCES users(id) ON DELETE SET NULL,
  play_count INTEGER DEFAULT 1,
  listen_duration INTEGER DEFAULT 0, -- in seconds
  last_played TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- User playlists table
CREATE TABLE playlists (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  creator_id UUID REFERENCES users(id) ON DELETE CASCADE,
  is_public BOOLEAN DEFAULT true,
  is_favorites BOOLEAN DEFAULT false,
  cover_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Playlist songs junction table
CREATE TABLE playlist_songs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  playlist_id UUID REFERENCES playlists(id) ON DELETE CASCADE,
  song_id UUID REFERENCES songs(id) ON DELETE CASCADE,
  position INTEGER NOT NULL,
  added_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(playlist_id, song_id)
);

-- User favorites table
CREATE TABLE user_favorites (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  song_id UUID REFERENCES songs(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, song_id)
);

-- User listening history table
CREATE TABLE listening_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  song_id UUID REFERENCES songs(id) ON DELETE CASCADE,
  listened_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  listen_duration INTEGER DEFAULT 0 -- in seconds
);

-- Content creator stats table
CREATE TABLE creator_stats (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  creator_id UUID REFERENCES users(id) ON DELETE CASCADE,
  total_songs INTEGER DEFAULT 0,
  total_listens INTEGER DEFAULT 0,
  total_favorites INTEGER DEFAULT 0,
  monthly_listeners INTEGER DEFAULT 0,
  last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Friend system tables
CREATE TABLE friend_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sender_id UUID REFERENCES users(id) ON DELETE CASCADE,
  receiver_id UUID REFERENCES users(id) ON DELETE CASCADE,
  status friend_request_status DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(sender_id, receiver_id)
);

CREATE TABLE user_friends (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  friend_id UUID REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, friend_id)
);

-- Content creator following system
CREATE TABLE creator_follows (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  follower_id UUID REFERENCES users(id) ON DELETE CASCADE,
  creator_id UUID REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(follower_id, creator_id)
);

-- Notifications table
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  type notification_type NOT NULL,
  title VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  related_id UUID, -- ID of related item (song, user, etc.)
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert default song categories
INSERT INTO song_categories (name, description, color) VALUES
  ('happy', 'Upbeat and joyful music', '#10b981'),
  ('sad', 'Melancholic and emotional music', '#3b82f6'),
  ('angry', 'Intense and powerful music', '#ef4444'),
  ('energetic', 'High-energy and dynamic music', '#f59e0b'),
  ('calm', 'Peaceful and relaxing music', '#8b5cf6'),
  ('romantic', 'Love and relationship music', '#ec4899'),
  ('motivational', 'Inspiring and uplifting music', '#06b6d4'),
  ('chill', 'Laid-back and easy-going music', '#84cc16'),
  ('party', 'Celebration and dance music', '#f97316'),
  ('workout', 'Exercise and fitness music', '#dc2626'),
  ('study', 'Focus and concentration music', '#7c3aed'),
  ('sleep', 'Lullaby and bedtime music', '#1e40af'),
  ('travel', 'Adventure and journey music', '#059669'),
  ('nostalgic', 'Memory and reflection music', '#9333ea'),
  ('inspirational', 'Creative and artistic music', '#0891b2');

-- Create indexes for better performance
CREATE INDEX idx_songs_creator_id ON songs(creator_id);
CREATE INDEX idx_songs_category_id ON songs(category_id);
CREATE INDEX idx_songs_created_at ON songs(created_at);
CREATE INDEX idx_user_song_frequency_user_id ON user_song_frequency(user_id);
CREATE INDEX idx_user_song_frequency_song_id ON user_song_frequency(song_id);
CREATE INDEX idx_song_analytics_song_id ON song_analytics(song_id);
CREATE INDEX idx_song_analytics_listener_id ON song_analytics(listener_id);
CREATE INDEX idx_playlist_songs_playlist_id ON playlist_songs(playlist_id);
CREATE INDEX idx_user_favorites_user_id ON user_favorites(user_id);
CREATE INDEX idx_listening_history_user_id ON listening_history(user_id);
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_friend_requests_sender_id ON friend_requests(sender_id);
CREATE INDEX idx_friend_requests_receiver_id ON friend_requests(receiver_id);
CREATE INDEX idx_user_friends_user_id ON user_friends(user_id);
CREATE INDEX idx_creator_follows_follower_id ON creator_follows(follower_id);
CREATE INDEX idx_creator_follows_creator_id ON creator_follows(creator_id);
CREATE INDEX idx_notifications_user_id ON notifications(user_id);
CREATE INDEX idx_notifications_is_read ON notifications(is_read);

-- Create function to update creator stats
CREATE OR REPLACE FUNCTION update_creator_stats()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO creator_stats (creator_id, total_songs, total_listens, total_favorites)
    VALUES (NEW.creator_id, 1, 0, 0)
    ON CONFLICT (creator_id) DO UPDATE SET
      total_songs = creator_stats.total_songs + 1;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE creator_stats 
    SET total_songs = total_songs - 1 
    WHERE creator_id = OLD.creator_id;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Create trigger for creator stats
CREATE TRIGGER trigger_update_creator_stats
  AFTER INSERT OR DELETE ON songs
  FOR EACH ROW EXECUTE FUNCTION update_creator_stats();

-- Create function to update song analytics
CREATE OR REPLACE FUNCTION update_song_analytics()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO song_analytics (song_id, listener_id, play_count)
    VALUES (NEW.song_id, NEW.user_id, 1)
    ON CONFLICT (song_id, listener_id) DO UPDATE SET
      play_count = song_analytics.play_count + 1,
      last_played = NOW();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for song analytics
CREATE TRIGGER trigger_update_song_analytics
  AFTER INSERT ON listening_history
  FOR EACH ROW EXECUTE FUNCTION update_song_analytics();

-- Create function to track user song frequency
CREATE OR REPLACE FUNCTION track_user_song_frequency()
RETURNS TRIGGER AS $$
BEGIN
  -- Insert or update frequency tracking
  INSERT INTO user_song_frequency (user_id, song_id, freq, last_played)
  VALUES (NEW.user_id, NEW.song_id, 1, NOW())
  ON CONFLICT (user_id, song_id) DO UPDATE SET
    freq = user_song_frequency.freq + 1,
    last_played = NOW();
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for user song frequency
CREATE TRIGGER trigger_track_user_song_frequency
  AFTER INSERT ON listening_history
  FOR EACH ROW EXECUTE FUNCTION track_user_song_frequency();

-- Create function to handle friend request acceptance
CREATE OR REPLACE FUNCTION handle_friend_request_accept()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'accepted' AND OLD.status = 'pending' THEN
    -- Add both users to each other's friend list
    INSERT INTO user_friends (user_id, friend_id) VALUES
      (NEW.sender_id, NEW.receiver_id),
      (NEW.receiver_id, NEW.sender_id)
    ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for friend request acceptance
CREATE TRIGGER trigger_handle_friend_request_accept
  AFTER UPDATE ON friend_requests
  FOR EACH ROW EXECUTE FUNCTION handle_friend_request_accept();

-- Create function to notify followers when creator uploads new song
CREATE OR REPLACE FUNCTION notify_followers_new_song()
RETURNS TRIGGER AS $$
BEGIN
  -- Insert notifications for all followers
  INSERT INTO notifications (user_id, type, title, message, related_id)
  SELECT 
    cf.follower_id,
    'new_song'::notification_type,
    'New Song Uploaded',
    'A creator you follow has uploaded a new song: ' || NEW.title,
    NEW.id
  FROM creator_follows cf
  WHERE cf.creator_id = NEW.creator_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for new song notifications
CREATE TRIGGER trigger_notify_followers_new_song
  AFTER INSERT ON songs
  FOR EACH ROW EXECUTE FUNCTION notify_followers_new_song();

-- Row Level Security (RLS) policies
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE songs ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_song_frequency ENABLE ROW LEVEL SECURITY;
ALTER TABLE song_analytics ENABLE ROW LEVEL SECURITY;
ALTER TABLE playlists ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_favorites ENABLE ROW LEVEL SECURITY;
ALTER TABLE listening_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE creator_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE friend_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_friends ENABLE ROW LEVEL SECURITY;
ALTER TABLE creator_follows ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Users can view their own profile and public profiles
CREATE POLICY "Users can view own profile" ON users
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can view public profiles" ON users
  FOR SELECT USING (true);

-- Users can update their own profile
CREATE POLICY "Users can update own profile" ON users
  FOR UPDATE USING (auth.uid() = id);

-- Songs are public for viewing
CREATE POLICY "Songs are viewable by everyone" ON songs
  FOR SELECT USING (true);

-- Only creators can insert/update their own songs
CREATE POLICY "Creators can manage own songs" ON songs
  FOR ALL USING (auth.uid() = creator_id);

-- Public songs can be viewed by everyone
CREATE POLICY "Public songs are accessible" ON songs
  FOR SELECT USING (is_public = true);

-- Users can view their own song frequency
CREATE POLICY "Users can view own song frequency" ON user_song_frequency
  FOR SELECT USING (auth.uid() = user_id);

-- Users can view their own analytics
CREATE POLICY "Users can view own analytics" ON song_analytics
  FOR SELECT USING (auth.uid() = listener_id);

-- Creators can view analytics for their songs
CREATE POLICY "Creators can view song analytics" ON song_analytics
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM songs 
      WHERE songs.id = song_analytics.song_id 
      AND songs.creator_id = auth.uid()
    )
  );

-- Users can manage their own playlists
CREATE POLICY "Users can manage own playlists" ON playlists
  FOR ALL USING (auth.uid() = creator_id);

-- Public playlists are viewable by everyone
CREATE POLICY "Public playlists are viewable" ON playlists
  FOR SELECT USING (is_public = true);

-- Users can manage their own favorites
CREATE POLICY "Users can manage own favorites" ON user_favorites
  FOR ALL USING (auth.uid() = user_id);

-- Users can view their own listening history
CREATE POLICY "Users can view own history" ON listening_history
  FOR ALL USING (auth.uid() = user_id);

-- Creators can view their own stats
CREATE POLICY "Creators can view own stats" ON creator_stats
  FOR SELECT USING (auth.uid() = creator_id);

-- Friend request policies
CREATE POLICY "Users can send friend requests" ON friend_requests
  FOR INSERT WITH CHECK (auth.uid() = sender_id);

CREATE POLICY "Users can view received friend requests" ON friend_requests
  FOR SELECT USING (auth.uid() = receiver_id);

CREATE POLICY "Users can update received friend requests" ON friend_requests
  FOR UPDATE USING (auth.uid() = receiver_id);

-- User friends policies
CREATE POLICY "Users can view their friends" ON user_friends
  FOR SELECT USING (auth.uid() = user_id);

-- Creator follows policies
CREATE POLICY "Users can follow creators" ON creator_follows
  FOR INSERT WITH CHECK (auth.uid() = follower_id);

CREATE POLICY "Users can view their follows" ON creator_follows
  FOR SELECT USING (auth.uid() = follower_id);

CREATE POLICY "Users can unfollow creators" ON creator_follows
  FOR DELETE USING (auth.uid() = follower_id);

-- Notifications policies
CREATE POLICY "Users can view their notifications" ON notifications
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can mark notifications as read" ON notifications
  FOR UPDATE USING (auth.uid() = user_id);

-- Favorites playlist system
-- Ensure each user has at most one Favorites playlist
CREATE UNIQUE INDEX playlists_one_favorites_per_user
  ON playlists (creator_id)
  WHERE (is_favorites = true);

-- RPC to ensure favorites playlist exists and return its id
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

-- Function to prevent modification of Favorites playlists
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

-- Triggers to prevent modification of Favorites playlists
CREATE TRIGGER trg_prevent_modify_favorites_update
  BEFORE UPDATE ON playlists
  FOR EACH ROW EXECUTE FUNCTION prevent_modify_favorites();

CREATE TRIGGER trg_prevent_modify_favorites_delete
  BEFORE DELETE ON playlists
  FOR EACH ROW EXECUTE FUNCTION prevent_modify_favorites();

-- RLS policies for Favorites playlists
CREATE POLICY "Users can view their Favorites playlist" ON playlists
  FOR SELECT USING (auth.uid() = creator_id AND is_favorites = true);

CREATE POLICY "Users can manage Favorites playlist songs" ON playlist_songs
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM playlists 
      WHERE playlists.id = playlist_songs.playlist_id 
      AND playlists.creator_id = auth.uid() 
      AND playlists.is_favorites = true
    )
  );



