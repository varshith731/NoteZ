-- Create a function to safely create a user if they don't exist
CREATE OR REPLACE FUNCTION create_user_if_not_exists(
  user_id uuid,
  user_email text,
  user_name text,
  user_full_name text,
  user_avatar_url text
) RETURNS users AS $$
DECLARE
  v_user users;
BEGIN
  -- First try to insert the user
  INSERT INTO users (id, email, username, full_name, avatar_url)
  VALUES (user_id, user_email, user_name, user_full_name, user_avatar_url)
  ON CONFLICT (id) DO UPDATE
  SET
    email = EXCLUDED.email,
    full_name = EXCLUDED.full_name,
    avatar_url = EXCLUDED.avatar_url,
    updated_at = NOW()
  RETURNING * INTO v_user;

  RETURN v_user;
END;
$$ LANGUAGE plpgsql;
