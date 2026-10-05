-- Keep an anonymous lifetime count: deleting an account must not make a used code reusable.
ALTER TABLE access_codes ADD COLUMN total_redemptions INTEGER NOT NULL DEFAULT 0;
UPDATE access_codes SET total_redemptions=(SELECT COUNT(*) FROM access_redemptions WHERE code_id=access_codes.id);
CREATE TRIGGER access_code_count_claim AFTER INSERT ON access_redemptions
BEGIN UPDATE access_codes SET total_redemptions=total_redemptions+1 WHERE id=NEW.code_id; END;
