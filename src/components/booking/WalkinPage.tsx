'use client'

import { useState, useMemo, useEffect } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import {
  Loader2, Phone, User, Stethoscope, Clock,
  CheckCircle, Plus, Trash2,
} from 'lucide-react'
import PhoneInput from '@/components/ui/PhoneInput'
import { clsx } from 'clsx'
import { QRCodeSVG } from 'qrcode.react'
import { clinicConfig, type ClinicType } from '@/lib/queue-data'
import { getDefaultBranchData, type Practitioner } from '@/lib/branch-data'
import { useQueue } from '@/lib/queue-context'

interface SelectedProc {
  procedureId: string
  name: string
  quantity: number
}

export default function WalkinPage() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const clinicType = (searchParams.get('clinic') || 'dental') as ClinicType
  const clinicCfg = clinicConfig[clinicType]
  const { queue, setQueue, addQueueItem } = useQueue()
  const branchData = useMemo(() => getDefaultBranchData(clinicType), [clinicType])

  // Auto redirect after registration when called from dashboard (staff mode)
  const isStaffMode = searchParams.get('staff') === '1'

  // Form state — shared
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [selectedBranch, setSelectedBranch] = useState('')
  const [selectedProcedure, setSelectedProcedure] = useState('')
  const [selectedProcs, setSelectedProcs] = useState<SelectedProc[]>([])
  const [submittedNumber, setSubmittedNumber] = useState('')
  const [submitResult, setSubmitResult] = useState<{ number: string; mode: BookingMode; apptTime: string; onTime: boolean; practitioner: string } | null>(null)

  // Booking mode: walkin or appointment
  type BookingMode = 'walkin' | 'appointment'
  const [bookingMode, setBookingMode] = useState<BookingMode>(
    (searchParams.get('mode') as BookingMode) || 'walkin'
  )

  // Appointment-only fields
  const [appointmentTime, setAppointmentTime] = useState('')
  const [isOnTime, setIsOnTime] = useState(true)
  const [lateMinutes, setLateMinutes] = useState(0)
  const [practitionerName, setPractitionerName] = useState('')

  // Get procedures for selected branch
  const branchProcedures = useMemo(() => {
    if (!selectedBranch) return []
    const branch = branchData.branches.find(b => b.id === selectedBranch)
    return branch?.procedures || []
  }, [selectedBranch, branchData])

  // Get practitioners from localStorage (filtered by current clinic)
  const branchPractitioners = useMemo(() => {
    const clinicId = `clinic-${clinicType}`
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('clinic-practitioners')
      if (saved) {
        try {
          const parsed = JSON.parse(saved)
          if (Array.isArray(parsed)) {
            return parsed.filter((p: any) => p.clinicId === clinicId && p.active)
          }
        } catch {}
      }
    }
    return []
  }, [clinicType])

  // Add procedure to list
  const addProcedure = () => {
    if (!selectedProcedure) return
    const proc = branchProcedures.find(p => p.id === selectedProcedure)
    if (!proc) return
    if (selectedProcs.some(p => p.procedureId === selectedProcedure)) {
      setSelectedProcs(prev => prev.map(p =>
        p.procedureId === selectedProcedure ? { ...p, quantity: p.quantity + 1 } : p
      ))
    } else {
      setSelectedProcs(prev => [...prev, {
        procedureId: selectedProcedure,
        name: proc.name,
        quantity: 1,
      }])
    }
    setSelectedProcedure('')
  }

  // Remove procedure
  const removeProcedure = (idx: number) => {
    setSelectedProcs(prev => prev.filter((_, i) => i !== idx))
  }

  // Update quantity
  const updateQty = (idx: number, qty: number) => {
    if (qty < 1) return
    setSelectedProcs(prev => prev.map((p, i) => i === idx ? { ...p, quantity: qty } : p))
  }

  // Generate queue number
  const generateQueueNumber = () => {
    const prefix = clinicCfg.prefix
    const count = queue.length + 1
    return `${prefix}${String(count).padStart(3, '0')}`
  }

  // Submit
  const handleSubmit = async () => {
    if (!name.trim() || phone.length !== 10 || selectedProcs.length === 0) return
    if (bookingMode === 'appointment' && !appointmentTime) return

    const number = generateQueueNumber()
    const now = new Date()
    const timeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`

    const primaryProc = selectedProcs[0]

    // Calculate on-time status for appointment
    let computedIsOnTime = true
    let computedLateMinutes = 0
    if (bookingMode === 'appointment' && appointmentTime) {
      const [ah, am] = appointmentTime.split(':').map(Number)
      const [ch, cm] = timeStr.split(':').map(Number)
      const diffMinutes = (ch * 60 + cm) - (ah * 60 + am)
      if (isOnTime) {
        computedIsOnTime = true
        computedLateMinutes = 0
      } else {
        computedIsOnTime = diffMinutes <= 10
        computedLateMinutes = computedIsOnTime ? 0 : diffMinutes > 0 ? diffMinutes : lateMinutes
      }
    }

    const newQueueItem: Record<string, any> = {
      number,
      patientName: name.trim(),
      phone: phone.length === 10,
      procedure: primaryProc.name,
      procedureId: primaryProc.procedureId,
      branchId: selectedBranch,
      bookingMode,
      assignedRoom: 0,
      assignedDoctor: bookingMode === 'appointment' ? practitionerName : '',
      status: 'waiting' as const,
      time: timeStr,
      bookedAt: now.toISOString(),
      arrivalTime: timeStr,
      arrived: true,
      arrivedAt: now.toISOString(),
      // Appointment-specific fields
      ...(bookingMode === 'appointment' ? {
        appointmentTime,
        appointmentDate: now.toISOString().split('T')[0],
        isOnTime: computedIsOnTime,
        lateMinutes: computedLateMinutes,
        originalBookedTime: appointmentTime,
      } : {}),
    }

    // Store submission result for success screen
    setSubmitResult({
      number,
      mode: bookingMode,
      apptTime: appointmentTime,
      onTime: isOnTime,
      practitioner: practitionerName,
    })

    try {
      await addQueueItem(newQueueItem as any)
    } catch (e) {
      setQueue(prev => [...prev, { ...newQueueItem, id: `walkin-${Date.now()}` } as any])
    }
    setSubmittedNumber(number)
  }

  const accentColor = clinicCfg.color

  // Auto redirect to dashboard after staff registration
  useEffect(() => {
    if (submittedNumber && isStaffMode) {
      const timer = setTimeout(() => router.push('/'), 2000)
      return () => clearTimeout(timer)
    }
  }, [submittedNumber, isStaffMode, router])

  // ═══ Submitted ═══
  if (submittedNumber) {
    const trackUrl = `${typeof window !== 'undefined' ? window.location.origin : ''}/track?id=${submittedNumber}`
    return (
      <div className="min-h-screen flex items-center justify-center p-4" style={{ backgroundColor: `${accentColor}08` }}>
        <div className="bento-card p-8 max-w-sm w-full text-center animate-scale-in">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4" style={{ backgroundColor: '#22C55E15' }}>
            <CheckCircle className="w-8 h-8 text-emerald-500" />
          </div>
          <h1 className="text-xl font-bold text-gray-900 mb-1">ลงทะเบียนสำเร็จ!</h1>
          <p className="text-sm text-gray-500 mb-4">{clinicCfg.icon} {clinicCfg.name} — {isStaffMode ? 'กำลังกลับหน้าหลัก...' : 'กรุณารอเรียกคิวที่หน้าจอ'}</p>

          {/* Queue Number */}
          <div className="py-6 rounded-2xl mb-4" style={{ backgroundColor: `${accentColor}08` }}>
            <p className="text-xs text-gray-500 mb-1">หมายเลขคิวของคุณ</p>
            <p className="text-5xl font-black font-mono tabular-nums" style={{ color: accentColor }}>
              {submittedNumber}
            </p>
            {submitResult?.mode === 'appointment' && submitResult.apptTime && (
              <div className="mt-2">
                <span className={clsx('inline-block px-3 py-1 rounded-full text-xs font-bold', submitResult.onTime ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700')}>
                  {submitResult.onTime ? '✅ มาตามนัด' : `⚠️ นัด ${submitResult.apptTime}`}
                </span>
              </div>
            )}
          </div>

          {/* QR for tracking */}
          <div className="bg-white p-4 rounded-2xl border border-gray-100 mb-4 inline-block">
            <QRCodeSVG value={trackUrl} size={140} level="M" />
          </div>
          <p className="text-xs text-gray-400">สแกนเพื่อติดตามสถานะคิว</p>

          {/* Info */}
          <div className="mt-6 space-y-2 text-left bg-gray-50 rounded-xl p-4">
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">ชื่อ</span>
              <span className="font-medium text-gray-900">{name}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">ประเภท</span>
              <span className="font-medium text-gray-900">
                {submitResult?.mode === 'appointment' ? '🕐 นัด' : '🚶 Walk-in'}
              </span>
            </div>
            {submitResult?.mode === 'appointment' && submitResult.apptTime && (
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">เวลานัด</span>
                <span className="font-medium text-gray-900">{submitResult.apptTime}</span>
              </div>
            )}
            {submitResult?.mode === 'appointment' && submitResult.practitioner && (
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">แพทย์ผู้นัด</span>
                <span className="font-medium text-gray-900">{submitResult.practitioner}</span>
              </div>
            )}
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">หัตถการ</span>
              <span className="font-medium text-gray-900">
                {selectedProcs.map(p => `${p.name} x${p.quantity}`).join(', ')}
              </span>
            </div>
          </div>

          {isStaffMode ? (
            <button
              onClick={() => router.push('/')}
              className="mt-6 w-full py-3 rounded-2xl font-bold text-sm text-white transition-all"
              style={{ backgroundColor: accentColor }}
            >
              กลับหน้าหลัก
            </button>
          ) : (
            <button
              onClick={() => {
                setName(''); setPhone(''); setSelectedBranch('')
                setSelectedProcedure(''); setSelectedProcs([])
                setAppointmentTime(''); setIsOnTime(true); setLateMinutes(0)
                setPractitionerName(''); setSubmittedNumber(''); setSubmitResult(null)
              }}
              className="mt-6 w-full py-3 rounded-2xl font-bold text-sm text-white transition-all"
              style={{ backgroundColor: accentColor }}
            >
              ลงทะเบียนใหม่
            </button>
          )}
        </div>
      </div>
    )
  }

  // ═══ Registration Form ═══
  return (
    <div className="min-h-screen" style={{ backgroundColor: `${accentColor}05` }}>
      {/* Header */}
      <div className="px-4 py-5 shadow-sm" style={{ backgroundColor: accentColor }}>
        <div className="max-w-md mx-auto">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-white/20 flex items-center justify-center text-white font-bold text-lg">
              {clinicCfg.icon}
            </div>
            <div>
              <h1 className="text-white font-bold text-lg">📋 ลงทะเบียนผู้รับบริการ</h1>
              <p className="text-white/70 text-xs">{clinicCfg.icon} {clinicCfg.name}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-md mx-auto px-4 py-6 space-y-4">
        {/* ═══ BOOKING MODE TOGGLE ═══ */}
        <div className="bento-card p-1.5 flex gap-1.5">
          <button
            onClick={() => setBookingMode('walkin')}
            className={clsx(
              'flex-1 py-3 rounded-2xl font-bold text-sm transition-all flex items-center justify-center gap-2',
              bookingMode === 'walkin'
                ? 'text-white shadow-md'
                : 'text-gray-500 hover:bg-gray-50'
            )}
            style={bookingMode === 'walkin' ? { backgroundColor: '#22C55E' } : {}}
          >
            🚶 ไม่นัด (Walk-in)
          </button>
          <button
            onClick={() => setBookingMode('appointment')}
            className={clsx(
              'flex-1 py-3 rounded-2xl font-bold text-sm transition-all flex items-center justify-center gap-2',
              bookingMode === 'appointment'
                ? 'text-white shadow-md'
                : 'text-gray-500 hover:bg-gray-50'
            )}
            style={bookingMode === 'appointment' ? { backgroundColor: '#F97316' } : {}}
          >
            🕐 นัดไว้
          </button>
        </div>

        {/* Walk-in or Appointment badge */}
        {bookingMode === 'walkin' ? (
          <div className="bento-card p-3 flex items-center gap-3 border-emerald-200 bg-emerald-50/50">
            <div className="w-8 h-8 rounded-xl bg-emerald-500 flex items-center justify-center">
              <span className="text-white text-sm">✓</span>
            </div>
            <div>
              <p className="text-sm font-bold text-emerald-700">ลงทะเบียน Walk-in ที่หน้า{clinicCfg.name}</p>
              <p className="text-[11px] text-gray-500">กรอกข้อมูลแล้วรอเรียกคิว</p>
            </div>
          </div>
        ) : (
          <div className="bento-card p-3 flex items-center gap-3 border-orange-200 bg-orange-50/50">
            <div className="w-8 h-8 rounded-xl bg-orange-500 flex items-center justify-center">
              <Clock className="w-4 h-4 text-white" />
            </div>
            <div>
              <p className="text-sm font-bold text-orange-700">ลงทะเบียนคนไข้นัด</p>
              <p className="text-[11px] text-gray-500">ระบุเวลานัดและสถานะการมา</p>
            </div>
          </div>
        )}

        {/* ═══ SHARED FORM FIELDS ═══ */}
        <div className="bento-card p-5 space-y-4">
          {/* Name */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">
              <User className="w-3.5 h-3.5 inline mr-1" /> ชื่อ-นามสกุล *
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="กรอกชื่อ-นามสกุล"
              className="w-full px-4 py-3 rounded-2xl border border-gray-200 focus:border-gray-400 focus:outline-none text-sm bg-white transition-colors"
              autoFocus
            />
          </div>

          {/* Phone */}
          <PhoneInput
            label="เบอร์โทรศัพท์"
            value={phone}
            onChange={setPhone}
            required
            showIcon
          />

          {/* Branch */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">
              <Stethoscope className="w-3.5 h-3.5 inline mr-1" /> สาขา *
            </label>
            <select
              value={selectedBranch}
              onChange={(e) => { setSelectedBranch(e.target.value); setSelectedProcedure('') }}
              className="w-full px-4 py-3 rounded-2xl border border-gray-200 focus:border-gray-400 focus:outline-none text-sm bg-white transition-colors"
            >
              <option value="">— เลือกสาขา —</option>
              {branchData.branches.map(branch => (
                <option key={branch.id} value={branch.id}>{branch.name}</option>
              ))}
            </select>
          </div>

          {/* Add Procedure */}
          {selectedBranch && (
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                <Stethoscope className="w-3.5 h-3.5 inline mr-1" /> เพิ่มหัตถการ *
              </label>
              <div className="flex gap-2">
                <select
                  value={selectedProcedure}
                  onChange={(e) => setSelectedProcedure(e.target.value)}
                  className="flex-1 px-4 py-3 rounded-2xl border border-gray-200 focus:border-gray-400 focus:outline-none text-sm bg-white transition-colors"
                >
                  <option value="">— เลือกหัตถการ —</option>
                  {branchProcedures.map(proc => (
                    <option key={proc.id} value={proc.id}>{proc.name} ({proc.estimatedDuration} น.)</option>
                  ))}
                </select>
                <button
                  onClick={addProcedure}
                  disabled={!selectedProcedure}
                  className={clsx(
                    'px-4 py-3 rounded-2xl font-bold text-sm transition-all flex items-center gap-1',
                    selectedProcedure
                      ? 'text-white shadow-md hover:shadow-lg active:scale-[0.98]'
                      : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                  )}
                  style={selectedProcedure ? { backgroundColor: accentColor } : {}}
                >
                  <Plus className="w-4 h-4" /> เพิ่ม
                </button>
              </div>
            </div>
          )}

          {/* Selected Procedures List */}
          {selectedProcs.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-gray-600">หัตถการที่เลือก ({selectedProcs.length})</p>
              {selectedProcs.map((proc, idx) => (
                <div key={idx} className="flex items-center gap-2 p-3 bg-gray-50 rounded-2xl">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{proc.name}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => updateQty(idx, proc.quantity - 1)}
                      className="w-7 h-7 rounded-xl bg-white border border-gray-200 flex items-center justify-center text-gray-500 hover:bg-gray-100 text-sm font-bold"
                    >−</button>
                    <span className="w-8 text-center text-sm font-bold text-gray-900">{proc.quantity}</span>
                    <button
                      onClick={() => updateQty(idx, proc.quantity + 1)}
                      className="w-7 h-7 rounded-xl bg-white border border-gray-200 flex items-center justify-center text-gray-500 hover:bg-gray-100 text-sm font-bold"
                    >+</button>
                    <button
                      onClick={() => removeProcedure(idx)}
                      className="p-1.5 rounded-xl hover:bg-red-50 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5 text-gray-400 hover:text-red-500" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* ═══ APPOINTMENT-ONLY FIELDS ═══ */}
          {bookingMode === 'appointment' && (
            <>
              {/* Divider */}
              <div className="border-t border-orange-100 pt-4">
                <p className="text-xs font-bold text-orange-600 mb-3">🕐 ข้อมูลการนัด</p>
              </div>

              {/* Appointment Time */}
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                  <Clock className="w-3.5 h-3.5 inline mr-1" /> เวลาที่นัด *
                </label>
                <input
                  type="time"
                  value={appointmentTime}
                  onChange={(e) => setAppointmentTime(e.target.value)}
                  className="w-full px-4 py-3 rounded-2xl border border-gray-200 focus:border-gray-400 focus:outline-none text-sm bg-white transition-colors"
                />
              </div>

              {/* On time or late */}
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-2">สถานะการมา</label>
                <div className="flex gap-2">
                  <button
                    onClick={() => { setIsOnTime(true); setLateMinutes(0) }}
                    className={clsx(
                      'flex-1 py-3 rounded-2xl text-sm font-bold border-2 transition-all',
                      isOnTime
                        ? 'border-green-400 bg-green-50 text-green-700'
                        : 'border-gray-200 bg-white text-gray-500 hover:border-green-300'
                    )}
                  >
                    ✅ มาตามนัด
                  </button>
                  <button
                    onClick={() => {
                      setIsOnTime(false)
                      // Auto-calculate late minutes from appointment time vs now
                      if (appointmentTime) {
                        const now = new Date()
                        const [ah, am] = appointmentTime.split(':').map(Number)
                        const diffMinutes = (now.getHours() * 60 + now.getMinutes()) - (ah * 60 + am)
                        setLateMinutes(diffMinutes > 0 ? diffMinutes : 0)
                      } else {
                        setLateMinutes(0)
                      }
                    }}
                    className={clsx(
                      'flex-1 py-3 rounded-2xl text-sm font-bold border-2 transition-all',
                      !isOnTime
                        ? 'border-orange-400 bg-orange-50 text-orange-700'
                        : 'border-gray-200 bg-white text-gray-500 hover:border-orange-300'
                    )}
                  >
                    ⚠️ มาล่าช้า
                  </button>
                </div>
                {!isOnTime && (
                  <div className="mt-2">
                    <label className="block text-xs text-gray-500 mb-1">ล่าช้ากี่นาที <span className="text-orange-500 font-bold">(คำนวณอัตโนมัติ)</span></label>
                    <input
                      type="number"
                      min={0}
                      value={lateMinutes}
                      onChange={(e) => setLateMinutes(parseInt(e.target.value) || 0)}
                      className="w-full px-4 py-3 rounded-2xl border border-orange-200 focus:border-orange-400 focus:outline-none text-sm bg-orange-50 transition-colors font-bold text-orange-700"
                    />
                    <p className="text-[10px] text-gray-400 mt-1">⏱ นัด {appointmentTime || '??:??'} ICT · ปัจจุบัน {new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Bangkok' })} ICT · ล่าช้า {lateMinutes} นาที</p>
                  </div>
                )}
              </div>

              {/* Practitioner */}
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                  👨‍⚕️ แพทย์ผู้นัด
                </label>
                <select
                  value={practitionerName}
                  onChange={(e) => setPractitionerName(e.target.value)}
                  className="w-full px-4 py-3 rounded-2xl border border-gray-200 focus:border-gray-400 focus:outline-none text-sm bg-white transition-colors"
                >
                  <option value="">— เลือกแพทย์ —</option>
                  {branchPractitioners.map(p => (
                    <option key={p.id} value={p.name}>{p.name}</option>
                  ))}
                </select>
              </div>
            </>
          )}

          {/* Submit */}
          <button
            onClick={handleSubmit}
            disabled={!name.trim() || phone.length !== 10 || selectedProcs.length === 0 || (bookingMode === 'appointment' && !appointmentTime)}
            className={clsx(
              'w-full py-3.5 rounded-2xl font-bold text-sm transition-all',
              name.trim() && phone.length === 10 && selectedProcs.length > 0 && (bookingMode === 'walkin' || appointmentTime)
                ? 'text-white shadow-lg hover:shadow-xl active:scale-[0.98]'
                : 'bg-gray-100 text-gray-400 cursor-not-allowed'
            )}
            style={
              name.trim() && phone.length === 10 && selectedProcs.length > 0 && (bookingMode === 'walkin' || appointmentTime)
                ? { backgroundColor: bookingMode === 'walkin' ? '#22C55E' : '#F97316' }
                : {}
            }
          >
            {bookingMode === 'walkin' ? '🚶 ลงทะเบียน Walk-in' : '🕐 ลงทะเบียนนัด'}
          </button>
        </div>

        <p className="text-center text-[11px] text-gray-400">{clinicCfg.name} — Clinic-Q</p>
      </div>
    </div>
  )
}
