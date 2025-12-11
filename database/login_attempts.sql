CREATE TABLE IF NOT EXISTS login_attempts (
    id SERIAL PRIMARY KEY,
    email VARCHAR(100) NOT NULL,
    ip_address VARCHAR(50),
    attempt_time TIMESTAMP DEFAULT NOW(),
    success BOOLEAN DEFAULT FALSE,
    failure_reason VARCHAR(100)
);

CREATE INDEX IF NOT EXISTS idx_login_email ON login_attempts(email);
CREATE INDEX IF NOT EXISTS idx_login_time ON login_attempts(attempt_time);

 
 
 
-- Logic to track failed login attempts per IP
-- Indexing for fast retrieval of audit logs
