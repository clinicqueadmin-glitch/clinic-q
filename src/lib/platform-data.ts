// ═══════════════════════════════════════════
// Clinic-Q Platform Data — for Platform Owner
// ═══════════════════════════════════════════

export type PackageType = 'free_trial' | 'clinicq'
export type ClinicStatus = 'active' | 'inactive' | 'suspended'

export interface PlatformClinic {
  id: string
  name: string
  type: string
  prefix: string
  color: string
  ownerName: string
  ownerEmail: string
  package: PackageType
  status: ClinicStatus
  registeredAt: string
  expiresAt: string | null
  totalQueuesToday: number
  totalQueuesMonth: number
  totalUsers: number
  branches: number
  rooms: number
}

export const packageConfig: Record<PackageType, {
  label: string
  labelEn: string
  color: string
  bgColor: string
  priceMonthly: number
  priceYearly: number
  priceEarlyBird: number
  features: string[]
}> = {
  free_trial: {
    label: 'ทดลองใช้ฟรี',
    labelEn: 'Free Trial',
    color: '#6B7280',
    bgColor: '#F3F4F6',
    priceMonthly: 0,
    priceYearly: 0,
    priceEarlyBird: 0,
    features: ['คิวสูงสุด 50 คิว/วัน', 'สาขา 1', 'ห้อง 3', 'ผู้ใช้ 3', 'ทดลอง 30 วัน'],
  },
  clinicq: {
    label: 'Clinic-Q Professional',
    labelEn: 'Clinic-Q Professional',
    color: '#9333EA',
    bgColor: '#F5F3FF',
    priceMonthly: 599,
    priceYearly: 5999,
    priceEarlyBird: 3999,
    features: ['คิวไม่จำกัด', 'สาขาไม่จำกัด', 'ห้องไม่จำกัด', 'ผู้ใช้ไม่จำกัด', 'TV Display', 'QR Code', 'วิเคราะห์ข้อมูล', 'Push Notification'],
  },
}

// No demo data - platform clinics are loaded from Supabase
export const platformClinics: PlatformClinic[] = []

// Helper functions
export function getDaysRemaining(expiresAt: string | null): number | null {
  if (!expiresAt) return null
  const now = new Date()
  const exp = new Date(expiresAt)
  return Math.ceil((exp.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
}

export function getTrialStatus(expiresAt: string | null): 'expired' | 'expiring' | 'active' | 'unlimited' {
  if (!expiresAt) return 'unlimited'
  const days = getDaysRemaining(expiresAt)
  if (days !== null && days < 0) return 'expired'
  if (days !== null && days <= 30) return 'expiring'
  return 'active'
}
