'use client'

import { type ReactNode, useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { ClinicProvider, useClinic } from '@/lib/clinic-context'
import { clinicConfig } from '@/lib/queue-data'
import { PractitionerProvider } from '@/lib/practitioner-context'
import { useAuth } from '@/lib/auth-context'
import { getSupabase, isSupabaseReady } from '@/lib/supabase'
import SelectClinic from './SelectClinic'
import Sidebar from '@/components/layout/Sidebar'
import Header from '@/components/layout/Header'

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
                // Also save to localStorage for future use
                const newClinics = [...clinics, { id: session.currentClinicId, type: data.type, name: data.name }]
                localStorage.setItem('clinicq-clinics', JSON.stringify(newClinics))
              }
            })
        }
      }
    }
  }, [isLoading, isAuthenticated, isConfigured, currentRole, session, setClinic])

  // Platform Owner on root → redirect to /platform
  if (pathname === '/' && isAuthenticated && currentRole === 'platform_owner') {
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
    if (isAuthenticated && currentRole !== 'platform_owner' && isConfigured) {
      return <PractitionerProvider clinicType={currentClinic || 'dental'} clinicId={currentClinicId}><AppShell>{children}</AppShell></PractitionerProvider>
    }
    return <>{children}</>
  }
  // Other public routes - no auth or clinic needed
  if (pathname === '/login' || pathname.startsWith('/login') || pathname === '/register' || pathname === '/pricing' || pathname === '/terms' || pathname === '/privacy') {
    return <>{children}</>
  }
  if (pathname === '/tv' || pathname === '/kiosk' || pathname === '/book' || pathname.startsWith('/book') || pathname === '/walkin' || pathname.startsWith('/walkin') || pathname === '/track' || pathname.startsWith('/track') || pathname === '/queue-status' || pathname.startsWith('/queue-status')) {
    return <>{children}</>
  }

  // Platform Owner goes to /platform without clinic selection
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

  // Platform owner without clinic - still show shell
  if (!isConfigured && currentRole === 'platform_owner') {
    return <AppShell>{children}</AppShell>
  }

  return <PractitionerProvider clinicType={currentClinic || 'dental'} clinicId={currentClinicId}><AppShell>{children}</AppShell></PractitionerProvider>
}

export default function ClinicProviderWrapper({ children }: { children: ReactNode }) {
  return (
    <ClinicProvider>
      <ClinicRouter>{children}</ClinicRouter>
    </ClinicProvider>
  )
}
