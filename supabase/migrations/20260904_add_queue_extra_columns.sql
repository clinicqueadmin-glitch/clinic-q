-- ═══════════════════════════════════════════
-- Add missing columns to queues table
-- ═══════════════════════════════════════════

-- Appointment fields
ALTER TABLE queues ADD COLUMN IF NOT EXISTS appointment_time TEXT;
ALTER TABLE queues ADD COLUMN IF NOT EXISTS appointment_date DATE;
ALTER TABLE queues ADD COLUMN IF NOT EXISTS appointment_on_time BOOLEAN;
ALTER TABLE queues ADD COLUMN IF NOT EXISTS hn TEXT;
ALTER TABLE queues ADD COLUMN IF NOT EXISTS queue_position INTEGER;

-- Arrival tracking
ALTER TABLE queues ADD COLUMN IF NOT EXISTS is_on_time BOOLEAN;
ALTER TABLE queues ADD COLUMN IF NOT EXISTS late_minutes INTEGER;
ALTER TABLE queues ADD COLUMN IF NOT EXISTS original_booked_time TEXT;

-- Cancellation fields
ALTER TABLE queues ADD COLUMN IF NOT EXISTS cancel_reason TEXT;
ALTER TABLE queues ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ;

-- Online booking fields
ALTER TABLE queues ADD COLUMN IF NOT EXISTS booked_time_slot TEXT;
ALTER TABLE queues ADD COLUMN IF NOT EXISTS distance_from_clinic INTEGER;
ALTER TABLE queues ADD COLUMN IF NOT EXISTS checkin_at TIMESTAMPTZ;

-- Additional completed procedure metadata
ALTER TABLE completed_procedures ADD COLUMN IF NOT EXISTS notes TEXT;

-- ═══ Verify ═══
SELECT '✅ queues table updated with extra columns' as result;
