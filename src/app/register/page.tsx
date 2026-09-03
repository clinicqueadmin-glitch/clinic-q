'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Stethoscope, Sparkles, Heart, Leaf, Brain, Bone,
  ArrowRight, CheckCircle, Mail, User, Phone, Building2,
} from 'lucide-react'
import { clsx } from 'clsx'

const clinicTypes = [
  { id: 'medical', name: 'คลินิกเวชกรรม', icon: '💊', color: '#22C55E', desc: 'ตรวจสุขภาพ, ฉีดวัคซีน' },
  { id: 'dental', name: 'คลินิกทันตกรรม', icon: '🦷', color: '#A855F7', desc: 'ขูดหินปูน, อุดฟัน, จัดฟัน' },
  { id: 'aesthetic', name: 'คลินิกเสริมความงาม', icon: '✨', color: '#EC4899', desc: 'โบتو็อกซ์, เลเซอร์, ฟิลเลอร์' },
  { id: 'physical', name: 'กายภาพบำบัด', icon: '🦴', color: '#3B82F6', desc: 'ฟื้นฟูสมรรถภาพ, ออกกำลังกาย' },
  { id: 'chinese', name: 'แพทย์แผนจีน', icon: '🏮', color: '#F97316', desc: 'ฝังเข็ม, ยาจีน, กัวซา' },
  { id: 'thai', name: 'แพทย์แผนไทย', icon: '🌿', color: '#EAB308', desc: 'นวดแผนไทย, ยาสมุนไพร' },
]

type Step = 'clinic_type' | 'info' | 'success'

