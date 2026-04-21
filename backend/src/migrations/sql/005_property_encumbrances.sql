ALTER TABLE properties
  ADD COLUMN IF NOT EXISTS is_for_sale BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS is_encumbered BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS encumbrance_summary VARCHAR(180),
  ADD COLUMN IF NOT EXISTS active_encumbrance_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_encumbrance_recorded_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_encumbrance_released_at TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS property_encumbrances (
  encumbrance_id VARCHAR(80) PRIMARY KEY,
  property_id VARCHAR(120) NOT NULL REFERENCES properties(property_id) ON DELETE CASCADE,
  type_code VARCHAR(40) NOT NULL,
  type_label VARCHAR(120) NOT NULL,
  holder_name VARCHAR(160),
  reference_no VARCHAR(120),
  notes TEXT,
  amount_secured NUMERIC(15,2),
  authority_role VARCHAR(20),
  authority_user_id VARCHAR(60),
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  released_at TIMESTAMPTZ,
  released_by VARCHAR(60),
  release_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_property_encumbrances_active
ON property_encumbrances (property_id, released_at, recorded_at DESC);

CREATE INDEX IF NOT EXISTS idx_properties_encumbered_status
ON properties (is_encumbered, status);
