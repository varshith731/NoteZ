-- Fix user_follows table issues

-- First, let's make sure the table exists and has proper constraints
CREATE TABLE IF NOT EXISTS user_follows (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  follower_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  followed_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at timestamp with time zone DEFAULT now(),
  UNIQUE(follower_id, followed_id)
);

-- Since backend uses service role key, we can either:
-- Option 1: Disable RLS (simplest)
ALTER TABLE user_follows DISABLE ROW LEVEL SECURITY;

-- Option 2: Create permissive policies (alternative)
-- DROP POLICY IF EXISTS "Users can follow others" ON user_follows;
-- DROP POLICY IF EXISTS "Users can view their follows" ON user_follows;
-- DROP POLICY IF EXISTS "Users can view their followers" ON user_follows;
-- DROP POLICY IF EXISTS "Users can unfollow creators" ON user_follows;

-- CREATE POLICY "Users can follow others" ON user_follows
--   FOR ALL USING (true)
--   WITH CHECK (true);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_user_follows_follower_id ON user_follows(follower_id);
CREATE INDEX IF NOT EXISTS idx_user_follows_followed_id ON user_follows(followed_id);

