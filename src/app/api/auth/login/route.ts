import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createClient } from '@/utils/supabase/server'

export const dynamic = 'force-dynamic'

/**
 * POST /api/auth/login
 *
 * Accepts either:
 *   - email + password   → owner / email-based user login
 *   - username + password → staff/manager/counter/practitioner login
 *
 * Staff login is resolved server-side: username → staff_usernames →
 * auth user_id → auth email → signInWithPassword. The client never
 * reads the staff_usernames table directly.
 *
 * Returns a session cookie + lightweight profile so the frontend can
 * initialize the app session. No password is ever returned.
 */

export async function POST(request: NextRequest) {
  const cookieStore = await cookies()
  const sb = createClient(cookieStore)

  // ── 1. Parse input ─────────────────────────────────────────
  let body: any
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const identifier = typeof body?.identifier === 'string' ? body.identifier.trim() : ''
  const password = typeof body?.password === 'string' ? body.password : ''

  if (!identifier || !password) {
    return NextResponse.json({ error: 'identifier and password are required' }, { status: 400 })
  }

  // ── 2. Super-lightweight input classification ───────────────
  // Treat strings containing '@' as email, everything else as username.
  // This is only classification for routing, not security enforcement.
  const isEmailLike = identifier.includes('@') && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(identifier)

  let authEmail: string
  if (isEmailLike) {
    authEmail = identifier
  } else {
    // Staff username login: resolve username → auth email on server.
    const resolved = await resolveUsername(identifier)
    if (!resolved) {
      // Do NOT reveal whether the username exists. Use a generic failure
      // message to avoid username enumeration.
      return NextResponse.json(
        { error: 'Identifier or password is not correct' },
        { status: 401 }
      )
    }
    authEmail = resolved.authEmail
  }

  // ── 3. Authenticate via Supabase Auth only ──────────────────
  // Supabase Auth is the only component that checks the password.
  const { data: authData, error: authError } = await sb.auth.signInWithPassword({
    email: authEmail,
    password,
  })

  if (authError || !authData.user) {
    return NextResponse.json(
      { error: 'Identifier or password is not correct' },
      { status: 401 }
    )
  }

  const authUserId = authData.user.id
  const supabaseEmail = (authData.user.email || '').toLowerCase()

  // ── 4. Build app session: user profile + memberships + clinics ──
  // We mirror the app-level session shape used by auth-context so the
  // frontend can initialize from this response without a second fetch.
  const { data: profile } = await sb.from('users')
    .select('*')
    .eq('id', authUserId)
    .single()

  const { data: memberships } = await sb.from('clinic_memberships')
    .select('*, clinics(*)')
    .eq('user_id', authUserId)
    .eq('is_active', true)

  const appUser = {
    id: authUserId,
    email: supabaseEmail,
    name: profile?.name || authData.user.user_metadata?.name || '',
    phone: profile?.phone || '',
    forcePasswordChange: profile?.force_password_change || false,
  }

  let freshMemberships: Array<{ id: string; userId: string; clinicId: string; role: string; isActive: boolean; createdAt: string }> = []
  let freshClinics: Array<{ id: string; name: string; type: string; color: string; ownerId: string; isActive: boolean }> = []

  if (memberships?.length) {
    freshMemberships = memberships.map((m: any) => ({
      id: m.id,
      userId: m.user_id,
      clinicId: m.clinic_id,
      role: m.role,
      isActive: m.is_active,
      createdAt: m.created_at,
    }))
    freshClinics = memberships
      .filter((m: any) => m.clinics)
      .map((m: any) => ({
        id: m.clinics.id,
        name: m.clinics.name,
        type: m.clinics.type,
        color: m.clinics.color || '#E91E63',
        ownerId: authUserId,
        isActive: true,
      }))
  }

  // ── 5. Decide current clinic (same rules as auth-context) ────
  let currentClinicId: string | null = null
  let needsClinicSelection = false

  if (freshMemberships.length === 1) {
    currentClinicId = freshMemberships[0].clinicId
  } else if (freshMemberships.length > 1) {
    const lastClinicId = cookieStore.get('clinicq-last-clinic-id')?.value || null
    if (lastClinicId && freshMemberships.some(m => m.clinicId === lastClinicId)) {
      currentClinicId = lastClinicId
    } else {
      needsClinicSelection = true
    }
  }

  const appSession = {
    user: appUser,
    currentClinicId,
    needsClinicSelection,
  }

  // ── 6. Persist session cookie (Supabase already set cookie via signInWithPassword) ──
  // The Supabase client already set the auth cookies in the response. We also
  // store the app session shape in a separate cookie so the client can hydrate
  // auth-context on page load without another round trip.
  const appSessionJson = JSON.stringify(appSession)
  const appSessionCookie = cookieStore.set('clinicq-app-session', appSessionJson, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 30, // 30 days, mirrored to auth session lifetime
  })

  return NextResponse.json(
    {
      user: appUser,
      currentClinicId,
      needsClinicSelection,
      forcePasswordChange: appUser.forcePasswordChange,
      memberships: freshMemberships,
      clinics: freshClinics,
    },
    {
      status: 200,
      headers: {
        'Set-Cookie': appSessionCookie.toString(),
      },
    }
  )
}

// ────────────────────────────────────────────────────────────────
// Private helpers
// ────────────────────────────────────────────────────────────────

/**
 * Resolve a staff username to the auth email used by Supabase Auth.
 *
 * Reads public.staff_usernames via the service-role client so that
 * client components never access the mapping table directly.
 *
 * Returns the resolved auth email (the synthetic email used when the
 * staff account was created) or failure.
 */
async function resolveUsername(username: string): Promise<{ authEmail: string } | null> {
  const { getAdminClient } = await import('@/lib/supabase-admin')
  const admin = getAdminClient()
  if (!admin) return null

  // Cast as any: generated admin types are not installed in this project.
  const db = admin as any

  const { data: row, error } = await db.from('staff_usernames')
    .select('user_id')
    .eq('username', username)
    .maybeSingle()

  if (error || !row) return null

  // Get the auth email for this user_id from auth.users via the admin client.
  const { data: authUser } = await db.auth.admin.getUserById(row.user_id)
  if (!authUser?.user?.email) return null

  return { authEmail: authUser.user.email.toLowerCase() }
}
