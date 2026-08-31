'use client'

import { useState, useMemo, useEffect } from 'react'
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
          return {
            id: c.id,
            name: c.name,
            type: c.type || 'dental',
            prefix: c.prefix || 'Q',
            color: c.color || '#9333EA',
            ownerName: '',
            ownerEmail: '',
            package: 'clinicq' as PackageType,
            status: 'active' as const,
            registeredAt: c.created_at || '',
            expiresAt: null,
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
  }, [paymentFilter])

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
  }, [])

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

        {/* ═══ Section 2: การชำระเงิน ═══ */}
        <div id="payments" className="bg-white rounded-3xl shadow-sm border border-gray-100 p-6 mb-8 scroll-mt-20">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-green-500 to-emerald-500 flex items-center justify-center">
                <CreditCard className="w-5 h-5 text-white" />
              </div>
              <div>
                <h2 className="text-lg font-extrabold text-gray-900">💰 การชำระเงิน</h2>
                <p className="text-xs text-gray-400">คลินิกที่ใช้งานอยู่ {stats.active} คลินิก</p>
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
                  {f === 'all' ? 'ทั้งหมด' : packageConfig[f as PackageType]?.label}
                </button>
              ))}
            </div>
          </div>

          {/* Package Distribution */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
            {(Object.entries(packageConfig) as [PackageType, typeof packageConfig[PackageType]][]).map(([key, pkg]) => {
              const count = platformClinics.filter(c => c.package === key && c.status === 'active').length
              return (
                <div key={key} className="rounded-2xl p-4 border border-gray-100" style={{ backgroundColor: pkg.bgColor }}>
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: pkg.color }} />
                    <span className="text-xs font-bold" style={{ color: pkg.color }}>{pkg.label}</span>
                  </div>
                  <p className="text-2xl font-extrabold text-gray-900">{count}</p>
                  <p className="text-[10px] text-gray-400 mt-1">คลินิก</p>
                </div>
              )
            })}
          </div>

          {/* Payment Table */}
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left text-[10px] font-bold text-gray-400 uppercase pb-3 px-3">คลินิก</th>
                  <th className="text-left text-[10px] font-bold text-gray-400 uppercase pb-3 px-3">เจ้าของ</th>
                  <th className="text-center text-[10px] font-bold text-gray-400 uppercase pb-3 px-3">Package</th>
                  <th className="text-center text-[10px] font-bold text-gray-400 uppercase pb-3 px-3">คิว/เดือน</th>
                  <th className="text-center text-[10px] font-bold text-gray-400 uppercase pb-3 px-3">ผู้ใช้</th>
                  <th className="text-center text-[10px] font-bold text-gray-400 uppercase pb-3 px-3">วันหมดอายุ</th>
                  <th className="text-center text-[10px] font-bold text-gray-400 uppercase pb-3 px-3">สถานะ</th>
                  <th className="text-center text-[10px] font-bold text-gray-400 uppercase pb-3 px-3"></th>
                </tr>
              </thead>
              <tbody>
                {activeClinics.map(clinic => {
                  const pkg = packageConfig[clinic.package]
                  const trial = getTrialStatus(clinic.expiresAt)
                  const daysLeft = getDaysRemaining(clinic.expiresAt)
                  return (
                    <tr key={clinic.id} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                      <td className="py-3 px-3">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-2xl flex items-center justify-center text-white font-bold shadow-sm" style={{ backgroundColor: clinic.color }}>
                            {clinic.prefix}
                          </div>
                          <div>
                            <p className="text-sm font-bold text-gray-800">{clinic.name}</p>
                            <p className="text-[10px] text-gray-400">{clinic.type}</p>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-3 text-xs text-gray-500">{clinic.ownerName}</td>
                      <td className="py-3 px-3 text-center">
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold" style={{ backgroundColor: pkg.bgColor, color: pkg.color }}>
                          {clinic.package === 'clinicq' ? <Star className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
                          {pkg.label}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-center text-sm font-bold text-gray-700">{clinic.totalQueuesMonth}</td>
                      <td className="py-3 px-3 text-center text-sm font-bold text-gray-700">{clinic.totalUsers}</td>
                      <td className="py-3 px-3 text-center">
                        {clinic.expiresAt ? (
                          <span className={clsx('text-xs font-bold', trial === 'expiring' ? 'text-amber-600' : trial === 'expired' ? 'text-red-600' : 'text-gray-500')}>
                            {clinic.expiresAt}
                            {daysLeft !== null && daysLeft > 0 && <span className="text-[10px] ml-1">({daysLeft} วัน)</span>}
                          </span>
                        ) : (
                          <span className="text-xs text-blue-600 font-bold">ไม่จำกัด</span>
                        )}
                      </td>
                      <td className="py-3 px-3 text-center">
                        <span className={clsx('inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold',
                          trial === 'active' ? 'bg-green-100 text-green-700' :
                          trial === 'expiring' ? 'bg-amber-100 text-amber-700' :
                          trial === 'expired' ? 'bg-red-100 text-red-700' :
                          'bg-blue-100 text-blue-700'
                        )}>
                          {trial === 'active' ? '✓ ปกติ' : trial === 'expiring' ? '⚠ ใกล้หมด' : trial === 'expired' ? '✗ หมดอายุ' : '∞ ไม่จำกัด'}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-center">
                        <button
                          onClick={() => {
                            // Switch to this clinic and go to dashboard
                            localStorage.setItem('clinic-q-type', clinic.type)
                            window.location.href = '/'
                          }}
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold text-white bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600 transition-all shadow-sm"
                        >
                          <ExternalLink className="w-3 h-3" />
                          เข้าคลินิก
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* ═══ Section 3: คลินิกใกล้หมดอายุ ═══ */}
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
    </div>
  )
}
