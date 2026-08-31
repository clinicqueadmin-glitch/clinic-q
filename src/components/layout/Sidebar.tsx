'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  Users,
  Settings,
  LogOut,
  Menu,
  X,
  BarChart3,
  Printer,
  RefreshCw,
  UserCog,
  Crown,
  CreditCard,
  AlertTriangle,
  UserCheck,
  BookOpen,
} from 'lucide-react'
import { clsx } from 'clsx'
import { useClinic } from '@/lib/clinic-context'
import { useAuth } from '@/lib/auth-context'
import { roleConfig, hasPermission, type Permission } from '@/lib/auth-types'
import SetupGuide from '@/components/guide/SetupGuide'

interface MenuItem {
  title: string
  href: string
  icon: any
  permission?: Permission
}

// Platform Owner menu (separate from clinic staff)
const platformMenuItems: MenuItem[] = [
  { title: 'แดชบอร์ด Platform', href: '/platform', icon: Crown },
  { title: 'ผู้ใช้งาน Platform', href: '/platform#users', icon: UserCheck },
  { title: 'การชำระเงิน', href: '/platform#payments', icon: CreditCard },
  { title: 'คลินิกใกล้หมดอายุ', href: '/platform#expiring', icon: AlertTriangle },
]

const menuItems: MenuItem[] = [
  { title: 'แดชบอร์ด', href: '/', icon: LayoutDashboard, permission: 'view_dashboard' },
  { title: 'ผู้รับบริการ', href: '/patients', icon: Users },
  { title: 'วิเคราะห์ข้อมูล', href: '/analytics', icon: BarChart3, permission: 'view_analytics' },
  { title: 'จัดการคลินิก', href: '/settings', icon: Settings, permission: 'manage_clinic_settings' },
  { title: 'ราคาและแพ็กเกจ', href: '/pricing', icon: CreditCard, permission: 'manage_clinic_settings' },
]

