'use client'

import { useState, useMemo, useEffect } from 'react'
import {
  ChevronLeft, User, Phone,
  CheckCircle, MapPin, AlertTriangle,
  Navigation, Building2, Search,
} from 'lucide-react'
import { clsx } from 'clsx'
import { useClinic } from '@/lib/clinic-context'
import PhoneInput from '@/components/ui/PhoneInput'
import { useSchedule } from '@/lib/schedule-context'
import { useQueue } from '@/lib/queue-context'
import Toast from '@/components/ui/Toast'

import {
  getDefaultBranchData, getAllActiveProcedures, type Practitioner, type ClinicBranchData,
  findRoomForProcedure, getPractitionerName,
  type Branch,
} from '@/lib/branch-data'
import { checkDistance, CLINIC_LOCATION } from '@/lib/booking-data'

type BookingStep = 'location' | 'select-doctor' | 'fill-info' | 'done'
type LocationStatus = 'checking' | 'near' | 'far' | 'error' | 'denied'

const roomColors = ['#93C5FD', '#A7F3D0', '#FCD34D', '#FDA4AF', '#D8B4FE']

export default function PatientBooking() {
  const { config, currentClinic } = useClinic()
  // Load branch data from clinic-specific storage, fallback to defaults
  const branchData: ClinicBranchData = useMemo(() => {
    if (typeof window !== 'undefined') {
      const clinics = JSON.parse(localStorage.getItem('clinicq-clinics') || '[]')
      const clinic = clinics.find((c: any) => c.type === currentClinic)
      const clinicId = clinic?.id
      if (clinicId) {
        // Try clinic-specific storage first
        const saved = localStorage.getItem(`clinic-branch-data-${clinicId}`)
        if (saved) {
          try {
            const parsed = JSON.parse(saved)
            if (parsed && parsed.branches && parsed.branches.length > 0) {
              return parsed as ClinicBranchData
            }
          } catch {}
        }

      }
    }
    return getDefaultBranchData(currentClinic || 'dental')
  }, [currentClinic])
  const allProcedures = useMemo(() => getAllActiveProcedures(branchData), [branchData])
  const { assignments, staff } = useSchedule()
  const { queue, setQueue } = useQueue()

  // Location state
  const [locationStatus, setLocationStatus] = useState<LocationStatus>('checking')
  const [distance, setDistance] = useState<number | null>(null)

  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null)
  const [step, setStep] = useState<BookingStep>('location')
  const [selectedBranchId, setSelectedBranchId] = useState<string | null>(null)
  const [selectedStaffId, setSelectedStaffId] = useState<string | null>(null)

  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [procedure, setProcedure] = useState('')
  const [selectedDoctorId, setSelectedDoctorId] = useState<string>('') // optional doctor
  const [result, setResult] = useState<{ number: string; doctor: string; time: string; date: string } | null>(null)

  // Get max distance from settings
  const maxDistance = useMemo(() => {
    if (typeof window !== 'undefined') {
      return parseInt(localStorage.getItem('clinic-booking-distance') || '500')
    }
    return 500
  }, [])

  // Check geolocation on mount
  useEffect(() => {
    if (!navigator.geolocation) {
      setLocationStatus('error')
      return
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const d = checkDistance(
          pos.coords.latitude, pos.coords.longitude,
          CLINIC_LOCATION.lat, CLINIC_LOCATION.lng
        )
        setDistance(Math.round(d))
        setLocationStatus(d <= maxDistance ? 'near' : 'far')
      },
      () => {
        setLocationStatus('denied')
      },
      { enableHighAccuracy: true, timeout: 10000 }
    )
  }, [maxDistance])

  // Find current clinic ID
  const currentClinicObj = useMemo(() => {
    if (typeof window === 'undefined') return null
    const clinics = JSON.parse(localStorage.getItem('clinicq-clinics') || '[]')
    return clinics.find((c: any) => c.type === (currentClinic || 'dental')) || null
  }, [currentClinic])
  const clinicId = currentClinicObj?.id
  
  // Clinic-specific keys
  const dailyRoomKey = clinicId ? `clinic-daily-rooms-${clinicId}` : 'clinic-daily-rooms'
  const dailyDateKey = clinicId ? `clinic-daily-rooms-date-${clinicId}` : 'clinic-daily-rooms-date'

  // Load practitioners from localStorage (filtered by current clinic)
  const clinicPractitioners = useMemo(() => {
    if (typeof window !== 'undefined' && clinicId) {
      const result: Practitioner[] = []
      const seenIds = new Set<string>()

      // 1. Try clinicq-users-with-roles (UserManagement storage)
      const usersKey = `clinicq-users-with-roles-${clinicId}`
      const usersSaved = localStorage.getItem(usersKey)
      if (usersSaved) {
        try {
          const parsed = JSON.parse(usersSaved)
          if (Array.isArray(parsed)) {
            parsed.filter((u: any) =>
              (u.isActive !== false) &&
              (u.roles?.includes('practitioner') || u.role === 'practitioner')
            ).forEach((u: any) => {
              if (!seenIds.has(u.id)) {
                seenIds.add(u.id)
                result.push({
                  id: u.id,
                  name: u.name,
                  phone: u.phone || '',
                  branchId: u.branchIds?.[0] || '',
                  active: u.isActive !== false,
                  userId: u.id,
                  clinicId: clinicId,
                } as Practitioner)
              }
            })
          }
        } catch {}
      }

      // 2. Try clinic-practitioners storage
      const storageKey = `clinic-practitioners-${clinicId}`
      const saved = localStorage.getItem(storageKey)
      if (saved) {
        try {
          const parsed = JSON.parse(saved)
          if (Array.isArray(parsed)) {
            parsed.filter((p: any) => p.active && p.clinicId === clinicId).forEach((p: any) => {
              if (!seenIds.has(p.id)) {
                seenIds.add(p.id)
                result.push(p as Practitioner)
              }
            })
          }
        } catch {}
      }

      // 3. Fallback: shared key
      const sharedSaved = localStorage.getItem('clinic-practitioners')
      if (sharedSaved) {
        try {
          const parsed = JSON.parse(sharedSaved)
          if (Array.isArray(parsed)) {
            parsed.filter((p: any) => p.clinicId === clinicId && p.active).forEach((p: any) => {
              if (!seenIds.has(p.id)) {
                seenIds.add(p.id)
                result.push(p as Practitioner)
              }
            })
          }
        } catch {}
      }

      return result
    }
    return []
  }, [clinicId])

  // Get today's daily rooms from localStorage
  const dailyRooms = useMemo(() => {
    if (typeof window === 'undefined') return []
    const saved = localStorage.getItem(dailyRoomKey)
    const savedDate = localStorage.getItem(dailyDateKey)
    const today = new Date().toISOString().split('T')[0]
    if (savedDate !== today || !saved) return []
    try {
      const parsed = JSON.parse(saved)
      return Array.isArray(parsed) ? parsed.filter((r: any) => r.active) : []
    } catch { return [] }
  }, [dailyRoomKey, dailyDateKey])

  // Active branches = branches that have at least one daily room today
  const activeBranches = useMemo(() => {
    // If daily rooms exist, filter by them; otherwise fallback to practitioners
    if (dailyRooms.length > 0) {
      const roomBranchIds = new Set(dailyRooms.filter((r: any) => r.branchId).map((r: any) => r.branchId))
      return branchData.branches
        .filter(b => b.active && roomBranchIds.has(b.id))
        .map(b => ({
          ...b,
          activeProcedures: b.procedures.filter(p => p.active),
          practitioners: clinicPractitioners.filter(p => p.branchId === b.id && p.active),
        }))
    }
    // Fallback: filter by practitioners
    return branchData.branches
      .filter(b => b.active)
      .filter(b => clinicPractitioners.some(p => p.branchId === b.id && p.active))
      .map(b => ({
        ...b,
        activeProcedures: b.procedures.filter(p => p.active),
        practitioners: clinicPractitioners.filter(p => p.branchId === b.id && p.active),
      }))
  }, [branchData, clinicPractitioners, dailyRooms])

  // Available staff for selected branch (filtered by daily rooms)
  const availableStaff = useMemo(() => {
    let pool = staff.filter(s => s.active)
    if (selectedBranchId) {
      pool = pool.filter(s => s.branchId === selectedBranchId)
    }
    // If daily rooms exist, only show staff assigned to today's rooms
    if (dailyRooms.length > 0) {
      const roomStaffNames = new Set(dailyRooms.filter((r: any) => r.practitionerName).map((r: any) => r.practitionerName))
      pool = pool.filter(s => roomStaffNames.has(s.name))
    }
    return pool
  }, [staff, selectedBranchId, dailyRooms])

  // Branch procedures for procedure selection (filtered by daily rooms)
  const branchProcedures = useMemo(() => {
    if (!selectedBranchId) return []
    const branch = branchData.branches.find(b => b.id === selectedBranchId)
    const procs = branch?.procedures.filter(p => p.active) || []
    // If daily rooms exist, only show procedures that belong to today's open branches
    if (dailyRooms.length > 0) {
      const roomBranchIds = new Set(dailyRooms.filter((r: any) => r.branchId).map((r: any) => r.branchId))
      if (!roomBranchIds.has(selectedBranchId)) return []
    }
    return procs
  }, [branchData, selectedBranchId, dailyRooms])

  const selectedStaff = staff.find(s => s.id === selectedStaffId)
  const selectedBranch = branchData.branches.find(b => b.id === selectedBranchId)

  // Available doctors from daily rooms (filtered by selected branch)
  const availableDoctors = useMemo(() => {
    if (dailyRooms.length === 0) return []
    const seen = new Set<string>()
    const doctors: { id: string; name: string; branchId: string; roomName: string; roomId: number }[] = []
    dailyRooms.forEach((r: any) => {
      if (r.practitionerName && !seen.has(r.practitionerName)) {
        seen.add(r.practitionerName)
        doctors.push({
          id: r.practitionerId || r.practitionerName,
          name: r.practitionerName,
          branchId: r.branchId || '',
          roomName: r.name || `ห้อง ${r.id}`,
          roomId: r.id,
        })
      }
    })
    // Filter by selected branch if one is chosen
    if (selectedBranchId) {
      return doctors.filter(d => d.branchId === selectedBranchId)
    }
    return doctors
  }, [dailyRooms, selectedBranchId])



  // Auto-calculate booking time: 30 minutes from now
  const getBookingTime = () => {
    const now = new Date()
    now.setMinutes(now.getMinutes() + 30)
    return `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`
  }

  // Get selected doctor's room working hours
  const selectedDoctorRoom = useMemo(() => {
    if (!selectedDoctorId) return null
    return dailyRooms.find((r: any) =>
      (r.practitionerId || r.practitionerName) === selectedDoctorId
    ) || null
  }, [selectedDoctorId, dailyRooms])

  // Check if booking time exceeds room working hours
  const checkBookingValid = () => {
    const bookingTime = getBookingTime()
    const [bh, bm] = bookingTime.split(':').map(Number)
    const bookingMinutes = bh * 60 + bm

    // Get procedure duration
    const proc = branchProcedures.find(p => p.id === procedure)
    const duration = proc?.estimatedDuration || 30
    const endTimeMinutes = bookingMinutes + duration

    // Check against doctor's room working hours
    if (selectedDoctorRoom) {
      const closeTime = (selectedDoctorRoom as any).workingEndTime || '17:00'
      const [ch, cm] = closeTime.split(':').map(Number)
      const closeMinutes = ch * 60 + cm

      if (endTimeMinutes > closeMinutes) {
        return {
          valid: false,
          message: `หัตถการจะเสร็จประมาณ ${Math.floor(endTimeMinutes / 60).toString().padStart(2, '0')}:${(endTimeMinutes % 60).toString().padStart(2, '0')} น. ซึ่งเกินเวลาปิดทำการ (${closeTime} น.) ของห้องตรวจ`
        }
      }
    }

    return { valid: true, message: '' }
  }

  const [showTimeWarning, setShowTimeWarning] = useState(false)
  const [timeWarningMsg, setTimeWarningMsg] = useState('')

  const handleConfirm = () => {
    if (!name || phone.length !== 10 || !procedure) {
      setToast({ message: 'กรุณากรอกข้อมูลให้ครบทุกช่อง (เบอร์โทร 10 หลัก)', type: 'error' })
      setTimeout(() => setToast(null), 3000)
      return
    }

    // Check if booking time exceeds room working hours
    const validation = checkBookingValid()
    if (!validation.valid) {
      setTimeWarningMsg(validation.message)
      setShowTimeWarning(true)
      return
    }

    const proc = branchProcedures.find(p => p.id === procedure)
    const timeStr = getBookingTime() // Auto: 30 min from now
    const today = new Date().toISOString().split('T')[0]
    const queueNumber = `${config?.prefix || 'E'}${String(Math.floor(Math.random() * 900) + 100).slice(0, 3)}`

    // Find selected doctor's room from daily rooms
    const selectedDoc = availableDoctors.find(d => d.id === selectedDoctorId)
    const assignedRoom = selectedDoc ? selectedDoc.roomId : 0
    const assignedDoctor = selectedDoc ? selectedDoc.name : (selectedStaff?.name || '')

    const newQueue = {
      id: String(Date.now()),
      number: queueNumber,
      patientName: name,
      phone,
      procedure: proc?.name || '',
      procedureId: procedure,
      branchId: selectedDoc?.branchId || selectedStaff?.branchId || '',
      bookingMode: 'remote' as const,
      assignedRoom,
      assignedDoctor,
      status: 'waiting' as const,
      time: timeStr,
      bookedTimeSlot: timeStr,
      bookedAt: today,
      arrivalTime: '',
      arrived: false,
      // Auto-cancel: if not arrived by booking time + 15 min, cancel
      autoCancelAt: (() => {
        const [h, m] = timeStr.split(':').map(Number)
        const cancelTime = new Date()
        cancelTime.setHours(h, m + 15, 0, 0)
        return cancelTime.getTime()
      })(),
    }

    setQueue(prev => [...prev, newQueue])
    setResult({ number: queueNumber, doctor: selectedStaff?.name || '', time: timeStr, date: today })
    setStep('done')
  }

  const resetAll = () => {
    setStep('select-doctor')
    setSelectedBranchId(null)
    setSelectedStaffId(null)
    setSelectedDoctorId('')
    setName('')
    setPhone('')
    setProcedure('')
    setResult(null)
  }

  if (!config) return null

  // Steps for indicator (excluding location)
  const bookingSteps = [
    { key: 'select-doctor', label: 'เลือกแพทย์' },
    { key: 'fill-info', label: 'กรอกข้อมูล' },
  ]

  return (
    <div className="min-h-screen bg-gray-50">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      {/* Header */}
      <div className="bg-white border-b border-gray-200 py-6 px-4">
        <div className="max-w-2xl mx-auto text-center">
          <div className="w-12 h-12 rounded-xl mx-auto mb-3 flex items-center justify-center text-white font-bold text-lg" style={{ backgroundColor: config.color }}>
            {config.prefix}
          </div>
          <h1 className="text-xl font-bold text-gray-900">จองคิวออนไลน์</h1>
          <p className="text-sm text-gray-500 mt-1">{config.name}</p>
        </div>
      </div>

      <div className="max-w-2xl mx-auto p-4 space-y-4">

        {/* ═══════ LOCATION CHECK ═══════ */}
        {step === 'location' && (
          <div className="bg-white rounded-xl border border-gray-200 p-8 text-center space-y-6">
            <div className="w-20 h-20 rounded-full bg-blue-50 flex items-center justify-center mx-auto">
              <MapPin className="w-10 h-10 text-blue-500" />
            </div>

            {locationStatus === 'checking' && (
              <div className="space-y-4">
                <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto" />
                <div>
                  <h2 className="text-lg font-bold text-gray-900">ตรวจสอบตำแหน่ง...</h2>
                  <p className="text-sm text-gray-500 mt-1">กรุณาอนุญาตให้เข้าถึงตำแหน่ง GPS</p>
                </div>
              </div>
            )}

            {locationStatus === 'near' && (
              <div className="space-y-4">
                <CheckCircle className="w-16 h-16 text-green-500 mx-auto" />
                <div>
                  <h2 className="text-xl font-bold text-green-700">อยู่ใกล้คลินิก</h2>
                  <p className="text-gray-600 mt-1">ระยะทาง ~{distance} เมตร (ไม่เกิน {maxDistance} เมตร)</p>
                </div>
                <button
                  onClick={() => setStep('select-doctor')}
                  className="w-full py-4 rounded-xl text-white font-bold text-lg shadow-md hover:shadow-lg transition-all"
                  style={{ backgroundColor: config.color }}
                >
                  เลือกแพทย์และจองคิว
                </button>
              </div>
            )}

            {locationStatus === 'far' && (
              <div className="space-y-4">
                <AlertTriangle className="w-16 h-16 text-red-400 mx-auto" />
                <div>
                  <h2 className="text-xl font-bold text-red-700">อยู่ไกลเกินไป</h2>
                  <p className="text-gray-600 mt-1">ระยะทาง ~{distance} เมตร (เกิน {maxDistance} เมตร)</p>
                </div>
                <div className="p-4 bg-red-50 rounded-xl text-left">
                  <p className="text-sm text-red-700">
                    คุณต้องอยู่ใกล้คลินิกไม่เกิน <strong>{maxDistance} เมตร</strong> เพื่อจองคิวออนไลน์
                  </p>
                  <p className="text-sm text-red-600 mt-2">
                    กรุณาเดินทางมาที่คลินิก หรือโทรจองคิวแทน
                  </p>
                </div>
              </div>
            )}

            {(locationStatus === 'error' || locationStatus === 'denied') && (
              <div className="space-y-4">
                <Navigation className="w-16 h-16 text-yellow-400 mx-auto" />
                <div>
                  <h2 className="text-xl font-bold text-yellow-700">เปิดใช้งาน GPS</h2>
                  <p className="text-gray-600 mt-1">กรุณาเปิด GPS บนมือถือของคุณ แล้วลองใหม่</p>
                </div>
                <button
                  onClick={() => window.location.reload()}
                  className="w-full py-4 rounded-xl bg-gray-800 text-white font-bold text-lg"
                >
                  ลองใหม่
                </button>
              </div>
            )}
          </div>
        )}

        {/* ═══════ Step Indicator (after location) ═══════ */}
        {step !== 'location' && step !== 'done' && (
          <div className="flex items-center justify-center gap-2 text-xs">
            {bookingSteps.map((s, i) => {
              const stepOrder = ['select-doctor', 'fill-info']
              const currentIdx = stepOrder.indexOf(step)
              return (
                <div key={s.key} className="flex items-center gap-2">
                  <div className={clsx(
                    'w-6 h-6 rounded-full flex items-center justify-center font-bold text-[10px]',
                    step === s.key ? 'text-white' : i < currentIdx ? 'bg-green-100 text-green-600' : 'bg-gray-200 text-gray-500'
                  )} style={step === s.key ? { backgroundColor: config.color } : {}}>
                    {i < currentIdx ? '✓' : i + 1}
                  </div>
                  <span className={clsx(step === s.key ? 'font-medium text-gray-900' : 'text-gray-400')}>{s.label}</span>
                  {i < 2 && <span className="text-gray-300">→</span>}
                </div>
              )
            })}
          </div>
        )}

        {/* ═══════ STEP 1: Select Branch ═══════ */}
        {step === 'select-doctor' && (
          <>
          {/* No daily rooms warning */}
          {dailyRooms.length === 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
              <p className="text-sm font-bold text-amber-700">⚠️ ยังไม่ได้ตั้งค่าห้องตรวจวันนี้</p>
              <p className="text-xs text-amber-600 mt-1">กรุณาติดต่อเจ้าหน้าที่เพื่อตั้งค่าห้องตรวจก่อนจองคิว</p>
            </div>
          )}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h2 className="text-sm font-bold text-gray-900 mb-1">🏢 เลือกสาขา</h2>
            <p className="text-[11px] text-gray-500 mb-4">เลือกสาขาที่ต้องการจองคิว</p>

            {selectedBranchId === null ? (
              <div className="space-y-2">
                {activeBranches.map(branch => (
                  <button
                    key={branch.id}
                    onClick={() => setSelectedBranchId(branch.id)}
                    className="w-full p-4 rounded-xl border border-gray-100 hover:border-gray-300 hover:shadow-sm transition-all text-left"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                        style={{ backgroundColor: `${config.color}15` }}>
                        <Building2 className="w-5 h-5" style={{ color: config.color }} />
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-bold text-gray-900">{branch.name}</p>
                        <p className="text-[11px] text-gray-500">
                          {branch.practitioners.length} ผู้ทำหัตถการ • {branch.activeProcedures.length} หัตถการ
                        </p>
                        <div className="flex flex-wrap gap-1 mt-1.5">
                          {branch.practitioners.map(p => (
                            <span key={p.id} className="text-[10px] px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-600">
                              👨‍⚕️ {p.name.split(' ').slice(0, 2).join(' ')}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              <div>
                <button
                  onClick={() => { setSelectedBranchId(null); setSelectedStaffId(null) }}
                  className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700 mb-3"
                >
                  <ChevronLeft className="w-3 h-3" /> เปลี่ยนสาขา
                </button>
                <p className="text-xs font-medium text-gray-700 mb-3">
                  สาขา: <span className="font-bold">{selectedBranch?.name}</span>
                </p>
                <div className="space-y-2">
                  {availableStaff.map((s, i) => {
                    const branch = branchData.branches.find(b => b.id === s.branchId)
                    const branchInfo = activeBranches.find(b => b.id === s.branchId)
                    return (
                      <button
                        key={s.id}
                        onClick={() => {
                          setSelectedStaffId(s.id)
                          setStep('fill-info')
                        }}
                        className="w-full flex items-center gap-3 p-4 rounded-xl border border-gray-100 hover:border-gray-300 hover:shadow-sm transition-all text-left"
                      >
                        <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                          style={{ backgroundColor: roomColors[i % roomColors.length] }}>
                          {s.name.split(' ')[0].charAt(0)}{s.name.split(' ')[1]?.charAt(0)}
                        </div>
                        <div className="flex-1">
                          <p className="text-sm font-medium text-gray-900">{s.name}</p>
                          <p className="text-[11px] text-gray-500">
                            {branch?.name} • {s.startTime}-{s.endTime}
                          </p>
                        </div>
                        <div className="text-gray-300">
                          <ChevronLeft className="w-4 h-4 rotate-180" />
                        </div>
                      </button>
                    )
                  })}
                  {availableStaff.length === 0 && (
                    <p className="text-sm text-gray-400 text-center py-4">ไม่มีผู้ทำหัตถการในสาขานี้</p>
                  )}
                </div>
              </div>
            )}
          </div>
          </>
        )}



        {/* ═══════ STEP 3: Fill Info ═══════ */}
        {step === 'fill-info' && (
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="flex items-center gap-3 mb-4">
              <button onClick={() => setStep('select-doctor')} className="p-1.5 rounded-lg hover:bg-gray-100">
                <ChevronLeft className="w-4 h-4 text-gray-500" />
              </button>
              <div>
                <h2 className="text-sm font-bold text-gray-900">กรอกข้อมูลนัดหมาย</h2>
                <p className="text-[11px] text-gray-500">
                  {selectedStaff?.name} • {selectedBranch?.name} • เวลานัด {getBookingTime()} น.
                </p>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">ชื่อ-นามสกุล *</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="กรอกชื่อ-นามสกุล"
                  className="w-full px-3 py-2.5 rounded-lg border border-gray-200 focus:border-primary-400 focus:outline-none text-sm"
                />
              </div>
              <PhoneInput
                label="เบอร์โทรศัพท์"
                value={phone}
                onChange={setPhone}
                required
              />
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">สาขา *</label>
                <div className="px-3 py-2.5 rounded-lg bg-gray-50 border border-gray-200 text-sm text-gray-700">
                  {selectedBranch?.name || '—'}
                </div>
              </div>
              {/* Optional doctor selection */}
              {availableDoctors.length > 0 && (
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">👨‍⚕️ แพทย์ผู้ทำหัตถการ <span className="text-gray-400">(ไม่บังคับ)</span></label>
                  <select
                    value={selectedDoctorId}
                    onChange={(e) => setSelectedDoctorId(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-lg border border-gray-200 focus:border-primary-400 focus:outline-none text-sm"
                  >
                    <option value="">— ไม่ระบุแพทย์ —</option>
                    {availableDoctors.map(d => (
                      <option key={d.id} value={d.id}>{d.name} ({d.roomName})</option>
                    ))}
                  </select>
                </div>
              )}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">หัตถการที่ต้องการ *</label>
                <select
                  value={procedure}
                  onChange={(e) => setProcedure(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-lg border border-gray-200 focus:border-primary-400 focus:outline-none text-sm"
                >
                  <option value="">— เลือกหัตถการ —</option>
                  {branchProcedures.map(p => (
                    <option key={p.id} value={p.id}>{p.name} ({p.estimatedDuration} น.)</option>
                  ))}
                </select>
              </div>

              {/* Booking time preview */}
              {(() => {
                const bookingTime = getBookingTime()
                const [bh, bm] = bookingTime.split(':').map(Number)
                const bookingMinutes = bh * 60 + bm
                const proc = branchProcedures.find(p => p.id === procedure)
                const duration = proc?.estimatedDuration || 30
                const endMinutes = bookingMinutes + duration
                let closeMinutes = 17 * 60 // default 17:00
                if (selectedDoctorRoom) {
                  const closeTime = (selectedDoctorRoom as any).workingEndTime || '17:00'
                  const [ch, cm] = closeTime.split(':').map(Number)
                  closeMinutes = ch * 60 + cm
                }
                const minsLeft = closeMinutes - endMinutes
                const isWarning = minsLeft < 30 && minsLeft >= 0
                const isExceeded = minsLeft < 0
                return (
                  <div className={`rounded-xl p-3 border ${isExceeded ? 'bg-red-50 border-red-200' : isWarning ? 'bg-orange-50 border-orange-200' : 'bg-blue-50 border-blue-200'}`}>
                    <p className={`text-xs font-medium ${isExceeded ? 'text-red-600' : isWarning ? 'text-orange-600' : 'text-blue-600'}`}>🕐 เวลานัดหมายของคุณ</p>
                    <p className={`text-lg font-black mt-1 ${isExceeded ? 'text-red-700' : isWarning ? 'text-orange-700' : 'text-blue-700'}`}>{bookingTime} น.</p>
                    <p className={`text-[10px] mt-1 ${isExceeded ? 'text-red-500' : isWarning ? 'text-orange-500' : 'text-blue-500'}`}>
                      (เวลาปัจจุบัน + 30 นาที)
                    </p>
                    {isWarning && !isExceeded && (
                      <p className="text-[10px] text-orange-600 mt-1 font-medium">⚠️ เหลือเวลาทำงานอีก ~{minsLeft} นาที</p>
                    )}
                    {isExceeded && (
                      <p className="text-[10px] text-red-600 mt-1 font-medium">❌ เกินเวลาปิดทำการของห้องตรวจ</p>
                    )}
                  </div>
                )
              })()}

              <button
                onClick={handleConfirm}
                disabled={!name || phone.length !== 10 || !procedure}
                className={clsx(
                  'w-full py-3 rounded-xl font-bold text-sm shadow-md transition-all',
                  name && phone.length === 10 && procedure
                    ? 'text-white hover:shadow-lg'
                    : 'bg-gray-100 text-gray-300 cursor-not-allowed'
                )}
                style={name && phone.length === 10 && procedure ? { backgroundColor: config.color } : {}}
              >
                ✅ ยืนยันนัดหมาย
              </button>
            </div>
          </div>
        )}

        {/* ═══════ STEP 4: Done ═══════ */}
        {step === 'done' && result && (
          <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
            <div className="w-16 h-16 rounded-full mx-auto mb-4 flex items-center justify-center bg-green-100">
              <CheckCircle className="w-8 h-8 text-green-500" />
            </div>
            <h2 className="text-lg font-bold text-gray-900 mb-2">✅ จองคิวสำเร็จ!</h2>
            
            {/* Booking time highlight */}
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-4">
              <p className="text-sm text-blue-700 font-medium">คุณได้จองคิวนัดหมายไว้เวลา</p>
              <p className="text-3xl font-black mt-1" style={{ color: config.color }}>{result.time} น.</p>
              <p className="text-xs text-blue-600 mt-2">📅 {result.date}</p>
            </div>

            {/* Counter check-in instruction */}
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-4">
              <p className="text-sm font-bold text-amber-700">📋 เมื่อมาถึงคลินิก</p>
              <p className="text-sm text-amber-600 mt-1">กรุณาแจ้งที่หน้าเคานเตอร์เพื่อเช็คอิน</p>
              <p className="text-xs text-amber-500 mt-1">แสดงหมายเลขคิว <strong>{result.number}</strong> แก่เจ้าหน้าที่</p>
            </div>

            {/* Auto-cancel warning */}
            <p className="text-xs text-orange-500 mb-4">⚠️ หากมาไม่ถึงคลินิกก่อนเวลา {(() => {
              const [h, m] = result.time.split(':').map(Number)
              const cancelH = h + Math.floor((m + 15) / 60)
              const cancelM = (m + 15) % 60
              return `${cancelH.toString().padStart(2, '0')}:${cancelM.toString().padStart(2, '0')}`
            })()} น. คิวจะถูกยกเลิกอัตโนมัติ</p>

            <div className="bg-gray-50 rounded-xl p-4 text-left space-y-3">
              <div className="flex justify-between">
                <span className="text-xs text-gray-500">หมายเลขคิว</span>
                <span className="text-sm font-bold" style={{ color: config.color }}>{result.number}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-xs text-gray-500">สาขา</span>
                <span className="text-sm font-medium text-gray-900">{selectedBranch?.name}</span>
              </div>
              {result.doctor && (
                <div className="flex justify-between">
                  <span className="text-xs text-gray-500">แพทย์ผู้นัด</span>
                  <span className="text-sm font-medium text-gray-900">{result.doctor}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-xs text-gray-500">วันนัด</span>
                <span className="text-sm font-medium text-gray-900">{result.date}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-xs text-gray-500">เวลานัด</span>
                <span className="text-sm font-bold text-gray-900">{result.time} น.</span>
              </div>
            </div>

            <button
              onClick={resetAll}
              className="mt-6 px-6 py-2.5 rounded-xl text-sm font-medium border border-gray-200 hover:bg-gray-50 transition-colors"
            >
              นัดหมายใหม่
            </button>
          </div>
        )}
      </div>

      {/* Time Warning Popup */}
      {showTimeWarning && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 animate-scale-in">
            <div className="text-center">
              <div className="w-14 h-14 rounded-full bg-orange-100 flex items-center justify-center mx-auto mb-4">
                <span className="text-3xl">⏰</span>
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-2">เวลาไม่เพียงพอ</h3>
              <p className="text-sm text-gray-600 mb-4">{timeWarningMsg}</p>
              {selectedDoctorRoom && (
                <div className="bg-gray-50 rounded-xl p-3 mb-4 text-left">
                  <p className="text-xs text-gray-500">เวลาทำการของห้องตรวจ</p>
                  <p className="text-sm font-bold text-gray-900">
                    {(selectedDoctorRoom as any).workingStartTime || '09:00'} - {(selectedDoctorRoom as any).workingEndTime || '17:00'} น.
                  </p>
                </div>
              )}
              <button
                onClick={() => setShowTimeWarning(false)}
                className="w-full py-3 rounded-xl bg-gray-100 text-gray-700 font-bold text-sm hover:bg-gray-200 transition-colors"
              >
                กลับไปแก้ไข
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
