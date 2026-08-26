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

// ═══ DEMO DATA ═══

const demoUsers: Record<string, { password: string; user: User }> = {
  // Platform Owner
  'admin@clinicq.com': {
    password: 'admin123',
    user: { id: 'u-admin', email: 'admin@clinicq.com', name: 'Admin System', createdAt: new Date().toISOString() }
  },
  // Dental Clinic - Owner
  'owner@dental.com': {
    password: 'owner123',
    user: { id: '1', email: 'owner@dental.com', name: 'สมศักดิ์ เจ้าของคลินิก', phone: '089-123-4567', createdAt: new Date().toISOString() }
  },
  // Dental Clinic - Staff
  'staff@dental.com': {
    password: 'staff123',
    user: { id: '2', email: 'staff@dental.com', name: 'สมหญิง เจ้าหน้าที่', phone: '081-111-2222', createdAt: new Date().toISOString() }
  },
  // Dental Clinic - Doctor (Practitioner)
  'doctor@dental.com': {
    password: 'doctor123',
    user: { id: '3', email: 'doctor@dental.com', name: 'ทพ.สมชาย รักษาดี', phone: '082-222-3333', createdAt: new Date().toISOString() }
  },
  // Medical Clinic - Owner
  'owner@medical.com': {
    password: 'owner123',
    user: { id: '10', email: 'owner@medical.com', name: 'นพ.นรินทร์ สุขสมบูรณ์', phone: '081-333-4444', createdAt: new Date().toISOString() }
  },
  // Medical Clinic - Staff
  'staff@medical.com': {
    password: 'staff123',
    user: { id: '11', email: 'staff@medical.com', name: 'ปราณี หทัยสุข', phone: '082-444-5555', createdAt: new Date().toISOString() }
  },
  // Medical Clinic - Doctor (Practitioner)
  'doctor@medical.com': {
    password: 'doctor123',
    user: { id: '12', email: 'doctor@medical.com', name: 'นพ.ธนพล ใจดี', phone: '083-555-6666', createdAt: new Date().toISOString() }
  },
  // Aesthetic Clinic - Owner
  'owner@aesthetic.com': {
    password: 'owner123',
    user: { id: '20', email: 'owner@aesthetic.com', name: 'นพ.อริยะ หน้าใส', phone: '081-666-7777', createdAt: new Date().toISOString() }
  },
  // Aesthetic Clinic - Staff
  'staff@aesthetic.com': {
    password: 'staff123',
    user: { id: '21', email: 'staff@aesthetic.com', name: 'ศิริพร จันทร์เจ้า', phone: '082-777-8888', createdAt: new Date().toISOString() }
  },
  // Aesthetic Clinic - Doctor (Practitioner)
  'doctor@aesthetic.com': {
    password: 'doctor123',
    user: { id: '22', email: 'doctor@aesthetic.com', name: 'นพ.ณัชชา เลเซอร์', phone: '083-888-9999', createdAt: new Date().toISOString() }
  },
  // Example: User with multiple clinic memberships
  'doctor@gmail.com': {
    password: 'doctor123',
    user: { id: '30', email: 'doctor@gmail.com', name: 'นพ.สมชาย รักษาดี', phone: '081-999-0000', createdAt: new Date().toISOString() }
  },
}

// Demo clinics
const demoClinics: Clinic[] = [
  { id: 'clinic-dental', name: 'คลินิกทันตกรรม สุขฟัน', type: 'dental', color: '#3B82F6', ownerId: '1', isActive: true },
  { id: 'clinic-medical', name: 'คลินิกเวชกรรม สุขใจ', type: 'medical', color: '#22C55E', ownerId: '10', isActive: true },
  { id: 'clinic-aesthetic', name: 'คลินิกเสริมความงาม สวยใส', type: 'aesthetic', color: '#EC4899', ownerId: '20', isActive: true },
]

