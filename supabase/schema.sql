-- ═══════════════════════════════════════════
-- Clinic-Q Database Schema for Supabase
-- ═══════════════════════════════════════════

-- 1. Clinics (คลินิก)
CREATE TABLE IF NOT EXISTS clinics (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL, -- dental, medical, aesthetic, thai, chinese, physical
  color TEXT DEFAULT '#E91E63',
  icon TEXT DEFAULT '🏥',
  prefix TEXT DEFAULT 'Q',
  address TEXT,
  phone TEXT,
  latitude DECIMAL(10, 8),
  longitude DECIMAL(11, 8),
  max_distance_meters INTEGER DEFAULT 500,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Branches (สาขา/ความเชี่ยวชาญ)
CREATE TABLE IF NOT EXISTS branches (
  id TEXT PRIMARY KEY,
  clinic_id TEXT NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT DEFAULT '#93C5FD',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Procedures (รายการหัตถการ)
CREATE TABLE IF NOT EXISTS procedures (
  id TEXT PRIMARY KEY,
  branch_id TEXT NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  default_duration_minutes INTEGER DEFAULT 30,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Practitioners (ผู้ทำหัตถการ)
CREATE TABLE IF NOT EXISTS practitioners (
  id TEXT PRIMARY KEY,
  clinic_id TEXT NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  phone TEXT,
  role TEXT DEFAULT 'practitioner', -- practitioner, admin
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Practitioner-Branch mapping (ผู้ทำหัตถการรับผิดชอบสาขา)
CREATE TABLE IF NOT EXISTS practitioner_branches (
  id SERIAL PRIMARY KEY,
  practitioner_id TEXT NOT NULL REFERENCES practitioners(id) ON DELETE CASCADE,
  branch_id TEXT NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  UNIQUE(practitioner_id, branch_id)
);

-- 6. Rooms (ห้องตรวจ)
CREATE TABLE IF NOT EXISTS rooms (
  id SERIAL PRIMARY KEY,
  clinic_id TEXT NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT DEFAULT '#93C5FD',
  image_url TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. Room Assignments (การจัดห้องวันนี้ - who works in which room today)
CREATE TABLE IF NOT EXISTS room_assignments (
  id SERIAL PRIMARY KEY,
  clinic_id TEXT NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  room_id INTEGER NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  practitioner_id TEXT NOT NULL REFERENCES practitioners(id) ON DELETE CASCADE,
  branch_id TEXT NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  slot_minutes INTEGER DEFAULT 30,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(clinic_id, room_id, practitioner_id, date)
);

-- 8. Queues (คิว)
CREATE TABLE IF NOT EXISTS queues (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  clinic_id TEXT NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  number TEXT NOT NULL,
  patient_name TEXT NOT NULL,
  phone TEXT,
  procedure TEXT NOT NULL,
  procedure_id TEXT,
  branch_id TEXT,
  booking_mode TEXT DEFAULT 'walkin', -- walkin, remote, appointment
  assigned_room INTEGER REFERENCES rooms(id),
  assigned_doctor TEXT,
  status TEXT DEFAULT 'waiting', -- waiting, serving, completed
  time TEXT,
  booked_at TIMESTAMPTZ DEFAULT NOW(),
  arrival_time TEXT,
  arrived BOOLEAN DEFAULT false,
  arrived_at TIMESTAMPTZ,
  serving_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  total_duration INTEGER, -- minutes
  queue_date DATE DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 9. Completed Procedures (หัตถการที่ทำเสร็จแต่ละคน)
CREATE TABLE IF NOT EXISTS completed_procedures (
  id SERIAL PRIMARY KEY,
  queue_id TEXT NOT NULL REFERENCES queues(id) ON DELETE CASCADE,
  procedure_id TEXT,
  name TEXT NOT NULL,
  quantity INTEGER DEFAULT 1,
  difficulty TEXT DEFAULT 'medium',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 10. Schedule (ตารางเวร)
CREATE TABLE IF NOT EXISTS schedules (
  id SERIAL PRIMARY KEY,
  clinic_id TEXT NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  practitioner_id TEXT NOT NULL REFERENCES practitioners(id) ON DELETE CASCADE,
  branch_id TEXT NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  room_id INTEGER REFERENCES rooms(id),
  date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  slot_minutes INTEGER DEFAULT 30,
  is_recurring BOOLEAN DEFAULT false,
  recurring_days TEXT, -- mon,tue,wed,thu,fri,sat,sun
  status TEXT DEFAULT 'active', -- active, leave_pending, leave_approved, cancelled
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 11. Leave Requests (การขอลา)
CREATE TABLE IF NOT EXISTS leave_requests (
  id SERIAL PRIMARY KEY,
  clinic_id TEXT NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  practitioner_id TEXT NOT NULL REFERENCES practitioners(id) ON DELETE CASCADE,
  leave_date DATE NOT NULL,
  reason TEXT,
  status TEXT DEFAULT 'pending', -- pending, approved, rejected
  approved_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ═══ INDEXES ═══
CREATE INDEX IF NOT EXISTS idx_queues_clinic_date ON queues(clinic_id, queue_date);
CREATE INDEX IF NOT EXISTS idx_queues_status ON queues(status);
CREATE INDEX IF NOT EXISTS idx_room_assignments_date ON room_assignments(clinic_id, date);
CREATE INDEX IF NOT EXISTS idx_schedules_date ON schedules(clinic_id, date);

-- ═══ Realtime for queues ═══
ALTER PUBLICATION supabase_realtime ADD TABLE queues;

-- ═══ RLS (Row Level Security) ═══
ALTER TABLE queues ENABLE ROW LEVEL SECURITY;
ALTER TABLE clinics ENABLE ROW LEVEL SECURITY;
ALTER TABLE rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE practitioners ENABLE ROW LEVEL SECURITY;

-- Allow public read for queues (for /track page)
CREATE POLICY "Allow public read queues" ON queues
  FOR SELECT USING (true);

-- Allow public insert for queues (for walk-in registration)
CREATE POLICY "Allow public insert queues" ON queues
  FOR INSERT WITH CHECK (true);

-- Allow public update for queues (for status changes)
CREATE POLICY "Allow public update queues" ON queues
  FOR UPDATE USING (true);

-- Allow public read for clinics
CREATE POLICY "Allow public read clinics" ON clinics
  FOR SELECT USING (true);

-- Allow public read for rooms
CREATE POLICY "Allow public read rooms" ON rooms
  FOR SELECT USING (true);

-- Allow public read for practitioners
CREATE POLICY "Allow public read practitioners" ON practitioners
  FOR SELECT USING (true);
