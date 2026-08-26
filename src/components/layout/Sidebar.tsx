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
} from 'lucide-react'
import { clsx } from 'clsx'
import { useClinic } from '@/lib/clinic-context'
import { useAuth } from '@/lib/auth-context'
import { roleConfig, hasPermission, type Permission } from '@/lib/auth-types'

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

          {/* Switch Clinic (Platform Owner only) & Logout */}
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
            <button
              onClick={() => {
                logout()
                window.location.href = '/login'
              }}
              className="flex items-center gap-3 px-3 py-2.5 rounded-2xl text-sm font-bold text-red-400 hover:bg-red-50 transition-colors w-full"
            >
              <LogOut className="w-[18px] h-[18px]" />
              <span>ออกจากระบบ</span>
            </button>
          </div>
        </div>
      </aside>
    </>
  )
}
