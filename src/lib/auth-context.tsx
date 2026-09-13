'use client'

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react'
import type { AuthChangeEvent, Session as SupabaseSessionType } from '@supabase/supabase-js'
import { 
  type User, 
  type Clinic, 
  type ClinicMembership, 
  type ClinicRole, 
  type PlatformRole,
  type AuthSession 
} from './auth-types'
import { supabaseLogout, supabaseResetPassword, supabaseUpdatePassword } from './supabase-auth'
import { getSupabase, isSupabaseReady } from './supabase'
import { getTodayICT } from './clinic-data'

interface AuthContextType {
  session: AuthSession | null
  user: User | null
  currentClinicId: string | null
  currentRole: ClinicRole | PlatformRole | null
  isAuthenticated: boolean
  isLoading: boolean
  forcePasswordChange: boolean
  // True when the Supabase data layer (PostgREST) is temporarily unavailable
  // while the Auth session itself is still valid. The user stays signed in.
  restUnavailable: boolean
  retryRest: () => Promise<void>
  
  // Login/Logout
  login: (identifier: string, password: string) => Promise<{ success: boolean; error?: string; needsClinicSelection?: boolean }>
  logout: () => Promise<void>
  updatePassword: (newPassword: string) => void
  resetPasswordByEmail: (email: string) => Promise<{ success: boolean; error?: string }>
  
  // Clinic Management
  switchClinic: (clinicId: string) => void
  getUserClinics: () => Clinic[]
  getCurrentMembership: () => ClinicMembership | null
  
  // Role Management (Owner only)
  getRoleInClinic: (userId: string, clinicId: string) => ClinicRole | null
  setRoleInClinic: (userId: string, clinicId: string, role: ClinicRole) => void
  
  // Clinic Selection (for users with multiple clinics)
  getSelectableClinics: () => Clinic[]
  selectClinic: (clinicId: string) => void
  needsClinicSelection: boolean
  
  // User Management (for Owner/Manager)
  addUser: (userData: { name: string; email: string; phone?: string; role: ClinicRole }) => User | null
}

const AuthContext = createContext<AuthContextType | null>(null)

// No demo data - system is empty until real users are created

const STORAGE_KEYS = {
  AUTH: 'clinicq-auth',
  USERS: 'clinicq-users',
  CLINICS: 'clinicq-clinics',
  MEMBERSHIPS: 'clinicq-memberships',
}

// Platform owner accounts — full system access, no clinic membership required
const PLATFORM_OWNER_EMAILS = ['sakarinmam999@gmail.com', 'clinicque.admin@gmail.com']

// ═══ Data-layer failure detection ═══
// Distinguishes "PostgREST is temporarily unavailable" from "this user really has
// no access". A failed query must NEVER be read as "no permission".
function isRestUnavailableError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false
  const e = error as { code?: string; message?: string; status?: number }
  const msg = (e.message || '').toLowerCase()
  if (e.code === 'PGRST303') return true
  if (msg.includes('jwt issued at future')) return true
  if (e.status === 401) return true
  if (msg.includes('failed to fetch')) return true
  if (msg.includes('networkerror')) return true
  return false
}

function loadFromStorage<T>(key: string, defaultValue: T): T {
  if (typeof window === 'undefined') return defaultValue
  try {
    const saved = localStorage.getItem(key)
    if (saved) {
      const parsed = JSON.parse(saved)
      if (Array.isArray(parsed) ? parsed.length > 0 : typeof parsed === 'object') {
        return parsed
      }
    }
  } catch {}
  return defaultValue
}

