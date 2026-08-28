import type { Metadata, Viewport } from 'next'
import './globals.css'
import ClinicProviderWrapper from '@/components/clinic/ClinicProviderWrapper'
import { QueueProvider } from '@/lib/queue-context'
import { ScheduleProvider } from '@/lib/schedule-context'
import { AuthProvider } from '@/lib/auth-context'
import SWRegistration from '@/components/SWRegistration'
import PWAInstallBanner from '@/components/PWAInstallBanner'
import ForcePasswordChangeWrapper from '@/components/auth/ForcePasswordChangeWrapper'



export const metadata: Metadata = {
  title: 'Clinic-Q | ระบบจัดการคิวคลินิก',
  description: 'ระบบจัดการคิวคลินิกสำหรับคลินิกทุกประเภท ใช้งานง่าย รวดเร็ว',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Clinic-Q',
  },
  formatDetection: {
    telephone: true,
  },
  icons: {
    icon: '/icons/icon.svg',
    apple: '/brand-logo.png',
  },
}

export const viewport: Viewport = {
  themeColor: '#14b8a6',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
  viewportFit: 'cover',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="th">
      <body>
        <div className="brand-watermark" />
        <SWRegistration />
        <PWAInstallBanner />
        <AuthProvider>
          <ForcePasswordChangeWrapper />
          <ClinicProviderWrapper>
            <QueueProvider>
              <ScheduleProvider>{children}</ScheduleProvider>
            </QueueProvider>
          </ClinicProviderWrapper>
        </AuthProvider>
      </body>
    </html>
  )
}
