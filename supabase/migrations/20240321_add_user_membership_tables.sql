-- ═══════════════════════════════════════════
-- Migration: Add User and Clinic Membership Tables
-- Date: 2024-03-21
-- Purpose: Implement User → Clinic Membership → Clinic + Role architecture
-- ═══════════════════════════════════════════

-- 1. Users table (ข้อมูลผู้ใช้)
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  phone TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Clinic Memberships table (ความสัมพันธ์ User ↔ Clinic ↔ Role)
CREATE TABLE IF NOT EXISTS clinic_memberships (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  clinic_id TEXT REFERENCES clinics(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('owner', 'manager', 'front_desk', 'practitioner')),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, clinic_id)
);

-- ═══ INDEXES ═══
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_clinic_memberships_user ON clinic_memberships(user_id);
CREATE INDEX IF NOT EXISTS idx_clinic_memberships_clinic ON clinic_memberships(clinic_id);
CREATE INDEX IF NOT EXISTS idx_clinic_memberships_user_clinic ON clinic_memberships(user_id, clinic_id);

-- ═══ RLS (Row Level Security) ═══
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE clinic_memberships ENABLE ROW LEVEL SECURITY;

-- ═══ RLS Policies for Users ═══
-- Users can read their own profile
CREATE POLICY "Users can read own profile" ON users
  FOR SELECT USING (auth.uid() = id);

-- Users can update their own profile
CREATE POLICY "Users can update own profile" ON users
  FOR UPDATE USING (auth.uid() = id);

-- ═══ RLS Policies for Clinic Memberships ═══
-- Users can read their own memberships
CREATE POLICY "Users can read own memberships" ON clinic_memberships
  FOR SELECT USING (user_id = auth.uid());

-- Clinic owners can read all memberships in their clinic
CREATE POLICY "Clinic owners can read clinic memberships" ON clinic_memberships
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM clinic_memberships cm
      WHERE cm.user_id = auth.uid()
      AND cm.clinic_id = clinic_memberships.clinic_id
      AND cm.role = 'owner'
    )
  );

-- Clinic owners can insert memberships in their clinic
CREATE POLICY "Clinic owners can add members" ON clinic_memberships
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM clinic_memberships cm
      WHERE cm.user_id = auth.uid()
      AND cm.clinic_id = clinic_memberships.clinic_id
      AND cm.role = 'owner'
    )
  );

-- Clinic owners can update memberships in their clinic
CREATE POLICY "Clinic owners can update members" ON clinic_memberships
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM clinic_memberships cm
      WHERE cm.user_id = auth.uid()
      AND cm.clinic_id = clinic_memberships.clinic_id
      AND cm.role = 'owner'
    )
  );

-- Clinic owners can delete memberships in their clinic
CREATE POLICY "Clinic owners can remove members" ON clinic_memberships
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM clinic_memberships cm
      WHERE cm.user_id = auth.uid()
      AND cm.clinic_id = clinic_memberships.clinic_id
      AND cm.role = 'owner'
    )
  );

-- ═══ Function to check membership ═══
CREATE OR REPLACE FUNCTION check_clinic_membership(user_uuid UUID, clinic_id_param TEXT)
RETURNS TEXT AS $$
DECLARE
  user_role TEXT;
BEGIN
  SELECT role INTO user_role
  FROM clinic_memberships
  WHERE user_id = user_uuid
    AND clinic_id = clinic_id_param
    AND is_active = true;
  
  RETURN user_role;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ═══ Function to get user's clinics ═══
CREATE OR REPLACE FUNCTION get_user_clinics(user_uuid UUID)
RETURNS TABLE(clinic_id TEXT, role TEXT) AS $$
BEGIN
  RETURN QUERY
  SELECT cm.clinic_id, cm.role
  FROM clinic_memberships cm
  WHERE cm.user_id = user_uuid
    AND cm.is_active = true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ═══ Grant permissions ═══
GRANT SELECT ON users TO authenticated;
GRANT UPDATE ON users TO authenticated;
GRANT SELECT ON clinic_memberships TO authenticated;
GRANT INSERT ON clinic_memberships TO authenticated;
GRANT UPDATE ON clinic_memberships TO authenticated;
GRANT DELETE ON clinic_memberships TO authenticated;
GRANT EXECUTE ON FUNCTION check_clinic_membership TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_clinics TO authenticated;

-- ═══ Create demo data (optional - for testing) ═══
-- Note: In production, users will be created via Supabase Auth

-- Demo users (these would normally be created via Supabase Auth)
INSERT INTO users (id, email, name, phone) VALUES
  ('11111111-1111-1111-1111-111111111111', 'admin@clinicq.com', 'Admin System', NULL),
  ('11111111-1111-1111-1111-222222222222', 'owner@dental.com', 'สมศักดิ์ เจ้าของคลินิก', '081-111-1111'),
  ('11111111-1111-1111-1111-444444444444', 'doctor1@dental.com', 'ทพ.สมบูรณ์ สุขใจ', '084-444-4444'),
  ('11111111-1111-1111-1111-555555555555', 'doctor2@dental.com', 'ทพ.วิชัย มั่นคง', '085-555-5555'),
  ('11111111-1111-1111-1111-666666666666', 'staff1@dental.com', 'สมหญิง เจ้าหน้าที่', '086-666-6666')
ON CONFLICT (email) DO NOTHING;

-- Demo memberships
INSERT INTO clinic_memberships (user_id, clinic_id, role, is_active) VALUES
  -- Dental clinic
  ('11111111-1111-1111-1111-222222222222', 'clinic-dental', 'owner', true),
  ('11111111-1111-1111-1111-444444444444', 'clinic-dental', 'practitioner', true),
  ('11111111-1111-1111-1111-555555555555', 'clinic-dental', 'practitioner', true),
  ('11111111-1111-1111-1111-666666666666', 'clinic-dental', 'front_desk', true)
ON CONFLICT (user_id, clinic_id) DO NOTHING;
