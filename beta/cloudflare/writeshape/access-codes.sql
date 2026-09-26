CREATE TABLE IF NOT EXISTS access_codes (
 id TEXT PRIMARY KEY,
 label TEXT NOT NULL,
 code_hash TEXT NOT NULL UNIQUE,
 duration_days INTEGER NOT NULL CHECK(duration_days BETWEEN 1 AND 3650),
 expires_at INTEGER NOT NULL,
 max_redemptions INTEGER NOT NULL CHECK(max_redemptions BETWEEN 1 AND 10000),
 revoked_at INTEGER,
 created_by TEXT NOT NULL REFERENCES accounts(id),
 created INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS access_redemptions (
 code_id TEXT NOT NULL REFERENCES access_codes(id),
 account_id TEXT NOT NULL REFERENCES accounts(id),
 granted_at INTEGER NOT NULL,
 expires_at INTEGER NOT NULL,
 PRIMARY KEY(code_id,account_id)
);
CREATE INDEX IF NOT EXISTS access_redemptions_account ON access_redemptions(account_id,expires_at);
CREATE TABLE IF NOT EXISTS access_code_attempts (
 account_id TEXT PRIMARY KEY REFERENCES accounts(id),
 window_start INTEGER NOT NULL,
 attempts INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS access_code_audit (
 id INTEGER PRIMARY KEY,
 code_id TEXT NOT NULL REFERENCES access_codes(id),
 account_id TEXT NOT NULL REFERENCES accounts(id),
 action TEXT NOT NULL,
 created INTEGER NOT NULL
);
CREATE TRIGGER IF NOT EXISTS access_code_created AFTER INSERT ON access_codes BEGIN
 INSERT INTO access_code_audit(code_id,account_id,action,created) VALUES(NEW.id,NEW.created_by,'created',NEW.created);
END;
CREATE TRIGGER IF NOT EXISTS access_code_revoked AFTER UPDATE OF revoked_at ON access_codes
WHEN OLD.revoked_at IS NULL AND NEW.revoked_at IS NOT NULL BEGIN
 INSERT INTO access_code_audit(code_id,account_id,action,created) VALUES(NEW.id,NEW.created_by,'revoked',NEW.revoked_at);
END;
CREATE TRIGGER IF NOT EXISTS access_code_redeemed AFTER INSERT ON access_redemptions BEGIN
 INSERT INTO access_code_audit(code_id,account_id,action,created) VALUES(NEW.code_id,NEW.account_id,'redeemed',NEW.granted_at);
END;
