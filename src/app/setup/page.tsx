'use client'

import { useState } from 'react'

const SQL_SCHEMA = `-- ═══════════════════════════════════════════
-- Clinic-Q Database Setup for Supabase
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

-- RLS
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

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE queues;

-- ═══ SEED DATA ═══

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

INSERT INTO rooms (clinic_id, name, color) VALUES
  ('clinic-medical', 'ห้อง 1', '#FECACA'),
  ('clinic-medical', 'ห้อง 2', '#C4B5FD')
ON CONFLICT DO NOTHING;

INSERT INTO rooms (clinic_id, name, color) VALUES
  ('clinic-aesthetic', 'ห้อง 1', '#DDD6FE'),
  ('clinic-aesthetic', 'ห้อง 2', '#FBCFE8')
ON CONFLICT DO NOTHING;

INSERT INTO rooms (clinic_id, name, color) VALUES
  ('clinic-thai', 'ห้อง 1', '#BBF7D0'),
  ('clinic-thai', 'ห้อง 2', '#D1FAE5')
ON CONFLICT DO NOTHING;

INSERT INTO rooms (clinic_id, name, color) VALUES
  ('clinic-chinese', 'ห้อง 1', '#FDE68A'),
  ('clinic-chinese', 'ห้อง 2', '#FEF3C7')
ON CONFLICT DO NOTHING;

INSERT INTO rooms (clinic_id, name, color) VALUES
  ('clinic-physical', 'ห้อง 1', '#C7D2FE'),
  ('clinic-physical', 'ห้อง 2', '#E0E7FF')
ON CONFLICT DO NOTHING;

-- Demo queues
INSERT INTO queues (clinic_id, number, patient_name, phone, procedure, booking_mode, assigned_room, assigned_doctor, status, time, arrived, arrived_at, serving_at, queue_date) VALUES
  ('clinic-dental', 'E024', 'สมชาย ใจดี', '0812345678', 'ขูดหินปูน', 'walkin', 1, 'ทพ.สมบูรณ์', 'serving', '09:15', true, NOW(), NOW() - interval '25 minutes', CURRENT_DATE),
  ('clinic-dental', 'E025', 'สมหญิง รักสวย', '0823456789', 'จัดฟัน', 'walkin', 2, 'ทพ.วิชัย', 'serving', '09:30', true, NOW(), NOW() - interval '40 minutes', CURRENT_DATE),
  ('clinic-dental', 'E026', 'วิชัย มั่นคง', '0834567890', 'อุดฟัน', 'walkin', null, 'ทพ.สมบูรณ์', 'waiting', '09:45', true, NOW(), NULL, CURRENT_DATE),
  ('clinic-dental', 'E027', 'ธนากร เจริญสุข', '0845678901', 'ผ่าตัดฟันคุด', 'walkin', null, 'ทพ.สมพงษ์', 'waiting', '09:00', true, NOW(), NULL, CURRENT_DATE),
  ('clinic-dental', 'E028', 'พิมพ์ใจ สดใส', '0856789012', 'ฟอกสีฟัน', 'walkin', 1, 'ทพ.สมบูรณ์', 'completed', '08:30', true, NOW(), NOW() - interval '60 minutes', CURRENT_DATE),
  ('clinic-dental', 'E030', 'ประสงค์ สุขสันต์', '0878901234', 'ตรวจสุขภาพฟัน', 'walkin', null, 'ทพ.สมบูรณ์', 'waiting', '10:30', true, NOW(), NULL, CURRENT_DATE)
ON CONFLICT DO NOTHING;

INSERT INTO queues (clinic_id, number, patient_name, phone, procedure, booking_mode, assigned_room, assigned_doctor, status, time, arrived, arrived_at, serving_at, queue_date) VALUES
  ('clinic-medical', 'A024', 'สมชาย ใจดี', '0812345678', 'ตรวจสุขภาพทั่วไป', 'walkin', 1, 'นพ.นรินทร์', 'serving', '09:15', true, NOW(), NOW() - interval '20 minutes', CURRENT_DATE),
  ('clinic-medical', 'A025', 'สมหญิง รักสวย', '0823456789', 'ฉีดวัคซีน', 'walkin', 1, 'นพ.นรินทร์', 'waiting', '09:30', true, NOW(), NULL, CURRENT_DATE),
  ('clinic-medical', 'A026', 'วิชัย มั่นคง', '0834567890', 'ตรวจเลือด', 'walkin', 1, 'นพ.นรินทร์', 'completed', '08:30', true, NOW(), NOW() - interval '60 minutes', CURRENT_DATE)
ON CONFLICT DO NOTHING;

INSERT INTO queues (clinic_id, number, patient_name, phone, procedure, booking_mode, assigned_room, assigned_doctor, status, time, arrived, arrived_at, serving_at, queue_date) VALUES
  ('clinic-aesthetic', 'B018', 'สมชาย ใจดี', '0812345678', 'ฉีดโบโต็อกซ์', 'walkin', 1, 'นพ.อริยะ', 'serving', '10:15', true, NOW(), NOW() - interval '25 minutes', CURRENT_DATE),
  ('clinic-aesthetic', 'B019', 'สมหญิง รักสวย', '0823456789', 'ฉีดฟิลเลอร์', 'walkin', 1, 'นพ.อริยะ', 'waiting', '10:30', true, NOW(), NULL, CURRENT_DATE)
ON CONFLICT DO NOTHING;

INSERT INTO queues (clinic_id, number, patient_name, phone, procedure, booking_mode, assigned_room, assigned_doctor, status, time, arrived, arrived_at, serving_at, queue_date) VALUES
  ('clinic-thai', 'C012', 'สมชาย ใจดี', '0812345678', 'นวดแผนไทย', 'walkin', 1, 'นายสมศักดิ์', 'serving', '09:00', true, NOW(), NOW() - interval '45 minutes', CURRENT_DATE),
  ('clinic-thai', 'C013', 'สมหญิง รักสวย', '0823456789', 'นวดฝ่าเท้า', 'walkin', 1, 'นายสมศักดิ์', 'waiting', '10:00', true, NOW(), NULL, CURRENT_DATE)
ON CONFLICT DO NOTHING;

INSERT INTO queues (clinic_id, number, patient_name, phone, procedure, booking_mode, assigned_room, assigned_doctor, status, time, arrived, arrived_at, serving_at, queue_date) VALUES
  ('clinic-chinese', 'D008', 'สมชาย ใจดี', '0812345678', 'ฝังเข็ม', 'walkin', 1, 'อ.มอู', 'serving', '09:30', true, NOW(), NOW() - interval '30 minutes', CURRENT_DATE),
  ('clinic-chinese', 'D009', 'สมหญิง รักสวย', '0823456789', 'จ่ายยาจีน', 'walkin', 1, 'อ.มอู', 'waiting', '10:00', true, NOW(), NULL, CURRENT_DATE)
ON CONFLICT DO NOTHING;

INSERT INTO queues (clinic_id, number, patient_name, phone, procedure, booking_mode, assigned_room, assigned_doctor, status, time, arrived, arrived_at, serving_at, queue_date) VALUES
  ('clinic-physical', 'F015', 'สมชาย ใจดี', '0812345678', 'กายภาพบำบัดไหล่', 'walkin', 1, 'นายสมใจ', 'serving', '09:00', true, NOW(), NOW() - interval '35 minutes', CURRENT_DATE),
  ('clinic-physical', 'F016', 'สมหญิง รักสวย', '0823456789', 'กายภาพบำบัดหลัง', 'walkin', 1, 'นายสมใจ', 'waiting', '10:00', true, NOW(), NULL, CURRENT_DATE)
ON CONFLICT DO NOTHING;
`

