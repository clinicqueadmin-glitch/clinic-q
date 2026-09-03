'use client'

import { useState, useMemo } from 'react'
import { useSearchParams } from 'next/navigation'
import {
  Phone, User, Stethoscope, Clock,
  CheckCircle,
} from 'lucide-react'
import { clsx } from 'clsx'
import { QRCodeSVG } from 'qrcode.react'
import { clinicConfig, type ClinicType } from '@/lib/queue-data'
import { getDefaultBranchData, getAllActiveProcedures } from '@/lib/branch-data'
import { useQueue } from '@/lib/queue-context'
import PhoneInput from '@/components/ui/PhoneInput'

export default function BookingPage() {
  const searchParams = useSearchParams()
  const urlClinicType = searchParams.get('clinic') as ClinicType | null
  const { queue, setQueue } = useQueue()

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
      // Fallback: try shared key
      const sharedSaved = localStorage.getItem('clinic-branch-data')
      if (sharedSaved) {
        try {
          const parsed = JSON.parse(sharedSaved)
          if (parsed && parsed.branches && parsed.branches.length > 0) {
            return parsed as ReturnType<typeof getDefaultBranchData>
          }
        } catch {}
      }
    }
    return getDefaultBranchData(clinicType)
  }, [clinicId, clinicType])

  const [submitted, setSubmitted] = useState(false)

  // Form state
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [selectedBranch, setSelectedBranch] = useState('')
  const [selectedProcedure, setSelectedProcedure] = useState('')
  // Auto-calculate booking time: current time + 30 minutes
  const getBookingTime = () => {
    const now = new Date()
    now.setMinutes(now.getMinutes() + 30)
    return `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`
  }
  const preferredTime = getBookingTime()
  const [submittedNumber, setSubmittedNumber] = useState('')

  // Get procedures for selected branch
  const branchProcedures = useMemo(() => {
    if (!selectedBranch) return []
    const branch = branchData.branches.find(b => b.id === selectedBranch)
    return branch?.procedures || []
  }, [selectedBranch, branchData])

  // Generate queue number
  const generateQueueNumber = () => {
    const prefix = clinicCfg.prefix
    const count = queue.length + 1
    return `${prefix}${String(count).padStart(3, '0')}`
  }

  // Submit booking
  const handleSubmit = () => {
    if (!name.trim() || phone.length !== 10 || !selectedProcedure) return

    const number = generateQueueNumber()
    const now = new Date()
    const timeStr = now.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })
    const procName = branchProcedures.find(p => p.id === selectedProcedure)?.name || ''

    const newQueueItem = {
      id: `booking-${Date.now()}`,
      number,
      patientName: name.trim(),
      phone: phone.trim(),
      procedure: procName,
      procedureId: selectedProcedure,
      branchId: selectedBranch,
      bookingMode: 'remote' as const,
      assignedRoom: 0,
      assignedDoctor: '',
      status: 'waiting' as const,
      time: getBookingTime(), // Auto: now + 30 minutes
      bookedAt: timeStr,
      arrivalTime: '',
      arrived: false,
      arrivedAt: undefined,
    }

    setQueue(prev => [...prev, newQueueItem])
    setSubmittedNumber(number)
    setSubmitted(true)
  }

  const accentColor = clinicCfg.color

  // ═══ Submitted ═══
  if (submitted) {
    const trackUrl = `${typeof window !== 'undefined' ? window.location.origin : ''}/track?id=${submittedNumber}`
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
            <p className="text-sm text-blue-700 font-medium">คุณได้จองคิวนัดหมายไว้เวลา</p>
            <p className="text-4xl font-black mt-1" style={{ color: accentColor }}>{getBookingTime()} น.</p>
            <p className="text-xs text-blue-600 mt-2">⏱️ เวลานี้คือเวลาปัจจุบัน + 30 นาที</p>
          </div>

          {/* Instructions */}
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 mb-4 text-left">
            <p className="text-sm font-bold text-amber-700 mb-2">📋 สิ่งที่ต้องทำเมื่อมาถึงคลินิก</p>
            <ol className="text-sm text-amber-600 space-y-1.5 list-decimal list-inside">
              <li>มาถึงคลินิก <b>ก่อนเวลา {getBookingTime()}</b> อย่างน้อย 10 นาที</li>
              <li>แจ้งที่หน้าเคานเตอร์ว่า <b>"จองคิวออนไลน์"</b></li>
              <li>แสดงหมายเลขคิว <b>{submittedNumber}</b> แก่เจ้าหน้าที่</li>
            </ol>
          </div>

          {/* Auto-cancel warning */}
          <p className="text-[11px] text-orange-500 mb-4">⚠️ หากมาไม่ถึงคลินิกก่อนเวลา {(() => {
            const [h, m] = getBookingTime().split(':').map(Number)
            const cancelM = m + 15
            const cancelH = h + Math.floor(cancelM / 60)
            return `${cancelH.toString().padStart(2, '0')}:${(cancelM % 60).toString().padStart(2, '0')}`
          })()} น. คิวจะถูกยกเลิกอัตโนมัติ</p>

          {/* Queue Number */}
          <div className="py-6 rounded-2xl mb-4" style={{ backgroundColor: `${accentColor}08` }}>
            <p className="text-xs text-gray-500 mb-1">หมายเลขคิวของคุณ</p>
            <p className="text-5xl font-black font-mono tabular-nums" style={{ color: accentColor }}>
              {submittedNumber}
            </p>
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
              <span className="text-gray-500">เบอร์โทร</span>
              <span className="font-medium text-gray-900">{phone}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">หัตถการ</span>
              <span className="font-medium text-gray-900">{branchProcedures.find(p => p.id === selectedProcedure)?.name}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">เวลานัดหมาย</span>
              <span className="font-bold" style={{ color: accentColor }}>{getBookingTime()} น.</span>
            </div>
          </div>

          <button
            onClick={() => {
              setSubmitted(false)
              setName('')
              setPhone('')
              setSelectedBranch('')
              setSelectedProcedure('')
            }}
            className="mt-4 w-full py-3 rounded-2xl font-bold text-sm text-white transition-all hover:shadow-lg active:scale-[0.98]"
            style={{ backgroundColor: accentColor }}
          >
            📱 จองคิวใหม่
          </button>
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
            <p className="text-xs text-gray-500">กรอกข้อมูลด้านล่างเพื่อจองคิวล่วงหน้า เจ้าหน้าที่จะยืนยันนัดหมายทางโทรศัพท์</p>
          </div>
        </div>

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

          {/* Auto-calculated booking time */}
          <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4">
            <p className="text-xs font-semibold text-blue-700 mb-1">
              <Clock className="w-3.5 h-3.5 inline mr-1" /> เวลานัดหมายของคุณ
            </p>
            <p className="text-2xl font-black text-blue-800">{getBookingTime()} น.</p>
            <p className="text-[11px] text-blue-500 mt-1">⏱️ ระบบจะนัดเวลาปัจจุบัน + 30 นาที</p>
          </div>

          {/* Submit */}
          <button
            onClick={handleSubmit}
            disabled={!name.trim() || phone.length !== 10 || !selectedProcedure}
            className={clsx(
              'w-full py-3.5 rounded-2xl font-bold text-sm transition-all',
              name.trim() && phone.length === 10 && selectedProcedure
                ? 'text-white shadow-lg hover:shadow-xl active:scale-[0.98]'
                : 'bg-gray-100 text-gray-400 cursor-not-allowed'
            )}
            style={name.trim() && phone.length === 10 && selectedProcedure ? { backgroundColor: accentColor } : {}}
          >
            📱 จองคิวออนไลน์
          </button>
        </div>

        {/* Footer */}
        <p className="text-center text-[11px] text-gray-400">{clinicDisplayName} — Clinic-Q</p>
      </div>
    </div>
  )
}
