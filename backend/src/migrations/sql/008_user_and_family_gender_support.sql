ALTER TABLE users
  ADD COLUMN IF NOT EXISTS gender VARCHAR(10);

ALTER TABLE family_members
  ADD COLUMN IF NOT EXISTS gender VARCHAR(10);

UPDATE family_members
SET gender = CASE UPPER(COALESCE(relation_type, ''))
  WHEN 'WIFE' THEN 'FEMALE'
  WHEN 'HUSBAND' THEN 'MALE'
  WHEN 'SON' THEN 'MALE'
  WHEN 'DAUGHTER' THEN 'FEMALE'
  ELSE gender
END
WHERE gender IS NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'chk_users_gender_values'
  ) THEN
    ALTER TABLE users
      ADD CONSTRAINT chk_users_gender_values
      CHECK (gender IS NULL OR gender IN ('MALE', 'FEMALE'));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'chk_family_members_gender_values'
  ) THEN
    ALTER TABLE family_members
      ADD CONSTRAINT chk_family_members_gender_values
      CHECK (gender IS NULL OR gender IN ('MALE', 'FEMALE'));
  END IF;
END $$;
