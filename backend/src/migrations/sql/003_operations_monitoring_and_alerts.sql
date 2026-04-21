CREATE TABLE IF NOT EXISTS system_health_snapshots (
  id BIGSERIAL PRIMARY KEY,
  snapshot_type VARCHAR(40) NOT NULL DEFAULT 'OPS_AUTOMATION',
  overall_status VARCHAR(24) NOT NULL DEFAULT 'HEALTHY',
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_system_health_snapshots_created_at
  ON system_health_snapshots(created_at DESC);

CREATE TABLE IF NOT EXISTS system_alerts (
  id BIGSERIAL PRIMARY KEY,
  fingerprint VARCHAR(128) NOT NULL UNIQUE,
  severity VARCHAR(16) NOT NULL,
  category VARCHAR(80) NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  target_id VARCHAR(160),
  target_type VARCHAR(80),
  status VARCHAR(24) NOT NULL DEFAULT 'OPEN',
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  first_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at TIMESTAMPTZ,
  occurrence_count INTEGER NOT NULL DEFAULT 1,
  last_delivery_at TIMESTAMPTZ,
  last_delivery_status VARCHAR(40)
);

CREATE INDEX IF NOT EXISTS idx_system_alerts_status_severity
  ON system_alerts(status, severity, last_seen_at DESC);

CREATE TABLE IF NOT EXISTS system_job_runs (
  id BIGSERIAL PRIMARY KEY,
  job_name VARCHAR(60) NOT NULL,
  status VARCHAR(24) NOT NULL DEFAULT 'SUCCESS',
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  finished_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_system_job_runs_job_name_started_at
  ON system_job_runs(job_name, started_at DESC);
