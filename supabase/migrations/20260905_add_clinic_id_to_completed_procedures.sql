-- Add clinic_id to completed_procedures for per-clinic isolation
ALTER TABLE completed_procedures ADD COLUMN IF NOT EXISTS clinic_id TEXT;

-- Backfill clinic_id from queues table
UPDATE completed_procedures cp
SET clinic_id = q.clinic_id
FROM queues q
WHERE cp.queue_id = q.id AND cp.clinic_id IS NULL;

-- Add index
CREATE INDEX IF NOT EXISTS idx_completed_procedures_clinic ON completed_procedures(clinic_id);
