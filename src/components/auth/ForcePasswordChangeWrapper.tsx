'use client'

/**
 * Forced first-login password change is disabled in the MVP.
 *
 * Users can log in immediately with the password they were given (either the
 * one they chose at registration or the temporary one issued by an owner /
 * manager). No modal, no redirect, no dashboard block.
 *
 * The `force_password_change` DB column is kept for future use but it is no
 * longer enforced by the authentication flow.
 */
export default function ForcePasswordChangeWrapper() {
  return null
}