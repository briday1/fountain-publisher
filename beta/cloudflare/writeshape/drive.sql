-- Isolated WriteShape Drive credentials; additive to accounts.sql.
CREATE TABLE IF NOT EXISTS drive_link_state (
 account_id TEXT PRIMARY KEY REFERENCES accounts(id),
 epoch TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS drive_oauth_attempts (
 state_hash TEXT PRIMARY KEY,
 account_id TEXT NOT NULL REFERENCES accounts(id),
 epoch TEXT NOT NULL,
 verifier_cipher TEXT NOT NULL,
 nonce TEXT NOT NULL,
 expires INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS drive_oauth_expiry ON drive_oauth_attempts(expires);
CREATE TABLE IF NOT EXISTS drive_connections (
 account_id TEXT PRIMARY KEY REFERENCES accounts(id),
 google_subject TEXT NOT NULL,
 email TEXT NOT NULL,
 token_cipher TEXT NOT NULL,
 expires INTEGER NOT NULL,
 generation TEXT NOT NULL,
 refresh_lock TEXT,
 refresh_until INTEGER NOT NULL DEFAULT 0,
 updated INTEGER NOT NULL
);
