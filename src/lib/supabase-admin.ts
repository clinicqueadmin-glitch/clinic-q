/**
 * ⚠️ SERVER-ONLY MODULE — never import this file from a client component.
 *
 * Creates a Supabase client authenticated with the service-role key.
 * The service-role key BYPASSES all RLS, so this client may only be used
 * inside server-side API routes AFTER explicit authorization checks
 * (see the practitioner creation route for the required pattern).
 *
 * The key is read from `SUPABASE_SERVICE_ROLE_KEY` (server env only).
 * It is never exposed to the browser.
 */
import { createClient } from '@supabase/supabase-js'

let _adminClient: ReturnType<typeof createClient> | null = null

export function getAdminClient(): ReturnType<typeof createClient> | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !key) return null

  if (!_adminClient) {
    _adminClient = createClient(url, key, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
        detectSessionInUrl: false,
      },
    })
  }
  return _adminClient
}