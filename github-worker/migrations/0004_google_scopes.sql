-- Old sessions keep narrow access until the user explicitly grants full browsing.
ALTER TABLE google_sessions ADD COLUMN granted_scopes TEXT NOT NULL DEFAULT '';
