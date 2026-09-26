-- Apply once before deploying the optional live-billing path.
-- Sandbox customer IDs and entitlements remain separate for safe rollback.
ALTER TABLE accounts ADD COLUMN live_stripe_customer TEXT;
ALTER TABLE accounts ADD COLUMN live_billing_status TEXT NOT NULL DEFAULT 'none';
ALTER TABLE accounts ADD COLUMN live_premium_until INTEGER NOT NULL DEFAULT 0;
ALTER TABLE accounts ADD COLUMN live_cancel_at_period_end INTEGER NOT NULL DEFAULT 0;
ALTER TABLE accounts ADD COLUMN live_billing_version INTEGER NOT NULL DEFAULT 0;
CREATE UNIQUE INDEX accounts_live_customer ON accounts(live_stripe_customer);
CREATE TABLE IF NOT EXISTS live_checkout_attempts (
 account_id TEXT PRIMARY KEY REFERENCES accounts(id),
 token TEXT NOT NULL,
 expires INTEGER NOT NULL
);
