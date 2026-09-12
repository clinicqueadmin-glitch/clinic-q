'use client'

import { getSupabase } from './supabase'

// Where Supabase should redirect the user after clicking the email
// confirmation link. The /auth/callback route exchanges the code and
// lands the user back on the registration flow to finish setup.
function getEmailRedirectTo(): string {
  if (typeof window === 'undefined') return ''
  return `${window.location.origin}/auth/callback`
}

// ═══ Register new user ═══
//
// Behavior depends on whether Supabase has "Confirm email" enabled:
//   - Confirmation OFF → signUp returns a session immediately → clinic +
//     owner membership are created right away (same as before).
//   - Confirmation ON  → signUp returns NO session yet → we return
//     needsEmailConfirmation so the UI can show "check your email".
//     Clinic creation is deferred to supabaseCompleteRegistration()
//     which runs after the user confirms (via /auth/callback).
//
export async function supabaseRegister(data: {
  email: string
  password: string
  name: string
  phone?: string
  clinicName: string
  clinicType: string
}): Promise<{ success: boolean; error?: string; userId?: string; clinicId?: string; needsEmailConfirmation?: boolean }> {
  const sb = getSupabase()
  if (!sb) return { success: false, error: 'Supabase ไม่ได้เชื่อมต่อ' }

  // 1. Create auth user (with email confirmation redirect)
  const { data: authData, error: authError } = await sb.auth.signUp({
    email: data.email,
    password: data.password,
    options: {
      data: { name: data.name, phone: data.phone },
      emailRedirectTo: getEmailRedirectTo(),
    },
  })

  if (authError) {
    console.error('Supabase Auth signup error:', authError)
    return { success: false, error: authError.message }
  }
  if (!authData.user) return { success: false, error: 'ไม่สามารถสร้างบัญชีได้' }

  const userId = authData.user.id

  // Email confirmation required → no session yet. Defer clinic creation.
  if (!authData.session) {
    return { success: true, userId, needsEmailConfirmation: true }
  }

  // Confirmation disabled → session exists, create clinic now.
  const created = await createClinicAndOwner(sb, {
    userId,
    email: data.email,
    name: data.name,
    phone: data.phone || '',
    clinicName: data.clinicName,
    clinicType: data.clinicType,
  })
  if (!created.success) return created
  return { success: true, userId, clinicId: created.clinicId }
}

// ═══ Complete registration after email confirmation ═══
// Called by /register?confirmed=1 (after /auth/callback exchanged the code).
// Idempotent: if the clinic/owner already exist for this user it returns
// the existing clinic instead of creating duplicates.
export async function supabaseCompleteRegistration(data: {
  userId: string
  email: string
  name: string
  phone?: string
  clinicName: string
  clinicType: string
}): Promise<{ success: boolean; error?: string; clinicId?: string }> {
  const sb = getSupabase()
  if (!sb) return { success: false, error: 'Supabase ไม่ได้เชื่อมต่อ' }

  // Must have a confirmed session to create the clinic
  const { data: { session } } = await sb.auth.getSession()
  if (!session) {
    return { success: false, error: 'กรุณายืนยันอีเมลก่อนดำเนินการต่อ' }
  }

  // Idempotent: if the owner already has a membership, reuse that clinic
  const { data: existingMembership } = await sb
    .from('clinic_memberships')
    .select('clinic_id')
    .eq('user_id', data.userId)
    .eq('role', 'owner')
    .eq('is_active', true)
    .maybeSingle()

  if (existingMembership?.clinic_id) {
    return { success: true, clinicId: existingMembership.clinic_id }
  }

  return createClinicAndOwner(sb, {
    userId: data.userId,
    email: data.email,
    name: data.name,
    phone: data.phone || '',
    clinicName: data.clinicName,
    clinicType: data.clinicType,
  })
}

