-- Storage invitations are independent of private tester status, codes and billing.
-- No existing documents, versions, shares or accounts are changed.
CREATE TABLE IF NOT EXISTS cloud_storage_grants (
 account_id TEXT PRIMARY KEY REFERENCES accounts(id) ON DELETE CASCADE,
 granted_by TEXT NOT NULL,
 granted_at INTEGER NOT NULL,
 revoked_at INTEGER
);
