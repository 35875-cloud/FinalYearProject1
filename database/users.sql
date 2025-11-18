CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY,
  user_id VARCHAR(20) UNIQUE NOT NULL,
  role VARCHAR(20) NOT NULL,
  name VARCHAR(100) NOT NULL,
  cnic VARCHAR(20) UNIQUE NOT NULL,
  email VARCHAR(100) UNIQUE NOT NULL,
  mobile VARCHAR(20),
  password_hash TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);
ALTER TABLE users ADD COLUMN IF NOT EXISTS id UUID;
ALTER TABLE users ADD COLUMN IF NOT EXISTS user_id VARCHAR(20);


-- SECTION 1: ADD UNIQUE CONSTRAINT TO user_id
-- Run this first, if you get error "constraint already exists", that's OK!
ALTER TABLE users ADD CONSTRAINT users_user_id_key UNIQUE (user_id);

-- Verify it worked:
SELECT constraint_name, constraint_type 
FROM information_schema.table_constraints 
WHERE table_name = 'users' AND constraint_name = 'users_user_id_key';
-- You should see: users_user_id_key | UNIQUE


-- =====================================================
-- SECTION 2: ADD NEW COLUMNS TO USERS TABLE
-- =====================================================
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS public_key TEXT,
ADD COLUMN IF NOT EXISTS encrypted_private_key TEXT,
ADD COLUMN IF NOT EXISTS blockchain_address VARCHAR(100),
ADD COLUMN IF NOT EXISTS account_locked BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS lock_until TIMESTAMP,
ADD COLUMN IF NOT EXISTS failed_login_attempts INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_login TIMESTAMP,
ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE,
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW();

-- Verify columns were added:
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'users' 
ORDER BY ordinal_position;

 
 
-- Logic for manufacturer-specific permissions
