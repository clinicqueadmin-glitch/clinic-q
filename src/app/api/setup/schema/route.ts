import { NextResponse } from 'next/server'

export async function GET() {
  const sql = `-- ═══ Clinic-Q Schema for Supabase ═══
-- Copy this entire SQL and paste into Supabase SQL Editor, then press Run

-- 1. Clinics
CREATE TABLE IF NOT EXISTS clinics (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  color TEXT DEFAULT '#E91E63',
  icon TEXT DEFAULT '🏥',
  prefix TEXT DEFAULT 'Q',
  address TEXT,
  phone TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Branches
CREATE TABLE IF NOT EXISTS branches (
  id TEXT PRIMARY KEY,
  clinic_id TEXT NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT DEFAULT '#93C5FD',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Procedures
CREATE TABLE IF NOT EXISTS procedures (
  id TEXT PRIMARY KEY,
  branch_id TEXT NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  default_duration_minutes INTEGER DEFAULT 30,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Practitioners
CREATE TABLE IF NOT EXISTS practitioners (
  id TEXT PRIMARY KEY,
  clinic_id TEXT NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  phone TEXT,
  role TEXT DEFAULT 'practitioner',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Rooms
CREATE TABLE IF NOT EXISTS rooms (
  id SERIAL PRIMARY KEY,
  clinic_id TEXT NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT DEFAULT '#93C5FD',
  image_url TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. Queues
CREATE TABLE IF NOT EXISTS queues (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  clinic_id TEXT NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  number TEXT NOT NULL,
  patient_name TEXT NOT NULL,
  phone TEXT,
  procedure TEXT NOT NULL,
  procedure_id TEXT,
  branch_id TEXT,
  booking_mode TEXT DEFAULT 'walkin',
  assigned_room INTEGER,
  assigned_doctor TEXT,
  status TEXT DEFAULT 'waiting',
  time TEXT,
  booked_at TIMESTAMPTZ DEFAULT NOW(),
  arrival_time TEXT,
  arrived BOOLEAN DEFAULT false,
  arrived_at TIMESTAMPTZ,
  serving_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  total_duration INTEGER,
  queue_date DATE DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. Completed Procedures
CREATE TABLE IF NOT EXISTS completed_procedures (
  id SERIAL PRIMARY KEY,
  queue_id TEXT NOT NULL REFERENCES queues(id) ON DELETE CASCADE,
  procedure_id TEXT,
  name TEXT NOT NULL,
  quantity INTEGER DEFAULT 1,
  difficulty TEXT DEFAULT 'medium',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_queues_clinic_date ON queues(clinic_id, queue_date);
CREATE INDEX IF NOT EXISTS idx_queues_status ON queues(status);

-- RLS Policies (allow all for demo)
ALTER TABLE queues ENABLE ROW LEVEL SECURITY;
ALTER TABLE clinics ENABLE ROW LEVEL SECURITY;
ALTER TABLE rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE practitioners ENABLE ROW LEVEL SECURITY;
ALTER TABLE branches ENABLE ROW LEVEL SECURITY;
ALTER TABLE procedures ENABLE ROW LEVEL SECURITY;
ALTER TABLE completed_procedures ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all" ON queues FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON clinics FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON rooms FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON practitioners FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON branches FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON procedures FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON completed_procedures FOR ALL USING (true) WITH CHECK (true);

-- Enable realtime for queues
ALTER PUBLICATION supabase_realtime ADD TABLE queues;

-- ═══ Seed Demo Data ═══
INSERT INTO clinics (id, name, type, color, icon, prefix) VALUES
  ('clinic-dental', 'คลินิกทันตกรรม', 'dental', '#E91E63', '🦷', 'E'),
  ('clinic-medical', 'คลินิกเวชกรรม', 'medical', '#2196F3', '🩺', 'A'),
  ('clinic-aesthetic', 'คลินิกเสริมความงาม', 'aesthetic', '#9C27B0', '✨', 'B'),
  ('clinic-thai', 'แพทย์แผนไทย', 'thai', '#4CAF50', '🌿', 'C'),
  ('clinic-chinese', 'แพทย์แผนจีน', 'chinese', '#FF9800', '🔮', 'D'),
  ('clinic-physical', 'คลินิกกายภาพบำบัด', 'physical', '#00BCD4', '💪', 'F')
ON CONFLICT (id) DO NOTHING;

INSERT INTO rooms (clinic_id, name, color) VALUES
  ('clinic-dental', 'ห้อง 1', '#93C5FD'),
  ('clinic-dental', 'ห้อง 2', '#A7F3D0'),
  ('clinic-dental', 'ห้อง 3', '#FCD34D'),
  ('clinic-dental', 'ห้อง 4', '#FDA4AF'),
  ('clinic-dental', 'ห้อง 5', '#D8B4FE')
ON CONFLICT DO NOTHING;

-- Demo queue for dental clinic
INSERT INTO queues (clinic_id, number, patient_name, phone, procedure, booking_mode, assigned_room, assigned_doctor, status, time, arrived, arrived_at, serving_at, queue_date) VALUES
  ('clinic-dental', 'E024', 'สมชาย ใจดี', '081-234-5678', 'ขูดหินปูน', 'walkin', 1, 'ทพ.สมบูรณ์ สุขใจ', 'serving', '09:15', true, NOW(), NOW() - interval '25 minutes', CURRENT_DATE),
  ('clinic-dental', 'E025', 'สมหญิง รักสวย', '082-345-6789', 'จัดฟัน', 'walkin', 2, 'ทพ.วิชัย มั่นคง', 'serving', '09:30', true, NOW(), NOW() - interval '40 minutes', CURRENT_DATE),
  ('clinic-dental', 'E026', 'วิชัย มั่นคง', '083-456-7890', 'อุดฟัน', 'walkin', 1, 'ทพ.สมบูรณ์ สุขใจ', 'waiting', '09:45', true, NOW(), NULL, CURRENT_DATE),
  ('clinic-dental', 'E027', 'ธนากร เจริญสุข', '084-567-8901', 'ผ่าตัดฟันคุด', 'walkin', 3, 'ทพ.สมพงษ์ กล้าแข็ง', 'waiting', '09:00', true, NOW(), NULL, CURRENT_DATE),
  ('clinic-dental', 'E028', 'พิมพ์ใจ สดใส', '085-678-9012', 'ฟอกสีฟัน', 'walkin', 1, 'ทพ.สมบูรณ์ สุขใจ', 'completed', '08:30', true, NOW(), NOW() - interval '60 minutes', CURRENT_DATE)
ON CONFLICT DO NOTHING;

SELECT '✅ Schema created and demo data seeded!' as result;`

  return new NextResponse(sql, {
    headers: {
      'Content-Type': 'text/plain',
      'Content-Disposition': 'inline; filename="clinic-q-schema.sql"',
    },
  })
}
