-- ═══════════════════════════════════════════════════════
-- RUN THIS AFTER MIGRATION TO VERIFY
-- ═══════════════════════════════════════════════════════

-- 1. ตรวจสอบ clinic_id column ใน completed_procedures
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'completed_procedures' AND column_name = 'clinic_id';

-- 2. ตรวจสอบ unique constraints
SELECT conname, contype 
FROM pg_constraint 
WHERE conname IN ('clinic_settings_clinic_id_setting_key_unique', 'daily_rooms_clinic_date_unique');

-- 3. ตรวจสอบว่า completed_procedures มี clinic_id แล้ว
SELECT cp.id, cp.name, cp.clinic_id, q.patient_name
FROM completed_procedures cp
LEFT JOIN queues q ON cp.queue_id = q.id
LIMIT 10;

-- 4. ตรวจสอบ settings per clinic (should show tv_ads for clinic-1788382073429)
SELECT clinic_id, setting_key 
FROM clinic_settings 
ORDER BY clinic_id, setting_key;

-- 5. ตรวจสอบ open/close times
SELECT clinic_id, setting_key, setting_value->>'openTime' as open, setting_value->>'closeTime' as close
FROM clinic_settings 
WHERE setting_key = 'general';
