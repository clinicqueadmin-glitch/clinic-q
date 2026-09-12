'use client'

import { type ReactNode, useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import { ClinicProvider, useClinic } from '@/lib/clinic-context'
import { clinicConfig, type ClinicType } from '@/lib/queue-data'
import { PractitionerProvider } from '@/lib/practitioner-context'
import { useAuth } from '@/lib/auth-context'
import { getSupabase, isSupabaseReady } from '@/lib/supabase'
import SelectClinic from './SelectClinic'
import Sidebar from '@/components/layout/Sidebar'
import Header from '@/components/layout/Header'
import TrialExpiredScreen from '@/components/auth/TrialExpiredScreen'

function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar />
      <div className="flex-1 flex flex-col md:ml-64">
        <Header />
        <main className="flex-1 p-4 md:p-6 lg:p-8">
          {children}
        </main>
      </div>
    </div>
  )
}

function ClinicRouter({ children }: { children: ReactNode }) {
  const { isConfigured, setClinic, currentClinic } = useClinic()
  const { isAuthenticated, isLoading, session, currentRole, currentClinicId } = useAuth()
  const pathname = usePathname()

  // Auto-select clinic from auth session when not configured
  useEffect(() => {
    if (!isLoading && isAuthenticated && !isConfigured && currentRole !== 'platform_owner' && session?.currentClinicId) {
      // First try localStorage
      const clinics = JSON.parse(localStorage.getItem('clinicq-clinics') || '[]')
      const matchedClinic = clinics.find((c: any) => c.id === session.currentClinicId)
      const clinicType = matchedClinic?.type || null
      if (clinicType && clinicConfig[clinicType as keyof typeof clinicConfig]) {
        setClinic(clinicType as any)
        return
      }
      
      // If not in localStorage, fetch from Supabase
      if (isSupabaseReady()) {
        const sb = getSupabase()
        if (sb) {
          sb.from('clinics').select('type, name').eq('id', session.currentClinicId).single()
            .then(({ data }: { data: { type: string; name: string } | null }) => {
              if (data?.type && clinicConfig[data.type as keyof typeof clinicConfig]) {
                setClinic(data.type as any)
                // Also save to localStorage for future use (prevent duplicates)
                const exists = clinics.some((c: any) => c.id === session.currentClinicId)
                if (!exists) {
                  const newClinics = [...clinics, { id: session.currentClinicId, type: data.type, name: data.name }]
                  localStorage.setItem('clinicq-clinics', JSON.stringify(newClinics))
                } else {
                  // Update existing entry with latest data
                  const updated = clinics.map((c: any) => c.id === session.currentClinicId ? { ...c, type: data.type, name: data.name } : c)
                  localStorage.setItem('clinicq-clinics', JSON.stringify(updated))
                }
              }
            })
        }
      }
    }
  }, [isLoading, isAuthenticated, isConfigured, currentRole, session, setClinic])

  // Check if platform owner is viewing a clinic — read synchronously from localStorage
  const [viewingClinic] = useState<{ clinicId: string; clinicType: string } | null>(() => {
    if (typeof window === 'undefined') return null
    try {
      const raw = localStorage.getItem('clinicq-viewing-clinic')
      return raw ? JSON.parse(raw) : null
    } catch { return null }
  })

  // Platform Owner on root → redirect to /platform (unless viewing a clinic)
  if (pathname === '/' && isAuthenticated && currentRole === 'platform_owner' && !viewingClinic) {
    if (typeof window !== 'undefined' && window.location.pathname === '/') {
      window.location.href = '/platform'
    }
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-orange-400 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-500">กำลังเข้าสู่ Platform Dashboard...</p>
        </div>
      </div>
    )
  }

  // Root path → authenticated users get AppShell with sidebar, unauthenticated get plain
  if (pathname === '/') {
    // Platform owner viewing a clinic → show AppShell with that clinic's data
    if (isAuthenticated && currentRole === 'platform_owner' && viewingClinic) {
      // Set clinic from viewing context
      if (!isConfigured) {
        const vc = viewingClinic
        import('@/lib/queue-data').then(({ clinicConfig }) => {
          if (vc.clinicType && clinicConfig[vc.clinicType as keyof typeof clinicConfig]) {
            setClinic(vc.clinicType as any)
          }
        })
      }
      const clinicType = (viewingClinic?.clinicType || currentClinic || 'dental') as ClinicType
      const clinicId = viewingClinic?.clinicId || currentClinicId
      return <PractitionerProvider clinicType={clinicType} clinicId={clinicId}><AppShell>{children}</AppShell></PractitionerProvider>
    }
    if (isAuthenticated && currentRole !== 'platform_owner' && isConfigured) {
      return <PractitionerProvider clinicType={currentClinic || 'dental'} clinicId={currentClinicId}><AppShell>{children}</AppShell></PractitionerProvider>
    }
    return <>{children}</>
  }
  // Other public routes - no auth or clinic needed
  if (pathname === '/login' || pathname.startsWith('/login') || pathname === '/register' || pathname === '/pricing' || pathname === '/terms' || pathname === '/privacy') {
    return <>{children}</>
  }
  if (pathname === '/tv' || pathname === '/kiosk' || pathname === '/book' || pathname.startsWith('/book') || pathname === '/walkin' || pathname.startsWith('/walkin') || pathname === '/track' || pathname.startsWith('/track') || pathname === '/queue-status' || pathname.startsWith('/queue-status') || pathname === '/qr' || pathname.startsWith('/qr')) {
    return <>{children}</>
  }

  // Platform Owner viewing a clinic on non-root path → show AppShell with that clinic
  if (currentRole === 'platform_owner' && pathname !== '/platform' && isAuthenticated && viewingClinic) {
    const clinicType = (viewingClinic.clinicType || currentClinic || 'dental') as ClinicType
    const clinicId = viewingClinic.clinicId || currentClinicId
    return <PractitionerProvider clinicType={clinicType} clinicId={clinicId}><AppShell>{children}</AppShell></PractitionerProvider>
  }

  // Platform Owner without viewing clinic → redirect to /platform
  if (currentRole === 'platform_owner' && pathname !== '/platform' && isAuthenticated) {
    if (typeof window !== 'undefined') {
      window.location.href = '/platform'
    }
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-red-400 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-500">กำลังไป Platform Dashboard...</p>
        </div>
      </div>
    )
  }

  // Not authenticated → redirect to login (but root / shows landing page)
  if (!isLoading && !isAuthenticated && pathname !== '/') {
    if (typeof window !== 'undefined') {
      window.location.href = '/login'
    }
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-pink-400 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-500">กำลังตรวจสอบสิทธิ์...</p>
        </div>
      </div>
    )
  }

  // Auto-selecting clinic from session — show loading briefly
  if (!isConfigured && isAuthenticated && currentRole !== 'platform_owner' && session?.currentClinicId) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-pink-400 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-500">กำลังเข้าสู่ระบบคลินิก...</p>
        </div>
      </div>
    )
  }

  // Authenticated but no clinic selected and no session clinic (first time)
  if (!isConfigured && currentRole !== 'platform_owner') {
    return <SelectClinic />
  }

  // Platform owner without clinic - show shell (or viewing clinic shell)
  if (!isConfigured && currentRole === 'platform_owner') {
    if (viewingClinic) {
      const clinicType = (viewingClinic.clinicType || currentClinic || 'dental') as ClinicType
      const clinicId = viewingClinic.clinicId || currentClinicId
      return <PractitionerProvider clinicType={clinicType} clinicId={clinicId}><AppShell>{children}</AppShell></PractitionerProvider>
    }
    return <AppShell>{children}</AppShell>
  }

  // ═══ Trial Expiry Check ═══
  // Skip for platform owner and public routes
  const isPublicRoute = pathname === '/login' || pathname.startsWith('/login') || pathname === '/register' || pathname === '/pricing' || pathname === '/terms' || pathname === '/privacy' || pathname === '/tv' || pathname === '/kiosk' || pathname === '/book' || pathname.startsWith('/book') || pathname === '/walkin' || pathname.startsWith('/walkin') || pathname === '/track' || pathname.startsWith('/track') || pathname === '/queue-status' || pathname.startsWith('/queue-status') || pathname === '/qr' || pathname.startsWith('/qr')
  if (currentRole !== 'platform_owner' && isAuthenticated && currentClinicId && !isPublicRoute) {
    try {
      const saved = localStorage.getItem(`clinicq-subscription-${currentClinicId}`)
      if (saved) {
        const data = JSON.parse(saved)
        if (data.plan === 'trial' && data.status === 'active' && data.trialEndDate) {
          const endDate = new Date(data.trialEndDate)
          const now = new Date()
          if (now > endDate) {
            const daysExpired = Math.ceil((now.getTime() - endDate.getTime()) / (1000 * 60 * 60 * 24))
            return <TrialExpiredScreen daysExpired={daysExpired} clinicName={currentClinic || undefined} />
          }
        }
      } else {
        // No subscription data found — check registration date
        const registeredClinics = JSON.parse(localStorage.getItem('clinicq-registered-clinics') || '[]')
        const registeredClinic = registeredClinics.find((c: any) => c.id === currentClinicId)
        if (registeredClinic?.registeredAt) {
          const regDate = new Date(registeredClinic.registeredAt)
          const now = new Date()
          const daysSinceReg = Math.ceil((now.getTime() - regDate.getTime()) / (1000 * 60 * 60 * 24))
          if (daysSinceReg > 30) {
            // Trial expired but no subscription data — create it now
            const trialEnd = new Date(regDate)
            trialEnd.setDate(trialEnd.getDate() + 30)
            localStorage.setItem(`clinicq-subscription-${currentClinicId}`, JSON.stringify({
              plan: 'trial',
              status: 'active',
              startDate: regDate.toISOString(),
              trialEndDate: trialEnd.toISOString(),
              paidEndDate: null,
            }))
            const daysExpired = daysSinceReg - 30
            return <TrialExpiredScreen daysExpired={daysExpired} clinicName={currentClinic || undefined} />
          }
        }
      }
    } catch {}
  }

  // Final: use viewing clinic if platform owner is viewing
  const finalClinicType = (viewingClinic?.clinicType || currentClinic || 'dental') as ClinicType
  const finalClinicId = viewingClinic?.clinicId || currentClinicId
  return <PractitionerProvider clinicType={finalClinicType} clinicId={finalClinicId}><AppShell>{children}</AppShell></PractitionerProvider>
}

export default function ClinicProviderWrapper({ children }: { children: ReactNode }) {
  // Get clinicId from auth context
  const { currentClinicId, currentRole } = useAuth()
  // Platform owner viewing a clinic — use the viewing clinic ID
  let effectiveClinicId = currentClinicId
  if (currentRole === 'platform_owner' && typeof window !== 'undefined') {
    try {
      const raw = localStorage.getItem('clinicq-viewing-clinic')
      if (raw) {
        const viewing = JSON.parse(raw)
        effectiveClinicId = viewing.clinicId || currentClinicId
      }
    } catch {}
  }
  return (
    <ClinicProvider clinicId={effectiveClinicId}>
      <ClinicRouter>{children}</ClinicRouter>
    </ClinicProvider>
  )
}
