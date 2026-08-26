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

// Demo data for all clinics
export const platformClinics: PlatformClinic[] = [
  {
    id: 'clinic-dental',
    name: 'คลินิกทันตกรรม',
    type: 'dental',
    prefix: 'E',
    color: '#60A5FA',
    ownerName: 'ทพ.สมบูรณ์ สุขใจ',
    ownerEmail: 'owner@dental.com',
    package: 'clinicq',
    status: 'active',
    registeredAt: '2025-12-01',
    expiresAt: '2026-12-01',
    totalQueuesToday: 12,
    totalQueuesMonth: 342,
    totalUsers: 8,
    branches: 2,
    rooms: 4,
  },
  {
    id: 'clinic-medical',
    name: 'คลินิกเวชกรรม หมอสุข',
    type: 'medical',
    prefix: 'A',
    color: '#34D399',
    ownerName: 'นพ.นรินทร์ สุขสมบูรณ์',
    ownerEmail: 'owner@medical.com',
    package: 'clinicq',
    status: 'active',
    registeredAt: '2026-01-15',
    expiresAt: '2027-01-15',
    totalQueuesToday: 8,
    totalQueuesMonth: 198,
    totalUsers: 5,
    branches: 1,
    rooms: 3,
  },
  {
    id: 'clinic-aesthetic',
    name: 'คลินิกเสริมความงาม สวยใส',
    type: 'aesthetic',
    prefix: 'B',
    color: '#F472B6',
    ownerName: 'นพ.อริยะ หน้าใส',
    ownerEmail: 'owner@aesthetic.com',
    package: 'clinicq',
    status: 'active',
    registeredAt: '2025-06-01',
    expiresAt: null,
    totalQueuesToday: 15,
    totalQueuesMonth: 421,
    totalUsers: 12,
    branches: 3,
    rooms: 5,
  },
  {
    id: 'clinic-thai',
    name: 'แพทย์แผนไทย นวดผ่อนคลาย',
    type: 'thai',
    prefix: 'C',
    color: '#A3E635',
    ownerName: 'นายสมศักดิ์ นวดเก่ง',
    ownerEmail: 'owner@thai.com',
    package: 'free_trial',
    status: 'active',
    registeredAt: '2026-07-22',
    expiresAt: '2026-08-22',
    totalQueuesToday: 3,
    totalQueuesMonth: 45,
    totalUsers: 3,
    branches: 1,
    rooms: 2,
  },
  {
    id: 'clinic-chinese',
    name: 'แพทย์แผนจีน หยินหยาง',
    type: 'chinese',
    prefix: 'D',
    color: '#FB923C',
    ownerName: 'นายแพทย์จีน เหวินหลง',
    ownerEmail: 'owner@chinese.com',
    package: 'free_trial',
    status: 'active',
    registeredAt: '2026-08-01',
    expiresAt: '2026-08-31',
    totalQueuesToday: 2,
    totalQueuesMonth: 18,
    totalUsers: 2,
    branches: 1,
    rooms: 2,
  },
  {
    id: 'clinic-physical',
    name: 'คลินิกกายภาพบำบัด ขยับดี',
    type: 'physical',
    prefix: 'P',
    color: '#A78BFA',
    ownerName: 'พท.สมศรี บำบัดดี',
    ownerEmail: 'owner@physical.com',
    package: 'clinicq',
    status: 'inactive',
    registeredAt: '2025-09-01',
    expiresAt: '2026-09-01',
    totalQueuesToday: 0,
    totalQueuesMonth: 67,
    totalUsers: 4,
    branches: 1,
    rooms: 2,
  },
]

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
