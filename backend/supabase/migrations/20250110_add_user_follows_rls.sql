-- Add RLS policies for user_follows table

-- Enable RLS on user_follows (if not already enabled)
ALTER TABLE user_follows ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can follow others" ON user_follows;
DROP POLICY IF EXISTS "Users can view their follows" ON user_follows;
DROP POLICY IF EXISTS "Users can view their followers" ON user_follows;
DROP POLICY IF EXISTS "Users can unfollow creators" ON user_follows;

-- Allow users to insert follow relationships
CREATE POLICY "Users can follow others" ON user_follows
  FOR INSERT WITH CHECK (auth.uid() = follower_id);

-- Allow users to view who they're following
CREATE POLICY "Users can view their follows" ON user_follows
  FOR SELECT USING (auth.uid() = follower_id);

-- Allow users to view who follows them
CREATE POLICY "Users can view their followers" ON user_follows
  FOR SELECT USING (auth.uid() = followed_id);

-- Allow users to unfollow (delete their own follow relationships)
CREATE POLICY "Users can unfollow creators" ON user_follows
  FOR DELETE USING (auth.uid() = follower_id);

