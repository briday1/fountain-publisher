ALTER TABLE oauth_states ADD COLUMN binding_hash TEXT;
ALTER TABLE sessions ADD COLUMN token_version INTEGER NOT NULL DEFAULT 0;

-- Existing credentials were not encrypted with TOKEN_ENCRYPTION_KEY and cannot
-- be migrated safely. Users reconnect once after this migration.
DELETE FROM sessions;
DELETE FROM oauth_states;

CREATE TABLE IF NOT EXISTS rate_limits (
  key TEXT PRIMARY KEY,
  count INTEGER NOT NULL,
  reset_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS rate_limits_reset_at ON rate_limits(reset_at);
