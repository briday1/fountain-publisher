-- Additive and repeatable. Existing items remain untouched.
-- Current version IDs are file UUID + ':' + revision. Archive that same ID on save.
CREATE TABLE IF NOT EXISTS file_versions (
 id TEXT PRIMARY KEY,
 file_id TEXT NOT NULL,
 owner TEXT NOT NULL,
 revision INTEGER NOT NULL,
 name TEXT NOT NULL,
 content TEXT NOT NULL,
 saved_at TEXT NOT NULL,
 UNIQUE(file_id,revision)
);
CREATE INDEX IF NOT EXISTS file_versions_owner_file ON file_versions(owner,file_id,revision DESC);
CREATE TRIGGER IF NOT EXISTS archive_file_before_save
BEFORE UPDATE ON items WHEN OLD.kind='file'
BEGIN
 SELECT CASE WHEN NEW.revision!=OLD.revision+1 OR NEW.id!=OLD.id OR NEW.owner!=OLD.owner OR NEW.kind!=OLD.kind
 THEN RAISE(ABORT,'INVALID_FILE_REVISION') END;
 INSERT INTO file_versions (id,file_id,owner,revision,name,content,saved_at)
 VALUES (OLD.id||':'||OLD.revision,OLD.id,OLD.owner,OLD.revision,OLD.name,COALESCE(OLD.content,''),OLD.updated);
END;
CREATE TRIGGER IF NOT EXISTS immutable_file_version_update
BEFORE UPDATE ON file_versions BEGIN SELECT RAISE(ABORT,'IMMUTABLE_FILE_VERSION'); END;
CREATE TRIGGER IF NOT EXISTS immutable_file_version_delete
BEFORE DELETE ON file_versions BEGIN SELECT RAISE(ABORT,'IMMUTABLE_FILE_VERSION'); END;
