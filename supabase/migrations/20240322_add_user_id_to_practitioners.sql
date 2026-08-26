-- ═══════════════════════════════════════════
-- Migration: Add user_id to practitioners table
-- Date: 2024-03-22
-- Purpose: Link practitioners to auth users for User-Practitioner architecture
-- ═══════════════════════════════════════════

-- 1. Add user_id column to practitioners (NULLABLE for backward compatibility)
ALTER TABLE practitioners 
ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- 2. Create unique index for user_id + clinic_id (prevent duplicate practitioner records)
-- Only for non-null user_id values
CREATE UNIQUE INDEX IF NOT EXISTS idx_practitioners_user_clinic 
  ON practitioners(user_id, clinic_id) 
  WHERE user_id IS NOT NULL;

-- 3. Add comment to explain the relationship
COMMENT ON COLUMN practitioners.user_id IS 
  'Optional link to auth.users.id for practitioners who have login accounts. NULL for legacy practitioners without accounts.';

-- 4. Verify the change
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'practitioners' 
    AND column_name = 'user_id'
  ) THEN
    RAISE NOTICE 'SUCCESS: user_id column added to practitioners table';
  ELSE
    RAISE WARNING 'FAILED: user_id column not found in practitioners table';
  END IF;
END $$;
