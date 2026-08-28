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
    // Check stored users — also read from localStorage directly as fallback
    // (in case users were registered after this component mounted)
    const freshUsers: User[] = JSON.parse(localStorage.getItem(STORAGE_KEYS.USERS) || '[]')
    const allUsers = [...users]
    for (const fu of freshUsers) {
      if (!allUsers.find(u => u.id === fu.id)) allUsers.push(fu)
    }
    let user: User | undefined = allUsers.find(u => u.email === email)
    
    // Also refresh memberships from localStorage
    const freshMemberships: ClinicMembership[] = JSON.parse(localStorage.getItem(STORAGE_KEYS.MEMBERSHIPS) || '[]')
    const allMemberships = [...memberships]
    for (const fm of freshMemberships) {
      if (!allMemberships.find(m => m.id === fm.id)) allMemberships.push(fm)
    }
    
    // Also refresh clinics from localStorage
    const freshClinics: Clinic[] = JSON.parse(localStorage.getItem(STORAGE_KEYS.CLINICS) || '[]')
    const allClinics = [...clinics]
    for (const fc of freshClinics) {
      if (!allClinics.find(c => c.id === fc.id)) allClinics.push(fc)
    }
    
    // Verify password (stored passwords or default '123456' for new users)
    const storedPasswords = JSON.parse(localStorage.getItem('clinicq-user-passwords') || '{}')
    const storedPassword = storedPasswords[email] || (user?.forcePasswordChange ? '123456' : undefined)
    if (!user || password !== storedPassword) {
      return { success: false, error: 'อีเมลหรือรหัสผ่านไม่ถูกต้อง' }
    }
    
    if (!user) {
      return { success: false, error: 'ไม่พบบัญชีผู้ใช้' }
    }
    
    // Get user's memberships
    const userMemberships = allMemberships.filter(m => m.userId === user!.id && m.isActive)
    
    // Platform owner: no clinic memberships, only platform access
    if (userMemberships.length === 0) {
      // Allow login as platform owner (no clinic needed)
      const newSession: AuthSession = { user, currentClinicId: null }
      setSession(newSession)
      localStorage.setItem(STORAGE_KEYS.AUTH, JSON.stringify(newSession))
      return { success: true }
    }
    
    // Check if user has only 1 clinic - auto select
    if (userMemberships.length === 1) {
      const singleClinic = allClinics.find(c => c.id === userMemberships[0].clinicId)
      const newSession: AuthSession = { user, currentClinicId: singleClinic?.id || null }
      setSession(newSession)
      localStorage.setItem(STORAGE_KEYS.AUTH, JSON.stringify(newSession))
      
      // Set clinic type for ClinicContext
      if (singleClinic) {
        localStorage.setItem('clinic-q-type', singleClinic.type)
      }
      
      // Check if user needs to change password
      if (user.forcePasswordChange) {
        setForcePasswordChange(true)
      }
      
      return { success: true }
    }
    
    // User has multiple clinics - need to show selection
    const newSession: AuthSession = { user, currentClinicId: null }
    setSession(newSession)
    localStorage.setItem(STORAGE_KEYS.AUTH, JSON.stringify(newSession))
    setNeedsClinicSelection(true)
    
    return { success: true, needsClinicSelection: true }
  }, [users, memberships, clinics])
  
  // ═══ Logout ═══
  const logout = useCallback(() => {
    setSession(null)
    setNeedsClinicSelection(false)
    setForcePasswordChange(false)
    localStorage.removeItem(STORAGE_KEYS.AUTH)
  }, [])
  
  // ═══ Update Password ═══
  const updatePassword = useCallback((newPassword: string) => {
    if (!session?.user) return
    // Store the new password in localStorage
    const userPasswords = JSON.parse(localStorage.getItem('clinicq-user-passwords') || '{}')
    userPasswords[session.user.email] = newPassword
    localStorage.setItem('clinicq-user-passwords', JSON.stringify(userPasswords))
    
    // Update the forcePasswordChange flag in the user object
    const updatedUser = { ...session.user, forcePasswordChange: false }
    setSession(prev => prev ? { ...prev, user: updatedUser } : null)
    setForcePasswordChange(false)
    
    // Update in users state
    setUsers(prev => prev.map(u => 
      u.id === session.user.id ? { ...u, forcePasswordChange: false } : u
    ))
    
    // password changed successfully
  }, [session])
  
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
