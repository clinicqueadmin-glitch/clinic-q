import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createClient } from '@/utils/supabase/server'
import { getAdminClient } from '@/lib/supabase-admin'

export const dynamic = 'force-dynamic'

/**
 * POST /api/clinics/[clinicId]/users/[userId]/reset-password
 *
 * Authorization:
 *   - Owner can reset Manager / Counter / Staff / Practitioner
 *     who belong to the same clinic.
 *   - Manager can reset Counter / Staff / Practitioner who belong to
 *     the same clinic, but cannot reset Owner and cannot reset another
 *     Manager unless the current membership roles explicitly allow it.
 *
 * Effect:
 *   1. Generate a secure temporary password (not 123456, not reusable).
 *   2. Use Supabase service-role admin.updateUser(userId, { password }) to
 *      set the new password in Supabase Auth.
 *   3. Set force_password_change = true in public.users so the next login
 *      forces the user to choose a new password.
 *   4. Return the temporary password ONCE to the authorized caller. It is
 *      never stored in any application table.
 */

export async function POST(
  request: NextRequest,
  { params }: { params: { clinicId: string; userId: string } }
) {
  const { clinicId, userId } = params
  if (!clinicId || !userId) {
    return NextResponse.json({ error: 'clinicId and userId are required' }, { status: 400 })
  }

  // ── 1. Authenticated caller ───────────────────────────────────
  const cookieStore = await cookies()
  const sb = createClient(cookieStore)

  const { data: { user: caller }, error: callerError } = await sb.auth.getUser()
  if (callerError || !caller) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  // ── 2. Verify caller membership in the target clinic ─────────
  const { data: callerMembership, error: memError } = await sb
    .from('clinic_memberships')
    .select('id, role')
    .eq('user_id', caller.id)
    .eq('clinic_id', clinicId)
    .eq('is_active', true)
    .maybeSingle()

  if (memError || !callerMembership) {
    return NextResponse.json({ error: 'not authorized for this clinic' }, { status: 403 })
  }

  const callerRole = callerMembership.role as string

  // ── 3. Verify target user exists and belongs to the clinic ────
  const { data: targetUser, error: targetUserError } = await sb
    .from('users')
    .select('id')
    .eq('id', userId)
    .maybeSingle()

  if (targetUserError || !targetUser) {
    return NextResponse.json({ error: 'user not found' }, { status: 404 })
  }

  // Confirm target is a member of this clinic
  const { data: targetMembership } = await sb
    .from('clinic_memberships')
    .select('id, role')
    .eq('user_id', userId)
    .eq('clinic_id', clinicId)
    .eq('is_active', true)
    .maybeSingle()

  if (!targetMembership) {
    return NextResponse.json({ error: 'user is not a member of this clinic' }, { status: 403 })
  }

  const targetRole = targetMembership.role as string

  // ── 4. Authorization rules ────────────────────────────────────
  // Owner may reset any manager / counter / staff / practitioner in the clinic.
  // Manager may reset counter / staff / practitioner in the clinic, but NOT
  // owner and NOT another manager (unless future architecture explicitly allows it).
  const isOwner = callerRole === 'owner'
  const isManager = callerRole === 'manager'

  const targetIsOwner = targetRole === 'owner'
  const targetIsManager = targetRole === 'manager'

  if (targetIsOwner) {
    return NextResponse.json({ error: 'cannot reset owner account' }, { status: 403 })
  }

  if (isManager && targetIsManager) {
    return NextResponse.json({ error: 'cannot reset another manager account' }, { status: 403 })
  }

  if (!isOwner && !isManager) {
    return NextResponse.json({ error: 'not authorized to reset passwords' }, { status: 403 })
  }

  // ── 5. Generate a secure temporary password ───────────────────
  const tempPassword = generateTempPassword()

  // ── 6. Set new password via Supabase service role ─────────────
  const admin = getAdminClient()
  if (!admin) {
    return NextResponse.json({ error: 'server not configured for account management' }, { status: 500 })
  }

  // Cast as any: generated admin types are not installed in this project.
  const { error: updateError } = await (admin.auth.admin as any).updateUser(userId, {
    password: tempPassword,
  })

  if (updateError) {
    const msg = (updateError.message || '').toLowerCase()
    if (msg.includes('not found') || msg.includes('no user')) {
      return NextResponse.json({ error: 'user account not found in auth' }, { status: 404 })
    }
    return NextResponse.json({ error: 'failed to update auth password' }, { status: 500 })
  }

  // ── 7. Force password change in public.users ──────────────────
  const db = admin as any
  const { error: flagError } = await db.from('users')
    .update({ force_password_change: true })
    .eq('id', userId)

  if (flagError) {
    // The auth password was already changed. This is a partial failure;
    // we still return the temp password so the user can log in and then
    // change it. Log server-side only.
    console.error('Failed to set force_password_change for', userId, flagError)
  }

  // ── 8. Return temporary password once ────────────────────────
  return NextResponse.json({
    userId,
    temporaryPassword: tempPassword,
    message: 'Password has been reset. The user must log in with the temporary password and choose a new one.',
  }, { status: 200 })
}

// ────────────────────────────────────────────────────────────────
// Password generation
// ────────────────────────────────────────────────────────────────

/**
 * Generate a random temporary password that is:
 *  - long enough to resist brute force during the brief validity window
 *  - mixed case letters + digits (no ambiguous chars)
 *  - NOT "123456" or any other static default
 *
 * This password is returned to the authorized caller exactly once and is
 * never stored in any application table. Supabase Auth stores only the
 * hashed version.
 */
function generateTempPassword(): string {
  // 12 characters: mixed case letters + digits, no ambiguous symbols
  const LOWER = 'abcdefghjkmnpqrstuvwxyz' // no i/l/o
  const UPPER = 'ABCDEFGHJKMNPQRSTUVWXYZ' // no i/l/o
  const DIGITS = '23456789' // no 0/1
  const ALL = LOWER + UPPER + DIGITS

  let result = ''
  const array = new Uint8Array(12)
  crypto.getRandomValues(array)
  for (let i = 0; i < 12; i++) {
    result += ALL[array[i] % ALL.length]
  }

  // Ensure at least one digit and one letter for basic policy compliance.
  // (Very unlikely to fail, but cheap to enforce.)
  if (!/\d/.test(result)) {
    result = result.slice(0, 11) + DIGITS[array[11] % DIGITS.length]
  }
  if (!/[a-zA-Z]/.test(result)) {
    result = result.slice(0, 11) + LOWER[array[11] % LOWER.length]
  }

  return result
}
