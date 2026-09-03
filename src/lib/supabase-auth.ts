'use client'

import { getSupabase } from './supabase'

// ═══ Register new user ═══
export async function supabaseRegister(data: {
  email: string
  password: string
  name: string
  phone?: string
  clinicName: string
  clinicType: string
}): Promise<{ success: boolean; error?: string; userId?: string }> {
  const sb = getSupabase()
  if (!sb) return { success: false, error: 'Supabase ไม่ได้เชื่อมต่อ' }

  // 1. Create auth user
  const { data: authData, error: authError } = await sb.auth.signUp({
    email: data.email,
    password: data.password,
    options: {
      data: { name: data.name, phone: data.phone }
    }
  })

  if (authError) {
    console.error('Supabase Auth signup error:', authError)
    return { success: false, error: authError.message }
  }
  if (!authData.user) return { success: false, error: 'ไม่สามารถสร้างบัญชีได้' }

  const userId = authData.user.id

  // 2. Create user record in our users table
  const { error: userError } = await sb.from('users').insert({
    id: userId,
    email: data.email,
    name: data.name,
    phone: data.phone || '',
    force_password_change: true,
  })

  if (userError) {
    console.error('Failed to create user record:', userError)
    // Don't fail - auth user was created
  }

  // 3. Create clinic
  const clinicId = `clinic-${Date.now()}`
  const { error: clinicError } = await sb.from('clinics').insert({
    id: clinicId,
    name: data.clinicName,
    type: data.clinicType,
    color: '#E91E63',
    icon: '🏥',
    prefix: 'E',
  })

  if (clinicError) {
    console.error('Failed to create clinic:', clinicError)
  }

  // 4. Create membership (owner)
  const { error: memberError } = await sb.from('clinic_memberships').insert({
    id: `mem-${Date.now()}`,
    user_id: userId,
    clinic_id: clinicId,
    role: 'owner',
    is_active: true,
  })

  if (memberError) {
    console.error('Failed to create membership:', memberError)
  }

  // 5. Initialize clinic-specific localStorage data
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
      id: userId,
      email: data.email,
      name: data.name,
      phone: data.phone || '',
      createdAt: new Date().toISOString(),
      roles: ['owner'],
      branchIds: [],
      isActive: true,
      forcePasswordChange: true,
    }
    localStorage.setItem(`clinicq-users-with-roles-${clinicId}`, JSON.stringify([ownerUser]))
  }

  return { success: true, userId }
}

// ═══ Login ═══
export async function supabaseLogin(
  email: string,
  password: string
): Promise<{ success: boolean; error?: string; user?: any; clinicId?: string }> {
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

  if (!memberships || memberships.length === 0) {
    return { success: false, error: 'ไม่มีสิทธิ์เข้าใช้งาน กรุณาติดต่อผู้ดูแลระบบ' }
  }

  // 4. Get first clinic
  const firstMembership = memberships[0]
  const clinicId = firstMembership.clinic_id

  return {
    success: true,
    user: {
      id: userId,
      email: authData.user.email,
      name: userProfile?.name || authData.user.user_metadata?.name || '',
      phone: userProfile?.phone || '',
      forcePasswordChange: userProfile?.force_password_change || false,
    },
    clinicId,
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

// ═══ Reset password ═══
export async function supabaseResetPassword(email: string): Promise<{ success: boolean; error?: string }> {
  const sb = getSupabase()
  if (!sb) return { success: false, error: 'Supabase ไม่ได้เชื่อมต่อ' }

  const { error } = await sb.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/login`,
  })

  if (error) return { success: false, error: error.message }
  return { success: true }
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
