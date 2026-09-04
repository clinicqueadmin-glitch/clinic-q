-- Add unique constraint to prevent duplicate settings per clinic
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'clinic_settings_clinic_id_setting_key_unique'
  ) THEN
    ALTER TABLE clinic_settings 
    ADD CONSTRAINT clinic_settings_clinic_id_setting_key_unique 
    UNIQUE (clinic_id, setting_key);
  END IF;
END $$;

-- Add unique constraint to daily_rooms
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'daily_rooms_clinic_date_unique'
  ) THEN
    ALTER TABLE daily_rooms 
    ADD CONSTRAINT daily_rooms_clinic_date_unique 
    UNIQUE (clinic_id, room_date);
  END IF;
END $$;

-- Fix general settings for clinic-1788382073429 (wrong open/close times)
UPDATE clinic_settings 
SET setting_value = jsonb_set(
  jsonb_set(setting_value, '{openTime}', '"08:00"'),
  '{closeTime}', '"20:00"'
)
WHERE clinic_id = 'clinic-1788382073429' 
  AND setting_key = 'general'
  AND (setting_value->>'openTime' = '00:00' OR setting_value->>'closeTime' = '04:00');
