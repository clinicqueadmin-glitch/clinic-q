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
        // Default: assume trial if no subscription data
        setTrialInfo({ isTrial: true, daysLeft: 30, endDate: 'ยังไม่กำหนด' })
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
      <div className={`px-4 py-2 text-center text-sm font-medium ${
        trialInfo.daysLeft <= 3 
          ? 'bg-red-50 text-red-700 border-b border-red-200'
          : trialInfo.daysLeft <= 7 
            ? 'bg-amber-50 text-amber-700 border-b border-amber-200'
            : 'bg-teal-50 text-teal-700 border-b border-teal-200'
      }`}>
        {trialInfo.daysLeft <= 3 ? (
          <span className="flex items-center justify-center gap-2">
            <AlertTriangle className="w-4 h-4" />
            ⚠️ ทดลองใช้จะหมดอายุใน {trialInfo.daysLeft} วัน ({trialInfo.endDate}) — <button onClick={() => router.push('/pricing')} className="underline font-bold">อัปเกรดเลย</button>
          </span>
        ) : (
          <span className="flex items-center justify-center gap-2">
            <Clock className="w-4 h-4" />
            🧪 ทดลองใช้ฟรี — เหลืออีก {trialInfo.daysLeft} วัน (หมดอายุ {trialInfo.endDate})
          </span>
        )}
      </div>
    )}
    <header className="sticky top-0 z-30 bg-white border-b border-gray-200">
      <div className="flex items-center justify-between px-4 md:px-6 py-4">
        {/* Back + Home Buttons */}
        <div className="flex items-center gap-1 mr-3">
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
