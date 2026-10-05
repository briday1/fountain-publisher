CREATE TABLE cancellation_feedback (
 id TEXT PRIMARY KEY,
 account_id TEXT NOT NULL REFERENCES accounts(id),
 subscription_id TEXT NOT NULL,
 billing_mode TEXT NOT NULL CHECK(billing_mode IN ('test','live')),
 reason TEXT NOT NULL,
 created INTEGER NOT NULL,
 confirmed_at INTEGER,
 sent_at INTEGER,
 attempts INTEGER NOT NULL DEFAULT 0,
 next_attempt INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX cancellation_feedback_pending ON cancellation_feedback(sent_at,next_attempt);
