-- Friend System Option A: derive friendships from friend_requests
-- 1) Drop trigger-based population of user_friends
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trigger_handle_friend_request_accept'
  ) THEN
    DROP TRIGGER trigger_handle_friend_request_accept ON friend_requests;
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_proc WHERE proname = 'handle_friend_request_accept'
  ) THEN
    DROP FUNCTION handle_friend_request_accept();
  END IF;
END $$;

-- 2) Create a derived view for friendships
CREATE OR REPLACE VIEW friends_view AS
SELECT
  fr.id AS request_id,
  fr.created_at,
  fr.updated_at,
  fr.sender_id AS user_a,
  fr.receiver_id AS user_b
FROM friend_requests fr
WHERE fr.status = 'accepted';

-- 3) Relax friend_requests SELECT policy so users can see their own sent/received
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Users can view received friend requests' AND tablename = 'friend_requests'
  ) THEN
    -- Keep existing; add an additional policy for sent/accepted visibility
    NULL;
  END IF;
END $$;

CREATE POLICY IF NOT EXISTS "Users can view own friend requests (sent or received)" ON friend_requests
  FOR SELECT USING (auth.uid() = sender_id OR auth.uid() = receiver_id);

-- 4) Optional: keep user_friends table but mark deprecated (no-op here)


