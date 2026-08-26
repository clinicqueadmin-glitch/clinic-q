// ═══════════════════════════════════════════
// Clinic-Q Subscription Types & Plans
// ═══════════════════════════════════════════

export type SubscriptionPlan = 'trial' | 'clinicq'
export type SubscriptionStatus = 'active' | 'expired' | 'cancelled' | 'suspended'

export interface Subscription {
  id: string
  clinicId: string
  plan: SubscriptionPlan
  status: SubscriptionStatus
  startDate: string        // ISO date
  trialEndDate: string     // ISO date (30 days from start)
  paidEndDate: string | null // ISO date (null if on trial)
  autoRenew: boolean
  paymentMethod: 'credit_card' | 'bank_transfer' | 'promptpay' | null
  lastPaymentDate: string | null
  nextPaymentDate: string | null
}

export interface PlanFeature {
  name: string
  included: boolean
  value?: string | number
}

export interface PlanConfig {
  id: SubscriptionPlan
  name: string
  nameEn: string
  description: string
  priceMonthly: number     // THB per month
  priceYearly: number      // THB per year (normal)
  priceEarlyBird: number   // THB per year (early bird — subscribe before trial expires)
  color: string
  bgColor: string
  icon: string
  popular?: boolean
  features: PlanFeature[]
  limits: {
    queues: number | null   // null = unlimited
    branches: number | null
    rooms: number | null
    users: number | null
    storage: string | null  // e.g., "1 GB"
  }
}

export const plans: PlanConfig[] = [
  {
    id: 'trial',
    name: 'ทดลองใช้ฟรี',
    nameEn: 'Free Trial',
    description: 'ทดลองใช้ระบบ 30 วัน ไม่ต้องบัตรเครดิต',
    priceMonthly: 0,
    priceYearly: 0,
    priceEarlyBird: 0,
    color: '#6B7280',
    bgColor: '#F3F4F6',
    icon: '🎁',
    features: [
      { name: 'คิวสูงสุด 50 คิว/วัน', included: true },
      { name: 'สาขาสูงสุด 1', included: true },
      { name: 'ห้องสูงสุด 3', included: true },
      { name: 'ผู้ใช้สูงสุด 3', included: true },
      { name: 'วิเคราะห์ข้อมูล', included: false },
      { name: 'SMS/LINE Notification', included: false },
      { name: 'TV Display', included: false },
      { name: 'ซัพพอร์ตผ่าน Line', included: false },
    ],
    limits: { queues: 50, branches: 1, rooms: 3, users: 3, storage: '100 MB' },
  },
  {
    id: 'clinicq',
    name: 'Clinic-Q',
    nameEn: 'Clinic-Q Professional',
    description: 'ระบบจัดการคิวคลินิกครบวงจร',
    priceMonthly: 599,
    priceYearly: 5999,
    priceEarlyBird: 3999,
    color: '#9333EA',
    bgColor: '#F5F3FF',
    icon: '🦷',
    popular: true,
    features: [
      { name: 'คิวไม่จำกัด', included: true },
      { name: 'สาขาไม่จำกัด', included: true },
      { name: 'ห้องไม่จำกัด', included: true },
      { name: 'ผู้ใช้ไม่จำกัด', included: true },
      { name: 'วิเคราะห์ข้อมูลขั้นสูง', included: true },
      { name: 'Push Notification', included: true },
      { name: 'TV Display', included: true },
      { name: 'QR Code & Link', included: true },
      { name: 'ซัพพอร์ตผ่าน Line', included: true },
    ],
    limits: { queues: null, branches: null, rooms: null, users: null, storage: 'ไม่จำกัด' },
  },
]

export function getPlanConfig(plan: SubscriptionPlan): PlanConfig {
  return plans.find(p => p.id === plan) || plans[1] // default to clinicq
}

export function getDaysRemaining(endDate: string): number {
  const now = new Date()
  const end = new Date(endDate)
  return Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
}

export function isTrialActive(trialEndDate: string): boolean {
  return getDaysRemaining(trialEndDate) > 0
}

export function formatPrice(price: number): string {
  return new Intl.NumberFormat('th-TH').format(price) + ' บาท'
}

export function getTrialDaysLeft(trialEndDate: string): number {
  return Math.max(0, getDaysRemaining(trialEndDate))
}

// Early bird: subscribe before trial expires → 3999/year
export function isEarlyBirdEligible(trialEndDate: string): boolean {
  return isTrialActive(trialEndDate)
}
