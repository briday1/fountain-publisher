-- Additive only: existing screenplay rows and owner IDs are unchanged.
CREATE TABLE IF NOT EXISTS accounts (
 id TEXT PRIMARY KEY,
 email TEXT NOT NULL,
 display_name TEXT NOT NULL DEFAULT '',
 private_tester INTEGER NOT NULL DEFAULT 0,
 stripe_customer TEXT UNIQUE,
 billing_status TEXT NOT NULL DEFAULT 'none',
 premium_until INTEGER NOT NULL DEFAULT 0,
 cancel_at_period_end INTEGER NOT NULL DEFAULT 0,
 billing_version INTEGER NOT NULL DEFAULT 0,
 created INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS account_identities (
 issuer TEXT NOT NULL,
 subject TEXT NOT NULL,
 account_id TEXT NOT NULL REFERENCES accounts(id),
 PRIMARY KEY (issuer,subject)
);
CREATE TABLE IF NOT EXISTS account_sessions (
 token_hash TEXT PRIMARY KEY,
 account_id TEXT NOT NULL REFERENCES accounts(id),
 expires INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS account_sessions_expiry ON account_sessions(expires);
CREATE TABLE IF NOT EXISTS oauth_attempts (
 state_hash TEXT PRIMARY KEY,
 nonce TEXT NOT NULL,
 verifier TEXT NOT NULL,
 account_id TEXT,
 expires INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS billing_events (
 id TEXT PRIMARY KEY,
 processed INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS checkout_attempts (
 account_id TEXT PRIMARY KEY REFERENCES accounts(id),
 token TEXT NOT NULL,
 expires INTEGER NOT NULL
);
