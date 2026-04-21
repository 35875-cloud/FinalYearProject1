CREATE TABLE IF NOT EXISTS system_backups (
  backup_id VARCHAR(120) PRIMARY KEY,
  label VARCHAR(160),
  backup_mode VARCHAR(32) NOT NULL,
  status VARCHAR(24) NOT NULL DEFAULT 'CREATED',
  backup_path TEXT NOT NULL,
  manifest_path TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by VARCHAR(60),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_system_backups_created_at
  ON system_backups(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_system_backups_status
  ON system_backups(status);

CREATE TABLE IF NOT EXISTS system_restore_runs (
  restore_id VARCHAR(120) PRIMARY KEY,
  backup_id VARCHAR(120),
  restore_mode VARCHAR(32) NOT NULL,
  status VARCHAR(24) NOT NULL DEFAULT 'COMPLETED',
  source_path TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  triggered_by VARCHAR(60),
  restored_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_system_restore_runs_restored_at
  ON system_restore_runs(restored_at DESC);

CREATE INDEX IF NOT EXISTS idx_system_restore_runs_status
  ON system_restore_runs(status);