// ═══ Stable clinic code (used for default usernames like MD4827-manager) ═══
function generateClinicCode(clinicType?: string): string {
  const prefix = clinicType === 'dental' ? 'DT'
    : clinicType === 'medical' ? 'MD'
    : clinicType === 'aesthetic' ? 'AE'
    : clinicType === 'thai' ? 'TH'
    : clinicType === 'chinese' ? 'CH'
    : clinicType === 'physical' ? 'PH'
    : 'CL'
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let suffix = ''
  if (typeof crypto !== 'undefined' && 'getRandomValues' in crypto) {
    const array = new Uint8Array(4)
    crypto.getRandomValues(array)
    for (let i = 0; i < 4; i++) {
      suffix += chars[array[i] % chars.length]
    }
  } else {
    suffix = Math.random().toString(36).slice(2, 6).toUpperCase()
  }
  return prefix + suffix
}

// ═══ Shared: create users row + clinic + owner membership ═══
// Deterministic IDs (based on the auth user id) so a retry cannot create
// a second clinic or a second owner membership.
async function createClinicAndOwner(
  sb: NonNullable<ReturnType<typeof getSupabase>>,
  data: {
    userId: string
    email: string
    name: string
    phone: string
    clinicName: string
    clinicType: string
  }
): Promise<{ success: boolean; error?: string; clinicId?: string }> {
  const clinicId = `clinic-${data.userId}`
  const clinicCode = generateClinicCode(data.clinicType)

  // 1. Create user record in our users table (idempotent)
  await sb.from('users').upsert(
    {
      id: data.userId,
      email: data.email,
      name: data.name,
      phone: data.phone || '',
      force_password_change: false,
    },
    { onConflict: 'id' }
  )

  // 2. Create clinic (idempotent) — stable code powers default usernames
  await sb.from('clinics').upsert(
    {
      id: clinicId,
      name: data.clinicName,
      type: data.clinicType,
      color: '#E91E63',
      icon: '🏥',
      prefix: 'E',
      code: clinicCode,
    },
    { onConflict: 'id' }
  )

  // 3. Create membership (owner) — idempotent via unique(user_id, clinic_id, role)
  const { error: memberError } = await sb.from('clinic_memberships').upsert(
    {
      id: `mem-${data.userId}-owner`,
      user_id: data.userId,
      clinic_id: clinicId,
      role: 'owner',
      is_active: true,
    },
    { onConflict: 'id' }
  )

  if (memberError) {
    console.error('Failed to create membership:', memberError)
    return { success: false, error: 'ไม่สามารถสร้างสมาชิกคลินิกได้ กรุณาลองอีกครั้ง' }
  }

  // 4. Initialize clinic-specific localStorage data
  if (typeof window !== 'undefined') {
    // Set clinic type
    localStorage.setItem('clinic-q-type', data.clinicType)
    
    // Store trial end date (30 days from now)
    const trialEnd = new Date()
    trialEnd.setDate(trialEnd.getDate() + 30)
    localStorage.setItem(`clinicq-subscription-${clinicId}`, JSON.stringify({
      plan: 'trial',
      status: 'active',
      startDate: new Date().toISOString(),
      trialEndDate: trialEnd.toISOString(),
      paidEndDate: null,
    }))
    
    // Initialize clinic settings with clinic name (clinic-specific)
    localStorage.setItem(`clinic-q-settings-${clinicId}`, JSON.stringify({
      clinicName: data.clinicName,
      logo: '',
      operatingDays: ['mon', 'tue', 'wed', 'thu', 'fri'],
      openTime: '08:00',
      closeTime: '20:00',
      weeklySchedule: {
        mon: { enabled: true, openTime: '08:00', closeTime: '20:00' },
        tue: { enabled: true, openTime: '08:00', closeTime: '20:00' },
        wed: { enabled: true, openTime: '08:00', closeTime: '20:00' },
        thu: { enabled: true, openTime: '08:00', closeTime: '20:00' },
        fri: { enabled: true, openTime: '08:00', closeTime: '20:00' },
        sat: { enabled: false, openTime: '09:00', closeTime: '17:00' },
        sun: { enabled: false, openTime: '09:00', closeTime: '17:00' },
      },
    }))
    
    // Initialize default rooms for this clinic
    const defaultRooms = [
      { id: 1, name: 'ห้อง 1', color: '#0891B2', branchId: '', practitionerId: '', slotDuration: 30, workingStartTime: '09:00', workingEndTime: '17:00', active: true },
      { id: 2, name: 'ห้อง 2', color: '#10B981', branchId: '', practitionerId: '', slotDuration: 30, workingStartTime: '09:00', workingEndTime: '17:00', active: true },
      { id: 3, name: 'ห้อง 3', color: '#F59E0B', branchId: '', practitionerId: '', slotDuration: 30, workingStartTime: '09:00', workingEndTime: '17:00', active: true },
    ]
    localStorage.setItem(`clinic-rooms-${clinicId}`, JSON.stringify(defaultRooms))
    
    // Initialize user list with owner (registrant)
    const ownerUser = {
      id: data.userId,
      email: data.email,
      name: data.name,
      phone: data.phone || '',
      createdAt: new Date().toISOString(),
      roles: ['owner'],
      branchIds: [],
      isActive: true,
      forcePasswordChange: false,
    }
    localStorage.setItem(`clinicq-users-with-roles-${clinicId}`, JSON.stringify([ownerUser]))
  }

  return { success: true, clinicId }
}

