-- ═══════════════════════════════════════════
-- Clinic Settings Table (per-clinic key-value)
-- ═══════════════════════════════════════════

CREATE TABLE IF NOT EXISTS clinic_settings (
  id SERIAL PRIMARY KEY,
  clinic_id TEXT NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  setting_key TEXT NOT NULL,
  setting_value JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(clinic_id, setting_key)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_clinic_settings_clinic ON clinic_settings(clinic_id);
CREATE INDEX IF NOT EXISTS idx_clinic_settings_key ON clinic_settings(clinic_id, setting_key);

-- RLS
ALTER TABLE clinic_settings ENABLE ROW LEVEL SECURITY;

-- Allow all operations (public API for now)
CREATE POLICY "Allow all clinic_settings" ON clinic_settings FOR ALL USING (true) WITH CHECK (true);

-- ═══ Daily rooms table ═══
CREATE TABLE IF NOT EXISTS daily_rooms (
  id SERIAL PRIMARY KEY,
  clinic_id TEXT NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  room_date DATE NOT NULL DEFAULT CURRENT_DATE,
  room_data JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(clinic_id, room_date)
);

CREATE INDEX IF NOT EXISTS idx_daily_rooms_clinic_date ON daily_rooms(clinic_id, room_date);

ALTER TABLE daily_rooms ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all daily_rooms" ON daily_rooms FOR ALL USING (true) WITH CHECK (true);

SELECT '✅ clinic_settings and daily_tables created' as result;
