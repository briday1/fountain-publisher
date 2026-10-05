CREATE TABLE deleting_accounts (account_id TEXT PRIMARY KEY REFERENCES accounts(id), started INTEGER NOT NULL);
CREATE TABLE revoked_access (subject_hash TEXT PRIMARY KEY, before_iat INTEGER NOT NULL, expires INTEGER NOT NULL);
CREATE TABLE live_room_registry (file_id TEXT PRIMARY KEY, legacy INTEGER NOT NULL DEFAULT 0);
CREATE TABLE live_room_members (file_id TEXT NOT NULL, account_id TEXT NOT NULL REFERENCES accounts(id), PRIMARY KEY(file_id,account_id));
CREATE TABLE maintenance_state (key TEXT PRIMARY KEY, value TEXT NOT NULL);
DROP TRIGGER immutable_file_version_delete;
CREATE TRIGGER immutable_file_version_delete BEFORE DELETE ON file_versions
WHEN NOT EXISTS(SELECT 1 FROM deleting_accounts WHERE account_id=OLD.owner)
BEGIN SELECT RAISE(ABORT,'IMMUTABLE_FILE_VERSION'); END;
CREATE TRIGGER items_require_active_owner_insert BEFORE INSERT ON items
WHEN NOT EXISTS(SELECT 1 FROM accounts WHERE id=NEW.owner) OR EXISTS(SELECT 1 FROM deleting_accounts WHERE account_id=NEW.owner)
BEGIN SELECT RAISE(ABORT,'ACCOUNT_UNAVAILABLE'); END;
CREATE TRIGGER items_require_active_owner_update BEFORE UPDATE ON items
WHEN NOT EXISTS(SELECT 1 FROM accounts WHERE id=NEW.owner) OR EXISTS(SELECT 1 FROM deleting_accounts WHERE account_id=NEW.owner)
BEGIN SELECT RAISE(ABORT,'ACCOUNT_UNAVAILABLE'); END;
