-- ═══════════════════════════════════════════
-- Clinic-Q Auth & Membership System
-- ═══════════════════════════════════════════

-- 1. Users (linked to Supabase Auth)
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  phone TEXT,
  force_password_change BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Clinic Memberships (User ↔ Clinic ↔ Role)
CREATE TABLE IF NOT EXISTS clinic_memberships (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  clinic_id TEXT NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('owner', 'manager', 'front_desk', 'practitioner')),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, clinic_id, role)
);

-- 3. Practitioners (Practitioner profile in each clinic)
CREATE TABLE IF NOT EXISTS practitioners (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  clinic_id TEXT NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  branch_ids TEXT[] DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. User Passwords (hashed - for demo only, Supabase Auth handles real passwords)
CREATE TABLE IF NOT EXISTS user_passwords (
  email TEXT PRIMARY KEY,
  password_hash TEXT NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_memberships_user ON clinic_memberships(user_id);
CREATE INDEX IF NOT EXISTS idx_memberships_clinic ON clinic_memberships(clinic_id);
CREATE INDEX IF NOT EXISTS idx_practitioners_user ON practitioners(user_id);
CREATE INDEX IF NOT EXISTS idx_practitioners_clinic ON practitioners(clinic_id);

-- RLS
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE clinic_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE practitioners ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_passwords ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all users" ON users FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all memberships" ON clinic_memberships FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all practitioners" ON practitioners FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all passwords" ON user_passwords FOR ALL USING (true) WITH CHECK (true);

-- ═══ Clean up demo data ═══
-- Delete old demo queues (keep structure)
DELETE FROM completed_procedures;
DELETE FROM queues;

-- Delete old demo rooms
DELETE FROM rooms;

-- Keep clinics as they are (user will register their own)
