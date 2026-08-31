'use client'

import { useState } from 'react'
import { X, ChevronRight, ChevronLeft, Building2, Users, BookOpen, CheckCircle, Settings, Stethoscope, MonitorPlay, QrCode } from 'lucide-react'
import { clsx } from 'clsx'

interface SetupGuideProps {
  open: boolean
  onClose: () => void
  clinicName?: string
}

const steps = [
  {
    id: 'welcome',
    icon: '🎉',
    title: 'ยินดีต้อนรับสู่ Clinic-Q!',
    description: 'ระบบจัดการคิวคลินิกครบวงจร เริ่มตั้งค่าระบบได้ง่ายๆ ตามขั้นตอนด้านล่าง',
    color: '#10B981',
  },
  {
    id: 'clinic',
    icon: '🏥',
    title: 'ขั้นตอนที่ 1: ตั้งค่าคลินิก',
    description: 'กำหนดข้อมูลพื้นฐานของคลินิก',
    color: '#3B82F6',
    items: [
      { icon: '📝', text: 'ตั้งชื่อคลินิกและโลโก้' },
      { icon: '🏷️', text: 'กำหนดสาขาและหัตถการ' },
      { icon: '🚪', text: 'เพิ่มห้องตรวจ' },
      { icon: '⏰', text: 'ตั้งเวลาเปิด-ปิดทำการ' },
    ],
    link: '/settings',
    linkText: 'ไปตั้งค่าคลินิก →',
  },
  {
    id: 'users',
    icon: '👥',
    title: 'ขั้นตอนที่ 2: เพิ่มผู้ใช้งาน',
    description: 'เพิ่มเจ้าหน้าที่และผู้ทำหัตถการ',
    color: '#8B5CF6',
    items: [
      { icon: '👩‍⚕️', text: 'เพิ่มผู้ทำหัตถการ (Practitioner)' },
      { icon: '🧑‍💼', text: 'เพิ่มเจ้าหน้าที่ต้อนรับ (Front Desk)' },
      { icon: '🔐', text: 'กำหนดบทบาทและสิทธิ์' },
      { icon: '📱', text: 'แจ้งรหัสผ่านเริ่มต้น 123456' },
    ],
    link: '/settings',
    linkText: 'ไปเพิ่มผู้ใช้งาน →',
  },
  {
    id: 'rooms',
    icon: '🏥',
    title: 'ขั้นตอนที่ 3: จัดห้องตรวจวันนี้',
    description: 'กำหนดห้องตรวจและผู้รับผิดชอบในแต่ละวัน',
    color: '#F59E0B',
    items: [
      { icon: '➕', text: 'กด "+ เพิ่มห้องตรวจวันนี้" ที่ Dashboard' },
      { icon: '👨‍⚕️', text: 'เลือกผู้ทำหัตถการประจำห้อง' },
      { icon: '📋', text: 'เลือกสาขาและเวลาเริ่ม-สิ้นสุด' },
    ],
    link: '/',
    linkText: 'ไปที่ Dashboard →',
  },
  {
    id: 'usage',
    icon: '📖',
    title: 'วิธีการใช้งาน',
    description: 'เริ่มใช้งานระบบได้ทันที!',
    color: '#EC4899',
    roles: [
      {
        role: '🏥 เจ้าของคลินิก (Owner)',
        tasks: ['ตั้งค่าคลินิก สาขา ห้องตรวจ', 'จัดการผู้ใช้งานและบทบาท', 'ดูรายงานวิเคราะห์ข้อมูล', 'จัดการแพ็กเกจและ QR Code'],
      },
      {
        role: '🧑‍💼 เจ้าหน้าที่ (Front Desk)',
        tasks: ['ลงทะเบียน Walk-in คนไข้', 'เรียกคิวและส่งเข้าห้องตรวจ', 'จัดการสถานะคิว (ย้าย/ยกเลิก)'],
      },
      {
        role: '👩‍⚕️ ผู้ทำหัตถการ (Practitioner)',
        tasks: ['ดูคิวของห้องตัวเอง', 'บันทึกหัตถการที่ทำ', 'กดเสร็จสิ้นเมื่อทำเสร็จ'],
      },
    ],
  },
]

