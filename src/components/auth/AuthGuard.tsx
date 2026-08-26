'use client'

import { type ReactNode } from 'react'
import { useAuth } from '@/lib/auth-context'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'
import { type Permission, hasPermission, type ClinicRole, type UserRole } from '@/lib/auth-types'

export default function AuthGuard({
  children,
  requiredPermission,
  fallback,
}: {
  children: ReactNode
  requiredPermission?: Permission
  fallback?: ReactNode
}) {
  const { isAuthenticated, isLoading, currentRole } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/login')
    }
  }, [isLoading, isAuthenticated, router])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-pink-400 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-500">กำลังโหลด...</p>
        </div>
      </div>
    )
  }

  if (!isAuthenticated) return null

  // Platform owner has all permissions
  if ((currentRole as UserRole) === 'platform_owner') {
    return <>{children}</>
  }

  // Check required permission for clinic roles
  if (requiredPermission && currentRole && (currentRole as UserRole) !== 'platform_owner') {
    if (!hasPermission(currentRole as ClinicRole, requiredPermission)) {
      return fallback || (
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <p className="text-6xl mb-4">🔒</p>
            <h2 className="text-xl font-bold text-gray-900 mb-2">ไม่มีสิทธิ์เข้าถึง</h2>
            <p className="text-gray-500">คุณไม่มีสิทธิ์เข้าถึงหน้านี้</p>
          </div>
        </div>
      )
    }
  }

  return <>{children}</>
}
