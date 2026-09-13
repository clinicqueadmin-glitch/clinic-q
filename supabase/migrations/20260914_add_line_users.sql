-- ═══════════════════════════════════════════
-- LINE users (patient phone ⇄ LINE userId, per clinic)
-- ═══════════════════════════════════════════
-- Until now the phone→LINE mapping lived only in the browser's localStorage of
-- the phone that completed the bind, so nothing server-side could resolve it and
-- LINE notifications could never be sent automatically. This table is the source
-- of truth, clinic-scoped (one LINE account can be bound to several clinics).
--
-- Writes are performed by the server routes with the service-role key
--   POST /api/line/bind      (patient binds their own phone)
-- which is why there is deliberately NO insert/update/delete policy below:
-- the patient-facing bind has no session, so it must never write to the table
-- from the browser. Reads are limited to the clinic's own members.

CREATE TABLE IF NOT EXISTS public.line_users (
  id BIGSERIAL PRIMARY KEY,
  clinic_id TEXT NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  line_user_id TEXT NOT NULL,
  -- Digits only (no dashes/spaces) so lookups by phone are exact.
  phone TEXT,
  display_name TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (clinic_id, line_user_id)
);

CREATE INDEX IF NOT EXISTS idx_line_users_clinic_phone
  ON public.line_users (clinic_id, phone);
CREATE INDEX IF NOT EXISTS idx_line_users_clinic_line_user
  ON public.line_users (clinic_id, line_user_id);

-- ═══ RLS ═══
ALTER TABLE public.line_users ENABLE ROW LEVEL SECURITY;

-- Clinic members may read their clinic's bindings (e.g. to show a count).
-- No write policy: only the service role writes, from the server routes.
DROP POLICY IF EXISTS "Clinic members can read line_users" ON public.line_users;
CREATE POLICY "Clinic members can read line_users" ON public.line_users
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.clinic_memberships cm
      WHERE cm.user_id = auth.uid()
        AND cm.clinic_id = line_users.clinic_id
        AND cm.is_active IS TRUE
    )
  );

SELECT '✅ line_users created' AS result;
