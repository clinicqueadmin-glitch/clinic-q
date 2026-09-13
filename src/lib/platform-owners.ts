/**
 * Platform Owner identity — the single source of truth.
 *
 * The platform owner is not a database role in ClinicQ: the account is
 * identified by this email allowlist, both in the browser (auth-context) and on
 * the server (the /api/platform/* routes, which re-check the caller's token).
 *
 * Keep this list here only. A second copy that drifts is a privilege bug: the
 * server routes below authorize on this value, so the browser and the server
 * must agree on exactly who a platform owner is.
 */
export const PLATFORM_OWNER_EMAILS: readonly string[] = [
  'sakarinmam999@gmail.com',
  'clinicque.admin@gmail.com',
]

/** True when the email belongs to a platform owner (case-insensitive). */
export function isPlatformOwnerEmail(email?: string | null): boolean {
  if (!email) return false
  return PLATFORM_OWNER_EMAILS.includes(email.trim().toLowerCase())
}
