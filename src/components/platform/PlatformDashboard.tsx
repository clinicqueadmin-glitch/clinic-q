'use client'

import { useState, useMemo, useEffect, useCallback } from 'react'
import {
  Building2, Users, Activity, AlertTriangle, CheckCircle,
  Clock, TrendingUp, Search, Crown,
  Zap, Star, Shield, Calendar, CreditCard, UserCheck, ExternalLink,
} from 'lucide-react'
import { clsx } from 'clsx'
import {
  packageConfig, getDaysRemaining, getTrialStatus,
  type PlatformClinic, type PackageType,
} from '@/lib/platform-data'
import { createClient } from '@/utils/supabase/client'

interface ClinicWithStats extends PlatformClinic {
  totalQueuesToday: number
  totalQueuesMonth: number
  totalUsers: number
  branches: number
  rooms: number
  phone: string
  isEarlyBird: boolean
  planType: 'trial' | 'monthly' | 'yearly'
}

const roleLabels: Record<string, string> = {
  platform_owner: 'เจ้าของระบบ',
  clinic_owner: 'เจ้าของคลินิก',
  manager: 'ผู้จัดการ',
  front_desk: 'เจ้าหน้าที่',
  provider: 'ผู้ทำหัตถการ',
}

const roleColors: Record<string, string> = {
  platform_owner: '#DC2626',
  clinic_owner: '#EA580C',
  manager: '#CA8A04',
  front_desk: '#16A34A',
  provider: '#2563EB',
}

const clinicTypeLabels: Record<string, string> = {
  dental: '🦷 คลินิกทันตกรรม',
  medical: '💊 คลินิกเวชกรรม',
  aesthetic: '✨ เสริมความงาม',
  thai: '🌿 แพทย์แผนไทย',
  chinese: '🧠 แพทย์แผนจีน',
  physical: '🦴 กายภาพบำบัด',
}

