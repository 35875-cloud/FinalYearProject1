ALTER TABLE properties
  ADD COLUMN IF NOT EXISTS has_co_owners BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS ownership_model VARCHAR(20) NOT NULL DEFAULT 'SOLE',
  ADD COLUMN IF NOT EXISTS active_co_owner_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS co_owner_summary VARCHAR(180),
  ADD COLUMN IF NOT EXISTS last_co_ownership_sync_at TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS property_co_owners (
  allocation_id VARCHAR(120) PRIMARY KEY,
  property_id VARCHAR(120) NOT NULL REFERENCES properties(property_id) ON DELETE CASCADE,
  source_type VARCHAR(40) NOT NULL DEFAULT 'SUCCESSION',
  source_reference_id VARCHAR(120),
  request_no VARCHAR(120),
  user_id VARCHAR(60),
  owner_name VARCHAR(160),
  owner_cnic VARCHAR(30),
  father_name VARCHAR(160),
  relation_type VARCHAR(80),
  share_percent NUMERIC(8,2),
  share_fraction_text VARCHAR(80),
  is_primary_owner BOOLEAN NOT NULL DEFAULT FALSE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  granted_at TIMESTAMPTZ,
  synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_property_co_owners_property
ON property_co_owners (property_id, is_active, granted_at DESC);

CREATE INDEX IF NOT EXISTS idx_properties_joint_ownership
ON properties (has_co_owners, ownership_model, status);