// Demo memberships (user ↔ clinic ↔ role)
const demoMemberships: ClinicMembership[] = [
  // Dental clinic
  { id: 'm1', userId: '1', clinicId: 'clinic-dental', role: 'owner', isActive: true, createdAt: '2024-01-01' },
  { id: 'm2', userId: '2', clinicId: 'clinic-dental', role: 'front_desk', isActive: true, createdAt: '2024-01-15' },
  { id: 'm3', userId: '3', clinicId: 'clinic-dental', role: 'practitioner', isActive: true, createdAt: '2024-01-20' },
  
  // Medical clinic
  { id: 'm4', userId: '10', clinicId: 'clinic-medical', role: 'owner', isActive: true, createdAt: '2024-02-01' },
  { id: 'm5', userId: '11', clinicId: 'clinic-medical', role: 'front_desk', isActive: true, createdAt: '2024-02-10' },
  { id: 'm6', userId: '12', clinicId: 'clinic-medical', role: 'practitioner', isActive: true, createdAt: '2024-02-15' },
  
  // Aesthetic clinic
  { id: 'm7', userId: '20', clinicId: 'clinic-aesthetic', role: 'owner', isActive: true, createdAt: '2024-03-01' },
  { id: 'm8', userId: '21', clinicId: 'clinic-aesthetic', role: 'front_desk', isActive: true, createdAt: '2024-03-10' },
  { id: 'm9', userId: '22', clinicId: 'clinic-aesthetic', role: 'practitioner', isActive: true, createdAt: '2024-03-15' },
  
  // Example: User with multiple clinic memberships (SAME USER, DIFFERENT ROLES)
  { id: 'm10', userId: '30', clinicId: 'clinic-dental', role: 'practitioner', isActive: true, createdAt: '2024-03-10' },
  { id: 'm11', userId: '30', clinicId: 'clinic-medical', role: 'practitioner', isActive: true, createdAt: '2024-03-15' },
  { id: 'm12', userId: '30', clinicId: 'clinic-aesthetic', role: 'manager', isActive: true, createdAt: '2024-03-20' },
]

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
  const [users, setUsers] = useState<User[]>(() => loadFromStorage(STORAGE_KEYS.USERS, Object.values(demoUsers).map(d => d.user)))
  const [clinics, setClinics] = useState<Clinic[]>(() => loadFromStorage(STORAGE_KEYS.CLINICS, demoClinics))
  const [memberships, setMemberships] = useState<ClinicMembership[]>(() => loadFromStorage(STORAGE_KEYS.MEMBERSHIPS, demoMemberships))
  
  // Load session from localStorage
  useEffect(() => {
    const saved = loadFromStorage<AuthSession | null>(STORAGE_KEYS.AUTH, null)
    if (saved) {
      // Refresh user data from store
      const freshUser = users.find(u => u.id === saved.user.id)
      if (freshUser) {
        setSession({ ...saved, user: freshUser })
      } else {
        setSession(saved)
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
    // Check demo users first
    const demo = demoUsers[email]
    let user: User | undefined
    
    if (demo && demo.password === password) {
      user = demo.user
    } else {
      // Check stored users (for registered users)
      user = users.find(u => u.email === email)
      // In real app, verify password hash here
      if (!user || password !== '123456') {  // Demo: default password
        return { success: false, error: 'อีเมลหรือรหัสผ่านไม่ถูกต้อง' }
      }
    }
    
    if (!user) {
      return { success: false, error: 'ไม่พบบัญชีผู้ใช้' }
    }
    
    // Get user's memberships
    const userMemberships = memberships.filter(m => m.userId === user!.id && m.isActive)
    
    if (userMemberships.length === 0) {
      return { success: false, error: 'ไม่มีสิทธิ์เข้าใช้งานคลินิกใดๆ' }
    }
    
    // Check if user is platform owner
    if (email === 'admin@clinicq.com') {
      const newSession: AuthSession = { user, currentClinicId: null }
      setSession(newSession)
      localStorage.setItem(STORAGE_KEYS.AUTH, JSON.stringify(newSession))
      return { success: true }
    }
    
    // Check if user has only 1 clinic - auto select
    if (userMemberships.length === 1) {
      const singleClinic = clinics.find(c => c.id === userMemberships[0].clinicId)
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
    
    // Update the user's password in storage
    // In a real app, this would be an API call
    const storedUsers = localStorage.getItem('clinicq-users')
    if (storedUsers) {
      const users = JSON.parse(storedUsers)
      // For demo users, we can't actually change the password in demoUsers object
      // But we can store the new password in localStorage
      const userPasswords = JSON.parse(localStorage.getItem('clinicq-user-passwords') || '{}')
      userPasswords[session.user.email] = newPassword
      localStorage.setItem('clinicq-user-passwords', JSON.stringify(userPasswords))
    }
    
    // Update the forcePasswordChange flag in the user object
    const updatedUser = { ...session.user, forcePasswordChange: false }
    setSession(prev => prev ? { ...prev, user: updatedUser } : null)
    setForcePasswordChange(false)
    
    // Update in users state
    setUsers(prev => prev.map(u => 
      u.id === session.user.id ? { ...u, forcePasswordChange: false } : u
    ))
    
    alert('เปลี่ยนรหัสผ่านสำเร็จ!')
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
  const currentRole = currentMembership?.role || (session?.user?.email === 'admin@clinicq.com' ? 'platform_owner' as PlatformRole : null)
  
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
