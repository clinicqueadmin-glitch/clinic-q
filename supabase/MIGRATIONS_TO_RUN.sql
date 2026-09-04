-- ═══════════════════════════════════════════════════════
-- RUN THIS IN: Supabase Dashboard → SQL Editor
-- ═══════════════════════════════════════════════════════

-- 1. เพิ่ม clinic_id column ใน completed_procedures
ALTER TABLE completed_procedures ADD COLUMN IF NOT EXISTS clinic_id TEXT;

-- Backfill clinic_id จากตาราง queues
UPDATE completed_procedures cp
SET clinic_id = q.clinic_id
FROM queues q
WHERE cp.queue_id = q.id AND cp.clinic_id IS NULL;

-- Index สำหรับ clinic_id
CREATE INDEX IF NOT EXISTS idx_completed_procedures_clinic ON completed_procedures(clinic_id);

-- 2. เพิ่ม unique constraint บน clinic_settings
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

-- 3. เพิ่ม unique constraint บน daily_rooms
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

-- 4. แก้ไข open/close times ที่ผิด (00:00-04:00 → 08:00-20:00)
UPDATE clinic_settings 
SET setting_value = jsonb_set(
  jsonb_set(setting_value, '{openTime}', '"08:00"'),
  '{closeTime}', '"20:00"'
)
WHERE clinic_id = 'clinic-1788382073429' 
  AND setting_key = 'general'
  AND (setting_value->>'openTime' = '00:00' OR setting_value->>'closeTime' = '04:00');

-- ═══ สำเร็จ! ═══
