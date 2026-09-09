-- 004_logo_storage.sql
-- Clinic logo uploads live in the 'clinic-logos' Storage bucket.
--
-- Design:
--  * Bucket is PUBLIC so the logo renders on TV display, booking page and
--    sidebar (logos are display assets — public read is intentional).
--  * Writes (insert/update/delete) are restricted to ACTIVE CLINIC MEMBERS
--    via a SECURITY DEFINER helper, so a user from clinic A can never touch
--    clinic B's logo and RLS on clinic_memberships can never block the check.
--  * The application itself uploads server-side (service role) through
--    /api/clinics/:clinicId/logo — these policies are defense in depth.
--
-- Idempotent: safe to re-run.

-- 1. Bucket (idempotent upsert)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'clinic-logos',
  'clinic-logos',
  TRUE,
  2097152,
  ARRAY['image/png', 'image/jpeg', 'image/webp']::text[]
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- 2. SECURITY DEFINER helper — is the caller an ACTIVE member of this clinic?
--    SECURITY DEFINER bypasses clinic_memberships RLS, so this check is safe
--    to call from storage policies.
CREATE OR REPLACE FUNCTION public.is_clinic_member(p_clinic_id TEXT)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.clinic_memberships cm
    WHERE cm.clinic_id = p_clinic_id
      AND cm.user_id = auth.uid()
      AND cm.is_active = TRUE
  );
$$;

REVOKE ALL ON FUNCTION public.is_clinic_member(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_clinic_member(TEXT) TO authenticated;

-- 3. Storage policies (idempotent)
--    Make sure the storage helper used by the policies below is executable by
--    members (some Supabase versions do not grant it to authenticated by default).
GRANT EXECUTE ON FUNCTION storage.foldername(text) TO authenticated;

DROP POLICY IF EXISTS "clinic_logos_public_read" ON storage.objects;
CREATE POLICY "clinic_logos_public_read"
ON storage.objects FOR SELECT
USING (bucket_id = 'clinic-logos');

DROP POLICY IF EXISTS "clinic_logos_member_insert" ON storage.objects;
CREATE POLICY "clinic_logos_member_insert"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'clinic-logos'
  AND public.is_clinic_member((storage.foldername(name))[1])
);

DROP POLICY IF EXISTS "clinic_logos_member_update" ON storage.objects;
CREATE POLICY "clinic_logos_member_update"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'clinic-logos'
  AND public.is_clinic_member((storage.foldername(name))[1])
)
WITH CHECK (
  bucket_id = 'clinic-logos'
  AND public.is_clinic_member((storage.foldername(name))[1])
);

DROP POLICY IF EXISTS "clinic_logos_member_delete" ON storage.objects;
CREATE POLICY "clinic_logos_member_delete"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'clinic-logos'
  AND public.is_clinic_member((storage.foldername(name))[1])
);

-- 4. The memberships table must stay readable by its members (the app already
--    relies on this) — no change here, listed for clarity.