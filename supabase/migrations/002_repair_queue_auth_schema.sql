-- ============================================================
-- Migration 002: Repair Queue Functions + Auth Schema
-- Date: 2026-09-07
-- Purpose:
--   1. Create/replace get_today_ict(), get_next_queue_number(),
--      create_queue_item() with 20-param signature matching code
--   2. Add queues.first_name column for TV/Audio display
--   3. Add clinics.code column for staff username prefixes
--   4. Create staff_usernames table for server-side username resolution
--   5. Add performance indexes + unique constraints
--
-- SAFETY:
--   - All operations use IF NOT EXISTS / CREATE OR REPLACE
--   - No data is deleted or updated (except seeding clinic codes)
--   - Idempotent: safe to run multiple times
-- ============================================================

-- ═══════════════════════════════════════════════════════════════════
-- SECTION 1: QUEUE FUNCTIONS (from MIGRATION_PHASE_1.sql)
-- ═══════════════════════════════════════════════════════════════════

-- 1A. get_today_ict() — returns today's date in Asia/Bangkok timezone
CREATE OR REPLACE FUNCTION get_today_ict()
RETURNS DATE
LANGUAGE SQL STABLE
AS $$
  SELECT (NOW() AT TIME ZONE 'Asia/Bangkok')::DATE;
$$;

-- 1B. get_next_queue_number() — thread-safe queue number generation
-- Uses pg_advisory_xact_lock() to serialize concurrent requests
-- Queue numbers scoped by (clinic_id, queue_date)
CREATE OR REPLACE FUNCTION get_next_queue_number(
  p_clinic_id TEXT,
  p_queue_date DATE DEFAULT NULL
)
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  v_prefix TEXT;
  v_next_num INTEGER;
  v_queue_number TEXT;
  v_queue_date DATE;
BEGIN
  IF p_clinic_id IS NULL THEN
    RAISE EXCEPTION 'p_clinic_id cannot be NULL';
  END IF;

  v_queue_date := COALESCE(p_queue_date, get_today_ict());

  -- Determine prefix from clinic type
  SELECT CASE type
    WHEN 'dental' THEN 'E'
    WHEN 'medical' THEN 'A'
    WHEN 'aesthetic' THEN 'B'
    WHEN 'thai' THEN 'C'
    WHEN 'chinese' THEN 'D'
    WHEN 'physical' THEN 'F'
    ELSE 'Q'
  END INTO v_prefix
  FROM clinics WHERE id = p_clinic_id;

  IF v_prefix IS NULL THEN
    v_prefix := 'Q';
  END IF;

  -- Advisory lock per (clinic_id, queue_date)
  PERFORM pg_advisory_xact_lock(
    hashtext(p_clinic_id || ':' || v_queue_date::TEXT)
  );

  -- Get next number (safe under advisory lock)
  SELECT COALESCE(MAX(
    CAST(SUBSTRING(number FROM 2) AS INTEGER)
  ), 0) + 1
  INTO v_next_num
  FROM queues
  WHERE clinic_id = p_clinic_id
    AND queue_date = v_queue_date;

  v_queue_number := v_prefix || LPAD(v_next_num::TEXT, 3, '0');

  RETURN v_queue_number;
END;
$$;

-- 1C. create_queue_item() — ATOMIC queue creation (20 params)
-- This is the ONLY way to create queue items in the system.
-- Number generation + INSERT in same transaction.
-- Matches caller in src/lib/queue-context.tsx addQueueItem()
CREATE OR REPLACE FUNCTION create_queue_item(
  p_clinic_id TEXT,
  p_patient_name TEXT,
  p_phone TEXT,
  p_procedure TEXT,
  p_procedure_id TEXT DEFAULT NULL,
  p_branch_id TEXT DEFAULT NULL,
  p_booking_mode TEXT DEFAULT 'walkin',
  p_assigned_room INTEGER DEFAULT NULL,
  p_assigned_doctor TEXT DEFAULT NULL,
  p_queue_date DATE DEFAULT NULL,
  p_time TEXT DEFAULT NULL,
  p_arrived BOOLEAN DEFAULT TRUE,
  p_hn TEXT DEFAULT NULL,
  p_appointment_time TEXT DEFAULT NULL,
  p_appointment_date DATE DEFAULT NULL,
  p_appointment_on_time BOOLEAN DEFAULT NULL,
  p_late_minutes INTEGER DEFAULT NULL,
  p_original_booked_time TEXT DEFAULT NULL,
  p_booked_time_slot TEXT DEFAULT NULL,
  p_distance_from_clinic NUMERIC DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  number TEXT,
  clinic_id TEXT,
  queue_date DATE,
  status TEXT
)
LANGUAGE plpgsql
AS $$
DECLARE
  v_queue_number TEXT;
  v_queue_id UUID;
  v_queue_date DATE;
  v_now TIMESTAMPTZ;
