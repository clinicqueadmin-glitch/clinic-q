-- ═══════════════════════════════════════════
-- Clinic-Q Database Setup for Supabase
-- คัดลอกทั้งหมดไปวางใน SQL Editor แล้วกด Run
-- ═══════════════════════════════════════════

-- 1. Clinics
CREATE TABLE IF NOT EXISTS clinics (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  color TEXT DEFAULT '#E91E63',
  icon TEXT DEFAULT '🏥',
  prefix TEXT DEFAULT 'Q',
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

-- 3. Rooms
CREATE TABLE IF NOT EXISTS rooms (
  id SERIAL PRIMARY KEY,
  clinic_id TEXT NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT DEFAULT '#93C5FD',
  image_url TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Queues
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

-- 5. Completed Procedures
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
CREATE INDEX IF NOT EXISTS idx_queues_phone ON queues(phone);

-- ═══ RLS Policies ═══
ALTER TABLE queues ENABLE ROW LEVEL SECURITY;
ALTER TABLE clinics ENABLE ROW LEVEL SECURITY;
ALTER TABLE rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE branches ENABLE ROW LEVEL SECURITY;
ALTER TABLE completed_procedures ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all queues" ON queues FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all clinics" ON clinics FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all rooms" ON rooms FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all branches" ON branches FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all completed_procedures" ON completed_procedures FOR ALL USING (true) WITH CHECK (true);

-- ═══ Enable Realtime ═══
ALTER PUBLICATION supabase_realtime ADD TABLE queues;

-- ═══════════════════════════════════════════
-- SEED DATA
-- ═══════════════════════════════════════════

-- Clinics
INSERT INTO clinics (id, name, type, color, icon, prefix) VALUES
  ('clinic-dental', 'คลินิกทันตกรรม', 'dental', '#E91E63', '🦷', 'E'),
  ('clinic-medical', 'คลินิกเวชกรรม', 'medical', '#2196F3', '🩺', 'A'),
  ('clinic-aesthetic', 'คลินิกเสริมความงาม', 'aesthetic', '#9C27B0', '✨', 'B'),
  ('clinic-thai', 'แพทย์แผนไทย', 'thai', '#4CAF50', '🌿', 'C'),
  ('clinic-chinese', 'แพทย์แผนจีน', 'chinese', '#FF9800', '🔮', 'D'),
  ('clinic-physical', 'คลินิกกายภาพบำบัด', 'physical', '#00BCD4', '💪', 'F')
ON CONFLICT (id) DO NOTHING;

-- Rooms for dental clinic
INSERT INTO rooms (clinic_id, name, color) VALUES
  ('clinic-dental', 'ห้อง 1', '#93C5FD'),
  ('clinic-dental', 'ห้อง 2', '#A7F3D0'),
  ('clinic-dental', 'ห้อง 3', '#FCD34D'),
  ('clinic-dental', 'ห้อง 4', '#FDA4AF'),
  ('clinic-dental', 'ห้อง 5', '#D8B4FE')
ON CONFLICT DO NOTHING;

-- Rooms for medical clinic
INSERT INTO rooms (clinic_id, name, color) VALUES
  ('clinic-medical', 'ห้อง 1', '#FECACA'),
  ('clinic-medical', 'ห้อง 2', '#C4B5FD')
ON CONFLICT DO NOTHING;

-- Rooms for aesthetic clinic
INSERT INTO rooms (clinic_id, name, color) VALUES
  ('clinic-aesthetic', 'ห้อง 1', '#DDD6FE'),
  ('clinic-aesthetic', 'ห้อง 2', '#FBCFE8')
ON CONFLICT DO NOTHING;

-- Rooms for thai clinic
INSERT INTO rooms (clinic_id, name, color) VALUES
  ('clinic-thai', 'ห้อง 1', '#BBF7D0'),
  ('clinic-thai', 'ห้อง 2', '#D1FAE5')
ON CONFLICT DO NOTHING;

-- Rooms for chinese clinic
INSERT INTO rooms (clinic_id, name, color) VALUES
  ('clinic-chinese', 'ห้อง 1', '#FDE68A'),
  ('clinic-chinese', 'ห้อง 2', '#FEF3C7')
ON CONFLICT DO NOTHING;

-- Rooms for physical clinic
INSERT INTO rooms (clinic_id, name, color) VALUES
  ('clinic-physical', 'ห้อง 1', '#C7D2FE'),
  ('clinic-physical', 'ห้อง 2', '#E0E7FF')
ON CONFLICT DO NOTHING;

-- ═══ Demo Queue Data ═══

-- Dental
INSERT INTO queues (clinic_id, number, patient_name, phone, procedure, booking_mode, assigned_room, assigned_doctor, status, time, arrived, arrived_at, serving_at, queue_date) VALUES
  ('clinic-dental', 'E024', 'สมชาย ใจดี', '081-234-5678', 'ขูดหินปูน', 'walkin', 1, 'ทพ.สมบูรณ์ สุขใจ', 'serving', '09:15', true, NOW(), NOW() - interval '25 minutes', CURRENT_DATE),
  ('clinic-dental', 'E025', 'สมหญิง รักสวย', '082-345-6789', 'จัดฟัน', 'walkin', 2, 'ทพ.วิชัย มั่นคง', 'serving', '09:30', true, NOW(), NOW() - interval '40 minutes', CURRENT_DATE),
  ('clinic-dental', 'E026', 'วิชัย มั่นคง', '083-456-7890', 'อุดฟัน', 'walkin', 1, 'ทพ.สมบูรณ์ สุขใจ', 'waiting', '09:45', true, NOW(), NULL, CURRENT_DATE),
  ('clinic-dental', 'E027', 'ธนากร เจริญสุข', '084-567-8901', 'ผ่าตัดฟันคุด', 'walkin', 3, 'ทพ.สมพงษ์ กล้าแข็ง', 'waiting', '09:00', true, NOW(), NULL, CURRENT_DATE),
  ('clinic-dental', 'E028', 'พิมพ์ใจ สดใส', '085-678-9012', 'ฟอกสีฟัน', 'walkin', 1, 'ทพ.สมบูรณ์ สุขใจ', 'completed', '08:30', true, NOW(), NOW() - interval '60 minutes', CURRENT_DATE),
  ('clinic-dental', 'E030', 'ประสงค์ สุขสันต์', '087-890-1234', 'ตรวจสุขภาพฟัน', 'walkin', 1, 'ทพ.สมบูรณ์ สุขใจ', 'waiting', '10:30', true, NOW(), NULL, CURRENT_DATE)
ON CONFLICT DO NOTHING;

-- Medical
INSERT INTO queues (clinic_id, number, patient_name, phone, procedure, booking_mode, assigned_room, assigned_doctor, status, time, arrived, arrived_at, serving_at, queue_date) VALUES
  ('clinic-medical', 'A024', 'สมชาย ใจดี', '081-234-5678', 'ตรวจสุขภาพทั่วไป', 'walkin', 1, 'นพ.นรินทร์ สุขสมบูรณ์', 'serving', '09:15', true, NOW(), NOW() - interval '20 minutes', CURRENT_DATE),
  ('clinic-medical', 'A025', 'สมหญิง รักสวย', '082-345-6789', 'ฉีดวัคซีน', 'walkin', 1, 'นพ.นรินทร์ สุขสมบูรณ์', 'waiting', '09:30', true, NOW(), NULL, CURRENT_DATE),
  ('clinic-medical', 'B018', 'วิชัย มั่นคง', '083-456-7890', 'รักษาสิว', 'walkin', 2, 'พญ.สิริพร ผิวงาม', 'waiting', '10:00', true, NOW(), NULL, CURRENT_DATE),
  ('clinic-medical', 'A026', 'พิมพ์ใจ สดใส', '085-678-9012', 'ตรวจเลือด', 'walkin', 1, 'นพ.นรินทร์ สุขสมบูรณ์', 'completed', '08:30', true, NOW(), NOW() - interval '60 minutes', CURRENT_DATE)
ON CONFLICT DO NOTHING;

-- Aesthetic
INSERT INTO queues (clinic_id, number, patient_name, phone, procedure, booking_mode, assigned_room, assigned_doctor, status, time, arrived, arrived_at, serving_at, queue_date) VALUES
  ('clinic-aesthetic', 'B018', 'สมชาย ใจดี', '081-234-5678', 'ฉีดโบتو็อกซ์', 'walkin', 1, 'นพ.อริยะ หน้าใส', 'serving', '10:15', true, NOW(), NOW() - interval '25 minutes', CURRENT_DATE),
  ('clinic-aesthetic', 'B019', 'สมหญิง รักสวย', '082-345-6789', 'ฉีดฟิลเลอร์', 'walkin', 1, 'นพ.อริยะ หน้าใส', 'waiting', '10:30', true, NOW(), NULL, CURRENT_DATE),
  ('clinic-aesthetic', 'B020', 'วิชัย มั่นคง', '083-456-7890', 'เลเซอร์หน้าใส', 'walkin', 2, 'นพ.ณัชชา เลเซอร์', 'waiting', '11:00', true, NOW(), NULL, CURRENT_DATE)
ON CONFLICT DO NOTHING;

-- Thai
INSERT INTO queues (clinic_id, number, patient_name, phone, procedure, booking_mode, assigned_room, assigned_doctor, status, time, arrived, arrived_at, serving_at, queue_date) VALUES
  ('clinic-thai', 'C012', 'สมชาย ใจดี', '081-234-5678', 'นวดแผนไทยเต็มตัว', 'walkin', 1, 'นายสมศักดิ์ นวดเก่ง', 'serving', '09:00', true, NOW(), NOW() - interval '45 minutes', CURRENT_DATE),
  ('clinic-thai', 'C013', 'สมหญิง รักสวย', '082-345-6789', 'นวดฝ่าเท้า', 'walkin', 1, 'นายสมศักดิ์ นวดเก่ง', 'waiting', '10:00', true, NOW(), NULL, CURRENT_DATE),
  ('clinic-thai', 'C014', 'ธนากร เจริญสุข', '084-567-8901', 'อบสมุนไพร', 'walkin', 2, 'นางสาวพลอย สมุนไพร', 'waiting', '10:30', true, NOW(), NULL, CURRENT_DATE)
ON CONFLICT DO NOTHING;

-- Chinese
INSERT INTO queues (clinic_id, number, patient_name, phone, procedure, booking_mode, assigned_room, assigned_doctor, status, time, arrived, arrived_at, serving_at, queue_date) VALUES
  ('clinic-chinese', 'D008', 'สมชาย ใจดี', '081-234-5678', 'ฝังเข็มทั่วไป', 'walkin', 1, 'อาจารย์หมออู จีนเทวะ', 'serving', '09:30', true, NOW(), NOW() - interval '30 minutes', CURRENT_DATE),
  ('clinic-chinese', 'D009', 'สมหญิง รักสวย', '082-345-6789', 'ฝังเข็มบำบัดปวด', 'walkin', 1, 'อาจารย์หมออู จีนเทวะ', 'waiting', '10:00', true, NOW(), NULL, CURRENT_DATE),
  ('clinic-chinese', 'D010', 'ธนากร เจริญสุข', '084-567-8901', 'จ่ายยาจีน', 'walkin', 2, 'นพ.หลี่ จีนแพทย์', 'waiting', '10:30', true, NOW(), NULL, CURRENT_DATE),
  ('clinic-chinese', 'D011', 'พิมพ์ใจ สดใส', '085-678-9012', 'กัวซา', 'walkin', 1, 'อาจารย์หมออู จีนเทวะ', 'completed', '08:30', true, NOW(), NOW() - interval '90 minutes', CURRENT_DATE)
ON CONFLICT DO NOTHING;

-- Physical
INSERT INTO queues (clinic_id, number, patient_name, phone, procedure, booking_mode, assigned_room, assigned_doctor, status, time, arrived, arrived_at, serving_at, queue_date) VALUES
  ('clinic-physical', 'F015', 'สมชาย ใจดี', '081-234-5678', 'กายภาพบำบัดไหล่', 'walkin', 1, 'นายสมใจ กายภาพ', 'serving', '09:00', true, NOW(), NOW() - interval '35 minutes', CURRENT_DATE),
  ('clinic-physical', 'F016', 'สมหญิง รักสวย', '082-345-6789', 'กายภาพบำบัดหลัง', 'walkin', 1, 'นายสมใจ กายภาพ', 'waiting', '10:00', true, NOW(), NULL, CURRENT_DATE),
  ('clinic-physical', 'F017', 'ธนากร เจริญสุข', '084-567-8901', 'โปรแกรมออกกำลังกาย', 'walkin', 2, 'นางสาวนาติ ออกกำลัง', 'waiting', '10:30', true, NOW(), NULL, CURRENT_DATE),
  ('clinic-physical', 'F018', 'พิมพ์ใจ สดใส', '085-678-9012', 'กายภาพบำบัดเข่า', 'walkin', 1, 'นายสมใจ กายภาพ', 'completed', '08:30', true, NOW(), NOW() - interval '90 minutes', CURRENT_DATE)
ON CONFLICT DO NOTHING;

-- Verify
SELECT '✅ Setup complete! Tables created and demo data seeded.' as result;
