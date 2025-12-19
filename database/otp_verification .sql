CREATE TABLE otp_verification (
    id SERIAL PRIMARY KEY,
    email VARCHAR(100) NOT NULL,
    otp VARCHAR(6) NOT NULL,
    expires_at TIMESTAMP NOT NULL
);CREATE UNIQUE INDEX unique_email_otp ON otp_verification (email, otp);  


ALTER TABLE otp_verification 
ADD COLUMN IF NOT EXISTS otp_type VARCHAR(20) DEFAULT 'registration',
ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW();

CREATE INDEX IF NOT EXISTS idx_otp_email ON otp_verification(email);
CREATE INDEX IF NOT EXISTS idx_otp_type ON otp_verification(otp_type);