export default function PlatformDashboard() {
  const [userSearch, setUserSearch] = useState('')
  const [paymentFilter, setPaymentFilter] = useState<'all' | PackageType>('all')
  const [platformClinics, setPlatformClinics] = useState<ClinicWithStats[]>([])
  const [allUsers, setAllUsers] = useState<Array<{ id: string; name: string; email: string; role: string; clinicType: string; color: string }>>([])
  const [isLoading, setIsLoading] = useState(true)
  const [deleteConfirmClinic, setDeleteConfirmClinic] = useState<ClinicWithStats | null>(null)
  const [deleteStep, setDeleteStep] = useState<0 | 1 | 2>(0) // 0=confirm name, 1=confirm action, 2=deleting
  const [deleteError, setDeleteError] = useState('')
  const [deleteInputName, setDeleteInputName] = useState('')

  // Delete clinic — remove all data from Supabase
  const handleDeleteClinic = useCallback(async (clinic: ClinicWithStats) => {
    setDeleteError('')
    setDeleteStep(2)
    try {
      const sb = createClient()
      if (!sb) { setDeleteError('Supabase ไม่ได้เชื่อมต่อ'); setDeleteStep(1); return }

      // 1. Delete queues
      await sb.from('queues').delete().eq('clinic_id', clinic.id)
      // 2. Delete completed_procedures
      await sb.from('completed_procedures').delete().eq('clinic_id', clinic.id)
      // 3. Delete daily_rooms
      await sb.from('daily_rooms').delete().eq('clinic_id', clinic.id)
      // 4. Delete clinic_settings
      await sb.from('clinic_settings').delete().eq('clinic_id', clinic.id)
      // 5. Delete clinic_memberships
      await sb.from('clinic_memberships').delete().eq('clinic_id', clinic.id)
      // 6. Delete the clinic record
      await sb.from('clinics').delete().eq('id', clinic.id)

      // 7. Clean up localStorage
      const keysToRemove: string[] = []
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i)
        if (key && key.includes(clinic.id)) {
          keysToRemove.push(key)
        }
      }
      keysToRemove.forEach(k => localStorage.removeItem(k))

      // 8. Remove from state
      setPlatformClinics(prev => prev.filter(c => c.id !== clinic.id))
      setDeleteConfirmClinic(null)
      setDeleteStep(0)
      setDeleteInputName('')
    } catch (err: any) {
      setDeleteError(err.message || 'เกิดข้อผิดพลาดในการลบ')
      setDeleteStep(1)
    }
  }, [])

  // Enter clinic as platform owner — pretend to be clinic owner
  const enterClinic = useCallback((clinicId: string, clinicType: string) => {
    // Save platform owner session for back navigation
    const authRaw = localStorage.getItem('clinicq-auth') || localStorage.getItem('clinicq-auth-session')
    if (authRaw) {
      localStorage.setItem('clinicq-platform-session', authRaw)
    }
    // Create session as clinic owner so the full dashboard loads
    const clinicSession = {
      user: { id: 'platform-owner', email: 'admin@clinicq.com', name: 'เจ้าของระบบ', role: 'owner' },
      currentClinicId: clinicId,
      isViewingAsOwner: true, // Flag to indicate platform owner is viewing
    }
    localStorage.setItem('clinicq-auth', JSON.stringify(clinicSession))
    localStorage.setItem('clinic-q-type', clinicType)
    window.location.href = '/'
  }, [])

  // Load clinics from Supabase
  useEffect(() => {
    const loadClinics = async () => {
      try {
        const sb = createClient()
        if (!sb) { setIsLoading(false); return }
        const { data: clinics, error } = await sb.from('clinics').select('*')
        if (error || !clinics) { setIsLoading(false); return }

        // Load stats for each clinic
        const today = new Date().toISOString().split('T')[0]
        const enriched: ClinicWithStats[] = await Promise.all(clinics.map(async (c: any) => {
          // Count queues today
          const { count: queuesToday } = await sb.from('queues')
            .select('*', { count: 'exact', head: true })
            .eq('clinic_id', c.id)
            .eq('queue_date', today)
          // Count total users (memberships)
          const { count: users } = await sb.from('clinic_memberships')
            .select('*', { count: 'exact', head: true })
            .eq('clinic_id', c.id)
          // Get owner info from memberships
          const { data: ownerMembership } = await sb.from('clinic_memberships')
            .select('user_id, role')
            .eq('clinic_id', c.id)
            .eq('role', 'owner')
            .limit(1)
            .single()
          let ownerName = ''
          let ownerEmail = ''
          if (ownerMembership?.user_id) {
            const { data: ownerUser } = await sb.from('users')
              .select('name, email')
              .eq('id', ownerMembership.user_id)
              .limit(1)
              .single()
            if (ownerUser) {
              ownerName = ownerUser.name || ''
              ownerEmail = ownerUser.email || ''
            }
          }
          // Get subscription from localStorage
          let planType: 'trial' | 'monthly' | 'yearly' = 'trial'
          let isEarlyBird = false
          let expiresAt: string | null = null
          let registeredAt = c.created_at || ''
          try {
            const subRaw = localStorage.getItem(`clinicq-subscription-${c.id}`)
            if (subRaw) {
              const sub = JSON.parse(subRaw)
              planType = sub.plan || 'trial'
              if (sub.paidEndDate) expiresAt = new Date(sub.paidEndDate).toLocaleDateString('th-TH')
              else if (sub.trialEndDate) expiresAt = new Date(sub.trialEndDate).toLocaleDateString('th-TH')
              if (sub.startDate) registeredAt = new Date(sub.startDate).toLocaleDateString('th-TH')
              // Check Early Bird (registered within 7 days)
              if (sub.startDate && sub.plan === 'yearly') {
                const start = new Date(sub.startDate)
                const ebEnd = new Date(start)
                ebEnd.setDate(ebEnd.getDate() + 7)
                isEarlyBird = sub.paymentAmount === 3999 || (new Date() <= ebEnd)
              }
            }
          } catch {}
          // Get phone from clinic settings
          let phone = ''
          try {
            const settingsRaw = localStorage.getItem(`clinic-q-settings-${c.id}`)
            if (settingsRaw) {
              const settings = JSON.parse(settingsRaw)
              phone = settings.phone || ''
            }
          } catch {}
          return {
            id: c.id,
            name: c.name,
            type: c.type || 'dental',
            prefix: c.prefix || 'Q',
            color: c.color || '#9333EA',
            ownerName,
            ownerEmail,
            phone,
            package: planType === 'trial' ? 'free_trial' : 'clinicq' as PackageType,
            planType,
            isEarlyBird,
            status: 'active' as const,
            registeredAt,
            expiresAt,
            totalQueuesToday: queuesToday || 0,
            totalQueuesMonth: 0,
            totalUsers: users || 0,
            branches: 0,
            rooms: 0,
          }
        }))
        setPlatformClinics(enriched)

        // Load users from clinic_memberships + users
        const { data: memberships } = await sb.from('clinic_memberships').select('*, clinics(type, name)')
        if (memberships) {
          const usersList = memberships.map((m: any) => ({
            id: m.user_id || m.id,
            name: m.user_name || '',
            email: m.user_email || '',
            role: m.role || '',
            clinicType: m.clinics?.type || '',
            color: '#6B7280',
          }))
          setAllUsers(usersList)
        }
      } catch {}
      setIsLoading(false)
    }
    loadClinics()
  }, [])

  // Stats
  const stats = useMemo(() => {
    const total = platformClinics.length
    const active = platformClinics.filter(c => c.status === 'active').length
    const free = platformClinics.filter(c => c.package === 'free_trial').length
    const paid = platformClinics.filter(c => c.package !== 'free_trial').length
    const expiring = platformClinics.filter(c => {
      const t = getTrialStatus(c.expiresAt)
      return t === 'expiring' || t === 'expired'
    }).length
    const totalQueuesToday = platformClinics.reduce((sum, c) => sum + c.totalQueuesToday, 0)
    const totalUsers = platformClinics.reduce((sum, c) => sum + c.totalUsers, 0)
    return { total, active, free, paid, expiring, totalQueuesToday, totalUsers }
  }, [platformClinics])

  // Filtered users
  const filteredUsers = useMemo(() => {
    if (!userSearch) return allUsers
    const q = userSearch.toLowerCase()
    return allUsers.filter(u =>
      u.name.toLowerCase().includes(q) ||
      u.email.toLowerCase().includes(q) ||
      u.role.toLowerCase().includes(q) ||
      u.clinicType.toLowerCase().includes(q)
    )
  }, [userSearch])

  // Active clinics for payment section
  const activeClinics = useMemo(() => {
    let clinics = platformClinics.filter(c => c.status === 'active')
    if (paymentFilter !== 'all') {
      clinics = clinics.filter(c => c.package === paymentFilter)
    }
    return clinics
  }, [paymentFilter, platformClinics])

  // Expiring clinics
  const expiringClinics = useMemo(() => {
    return platformClinics.filter(c => {
      const t = getTrialStatus(c.expiresAt)
      return t === 'expiring' || t === 'expired'
    }).sort((a, b) => {
      const da = getDaysRemaining(a.expiresAt) ?? 0
      const db = getDaysRemaining(b.expiresAt) ?? 0
      return da - db
    })
  }, [platformClinics])

  // Duplicate/expired clinics (same name, expired trial)
  const duplicateExpiredClinics = useMemo(() => {
    const nameMap = new Map<string, ClinicWithStats[]>()
    platformClinics.forEach(c => {
      const normalizedName = c.name.toLowerCase().trim()
      if (!nameMap.has(normalizedName)) nameMap.set(normalizedName, [])
      nameMap.get(normalizedName)!.push(c)
    })
    const duplicates: ClinicWithStats[] = []
    nameMap.forEach((clinics, name) => {
      if (clinics.length > 1) {
        clinics.forEach(c => {
          const trial = getTrialStatus(c.expiresAt)
          if (trial === 'expired') duplicates.push(c)
        })
      }
    })
    return duplicates.sort((a, b) => {
      const da = getDaysRemaining(a.expiresAt) ?? 0
      const db = getDaysRemaining(b.expiresAt) ?? 0
      return da - db
    })
  }, [platformClinics])

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50/30">
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-red-500 to-pink-500 flex items-center justify-center shadow-lg shadow-red-200">
              <Crown className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-extrabold text-gray-900">แดชบอร์ด Platform</h1>
              <p className="text-sm text-gray-500">ภาพรวมระบบจัดการคิวทั้งหมด</p>
            </div>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="rounded-2xl p-5 text-white bg-gradient-to-br from-blue-500 to-blue-600 shadow-lg shadow-blue-200">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-8 h-8 bg-white/20 rounded-xl flex items-center justify-center">
                <Building2 className="w-4 h-4 text-white" />
              </div>
              <p className="text-xs font-bold text-white/80">คลินิกทั้งหมด</p>
            </div>
            <p className="text-3xl font-extrabold">{stats.total}</p>
            <p className="text-xs text-white/60 mt-1">{stats.active} ใช้งาน · {stats.total - stats.active} ไม่ใช้งาน</p>
          </div>
          <div className="rounded-2xl p-5 text-white bg-gradient-to-br from-purple-500 to-purple-600 shadow-lg shadow-purple-200">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-8 h-8 bg-white/20 rounded-xl flex items-center justify-center">
                <Users className="w-4 h-4 text-white" />
              </div>
              <p className="text-xs font-bold text-white/80">ผู้ใช้งานทั้งหมด</p>
            </div>
            <p className="text-3xl font-extrabold">{stats.totalUsers}</p>
            <p className="text-xs text-white/60 mt-1">ในทุกคลินิกรวมกัน</p>
          </div>
          <div className="rounded-2xl p-5 text-white bg-gradient-to-br from-green-500 to-emerald-600 shadow-lg shadow-green-200">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-8 h-8 bg-white/20 rounded-xl flex items-center justify-center">
                <Activity className="w-4 h-4 text-white" />
              </div>
              <p className="text-xs font-bold text-white/80">คิววันนี้</p>
            </div>
            <p className="text-3xl font-extrabold">{stats.totalQueuesToday}</p>
            <p className="text-xs text-white/60 mt-1">รวมทุกคลินิก</p>
          </div>
          <div className="rounded-2xl p-5 text-white bg-gradient-to-br from-amber-500 to-orange-500 shadow-lg shadow-amber-200">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-8 h-8 bg-white/20 rounded-xl flex items-center justify-center">
                <AlertTriangle className="w-4 h-4 text-white" />
              </div>
              <p className="text-xs font-bold text-white/80">ใกล้หมดอายุ</p>
            </div>
            <p className="text-3xl font-extrabold">{stats.expiring}</p>
            <p className="text-xs text-white/60 mt-1">{stats.free} ทดลอง · {stats.paid} ชำระเงิน</p>
          </div>
        </div>

        {/* ═══ Section 1: ผู้ใช้งาน Platform ═══ */}
        <div id="users" className="bg-white rounded-3xl shadow-sm border border-gray-100 p-6 mb-8 scroll-mt-20">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-purple-500 to-indigo-500 flex items-center justify-center">
                <UserCheck className="w-5 h-5 text-white" />
              </div>
              <div>
                <h2 className="text-lg font-extrabold text-gray-900">👤 ผู้ใช้งาน Platform</h2>
                <p className="text-xs text-gray-400">ผู้ใช้งานทั้งหมด {allUsers.length} คน</p>
              </div>
            </div>
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={userSearch}
                onChange={(e) => setUserSearch(e.target.value)}
                placeholder="ค้นหาชื่อ, อีเมล..."
                className="pl-9 pr-4 py-2 rounded-xl bg-gray-50 border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-purple-200 w-56"
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left text-[10px] font-bold text-gray-400 uppercase pb-3 px-3">ผู้ใช้งาน</th>
                  <th className="text-left text-[10px] font-bold text-gray-400 uppercase pb-3 px-3">อีเมล</th>
                  <th className="text-left text-[10px] font-bold text-gray-400 uppercase pb-3 px-3">Role</th>
                  <th className="text-left text-[10px] font-bold text-gray-400 uppercase pb-3 px-3">คลินิก</th>
                  <th className="text-center text-[10px] font-bold text-gray-400 uppercase pb-3 px-3">สถานะ</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map(user => (
                  <tr key={user.id} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                    <td className="py-3 px-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-xl flex items-center justify-center text-white text-xs font-bold shadow-sm" style={{ backgroundColor: user.color }}>
                          {user.name.charAt(0)}
                        </div>
                        <span className="text-sm font-bold text-gray-800">{user.name}</span>
                      </div>
                    </td>
                    <td className="py-3 px-3 text-xs text-gray-500">{user.email}</td>
                    <td className="py-3 px-3">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold" style={{ backgroundColor: `${roleColors[user.role]}15`, color: roleColors[user.role] }}>
                        {roleLabels[user.role] || user.role}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-xs text-gray-500">
                      {user.clinicType === '-' ? 'Platform' : clinicTypeLabels[user.clinicType] || user.clinicType}
                    </td>
                    <td className="py-3 px-3 text-center">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-green-100 text-green-700 text-[10px] font-bold">
                        <span className="w-1.5 h-1.5 rounded-full bg-green-500" /> Active
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {filteredUsers.length === 0 && (
            <div className="text-center py-8 text-gray-400 text-sm">ไม่พบผู้ใช้งานที่ค้นหา</div>
          )}
        </div>

        {/* ═══ Section 2: คลินิกทั้งหมด ═══ */}
        <div id="payments" className="bg-white rounded-3xl shadow-sm border border-gray-100 p-6 mb-8 scroll-mt-20">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-green-500 to-emerald-500 flex items-center justify-center">
                <CreditCard className="w-5 h-5 text-white" />
              </div>
              <div>
                <h2 className="text-lg font-extrabold text-gray-900">💰 รายชื่อคลินิกทั้งหมด</h2>
                <p className="text-xs text-gray-400">ทดลองใช้ {stats.free} คลินิก · ชำระเงิน {stats.paid} คลินิก</p>
              </div>
            </div>
            <div className="flex gap-1.5">
              {(['all', 'free_trial', 'clinicq'] as const).map(f => (
                <button
                  key={f}
                  onClick={() => setPaymentFilter(f)}
                  className={clsx(
                    'px-3 py-1.5 rounded-xl text-xs font-bold transition-all',
                    paymentFilter === f
                      ? 'bg-gray-900 text-white shadow-md'
                      : 'bg-white text-gray-500 hover:bg-gray-50 border border-gray-200'
                  )}
                >
                  {f === 'all' ? 'ทั้งหมด' : f === 'free_trial' ? 'ทดลองใช้' : 'ชำระเงิน'}
                </button>
              ))}
            </div>
          </div>

          {/* Summary Cards */}
          <div className="grid grid-cols-3 gap-3 mb-6">
            <div className="rounded-2xl p-4 bg-blue-50 border border-blue-100">
              <p className="text-xs font-bold text-blue-600">🧪 ทดลองใช้</p>
              <p className="text-2xl font-extrabold text-blue-700 mt-1">{stats.free}</p>
              <p className="text-[10px] text-blue-500">คลินิก</p>
            </div>
            <div className="rounded-2xl p-4 bg-green-50 border border-green-100">
              <p className="text-xs font-bold text-green-600">⭐ ชำระเงิน</p>
              <p className="text-2xl font-extrabold text-green-700 mt-1">{stats.paid}</p>
              <p className="text-[10px] text-green-500">คลินิก</p>
            </div>
            <div className="rounded-2xl p-4 bg-amber-50 border border-amber-100">
              <p className="text-xs font-bold text-amber-600">🔥 Early Bird</p>
              <p className="text-2xl font-extrabold text-amber-700 mt-1">{platformClinics.filter(c => c.isEarlyBird).length}</p>
              <p className="text-[10px] text-amber-500">คลินิก</p>
            </div>
          </div>

          {/* Detailed Table */}
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left text-[10px] font-bold text-gray-400 uppercase pb-3 px-3">ชื่อคลินิก</th>
                  <th className="text-left text-[10px] font-bold text-gray-400 uppercase pb-3 px-3">ประเภท</th>
                  <th className="text-left text-[10px] font-bold text-gray-400 uppercase pb-3 px-3">เบอร์โทร</th>
                  <th className="text-left text-[10px] font-bold text-gray-400 uppercase pb-3 px-3">ชื่อผู้สมัคร</th>
                  <th className="text-left text-[10px] font-bold text-gray-400 uppercase pb-3 px-3">Email</th>
                  <th className="text-center text-[10px] font-bold text-gray-400 uppercase pb-3 px-3">วันสมัคร</th>
                  <th className="text-center text-[10px] font-bold text-gray-400 uppercase pb-3 px-3">วันหมดอายุ</th>
                  <th className="text-center text-[10px] font-bold text-gray-400 uppercase pb-3 px-3">สถานะ</th>
                  <th className="text-center text-[10px] font-bold text-gray-400 uppercase pb-3 px-3"></th>
                </tr>
              </thead>
              <tbody>
                {activeClinics.map(clinic => {
                  const trial = getTrialStatus(clinic.expiresAt)
                  const daysLeft = getDaysRemaining(clinic.expiresAt)
                  const isTrial = clinic.planType === 'trial'
                  const isPaid = clinic.planType === 'yearly' || clinic.planType === 'monthly'
                  return (
                    <tr key={clinic.id} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                      <td className="py-3 px-3">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-2xl flex items-center justify-center text-white font-bold shadow-sm" style={{ backgroundColor: clinic.color }}>
                            {clinic.prefix}
                          </div>
                          <div>
                            <p className="text-sm font-bold text-gray-800">{clinic.name}</p>
                            {clinic.isEarlyBird && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-700 mt-1">
                                🔥 Early Bird
                              </span>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-3">
                        <span className="text-xs text-gray-600">{clinicTypeLabels[clinic.type] || clinic.type}</span>
                      </td>
                      <td className="py-3 px-3">
                        <span className="text-xs text-gray-600">{clinic.phone || '-'}</span>
                      </td>
                      <td className="py-3 px-3">
                        <span className="text-xs font-medium text-gray-800">{clinic.ownerName || '-'}</span>
                      </td>
                      <td className="py-3 px-3">
                        <span className="text-xs text-gray-500">{clinic.ownerEmail || '-'}</span>
                      </td>
                      <td className="py-3 px-3 text-center">
                        <span className="text-xs text-gray-500">{clinic.registeredAt || '-'}</span>
                      </td>
                      <td className="py-3 px-3 text-center">
                        {clinic.expiresAt ? (
                          <div>
                            <span className={clsx('text-xs font-bold', trial === 'expiring' ? 'text-amber-600' : trial === 'expired' ? 'text-red-600' : 'text-gray-600')}>
                              {clinic.expiresAt}
                            </span>
                            {daysLeft !== null && daysLeft > 0 && (
                              <p className="text-[10px] text-gray-400">(เหลือ {daysLeft} วัน)</p>
                            )}
                          </div>
                        ) : (
                          <span className="text-xs text-gray-400">-</span>
                        )}
                      </td>
                      <td className="py-3 px-3 text-center">
                        {isTrial ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-blue-100 text-blue-700">
                            🧪 ทดลองใช้
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-green-100 text-green-700">
                            ⭐ {clinic.planType === 'yearly' ? 'รายปี' : 'รายเดือน'}
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-3 text-center">
                        <div className="flex items-center gap-1.5 justify-center">
                          <button
                            onClick={() => enterClinic(clinic.id, clinic.type)}
                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold text-white bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600 transition-all shadow-sm"
                          >
                            <ExternalLink className="w-3 h-3" />
                            เข้าคลินิก
                          </button>
                          <button
                            onClick={() => { setDeleteConfirmClinic(clinic); setDeleteStep(0); setDeleteInputName(''); setDeleteError('') }}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold text-red-600 bg-red-50 hover:bg-red-100 border border-red-200 transition-all"
                            title="ลบคลินิก"
                          >
                            🗑️ ลบ
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          {activeClinics.length === 0 && (
            <div className="text-center py-8 text-gray-400 text-sm">ไม่พบคลินิก</div>
          )}
        </div>

        {/* ═══ Section 3: คลินิกสมัครซ้ำหลังหมดอายุ ═══ */}
        {duplicateExpiredClinics.length > 0 && (
          <div id="duplicates" className="bg-white rounded-3xl shadow-sm border border-red-100 p-6 mb-8 scroll-mt-20">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-red-500 to-pink-500 flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-white" />
              </div>
              <div>
                <h2 className="text-lg font-extrabold text-gray-900">🔄 คลินิกสมัครซ้ำ (หมดอายุแล้ว)</h2>
                <p className="text-xs text-gray-400">คลินิกที่มีชื่อซ้ำกันและหมดอายุทดลองใช้งานแล้ว {duplicateExpiredClinics.length} คลินิก</p>
              </div>
            </div>
            <div className="space-y-3">
              {duplicateExpiredClinics.map(clinic => {
                const daysLeft = getDaysRemaining(clinic.expiresAt)
                return (
                  <div key={clinic.id} className="rounded-2xl border border-red-200 bg-red-50/50 p-4">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-white font-bold shadow-md bg-red-400">
                        {clinic.prefix}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-bold text-gray-900">{clinic.name}</p>
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-100 text-red-700">
                            สมัครซ้ำ
                          </span>
                        </div>
                        <p className="text-xs text-gray-500 mt-0.5">{clinic.type} · หมดอายุแล้ว</p>
                      </div>
                      <div className="text-right">
                        <div className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-sm font-bold bg-red-100 text-red-700">
                          ✗ หมดอายุ
                        </div>
                        <p className="text-[10px] text-gray-400 mt-1">หมดอายุ: {clinic.expiresAt}</p>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* ═══ Section 4: คลินิกใกล้หมดอายุ ═══ */}
        <div id="expiring" className="bg-white rounded-3xl shadow-sm border border-gray-100 p-6 scroll-mt-20">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center">
              <AlertTriangle className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-extrabold text-gray-900">⏰ คลินิกใกล้หมดอายุ</h2>
              <p className="text-xs text-gray-400">คลินิกที่ต้องต่ออายุ {expiringClinics.length} คลินิก</p>
            </div>
          </div>

          {expiringClinics.length === 0 ? (
            <div className="text-center py-8 text-gray-400 text-sm">
              <CheckCircle className="w-12 h-12 text-green-300 mx-auto mb-3" />
              ไม่มีคลินิกที่ใกล้หมดอายุ
            </div>
          ) : (
            <div className="space-y-3">
              {expiringClinics.map(clinic => {
                const daysLeft = getDaysRemaining(clinic.expiresAt)
                const trial = getTrialStatus(clinic.expiresAt)
                const pkg = packageConfig[clinic.package]
                const isExpired = trial === 'expired'
                return (
                  <div
                    key={clinic.id}
                    className={clsx(
                      'rounded-2xl border p-4 transition-all',
                      isExpired ? 'border-red-200 bg-red-50/50' : 'border-amber-200 bg-amber-50/50'
                    )}
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-white font-bold shadow-md" style={{ backgroundColor: clinic.color }}>
                        {clinic.prefix}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-bold text-gray-900">{clinic.name}</p>
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold" style={{ backgroundColor: pkg.bgColor, color: pkg.color }}>
                            {pkg.label}
                          </span>
                        </div>
                        <p className="text-xs text-gray-500 mt-0.5">{clinic.ownerName} · {clinic.type}</p>
                      </div>
                      <div className="text-right">
                        <div className={clsx(
                          'inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-sm font-bold',
                          isExpired ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'
                        )}>
                          {isExpired ? (
                            <>✗ หมดอายุแล้ว</>
                          ) : (
                            <>⚠ เหลือ {daysLeft} วัน</>
                          )}
                        </div>
                        <p className="text-[10px] text-gray-400 mt-1">หมดอายุ: {clinic.expiresAt}</p>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* ═══ Delete Clinic Confirmation Dialog ═══ */}
      {deleteConfirmClinic && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-3xl shadow-2xl max-w-lg w-full overflow-hidden">
            {/* Header */}
            <div className="bg-gradient-to-r from-red-500 to-pink-500 px-6 py-5">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-white/20 flex items-center justify-center">
                  <span className="text-2xl">🗑️</span>
                </div>
                <div>
                  <h3 className="text-lg font-extrabold text-white">ลบคลินิก</h3>
                  <p className="text-sm text-white/80">การดำเนินการนี้ไม่สามารถย้อนกลับได้</p>
                </div>
              </div>
            </div>

            <div className="p-6">
              {/* Step 0: Type clinic name to confirm */}
              {deleteStep === 0 && (
                <>
                  <div className="rounded-2xl bg-red-50 border border-red-200 p-4 mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-white font-bold shadow-md" style={{ backgroundColor: deleteConfirmClinic.color }}>
                        {deleteConfirmClinic.prefix}
                      </div>
                      <div>
                        <p className="text-sm font-bold text-gray-900">{deleteConfirmClinic.name}</p>
                        <p className="text-xs text-gray-500">{deleteConfirmClinic.ownerName} · {deleteConfirmClinic.ownerEmail}</p>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-xl bg-amber-50 border border-amber-200 p-3 mb-4">
                    <p className="text-xs text-amber-700 font-bold">⚠️ ข้อมูลที่จะถูกลบทั้งหมด:</p>
                    <ul className="text-xs text-amber-600 mt-1.5 space-y-0.5 ml-4">
                      <li>• ข้อมูลคลินิก (Clinic Profile)</li>
                      <li>• ข้อมูลผู้ใช้ทั้งหมดในคลินิก</li>
                      <li>• คิวทั้งหมด (รอ/กำลังทำ/เสร็จ/ยกเลิก)</li>
                      <li>• ห้องตรวจและการตั้งค่าทั้งหมด</li>
                      <li>• ข้อความโฆษณา TV</li>
                      <li>• สาขาและหัตถการ</li>
                      <li>• ข้อมูลหัตถการที่เสร็จแล้ว</li>
                    </ul>
                  </div>

                  <p className="text-sm text-gray-600 mb-2">
                    พิมพ์ชื่อคลินิก <span className="font-bold text-red-600">{deleteConfirmClinic.name}</span> เพื่อยืนยัน:
                  </p>
                  <input
                    type="text"
                    value={deleteInputName}
                    onChange={(e) => setDeleteInputName(e.target.value)}
                    placeholder={deleteConfirmClinic.name}
                    className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 text-sm focus:outline-none focus:border-red-400 focus:ring-2 focus:ring-red-100 mb-4"
                    autoFocus
                  />
                  {deleteError && (
                    <p className="text-xs text-red-600 mb-3">❌ {deleteError}</p>
                  )}
                </>
              )}

              {/* Step 1: Final confirmation */}
              {deleteStep === 1 && (
                <div className="text-center">
                  <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
                    <span className="text-3xl">⚠️</span>
                  </div>
                  <p className="text-sm font-bold text-gray-900 mb-2">
                    คุณแน่ใจหรือไม่ที่จะลบ "{deleteConfirmClinic.name}"?
                  </p>
                  <p className="text-xs text-gray-500 mb-4">
                    การดำเนินการนี้จะลบข้อมูลทั้งหมดและไม่สามารถกู้คืนได้
                  </p>
                </div>
              )}

              {/* Step 2: Deleting... */}
              {deleteStep === 2 && (
                <div className="text-center py-4">
                  <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4 animate-pulse">
                    <span className="text-3xl">🗑️</span>
                  </div>
                  <p className="text-sm font-bold text-gray-900">กำลังลบข้อมูล...</p>
                  <p className="text-xs text-gray-500 mt-1">กรุณารอสักครู่</p>
                </div>
              )}

              {/* Buttons */}
              <div className="flex gap-3">
                <button
                  onClick={() => { setDeleteConfirmClinic(null); setDeleteStep(0); setDeleteInputName(''); setDeleteError('') }}
                  disabled={deleteStep === 2}
                  className="flex-1 px-4 py-3 rounded-xl text-sm font-bold text-gray-600 bg-gray-100 hover:bg-gray-200 transition-all disabled:opacity-50"
                >
                  ยกเลิก
                </button>
                {deleteStep === 0 && (
                  <button
                    onClick={() => {
                      if (deleteInputName.trim() === deleteConfirmClinic.name) {
                        setDeleteStep(1)
                        setDeleteError('')
                      } else {
                        setDeleteError('ชื่อคลินิกไม่ตรงกัน กรุณาพิมพ์ใหม่')
                      }
                    }}
                    disabled={!deleteInputName.trim()}
                    className="flex-1 px-4 py-3 rounded-xl text-sm font-bold text-white bg-amber-500 hover:bg-amber-600 transition-all disabled:opacity-50"
                  >
                    ถัดไป
                  </button>
                )}
                {deleteStep === 1 && (
                  <button
                    onClick={() => handleDeleteClinic(deleteConfirmClinic)}
                    className="flex-1 px-4 py-3 rounded-xl text-sm font-bold text-white bg-gradient-to-r from-red-500 to-pink-500 hover:from-red-600 hover:to-pink-600 transition-all shadow-lg shadow-red-200"
                  >
                    🗑️ ลบถาวร
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