export default function SetupPage() {
  const [status, setStatus] = useState<'idle' | 'checking' | 'error' | 'success'>('idle')
  const [message, setMessage] = useState('')
  const [copied, setCopied] = useState(false)
  const [tableStatus, setTableStatus] = useState<Record<string, boolean> | null>(null)

  const checkTables = async () => {
    setStatus('checking')
    setMessage('กำลังตรวจสอบตาราง...')
    try {
      const res = await fetch('/api/setup')
      const data = await res.json()
      setTableStatus(data.tables || {})
      setStatus(data.success ? 'success' : 'error')
      setMessage(data.message)
    } catch (e: any) {
      setStatus('error')
      setMessage('Error: ' + e.message)
    }
  }

  const copySQL = () => {
    navigator.clipboard.writeText(SQL_SCHEMA)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-50 via-blue-50 to-green-50 p-8">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-800 mb-2">⚙️ Clinic-Q Database Setup</h1>
        <p className="text-gray-500 mb-8">ตั้งค่าฐานข้อมูล Supabase สำหรับระบบจัดคิว</p>

        {/* Status Check */}
        <div className="bg-white rounded-2xl shadow-sm border border-pink-100 p-6 mb-6">
          <h2 className="text-xl font-bold text-gray-800 mb-4">📊 สถานะฐานข้อมูล</h2>
          <button
            onClick={checkTables}
            disabled={status === 'checking'}
            className="px-6 py-2.5 bg-blue-500 text-white rounded-xl font-medium hover:bg-blue-600 transition-colors disabled:opacity-50"
          >
            {status === 'checking' ? '⏳ กำลังตรวจสอบ...' : '🔍 ตรวจสอบตาราง'}
          </button>

          {tableStatus && (
            <div className="mt-4 grid grid-cols-2 md:grid-cols-3 gap-3">
              {Object.entries(tableStatus).map(([name, exists]) => (
                <div key={name} className={`p-3 rounded-xl border-2 ${exists ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}`}>
                  <span className="text-lg">{exists ? '✅' : '❌'}</span>
                  <span className="ml-2 font-medium text-gray-700">{name}</span>
                </div>
              ))}
            </div>
          )}

          {message && (
            <p className={`mt-4 text-sm font-medium ${status === 'error' ? 'text-red-500' : 'text-green-600'}`}>
              {message}
            </p>
          )}
        </div>

        {/* SQL Instructions */}
        <div className="bg-white rounded-2xl shadow-sm border border-pink-100 p-6 mb-6">
          <h2 className="text-xl font-bold text-gray-800 mb-4">📋 วิธีตั้งค่า</h2>
          <ol className="space-y-3 text-gray-700">
            <li className="flex gap-3">
              <span className="flex-shrink-0 w-8 h-8 bg-pink-100 text-pink-600 rounded-full flex items-center justify-center font-bold">1</span>
              <span>เปิด <a href="https://supabase.com/dashboard/project/yicoyjnjeztgirbwgyot/sql/new" target="_blank" className="text-blue-500 underline">Supabase SQL Editor</a></span>
            </li>
            <li className="flex gap-3">
              <span className="flex-shrink-0 w-8 h-8 bg-pink-100 text-pink-600 rounded-full flex items-center justify-center font-bold">2</span>
              <span>คัดลอก SQL ด้านล่างไปวางใน SQL Editor</span>
            </li>
            <li className="flex gap-3">
              <span className="flex-shrink-0 w-8 h-8 bg-pink-100 text-pink-600 rounded-full flex items-center justify-center font-bold">3</span>
              <span>กดปุ่ม <strong>Run</strong> 🔵</span>
            </li>
            <li className="flex gap-3">
              <span className="flex-shrink-0 w-8 h-8 bg-pink-100 text-pink-600 rounded-full flex items-center justify-center font-bold">4</span>
              <span>กดปุ่ม &quot;ตรวจสอบตาราง&quot; ด้านบนเพื่อยืนยัน</span>
            </li>
          </ol>
        </div>

        {/* SQL Code */}
        <div className="bg-white rounded-2xl shadow-sm border border-pink-100 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-gray-800">🗄️ SQL Schema + Seed Data</h2>
            <button
              onClick={copySQL}
              className="px-4 py-2 bg-pink-500 text-white rounded-xl text-sm font-medium hover:bg-pink-600 transition-colors"
            >
              {copied ? '✅ คัดลอกแล้ว!' : '📋 คัดลอก SQL'}
            </button>
          </div>
          <pre className="bg-gray-900 text-green-400 p-4 rounded-xl text-xs overflow-auto max-h-96 whitespace-pre-wrap font-mono">
            {SQL_SCHEMA}
          </pre>
        </div>

        {/* Quick links */}
        <div className="mt-6 flex gap-4">
          <a href="/" className="px-6 py-2.5 bg-gray-100 text-gray-700 rounded-xl font-medium hover:bg-gray-200 transition-colors">
            ← กลับหน้าหลัก
          </a>
          <a href="https://supabase.com/dashboard/project/yicoyjnjeztgirbwgyot/sql/new" target="_blank" className="px-6 py-2.5 bg-blue-500 text-white rounded-xl font-medium hover:bg-blue-600 transition-colors">
            🔗 เปิด Supabase SQL Editor →
          </a>
        </div>
      </div>
    </div>
  )
}
