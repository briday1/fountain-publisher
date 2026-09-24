CREATE TABLE IF NOT EXISTS items (
 id TEXT PRIMARY KEY,
 owner TEXT NOT NULL,
 parent TEXT NOT NULL DEFAULT '',
 name TEXT NOT NULL,
 kind TEXT NOT NULL CHECK(kind IN ('file','folder')),
 content TEXT,
 revision INTEGER NOT NULL DEFAULT 1,
 updated TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS items_owner_parent ON items(owner,parent);