// ═══ Resend email confirmation ═══
export async function supabaseResendConfirmation(email: string): Promise<{ success: boolean; error?: string }> {
  const sb = getSupabase()
  if (!sb) return { success: false, error: 'Supabase ไม่ได้เชื่อมต่อ' }

  const { error } = await sb.auth.resend({
    type: 'signup',
    email,
    options: { emailRedirectTo: getEmailRedirectTo() },
  })

  if (error) return { success: false, error: error.message }
  return { success: true }
}

// ═══ Platform owner emails — allowed to log in without any clinic membership ═══
const PLATFORM_OWNER_EMAILS = ['sakarinmam999@gmail.com', 'clinicque.admin@gmail.com']

// ═══ Login ═══
export async function supabaseLogin(
  email: string,
  password: string
): Promise<{ success: boolean; error?: string; user?: any; clinicId?: string | null; memberships?: any[] }> {
  const sb = getSupabase()
  if (!sb) return { success: false, error: 'Supabase ไม่ได้เชื่อมต่อ' }

  // 1. Sign in with Supabase Auth
  const { data: authData, error: authError } = await sb.auth.signInWithPassword({
    email,
    password,
  })

  if (authError) return { success: false, error: 'อีเมลหรือรหัสผ่านไม่ถูกต้อง' }
  if (!authData.user) return { success: false, error: 'ไม่พบบัญชีผู้ใช้' }

  const userId = authData.user.id
  const normalizedEmail = (authData.user.email || email).toLowerCase()
  const isPlatformOwner = PLATFORM_OWNER_EMAILS.includes(normalizedEmail)

  // 2. Get user profile from our users table
  const { data: userProfile } = await sb.from('users')
    .select('*')
    .eq('id', userId)
    .single()

  // 3. Get user's memberships
  const { data: memberships } = await sb.from('clinic_memberships')
    .select('*, clinics(*)')
    .eq('user_id', userId)
    .eq('is_active', true)

  const userInfo = {
    id: userId,
    email: authData.user.email,
    name: userProfile?.name || authData.user.user_metadata?.name || '',
    phone: userProfile?.phone || '',
    forcePasswordChange: userProfile?.force_password_change || false,
  }

  // Platform owner is allowed without any clinic membership
  if (!memberships || memberships.length === 0) {
    if (isPlatformOwner) {
      return { success: true, user: userInfo, clinicId: null, memberships: [] }
    }
    return { success: false, error: 'ไม่มีสิทธิ์เข้าใช้งาน กรุณาติดต่อผู้ดูแลระบบ' }
  }

  // 4. Get first clinic
  const firstMembership = memberships[0]
  const clinicId = firstMembership.clinic_id

  return {
    success: true,
    user: userInfo,
    clinicId,
    memberships,
  }
}

