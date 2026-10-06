-- No existing history is removed by applying this migration.
CREATE TABLE file_retention (
 owner TEXT NOT NULL,
 file_id TEXT NOT NULL,
 max_versions INTEGER NOT NULL CHECK(max_versions>=0),
 PRIMARY KEY(owner,file_id)
);
DROP TRIGGER immutable_file_version_delete;
CREATE TRIGGER immutable_file_version_delete BEFORE DELETE ON file_versions
WHEN NOT EXISTS(SELECT 1 FROM deleting_accounts WHERE account_id=OLD.owner)
 AND NOT EXISTS(
   SELECT 1 FROM file_retention policy
   WHERE policy.owner=OLD.owner AND policy.file_id=OLD.file_id
    AND (SELECT COUNT(*) FROM file_versions newer
         WHERE newer.owner=OLD.owner AND newer.file_id=OLD.file_id
          AND newer.revision>OLD.revision)>=policy.max_versions
 )
BEGIN SELECT RAISE(ABORT,'IMMUTABLE_FILE_VERSION'); END;
CREATE TRIGGER prune_file_history_after_save AFTER UPDATE ON items
WHEN NEW.kind='file' AND EXISTS(
 SELECT 1 FROM file_retention WHERE owner=NEW.owner AND file_id=NEW.id
)
BEGIN
 DELETE FROM file_versions WHERE owner=NEW.owner AND file_id=NEW.id
  AND id IN (
   SELECT id FROM file_versions WHERE owner=NEW.owner AND file_id=NEW.id
   ORDER BY revision DESC LIMIT -1 OFFSET (
    SELECT max_versions FROM file_retention WHERE owner=NEW.owner AND file_id=NEW.id
   )
  );
END;
