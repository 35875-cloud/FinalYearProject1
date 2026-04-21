CREATE TABLE IF NOT EXISTS channel_participants (
  participant_id SERIAL PRIMARY KEY,
  channel_id VARCHAR(120) NOT NULL,
  user_id VARCHAR(60) NOT NULL,
  role VARCHAR(20),
  is_online BOOLEAN DEFAULT FALSE,
  last_seen TIMESTAMP,
  joined_at TIMESTAMP DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_channel_participants_channel_user
  ON channel_participants(channel_id, user_id);

CREATE INDEX IF NOT EXISTS idx_channel_participants_user
  ON channel_participants(user_id);

CREATE TABLE IF NOT EXISTS channel_messages (
  message_id SERIAL PRIMARY KEY,
  channel_id VARCHAR(120) NOT NULL,
  sender_id VARCHAR(60),
  sender_role VARCHAR(40),
  message_type VARCHAR(40) DEFAULT 'TEXT',
  message_content TEXT,
  price_offer NUMERIC,
  timestamp TIMESTAMP DEFAULT NOW(),
  read_by_other BOOLEAN DEFAULT FALSE,
  is_system_message BOOLEAN DEFAULT FALSE,
  transfer_id VARCHAR(120),
  is_read BOOLEAN DEFAULT FALSE,
  read_at TIMESTAMPTZ,
  file_url TEXT,
  file_name TEXT,
  file_size BIGINT,
  file_hash TEXT,
  expires_at TIMESTAMPTZ,
  payload JSONB,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  transfer_request_id VARCHAR(120)
);

ALTER TABLE channel_messages
  ADD COLUMN IF NOT EXISTS sender_id VARCHAR(60),
  ADD COLUMN IF NOT EXISTS sender_role VARCHAR(40),
  ADD COLUMN IF NOT EXISTS message_type VARCHAR(40) DEFAULT 'TEXT',
  ADD COLUMN IF NOT EXISTS message_content TEXT,
  ADD COLUMN IF NOT EXISTS price_offer NUMERIC,
  ADD COLUMN IF NOT EXISTS timestamp TIMESTAMP DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS read_by_other BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS is_system_message BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS transfer_id VARCHAR(120),
  ADD COLUMN IF NOT EXISTS is_read BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS read_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS file_url TEXT,
  ADD COLUMN IF NOT EXISTS file_name TEXT,
  ADD COLUMN IF NOT EXISTS file_size BIGINT,
  ADD COLUMN IF NOT EXISTS file_hash TEXT,
  ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS payload JSONB,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS transfer_request_id VARCHAR(120);

ALTER TABLE channel_messages
  DROP CONSTRAINT IF EXISTS chk_message_type;

ALTER TABLE channel_messages
  ADD CONSTRAINT chk_message_type
  CHECK (
    message_type IN (
      'TEXT',
      'SYSTEM',
      'PRICE_OFFER',
      'IMAGE',
      'IMAGE_MESSAGE',
      'VOICE_MESSAGE',
      'FILE',
      'AGREEMENT',
      'PAYMENT',
      'RECEIPT',
      'RECEIPT_PROPOSAL',
      'CHALLAN',
      'HASH_ANNOUNCEMENT',
      'PAYMENT_PROOF',
      'SELLER_PROOF',
      'DEADLINE_NOTICE',
      'SCREENSHOT',
      'VOICE_NOTE',
      'CALL_EVENT',
      'VIDEO_CALL',
      'AUDIO_CALL'
    )
  );

CREATE INDEX IF NOT EXISTS idx_channel_messages_channel
  ON channel_messages(channel_id);

CREATE INDEX IF NOT EXISTS idx_channel_messages_timestamp
  ON channel_messages(channel_id, timestamp);

CREATE INDEX IF NOT EXISTS idx_channel_messages_sender
  ON channel_messages(sender_id);

CREATE INDEX IF NOT EXISTS idx_channel_messages_transfer
  ON channel_messages(transfer_id);

DO $$
BEGIN
  IF to_regclass('public.transfer_requests') IS NOT NULL THEN
    EXECUTE $sql$
      ALTER TABLE transfer_requests
        ADD COLUMN IF NOT EXISTS channel_id VARCHAR(120),
        ADD COLUMN IF NOT EXISTS channel_created_at TIMESTAMP,
        ADD COLUMN IF NOT EXISTS channel_status VARCHAR(20) DEFAULT 'INACTIVE',
        ADD COLUMN IF NOT EXISTS agreement_screenshot_url TEXT,
        ADD COLUMN IF NOT EXISTS agreement_text TEXT,
        ADD COLUMN IF NOT EXISTS agreement_timestamp TIMESTAMP,
        ADD COLUMN IF NOT EXISTS agreed_price DECIMAL(15,2),
        ADD COLUMN IF NOT EXISTS negotiated_terms JSONB,
        ADD COLUMN IF NOT EXISTS seller_agreed BOOLEAN DEFAULT FALSE,
        ADD COLUMN IF NOT EXISTS buyer_agreed BOOLEAN DEFAULT FALSE,
        ADD COLUMN IF NOT EXISTS seller_agreed_at TIMESTAMP,
        ADD COLUMN IF NOT EXISTS buyer_agreed_at TIMESTAMP,
        ADD COLUMN IF NOT EXISTS payment_challan_url TEXT,
        ADD COLUMN IF NOT EXISTS payment_uploaded_at TIMESTAMP,
        ADD COLUMN IF NOT EXISTS payment_status VARCHAR(20),
        ADD COLUMN IF NOT EXISTS payment_completed_at TIMESTAMP,
        ADD COLUMN IF NOT EXISTS challan_txn_id VARCHAR(120),
        ADD COLUMN IF NOT EXISTS approved_by VARCHAR(60),
        ADD COLUMN IF NOT EXISTS approved_at TIMESTAMP,
        ADD COLUMN IF NOT EXISTS approval_notes TEXT,
        ADD COLUMN IF NOT EXISTS rejection_reason TEXT
    $sql$;

    BEGIN
      EXECUTE 'ALTER TABLE transfer_requests DROP CONSTRAINT IF EXISTS transfer_requests_channel_status_check';
    EXCEPTION WHEN undefined_object THEN
      NULL;
    END;

    BEGIN
      EXECUTE $sql$
        ALTER TABLE transfer_requests
          ADD CONSTRAINT transfer_requests_channel_status_check
          CHECK (
            channel_status IN (
              'INACTIVE',
              'ACTIVE',
              'NEGOTIATING',
              'AGREED',
              'CLOSED',
              'FROZEN',
              'PAYMENT_DONE',
              'TRANSFERRED'
            )
          )
      $sql$;
    EXCEPTION WHEN duplicate_object THEN
      NULL;
    END;

    EXECUTE 'CREATE UNIQUE INDEX IF NOT EXISTS idx_transfer_requests_channel_id ON transfer_requests(channel_id) WHERE channel_id IS NOT NULL';
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_transfer_requests_payment_status ON transfer_requests(status, payment_uploaded_at)';
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_transfer_requests_expires_at ON transfer_requests(expires_at)';
  END IF;
END $$;
