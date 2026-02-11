-- Add test albums for Devi Sri Prasad
DO $$ 
DECLARE
  creator_id UUID;
BEGIN
  -- Find Devi Sri Prasad's user ID
  SELECT id INTO creator_id 
  FROM users 
  WHERE username ILIKE 'devi_sri_prasad%' OR full_name ILIKE '%Devi Sri Prasad%'
  LIMIT 1;

  IF creator_id IS NOT NULL THEN
    -- Create Pushpa album
    INSERT INTO albums (title, description, creator_id, is_public)
    VALUES (
      'Pushpa',
      'Music album for the blockbuster movie Pushpa: The Rise',
      creator_id,
      true
    );

    -- Create Pushpa 2 album
    INSERT INTO albums (title, description, creator_id, is_public)
    VALUES (
      'Pushpa 2',
      'Music album for Pushpa: The Rule',
      creator_id,
      true
    );
  END IF;
END $$;