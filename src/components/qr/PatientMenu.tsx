'use client'

import { useMemo } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import {
  ClipboardList, Search, Tv, ChevronRight, MapPin,
} from 'lucide-react'
import { clinicConfig, type ClinicType } from '@/lib/queue-data'

/**
 * หน้าเมนูรวมผู้ป่วย — จุดเดียวที่คนไข้เข้าถึงเมื่อสแกน QR หลักของคลินิก
 *
 * รับค่า ?clinic=<type>&clinicId=<uuid> จาก QR Code หลัก แล้วส่งต่อ
 * clinic/clinicId ไปยัง flow เดิมทั้ง 3 เส้นทาง (ไม่เปลี่ยน business logic)
 */
export default function PatientMenu() {
  const searchParams = useSearchParams()
  const urlClinicType = searchParams.get('clinic') as ClinicType | null
  const urlClinicId = searchParams.get('clinicId') as string | null

  const clinicType: ClinicType = urlClinicType && clinicConfig[urlClinicType] ? urlClinicType : 'dental'
  const clinicId = urlClinicId || undefined
  const cfg = clinicConfig[clinicType]

  // ใช้ชื่อคลินิกจริงจาก settings ถ้ามี cached ไว้ (fallback เป็นชื่อตาม type)
  const clinicName = useMemo(() => {
    if (typeof window !== 'undefined' && clinicId) {
      const saved = localStorage.getItem(`clinic-q-settings-${clinicId}`)
      if (saved) {
        try {
          const parsed = JSON.parse(saved)
          if (parsed.clinicName) return parsed.clinicName
        } catch {}
      }
    }
    return cfg.name
  }, [clinicId, cfg.name])

  // Query string ที่ส่งต่อให้ทุก flow เดิม (ทั้ง type และ clinicId)
  const qs = useMemo(() => {
    const params = new URLSearchParams()
    if (clinicType) params.set('clinic', clinicType)
    if (clinicId) params.set('clinicId', clinicId)
    const s = params.toString()
    return s ? `?${s}` : ''
  }, [clinicType, clinicId])

  const menuItems = [
    {
      icon: ClipboardList,
      title: 'จองคิว / ลงทะเบียน Walk-in',
      desc: 'จองคิวออนไลน์หรือลงทะเบียนหน้าร้าน',
      href: `/book${qs}`,
      bg: 'bg-emerald-50',
      ring: 'ring-emerald-200',
      color: 'text-emerald-600',
      arrow: 'bg-emerald-500',
    },
    {
      icon: Search,
      title: 'ตรวจสอบคิวของฉัน',
      desc: 'กรอกเบอร์โทร ดูสถานะและเวลาคิว',
      href: `/track${qs}`,
      bg: 'bg-blue-50',
      ring: 'ring-blue-200',
      color: 'text-blue-600',
      arrow: 'bg-blue-500',
    },
    {
      icon: Tv,
      title: 'ดูสถานะคิววันนี้',
      desc: 'จำนวนคิวรอและเวลาคาดการณ์ของคลินิก',
      href: `/queue-status${qs}`,
      bg: 'bg-amber-50',
      ring: 'ring-amber-200',
      color: 'text-amber-600',
      arrow: 'bg-amber-500',
    },
  ]

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 sm:p-6" style={{ backgroundColor: cfg.bg }}>
      <div className="w-full max-w-md">
        {/* Clinic header */}
        <div className="text-center mb-8">
          <div className="w-20 h-20 rounded-3xl flex items-center justify-center text-4xl mx-auto mb-3 shadow-lg" style={{ backgroundColor: cfg.color }}>
            <span className="text-white">{cfg.icon}</span>
          </div>
          <h1 className="text-2xl font-black text-gray-900">{clinicName}</h1>
          <p className="text-sm text-gray-500 mt-1 flex items-center justify-center gap-1">
            <MapPin className="w-4 h-4" /> ยินดีต้อนรับสู่ Clinic-Q
          </p>
        </div>

        {/* Menu buttons */}
        <div className="space-y-4">
          {menuItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-4 w-full p-5 rounded-2xl bg-white shadow-sm hover:shadow-md transition-shadow ring-1 ${item.ring} active:scale-[0.99]`}
            >
              <div className={`w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0 ${item.bg}`}>
                <item.icon className={`w-7 h-7 ${item.color}`} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-lg font-bold text-gray-900">{item.title}</div>
                <div className="text-sm text-gray-500 mt-0.5">{item.desc}</div>
              </div>
              <div className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 ${item.arrow}`}>
                <ChevronRight className="w-5 h-5 text-white" />
              </div>
            </Link>
          ))}
        </div>

        {/* Footer */}
        <p className="text-center text-xs text-gray-400 mt-8">
          สแกน QR Code นี้เพื่อใช้บริการ {clinicName}
        </p>
      </div>
    </div>
  )
}