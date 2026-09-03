'use client'

import { Bell, Search, User, ChevronDown, X, Home, ArrowLeft, Building2, Clock, AlertTriangle } from 'lucide-react'
import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'
import { useClinic } from '@/lib/clinic-context'
import { roleConfig, platformRoleConfig, type ClinicRole } from '@/lib/auth-types'

export default function Header() {
  const [showNotifications, setShowNotifications] = useState(false)
  const [showUserMenu, setShowUserMenu] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [showMobileSearch, setShowMobileSearch] = useState(false)
  const router = useRouter()
  const notifRef = useRef<HTMLDivElement>(null)
  const userRef = useRef<HTMLDivElement>(null)
  const { user, currentRole, currentClinicId, getUserClinics, logout } = useAuth()
  
  // Check if platform owner is viewing a clinic
  const [isViewingAsOwner, setIsViewingAsOwner] = useState(false)
  useEffect(() => {
    try {
      const authRaw = localStorage.getItem('clinicq-auth')
      if (authRaw) {
        const auth = JSON.parse(authRaw)
        setIsViewingAsOwner(!!auth.isViewingAsOwner)
      }
    } catch {}
  }, [])
  
  const backToPlatform = () => {
    const platformSession = localStorage.getItem('clinicq-platform-session')
    if (platformSession) {
      // Restore platform_owner role
      try {
        const parsed = JSON.parse(platformSession)
        parsed.user.role = 'platform_owner'
        localStorage.setItem('clinicq-auth', JSON.stringify(parsed))
      } catch {
        localStorage.setItem('clinicq-auth', platformSession)
      }
      localStorage.removeItem('clinicq-platform-session')
    }
    window.location.href = '/platform'
  }
  
  // Get role config (handle both clinic role and platform role)
  const getRoleDisplay = () => {
    if (currentRole === 'platform_owner') {
      return platformRoleConfig
    }
    return currentRole ? roleConfig[currentRole as ClinicRole] : null
  }
  
  const roleCfg = getRoleDisplay()
  
  // Get current clinic name
  const clinics = getUserClinics()
  const currentClinic = clinics.find(c => c.id === currentClinicId)
  
  // Trial status
  const [trialInfo, setTrialInfo] = useState<{ isTrial: boolean; daysLeft: number; endDate: string } | null>(null)
  
  useEffect(() => {
    if (currentClinicId && typeof window !== 'undefined') {
      const saved = localStorage.getItem(`clinicq-subscription-${currentClinicId}`)
      if (saved) {
        try {
          const data = JSON.parse(saved)
          if (data.plan === 'trial' && data.status === 'active') {
            const end = new Date(data.trialEndDate)
            const now = new Date()
            const daysLeft = Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
            setTrialInfo({
              isTrial: true,
              daysLeft: Math.max(0, daysLeft),
              endDate: end.toLocaleDateString('th-TH', { day: 'numeric', month: 'long', year: 'numeric' }),
            })
          } else {
            setTrialInfo(null)
          }
        } catch {}
      } else {
        // No subscription data — calculate from registration date
        try {
          const clinics = JSON.parse(localStorage.getItem('clinicq-clinics') || '[]')
          const registeredClinics = JSON.parse(localStorage.getItem('clinicq-registered-clinics') || '[]')
          const regClinic = clinics.find((c: any) => c.id === currentClinicId) || registeredClinics.find((c: any) => c.id === currentClinicId)
          const regDate = regClinic?.registeredAt || regClinic?.createdAt
          if (regDate) {
            const start = new Date(regDate)
            const trialEnd = new Date(start)
            trialEnd.setDate(trialEnd.getDate() + 30)
            const now = new Date()
            const daysLeft = Math.ceil((trialEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
            // Save subscription data for future use
            localStorage.setItem(`clinicq-subscription-${currentClinicId}`, JSON.stringify({
              plan: 'trial', status: 'active',
              startDate: start.toISOString(),
              trialEndDate: trialEnd.toISOString(),
              paidEndDate: null,
            }))
            setTrialInfo({
              isTrial: true,
              daysLeft: Math.max(0, daysLeft),
              endDate: trialEnd.toLocaleDateString('th-TH', { day: 'numeric', month: 'long', year: 'numeric' }),
            })
          } else {
            setTrialInfo({ isTrial: true, daysLeft: 30, endDate: '—' })
          }
        } catch {
          setTrialInfo({ isTrial: true, daysLeft: 30, endDate: '—' })
        }
      }
    }
  }, [currentClinicId])

  // Close dropdowns on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setShowNotifications(false)
      }
      if (userRef.current && !userRef.current.contains(e.target as Node)) {
        setShowUserMenu(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    if (searchQuery.trim()) {
      router.push(`/queue?search=${encodeURIComponent(searchQuery.trim())}`)
      setSearchQuery('')
      setShowMobileSearch(false)
    }
  }

  const notifications = [
    { text: 'คิว A015 ถึงคิวแล้ว', detail: 'คลินิกทันตกรรม • เมื่อ 2 นาทีที่แล้ว', unread: true },
    { text: 'ผู้รับบริการใหม่ลงทะเบียน', detail: 'คลินิกเสริมความงาม • เมื่อ 15 นาทีที่แล้ว', unread: true },
    { text: 'สรุปรายงานวันนี้พร้อมแล้ว', detail: 'ระบบ • เมื่อ 1 ชั่วโมงที่แล้ว', unread: false },
  ]

  const unreadCount = notifications.filter(n => n.unread).length

  return (
    <>
    {/* Trial Status Banner */}
    {trialInfo && trialInfo.isTrial && currentRole !== 'platform_owner' && (
      <div className={`px-4 py-2.5 text-center text-sm font-medium ${
        trialInfo.daysLeft <= 3 
          ? 'bg-gradient-to-r from-red-500 to-red-600 text-white'
          : trialInfo.daysLeft <= 7 
            ? 'bg-gradient-to-r from-amber-400 to-orange-500 text-white'
            : 'bg-gradient-to-r from-teal-400 to-teal-500 text-white'
      }`}>
        <span className="flex items-center justify-center gap-3">
          {/* Countdown Number */}
          <span className={`inline-flex items-center justify-center w-10 h-10 rounded-full text-lg font-black ${
            trialInfo.daysLeft <= 3 
              ? 'bg-white text-red-600'
              : trialInfo.daysLeft <= 7 
                ? 'bg-white text-orange-600'
                : 'bg-white text-teal-600'
          }`}>
            {trialInfo.daysLeft}
          </span>
          <span>
            {trialInfo.daysLeft <= 3 ? (
              <>⚠️ เหลือเวลาอีก <b>{trialInfo.daysLeft}</b> วัน — หมดอายุ {trialInfo.endDate}</>
            ) : trialInfo.daysLeft <= 7 ? (
              <>🧪 เหลือเวลาอีก <b>{trialInfo.daysLeft}</b> วัน — หมดอายุ {trialInfo.endDate}</>
            ) : (
              <>🧪 ทดลองใช้ฟรี — เหลืออีก <b>{trialInfo.daysLeft}</b> วัน (หมดอายุ {trialInfo.endDate})</>
            )}
          </span>
          {/* Upgrade button — owner/manager only */}
          {(currentRole === 'owner' || currentRole === 'manager') && (
            <button 
              onClick={() => router.push('/pricing')}
              className={`px-3 py-1 rounded-full text-xs font-bold shadow-md hover:shadow-lg transition-shadow ${
                trialInfo.daysLeft <= 3
                  ? 'bg-white text-red-600'
                  : trialInfo.daysLeft <= 7
                    ? 'bg-white text-orange-600'
                    : 'bg-white text-teal-600'
              }`}
            >
              📦 ไปที่ราคาและแพ็กเกจ →
            </button>
          )}
        </span>
      </div>
    )}
    <header className="sticky top-0 z-30 bg-white border-b border-gray-200">
      <div className="flex items-center justify-between px-4 md:px-6 py-4">
        {/* Back + Home Buttons */}
        <div className="flex items-center gap-1 mr-3">
          {isViewingAsOwner ? (
            <button
              onClick={backToPlatform}
              className="flex items-center gap-2 px-3 py-2 bg-gradient-to-r from-red-500 to-pink-500 text-white rounded-xl text-xs font-bold hover:from-red-600 hover:to-pink-600 transition-all shadow-md"
              title="กลับไป Platform Dashboard"
            >
              👑 กลับ Platform
            </button>
          ) : (
            <>
              <button
                onClick={() => router.back()}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                title="กลับไปหน้าก่อนหน้า"
              >
                <ArrowLeft className="w-5 h-5 text-gray-600" />
              </button>
              <button
                onClick={() => router.push('/')}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                title="กลับหน้าหลัก"
              >
                <Home className="w-5 h-5 text-gray-600" />
              </button>
            </>
          )}
        </div>

        {/* Search - Desktop */}
        <form onSubmit={handleSearch} className="hidden md:flex flex-1 max-w-md">
          <div className="relative w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="ค้นหาผู้รับบริการ, คิว, หรือบริการ..."
              className="input-field pl-10"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 hover:bg-gray-100 rounded"
              >
                <X className="w-4 h-4 text-gray-400" />
              </button>
            )}
          </div>
        </form>

        {/* Right side */}
        <div className="flex items-center gap-4">
          {/* Mobile Search Toggle */}
          <button
            onClick={() => setShowMobileSearch(!showMobileSearch)}
            className="md:hidden p-2 hover:bg-gray-100 rounded-lg"
          >
            <Search className="w-5 h-5 text-gray-600" />
          </button>

          {/* Notifications */}
          <div className="relative" ref={notifRef}>
            <button
              onClick={() => { setShowNotifications(!showNotifications); setShowUserMenu(false) }}
              className="relative p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <Bell className="w-5 h-5 text-gray-600" />
              {unreadCount > 0 && (
                <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full"></span>
              )}
            </button>

            {showNotifications && (
              <div className="absolute right-0 mt-2 w-80 bg-white rounded-xl shadow-lg border border-gray-200 py-2">
                <div className="px-4 py-2 border-b border-gray-100 flex items-center justify-between">
                  <h3 className="font-semibold text-gray-900">การแจ้งเตือน</h3>
                  {unreadCount > 0 && (
                    <span className="text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded-full font-medium">
                      {unreadCount} ใหม่
                    </span>
                  )}
                </div>
                <div className="max-h-64 overflow-y-auto">
                  {notifications.map((n, i) => (
                    <button
                      key={i}
                      className="w-full text-left px-4 py-3 hover:bg-gray-50 border-b border-gray-100 last:border-0"
                      onClick={() => setShowNotifications(false)}
                    >
                      <div className="flex items-start gap-2">
                        {n.unread && <div className="w-2 h-2 bg-primary-500 rounded-full mt-1.5 flex-shrink-0" />}
                        <div className={n.unread ? '' : 'ml-4'}>
                          <p className={`text-sm ${n.unread ? 'font-semibold' : 'font-medium'} text-gray-900`}>{n.text}</p>
                          <p className="text-xs text-gray-500 mt-0.5">{n.detail}</p>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
                <div className="px-4 py-2 border-t border-gray-100">
                  <button
                    onClick={() => setShowNotifications(false)}
                    className="text-sm text-primary-500 hover:text-primary-600 font-medium"
                  >
                    ดูทั้งหมด
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* User Menu */}
          <div className="relative" ref={userRef}>
            <button
              onClick={() => { setShowUserMenu(!showUserMenu); setShowNotifications(false) }}
              className="flex items-center gap-3 p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <div
                className="w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-bold shadow-md"
                style={{ backgroundColor: roleCfg?.color || '#9CA3AF' }}
              >
                {user?.name?.charAt(0) || 'U'}
              </div>
              <div className="hidden md:block text-left">
                <p className="text-sm font-medium text-gray-900">{user?.name || 'ผู้ใช้'}</p>
                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-gray-500">{roleCfg?.label || 'ไม่ทราบบทบาท'}</span>
                  {currentRole === 'platform_owner' && (
                    <Building2 className="w-3 h-3 text-red-500" />
                  )}
                </div>
              </div>
              <ChevronDown className="w-4 h-4 text-gray-500 hidden md:block" />
            </button>

            {showUserMenu && (
              <div className="absolute right-0 mt-2 w-56 bg-white rounded-xl shadow-lg border border-gray-200 py-2">
                {/* Current clinic info */}
                {currentClinic && (
                  <div className="px-4 py-2 border-b border-gray-100">
                    <p className="text-xs text-gray-500">คลินิกปัจจุบัน</p>
                    <p className="text-sm font-medium text-gray-900 flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: currentClinic.color }}></span>
                      {currentClinic.name}
                    </p>
                  </div>
                )}
                
                <button
                  onClick={() => { router.push('/profile'); setShowUserMenu(false) }}
                  className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                >
                  👤 โปรไฟล์ของฉัน
                </button>
                
                {(currentRole === 'owner' || currentRole === 'platform_owner') && (
                  <button
                    onClick={() => { router.push('/settings'); setShowUserMenu(false) }}
                    className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                  >
                    ⚙️ จัดการคลินิก
                  </button>
                )}
                
                <hr className="my-2 border-gray-100" />
                
                <button
                  onClick={() => { logout(); window.location.href = '/' }}
                  className="w-full text-left px-4 py-2 text-sm text-red-500 hover:bg-red-50"
                >
                  🚪 ออกจากระบบ
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Mobile Search Bar */}
      {showMobileSearch && (
        <div className="md:hidden px-4 pb-3">
          <form onSubmit={handleSearch}>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="ค้นหา..."
                className="input-field pl-10 pr-10"
                autoFocus
              />
              <button
                type="button"
                onClick={() => { setShowMobileSearch(false); setSearchQuery('') }}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 hover:bg-gray-100 rounded"
              >
                <X className="w-4 h-4 text-gray-400" />
              </button>
            </div>
          </form>
        </div>
      )}
    </header>
    </>
  )
}
