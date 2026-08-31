'use client'

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react'
import { 
  type User, 
  type Clinic, 
  type ClinicMembership, 
  type ClinicRole, 
  type PlatformRole,
  type AuthSession 
} from './auth-types'
import { supabaseLogin, supabaseLogout, supabaseResetPassword, supabaseUpdatePassword, supabaseRegister } from './supabase-auth'
import { isSupabaseReady } from './supabase'

interface AuthContextType {
  session: AuthSession | null
  user: User | null
  currentClinicId: string | null
  currentRole: ClinicRole | PlatformRole | null
  isAuthenticated: boolean
  isLoading: boolean
  forcePasswordChange: boolean
  
  // Login/Logout
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string; needsClinicSelection?: boolean }>
  logout: () => void
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
  
  // Data stores
  const [users, setUsers] = useState<User[]>(() => loadFromStorage(STORAGE_KEYS.USERS, []))
  const [clinics, setClinics] = useState<Clinic[]>(() => loadFromStorage(STORAGE_KEYS.CLINICS, []))
  const [memberships, setMemberships] = useState<ClinicMembership[]>(() => loadFromStorage(STORAGE_KEYS.MEMBERSHIPS, []))
  
  // Initialize platform owner account if not exists
  useEffect(() => {
    if (typeof window === 'undefined') return
    const PLATFORM_OWNER_EMAIL = 'sakarinmam999@gmail.com'
    const currentUsers = JSON.parse(localStorage.getItem(STORAGE_KEYS.USERS) || '[]')
    const existingOwner = currentUsers.find((u: any) => u.email === PLATFORM_OWNER_EMAIL)
    if (!existingOwner) {
      const platformOwner: User = {
        id: 'platform-owner-1',
        email: PLATFORM_OWNER_EMAIL,
        name: 'Sakarin (Platform Owner)',
        phone: '',
        createdAt: new Date().toISOString(),
        forcePasswordChange: false,
      }
      const updatedUsers = [...currentUsers, platformOwner]
      localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(updatedUsers))
      setUsers(updatedUsers)
      // Store password
      const passwords = JSON.parse(localStorage.getItem('clinicq-user-passwords') || '{}')
      passwords[PLATFORM_OWNER_EMAIL] = 'abc1234'
      localStorage.setItem('clinicq-user-passwords', JSON.stringify(passwords))
    }
  }, [])
  
  // Load session from localStorage
  useEffect(() => {
    const saved = loadFromStorage<AuthSession | null>(STORAGE_KEYS.AUTH, null)
    if (saved) {
      // Refresh user data from store
      const freshUser = users.find(u => u.id === saved.user.id)
      if (freshUser) {
        setSession({ ...saved, user: freshUser })
        // Check if user needs to force change password
        if (freshUser.forcePasswordChange) {
          setForcePasswordChange(true)
        }
      } else {
        setSession(saved)
        if (saved.user.forcePasswordChange) {
          setForcePasswordChange(true)
        }
      }
    }
    setIsLoading(false)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps
  
  // ═══ Auto-logout at midnight (0:00) ═══
  useEffect(() => {
    if (typeof window === 'undefined') return
    const today = new Date().toISOString().split('T')[0]
    const lastLoginDate = localStorage.getItem('clinicq-last-login-date')
    // Store today's date on first load
    if (!lastLoginDate) {
      localStorage.setItem('clinicq-last-login-date', today)
    }
    // Check every minute if date changed
    const checker = setInterval(() => {
      const now = new Date().toISOString().split('T')[0]
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
  
  // ═══ Login ═══
  const login = useCallback(async (email: string, password: string): Promise<{ success: boolean; error?: string; needsClinicSelection?: boolean }> => {
    // Try Supabase Auth first if configured
    if (isSupabaseReady()) {
      const result = await supabaseLogin(email, password)
      if (result.success && result.user && result.clinicId) {
        const user: User = {
          id: result.user.id,
          email: result.user.email,
          name: result.user.name,
          phone: result.user.phone,
          createdAt: new Date().toISOString(),
          forcePasswordChange: result.user.forcePasswordChange,
        }
        const newSession: AuthSession = { user, currentClinicId: result.clinicId }
        setSession(newSession)
        localStorage.setItem(STORAGE_KEYS.AUTH, JSON.stringify(newSession))
        if (user.forcePasswordChange) setForcePasswordChange(true)
        // Fetch clinic type
        const { data: clinic } = await (await import('./supabase')).getSupabase()?.from('clinics').select('type').eq('id', result.clinicId).single()
        if (clinic) localStorage.setItem('clinic-q-type', clinic.type)
        return { success: true }
      }
      // Supabase failed - fallback to localStorage below
    }
    
    // Fallback to localStorage
    const freshUsers: User[] = JSON.parse(localStorage.getItem(STORAGE_KEYS.USERS) || '[]')
    const allUsers = [...users]
    for (const fu of freshUsers) {
      if (!allUsers.find(u => u.id === fu.id)) allUsers.push(fu)
    }
    let user: User | undefined = allUsers.find(u => u.email === email)
    const freshMemberships: ClinicMembership[] = JSON.parse(localStorage.getItem(STORAGE_KEYS.MEMBERSHIPS) || '[]')
    const allMemberships = [...memberships]
    for (const fm of freshMemberships) {
      if (!allMemberships.find(m => m.id === fm.id)) allMemberships.push(fm)
    }
    const freshClinics: Clinic[] = JSON.parse(localStorage.getItem(STORAGE_KEYS.CLINICS) || '[]')
    const allClinics = [...clinics]
    for (const fc of freshClinics) {
      if (!allClinics.find(c => c.id === fc.id)) allClinics.push(fc)
    }
    const storedPasswords = JSON.parse(localStorage.getItem('clinicq-user-passwords') || '{}')
    const storedPassword = storedPasswords[email] || (user?.forcePasswordChange ? '123456' : undefined)
    if (!user || password !== storedPassword) {
      return { success: false, error: 'อีเมลหรือรหัสผ่านไม่ถูกต้อง' }
    }
    if (!user) return { success: false, error: 'ไม่พบบัญชีผู้ใช้' }
    const PLATFORM_OWNER_EMAILS = ['sakarinmam999@gmail.com']
    const isPlatformOwner = PLATFORM_OWNER_EMAILS.includes(user.email)
    const userMemberships = allMemberships.filter(m => m.userId === user!.id && m.isActive)
    if (isPlatformOwner && userMemberships.length === 0) {
      const newSession: AuthSession = { user, currentClinicId: null }
      setSession(newSession)
      localStorage.setItem(STORAGE_KEYS.AUTH, JSON.stringify(newSession))
      return { success: true }
    }
    if (!isPlatformOwner && userMemberships.length === 0) {
      return { success: false, error: 'ไม่มีสิทธิ์เข้าใช้งาน กรุณาติดต่อผู้ดูแลระบบ' }
    }
    if (userMemberships.length === 1) {
      const singleClinic = allClinics.find(c => c.id === userMemberships[0].clinicId)
      const newSession: AuthSession = { user, currentClinicId: singleClinic?.id || null }
      setSession(newSession)
      localStorage.setItem(STORAGE_KEYS.AUTH, JSON.stringify(newSession))
      if (singleClinic) localStorage.setItem('clinic-q-type', singleClinic.type)
      if (user.forcePasswordChange) setForcePasswordChange(true)
      return { success: true }
    }
    const newSession: AuthSession = { user, currentClinicId: null }
    setSession(newSession)
    localStorage.setItem(STORAGE_KEYS.AUTH, JSON.stringify(newSession))
    setNeedsClinicSelection(true)
    return { success: true, needsClinicSelection: true }
  }, [users, memberships, clinics])
  
  // ═══ Logout ═══
  const logout = useCallback(() => {
    if (isSupabaseReady()) supabaseLogout()
    setSession(null)
    setNeedsClinicSelection(false)
    setForcePasswordChange(false)
    localStorage.removeItem(STORAGE_KEYS.AUTH)
  }, [])
  
  // ═══ Update Password ═══
  const updatePassword = useCallback(async (newPassword: string) => {
    if (!session?.user) return
    if (isSupabaseReady()) {
      await supabaseUpdatePassword(newPassword)
    }
    const userPasswords = JSON.parse(localStorage.getItem('clinicq-user-passwords') || '{}')
    userPasswords[session.user.email] = newPassword
    localStorage.setItem('clinicq-user-passwords', JSON.stringify(userPasswords))
    
    // Update the forcePasswordChange flag in the user object
    const updatedUser = { ...session.user, forcePasswordChange: false }
    setSession(prev => prev ? { ...prev, user: updatedUser } : null)
    setForcePasswordChange(false)
    
    // Update in users state AND persist to localStorage
    setUsers(prev => {
      const updated = prev.map(u => 
        u.id === session.user.id ? { ...u, forcePasswordChange: false } : u
      )
      localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(updated))
      return updated
    })
    
    // password changed successfully
  }, [session])

  // ═══ Reset Password by Email (for Forgot Password) ═══
  const resetPasswordByEmail = useCallback(async (email: string): Promise<{ success: boolean; error?: string }> => {
    if (isSupabaseReady()) {
      return await supabaseResetPassword(email)
    }
    const users = JSON.parse(localStorage.getItem(STORAGE_KEYS.USERS) || '[]')
    const userExists = users.some((u: any) => u.email === email)
    if (!userExists) return { success: false, error: 'ไม่พบอีเมลนี้ในระบบ' }
    const userPasswords = JSON.parse(localStorage.getItem('clinicq-user-passwords') || '{}')
    userPasswords[email] = '123456'
    localStorage.setItem('clinicq-user-passwords', JSON.stringify(userPasswords))
    const updatedUsers = users.map((u: any) => 
      u.email === email ? { ...u, forcePasswordChange: true } : u
    )
    localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(updatedUsers))
    setUsers(updatedUsers)
    return { success: true }
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
  const currentRole = currentMembership?.role || (!session?.currentClinicId && session?.user ? 'platform_owner' as PlatformRole : null)
  
  const contextValue: AuthContextType = {
    session,
    user: session?.user || null,
    currentClinicId: session?.currentClinicId || null,
    currentRole,
    isAuthenticated: !!session?.user,
    isLoading,
    forcePasswordChange,
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