// ═══ Logout ═══
export async function supabaseLogout(): Promise<void> {
  const sb = getSupabase()
  if (sb) await sb.auth.signOut()
}

// ═══ Get current session ═══
export async function supabaseGetSession() {
  const sb = getSupabase()
  if (!sb) return null

  const { data: { session } } = await sb.auth.getSession()
  return session
}

// ═══ Reset password — request a recovery email ═══
export async function supabaseResetPassword(email: string): Promise<{ success: boolean; error?: string }> {
  const sb = getSupabase()
  if (!sb) return { success: false, error: 'Supabase ไม่ได้เชื่อมต่อ' }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || window.location.origin
  const { error } = await sb.auth.resetPasswordForEmail(email, {
    redirectTo: `${siteUrl}/login`,
  })

  if (error) return { success: false, error: error.message }
  return { success: true }
}

// ═══ Password recovery — detect that we arrived via a recovery link ═══
// Supabase appends `#access_token=...&type=recovery` to the redirect URL
// (implicit flow), or `?code=...` (PKCE flow). Both are handled here.
export function isRecoveryRedirect(): boolean {
  if (typeof window === 'undefined') return false
  const hashParams = new URLSearchParams(window.location.hash.substring(1))
  if (hashParams.get('type') === 'recovery') return true
  const searchParams = new URLSearchParams(window.location.search)
  return searchParams.get('type') === 'recovery' || searchParams.get('code') !== null
}

// ═══ Password recovery — wait for the recovery session to be ready ═══
// Supabase recovery emails use the implicit flow and put the tokens in the
// URL hash (#access_token=...&refresh_token=...&type=recovery).
// The @supabase/ssr browser client hardcodes flowType 'pkce', so it refuses
// to process an implicit-grant URL ("Not a valid PKCE flow url.") and never
// creates a session. We therefore read the hash ourselves and hand the tokens
// to setSession(), which has no flow-type gate.
export async function getRecoverySession(retries = 12): Promise<any> {
  const sb = getSupabase()
  if (!sb) return null

  // 1) Already have a session (e.g. the client handled a PKCE ?code= link)
  const { data: { session: existing } } = await sb.auth.getSession()
  if (existing) return existing

  // 2) Adopt implicit-flow tokens from the URL hash that the PKCE client ignores
  if (typeof window !== 'undefined') {
    const hashParams = new URLSearchParams(window.location.hash.substring(1))
    const accessToken = hashParams.get('access_token')
    const refreshToken = hashParams.get('refresh_token')
    if (accessToken && refreshToken) {
      const { data, error } = await sb.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken,
      })
      if (!error && data?.session) return data.session
    }
  }

  // 3) Fall back to polling briefly so the login page can proceed
  for (let i = 0; i < retries; i++) {
    const { data: { session } } = await sb.auth.getSession()
    if (session) return session
    await new Promise(r => setTimeout(r, 200))
  }
  return null
}

// ═══ Update password ═══
export async function supabaseUpdatePassword(newPassword: string): Promise<{ success: boolean; error?: string }> {
  const sb = getSupabase()
  if (!sb) return { success: false, error: 'Supabase ไม่ได้เชื่อมต่อ' }

  const { error } = await sb.auth.updateUser({ password: newPassword })
  if (error) return { success: false, error: error.message }

  // Also update force_password_change in our users table
  const { data: { user } } = await sb.auth.getUser()
  if (user) {
    await sb.from('users').update({ force_password_change: false }).eq('id', user.id)
  }

  return { success: true }
}
