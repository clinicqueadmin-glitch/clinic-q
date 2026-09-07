-- ============================================================
-- Migration 002c: Fix create_queue_item overload + permissions
-- Date: 2026-09-07
-- Purpose:
--   1. Drop stale create_queue_item(UUID, ...) overload
--   2. Grant EXECUTE to anon + authenticated roles
--
-- Evidence:
--   - Runtime test: service role RPC returns 42883 "text = uuid"
--   - Runtime test: anon RPC returns 404 (no GRANT)
--   - Migration 002 created TEXT/NUMERIC version via CREATE OR REPLACE
--     but the old UUID version was NOT replaced (different param types)
--   - Migration 002b only dropped INTEGER/NUMERIC overload
--
-- Safety:
--   - Uses dynamic DROP that only targets functions with UUID as
--     first parameter (proargtypes[1] = uuid)
--   - Uses pg_get_function_identity_arguments for exact signature
--   - Does NOT touch the TEXT/NUMERIC version (the current one)
--   - DROP IF EXISTS is idempotent
-- ============================================================

-- ── STEP 1: Drop the stale UUID-typed overload ──
DO $$
DECLARE
  v_sig TEXT;
  v_count INTEGER;
BEGIN
  -- Count total overloads before cleanup
  SELECT COUNT(*) INTO v_count
  FROM pg_proc
  WHERE proname = 'create_queue_item'
    AND pronamespace = 'public'::regnamespace;

  RAISE NOTICE 'Overloads before cleanup: %', v_count;

  -- Find the overload where the FIRST parameter is UUID (the stale one)
  -- proargtypes is an array of type OIDs; proargtypes[1] = first param type
  SELECT pg_get_function_identity_arguments(oid) INTO v_sig
  FROM pg_proc
  WHERE proname = 'create_queue_item'
    AND pronamespace = 'public'::regnamespace
    AND proargtypes[1] = 'uuid'::regtype::oid
  LIMIT 1;

  IF v_sig IS NOT NULL THEN
    RAISE NOTICE 'Found UUID overload: create_queue_item(%)', v_sig;
    EXECUTE format('DROP FUNCTION IF EXISTS create_queue_item(%s)', v_sig);
    RAISE NOTICE 'Dropped UUID overload successfully';
  ELSE
    RAISE NOTICE 'No UUID overload found — already clean';
  END IF;

  -- Count overloads after cleanup
  SELECT COUNT(*) INTO v_count
  FROM pg_proc
  WHERE proname = 'create_queue_item'
    AND pronamespace = 'public'::regnamespace;

  RAISE NOTICE 'Overloads after cleanup: %', v_count;

  IF v_count != 1 THEN
    RAISE WARNING 'Expected exactly 1 overload but found %', v_count;
  END IF;
END $$;

-- ── STEP 2: Drop ALL INTEGER-distance overloads that may also exist ──
-- (Migration 002b tried this but with hardcoded types — be thorough)
DO $$
DECLARE
  v_sig TEXT;
BEGIN
  -- Find any overload where the LAST param is INTEGER (should be NUMERIC)
  SELECT pg_get_function_identity_arguments(oid) INTO v_sig
  FROM pg_proc
  WHERE proname = 'create_queue_item'
    AND pronamespace = 'public'::regnamespace
    AND proargtypes[array_length(proargtypes, 1)] = 'integer'::regtype::oid
  LIMIT 1;

  IF v_sig IS NOT NULL THEN
    RAISE NOTICE 'Found INTEGER-distance overload: create_queue_item(%)', v_sig;
    EXECUTE format('DROP FUNCTION IF EXISTS create_queue_item(%s)', v_sig);
    RAISE NOTICE 'Dropped INTEGER-distance overload';
  END IF;
END $$;

-- ── STEP 3: Verify exactly 1 overload remains ──
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
    RAISE EXCEPTION '❌ No create_queue_item overloads remain — something went wrong';
  ELSE
    RAISE WARNING '⚠️ % overloads still exist — manual cleanup may be needed', v_count;
  END IF;
END $$;

-- ── STEP 4: Grant EXECUTE to anon and authenticated ──
-- Only the remaining TEXT/NUMERIC version gets these grants
GRANT EXECUTE ON FUNCTION public.create_queue_item(
  TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT,
  INTEGER, TEXT, DATE, TEXT, BOOLEAN, TEXT,
  TEXT, DATE, BOOLEAN, INTEGER, TEXT, TEXT, NUMERIC
) TO anon, authenticated;

-- ── STEP 5: Verify GRANT applied ──
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
