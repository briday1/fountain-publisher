CREATE TABLE cloud_backup_grace (
 account_id TEXT PRIMARY KEY REFERENCES accounts(id),
 generation TEXT NOT NULL,
 last_premium_until INTEGER NOT NULL DEFAULT 0,
 last_premium_seen INTEGER NOT NULL,
 ended_at INTEGER,
 deadline INTEGER,
 purged_at INTEGER,
 initial_sent INTEGER,
 ten_sent INTEGER,
 one_sent INTEGER
);
CREATE TABLE cloud_backup_notices (
 account_id TEXT NOT NULL REFERENCES accounts(id),
 generation TEXT NOT NULL,
 kind TEXT NOT NULL CHECK(kind IN ('initial','ten','one')),
 due INTEGER NOT NULL,
 attempts INTEGER NOT NULL DEFAULT 0,
 next_attempt INTEGER NOT NULL DEFAULT 0,
 sent_at INTEGER,
 PRIMARY KEY(account_id,generation,kind)
);
-- A narrow, temporary permit for deleting expired cloud data; never the account.
CREATE TABLE expiring_cloud_accounts (
 account_id TEXT PRIMARY KEY REFERENCES accounts(id), generation TEXT NOT NULL
);
CREATE INDEX cloud_backup_due ON cloud_backup_notices(due,next_attempt) WHERE sent_at IS NULL;
CREATE INDEX cloud_backup_deadlines ON cloud_backup_grace(deadline) WHERE purged_at IS NULL;
DROP TRIGGER immutable_file_version_delete;
CREATE TRIGGER immutable_file_version_delete BEFORE DELETE ON file_versions
WHEN NOT EXISTS(SELECT 1 FROM deleting_accounts WHERE account_id=OLD.owner)
 AND NOT EXISTS(SELECT 1 FROM expiring_cloud_accounts WHERE account_id=OLD.owner)
 AND NOT EXISTS(
   SELECT 1 FROM file_retention policy
   WHERE policy.owner=OLD.owner AND policy.file_id=OLD.file_id
    AND (SELECT COUNT(*) FROM file_versions newer
         WHERE newer.owner=OLD.owner AND newer.file_id=OLD.file_id
          AND newer.revision>OLD.revision)>=policy.max_versions
 )
BEGIN SELECT RAISE(ABORT,'IMMUTABLE_FILE_VERSION'); END;