function saveToStorage(key: string, data: unknown) {
  if (typeof window !== 'undefined') {
    localStorage.setItem(key, JSON.stringify(data))
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<AuthSession | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [needsClinicSelection, setNeedsClinicSelection] = useState(false)
  const [forcePasswordChange, setForcePasswordChange] = useState(false)
  const [restUnavailable, setRestUnavailable] = useState(false)
  
  // Data stores (Supabase is the source of truth; localStorage is only a cache)
  const [users, setUsers] = useState<User[]>(() => loadFromStorage(STORAGE_KEYS.USERS, []))
  const [clinics, setClinics] = useState<Clinic[]>(() => loadFromStorage(STORAGE_KEYS.CLINICS, []))
  const [memberships, setMemberships] = useState<ClinicMembership[]>(() => loadFromStorage(STORAGE_KEYS.MEMBERSHIPS, []))
  
  // ═══ Restore the app session from a valid Supabase session (source of truth) ═══
  // The Supabase Auth session (cookies) is authoritative. This rebuilds the app-level
  // session (user profile + memberships + current clinic) the same way login() does,
  // so a page refresh or the password-recovery flow lands the user on the dashboard
  // without requiring a second login.
  const restoreFromSupabaseSession = useCallback(async (supabaseUserId: string, supabaseEmail: string) => {
    const sb = getSupabase()
    if (!sb) return

    // 1. User profile from users table
    const { data: profile, error: profileError } = await sb
      .from('users')
      .select('*')
      .eq('id', supabaseUserId)
      .single()

    const user: User = {
      id: supabaseUserId,
      email: supabaseEmail,
      name: profile?.name || '',
      phone: profile?.phone || '',
      createdAt: new Date().toISOString(),
      forcePasswordChange: profile?.force_password_change || false,
    }

    // 2. Memberships + clinics from Supabase
    const { data: memberships, error: membershipsError } = await sb
      .from('clinic_memberships')
      .select('*, clinics(*)')
      .eq('user_id', supabaseUserId)
      .eq('is_active', true)

    // ═══ Data layer unavailable → do NOT treat this as "no access" ═══
    // A failed query (e.g. 401 PGRST303 "JWT issued at future") proves nothing
    // about the user's permissions. The Supabase Auth session is still valid, so
    // keep the user signed in with the last known app session rather than wiping
    // the session and bouncing them to /login. Recovery is automatic — see the
    // retryRest effect below.
    if (profileError || membershipsError) {
      const err = (membershipsError || profileError) as any
      console.warn(
        isRestUnavailableError(err)
          ? '[auth] Supabase REST unavailable — keeping session, NOT logging out:'
          : '[auth] profile/membership query failed — keeping session, NOT logging out:',
        err?.code || err?.status || '',
        err?.message || err || ''
      )

      // Only trust the cached app session when it belongs to this same account —
      // on a shared browser it may hold a different user's last clinic.
      const cached = loadFromStorage<AuthSession | null>(STORAGE_KEYS.AUTH, null)
      const sameAccount = cached?.user?.id === supabaseUserId ? cached : null
      setSession({
        user: {
          ...user,
          name: user.name || sameAccount?.user?.name || '',
          phone: user.phone || sameAccount?.user?.phone || '',
          createdAt: sameAccount?.user?.createdAt || user.createdAt,
        },
        // Best-effort clinic pointer so the app shell can still render.
        currentClinicId: sameAccount?.currentClinicId || null,
      })
      setRestUnavailable(true)
      return
    }

    let freshMemberships: ClinicMembership[] = []
    let freshClinics: Clinic[] = []
    if (memberships) {
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
          ownerId: supabaseUserId,
          isActive: true,
        }))
    }

    // Platform owner may log in without any clinic membership
    const isPlatformOwner = PLATFORM_OWNER_EMAILS.includes(supabaseEmail.toLowerCase())
    if (freshMemberships.length === 0 && !isPlatformOwner) {
      // Supabase session exists but the user has no access — treat as logged out
      setSession(null)
      setNeedsClinicSelection(false)
      setForcePasswordChange(false)
      localStorage.removeItem(STORAGE_KEYS.AUTH)
      return
    }

    // 3. Decide current clinic (same rules as login())
    let currentClinicId: string | null = null
    let needsSelection = false
    if (freshMemberships.length === 1) {
      currentClinicId = freshMemberships[0].clinicId
    } else if (freshMemberships.length > 1) {
      const lastClinicId = localStorage.getItem('clinicq-last-clinic-id')
      if (lastClinicId && freshMemberships.some(m => m.clinicId === lastClinicId)) {
        currentClinicId = lastClinicId
      } else {
        needsSelection = true
      }
    }

    setRestUnavailable(false)
    setMemberships(freshMemberships)
    setClinics(freshClinics)

    const appSession: AuthSession = { user, currentClinicId }
    setSession(appSession)
    localStorage.setItem(STORAGE_KEYS.AUTH, JSON.stringify(appSession))
    setNeedsClinicSelection(needsSelection)
    // NOTE: force_password_change is no longer enforced (MVP). Users can log
    // in immediately with the password they were given.

    // 4. Keep the clinic-type cache in sync with the clinic this session actually
    //    resolves to (same rule as login()). Without this, a type left over from
    //    a previous session survives a reload and type-keyed readers show the
    //    wrong clinic. The type is only ever derived FROM the resolved
    //    membership — never the reverse, and never guessed when nothing resolves.
    const activeClinic = freshClinics.find(c => c.id === currentClinicId)
    if (activeClinic?.type) {
      localStorage.setItem('clinic-q-type', activeClinic.type)
    }
  }, [])

  // ═══ Re-check the data layer on demand ═══
  // Safe to call any time: it only re-runs the session restore. If REST answers
  // again, the session is rebuilt from real data and restUnavailable clears.
  const retryRest = useCallback(async () => {
    try {
      const sb = getSupabase()
      if (!sb) return
      const { data: { session: supabaseSession } } = await sb.auth.getSession()
      if (!supabaseSession?.user) return
      await restoreFromSupabaseSession(supabaseSession.user.id, supabaseSession.user.email || '')
    } catch (err) {
      // Never let a retry reject — it is fired from focus/visibility listeners.
      console.warn('[auth] data-layer retry failed:', err)
    }
  }, [restoreFromSupabaseSession])

  // ═══ Auto-recover when the user returns to the tab ═══
  // While the data layer is down we re-check on focus/visibility instead of
  // polling blindly, so the app returns to normal as soon as Supabase responds.
  useEffect(() => {
    if (!restUnavailable || typeof window === 'undefined') return
    const recheck = () => {
      if (document.visibilityState === 'visible') void retryRest()
    }
    window.addEventListener('focus', recheck)
    document.addEventListener('visibilitychange', recheck)
    return () => {
      window.removeEventListener('focus', recheck)
      document.removeEventListener('visibilitychange', recheck)
    }
  }, [restUnavailable, retryRest])

  // ═══ Initialize auth: Supabase session is the source of truth ═══
  // Subscribe to onAuthStateChange so the app session is restored immediately
  // when Supabase establishes a session (page refresh, tab switch, or the
  // password-recovery flow — all of which set the cookie-based session without
  // writing the old localStorage entry).
  useEffect(() => {
    let cancelled = false
    let sb: ReturnType<typeof getSupabase> | null = null

    const init = async () => {
      sb = getSupabase()
      if (!sb) {
        // Supabase not configured — fall back to the localStorage cache
        const saved = loadFromStorage<AuthSession | null>(STORAGE_KEYS.AUTH, null)
        if (saved) {
          const freshUser = users.find(u => u.id === saved.user.id)
          if (freshUser) {
            setSession({ ...saved, user: freshUser })
          } else {
            setSession(saved)
          }
        }
        setIsLoading(false)
        return
      }

      // Restore an existing Supabase session (cookies) first — covers page
      // refresh and the password-recovery flow, which establishes a valid
      // session without ever writing the old localStorage entry.
      const { data: { session: supabaseSession } } = await sb.auth.getSession()
      if (cancelled) return
      if (supabaseSession?.user) {
        await restoreFromSupabaseSession(supabaseSession.user.id, supabaseSession.user.email || '')
      } else {
        const saved = loadFromStorage<AuthSession | null>(STORAGE_KEYS.AUTH, null)
        if (saved) {
          const freshUser = users.find(u => u.id === saved.user.id)
          if (freshUser) {
            setSession({ ...saved, user: freshUser })
          } else {
            setSession(saved)
          }
        }
      }
      setIsLoading(false)
    }

    init()

    // Subscribe after the initial restore so we pick up any later session changes
    // (another tab logging in/out, recovery session established, etc.).
    let authSub: { data: { subscription: { unsubscribe: () => void } } } | null = null
    if (sb) {
      authSub = sb.auth.onAuthStateChange(async (event: AuthChangeEvent, supabaseSession: SupabaseSessionType | null) => {
        if (cancelled) return
        if (supabaseSession?.user) {
          // A real Supabase session is authoritative — rebuild the app session.
          await restoreFromSupabaseSession(supabaseSession.user.id, supabaseSession.user.email || '')
        } else if (event === 'INITIAL_SESSION') {
          // INITIAL_SESSION is only an echo of the current Supabase client state.
          // It fires (often with null) immediately after subscription — before
          // init() has finished restoring the app session from the localStorage
          // fallback. Wiping here would log out a user whose session was just
          // restored (e.g. staff logins whose session lives server-side).
          // init() owns the restore decision; a genuine sign-out (SIGNED_OUT /
          // another tab) still takes the branch below.
        } else {
          setSession(null)
          setNeedsClinicSelection(false)
          setForcePasswordChange(false)
          localStorage.removeItem(STORAGE_KEYS.AUTH)
        }
      })
    }

    return () => {
      cancelled = true
      authSub?.data.subscription.unsubscribe()
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps
  
  // ═══ Auto-logout at midnight (0:00 ICT / Asia/Bangkok) ═══
  // The business date is the clinic-local date, so this must use ICT (UTC+7).
  // `toISOString()` returns the UTC date, which rolls over at 00:00 UTC = 07:00 ICT
  // — signing every clinic's staff out right when clinics open.
  useEffect(() => {
    if (typeof window === 'undefined') return
    const today = getTodayICT()
    const lastLoginDate = localStorage.getItem('clinicq-last-login-date')
    // Store today's date on first load
    if (!lastLoginDate) {
      localStorage.setItem('clinicq-last-login-date', today)
    }
    // Check every minute if date changed
    const checker = setInterval(() => {
      const now = getTodayICT()
      const stored = localStorage.getItem('clinicq-last-login-date')
      if (stored && now !== stored) {
        // Date changed — force logout
        localStorage.removeItem(STORAGE_KEYS.AUTH)
        localStorage.removeItem('clinicq-last-login-date')
        setSession(null)
        setForcePasswordChange(false)
        window.location.href = '/'
      }
    }, 60000) // check every 60 seconds
    return () => clearInterval(checker)
  }, [])

  // Persist data
  useEffect(() => {
    saveToStorage(STORAGE_KEYS.USERS, users)
  }, [users])
  
  useEffect(() => {
    saveToStorage(STORAGE_KEYS.CLINICS, clinics)
  }, [clinics])
  
  useEffect(() => {
    saveToStorage(STORAGE_KEYS.MEMBERSHIPS, memberships)
  }, [memberships])
  
  // ═══ Login — supports both email (owner) and username (staff) ═══
  const login = useCallback(async (identifier: string, password: string): Promise<{ success: boolean; error?: string; needsClinicSelection?: boolean }> => {
    if (!isSupabaseReady()) {
      return { success: false, error: 'ระบบยังไม่ได้เชื่อมต่อกับฐานข้อมูล กรุณาติดต่อผู้ดูแลระบบ' }
    }

    const sb = getSupabase()
    if (!sb) {
      return { success: false, error: 'ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้' }
    }

    // For owner email login, use direct Supabase Auth
    // For staff username login, use server endpoint
    const isEmailLike = identifier.includes('@') && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(identifier)

    if (isEmailLike) {
      // Owner email login via Supabase Auth directly
      const { data: authData, error: authError } = await sb.auth.signInWithPassword({
        email: identifier,
        password,
      })

      if (authError || !authData.user) {
        // Give a clear Thai message when the email hasn't been confirmed yet
        const msg = (authError?.message || '').toLowerCase()
        if (msg.includes('email not confirmed') || msg.includes('email_not_confirmed')) {
          return { success: false, error: 'ยังไม่ได้ยืนยันอีเมล กรุณาตรวจสอบอีเมลของคุณ (รวมถึงโฟลเดอร์สแปม) แล้วคลิกลิงก์ยืนยัน' }
        }
        return { success: false, error: 'อีเมลหรือรหัสผ่านไม่ถูกต้อง' }
      }

      const supabaseUserId = authData.user.id
      const supabaseEmail = (authData.user.email || '').toLowerCase()

      const { data: profile, error: profileError } = await sb.from('users')
        .select('*')
        .eq('id', supabaseUserId)
        .single()

      const user: User = {
        id: supabaseUserId,
        email: supabaseEmail,
        name: profile?.name || authData.user.user_metadata?.name || '',
        phone: profile?.phone || '',
        createdAt: profile?.created_at ? new Date(profile.created_at).toISOString() : new Date().toISOString(),
        forcePasswordChange: profile?.force_password_change || false,
      }

      const { data: memberships, error: membershipsError } = await sb.from('clinic_memberships')
        .select('*, clinics(*)')
        .eq('user_id', supabaseUserId)
        .eq('is_active', true)

      // ═══ Data layer unavailable → this is NOT "no permission" ═══
      // Supabase Auth already accepted the credentials and issued a session, so a
      // failed membership lookup must never be reported as a permissions problem.
      // Keep the user signed in and flag the outage instead; retryRest rebuilds the
      // real memberships as soon as the data layer answers again (and the normal
      // "no access" rule below still applies when the query actually succeeds).
      if (profileError || membershipsError) {
        const err = (membershipsError || profileError) as any
        console.warn(
          isRestUnavailableError(err)
            ? '[auth] Supabase REST unavailable during login — keeping session, NOT reporting "no access":'
            : '[auth] profile/membership query failed during login — keeping session, NOT reporting "no access":',
          err?.code || err?.status || '',
          err?.message || err || ''
        )

        // Only trust the cached app session when it belongs to this same account.
        const cached = loadFromStorage<AuthSession | null>(STORAGE_KEYS.AUTH, null)
        const sameAccount = cached?.user?.id === supabaseUserId ? cached : null

        setSession({ user, currentClinicId: sameAccount?.currentClinicId || null })
        setNeedsClinicSelection(false)
        setRestUnavailable(true)
        return { success: true, needsClinicSelection: false }
      }

      let freshMemberships: ClinicMembership[] = []
      let freshClinics: Clinic[] = []
      if (memberships) {
        freshMemberships = memberships.map((m: any) => ({
          id: m.id,
          userId: m.user_id,
          clinicId: m.clinic_id,
          role: m.role,
          isActive: m.is_active,
          createdAt: m.created_at ? new Date(m.created_at).toISOString() : new Date().toISOString(),
        }))
        freshClinics = memberships
          .filter((m: any) => m.clinics)
          .map((m: any) => ({
            id: m.clinics.id,
            name: m.clinics.name,
            type: m.clinics.type,
            color: m.clinics.color || '#E91E63',
            ownerId: supabaseUserId,
            isActive: true,
          }))
      }

      const isPlatformOwner = PLATFORM_OWNER_EMAILS.includes(supabaseEmail)
      if (freshMemberships.length === 0 && !isPlatformOwner) {
        return { success: false, error: 'ไม่มีสิทธิ์เข้าใช้งาน กรุณาติดต่อผู้ดูแลระบบ' }
      }

      setMemberships(freshMemberships)
      setClinics(freshClinics)

      let currentClinicId: string | null = null
      let needsSelection = false
      if (freshMemberships.length === 1) {
        currentClinicId = freshMemberships[0].clinicId
      } else if (freshMemberships.length > 1) {
        needsSelection = true
        const lastClinicId = localStorage.getItem('clinicq-last-clinic-id')
        if (lastClinicId && freshMemberships.some(m => m.clinicId === lastClinicId)) {
          currentClinicId = lastClinicId
          needsSelection = false
        }
      }

      const newSession: AuthSession = { user, currentClinicId }
      setSession(newSession)
      saveToStorage(STORAGE_KEYS.AUTH, newSession)
      setNeedsClinicSelection(needsSelection)
      // force_password_change is no longer enforced (MVP).

      saveToStorage(STORAGE_KEYS.CLINICS, freshClinics)
      saveToStorage(STORAGE_KEYS.MEMBERSHIPS, freshMemberships)

      const activeClinic = freshClinics.find(c => c.id === currentClinicId)
      if (activeClinic) {
        localStorage.setItem('clinic-q-type', activeClinic.type)
        const existingSettings = localStorage.getItem(`clinic-q-settings-${activeClinic.id}`)
        if (!existingSettings) {
          localStorage.setItem(`clinic-q-settings-${activeClinic.id}`, JSON.stringify({
            clinicName: activeClinic.name,
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
        }
      } else if (isPlatformOwner) {
        localStorage.removeItem('clinic-q-type')
      }

      return { success: true, needsClinicSelection: needsSelection }
    } else {
      // Staff username login via server endpoint
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier, password }),
      })

      const body = await res.json().catch(() => ({}))

      if (!res.ok) {
        return { success: false, error: body?.error || 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง' }
      }

      const appSession: AuthSession = {
        user: {
          id: body.user?.id,
          email: body.user?.email || '',
          name: body.user?.name || '',
          phone: body.user?.phone || '',
          createdAt: new Date().toISOString(),
          forcePasswordChange: body.forcePasswordChange || false,
        },
        currentClinicId: body.currentClinicId || null,
      }

      setSession(appSession)
      saveToStorage(STORAGE_KEYS.AUTH, appSession)
      setNeedsClinicSelection(body.needsClinicSelection || false)
      // force_password_change is no longer enforced (MVP).

      if (body.memberships?.length) {
        const freshMemberships = body.memberships.map((m: any) => ({
          id: m.id,
          userId: m.userId,
          clinicId: m.clinicId,
          role: m.role,
          isActive: m.isActive,
          createdAt: m.createdAt || new Date().toISOString(),
        }))
        setMemberships(freshMemberships)
        saveToStorage(STORAGE_KEYS.MEMBERSHIPS, freshMemberships)
      }
      if (body.clinics?.length) {
        setClinics(body.clinics)
        saveToStorage(STORAGE_KEYS.CLINICS, body.clinics)
      }

      const clinic = body.clinics?.find((c: any) => c.id === body.currentClinicId)
      if (clinic) {
        localStorage.setItem('clinic-q-type', clinic.type)
      }

      return { success: true, needsClinicSelection: body.needsClinicSelection || false }
    }
  }, [])
  
  // ═══ Logout ═══
  // Awaits signOut() so the Supabase session (cookies) is actually cleared before
  // the caller navigates away — otherwise a page reload right after logout would
  // restore the session again from the still-valid cookies.
  const logout = useCallback(async () => {
    if (isSupabaseReady()) {
      try { await supabaseLogout() } catch { /* best-effort */ }
    }
    setSession(null)
    setNeedsClinicSelection(false)
    setForcePasswordChange(false)
    setRestUnavailable(false)
    localStorage.removeItem(STORAGE_KEYS.AUTH)
  }, [])
  
  // ═══ Update Password (Supabase Auth only) ═══
  const updatePassword = useCallback(async (newPassword: string) => {
    if (!session?.user) return
    if (!isSupabaseReady()) return

    await supabaseUpdatePassword(newPassword)

    // Update the forcePasswordChange flag in the user object
    const updatedUser = { ...session.user, forcePasswordChange: false }
    setSession(prev => prev ? { ...prev, user: updatedUser } : null)
    setForcePasswordChange(false)

    // Update in users state (cache only — no passwords stored locally)
    const freshUsers: User[] = JSON.parse(localStorage.getItem(STORAGE_KEYS.USERS) || '[]')
    const updatedUsers = freshUsers.map(u => 
      u.id === session.user.id ? { ...u, forcePasswordChange: false } : u
    )
    localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(updatedUsers))
    setUsers(updatedUsers)
  }, [session])

  // ═══ Reset Password by Email (Supabase Auth only) ═══
  const resetPasswordByEmail = useCallback(async (email: string): Promise<{ success: boolean; error?: string }> => {
    if (!isSupabaseReady()) {
      return { success: false, error: 'ระบบยังไม่ได้เชื่อมต่อกับฐานข้อมูล กรุณาติดต่อผู้ดูแลระบบ' }
    }
    return await supabaseResetPassword(email)
  }, [])

  // ═══ Select Clinic (for users with multiple clinics) ═══
  const selectClinic = useCallback((clinicId: string) => {
    setSession(prev => {
      if (!prev) return null
      
      // Verify user has membership in this clinic
      const hasMembership = memberships.some(
        m => m.userId === prev.user.id && m.clinicId === clinicId && m.isActive
      )
      
      if (!hasMembership) {
        console.error('User does not have membership in this clinic')
        return prev
      }
      
      const updated = { ...prev, currentClinicId: clinicId }
      localStorage.setItem(STORAGE_KEYS.AUTH, JSON.stringify(updated))
      
      // Update clinic type for ClinicContext
      const clinic = clinics.find(c => c.id === clinicId)
      if (clinic) {
        localStorage.setItem('clinic-q-type', clinic.type)
      }
      
      setNeedsClinicSelection(false)
      return updated
    })
  }, [memberships, clinics])
  
  // ═══ Switch Clinic (after login) ═══
  const switchClinic = useCallback((clinicId: string) => {
    setSession(prev => {
      if (!prev) return null
      
      // Verify user has membership in this clinic
      const hasMembership = memberships.some(
        m => m.userId === prev.user.id && m.clinicId === clinicId && m.isActive
      )
      
      if (!hasMembership) {
        console.error('User does not have membership in this clinic')
        return prev
      }
      
      const updated = { ...prev, currentClinicId: clinicId }
      localStorage.setItem(STORAGE_KEYS.AUTH, JSON.stringify(updated))
      
      // Update clinic type for ClinicContext
      const clinic = clinics.find(c => c.id === clinicId)
      if (clinic) {
        localStorage.setItem('clinic-q-type', clinic.type)
      }
      
      return updated
    })
  }, [memberships, clinics])
  
  // ═══ Get User's Clinics ═══
  const getUserClinics = useCallback((): Clinic[] => {
    if (!session?.user) return []
    const userMembership = memberships.filter(m => m.userId === session.user.id && m.isActive)
    return clinics.filter(c => userMembership.some(m => m.clinicId === c.id))
  }, [session, memberships, clinics])
  
  // ═══ Get Selectable Clinics (for clinic selection screen) ═══
  const getSelectableClinics = useCallback((): Clinic[] => {
    if (!session?.user) return []
    const userMembership = memberships.filter(m => m.userId === session.user.id && m.isActive)
    return clinics.filter(c => userMembership.some(m => m.clinicId === c.id))
  }, [session, memberships, clinics])
  
  // ═══ Get Current Membership ═══
  const getCurrentMembership = useCallback((): ClinicMembership | null => {
    if (!session?.user || !session.currentClinicId) return null
    return memberships.find(
      m => m.userId === session.user.id && m.clinicId === session.currentClinicId && m.isActive
    ) || null
  }, [session, memberships])
  
  // ═══ Get Role in Clinic ═══
  const getRoleInClinic = useCallback((userId: string, clinicId: string): ClinicRole | null => {
    const membership = memberships.find(
      m => m.userId === userId && m.clinicId === clinicId && m.isActive
    )
    return membership?.role || null
  }, [memberships])
  
  // ═══ Set Role in Clinic (Owner only) ═══
  const setRoleInClinic = useCallback((userId: string, clinicId: string, role: ClinicRole) => {
    // Check if current user is owner of this clinic
    const currentMembership = getCurrentMembership()
    if (!currentMembership || currentMembership.role !== 'owner') {
      console.error('Only clinic owner can change roles')
      return
    }
    
    setMemberships(prev => {
      const existing = prev.find(m => m.userId === userId && m.clinicId === clinicId)
      if (existing) {
        return prev.map(m => 
          m.userId === userId && m.clinicId === clinicId
            ? { ...m, role }
            : m
        )
      } else {
        // Create new membership
        return [...prev, {
          id: `mem-${Date.now()}`,
          userId,
          clinicId,
          role,
          isActive: true,
          createdAt: new Date().toISOString(),
        }]
      }
    })
  }, [getCurrentMembership])
  
  // ═══ Add User (for Owner/Manager) ═══
  const addUser = useCallback((userData: { name: string; email: string; phone?: string; role: ClinicRole }): User | null => {
    if (!session?.currentClinicId) return null
    
    // Check if user already exists
    const existingUser = users.find(u => u.email === userData.email)
    if (existingUser) {
      // User already exists, just add membership
      const hasExistingMembership = memberships.some(
        m => m.userId === existingUser.id && m.clinicId === session.currentClinicId
      )
      
      if (!hasExistingMembership) {
        setMemberships(prev => [...prev, {
          id: `mem-${Date.now()}`,
          userId: existingUser.id,
          clinicId: session.currentClinicId!,
          role: userData.role,
          isActive: true,
          createdAt: new Date().toISOString(),
        }])
      }
      
      return existingUser
    }
    
    // Create new user
    const newUser: User = {
      id: `user-${Date.now()}`,
      email: userData.email,
      name: userData.name,
      phone: userData.phone,
      createdAt: new Date().toISOString(),
    }
    
    setUsers(prev => [...prev, newUser])
    
    // Create membership
    setMemberships(prev => [...prev, {
      id: `mem-${Date.now()}`,
      userId: newUser.id,
      clinicId: session.currentClinicId!,
      role: userData.role,
      isActive: true,
      createdAt: new Date().toISOString(),
    }])
    
    return newUser
  }, [users, memberships, session])
  
  // ═══ Computed Values ═══
  const currentMembership = getCurrentMembership()
  // A session without a clinic must only be treated as a platform owner when the
  // account really is one. Deriving it from "no clinic id" alone would hand
  // platform privileges to any user whose clinic could not be resolved (e.g. a
  // data-layer outage or a multi-clinic account awaiting selection).
  const isPlatformOwnerSession =
    !!session?.user && PLATFORM_OWNER_EMAILS.includes((session.user.email || '').toLowerCase())
  const currentRole = currentMembership?.role
    || (!session?.currentClinicId && isPlatformOwnerSession ? 'platform_owner' as PlatformRole : null)
  
  const contextValue: AuthContextType = {
    session,
    user: session?.user || null,
    currentClinicId: session?.currentClinicId || null,
    currentRole,
    isAuthenticated: !!session?.user,
    isLoading,
    forcePasswordChange,
    restUnavailable,
    retryRest,
    login,
    logout,
    updatePassword,
    resetPasswordByEmail,
    switchClinic,
    getUserClinics,
    getCurrentMembership,
    getRoleInClinic,
    setRoleInClinic,
    getSelectableClinics,
    selectClinic,
    needsClinicSelection,
    addUser,
  }
  
  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
