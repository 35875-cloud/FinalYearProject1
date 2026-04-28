DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM users
    WHERE cnic IS NOT NULL
      AND BTRIM(cnic) <> ''
    GROUP BY cnic
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'Cannot enforce unique CNIC because duplicate CNIC values already exist in users';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM users
    WHERE email IS NOT NULL
      AND BTRIM(email) <> ''
    GROUP BY LOWER(email)
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'Cannot enforce unique email because duplicate email values already exist in users';
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_user_id_unique
  ON users (user_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_cnic_unique
  ON users (cnic)
  WHERE cnic IS NOT NULL
    AND BTRIM(cnic) <> '';

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email_unique
  ON users (LOWER(email))
  WHERE email IS NOT NULL
    AND BTRIM(email) <> '';
