CREATE TABLE IF NOT EXISTS property_co_owner_consents (
  consent_id VARCHAR(120) PRIMARY KEY,
  property_id VARCHAR(120) NOT NULL REFERENCES properties(property_id) ON DELETE CASCADE,
  operation_type VARCHAR(40) NOT NULL,
  operation_label VARCHAR(120) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
  initiated_by_user_id VARCHAR(60) NOT NULL,
  initiated_by_name VARCHAR(160),
  notes TEXT,
  requested_price NUMERIC(15,2),
  initiated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at TIMESTAMPTZ,
  resolved_by VARCHAR(60),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS property_co_owner_consent_votes (
  vote_id VARCHAR(120) PRIMARY KEY,
  consent_id VARCHAR(120) NOT NULL REFERENCES property_co_owner_consents(consent_id) ON DELETE CASCADE,
  property_id VARCHAR(120) NOT NULL REFERENCES properties(property_id) ON DELETE CASCADE,
  participant_user_id VARCHAR(60) NOT NULL,
  participant_name VARCHAR(160),
  participant_role VARCHAR(20) NOT NULL,
  allocation_id VARCHAR(120),
  vote VARCHAR(20),
  response_notes TEXT,
  responded_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (consent_id, participant_user_id)
);

CREATE INDEX IF NOT EXISTS idx_property_co_owner_consents_property
ON property_co_owner_consents (property_id, operation_type, initiated_at DESC);

CREATE INDEX IF NOT EXISTS idx_property_co_owner_consents_status
ON property_co_owner_consents (status, initiated_at DESC);

CREATE INDEX IF NOT EXISTS idx_property_co_owner_consent_votes_user
ON property_co_owner_consent_votes (participant_user_id, consent_id, responded_at);
