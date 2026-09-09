import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createClient } from '@/utils/supabase/server'
import { getAdminClient } from '@/lib/supabase-admin'

export const dynamic = 'force-dynamic'

/**
 * DELETE /api/clinics/[clinicId]/users/[userId]
 *
 * SOFT-DELETE only — never deletes the Supabase Auth user.
 *
 * Effect: sets every clinic_memberships row of the target in this clinic to
 * is_active = false (and practitioners.is_active = false). All historical
 * queue / relationship data is preserved and the account can be re-activated
 * later (via PATCH with isActive: true).
 *
 * Authorization (server-side enforcement):
 *   - Caller must be an ACTIVE owner or manager of the clinic.
 *   - Manager may only soft-delete staff-level members
 *     (front_desk / practitioner) — never owner or another manager.
 *   - Owner may soft-delete manager / front_desk / practitioner, but never
 *     another owner-role member.
 *   - Nobody may soft-delete their own account.
 */
export async function DELETE(
  _request: NextRequest,
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

  // ── 2. Verify caller is an ACTIVE owner/manager of the clinic ──
  const { data: callerMembership, error: memError } = await sb
    .from('clinic_memberships')
    .select('id, role')
    .eq('user_id', caller.id)
    .eq('clinic_id', clinicId)
    .in('role', ['owner', 'manager'])
    .eq('is_active', true)
    .maybeSingle()

  if (memError || !callerMembership) {
    return NextResponse.json({ error: 'not authorized for this clinic' }, { status: 403 })
  }

  const callerRole = callerMembership.role as string

  // ── 3. Resolve target membership(s) in this clinic ────────────
  const admin = getAdminClient()
  if (!admin) {
    return NextResponse.json({ error: 'server not configured for account management' }, { status: 500 })
  }
  const db = admin as any

  const { data: targetMemberships, error: targetMemError } = await db
    .from('clinic_memberships')
    .select('id, role, is_active')
    .eq('user_id', userId)
    .eq('clinic_id', clinicId)

  if (targetMemError) {
    return NextResponse.json({ error: 'failed to resolve target membership' }, { status: 500 })
  }
  if (!targetMemberships || targetMemberships.length === 0) {
    return NextResponse.json({ error: 'user is not a member of this clinic' }, { status: 403 })
  }

  const currentRoles = targetMemberships
    .filter((m: any) => m.is_active)
    .map((m: any) => m.role)
  const targetIsOwner = currentRoles.includes('owner')
  const targetIsManager = currentRoles.includes('manager')

  // ── 4. Authorization rules ────────────────────────────────────
  if (callerRole === 'manager') {
    if (targetIsOwner) {
      return NextResponse.json({ error: 'cannot deactivate owner account' }, { status: 403 })
    }
    if (targetIsManager) {
      return NextResponse.json({ error: 'cannot deactivate another manager account' }, { status: 403 })
    }
  } else if (callerRole === 'owner') {
    if (targetIsOwner) {
      return NextResponse.json({ error: 'cannot deactivate owner account' }, { status: 403 })
    }
  }

  if (userId === caller.id) {
    return NextResponse.json({ error: 'cannot deactivate your own account' }, { status: 400 })
  }

  // ── 5. Soft-delete: is_active = false everywhere in this clinic ──
  try {
    for (const m of targetMemberships) {
      if (m.is_active) {
        const { error: updErr } = await db
          .from('clinic_memberships')
          .update({ is_active: false })
          .eq('id', m.id)
        if (updErr) throw updErr
      }
    }

    const { data: existingPractitioner } = await db
      .from('practitioners')
      .select('id')
      .eq('user_id', userId)
      .eq('clinic_id', clinicId)
      .maybeSingle()

    if (existingPractitioner) {
      const { error: practErr } = await db
        .from('practitioners')
        .update({ is_active: false })
        .eq('id', existingPractitioner.id)
      if (practErr) throw practErr
    }
  } catch (err: any) {
    return NextResponse.json({ error: 'failed to deactivate user' }, { status: 500 })
  }

  return NextResponse.json({ success: true, userId }, { status: 200 })
}