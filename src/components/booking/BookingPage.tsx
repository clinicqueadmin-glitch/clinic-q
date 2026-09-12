'use client'

import { useState, useMemo, useEffect, useRef } from 'react'
import { useSearchParams } from 'next/navigation'
import {
  Phone, User, Stethoscope, Clock,
  CheckCircle, Calendar, AlertTriangle,
} from 'lucide-react'
import { clsx } from 'clsx'
import { QRCodeSVG } from 'qrcode.react'
import { clinicConfig, type ClinicType } from '@/lib/queue-data'
import { getDefaultBranchData, getAllActiveProcedures, estimateNextServiceTime, type AppointmentQueueItem } from '@/lib/branch-data'
import { getDaySchedule, type ClinicSettings } from '@/lib/clinic-context'
import { useQueue } from '@/lib/queue-context'
import PhoneInput from '@/components/ui/PhoneInput'

export default function BookingPage() {
  const searchParams = useSearchParams()
  const urlClinicType = searchParams.get('clinic') as ClinicType | null
  const { queue, addQueueItem } = useQueue()

  // Detect clinic ID and type from localStorage
  const { clinicId, clinicType, clinicCfg } = useMemo(() => {
    if (typeof window !== 'undefined') {
      const clinics = JSON.parse(localStorage.getItem('clinicq-clinics') || '[]')
      if (urlClinicType) {
        const found = clinics.find((c: any) => c.type === urlClinicType)
        return {
          clinicId: found?.id || null,
          clinicType: urlClinicType,
          clinicCfg: clinicConfig[urlClinicType] || clinicConfig['dental'],
        }
      }
      if (clinics.length > 0) {
        const userClinic = clinics[0]
        return {
          clinicId: userClinic.id,
          clinicType: (userClinic.type || 'dental') as ClinicType,
          clinicCfg: clinicConfig[(userClinic.type || 'dental') as ClinicType] || clinicConfig['dental'],
        }
      }
    }
    return {
      clinicId: null,
      clinicType: 'dental' as ClinicType,
      clinicCfg: clinicConfig['dental'],
    }
  }, [urlClinicType])

  // Load actual clinic name from settings
  const clinicDisplayName = useMemo(() => {
    if (typeof window !== 'undefined' && clinicId) {
      const saved = localStorage.getItem(`clinic-q-settings-${clinicId}`)
      if (saved) {
        try {
          const parsed = JSON.parse(saved)
          if (parsed.clinicName) return parsed.clinicName
        } catch {}
      }
    }
    return clinicCfg.name
  }, [clinicId, clinicCfg])

  // Load clinic settings (weekly schedule)
  const clinicSettings = useMemo((): ClinicSettings => {
    if (typeof window !== 'undefined' && clinicId) {
      const saved = localStorage.getItem(`clinic-q-settings-${clinicId}`)
      if (saved) {
        try {
          const parsed = JSON.parse(saved)
          return { operatingDays: ['mon', 'tue', 'wed', 'thu', 'fri'], ...parsed }
        } catch {}
      }
    }
    return { operatingDays: ['mon', 'tue', 'wed', 'thu', 'fri'] }
  }, [clinicId])

  // Load branch data from clinic-specific storage, fallback to defaults
  const branchData = useMemo(() => {
    if (typeof window !== 'undefined' && clinicId) {
      const saved = localStorage.getItem(`clinic-branch-data-${clinicId}`)
      if (saved) {
        try {
          const parsed = JSON.parse(saved)
          if (parsed && parsed.branches && parsed.branches.length > 0) {
            return parsed as ReturnType<typeof getDefaultBranchData>
          }
        } catch {}
      }
    }
    return getDefaultBranchData(clinicType)
  }, [clinicId, clinicType])

  const [submitted, setSubmitted] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submittedTime, setSubmittedTime] = useState('')

  // Form state
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [selectedBranch, setSelectedBranch] = useState('')
  const [selectedProcedure, setSelectedProcedure] = useState('')
  // Online booking is for TODAY only — the booking date is fixed automatically
  // (ICT timezone), so no date picker is shown to the patient.
  const selectedDate = useMemo(() => {
    const now = new Date()
    const ictMs = now.getTime() + 7 * 60 * 60 * 1000
    return new Date(ictMs).toISOString().split('T')[0]
  }, [])
  const [submittedNumber, setSubmittedNumber] = useState('')
  const [estimatedTime, setEstimatedTime] = useState('')
  const [availableRoomCount, setAvailableRoomCount] = useState<number | null>(null)

  // ── Date → day-of-week mapping ──
  const dayNames = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat']
  const selectedDaySchedule = useMemo(() => {
    const date = new Date(selectedDate + 'T12:00:00') // noon to avoid timezone issues
    const dayCode = dayNames[date.getDay()]
    return getDaySchedule(clinicSettings, dayCode)
  }, [selectedDate, clinicSettings])

  const isClinicOpenOnDate = selectedDaySchedule.enabled

  // ── Load room availability for selected date ──
  useEffect(() => {
    if (!clinicId || !isClinicOpenOnDate) {
      setAvailableRoomCount(null)
      return
    }
    const loadRooms = async () => {
      try {
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
        const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
        if (!supabaseUrl || !supabaseKey) return

        // Load rooms from rooms table
        const res = await fetch(
          `${supabaseUrl}/rest/v1/rooms?clinic_id=eq.${clinicId}&is_active=eq.true`,
          { headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` } }
        )
        if (!res.ok) return
        const rooms = await res.json()

        // Filter by available_days for selected date
        const date = new Date(selectedDate + 'T12:00:00')
        const dayCode = dayNames[date.getDay()]
        const availableRooms = rooms.filter((r: any) => {
          const days = r.available_days
          return Array.isArray(days) && days.includes(dayCode)
        })

        setAvailableRoomCount(availableRooms.length)
      } catch {}
    }
    loadRooms()
  }, [clinicId, selectedDate, isClinicOpenOnDate])

  // Get procedures for selected branch
  const branchProcedures = useMemo(() => {
    if (!selectedBranch) return []
    const branch = branchData.branches.find(b => b.id === selectedBranch)
    return branch?.procedures || []
  }, [selectedBranch, branchData])

  // ── Filter queue by selected date for estimation ──
  const queueForDate = useMemo(() => {
    return queue.filter(q => q.queueDate === selectedDate)
  }, [queue, selectedDate])

  // Calculate estimated appointment time (branch + date + queue-status aware)
  const calcEstimatedTime = useMemo(() => {
    if (!selectedProcedure || !selectedBranch || !isClinicOpenOnDate) return ''
    return estimateNextServiceTime(branchData, queueForDate, {
      branchId: selectedBranch,
      procedureId: selectedProcedure,
      queueDate: selectedDate,
      preferredTimeHHMM: selectedDaySchedule.openTime || '09:00',
    })
  }, [selectedProcedure, selectedBranch, queueForDate, branchData, isClinicOpenOnDate, selectedDaySchedule, selectedDate])

  // Update displayed estimate when selection changes
  useEffect(() => {
    setEstimatedTime(calcEstimatedTime)
  }, [calcEstimatedTime])

  // Fetch the LATEST queue state from Supabase for the selected date at booking
  // time, so the appointment continues from the most recent relevant queues
  // (and two people booking in a row never land on the same slot).
  const fetchLatestQueueForDate = async (date: string): Promise<AppointmentQueueItem[] | null> => {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
    if (!supabaseUrl || !supabaseKey || !clinicId) return null
    try {
      const res = await fetch(
        `${supabaseUrl}/rest/v1/queues?clinic_id=eq.${clinicId}&queue_date=eq.${date}&order=created_at.asc`,
        { headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` } }
      )
      if (!res.ok) return null
      const rows = await res.json()
      return (Array.isArray(rows) ? rows : []).map((r: any) => ({
        id: r.id,
        status: r.status || 'waiting',
        branchId: r.branch_id || '',
        procedureId: r.procedure_id || '',
        queueDate: r.queue_date || undefined,
        bookedAt: r.booked_at || r.created_at || '',
        servingAt: r.serving_at ? new Date(r.serving_at).getTime() : undefined,
      }))
    } catch {
      return null
    }
  }

  // Submit booking via Queue Engine (addQueueItem → RPC)
  const handleSubmit = async () => {
    if (isSubmitting || submittedNumber) return
    if (!name.trim() || phone.length !== 10 || !selectedProcedure || !isClinicOpenOnDate) return

    setIsSubmitting(true)
    try {
      const procName = branchProcedures.find(p => p.id === selectedProcedure)?.name || ''

      // Re-read the queue from the DB right before booking (fall back to the
      // live-polled state if the fresh fetch fails).
      let estimateQueue: AppointmentQueueItem[] = queueForDate
      const freshQueue = await fetchLatestQueueForDate(selectedDate)
      if (freshQueue) estimateQueue = freshQueue

      const finalTime = estimateNextServiceTime(branchData, estimateQueue, {
        branchId: selectedBranch,
        procedureId: selectedProcedure,
        queueDate: selectedDate,
        preferredTimeHHMM: selectedDaySchedule.openTime || '09:00',
      })
      setEstimatedTime(finalTime)
      // Freeze the confirmed appointment time: the live estimate re-computes
      // after the new booking lands in the queue (which would otherwise push
      // the displayed time by its own duration + buffer).
      setSubmittedTime(finalTime)

      const result = await addQueueItem({
        patientName: name.trim(),
        phone: phone.trim(),
        procedure: procName,
        procedureId: selectedProcedure,
        branchId: selectedBranch,
        bookingMode: 'remote' as const,
        assignedRoom: 0,
        assignedDoctor: '',
        status: 'waiting' as const,
        time: finalTime,
        bookedAt: new Date().toISOString(),
        arrivalTime: '',
        arrived: false,
        arrivedAt: undefined,
        queueDate: selectedDate,
        bookedTimeSlot: finalTime,
      })

      setSubmittedNumber(result.number)
      setSubmitted(true)
    } finally {
      setIsSubmitting(false)
    }
  }

  const accentColor = clinicCfg.color

  // Ref to the on-screen QR so we can serialise the exact same QR into an image.
  const qrBoxRef = useRef<HTMLDivElement | null>(null)

  // Save the queue QR (same tracking URL as displayed) as a PNG for the patient.
  const handleSaveQr = async () => {
    try {
      const svg = qrBoxRef.current?.querySelector('svg')
      if (!svg) return
      const size = 600
      const padding = 48
      const svgData = new XMLSerializer().serializeToString(svg)
      const svgUrl = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgData)}`
      const img = document.createElement('img')
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve()
        img.onerror = () => reject(new Error('qr render failed'))
        img.src = svgUrl
      })
      const canvas = document.createElement('canvas')
      canvas.width = size
      canvas.height = size
      const ctx = canvas.getContext('2d')
      if (!ctx) throw new Error('no canvas context')
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, size, size)
      ctx.drawImage(img, padding, padding, size - padding * 2, size - padding * 2)
      const link = document.createElement('a')
      link.download = `clinicq-queue-${submittedNumber || 'booking'}.png`
      link.href = canvas.toDataURL('image/png')
      link.click()
    } catch {
      alert('ไม่สามารถบันทึก QR Code ได้ กรุณาลองใหม่อีกครั้ง')
    }
  }

  // ═══ Submitted ═══
  if (submitted) {
    const trackUrl = `${typeof window !== 'undefined' ? window.location.origin : ''}/track?id=${submittedNumber}&clinic=${clinicType || 'dental'}`
    return (
      <div className="min-h-screen flex items-center justify-center p-4" style={{ backgroundColor: `${accentColor}08` }}>
        <div className="bento-card p-8 max-w-sm w-full text-center animate-scale-in">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4" style={{ backgroundColor: '#22C55E15' }}>
            <CheckCircle className="w-8 h-8 text-emerald-500" />
          </div>
          <h1 className="text-xl font-bold text-gray-900 mb-1">✅ จองคิวสำเร็จ!</h1>
          <p className="text-sm text-gray-500 mb-4">{clinicCfg.icon} {clinicDisplayName}</p>

          {/* Booking Time Highlight */}
          <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 mb-4">
            <p className="text-sm text-blue-700 font-medium">เวลานัดโดยประมาณ</p>
            <p className="text-4xl font-black mt-1" style={{ color: accentColor }}>{submittedTime || estimatedTime} น.</p>
            <p className="text-[11px] text-blue-500 mt-2 leading-relaxed">
              ※ เวลานัดเป็นเวลาโดยประมาณ ระบบคำนวณจากคิวที่มีอยู่และระยะเวลาให้บริการของหัตถการ
            </p>
          </div>

          {/* Instructions */}
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 mb-4 text-left">
            <p className="text-sm font-bold text-amber-700 mb-2">📋 สิ่งที่ต้องทำเมื่อมาถึงคลินิก</p>
            <ol className="text-sm text-amber-600 space-y-1.5 list-decimal list-inside">
              <li>มาถึงคลินิกก่อนเวลานัดอย่างน้อย 10 นาที</li>
              <li>แจ้งที่หน้าเคานเตอร์ว่า <b>"จองคิวออนไลน์"</b></li>
              <li>แสดงหมายเลขคิว <b>{submittedNumber}</b> แก่เจ้าหน้าที่</li>
            </ol>
          </div>

          {/* Auto-cancel warning */}
          <p className="text-[11px] text-orange-500 mb-4">⚠️ เวลานัดอาจเปลี่ยนแปลงตามสถานการณ์จริงของคลินิก</p>

          {/* Queue Number */}
          <div className="py-6 rounded-2xl mb-4" style={{ backgroundColor: `${accentColor}08` }}>
            <p className="text-xs text-gray-500 mb-1">หมายเลขคิวของคุณ</p>
            <p className="text-5xl font-black font-mono tabular-nums" style={{ color: accentColor }}>
              {submittedNumber}
            </p>
          </div>

          {/* QR for tracking */}
          <div ref={qrBoxRef} className="bg-white p-4 rounded-2xl border border-gray-100 mb-4 inline-block">
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
              <span className="text-gray-500">เบอร์โทร</span>
              <span className="font-medium text-gray-900">{phone}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">วันที่</span>
              <span className="font-medium text-gray-900">วันนี้ ({selectedDate})</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">หัตถการ</span>
              <span className="font-medium text-gray-900">{branchProcedures.find(p => p.id === selectedProcedure)?.name}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">เวลานัดโดยประมาณ</span>
              <span className="font-bold" style={{ color: accentColor }}>{submittedTime || estimatedTime} น.</span>
            </div>
          </div>

          <button
            onClick={handleSaveQr}
            className="mt-4 w-full py-3 rounded-2xl font-bold text-sm text-white transition-all hover:shadow-lg active:scale-[0.98]"
            style={{ backgroundColor: accentColor }}
          >
            💾 บันทึก QR Code
          </button>
          <p className="text-[11px] text-gray-400 mt-2">
            บันทึก QR ไว้ในโทรศัพท์เพื่อติดตามสถานะคิวของคุณ
          </p>
        </div>
      </div>
    )
  }

  // ═══ Booking Form ═══
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
              <h1 className="text-white font-bold text-lg">📱 จองคิวออนไลน์</h1>
              <p className="text-white/70 text-xs">{clinicCfg.icon} {clinicDisplayName}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-md mx-auto px-4 py-6 space-y-5">
        {/* Info Banner */}
        <div className="bento-card p-4 flex items-center gap-3 border-blue-200 bg-blue-50/50">
          <div className="w-8 h-8 rounded-xl bg-blue-100 flex items-center justify-center flex-shrink-0">
            <span className="text-lg">📅</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-blue-700">จองคิวออนไลน์</p>
            <p className="text-xs text-gray-500">กรอกข้อมูลด้านล่างเพื่อจองคิวสำหรับวันนี้ เจ้าหน้าที่จะยืนยันนัดหมายทางโทรศัพท์</p>
          </div>
        </div>

        {/* Clinic Closed Warning */}
        {!isClinicOpenOnDate && (
          <div className="bento-card p-4 flex items-center gap-3 border-red-200 bg-red-50">
            <div className="w-8 h-8 rounded-xl bg-red-100 flex items-center justify-center flex-shrink-0">
              <AlertTriangle className="w-4 h-4 text-red-500" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-red-700">คลินิกปิดทำการวันนี้</p>
              <p className="text-xs text-red-500">ขออภัย วันนี้คลินิกปิดทำการ กรุณากลับมาใช้บริการในวันทำการถัดไป</p>
            </div>
          </div>
        )}

        {/* Form */}
        <div className="bento-card p-5 space-y-4">
          <h2 className="text-base font-bold text-gray-900">
            📱 จองคิวออนไลน์ — {clinicDisplayName}
          </h2>

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

          {/* Date — fixed to today (online booking is same-day only) */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">
              <Calendar className="w-3.5 h-3.5 inline mr-1" /> วันที่จอง
            </label>
            <div className="w-full px-4 py-3 rounded-2xl border border-blue-200 bg-blue-50/60 flex items-center justify-between gap-2">
              <span className="text-sm font-semibold text-blue-700">📅 จองสำหรับวันนี้</span>
              <span className="text-sm font-medium text-gray-600">
                {new Date(selectedDate + 'T12:00:00').toLocaleDateString('th-TH', { weekday: 'long', day: 'numeric', month: 'long' })}
              </span>
            </div>
            <p className="text-[10px] text-gray-400 mt-1">
              {isClinicOpenOnDate
                ? `เปิดทำการ ${selectedDaySchedule.openTime}–${selectedDaySchedule.closeTime}`
                : 'วันนี้คลินิกปิดทำการ'}
            </p>
          </div>

          {/* Room Availability */}
          {isClinicOpenOnDate && clinicId && (
            <div className="flex items-center gap-2 text-[10px] text-gray-500">
              <span className="inline-block w-2 h-2 rounded-full bg-emerald-400" />
              {availableRoomCount !== null ? (
                availableRoomCount > 0
                  ? `ห้องตรวจที่พร้อมให้บริการ: ${availableRoomCount} ห้อง`
                  : 'ไม่มีห้องตรวจให้บริการในวันนี้'
              ) : (
                'กำลังตรวจสอบห้องตรวจ...'
              )}
            </div>
          )}

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

          {/* Procedure */}
          {selectedBranch && (
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                <Stethoscope className="w-3.5 h-3.5 inline mr-1" /> หัตถการ *
              </label>
              <select
                value={selectedProcedure}
                onChange={(e) => setSelectedProcedure(e.target.value)}
                className="w-full px-4 py-3 rounded-2xl border border-gray-200 focus:border-gray-400 focus:outline-none text-sm bg-white transition-colors"
              >
                <option value="">— เลือกหัตถการ —</option>
                {branchProcedures.map(proc => (
                  <option key={proc.id} value={proc.id}>{proc.name} ({proc.estimatedDuration} นาที)</option>
                ))}
              </select>
            </div>
          )}

          {/* Queue-aware estimated booking time */}
          {isClinicOpenOnDate && (
            <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4">
              <p className="text-xs font-semibold text-blue-700 mb-1">
                <Clock className="w-3.5 h-3.5 inline mr-1" /> เวลานัดโดยประมาณ
              </p>
              <p className="text-2xl font-black text-blue-800">{estimatedTime || '—'} น.</p>
              <p className="text-[11px] text-blue-500 mt-1">
                ⏱️ คำนวณจากคิวปัจจุบัน + ระยะเวลาหัตถการ
              </p>
              <p className="text-[11px] text-blue-500 mt-1 leading-relaxed">
                ※ เวลานัดเป็นเวลาโดยประมาณ ระบบจะคำนวณจากคิวที่มีอยู่และระยะเวลาให้บริการของหัตถการ และอาจเปลี่ยนแปลงตามสถานการณ์จริงของคลินิก
              </p>
            </div>
          )}

          {/* Submit */}
          <button
            onClick={handleSubmit}
            disabled={isSubmitting || !name.trim() || phone.length !== 10 || !selectedProcedure || !isClinicOpenOnDate}
            className={clsx(
              'w-full py-3.5 rounded-2xl font-bold text-sm transition-all',
              !isSubmitting && name.trim() && phone.length === 10 && selectedProcedure && isClinicOpenOnDate
                ? 'text-white shadow-lg hover:shadow-xl active:scale-[0.98]'
                : 'bg-gray-100 text-gray-400 cursor-not-allowed'
            )}
            style={!isSubmitting && name.trim() && phone.length === 10 && selectedProcedure && isClinicOpenOnDate ? { backgroundColor: accentColor } : {}}
          >
            {isSubmitting ? '⏳ กำลังจองคิว...' : '📱 จองคิวออนไลน์'}
          </button>
        </div>

        {/* Footer */}
        <p className="text-center text-[11px] text-gray-400">{clinicDisplayName} — Clinic-Q</p>
      </div>
    </div>
  )
}