BEGIN
  -- Validate required inputs
  IF p_clinic_id IS NULL THEN
    RAISE EXCEPTION 'p_clinic_id is required';
  END IF;
  IF p_patient_name IS NULL OR p_patient_name = '' THEN
    RAISE EXCEPTION 'p_patient_name is required';
  END IF;
  IF p_phone IS NULL OR p_phone = '' THEN
    RAISE EXCEPTION 'p_phone is required';
  END IF;
  IF p_procedure IS NULL OR p_procedure = '' THEN
    RAISE EXCEPTION 'p_procedure is required';
  END IF;

  v_queue_date := COALESCE(p_queue_date, get_today_ict());
  v_now := NOW();

  -- Generate queue number (includes advisory lock)
  v_queue_number := get_next_queue_number(p_clinic_id, v_queue_date);

  -- Generate UUID
  v_queue_id := gen_random_uuid();

  -- INSERT queue record (same transaction as number generation)
  INSERT INTO queues (
    id, clinic_id, number, patient_name, phone, procedure, procedure_id,
    branch_id, booking_mode, assigned_room, assigned_doctor,
    queue_date, status, time, arrived, hn,
    appointment_time, appointment_date, appointment_on_time,
    late_minutes, original_booked_time, booked_time_slot,
    distance_from_clinic,
    created_at, updated_at
  ) VALUES (
    v_queue_id, p_clinic_id, v_queue_number, p_patient_name, p_phone,
    p_procedure, p_procedure_id, p_branch_id, p_booking_mode,
    p_assigned_room, p_assigned_doctor, v_queue_date, 'waiting', p_time,
    p_arrived, p_hn,
    p_appointment_time, p_appointment_date, p_appointment_on_time,
    p_late_minutes, p_original_booked_time, p_booked_time_slot,
    p_distance_from_clinic,
    v_now, v_now
  );

  -- Return the created queue item
  RETURN QUERY
  SELECT q.id, q.number, q.clinic_id, q.queue_date, q.status
  FROM queues q
  WHERE q.id = v_queue_id;
END;
$$;


-- ═══════════════════════════════════════════════════════════════════
-- SECTION 2: QUEUE FIRST_NAME COLUMN
-- ═══════════════════════════════════════════════════════════════════
-- Used by TV/Audio queue calling to display first name only.
-- Example: patient_name = "สมชาย ใจดี" → first_name = "สมชาย"

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'queues' AND column_name = 'first_name'
  ) THEN
    ALTER TABLE queues ADD COLUMN first_name TEXT;
    RAISE NOTICE 'Added queues.first_name column';
  ELSE
    RAISE NOTICE 'queues.first_name already exists - skipping';
  END IF;
END $$;


-- ═══════════════════════════════════════════════════════════════════
-- SECTION 3: QUEUE UNIQUE CONSTRAINT + INDEXES
-- ═══════════════════════════════════════════════════════════════════

-- 3A. Unique constraint on (clinic_id, queue_date, number)
DO $$
DECLARE
  v_constraint_exists BOOLEAN;
  v_index_exists BOOLEAN;
  v_duplicate_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_duplicate_count
  FROM (
    SELECT clinic_id, queue_date, number, COUNT(*) AS cnt
    FROM queues
    GROUP BY clinic_id, queue_date, number
    HAVING COUNT(*) > 1
  ) duplicates;

  IF v_duplicate_count > 0 THEN
    RAISE WARNING 'Found % duplicate queue numbers — constraint not created', v_duplicate_count;
  ELSE
    SELECT EXISTS(
      SELECT 1 FROM pg_constraint
      WHERE conrelid = 'queues'::regclass
        AND contype = 'u'
        AND pg_get_constraintdef(oid) LIKE '%clinic_id%'
        AND pg_get_constraintdef(oid) LIKE '%queue_date%'
        AND pg_get_constraintdef(oid) LIKE '%number%'
    ) INTO v_constraint_exists;

    SELECT EXISTS(
      SELECT 1 FROM pg_indexes
      WHERE tablename = 'queues'
        AND schemaname = 'public'
        AND indexdef LIKE '%UNIQUE%'
        AND indexdef LIKE '%clinic_id%'
        AND indexdef LIKE '%queue_date%'
        AND indexdef LIKE '%number%'
    ) INTO v_index_exists;

    IF NOT v_constraint_exists AND NOT v_index_exists THEN
      CREATE UNIQUE INDEX idx_queues_clinic_date_number_unique
      ON queues (clinic_id, queue_date, number);
      RAISE NOTICE 'Created unique index idx_queues_clinic_date_number_unique';
    ELSE
      RAISE NOTICE 'Unique constraint/index on queues already exists - skipping';
    END IF;
  END IF;
END $$;

-- 3B. Performance indexes (IF NOT EXISTS)
DO $$
DECLARE
  v_index_name TEXT;