export default function Sidebar() {
  const [isOpen, setIsOpen] = useState(false)
  const pathname = usePathname()
  const { config, clearClinic, settings } = useClinic()
  const { user, currentRole, logout } = useAuth()
  const [showGuide, setShowGuide] = useState(false)

  const accentColor = config?.color || '#F97316'
  const roleCfg = currentRole ? roleConfig[currentRole] : null

  // Use platform menu for platform_owner, otherwise filter by permission
  const isPlatformOwner = currentRole === 'platform_owner'
  const visibleMenuItems = isPlatformOwner
    ? platformMenuItems
    : menuItems.filter(item => {
        // Providers cannot see patients list
        if (currentRole === 'practitioner' && item.href === '/patients') return false
        // Pricing page only for clinic owner
        if (item.href === '/pricing' && currentRole !== 'owner') return false
        if (!item.permission || !currentRole) return true
        return hasPermission(currentRole, item.permission)
      })

  return (
    <>
      {/* Mobile Menu Button */}
      <button
        onClick={() => setIsOpen(true)}
        className="md:hidden fixed top-4 left-4 z-50 p-2.5 bg-white/80 backdrop-blur-md rounded-2xl shadow-md border border-pink-100 hover:bg-white transition-all"
      >
        <Menu className="w-5 h-5 text-pink-500" />
      </button>

      {/* Overlay */}
      {isOpen && (
        <div
          className="md:hidden fixed inset-0 bg-pink-900/20 backdrop-blur-sm z-40"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={clsx(
          'fixed left-0 top-0 h-full w-[260px] bg-white/80 backdrop-blur-xl border-r border-teal-100/50 z-50 transform transition-transform duration-300 ease-out',
          'md:translate-x-0',
          isOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="p-5 pb-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {settings.logo ? (
                  <img src={settings.logo} alt="Logo" className="w-10 h-10 rounded-2xl object-cover shadow-md" />
                ) : (
                  <img src="/brand-logo.png" alt="Clinic-Q" className="w-10 h-10 rounded-2xl object-cover shadow-md" />
                )}
                <div>
                  <h1 className="text-base font-extrabold text-gray-800 leading-tight">Clinic-Q</h1>
                  <p className="text-[11px] text-teal-500 font-semibold">{settings.clinicName || config?.name || 'ระบบจัดการคิวคลินิก'}</p>
                </div>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="md:hidden p-1.5 hover:bg-pink-50 rounded-xl transition-colors"
              >
                <X className="w-4 h-4 text-pink-400" />
              </button>
            </div>
          </div>

          {/* Current Clinic Badge */}
          {config && (
            <div className="mx-3 mb-3">
              <div
                className="px-3.5 py-3 rounded-2xl flex items-center gap-3 border border-teal-100/50"
                style={{ backgroundColor: `${config.bg || '#fef1f6'}` }}
              >
                <div
                  className="w-8 h-8 rounded-xl flex items-center justify-center text-white text-xs font-bold shadow-md"
                  style={{ background: `linear-gradient(135deg, ${config.color}, ${config.color}dd)` }}
                >
                  {config.prefix}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-gray-800 truncate">{settings.clinicName || config.name}</p>
                  <p className="text-[10px] text-pink-400 font-semibold">กำลังใช้งาน</p>
                </div>
              </div>
            </div>
          )}

          {/* Divider */}
          <div className="candy-divider mx-5" />

          {/* Main Navigation */}
          <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
            <p className="text-[10px] font-extrabold text-pink-300 uppercase tracking-wider px-3 py-2">
              เมนูหลัก
            </p>
            {visibleMenuItems.map((item) => {
              const Icon = item.icon
              const isActive = pathname === item.href || (item.href.includes('?') && pathname === item.href.split('?')[0])
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setIsOpen(false)}
                  className={clsx(
                    'flex items-center gap-3 px-3 py-2.5 rounded-2xl text-sm font-bold transition-all duration-200',
                    isActive
                      ? 'text-white shadow-lg'
                      : 'text-gray-600 hover:bg-pink-50 hover:text-pink-600'
                  )}
                  style={isActive ? {
                    background: `linear-gradient(135deg, ${accentColor}, ${accentColor}cc)`,
                    boxShadow: `0 4px 14px ${accentColor}40`
                  } : {}}
                >
                  <Icon className="w-[18px] h-[18px]" />
                  <span>{item.title}</span>
                </Link>
              )
            })}
          </nav>

          {/* Help Guide */}
          <div className="px-3 pb-1">
            <button
              onClick={() => setShowGuide(true)}
              className="flex items-center gap-3 px-3 py-2.5 rounded-2xl text-sm font-bold text-blue-600 hover:bg-blue-50 transition-colors w-full"
            >
              <BookOpen className="w-[18px] h-[18px]" />
              <span>คู่มือการใช้งาน</span>
            </button>
          </div>

          {/* Switch Clinic, Admin Contact, Logout */}
          <div className="p-3 space-y-1">
            <div className="candy-divider mx-2 mb-2" />
            {currentRole === 'platform_owner' && (
              <button
                onClick={() => {
                  clearClinic()
                  setIsOpen(false)
                }}
                className="flex items-center gap-3 px-3 py-2.5 rounded-2xl text-sm font-bold text-gray-500 hover:bg-pink-50 hover:text-pink-600 transition-colors w-full"
              >
                <RefreshCw className="w-[18px] h-[18px]" />
                <span>เปลี่ยนคลินิก</span>
              </button>
            )}
            {/* Admin contact — show for front_desk and practitioner */}
            {(currentRole === 'front_desk' || currentRole === 'practitioner') && (
              <a
                href="https://line.me/R/ti/p/@clinicq"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 px-3 py-2.5 rounded-2xl text-sm font-bold text-green-600 hover:bg-green-50 transition-colors w-full"
              >
                <svg className="w-[18px] h-[18px]" viewBox="0 0 24 24" fill="currentColor"><path d="M19.365 9.863c.349 0 .63.285.63.631 0 .345-.281.63-.63.63H17.61v1.125h1.755c.349 0 .63.283.63.63 0 .344-.281.629-.63.629h-2.386c-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.627-.63h2.386c.349 0 .63.285.63.63 0 .349-.281.63-.63.63H17.61v1.125h1.755zm-3.855 3.016c0 .27-.174.51-.432.596-.064.021-.133.031-.199.031-.211 0-.391-.09-.51-.25l-2.443-3.317v2.94c0 .344-.279.629-.631.629-.346 0-.626-.285-.626-.629V8.108c0-.27.173-.51.43-.595.06-.023.136-.033.194-.033.195 0 .375.104.495.254l2.462 3.33V8.108c0-.345.282-.63.63-.63.345 0 .63.285.63.63v4.771zm-5.741 0c0 .344-.282.629-.631.629-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.627-.63.349 0 .631.285.631.63v4.771zm-2.466.629H4.917c-.345 0-.63-.285-.63-.629V8.108c0-.345.285-.63.63-.63.348 0 .63.285.63.63v4.141h1.756c.348 0 .629.283.629.63 0 .344-.281.629-.629.629M24 10.314C24 4.943 18.615.572 12 .572S0 4.943 0 10.314c0 4.811 4.27 8.842 10.035 9.608.391.082.923.258 1.058.59.12.301.079.766.038 1.08l-.164 1.02c-.045.301-.24 1.186 1.049.645 1.291-.539 6.916-4.078 9.436-6.975C23.176 14.393 24 12.458 24 10.314"/></svg>
                <span>ติดต่อ Admin</span>
              </a>
            )}
            <button
              onClick={() => {
                logout()
                window.location.href = '/'
              }}
              className="flex items-center gap-3 px-3 py-2.5 rounded-2xl text-sm font-bold text-red-400 hover:bg-red-50 transition-colors w-full"
            >
              <LogOut className="w-[18px] h-[18px]" />
              <span>ออกจากระบบ</span>
            </button>
          </div>
        </div>
      </aside>
      {/* Setup Guide Modal */}
      <SetupGuide
        open={showGuide}
        onClose={() => setShowGuide(false)}
        clinicName={settings.clinicName || config?.name}
      />
    </>
  )
}
