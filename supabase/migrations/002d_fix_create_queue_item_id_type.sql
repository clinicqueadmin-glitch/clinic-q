-- ============================================================
-- Migration 002d: Fix create_queue_item id type mismatch
-- Date: 2026-09-07
-- Root cause:
--   queues.id is TEXT in the database, but create_queue_item()
--   declared v_queue_id as UUID and RETURNS TABLE(id UUID).
--   The WHERE q.id = v_queue_id comparison caused:
--   "42883: operator does not exist: text = uuid"
--
-- Fix:
--   1. DROP old function (same input param signature)
--   2. CREATE new function with:
--      - v_queue_id TEXT (was UUID)
--      - gen_random_uuid()::text (was gen_random_uuid())
--      - RETURNS TABLE(id TEXT, ...) (was id UUID)
--   3. GRANT EXECUTE to anon, authenticated
--
-- Preserved:
--   - All 20 input parameters (names, types, defaults)
--   - Queue number generation via get_next_queue_number()
--   - INSERT columns and values
--   - RETURN QUERY logic
--   - All validation checks
--   - Advisory lock behavior
-- ============================================================

-- ── STEP 1: DROP old function with exact input param signature ──
DROP FUNCTION IF EXISTS create_queue_item(
  TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT,
  INTEGER, TEXT, DATE, TEXT, BOOLEAN, TEXT,
  TEXT, DATE, BOOLEAN, INTEGER, TEXT, TEXT, NUMERIC
);

-- ── STEP 2: CREATE corrected function ──
CREATE FUNCTION create_queue_item(
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
  id TEXT,
  number TEXT,
  clinic_id TEXT,
  queue_date DATE,
  status TEXT
)
LANGUAGE plpgsql
AS $$
DECLARE
  v_queue_number TEXT;
  v_queue_id TEXT;
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

  -- Generate UUID as TEXT (queues.id is TEXT column)
  v_queue_id := gen_random_uuid()::text;

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

-- ── STEP 3: GRANT EXECUTE to anon and authenticated ──
GRANT EXECUTE ON FUNCTION public.create_queue_item(
  TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT,
  INTEGER, TEXT, DATE, TEXT, BOOLEAN, TEXT,
  TEXT, DATE, BOOLEAN, INTEGER, TEXT, TEXT, NUMERIC
) TO anon, authenticated;

-- ── STEP 4: Verify exactly 1 overload remains ──
DO $$
DECLARE
  v_count INTEGER;
  v_sig TEXT;
BEGIN
  SELECT COUNT(*) INTO v_count
  FROM pg_proc
  WHERE proname = 'create_queue_item'
    AND pronamespace = 'public'::regnamespace;

  IF v_count = 1 THEN
    SELECT pg_get_function_identity_arguments(oid) INTO v_sig
    FROM pg_proc
    WHERE proname = 'create_queue_item'
      AND pronamespace = 'public'::regnamespace;
    RAISE NOTICE '✅ Final overload: create_queue_item(%)', v_sig;
  ELSIF v_count = 0 THEN
    RAISE EXCEPTION '❌ No create_queue_item overloads remain';
  ELSE
    RAISE WARNING '⚠️ % overloads still exist — manual cleanup needed', v_count;
  END IF;
END $$;

-- ── STEP 5: Verify GRANT ──
DO $$
DECLARE
  v_exec_count INTEGER;
BEGIN
  SELECT COUNT(*)
  INTO v_exec_count
  FROM information_schema.role_routine_grants r
  WHERE r.routine_schema = 'public'
    AND r.routine_name = 'create_queue_item'
    AND r.grantee IN ('anon', 'authenticated')
    AND r.privilege_type = 'EXECUTE';

  IF v_exec_count = 0 THEN
    RAISE EXCEPTION
      'create_queue_item exists but EXECUTE grant for anon/authenticated is missing';
  ELSE
    RAISE NOTICE
      'EXECUTE grant verified: % grant(s)', v_exec_count;
  END IF;
END
$$;
