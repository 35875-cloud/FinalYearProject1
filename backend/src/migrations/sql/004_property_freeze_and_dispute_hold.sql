ALTER TABLE properties
  ADD COLUMN IF NOT EXISTS is_frozen BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS freeze_reason_code VARCHAR(40),
  ADD COLUMN IF NOT EXISTS freeze_reason_label VARCHAR(120),
  ADD COLUMN IF NOT EXISTS freeze_reference_no VARCHAR(120),
  ADD COLUMN IF NOT EXISTS freeze_notes TEXT,
  ADD COLUMN IF NOT EXISTS freeze_authority_role VARCHAR(20),
  ADD COLUMN IF NOT EXISTS freeze_authority_user_id VARCHAR(60),
  ADD COLUMN IF NOT EXISTS freeze_started_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS freeze_released_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS freeze_released_by VARCHAR(60),
  ADD COLUMN IF NOT EXISTS freeze_release_notes TEXT;

CREATE INDEX IF NOT EXISTS idx_properties_frozen_status
ON properties (is_frozen, status);

CREATE INDEX IF NOT EXISTS idx_properties_freeze_started_at
ON properties (freeze_started_at DESC);