export default function SetupGuide({ open, onClose, clinicName }: SetupGuideProps) {
  const [currentStep, setCurrentStep] = useState(0)
  const step = steps[currentStep]

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg max-h-[85vh] overflow-hidden animate-scale-in">
        {/* Header */}
        <div className="relative px-6 pt-6 pb-4" style={{ backgroundColor: step.color + '10' }}>
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 hover:bg-white/60 rounded-xl transition-colors"
          >
            <X className="w-5 h-5 text-gray-400" />
          </button>

          {/* Step indicator */}
          <div className="flex items-center gap-2 mb-4">
            {steps.map((s, i) => (
              <div
                key={s.id}
                className={clsx(
                  'h-1.5 rounded-full transition-all duration-300',
                  i === currentStep ? 'flex-1' : i < currentStep ? 'w-6' : 'w-3'
                )}
                style={{
                  backgroundColor: i <= currentStep ? step.color : '#E5E7EB',
                }}
              />
            ))}
          </div>

          <div className="text-center">
            <span className="text-4xl mb-3 block">{step.icon}</span>
            <h2 className="text-xl font-extrabold text-gray-900">{step.title}</h2>
            <p className="text-sm text-gray-500 mt-2">{step.description}</p>
          </div>
        </div>

        {/* Content */}
        <div className="px-6 py-5 overflow-y-auto max-h-[50vh]">
          {/* Items list */}
          {step.items && (
            <div className="space-y-3">
              {step.items.map((item, i) => (
                <div key={i} className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
                  <span className="text-xl">{item.icon}</span>
                  <span className="text-sm font-medium text-gray-700">{item.text}</span>
                </div>
              ))}
            </div>
          )}

          {/* Role guide */}
          {step.roles && (
            <div className="space-y-4">
              {step.roles.map((r, i) => (
                <div key={i} className="bg-gray-50 rounded-xl p-4">
                  <p className="text-sm font-bold text-gray-900 mb-2">{r.role}</p>
                  <ul className="space-y-1.5">
                    {r.tasks.map((task, j) => (
                      <li key={j} className="flex items-start gap-2 text-xs text-gray-600">
                        <CheckCircle className="w-3.5 h-3.5 text-green-500 mt-0.5 flex-shrink-0" />
                        {task}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}

          {/* Link button */}
          {step.link && (
            <a
              href={step.link}
              className="mt-4 flex items-center justify-center gap-2 w-full py-3 rounded-xl text-sm font-bold text-white transition-all hover:shadow-lg"
              style={{ backgroundColor: step.color }}
              onClick={onClose}
            >
              {step.linkText}
            </a>
          )}
        </div>

        {/* Footer navigation */}
        <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-between">
          <button
            onClick={() => setCurrentStep(Math.max(0, currentStep - 1))}
            disabled={currentStep === 0}
            className={clsx(
              'flex items-center gap-1 px-4 py-2 rounded-xl text-sm font-medium transition-colors',
              currentStep === 0
                ? 'text-gray-300 cursor-not-allowed'
                : 'text-gray-600 hover:bg-gray-100'
            )}
          >
            <ChevronLeft className="w-4 h-4" /> ก่อนหน้า
          </button>

          <span className="text-xs text-gray-400">{currentStep + 1} / {steps.length}</span>

          {currentStep < steps.length - 1 ? (
            <button
              onClick={() => setCurrentStep(currentStep + 1)}
              className="flex items-center gap-1 px-4 py-2 rounded-xl text-sm font-bold text-white transition-all hover:shadow-lg"
              style={{ backgroundColor: step.color }}
            >
              ถัดไป <ChevronRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              onClick={onClose}
              className="flex items-center gap-1 px-4 py-2 rounded-xl text-sm font-bold text-white bg-green-500 hover:bg-green-600 transition-all hover:shadow-lg"
            >
              <CheckCircle className="w-4 h-4" /> เริ่มใช้งาน!
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
