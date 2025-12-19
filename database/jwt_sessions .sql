CREATE TABLE IF NOT EXISTS jwt_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id VARCHAR(20) NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    token TEXT NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    revoked BOOLEAN DEFAULT FALSE,
    revoked_at TIMESTAMP,
    ip_address VARCHAR(50),
    user_agent TEXT
);

CREATE INDEX IF NOT EXISTS idx_jwt_user ON jwt_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_jwt_token ON jwt_sessions(token);
CREATE INDEX IF NOT EXISTS idx_jwt_expires ON jwt_sessions(expires_at);

