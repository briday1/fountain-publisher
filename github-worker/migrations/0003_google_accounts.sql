CREATE TABLE IF NOT EXISTS google_oauth_states (
  state TEXT PRIMARY KEY,
  binding_hash TEXT NOT NULL,
  pkce_verifier TEXT NOT NULL,
  expires_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS google_sessions (
  id TEXT PRIMARY KEY,
  google_sub TEXT NOT NULL,
  email TEXT NOT NULL,
  display_name TEXT,
  picture_url TEXT,
  access_token TEXT NOT NULL,
  refresh_token TEXT,
  access_expires_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS google_sessions_expires_at ON google_sessions(expires_at);
CREATE INDEX IF NOT EXISTS google_sessions_google_sub ON google_sessions(google_sub);
