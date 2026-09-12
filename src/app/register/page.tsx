'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { X } from 'lucide-react'
import {
  Stethoscope, Sparkles, Heart, Leaf, Brain, Bone,
  ArrowRight, CheckCircle, Mail, User, Phone, Building2, Lock,
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

type Step = 'clinic_type' | 'info' | 'check_email' | 'success'

export default function RegisterPage() {
  const router = useRouter()
  const [step, setStep] = useState<Step>('clinic_type')
  const [selectedType, setSelectedType] = useState<string | null>(null)
  // Email confirmation pending — used by the "check your email" step
  const [pendingEmail, setPendingEmail] = useState('')
  const [resending, setResending] = useState(false)
  const [resendResult, setResendResult] = useState<{ success: boolean; message: string } | null>(null)
  const [completingRegistration, setCompletingRegistration] = useState(false)
  const [completeError, setCompleteError] = useState('')
  const [form, setForm] = useState({
    clinicName: '',
    ownerName: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: '',
  })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [acceptTerms, setAcceptTerms] = useState(false)
  const [showDuplicateModal, setShowDuplicateModal] = useState(false)
  const [duplicateClinicName, setDuplicateClinicName] = useState('')

  const selectedClinic = clinicTypes.find(c => c.id === selectedType)

  const validate = (): boolean => {
    const errs: Record<string, string> = {}
    if (!form.clinicName.trim()) errs.clinicName = 'กรุณากรอกชื่อคลินิก'
    if (!form.ownerName.trim()) errs.ownerName = 'กรุณากรอกชื่อเจ้าของ'
    if (!form.email.trim()) errs.email = 'กรุณากรอกอีเมล'
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) errs.email = 'อีเมลไม่ถูกต้อง'
    if (!form.phone.trim()) errs.phone = 'กรุณากรอกเบอร์โทรศัพท์'
    if (!form.password) errs.password = 'กรุณาตั้งรหัสผ่าน'
    else if (form.password.length < 6) errs.password = 'รหัสผ่านต้องมีความยาวอย่างน้อย 6 ตัวอักษร'
    if (!form.confirmPassword) errs.confirmPassword = 'กรุณายืนยันรหัสผ่าน'
    else if (form.confirmPassword !== form.password) errs.confirmPassword = 'รหัสผ่านทั้งสองช่องไม่ตรงกัน'

    if (!acceptTerms) errs.acceptTerms = 'กรุณายอมรับเงื่อนไขการใช้งาน'
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  const checkDuplicateClinic = async (): Promise<boolean> => {
    const name = form.clinicName.trim()
    const phone = form.phone.trim()
    if (!name || !phone) return false

    // Check Supabase
    try {
      const { isSupabaseReady } = await import('@/lib/supabase')
      if (isSupabaseReady()) {
        const { getSupabase } = await import('@/lib/supabase')
        const sb = getSupabase()
        const { data } = await sb
          .from('clinics')
          .select('id, name')
          .ilike('name', name)
          .limit(1)
        if (data && data.length > 0) {
          setDuplicateClinicName(data[0].name)
          return true
        }
      }
    } catch {}

    // Check localStorage clinics
    try {
      const clinics = JSON.parse(localStorage.getItem('clinicq-clinics') || '[]')
      const clinicsSB = JSON.parse(localStorage.getItem('clinicq-clinics-sb') || '[]')
      const allClinics = [...clinics, ...clinicsSB]
      const match = allClinics.find(
        (c: { name: string; phone?: string }) =>
          c.name.toLowerCase() === name.toLowerCase() &&
          c.phone && c.phone === phone
      )
      if (match) {
        setDuplicateClinicName(match.name)
        return true
      }
    } catch {}

    // Check Supabase clinics via localStorage cache
    try {
      const allClinicsRaw = localStorage.getItem('clinicq-all-clinics')
      if (allClinicsRaw) {
        const allClinics = JSON.parse(allClinicsRaw)
        const match = allClinics.find(
          (c: { name: string }) => c.name.toLowerCase() === name.toLowerCase()
        )
        if (match) {
          setDuplicateClinicName(match.name)
          return true
        }
      }
    } catch {}

    return false
  }

  const handleSubmit = async () => {
    if (!validate()) return
    
    // Check for duplicate clinic
    const isDuplicate = await checkDuplicateClinic()
    if (isDuplicate) {
      setShowDuplicateModal(true)
      return
    }
    
    // Registration goes through Supabase Auth only (no localStorage fallback)
    if (typeof window === 'undefined') return
    const { isSupabaseReady } = await import('@/lib/supabase')
    if (!isSupabaseReady()) {
      alert('ระบบยังไม่ได้เชื่อมต่อกับฐานข้อมูล กรุณาติดต่อผู้ดูแลระบบ')
      return
    }
    const { supabaseRegister } = await import('@/lib/supabase-auth')
    const result = await supabaseRegister({
      email: form.email,
      password: form.password,
      name: form.ownerName,
      phone: form.phone,
      clinicName: form.clinicName,
      clinicType: selectedType || 'dental',
    })
    if (!result.success) {
      alert(result.error || 'สมัครใช้งานไม่สำเร็จ กรุณาลองใหม่อีกครั้ง')
      return
    }

    // Email confirmation required → tell the user to check their inbox.
    // Clinic setup (clinic + owner + default roles) finishes after the
    // user clicks the confirmation link (see the ?confirmed=1 effect).
    // Only non-sensitive data is kept in sessionStorage — never the password.
    if ((result as any).needsEmailConfirmation) {
      try {
        sessionStorage.setItem('pendingRegistration', JSON.stringify({
          userId: result.userId,
          email: form.email,
          name: form.ownerName,
          phone: form.phone,
          clinicName: form.clinicName,
          clinicType: selectedType || 'dental',
        }))
      } catch {}
      setPendingEmail(form.email)
      setStep('check_email')
      return
    }

    // Session available (confirmation disabled) → create defaults now.
    const clinicId = (result as any).clinicId || ''
    await createDefaultAccounts(clinicId)
    // Fire-and-forget: persist trial in DB + alert Platform Owner on LINE.
    // Idempotent — safe to call even if the endpoint was already hit.
    notifyNewClinic(clinicId, form.ownerName, form.email)
    setStep('success')
  }

  // ═══ After email confirmation: finish clinic setup ═══
  // Supabase redirects to /register?confirmed=1 via /auth/callback once the
  // email link is clicked. Here we complete registration (clinic + owner +
  // default roles) using the pending data saved at signup time.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get('confirmed') !== '1') return
    // Clean the URL so a refresh doesn't re-run the flow
    window.history.replaceState({}, '', '/register')

    let cancelled = false
    ;(async () => {
      let pending: any = null
      try {
        pending = JSON.parse(sessionStorage.getItem('pendingRegistration') || 'null')
      } catch {}

      if (!pending) {
        // Edge case: user clicked the confirmation link in a fresh tab/session
        // where the pending registration was never saved. If they already own
        // a clinic (completed earlier), just let them log in.
        try {
          const { getSupabase } = await import('@/lib/supabase')
          const sb = getSupabase()
          if (sb) {
            const { data: { session } } = await sb.auth.getSession()
            if (session?.user) {
              const { data: membership } = await sb
                .from('clinic_memberships')
                .select('clinic_id')
                .eq('user_id', session.user.id)
                .eq('role', 'owner')
                .eq('is_active', true)
                .maybeSingle()
              if (membership?.clinic_id) {
                if (!cancelled) { setStep('success'); return }
              }
            }
          }
        } catch {}
        if (!cancelled) setCompleteError('ไม่พบข้อมูลการสมัครที่ค้างอยู่ กรุณาเข้าสู่ระบบหรือสมัครใหม่')
        return
      }

      setCompletingRegistration(true)
      // Restore the form + clinic type so the success screen renders correctly
      // on this fresh page load (state would otherwise be empty)
      if (pending.clinicType) setSelectedType(pending.clinicType)
      setForm(f => ({
        ...f,
        clinicName: pending.clinicName || f.clinicName,
        email: pending.email || f.email,
        ownerName: pending.name || f.ownerName,
        phone: pending.phone || f.phone,
      }))
      try {
        const { supabaseCompleteRegistration } = await import('@/lib/supabase-auth')
        const complete = await supabaseCompleteRegistration({
          userId: pending.userId,
          email: pending.email,
          name: pending.name,
          phone: pending.phone,
          clinicName: pending.clinicName,
          clinicType: pending.clinicType,
        })
        if (cancelled) return
        if (!complete.success) {
          setCompleteError(complete.error || 'ไม่สามารถสร้างคลินิกได้ กรุณาลองใหม่อีกครั้ง')
          return
        }

        // Create default Manager / Staff / Practitioner accounts
        const confirmedClinicId = complete.clinicId || ''
        await createDefaultAccounts(confirmedClinicId)
        // Fire-and-forget: persist trial in DB + alert Platform Owner on LINE.
        notifyNewClinic(confirmedClinicId, pending.name || '', pending.email || '')
        try { sessionStorage.removeItem('pendingRegistration') } catch {}
        setStep('success')
      } catch (e) {
        console.error('Failed to complete registration:', e)
        if (!cancelled) setCompleteError('เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง')
      } finally {
        if (!cancelled) setCompletingRegistration(false)
      }
    })()

    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Fire-and-forget: persist trial + notify Platform Owner (best effort).
  // Uses the user's Supabase session token to prove clinic ownership.
  const notifyNewClinic = (clinicId: string, ownerName: string, ownerEmail: string) => {
    if (!clinicId) return
    import('@/lib/supabase').then(({ getSupabase }) => {
      const sb = getSupabase()
      if (!sb) return
      sb.auth.getSession().then((res: any) => {
        const session = res?.data?.session as { access_token?: string } | null
        if (!session?.access_token) return
        fetch('/api/platform/clinic-registered', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ clinicId, ownerName, ownerEmail }),
        }).catch(() => {})
      }).catch(() => {})
    }).catch(() => {})
  }

  // Create default Manager + Staff + Practitioner accounts for the new clinic
  // via the server-side API. Best-effort: if it fails the clinic still works,
  // but staff won't have default logins.
  const createDefaultAccounts = async (clinicId: string) => {
    if (!clinicId) return
    try {
      const res = await fetch(`/api/clinics/${encodeURIComponent(clinicId)}/users`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'default' }),
      })
      const body = await res.json().catch(() => ({}))
      if (res.ok && body.accounts && body.accounts.length) {
        sessionStorage.setItem('defaultAccounts', JSON.stringify(body.accounts))
      }
    } catch (e) {
      console.error('Failed to create default accounts:', e)
    }
  }

  // Resend the confirmation email
  const handleResend = async () => {
    if (!pendingEmail.trim()) return
    setResending(true)
    setResendResult(null)
    try {
      const { supabaseResendConfirmation } = await import('@/lib/supabase-auth')
      const result = await supabaseResendConfirmation(pendingEmail.trim())
      setResendResult(result.success
        ? { success: true, message: 'ระบบได้ส่งอีเมลยืนยันอีกครั้งแล้ว กรุณาตรวจสอบกล่องจดหมาย (รวมถึงสแปม)' }
        : { success: false, message: result.error || 'ไม่สามารถส่งอีเมลยืนยันได้ กรุณาลองใหม่' })
    } catch {
      setResendResult({ success: false, message: 'ไม่สามารถส่งอีเมลยืนยันได้ กรุณาลองใหม่' })
    } finally {
      setResending(false)
    }
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
              <InputField
                icon={<Lock className="w-4 h-4" />}
                label="ตั้งรหัสผ่าน"
                type="password"
                placeholder="อย่างน้อย 6 ตัวอักษร"
                value={form.password}
                onChange={v => setForm(f => ({ ...f, password: v }))}
                error={errors.password}
              />
              <InputField
                icon={<Lock className="w-4 h-4" />}
                label="ยืนยันรหัสผ่าน"
                type="password"
                placeholder="กรอกรหัสผ่านอีกครั้ง"
                value={form.confirmPassword}
                onChange={v => setForm(f => ({ ...f, confirmPassword: v }))}
                error={errors.confirmPassword}
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

        {/* Step: Check Email (confirmation required) */}
        {step === 'check_email' && (
          <div className="text-center space-y-6">
            <div className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center mx-auto">
              <Mail className="w-10 h-10 text-blue-500" />
            </div>
            <div>
              <h2 className="text-2xl font-extrabold text-gray-900">ตรวจสอบอีเมลของคุณ 📧</h2>
              <p className="text-gray-500 mt-2">
                ระบบได้ส่งลิงก์ยืนยันอีเมลไปยัง <strong>{pendingEmail}</strong>
              </p>
            </div>

            <div className="bg-blue-50 rounded-2xl p-4 border border-blue-200 text-left space-y-2">
              <p className="text-sm text-blue-700 leading-relaxed">
                👉 คลิกลิงก์ยืนยันในอีเมลเพื่อเปิดใช้งานบัญชี จากนั้นระบบจะสร้างคลินิกและบัญชีเริ่มต้นให้อัตโนมัติ
              </p>
              <p className="text-xs text-blue-600">
                ⚠️ หากไม่พบอีเมล กรุณาตรวจสอบโฟลเดอร์สแปม หรือกดปุ่มด้านล่างเพื่อส่งอีเมลยืนยันใหม่
              </p>
            </div>

            {resendResult && (
              <div className={clsx(
                'rounded-2xl p-4 border text-sm',
                resendResult.success ? 'bg-green-50 border-green-200 text-green-700' : 'bg-red-50 border-red-200 text-red-600'
              )}>
                {resendResult.success ? '✅' : '❌'} {resendResult.message}
              </div>
            )}

            <div className="flex flex-col gap-3">
              <button
                onClick={handleResend}
                disabled={resending}
                className="w-full py-3.5 rounded-2xl font-bold text-white bg-gradient-to-r from-blue-500 to-indigo-500 hover:shadow-lg shadow-blue-200 transition-all disabled:opacity-50"
              >
                {resending ? '⏳ กำลังส่ง...' : '📧 ส่งอีเมลยืนยันอีกครั้ง'}
              </button>
              <button
                onClick={() => window.location.href = '/login'}
                className="w-full py-3.5 rounded-2xl font-bold text-gray-500 bg-gray-100 hover:bg-gray-200 transition-colors"
              >
                ไปที่หน้าเข้าสู่ระบบ
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
                🔑 ใช้รหัสผ่านที่ตั้งไว้ตอนสมัครเพื่อเข้าสู่ระบบได้ทันที
              </p>
            </div>

            {/* Default accounts (Manager + Counter) — read from sessionStorage since
                the success step re-renders and defaultAccounts may be out of scope */}
            {typeof window !== 'undefined' && (() => {
              try {
                const stored = JSON.parse(sessionStorage.getItem('defaultAccounts') || '[]')
                if (!stored.length) return null
                return (
                  <div className="bg-amber-50 rounded-2xl p-4 border border-amber-200 space-y-3">
                    <p className="text-sm font-bold text-amber-800">
                      📋 บัญชีเริ่มต้นของคลินิก (บันทึกไว้ทันที — แสดงเพียงครั้งเดียว)
                    </p>
                    {stored.map((acc: { role: string; username: string; temporaryPassword: string }) => (
                      <div key={acc.role} className="bg-white rounded-xl p-4 border border-amber-100">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-medium text-gray-700">
                            {acc.role === 'manager' ? '👨‍💼 ผู้จัดการ' :
                             acc.role === 'front_desk' || acc.role === 'staff' ? '🧑‍💼 เจ้าหน้าที่' :
                             acc.role === 'practitioner' ? '👨‍⚕️ ผู้ทำหัตถการ' :
                             '🧑‍💼 เจ้าหน้าที่'}
                          </span>
                          <button
                            onClick={() => navigator.clipboard?.writeText(acc.username).catch(() => {})}
                            className="text-xs text-indigo-600 hover:text-indigo-800 font-medium"
                          >
                            📋 คัดลอก Username
                          </button>
                        </div>
                        <div className="space-y-1 text-sm">
                          <div className="flex items-center gap-2">
                            <span className="text-gray-500">Username:</span>
                            <code className="font-mono bg-gray-100 px-2 py-1 rounded text-xs">{acc.username}</code>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-gray-500">รหัสผ่านชั่วคราว:</span>
                            <code className="font-mono bg-gray-100 px-2 py-1 rounded text-xs tracking-wider">{acc.temporaryPassword}</code>
                          </div>
                        </div>
                      </div>
                    ))}
                    <p className="text-xs text-amber-600">
                      ⚠️ รหัสผ่านชั่วคราวนี้จะแสดงเพียงครั้งเดียว หลังจากนี้ระบบจะไม่สามารถแสดงอีกได้
                      {' '}•{' '}
                      หากลืม ให้ผู้จัดการรีเซ็ตรหัสผ่านจากหน้าจัดการผู้ใช้
                    </p>
                  </div>
                )
              } catch {
                return null
              }
            })()}
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
      {/* ═══ Duplicate Clinic Modal ═══ */}
      {showDuplicateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setShowDuplicateModal(false)} />
          <div className="relative bg-white rounded-3xl shadow-2xl max-w-sm w-full overflow-hidden">
            <div className="bg-gradient-to-r from-amber-500 to-orange-500 p-6 text-center">
              <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center mx-auto mb-3">
                <span className="text-3xl">⚠️</span>
              </div>
              <h3 className="text-xl font-extrabold text-white">คลินิกท่านได้สมัครแล้ว</h3>
            </div>
            <div className="p-6 text-center">
              <p className="text-sm text-gray-600 mb-2">
                พบว่าคลินิก <strong className="text-gray-900">"{duplicateClinicName}"</strong> ได้สมัครใช้งานทดลองฟรีแล้ว
              </p>
              <p className="text-sm text-gray-500 mb-6">
                หากสนใจการใช้งาน Clinic Q กรุณาติดต่อ Admin เพื่อขอข้อมูลการเข้าใช้งาน
              </p>
              <a
                href="https://lin.ee/OqlmFFG"
                target="_blank"
                rel="noopener noreferrer"
                className="w-full py-3 rounded-2xl font-bold text-white bg-[#06C755] hover:bg-[#05b549] transition-all flex items-center justify-center gap-2 shadow-lg"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor"><path d="M19.365 9.863c.349 0 .63.285.63.631 0 .345-.281.63-.63.63H17.61v1.125h1.755c.349 0 .63.283.63.63 0 .344-.281.629-.63.629h-2.386c-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.627-.63h2.386c.349 0 .63.285.63.63 0 .349-.281.63-.63.63H17.61v1.125h1.755zm-3.855 3.016c0 .27-.174.51-.432.596-.064.021-.133.031-.199.031-.211 0-.391-.09-.51-.25l-2.443-3.317v2.94c0 .344-.279.629-.631.629-.346 0-.626-.285-.626-.629V8.108c0-.271.173-.508.43-.595.06-.023.136-.033.194-.033.195 0 .375.104.495.254l2.462 3.33V8.108c0-.345.282-.63.63-.63.345 0 .63.285.63.63v4.771zm-5.741 0c0 .344-.282.629-.631.629-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.627-.63.349 0 .631.285.631.63v4.771zm-2.466.629H4.917c-.345 0-.63-.285-.63-.629V8.108c0-.345.285-.63.63-.63.348 0 .63.285.63.63v4.141h1.756c.348 0 .629.283.629.63 0 .344-.281.629-.629.629M24 10.314C24 4.943 18.615.572 12 .572S0 4.943 0 10.314c0 4.811 4.27 8.842 10.035 9.608.391.082.923.258 1.058.59.12.301.079.766.038 1.08l-.164 1.02c-.045.301-.24 1.186 1.049.645 1.291-.539 6.916-4.078 9.436-6.975C23.176 14.393 24 12.458 24 10.314"/></svg>
                💬 ติดต่อ Admin ผ่าน LINE
              </a>
              <button
                onClick={() => setShowDuplicateModal(false)}
                className="w-full py-3 mt-3 rounded-2xl font-bold text-gray-500 bg-gray-100 hover:bg-gray-200 transition-colors"
              >
                ปิด
              </button>
            </div>
          </div>
        </div>
      )}
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