export default function RegisterPage() {
  const router = useRouter()
  const [step, setStep] = useState<Step>('clinic_type')
  const [selectedType, setSelectedType] = useState<string | null>(null)
  const [form, setForm] = useState({
    clinicName: '',
    ownerName: '',
    email: '',
    phone: '',
  })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [acceptTerms, setAcceptTerms] = useState(false)

  const selectedClinic = clinicTypes.find(c => c.id === selectedType)

  const validate = (): boolean => {
    const errs: Record<string, string> = {}
    if (!form.clinicName.trim()) errs.clinicName = 'กรุณากรอกชื่อคลินิก'
    if (!form.ownerName.trim()) errs.ownerName = 'กรุณากรอกชื่อเจ้าของ'
    if (!form.email.trim()) errs.email = 'กรุณากรอกอีเมล'
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) errs.email = 'อีเมลไม่ถูกต้อง'
    if (!form.phone.trim()) errs.phone = 'กรุณากรอกเบอร์โทรศัพท์'

    if (!acceptTerms) errs.acceptTerms = 'กรุณายอมรับเงื่อนไขการใช้งาน'
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  const handleSubmit = async () => {
    if (!validate()) return
    
    const now = new Date().toISOString()
    const clinicId = `clinic-${Date.now()}`
    const userId = `user-${Date.now()}`
    const membershipId = `mem-${Date.now()}`
    
    // Try Supabase first
    if (typeof window !== 'undefined') {
      const { isSupabaseReady } = await import('@/lib/supabase')
      if (isSupabaseReady()) {
        const { supabaseRegister } = await import('@/lib/supabase-auth')
        const result = await supabaseRegister({
          email: form.email,
          password: '123456',
          name: form.ownerName,
          phone: form.phone,
          clinicName: form.clinicName,
          clinicType: selectedType || 'dental',
        })
        if (result.success) {
          setStep('success')
          return
        }
        // If Supabase fails, fallback to localStorage
      }
    }
    
    // Fallback: localStorage
    // 1. Create User record
    const users = JSON.parse(localStorage.getItem('clinicq-users') || '[]')
    const newUser = {
      id: userId,
      email: form.email,
      name: form.ownerName,
      phone: form.phone,
      createdAt: now,
      forcePasswordChange: true, // Force change password on first login
    }
    users.push(newUser)
    localStorage.setItem('clinicq-users', JSON.stringify(users))
    
    // 2. Store default password (user must change on first login)
    const passwords = JSON.parse(localStorage.getItem('clinicq-user-passwords') || '{}')
    passwords[form.email] = '123456'
    localStorage.setItem('clinicq-user-passwords', JSON.stringify(passwords))
    
    // 3. Create Clinic record
    const clinics = JSON.parse(localStorage.getItem('clinicq-clinics') || '[]')
    const newClinic = {
      id: clinicId,
      name: form.clinicName,
      type: selectedType,
      phone: form.phone,
      ownerName: form.ownerName,
      createdAt: now,
    }
    clinics.push(newClinic)
    localStorage.setItem('clinicq-clinics', JSON.stringify(clinics))
    
    // 4. Create Membership (owner role)
    const memberships = JSON.parse(localStorage.getItem('clinicq-memberships') || '[]')
    const newMembership = {
      id: membershipId,
      userId: userId,
      clinicId: clinicId,
      role: 'owner',
      isActive: true,
      createdAt: now,
    }
    memberships.push(newMembership)
    localStorage.setItem('clinicq-memberships', JSON.stringify(memberships))
    
    // 5. Save registration info (legacy)
    const registered = JSON.parse(localStorage.getItem('clinicq-registered-clinics') || '{}')
    registered[form.email] = {
      clinicType: selectedType,
      clinicName: form.clinicName,
      ownerName: form.ownerName,
      phone: form.phone,
      email: form.email,
      registeredAt: now,
    }
    localStorage.setItem('clinicq-registered-clinics', JSON.stringify(registered))
    
    // 6. Set default clinic type for ClinicContext
    localStorage.setItem('clinic-q-type', selectedType || 'dental')
    
    // 6.1 Store trial end date (30 days from now)
    const trialEnd = new Date()
    trialEnd.setDate(trialEnd.getDate() + 30)
    localStorage.setItem(`clinicq-subscription-${clinicId}`, JSON.stringify({
      plan: 'trial',
      status: 'active',
      startDate: now,
      trialEndDate: trialEnd.toISOString(),
      paidEndDate: null,
    }))
    
    // 7. Initialize clinic-specific settings with clinic name
    localStorage.setItem(`clinic-q-settings-${clinicId}`, JSON.stringify({
      clinicName: form.clinicName,
      logo: '',
      operatingDays: ['mon', 'tue', 'wed', 'thu', 'fri'],
      openTime: '08:00',
      closeTime: '20:00',
    }))
    
    // 8. Initialize default rooms for this clinic
    const defaultRooms = [
      { id: 1, name: 'ห้อง 1', color: '#0891B2', branchId: '', practitionerId: '', slotDuration: 30, workingStartTime: '09:00', workingEndTime: '17:00', active: true },
      { id: 2, name: 'ห้อง 2', color: '#10B981', branchId: '', practitionerId: '', slotDuration: 30, workingStartTime: '09:00', workingEndTime: '17:00', active: true },
      { id: 3, name: 'ห้อง 3', color: '#F59E0B', branchId: '', practitionerId: '', slotDuration: 30, workingStartTime: '09:00', workingEndTime: '17:00', active: true },
    ]
    localStorage.setItem(`clinic-rooms-${clinicId}`, JSON.stringify(defaultRooms))
    
    // 9. Initialize user list with owner (registrant)
    const ownerUser = {
      id: userId,
      email: form.email,
      name: form.ownerName,
      phone: form.phone || '',
      createdAt: now,
      roles: ['owner'],
      branchIds: [],
      isActive: true,
      forcePasswordChange: true,
    }
    localStorage.setItem(`clinicq-users-with-roles-${clinicId}`, JSON.stringify([ownerUser]))
    
    setStep('success')
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-pink-50">
      <div className="max-w-2xl mx-auto px-4 py-12">
        {/* Header */}
        <div className="text-center mb-10">
          <div className="w-16 h-16 rounded-3xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center mx-auto mb-4 shadow-lg shadow-purple-200">
            <span className="text-3xl">🏥</span>
          </div>
          <h1 className="text-3xl font-extrabold text-gray-900">สมัครใช้งาน Clinic-Q</h1>
          <p className="text-gray-500 mt-2">ทดลองใช้ฟรี 30 วัน · ไม่ต้องบัตรเครดิต</p>
        </div>

        {/* Progress */}
        <div className="flex items-center justify-center gap-3 mb-10">
          {(['clinic_type', 'info', 'success'] as Step[]).map((s, i) => (
            <div key={s} className="flex items-center gap-2">
              <div className={clsx(
                'w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-all',
                step === s ? 'bg-purple-500 text-white shadow-lg shadow-purple-200' :
                (['clinic_type', 'info', 'success'].indexOf(step) > i) ? 'bg-green-500 text-white' :
                'bg-gray-200 text-gray-500'
              )}>
                {(['clinic_type', 'info', 'success'].indexOf(step) > i) ? (
                  <CheckCircle className="w-4 h-4" />
                ) : i + 1}
              </div>
              {i < 2 && <div className={clsx('w-12 h-0.5', ['clinic_type', 'info', 'success'].indexOf(step) > i ? 'bg-green-500' : 'bg-gray-200')} />}
            </div>
          ))}
        </div>

        {/* Step 1: Clinic Type */}
        {step === 'clinic_type' && (
          <div className="space-y-6">
            <h2 className="text-xl font-bold text-gray-900 text-center">เลือกประเภทคลินิก</h2>
            <div className="grid grid-cols-2 gap-3">
              {clinicTypes.map(ct => (
                <button
                  key={ct.id}
                  onClick={() => setSelectedType(ct.id)}
                  className={clsx(
                    'p-4 rounded-2xl border-2 text-left transition-all',
                    selectedType === ct.id
                      ? 'border-purple-400 bg-purple-50 shadow-md'
                      : 'border-gray-200 bg-white hover:border-gray-300 hover:shadow-sm'
                  )}
                >
                  <span className="text-2xl">{ct.icon}</span>
                  <p className="font-bold text-gray-900 mt-2 text-sm">{ct.name}</p>
                  <p className="text-xs text-gray-500 mt-1">{ct.desc}</p>
                </button>
              ))}
            </div>
            <button
              onClick={() => selectedType && setStep('info')}
              disabled={!selectedType}
              className={clsx(
                'w-full py-3.5 rounded-2xl font-bold text-white transition-all flex items-center justify-center gap-2',
                selectedType
                  ? 'bg-gradient-to-r from-purple-500 to-pink-500 hover:shadow-lg shadow-purple-200'
                  : 'bg-gray-300 cursor-not-allowed'
              )}
            >
              ถัดไป <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Step 2: Info Form */}
        {step === 'info' && selectedClinic && (
          <div className="space-y-5">
            <div className="bg-white rounded-2xl p-4 border border-gray-100 flex items-center gap-3">
              <span className="text-2xl">{selectedClinic.icon}</span>
              <div>
                <p className="font-bold text-gray-900">{selectedClinic.name}</p>
                <p className="text-xs text-gray-500">ทดลองใช้ฟรี 30 วัน</p>
              </div>
            </div>

            <div className="space-y-4">
              <InputField
                icon={<Building2 className="w-4 h-4" />}
                label="ชื่อคลินิก"
                placeholder="เช่น คลินิกทันตกรรม สุขใจ"
                value={form.clinicName}
                onChange={v => setForm(f => ({ ...f, clinicName: v }))}
                error={errors.clinicName}
              />
              <InputField
                icon={<User className="w-4 h-4" />}
                label="ชื่อ-นามสกุล เจ้าของคลินิก"
                placeholder="เช่น ทพ.สมบูรณ์ สุขใจ"
                value={form.ownerName}
                onChange={v => setForm(f => ({ ...f, ownerName: v }))}
                error={errors.ownerName}
              />
              <InputField
                icon={<Mail className="w-4 h-4" />}
                label="อีเมล"
                type="email"
                placeholder="your@email.com"
                value={form.email}
                onChange={v => setForm(f => ({ ...f, email: v }))}
                error={errors.email}
              />
              <InputField
                icon={<Phone className="w-4 h-4" />}
                label="เบอร์โทรศัพท์"
                type="tel"
                placeholder="081-234-5678"
                value={form.phone}
                onChange={v => setForm(f => ({ ...f, phone: v }))}
                error={errors.phone}
              />

            </div>

            {/* ═══ Terms & Conditions ═══ */}
            <div className="bg-gray-50 rounded-2xl p-4 border border-gray-200">
              <div className="max-h-32 overflow-y-auto mb-3 text-xs text-gray-600 space-y-2 leading-relaxed pr-1">
                <p className="font-bold text-gray-800 text-sm">📋 เงื่อนไขการใช้งาน Clinic-Q</p>
                <p>1. ข้าพเจ้าได้อ่านและเข้าใจเงื่อนไขการใช้งาน นโยบายความเป็นส่วนตัว ของระบบ Clinic-Q แล้ว</p>
                <p>2. ข้อมูลที่กรอกในแบบฟอร์มเป็นข้อมูลจริงและสามารถตรวจสอบได้</p>
                <p>3. การทดลองใช้งานฟรี 30 วัน โดยไม่ต้องใช้บัตรเครดิต</p>
                <p>4. หลังหมดอายุทดลองใช้ จะต้องสมัครแพ็กเกจ Clinic-Q Professional เพื่อใช้งานต่อ</p>
                <p>5. ห้ามนำระบบไปใช้ในทางที่ผิดกฎหมาย หรือละเมิดสิทธิ์ผู้อื่น</p>
                <p>6. บริษัทขอสงวนสิทธิ์ในการระงับการให้บริการ หากพบการใช้งานที่ไม่เหมาะสม</p>
                <p className="text-purple-600">
                  อ่านเงื่อนไขฉบับเต็มได้ที่{' '}
                  <a href="/terms" target="_blank" className="underline font-bold">เงื่อนไขการใช้งาน</a>{' '}
                  และ{' '}
                  <a href="/privacy" target="_blank" className="underline font-bold">นโยบายความเป็นส่วนตัว</a>
                </p>
              </div>
              <label className="flex items-start gap-3 cursor-pointer group">
                <div className="relative mt-0.5">
                  <input
                    type="checkbox"
                    checked={acceptTerms}
                    onChange={e => setAcceptTerms(e.target.checked)}
                    className="peer sr-only"
                  />
                  <div className="w-5 h-5 rounded-md border-2 border-gray-300 peer-checked:border-purple-500 peer-checked:bg-purple-500 transition-all flex items-center justify-center">
                    {acceptTerms && (
                      <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                    )}
                  </div>
                </div>
                <span className="text-sm text-gray-700 leading-relaxed">
                  ข้าพเจ้าได้อ่านและ <strong>ยอมรับเงื่อนไขการใช้งาน</strong> และ <strong>นโยบายความเป็นส่วนตัว</strong> ของ Clinic-Q แล้ว
                </span>
              </label>
              {errors.acceptTerms && (
                <p className="text-xs text-red-500 mt-2 ml-8">⚠️ {errors.acceptTerms}</p>
              )}
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setStep('clinic_type')}
                className="flex-1 py-3 rounded-2xl font-bold text-gray-500 bg-gray-100 hover:bg-gray-200 transition-colors"
              >
                ย้อนกลับ
              </button>
              <button
                onClick={handleSubmit}
                disabled={!acceptTerms}
                className={clsx(
                  'flex-1 py-3 rounded-2xl font-bold text-white transition-all flex items-center justify-center gap-2',
                  acceptTerms
                    ? 'bg-gradient-to-r from-purple-500 to-pink-500 hover:shadow-lg shadow-purple-200'
                    : 'bg-gray-300 cursor-not-allowed'
                )}
              >
                🚀 สมัครใช้งานฟรี
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Success */}
        {step === 'success' && selectedClinic && (
          <div className="text-center space-y-6">
            <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto">
              <CheckCircle className="w-10 h-10 text-green-500" />
            </div>
            <div>
              <h2 className="text-2xl font-extrabold text-gray-900">สมัครสำเร็จ! 🎉</h2>
              <p className="text-gray-500 mt-2">ยินดีต้อนรับสู่ Clinic-Q</p>
            </div>

            <div className="bg-white rounded-2xl p-6 border border-gray-100 text-left space-y-4">
              <div className="flex items-center gap-3">
                <span className="text-2xl">{selectedClinic.icon}</span>
                <div>
                  <p className="font-bold text-gray-900">{form.clinicName}</p>
                  <p className="text-xs text-gray-500">{selectedClinic.name}</p>
                </div>
              </div>
              <div className="candy-divider" />
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm">
                  <CheckCircle className="w-4 h-4 text-green-500" />
                  <span className="text-gray-700">ทดลองใช้ฟรี <strong>30 วัน</strong></span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <CheckCircle className="w-4 h-4 text-green-500" />
                  <span className="text-gray-700">ไม่ต้องใช้บัตรเครดิต</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <CheckCircle className="w-4 h-4 text-green-500" />
                  <span className="text-gray-700">ใช้ได้ทุกฟีเจอร์พื้นฐาน</span>
                </div>
              </div>
            </div>

            <div className="bg-blue-50 rounded-2xl p-4 border border-blue-200 space-y-2">
              <p className="text-sm text-blue-700 font-medium">
                📧 อีเมล: <strong>{form.email}</strong>
              </p>
              <p className="text-sm text-blue-700">
                🔑 รหัสผ่านเริ่มต้น: <strong>123456</strong>
              </p>
              <p className="text-xs text-blue-600">
                ⚠️ ระบบจะให้เปลี่ยนรหัสผ่านใหม่ในการเข้าใช้งานครั้งแรก
              </p>
            </div>
            <div className="bg-amber-50 rounded-2xl p-4 border border-amber-200">
              <p className="text-sm text-amber-700 font-medium">
                ⚠️ ทดลองใช้จะสิ้นสุดใน 30 วัน — อัปเกรดเป็นแพ็กเกจชำระเงินเพื่อใช้งานต่อ
              </p>
            </div>

            <button
              onClick={() => window.location.href = '/login'}
              className="w-full py-3.5 rounded-2xl font-bold text-white bg-gradient-to-r from-purple-500 to-pink-500 hover:shadow-lg shadow-purple-200 transition-all"
            >
              เข้าสู่ระบบ
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

function InputField({ icon, label, type = 'text', placeholder, value, onChange, error }: {
  icon: React.ReactNode; label: string; type?: string; placeholder: string
  value: string; onChange: (v: string) => void; error?: string
}) {
  return (
    <div>
      <label className="block text-sm font-bold text-gray-700 mb-1">{label}</label>
      <div className="relative">
        <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">{icon}</div>
        <input
          type={type}
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          className={clsx(
            'w-full pl-10 pr-4 py-2.5 rounded-xl border text-sm transition-colors',
            error ? 'border-red-300 focus:ring-2 focus:ring-red-200' : 'border-gray-200 focus:ring-2 focus:ring-purple-200 focus:border-purple-300'
          )}
        />
      </div>
      {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
    </div>
  )
}
