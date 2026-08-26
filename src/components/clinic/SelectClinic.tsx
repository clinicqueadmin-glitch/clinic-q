'use client'

import { useState } from 'react'
import { 
  Stethoscope, Sparkles, Heart, Brain, Activity, Bone,
  ChevronRight, Shield,
} from 'lucide-react'
import { clsx } from 'clsx'
import { type ClinicType, clinicConfig } from '@/lib/queue-data'
import { useClinic } from '@/lib/clinic-context'

const clinicIcons: Record<ClinicType, React.ComponentType<{ className?: string }>> = {
  medical: Stethoscope,
  aesthetic: Sparkles,
  thai: Heart,
  chinese: Brain,
  dental: Activity,
  physical: Bone,
}

const clinicDescriptions: Record<ClinicType, string> = {
  medical: 'ตรวจสุขภาพทั่วไป ฉีดวัคซีน รักษาโรคทั่วไป',
  aesthetic: 'ฉีดโบتو็อกซ์ เลเซอร์หน้าใส ดูดไขมัน บำรุงผิว',
  thai: 'นวดแผนไทย ยาสมุนไพร ประคบสมุนไพร น้ำมันหอมระเหย',
  chinese: 'ฝังเข็ม ยาจีน อบสมุนไพร กัวซา ไทชิ',
  dental: 'ขูดหินปูน อุดฟัน ถอนฟัน จัดฟัน ฟันปลอม',
  physical: 'กายภาพบำบัด ฟื้นฟูสมรรถภาพ ออกกำลังกายบำบัด',
}

export default function SelectClinic() {
  const { setClinic } = useClinic()
  const [hovered, setHovered] = useState<ClinicType | null>(null)

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-100 flex items-center justify-center p-4">
      <div className="w-full max-w-4xl">
        {/* Header */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-primary-100 rounded-2xl mb-6">
            <Shield className="w-10 h-10 text-primary-600" />
          </div>
          <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-3">
            ยินดีต้อนรับสู่ <span className="text-primary-500">Clinic-Q</span>
          </h1>
          <p className="text-lg text-gray-500 max-w-lg mx-auto">
            ระบบจัดการคิวคลินิก — เลือกประเภทคลินิกของคุณเพื่อเริ่มใช้งาน
          </p>
        </div>

        {/* Clinic Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-5">
          {(Object.entries(clinicConfig) as [ClinicType, typeof clinicConfig[ClinicType]][]).map(([key, clinic]) => {
            const Icon = clinicIcons[key]
            const isHovered = hovered === key
            return (
              <button
                key={key}
                onClick={() => setClinic(key)}
                onMouseEnter={() => setHovered(key)}
                onMouseLeave={() => setHovered(null)}
                className={clsx(
                  'group relative bg-white rounded-2xl p-6 text-left transition-all duration-200',
                  'border-2 hover:shadow-lg hover:-translate-y-1',
                  isHovered ? 'border-primary-400 shadow-lg' : 'border-gray-100 shadow-sm'
                )}
              >
                {/* Color accent bar */}
                <div
                  className="absolute top-0 left-0 right-0 h-1 rounded-t-2xl transition-all duration-200"
                  style={{ backgroundColor: isHovered ? clinic.color : 'transparent' }}
                />

                {/* Icon */}
                <div
                  className={clsx(
                    'w-14 h-14 rounded-xl flex items-center justify-center mb-4 transition-all duration-200',
                    isHovered ? 'scale-110' : ''
                  )}
                  style={{ backgroundColor: clinic.bg }}
                >
                  <span style={{ color: clinic.color }}><Icon className="w-7 h-7" /></span>
                </div>

                {/* Content */}
                <h3 className="text-lg font-bold text-gray-900 mb-1 flex items-center gap-2">
                  {clinic.name}
                  <ChevronRight
                    className={clsx(
                      'w-4 h-4 text-gray-400 transition-all duration-200',
                      isHovered ? 'translate-x-1 text-primary-500' : ''
                    )}
                  />
                </h3>
                <p className="text-sm text-gray-500 leading-relaxed">
                  {clinicDescriptions[key]}
                </p>

                {/* Prefix badge */}
                <div className="mt-4 flex items-center gap-2">
                  <span
                    className="inline-flex items-center justify-center w-7 h-7 rounded-lg text-xs font-bold text-white"
                    style={{ backgroundColor: clinic.color }}
                  >
                    {clinic.prefix}
                  </span>
                  <span className="text-xs text-gray-400">
                    หมายเลขคิวขึ้นต้นด้วย {clinic.prefix}
                  </span>
                </div>
              </button>
            )
          })}
        </div>

        {/* Footer note */}
        <p className="text-center text-sm text-gray-400 mt-8">
          สามารถเปลี่ยนประเภทคลินิกได้ภายหลังในหน้าตั้งค่า
        </p>
      </div>
    </div>
  )
}
