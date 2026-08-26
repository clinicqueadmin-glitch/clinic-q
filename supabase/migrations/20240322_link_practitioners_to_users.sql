-- ═══════════════════════════════════════════
-- Migration: Link existing practitioners to users
-- Date: 2024-03-22
-- Purpose: Create user accounts for practitioners who don't have them
--          and create memberships for all practitioners
-- ═══════════════════════════════════════════

-- WARNING: This script creates new users and memberships
-- Only run this after reviewing the existing data

-- Step 1: Create users for practitioners who don't have accounts
-- (Only if you want practitioners to have login access)
DO $$
DECLARE
  practitioner_record RECORD;
  new_user_id UUID;
  user_email TEXT;
BEGIN
  FOR practitioner_record IN 
    SELECT id, first_name, last_name, phone, clinic_id
    FROM practitioners
    WHERE user_id IS NULL
  LOOP
    -- Generate email from name (lowercase, no spaces)
    user_email := LOWER(
      REPLACE(
        practitioner_record.first_name || '.' || practitioner_record.last_name, 
        ' ', ''
      )
    ) || '@clinicq.local';
    
    -- Create user
    INSERT INTO auth.users (
      email,
      encrypted_password,
      email_confirmed_at,
      created_at,
      updated_at
    ) VALUES (
      user_email,
      crypt('default123', gen_salt('bf')),
      NOW(),
      NOW(),
      NOW()
    )
    ON CONFLICT (email) DO NOTHING
    RETURNING id INTO new_user_id;
    
    -- If user was created, update practitioner
    IF new_user_id IS NOT NULL THEN
      UPDATE practitioners 
      SET user_id = new_user_id 
      WHERE id = practitioner_record.id;
      
      -- Create membership
      INSERT INTO clinic_memberships (user_id, clinic_id, role, is_active)
      VALUES (new_user_id, practitioner_record.clinic_id, 'practitioner', true)
      ON CONFLICT (user_id, clinic_id) DO NOTHING;
      
      RAISE NOTICE 'Created user % for practitioner % %', 
        new_user_id, practitioner_record.first_name, practitioner_record.last_name;
    END IF;
  END LOOP;
END $$;

-- Step 2: Create memberships for practitioners who have users but no membership
INSERT INTO clinic_memberships (user_id, clinic_id, role, is_active)
SELECT p.user_id, p.clinic_id, 'practitioner', p.is_active
FROM practitioners p
WHERE p.user_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM clinic_memberships cm
    WHERE cm.user_id = p.user_id 
      AND cm.clinic_id = p.clinic_id
  )
ON CONFLICT (user_id, clinic_id) DO NOTHING;

-- Step 3: Create users for clinic owners who don't have accounts
DO $$
DECLARE
  clinic_record RECORD;
  owner_user_id UUID;
  owner_email TEXT;
BEGIN
  FOR clinic_record IN 
    SELECT id, name, type
    FROM clinics
  LOOP
    -- Generate owner email
    owner_email := 'owner@' || clinic_record.type || '.com';
    
    -- Create user if not exists
    INSERT INTO auth.users (
      email,
      encrypted_password,
      email_confirmed_at,
      created_at,
      updated_at
    ) VALUES (
      owner_email,
      crypt('owner123', gen_salt('bf')),
      NOW(),
      NOW(),
      NOW()
    )
    ON CONFLICT (email) DO NOTHING
    RETURNING id INTO owner_user_id;
    
    -- Get existing user if not created
    IF owner_user_id IS NULL THEN
      SELECT id INTO owner_user_id FROM auth.users WHERE email = owner_email;
    END IF;
    
    -- Create membership for owner
    IF owner_user_id IS NOT NULL THEN
      INSERT INTO clinic_memberships (user_id, clinic_id, role, is_active)
      VALUES (owner_user_id, clinic_record.id, 'owner', true)
      ON CONFLICT (user_id, clinic_id) DO NOTHING;
    END IF;
  END LOOP;
END $$;

-- Step 4: Verify the migration
DO $$
BEGIN
  RAISE NOTICE 'Migration completed:';
  RAISE NOTICE '  - Practitioners with user_id: %', 
    (SELECT COUNT(*) FROM practitioners WHERE user_id IS NOT NULL);
  RAISE NOTICE '  - Practitioners without user_id: %', 
    (SELECT COUNT(*) FROM practitioners WHERE user_id IS NULL);
  RAISE NOTICE '  - Total memberships: %', 
    (SELECT COUNT(*) FROM clinic_memberships);
END $$;
