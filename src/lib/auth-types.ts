// ═══════════════════════════════════════════
// Clinic-Q Auth Types & Permissions
// ═══════════════════════════════════════════

export type PlatformRole = 'platform_owner'
export type ClinicRole = 'owner' | 'manager' | 'front_desk' | 'practitioner'
export type UserRole = ClinicRole | PlatformRole

// ═══ User (ข้อมูลผู้ใช้ / Login Account) ═══
export interface User {
  id: string        // MUST match auth.users.id
  email: string
  name: string
  phone?: string
  createdAt: string
  forcePasswordChange?: boolean  // true = user must change password on first login
}

// ═══ Clinic (ข้อมูลคลินิก) ═══
export interface Clinic {
  id: string
  name: string
  type: string  // dental, medical, aesthetic, thai, chinese, physical
  color: string
  ownerId: string  // Keep for backward compatibility
  isActive: boolean
}

// ═══ Clinic Membership (user ↔ clinic ↔ role) ═══
// Determines what role the user has in each clinic
export interface ClinicMembership {
  id: string
  userId: string      // → users.id
  clinicId: string    // → clinics.id
  role: ClinicRole    // owner, manager, front_desk, practitioner
  isActive: boolean
  createdAt: string
}

// ═══ Practitioner (ข้อมูลผู้ทำหัตถการในแต่ละคลินิก) ═══
// Separate from User - this is the professional profile
export interface Practitioner {
  id: string          // Existing PK (TEXT)
  clinicId: string    // → clinics.id (required)
  userId?: string     // → users.id (optional, NULL if no login account)
  firstName: string   // practitioner first name
  lastName: string    // practitioner last name
  phone?: string
  role: string        // 'practitioner' | 'admin'
  isActive: boolean
  createdAt: string
}

// ═══ Auth Session ═══
export interface AuthSession {
  user: User
  currentClinicId: string | null
}

// ═══ Role Config ═══
export const roleConfig: Record<UserRole, {
  label: string
  labelEn: string
  color: string
  bgColor: string
  icon: string
  level: number
}> = {
  platform_owner: { label: 'เจ้าของระบบ', labelEn: 'Platform Owner', color: '#DC2626', bgColor: '#FEE2E2', icon: '🔴', level: 5 },
  owner:       { label: 'เจ้าของคลินิก', labelEn: 'Clinic Owner', color: '#EA580C', bgColor: '#FFF7ED', icon: '🟠', level: 4 },
  manager:     { label: 'ผู้จัดการ', labelEn: 'Manager', color: '#CA8A04', bgColor: '#FEFCE8', icon: '🟡', level: 3 },
  front_desk:  { label: 'เจ้าหน้าที่', labelEn: 'Front Desk', color: '#16A34A', bgColor: '#F0FDF4', icon: '🟢', level: 2 },
  practitioner: { label: 'ผู้ทำหัตถการ', labelEn: 'Practitioner', color: '#2563EB', bgColor: '#EFF6FF', icon: '🔵', level: 1 },
}

// Platform role config for Header and other components
export const platformRoleConfig = {
  label: 'เจ้าของระบบ',
  labelEn: 'Platform Owner',
  color: '#DC2626',
  bgColor: '#FEE2E2',
  icon: '🔴',
  level: 5,
}

// ═══ Permissions ═══
export type Permission =
  | 'view_dashboard'
  | 'register_walkin'
  | 'call_next_queue'
  | 'complete_procedure'
  | 'manage_schedule'
  | 'manage_clinic_settings'
  | 'manage_branches_rooms'
  | 'manage_users'
  | 'view_analytics'
  | 'manage_qr_code'
  | 'manage_tv_display'

export const rolePermissions: Record<ClinicRole, Permission[]> = {
  owner: [
    'view_dashboard',
    'register_walkin',
    'call_next_queue',
    'complete_procedure',
    'manage_schedule',
    'manage_clinic_settings',
    'manage_branches_rooms',
    'manage_users',
    'view_analytics',
    'manage_qr_code',
    'manage_tv_display',
  ],
  manager: [
    'view_dashboard',
    'register_walkin',
    'call_next_queue',
    'complete_procedure',
    'manage_schedule',
    'manage_clinic_settings',
    'manage_branches_rooms',
    'manage_qr_code',
    'manage_tv_display',
  ],
  front_desk: [
    'view_dashboard',
    'register_walkin',
    'call_next_queue',
    'complete_procedure',
  ],
  practitioner: [
    'view_dashboard',
    'complete_procedure',
  ],
}

export const permissionLabels: Record<Permission, string> = {
  view_dashboard: 'ดูแดชบอร์ด',
  register_walkin: 'ลงทะเบียน Walk-in',
  call_next_queue: 'เรียกคิวถัดไป',
  complete_procedure: 'บันทึกเสร็จสิ้นหัตถการ',
  manage_schedule: 'จัดตารางเวร/เวลานัด',
  manage_clinic_settings: 'ตั้งค่าข้อมูลคลินิก',
  manage_branches_rooms: 'จัดการสาขาและห้องตรวจ',
  manage_users: 'จัดการผู้ใช้งานในคลินิก',
  view_analytics: 'ดูวิเคราะห์ข้อมูล',
  manage_qr_code: 'จัดการ QR Code และลิงก์',
  manage_tv_display: 'ตั้งค่าจอแสดงคิว TV',
}

export function hasPermission(role: ClinicRole, permission: Permission): boolean {
  return rolePermissions[role]?.includes(permission) ?? false
}

export function hasAnyPermission(role: UserRole, permissions: Permission[]): boolean {
  if (role === 'platform_owner') return true
  return permissions.some(p => hasPermission(role as ClinicRole, p))
}
