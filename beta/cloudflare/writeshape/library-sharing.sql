-- Additive: no changes to existing files, account IDs, or version history.
CREATE TABLE IF NOT EXISTS file_shares (
 id TEXT PRIMARY KEY,
 file_id TEXT NOT NULL REFERENCES items(id),
 owner TEXT NOT NULL REFERENCES accounts(id),
 recipient_id TEXT NOT NULL REFERENCES accounts(id),
 recipient_email TEXT NOT NULL,
 role TEXT NOT NULL DEFAULT 'read-only' CHECK(role='read-only'),
 created_at TEXT NOT NULL,
 revoked_at TEXT,
 CHECK(owner != recipient_id)
);
CREATE UNIQUE INDEX IF NOT EXISTS file_shares_active_recipient
 ON file_shares(file_id,owner,recipient_id) WHERE revoked_at IS NULL;
CREATE INDEX IF NOT EXISTS file_shares_recipient ON file_shares(recipient_id,revoked_at);
CREATE INDEX IF NOT EXISTS file_shares_owner ON file_shares(owner,file_id);
CREATE TRIGGER IF NOT EXISTS file_shares_immutable_identity
 BEFORE UPDATE ON file_shares
 WHEN NEW.id IS NOT OLD.id OR NEW.file_id IS NOT OLD.file_id
 OR NEW.owner IS NOT OLD.owner OR NEW.recipient_id IS NOT OLD.recipient_id
 OR NEW.recipient_email IS NOT OLD.recipient_email OR NEW.role IS NOT OLD.role
 OR NEW.created_at IS NOT OLD.created_at
 OR (OLD.revoked_at IS NOT NULL AND NEW.revoked_at IS NOT OLD.revoked_at)
 BEGIN SELECT RAISE(ABORT,'IMMUTABLE_SHARE'); END;
