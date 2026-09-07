-- ============================================================
-- Migration 003: Weekly clinic schedule + room day availability
-- Date: 2026-09-07
--
-- Purpose:
--   1. Add weeklySchedule to clinic_settings.general.setting_value
--      so each day can have independent open/close times.
--   2. Add available_days column to rooms table so each room
--      can be configured for specific days of the week.
--
-- Backward compatibility:
--   - Existing openTime/closeTime/operatingDays are preserved.
--   - weeklySchedule is derived from existing values.
--   - Code can fall back to openTime/closeTime if weeklySchedule
--     is not present (for clinics not yet migrated).
-- ============================================================

-- ── STEP 1: Add available_days to rooms ──
ALTER TABLE rooms
  ADD COLUMN IF NOT EXISTS available_days jsonb DEFAULT '["mon","tue","wed","thu","fri"]'::jsonb;

COMMENT ON COLUMN rooms.available_days IS 'JSON array of day codes when this room is available: ["mon","tue","wed","thu","fri","sat","sun"]';

-- ── STEP 2: Migrate existing clinic_settings to include weeklySchedule ──
-- For each clinic that has a general setting, add weeklySchedule
-- derived from the existing openTime/closeTime/operatingDays.
DO $$
DECLARE
  rec RECORD;
  v_val jsonb;
  v_open TEXT;
  v_close TEXT;
  v_days jsonb;
  v_weekly jsonb;
  v_day TEXT;
  v_days_arr TEXT[];
BEGIN
  FOR rec IN
    SELECT id, setting_value
    FROM clinic_settings
    WHERE setting_key = 'general'
  LOOP
    v_val := rec.setting_value;
    v_open := COALESCE(v_val->>'openTime', '08:00');
    v_close := COALESCE(v_val->>'closeTime', '20:00');
    v_days := COALESCE(v_val->'operatingDays', '["mon","tue","wed","thu","fri"]'::jsonb);

    -- Build weeklySchedule from existing values
    v_weekly := '{}'::jsonb;
    v_days_arr := ARRAY['mon','tue','wed','thu','fri','sat','sun'];

    FOREACH v_day IN ARRAY v_days_arr LOOP
      IF v_days ? v_day THEN
        v_weekly := v_weekly || jsonb_build_object(
          v_day, jsonb_build_object(
            'enabled', true,
            'openTime', v_open,
            'closeTime', v_close
          )
        );
      ELSE
        v_weekly := v_weekly || jsonb_build_object(
          v_day, jsonb_build_object(
            'enabled', false,
            'openTime', v_open,
            'closeTime', v_close
          )
        );
      END IF;
    END LOOP;

    -- Add weeklySchedule to the setting_value (preserve existing fields)
    UPDATE clinic_settings
    SET setting_value = setting_value || jsonb_build_object('weeklySchedule', v_weekly),
        updated_at = NOW()
    WHERE id = rec.id;

    RAISE NOTICE 'Migrated clinic_settings id=%: added weeklySchedule', rec.id;
  END LOOP;
END $$;

-- ── STEP 3: Add available_days to existing rooms ──
-- Set available_days based on the clinic's operatingDays
DO $$
DECLARE
  rec RECORD;
  v_days jsonb;
BEGIN
  FOR rec IN
    SELECT r.id AS room_id, r.clinic_id,
           cs.setting_value->'operatingDays' AS op_days
    FROM rooms r
    LEFT JOIN clinic_settings cs ON cs.clinic_id = r.clinic_id AND cs.setting_key = 'general'
    WHERE r.available_days IS NULL OR r.available_days = 'null'::jsonb
  LOOP
    v_days := COALESCE(rec.op_days, '["mon","tue","wed","thu","fri"]'::jsonb);
    UPDATE rooms
    SET available_days = v_days
    WHERE id = rec.room_id;
    RAISE NOTICE 'Set available_days for room %: %', rec.room_id, v_days;
  END LOOP;
END $$;