BEGIN
  v_index_name := 'idx_queues_clinic_date';
  IF NOT EXISTS(SELECT 1 FROM pg_indexes WHERE indexname = v_index_name) THEN
    EXECUTE format('CREATE INDEX %I ON queues (clinic_id, queue_date)', v_index_name);
  END IF;

  v_index_name := 'idx_queues_clinic_date_status';
  IF NOT EXISTS(SELECT 1 FROM pg_indexes WHERE indexname = v_index_name) THEN
    EXECUTE format('CREATE INDEX %I ON queues (clinic_id, queue_date, status)', v_index_name);
  END IF;
END $$;


-- ═══════════════════════════════════════════════════════════════════
-- SECTION 4: CLINICS.CODE COLUMN
-- ═══════════════════════════════════════════════════════════════════
-- Stable unique short code for username prefixes (e.g. SM4827).
-- Generated at clinic creation time. Never changes.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'clinics' AND column_name = 'code'
  ) THEN
    ALTER TABLE clinics ADD COLUMN code TEXT;
    RAISE NOTICE 'Added clinics.code column';
  ELSE
    RAISE NOTICE 'clinics.code already exists - skipping';
  END IF;
END $$;

-- Unique index (partial — only non-NULL codes)
CREATE UNIQUE INDEX IF NOT EXISTS idx_clinics_code_unique
  ON clinics (code) WHERE code IS NOT NULL;

-- Seed existing clinics with deterministic codes (only if code IS NULL)
DO $$
DECLARE
  r RECORD;
  v_suffix TEXT;
BEGIN
  FOR r IN SELECT id FROM clinics WHERE code IS NULL LOOP
    -- Generate 4-char suffix from MD5 of id for deterministic uniqueness
    v_suffix := upper(substring(md5(r.id) FROM 1 FOR 4));
    UPDATE clinics SET code = 'CL' || v_suffix WHERE id = r.id;
  END LOOP;
  RAISE NOTICE 'Seeded clinics.code for existing clinics';
END $$;


-- ═══════════════════════════════════════════════════════════════════
-- SECTION 5: STAFF_USERNAMES TABLE
-- ═══════════════════════════════════════════════════════════════════
-- Server-side username → auth user_id mapping.
-- Client NEVER reads this table directly.

CREATE TABLE IF NOT EXISTS staff_usernames (
  id           TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  clinic_id    TEXT NOT NULL,
  username     TEXT NOT NULL,
  user_id      TEXT NOT NULL,

  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT fk_staff_usernames_clinic
    FOREIGN KEY (clinic_id)
    REFERENCES clinics(id)
    ON DELETE CASCADE
    ON UPDATE CASCADE
);

-- Unique: one username per clinic
CREATE UNIQUE INDEX IF NOT EXISTS idx_staff_usernames_clinic_username
  ON staff_usernames (clinic_id, username);

-- Fast lookup by username (used by login resolver)
CREATE INDEX IF NOT EXISTS idx_staff_usernames_username
  ON staff_usernames (username);

-- RLS: service role only, no client access
ALTER TABLE staff_usernames ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  -- Drop existing policies if any (idempotent)
  DROP POLICY IF EXISTS "Service role full access" ON staff_usernames;
  
  CREATE POLICY "Service role full access" ON staff_usernames
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);
END $$;


-- ═══════════════════════════════════════════════════════════════════
-- SECTION 6: POST-MIGRATION VERIFICATION
-- ═══════════════════════════════════════════════════════════════════

DO $$
DECLARE
  v_func_count INTEGER;
  v_col_exists BOOLEAN;
BEGIN
  -- Verify functions exist
  SELECT COUNT(*) INTO v_func_count
  FROM pg_proc
  WHERE proname IN ('get_today_ict', 'get_next_queue_number', 'create_queue_item');

  IF v_func_count = 3 THEN
    RAISE NOTICE '✅ All 3 queue functions exist';
  ELSE
    RAISE WARNING '⚠️ Expected 3 queue functions, found %', v_func_count;
  END IF;

  -- Verify queues.first_name
  SELECT EXISTS(
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'queues' AND column_name = 'first_name'
  ) INTO v_col_exists;

  IF v_col_exists THEN
    RAISE NOTICE '✅ queues.first_name exists';
  ELSE
    RAISE WARNING '⚠️ queues.first_name missing';
  END IF;

  -- Verify clinics.code
  SELECT EXISTS(
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'clinics' AND column_name = 'code'
  ) INTO v_col_exists;

  IF v_col_exists THEN
    RAISE NOTICE '✅ clinics.code exists';
  ELSE
    RAISE WARNING '⚠️ clinics.code missing';
  END IF;

  -- Verify staff_usernames
  SELECT EXISTS(
    SELECT 1 FROM information_schema.tables
    WHERE table_name = 'staff_usernames' AND table_schema = 'public'
  ) INTO v_col_exists;

  IF v_col_exists THEN
    RAISE NOTICE '✅ staff_usernames table exists';
  ELSE
    RAISE WARNING '⚠️ staff_usernames table missing';
  END IF;

  RAISE NOTICE '═══ Migration 002 complete ═══';
END $$;
