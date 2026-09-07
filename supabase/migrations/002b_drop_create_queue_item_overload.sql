-- Fix: Drop duplicate create_queue_item overload
-- Problem: Two versions exist — one with p_distance_from_clinic INTEGER, one with NUMERIC
-- The NUMERIC version is correct (matches MIGRATION_PHASE_1.sql)
-- Drop the INTEGER version to resolve ambiguity

DO $$
DECLARE
  v_count INTEGER;
BEGIN
  -- Count how many overloads exist
  SELECT COUNT(*) INTO v_count
  FROM pg_proc
  WHERE proname = 'create_queue_item'
    AND pronamespace = 'public'::regnamespace;

  RAISE NOTICE 'Found % overloads of create_queue_item', v_count;

  IF v_count > 1 THEN
    -- Drop the INTEGER version (keep the NUMERIC one)
    -- We identify it by checking the parameter type of the last param
    DROP FUNCTION IF EXISTS public.create_queue_item(
      TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT,
      INTEGER, TEXT, DATE, TEXT, BOOLEAN, TEXT,
      TEXT, DATE, BOOLEAN, INTEGER, TEXT, TEXT, INTEGER
    );
    RAISE NOTICE 'Dropped INTEGER overload of create_queue_item';
  ELSE
    RAISE NOTICE 'Only one overload exists - no cleanup needed';
  END IF;

  -- Verify only one remains
  SELECT COUNT(*) INTO v_count
  FROM pg_proc
  WHERE proname = 'create_queue_item'
    AND pronamespace = 'public'::regnamespace;

  RAISE NOTICE 'Remaining overloads: %', v_count;
END $$;
