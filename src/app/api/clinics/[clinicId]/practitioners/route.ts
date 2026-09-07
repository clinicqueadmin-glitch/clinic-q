import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createClient } from '@/utils/supabase/server'
import { getAdminClient } from '@/lib/supabase-admin'

export const dynamic = 'force-dynamic'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

// ═══ Simple in-memory rate limiter (per user, per hour) ═══
// Production hardening: replace with Redis/Upstash. This only guards
// account-creation abuse on a single instance.
const RATE_LIMIT = 10 // invites per hour per user
const RATE_WINDOW_MS = 60 * 60 * 1000
const inviteTimestamps = new Map<string, number[]>()

function isRateLimited(userId: string): boolean {
  const now = Date.now()
  const hits = (inviteTimestamps.get(userId) || []).filter(t => now - t < RATE_WINDOW_MS)
  if (hits.length >= RATE_LIMIT) return true
  hits.push(now)
  inviteTimestamps.set(userId, hits)
  return false
}

// ═══ POST /api/clinics/[clinicId]/practitioners ═══
// Creates: auth.users (invite) → users → clinic_memberships → practitioners
// The auth user is created FIRST via invite; the three table rows are
// created atomically by the create_practitioner_account() RPC. If the RPC
// fails, the orphan auth user is deleted as compensation.
export async function POST(
  request: NextRequest,
  { params }: { params: { clinicId: string } }
) {
  const { clinicId } = params
  if (!clinicId) {
    return NextResponse.json({ error: 'clinicId is required' }, { status: 400 })
  }

  // ── 1. Cookie-authenticated, user-scoped client (subject to RLS) ──
  const cookieStore = await cookies()
  const supabase = createClient(cookieStore)

  // ── 2. Verify the caller is authenticated ──
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  // ── 3. Verify active owner/manager membership for the target clinic ──
  // clinicId comes from the URL and is authorized against the caller's
  // membership — never trust the request body for authorization.
  const { data: membership, error: memError } = await supabase
    .from('clinic_memberships')
    .select('id')
    .eq('user_id', user.id)
    .eq('clinic_id', clinicId)
    .in('role', ['owner', 'manager'])
    .eq('is_active', true)
    .maybeSingle()

  if (memError || !membership) {
    return NextResponse.json({ error: 'not authorized for this clinic' }, { status: 403 })
  }

  // ── 4. Parse + validate input ──
  let body: any
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'invalid JSON body' }, { status: 400 })
  }

  const name = typeof body?.name === 'string' ? body.name.trim() : ''
  const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : ''
  const phone = typeof body?.phone === 'string' && body.phone.trim() ? body.phone.trim() : null
  const branchIds = Array.isArray(body?.branchIds)
    ? body.branchIds.filter((b: unknown): b is string => typeof b === 'string')
    : []

  if (!name || !email || !EMAIL_RE.test(email)) {
    return NextResponse.json({ error: 'name and a valid email are required' }, { status: 400 })
  }

  // ── 5. Rate limit ──
  if (isRateLimited(user.id)) {
    return NextResponse.json({ error: 'too many invites, try again later' }, { status: 429 })
  }

  // ── 6. Duplicate checks BEFORE any service-role operation ──
  const { data: existingUser } = await supabase
    .from('users')
    .select('id')
    .eq('email', email)
    .maybeSingle()
  if (existingUser) {
    return NextResponse.json({ error: 'email already registered' }, { status: 409 })
  }

  const { data: existingPractitioner } = await supabase
    .from('practitioners')
    .select('id')
    .eq('clinic_id', clinicId)
    .eq('name', name)
    .maybeSingle()
  if (existingPractitioner) {
    return NextResponse.json({ error: 'practitioner already exists in this clinic' }, { status: 409 })
  }

  // ── 7. Service-role client (bypasses RLS — authorization was done above) ──
  const admin = getAdminClient()
  if (!admin) {
    // Service-role key not configured on the server
    return NextResponse.json({ error: 'server not configured for account creation' }, { status: 500 })
  }

  // ── 8. Create the auth user via invite (no password is ever generated) ──
  const { data: inviteData, error: inviteError } = await admin.auth.admin.inviteUserByEmail(email, {
    redirectTo: `${request.nextUrl.origin}/login`,
    data: { name, clinic_id: clinicId, role: 'practitioner' },
  })

  if (inviteError) {
    const msg = (inviteError.message || '').toLowerCase()
    if (msg.includes('already registered') || msg.includes('already been registered')) {
      return NextResponse.json({ error: 'email already registered' }, { status: 409 })
    }
    return NextResponse.json({ error: 'failed to create account' }, { status: 500 })
  }

  const authUserId = inviteData?.user?.id

  // inviteUserByEmail normally returns the user; fall back to a lookup if not.
  let resolvedUserId: string | null | undefined = authUserId
  if (!resolvedUserId) {
    const { data: listData } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 })
    const found = listData?.users?.find(u => (u.email || '').toLowerCase() === email)
    resolvedUserId = found?.id || undefined
  }
  if (!resolvedUserId) {
    return NextResponse.json({ error: 'failed to resolve created account' }, { status: 500 })
  }

  // ── 9. Atomic RPC: users + clinic_memberships + practitioners (1 txn) ──
  // Cast args: the generated Database types are not installed, so the
  // untyped admin client would reject any params object.
  const { data: rpcData, error: rpcError } = await admin.rpc('create_practitioner_account', {
    p_caller_user_id: user.id,
    p_user_id: resolvedUserId,
    p_clinic_id: clinicId,
    p_name: name,
    p_email: email,
    p_phone: phone,
    p_branch_ids: branchIds,
    p_is_active: true,
  } as any)

  if (rpcError) {
    // ── 10. Compensate: remove the orphan auth user created in step 8 ──
    try {
      await admin.auth.admin.deleteUser(resolvedUserId)
    } catch {
      // best-effort compensation; log server-side only
      console.error('Compensation deleteUser failed for', resolvedUserId)
    }
    const msg = (rpcError.message || '').toLowerCase()
    if (msg.includes('already exists') || msg.includes('duplicate')) {
      return NextResponse.json({ error: 'email already registered' }, { status: 409 })
    }
    return NextResponse.json({ error: 'failed to create practitioner' }, { status: 500 })
  }

  const practitioner = Array.isArray(rpcData) ? rpcData[0] : rpcData
  if (!practitioner) {
    return NextResponse.json({ error: 'failed to create practitioner' }, { status: 500 })
  }

  // ── 11. Return only safe practitioner data (no secrets, no passwords) ──
  return NextResponse.json({ practitioner }, { status: 201 })
}