-- Existing codes and redemptions keep their original duration and expiration.
-- Indefinite codes use expires_at=0 on redemption; the explicit flag grants access.
ALTER TABLE access_codes ADD COLUMN indefinite INTEGER NOT NULL DEFAULT 0 CHECK(indefinite IN (0,1));
