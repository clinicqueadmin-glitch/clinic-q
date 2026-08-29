'use client'

import { useState, useMemo } from 'react'
import {
  Calendar, Clock, Users, ChevronLeft, ChevronRight,
  MapPin, Stethoscope, AlertTriangle, Plus, X, Phone, User,
  CheckCircle, ArrowLeft, Building2,
} from 'lucide-react'
import { clsx } from 'clsx'
import { useClinic } from '@/lib/clinic-context'
import PhoneInput from '@/components/ui/PhoneInput'
import { useSchedule, type StaffInfo } from '@/lib/schedule-context'
import { useQueue } from '@/lib/queue-context'
import Toast from '@/components/ui/Toast'
import {
  DAY_NAMES_SHORT, DAY_NAMES_FULL, MONTH_NAMES_TH,
  formatDateKey, getThaiYear,
} from '@/lib/schedule-data'
import { getDefaultBranchData, getPractitionerName, getAllActiveProcedures } from '@/lib/branch-data'

const roomColors = ['#93C5FD', '#A7F3D0', '#FCD34D', '#FDA4AF', '#D8B4FE']

type TabMode = 'by-date' | 'by-doctor' | 'today-queue'

export default function AppointmentSchedule() {
  const { config, currentClinic } = useClinic()
  const branchData = useMemo(() => getDefaultBranchData(currentClinic || 'dental'), [currentClinic])
  const activeRooms = useMemo(() => branchData.rooms.filter(r => r.active), [branchData])
  const allProcedures = useMemo(() => getAllActiveProcedures(branchData), [branchData])
  const { assignments, staff, leaves } = useSchedule()
  const { queue, setQueue } = useQueue()

  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null)
  const [activeTab, setActiveTab] = useState<TabMode>('by-date')

  // ─── By Date State ───
  const [selectedDate, setSelectedDate] = useState(formatDateKey(new Date()))
  const [selectedStaffId, setSelectedStaffId] = useState<string | null>(null)
  const [viewWeekStart, setViewWeekStart] = useState(() => {
    const d = new Date()
    d.setDate(d.getDate() - d.getDay() + 1)
    return d
  })

  // ─── By Doctor State ───
  const [bookingStaffId, setBookingStaffId] = useState<string | null>(null)
  const [selectedSlotDate, setSelectedSlotDate] = useState('')
  const [selectedSlotId, setSelectedSlotId] = useState('')
  const [selectedSlotRoomId, setSelectedSlotRoomId] = useState(1)

  // ─── Booking Modal ───
  const [showBookingModal, setShowBookingModal] = useState(false)
  const [bookingName, setBookingName] = useState('')
  const [bookingPhone, setBookingPhone] = useState('')
  const [bookingProcedure, setBookingProcedure] = useState('')

  // ─── Today's Appointment Queue ───
  const todayAppointments = useMemo(() => queue.filter(q => q.bookingMode === 'appointment'), [queue])
  const notArrivedAppointments = useMemo(() => todayAppointments.filter(q => !q.arrived), [todayAppointments])
  const arrivedAppointments = useMemo(() => todayAppointments.filter(q => q.arrived), [todayAppointments])

  const handleMarkArrived = (itemId: string) => {
    const now = new Date()
    const timeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`
    setQueue(prev => prev.map(q => q.id === itemId ? { ...q, arrived: true, arrivedAt: timeStr } : q))
    setToast({ message: 'ยืนยันมาถึงแล้ว', type: 'success' })
    setTimeout(() => setToast(null), 3000)
  }

  const weekDates = useMemo(() => {
    const dates: Date[] = []
    for (let i = 0; i < 7; i++) {
      const d = new Date(viewWeekStart)
      d.setDate(viewWeekStart.getDate() + i)
      dates.push(d)
    }
    return dates
  }, [viewWeekStart])

  // ═══════ BY DATE ═══════

  const assignmentsOnDate = useMemo(() => {
    return assignments.filter(a => a.date === selectedDate)
  }, [assignments, selectedDate])

  const staffOnDate = useMemo(() => {
    const staffMap = new Map<string, {
      staff: StaffInfo
      rooms: Map<number, { roomId: number; roomName: string; slotCount: number; slots: typeof assignments }>
      totalSlots: number
    }>()

    assignmentsOnDate.forEach(a => {
      const staffMember = staff.find(s => s.id === a.staffId)
      if (!staffMember) return

      if (!staffMap.has(a.staffId)) {
        staffMap.set(a.staffId, { staff: staffMember, rooms: new Map(), totalSlots: 0 })
      }
      const staffData = staffMap.get(a.staffId)!
      staffData.totalSlots++

      if (!staffData.rooms.has(a.roomId)) {
        const room = activeRooms.find(r => r.id === a.roomId)
        staffData.rooms.set(a.roomId, { roomId: a.roomId, roomName: room?.name || `ห้อง ${a.roomId}`, slotCount: 0, slots: [] })
      }
      const roomData = staffData.rooms.get(a.roomId)!
      roomData.slotCount++
      roomData.slots.push(a)
    })

    return Array.from(staffMap.values())
  }, [assignmentsOnDate, staff, activeRooms])

  const slotsForStaff = useMemo(() => {
    if (!selectedStaffId) return []
    return assignmentsOnDate
      .filter(a => a.staffId === selectedStaffId)
      .sort((a, b) => {
        const aTime = a.slotId.split('-')[1] || '00:00'
        const bTime = b.slotId.split('-')[1] || '00:00'
        return aTime.localeCompare(bTime)
      })
  }, [assignmentsOnDate, selectedStaffId])

  const slotsByRoom = useMemo(() => {
    const roomMap = new Map<number, typeof slotsForStaff>()
    slotsForStaff.forEach(slot => {
      if (!roomMap.has(slot.roomId)) {
        roomMap.set(slot.roomId, [])
      }
      roomMap.get(slot.roomId)!.push(slot)
    })
    return Array.from(roomMap.entries())
  }, [slotsForStaff])

  // ═══════ BY DOCTOR ═══════

  const availableStaff = useMemo(() => staff.filter(s => s.active), [staff])

  const availableSlotsByDoctor = useMemo(() => {
    if (!bookingStaffId) return []
    const today = new Date()
    const slots: { date: string; dateLabel: string; slotId: string; timeRange: string; roomId: number }[] = []

    for (let i = 0; i < 14; i++) {
      const d = new Date(today)
      d.setDate(today.getDate() + i)
      const dateStr = formatDateKey(d)

      const daySlots = assignments.filter(a =>
        a.date === dateStr && a.staffId === bookingStaffId
      ).sort((a, b) => {
        const aTime = a.slotId.split('-')[1] || '00:00'
        const bTime = b.slotId.split('-')[1] || '00:00'
        return aTime.localeCompare(bTime)
      })

      daySlots.forEach(slot => {
        const timeRange = slot.slotId.replace('slot-', '').replace('-', ' - ')
        const isBooked = queue.some(q => q.status !== 'completed' && q.time && slot.slotId.includes(q.time))
        if (!isBooked) {
          const dayName = DAY_NAMES_SHORT[d.getDay()]
          const monthName = MONTH_NAMES_TH[d.getMonth()]
          slots.push({
            date: dateStr,
            dateLabel: `${dayName} ${d.getDate()} ${monthName}`,
            slotId: slot.slotId,
            timeRange,
            roomId: slot.roomId,
          })
        }
      })
    }

    return slots
  }, [bookingStaffId, assignments, queue])

  const slotsByDate = useMemo(() => {
    const map: Record<string, typeof availableSlotsByDoctor> = {}
    availableSlotsByDoctor.forEach(slot => {
      if (!map[slot.date]) map[slot.date] = []
      map[slot.date].push(slot)
    })
    return map
  }, [availableSlotsByDoctor])

  // ═══════ SHARED ═══════

  const isSlotBooked = (slotId: string) => {
    return queue.some(q => q.status !== 'completed' && q.time && slotId.includes(q.time))
  }

  const navigateWeek = (dir: number) => {
    const d = new Date(viewWeekStart)
    d.setDate(d.getDate() + dir * 7)
    setViewWeekStart(d)
  }

  const isToday = (dateStr: string) => dateStr === formatDateKey(new Date())

  const selectedDateObj = new Date(selectedDate)
  const dateLabel = `${DAY_NAMES_FULL[selectedDateObj.getDay()]}ที่ ${selectedDateObj.getDate()} ${MONTH_NAMES_TH[selectedDateObj.getMonth()]} ${getThaiYear(selectedDateObj)}`

  const selectedStaff = staff.find(s => s.id === (selectedStaffId || bookingStaffId))

  const openBookingModal = (slotId: string, staffId: string, roomId: number, date?: string) => {
    setSelectedSlotId(slotId)
    setBookingStaffId(staffId)
    setSelectedSlotRoomId(roomId)
    if (date) setSelectedSlotDate(date)
    setBookingName('')
    setBookingPhone('')
    setBookingProcedure('')
    setShowBookingModal(true)
  }

  const confirmBooking = () => {
    if (!bookingName || bookingPhone.length !== 10 || !bookingProcedure) {
      setToast({ message: 'กรุณากรอกข้อมูลให้ครบทุกช่อง (เบอร์โทร 10 หลัก)', type: 'error' })
      setTimeout(() => setToast(null), 3000)
      return
    }

    const staffMember = staff.find(s => s.id === bookingStaffId)
    const proc = allProcedures.flatMap(bp => bp.procedures).find(p => p.id === bookingProcedure)
    const timeMatch = selectedSlotId.match(/slot-(\d{2}:\d{2})/)
    const timeStr = timeMatch ? timeMatch[1] : '09:00'

    const newQueue = {
      id: String(Date.now()),
      number: `${config?.prefix || 'E'}${String(Math.floor(Math.random() * 900) + 100).slice(0, 3)}`,
      patientName: bookingName,
      phone: bookingPhone,
      procedure: proc?.name || '',
      procedureId: bookingProcedure,
      branchId: staffMember?.branchId || '',
      bookingMode: 'appointment' as const,
      assignedRoom: selectedSlotRoomId,
      assignedDoctor: staffMember?.name || '',
      status: 'waiting' as const,
      time: timeStr,
      bookedAt: timeStr,
      arrivalTime: timeStr,
      arrived: false,
    }

    setQueue(prev => [...prev, newQueue])
    setShowBookingModal(false)
    setToast({ message: `นัดหมายสำเร็จ — ${bookingName} กับ ${staffMember?.name} เวลา ${timeStr}`, type: 'success' })
    setTimeout(() => setToast(null), 3000)
  }

  if (!config) return null

  return (
    <div className="space-y-5">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      {/* Booking Modal */}
      {showBookingModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between p-5 border-b border-gray-100">
              <div>
                <h2 className="text-lg font-bold text-gray-900">นัดหมายผู้รับบริการ</h2>
                <p className="text-xs text-gray-500">
                  {selectedStaff?.name} • ห้อง {selectedSlotRoomId} • {selectedSlotId.replace('slot-', '').replace('-', ' - ')}
                </p>
              </div>
              <button onClick={() => setShowBookingModal(false)} className="p-2 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5 text-gray-500" /></button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">ชื่อ-นามสกุล *</label>
                <input type="text" value={bookingName} onChange={(e) => setBookingName(e.target.value)} placeholder="กรอกชื่อผู้รับบริการ" className="w-full px-3 py-2.5 rounded-lg border border-gray-200 focus:border-primary-400 focus:outline-none text-sm" />
              </div>
              <PhoneInput
                label="เบอร์โทรศัพท์"
                value={bookingPhone}
                onChange={setBookingPhone}
                required
              />
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">หัตถการที่ต้องการ *</label>
                <select value={bookingProcedure} onChange={(e) => setBookingProcedure(e.target.value)} className="w-full px-3 py-2.5 rounded-lg border border-gray-200 focus:border-primary-400 focus:outline-none text-sm">
                  <option value="">— เลือกหัตถการ —</option>
                  {allProcedures.map(group => (
                    <optgroup key={group.branch.id} label={group.branch.name}>
                      {group.procedures.map(p => (
                        <option key={p.id} value={p.id}>{p.name} ({p.estimatedDuration} น.)</option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex justify-end gap-3 p-5 border-t border-gray-100">
              <button onClick={() => setShowBookingModal(false)} className="px-4 py-2.5 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-100">ยกเลิก</button>
              <button onClick={confirmBooking} className="px-6 py-2.5 rounded-lg text-sm font-bold text-white shadow-md hover:shadow-lg hover:bg-opacity-90" style={{ backgroundColor: config.color }}>
                ยืนยันนัดหมาย
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900">📆 นัดหมาย</h1>
          <p className="text-sm text-gray-500">{config.name}</p>
        </div>
      </div>

      {/* ═══ TABS ═══ */}
      <div className="bg-white rounded-xl border border-gray-200 p-1.5 flex gap-1.5">
        <button
          onClick={() => { setActiveTab('by-date'); setSelectedStaffId(null) }}
          className={clsx(
            'flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all',
            activeTab === 'by-date'
              ? 'text-white shadow-md'
              : 'text-gray-600 hover:bg-gray-50'
          )}
          style={activeTab === 'by-date' ? { backgroundColor: config.color } : {}}
        >
          <Calendar className="w-4 h-4" /> นัดหมายตามวัน
        </button>
        <button
          onClick={() => { setActiveTab('by-doctor'); setBookingStaffId(null) }}
          className={clsx(
            'flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all',
            activeTab === 'by-doctor'
              ? 'text-white shadow-md'
              : 'text-gray-600 hover:bg-gray-50'
          )}
          style={activeTab === 'by-doctor' ? { backgroundColor: config.color } : {}}
        >
          <Users className="w-4 h-4" /> เลือกทันตแพทย์
        </button>
        <button
          onClick={() => setActiveTab('today-queue')}
          className={clsx(
            'flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all',
            activeTab === 'today-queue'
              ? 'text-white shadow-md'
              : 'text-gray-600 hover:bg-gray-50'
          )}
          style={activeTab === 'today-queue' ? { backgroundColor: config.color } : {}}
        >
          <Stethoscope className="w-4 h-4" /> คิวนัดวันนี้
          {notArrivedAppointments.length > 0 && (
            <span className="ml-1 px-1.5 py-0.5 text-[10px] font-bold rounded-full bg-red-100 text-red-600">{notArrivedAppointments.length}</span>
          )}
        </button>
      </div>

      {/* ═══ TAB: BY DATE ═══ */}
      {activeTab === 'by-date' && (
        <>
          {/* Week Navigation */}
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="flex items-center justify-between mb-3">
              <button onClick={() => navigateWeek(-1)} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors">
                <ChevronLeft className="w-4 h-4 text-gray-500" />
              </button>
              <h3 className="text-sm font-bold text-gray-900">
                สัปดาห์ที่ {Math.ceil((viewWeekStart.getDate()) / 7)} — {MONTH_NAMES_TH[viewWeekStart.getMonth()]} {getThaiYear(viewWeekStart)}
              </h3>
              <button onClick={() => navigateWeek(1)} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors">
                <ChevronRight className="w-4 h-4 text-gray-500" />
              </button>
            </div>

            <div className="grid grid-cols-7 gap-1.5">
              {weekDates.map((date, i) => {
                const dateStr = formatDateKey(date)
                const dayStaffCount = new Set(assignments.filter(a => a.date === dateStr).map(a => a.staffId)).size
                const isSelected = dateStr === selectedDate
                const todayFlg = isToday(dateStr)
                const isWeekend = date.getDay() === 0 || date.getDay() === 6

                return (
                  <button key={i} onClick={() => { setSelectedDate(dateStr); setSelectedStaffId(null) }}
                    className={clsx('relative p-2 rounded-xl text-center transition-all border-2', isSelected ? 'border-current shadow-md' : 'border-transparent hover:bg-gray-50', isWeekend && 'opacity-50')}
                    style={isSelected ? { borderColor: config.color, backgroundColor: `${config.color}08` } : {}}>
                    <p className={clsx('text-[10px] font-medium', isSelected ? 'text-current' : 'text-gray-400')} style={isSelected ? { color: config.color } : {}}>
                      {DAY_NAMES_SHORT[date.getDay()]}
                    </p>
                    <p className={clsx('text-lg font-bold', todayFlg ? 'text-white rounded-full w-8 h-8 flex items-center justify-center mx-auto' : 'text-gray-900')}
                      style={todayFlg ? { backgroundColor: config.color } : {}}>
                      {date.getDate()}
                    </p>
                    {dayStaffCount > 0 && (
                      <div className="flex justify-center gap-0.5 mt-1">
                        {Array.from({ length: Math.min(dayStaffCount, 5) }).map((_, j) => (
                          <span key={j} className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: roomColors[j % roomColors.length] }} />
                        ))}
                      </div>
                    )}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Date label */}
          <div className="text-sm text-gray-500 font-medium">📅 {dateLabel}</div>

          {/* Level 1: Practitioner List */}
          {selectedStaffId === null && (
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <div className="flex items-center gap-2 mb-4">
                <Users className="w-4 h-4" style={{ color: config.color }} />
                <h2 className="text-sm font-bold text-gray-900">แพทย์/ผู้ทำหัตถการวันนี้ ({staffOnDate.length} คน)</h2>
              </div>

              {staffOnDate.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-8">ไม่มีแพทย์เข้าวันนี้</p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {staffOnDate.map((staffData, i) => {
                    const { staff: s, rooms, totalSlots } = staffData
                    const branch = branchData.branches.find(b => b.id === s.branchId)
                    const roomList = Array.from(rooms.values())

                    return (
                      <button key={s.id} onClick={() => setSelectedStaffId(s.id)}
                        className="p-4 rounded-xl border-2 border-gray-100 hover:border-current hover:shadow-md transition-all text-left">
                        <div className="flex items-center gap-3 mb-3">
                          <div className="w-12 h-12 rounded-xl flex items-center justify-center text-white font-bold text-sm flex-shrink-0"
                            style={{ backgroundColor: roomColors[i % roomColors.length] }}>
                            {s.name.split(' ')[0].charAt(0)}{s.name.split(' ')[1]?.charAt(0)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-bold text-gray-900 truncate">{s.name}</p>
                            <p className="text-[11px] text-gray-500">{branch?.name}</p>
                            <div className="flex items-center gap-2 mt-1 text-[10px] text-gray-400">
                              <span>🕐 {s.startTime}-{s.endTime}</span>
                              <span>•</span>
                              <span>{totalSlots} slot</span>
                              <span>•</span>
                              <span>ทุก {s.slotDuration} น.</span>
                            </div>
                          </div>
                          <ChevronRight className="w-4 h-4 text-gray-300" />
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {roomList.map(r => (
                            <span key={r.roomId} className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-gray-50 border border-gray-100 text-[10px]">
                              <span className="w-4 h-4 rounded text-[8px] font-bold text-white flex items-center justify-center"
                                style={{ backgroundColor: roomColors[(r.roomId - 1) % roomColors.length] }}>
                                {r.roomId}
                              </span>
                              <span className="font-medium text-gray-700">{r.roomName}</span>
                              <span className="text-gray-400">({r.slotCount})</span>
                            </span>
                          ))}
                        </div>
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          {/* Level 2: Time Slots */}
          {selectedStaffId !== null && selectedStaff && (
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <div className="flex items-center gap-3 mb-4">
                <button onClick={() => setSelectedStaffId(null)} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors">
                  <ArrowLeft className="w-4 h-4 text-gray-500" />
                </button>
                <div>
                  <h2 className="text-sm font-bold text-gray-900">{selectedStaff.name}</h2>
                  <p className="text-[11px] text-gray-500">{selectedStaff.startTime} - {selectedStaff.endTime} • {slotsForStaff.length} slot</p>
                </div>
              </div>

              {slotsForStaff.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-8">ไม่มี slot ว่างวันนี้</p>
              ) : (
                <div className="space-y-4">
                  {slotsByRoom.map(([roomId, slots]) => {
                    const room = activeRooms.find(r => r.id === roomId)
                    return (
                      <div key={roomId} className="rounded-xl border border-gray-100 overflow-hidden">
                        <div className="px-4 py-2.5 flex items-center gap-2" style={{ backgroundColor: `${roomColors[(roomId - 1) % roomColors.length]}10` }}>
                          <span className="w-6 h-6 rounded text-[10px] font-bold text-white flex items-center justify-center"
                            style={{ backgroundColor: roomColors[(roomId - 1) % roomColors.length] }}>
                            {roomId}
                          </span>
                          <span className="text-sm font-bold text-gray-900">{room?.name || `ห้อง ${roomId}`}</span>
                          <span className="text-[10px] text-gray-500">({slots.length} slot)</span>
                        </div>
                        <div className="p-3 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
                          {slots.map((slot) => {
                            const timeRange = slot.slotId.replace('slot-', '').replace('-', ' — ')
                            const booked = isSlotBooked(slot.slotId)
                            return (
                              <button key={slot.id} onClick={() => !booked && openBookingModal(slot.slotId, slot.staffId, slot.roomId, selectedDate)}
                                disabled={booked}
                                className={clsx(
                                  'p-3 rounded-xl text-center border-2 transition-all',
                                  booked
                                    ? 'bg-gray-50 border-gray-200 cursor-not-allowed opacity-60'
                                    : 'bg-white border-gray-100 hover:border-current hover:shadow-md cursor-pointer'
                                )}>
                                <p className="text-xs font-mono text-gray-600">{timeRange}</p>
                                <div className="mt-1.5">
                                  {booked ? (
                                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-50 text-red-600 font-medium">จองแล้ว</span>
                                  ) : (
                                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-green-50 text-green-600 font-medium">ว่าง</span>
                                  )}
                                </div>
                              </button>
                            )
                          })}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* ═══ TAB: BY DOCTOR ═══ */}
      {activeTab === 'by-doctor' && (
        <>
          {/* Step 1: Select Doctor */}
          {bookingStaffId === null && (
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h2 className="text-sm font-bold text-gray-900 mb-4">🩺 เลือกทันตแพทย์/ผู้ทำหัตถการ</h2>
              <div className="space-y-2">
                {availableStaff.map((s, i) => {
                  const branch = branchData.branches.find(b => b.id === s.branchId)
                  const slotCount = assignments.filter(a => a.staffId === s.id).length
                  return (
                    <button key={s.id} onClick={() => setBookingStaffId(s.id)}
                      className="w-full flex items-center gap-3 p-4 rounded-xl border border-gray-100 hover:border-gray-300 hover:shadow-sm transition-all text-left">
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                        style={{ backgroundColor: roomColors[i % roomColors.length] }}>
                        {s.name.split(' ')[0].charAt(0)}{s.name.split(' ')[1]?.charAt(0)}
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-medium text-gray-900">{s.name}</p>
                        <p className="text-[11px] text-gray-500">{branch?.name} • {s.startTime}-{s.endTime}</p>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="text-sm font-bold text-gray-700">{slotCount}</p>
                        <p className="text-[10px] text-gray-400">slot</p>
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {/* Step 2: Select Slot */}
          {bookingStaffId !== null && selectedStaff && (
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <div className="flex items-center gap-3 mb-4">
                <button onClick={() => setBookingStaffId(null)} className="p-1.5 rounded-lg hover:bg-gray-100">
                  <ArrowLeft className="w-4 h-4 text-gray-500" />
                </button>
                <div>
                  <h2 className="text-sm font-bold text-gray-900">{selectedStaff.name}</h2>
                  <p className="text-[11px] text-gray-500">เลือกเวลาที่ว่าง — แสดง 14 วันข้างหน้า</p>
                </div>
              </div>

              {Object.keys(slotsByDate).length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-8">ไม่มี slot ว่างใน 14 วันข้างหน้า</p>
              ) : (
                <div className="space-y-4 max-h-[50vh] overflow-y-auto">
                  {Object.entries(slotsByDate).map(([date, slots]) => {
                    const dateObj = new Date(date)
                    const isTodayDate = date === formatDateKey(new Date())
                    return (
                      <div key={date}>
                        <div className="flex items-center gap-2 mb-2">
                          <Calendar className="w-3.5 h-3.5 text-gray-400" />
                          <span className={clsx('text-xs font-medium', isTodayDate ? 'text-green-600' : 'text-gray-700')}>
                            {DAY_NAMES_FULL[dateObj.getDay()]}ที่ {dateObj.getDate()} {MONTH_NAMES_TH[dateObj.getMonth()]}
                            {isTodayDate && ' (วันนี้)'}
                          </span>
                          <span className="text-[10px] text-gray-400">({slots.length} ช่วง)</span>
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {slots.map(slot => (
                            <button key={slot.slotId} onClick={() => openBookingModal(slot.slotId, bookingStaffId, slot.roomId, date)}
                              className="px-3 py-2 rounded-lg border border-gray-200 hover:border-green-400 hover:bg-green-50 text-xs font-medium text-gray-700 transition-all">
                              <Clock className="w-3 h-3 inline mr-1" />
                              {slot.timeRange}
                              <span className="text-gray-400 ml-1">ห้อง {slot.roomId}</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* ═══ TAB: TODAY'S APPOINTMENT QUEUE ═══ */}
      {activeTab === 'today-queue' && (
        <>
          {/* Summary */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
              <p className="text-2xl font-bold text-gray-900">{todayAppointments.length}</p>
              <p className="text-[11px] text-gray-500 mt-0.5">นัดหมายทั้งหมด</p>
            </div>
            <div className="bg-white rounded-xl border border-orange-200 p-4 text-center">
              <p className="text-2xl font-bold text-orange-600">{notArrivedAppointments.length}</p>
              <p className="text-[11px] text-orange-600 mt-0.5">ยังไม่มาถึง</p>
            </div>
            <div className="bg-white rounded-xl border border-green-200 p-4 text-center">
              <p className="text-2xl font-bold text-green-600">{arrivedAppointments.length}</p>
              <p className="text-[11px] text-green-600 mt-0.5">มาถึงแล้ว</p>
            </div>
          </div>

          {/* Not Arrived */}
          <div className="bg-white rounded-xl border border-orange-200">
            <div className="px-5 py-3 border-b border-orange-100 bg-orange-50/50 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-orange-500" />
                <h2 className="text-sm font-bold text-orange-900">🕐 ยังไม่มาถึง ({notArrivedAppointments.length})</h2>
              </div>
            </div>
            {notArrivedAppointments.length === 0 ? (
              <div className="px-5 py-8 text-center text-gray-400 text-sm">ไม่มีคิวนัดที่ยังไม่มาถึง</div>
            ) : (
              <div className="divide-y divide-gray-50">
                {notArrivedAppointments.map(item => (
                  <div key={item.id} className="px-5 py-3 hover:bg-orange-50/30 transition-colors">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-10 h-10 rounded-lg flex flex-col items-center justify-center font-bold bg-orange-50 text-orange-600">
                          <span className="text-sm leading-none">{item.number.charAt(0)}</span>
                          <span className="text-[10px]">{item.number.slice(1)}</span>
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-gray-900 truncate">{item.patientName}</span>
                            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-purple-50 text-purple-600 font-medium">📅 นัดหมาย</span>
                          </div>
                          <div className="flex items-center gap-2 text-[11px] text-gray-500 mt-0.5">
                            <span>{item.procedure}</span>
                            <span className="text-gray-300">•</span>
                            <span>ห้อง {item.assignedRoom}</span>
                            <span className="text-gray-300">•</span>
                            <span>{item.assignedDoctor.split(' ')[0]}</span>
                            <span className="text-gray-300">•</span>
                            <span className="text-orange-600 font-medium">นัด {item.time}</span>
                          </div>
                        </div>
                      </div>
                      <button
                        onClick={() => handleMarkArrived(item.id)}
                        className="px-3 py-1.5 bg-blue-500 text-white rounded-lg text-xs font-medium hover:bg-blue-600 transition-colors flex items-center gap-1 shadow-sm flex-shrink-0"
                      >
                        <MapPin className="w-3 h-3" /> มาถึงแล้ว
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Arrived */}
          {arrivedAppointments.length > 0 && (
            <div className="bg-white rounded-xl border border-green-200">
              <div className="px-5 py-3 border-b border-green-100 bg-green-50/50 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-green-500" />
                  <h2 className="text-sm font-bold text-green-900">📍 มาถึงแล้ว ({arrivedAppointments.length})</h2>
                </div>
              </div>
              <div className="divide-y divide-gray-50">
                {arrivedAppointments.map(item => (
                  <div key={item.id} className="px-5 py-3 hover:bg-green-50/30 transition-colors">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-10 h-10 rounded-lg flex flex-col items-center justify-center font-bold bg-green-50 text-green-600">
                          <span className="text-sm leading-none">{item.number.charAt(0)}</span>
                          <span className="text-[10px]">{item.number.slice(1)}</span>
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-gray-900 truncate">{item.patientName}</span>
                            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-green-50 text-green-600 font-medium">✓ มาถึงแล้ว</span>
                          </div>
                          <div className="flex items-center gap-2 text-[11px] text-gray-500 mt-0.5">
                            <span>{item.procedure}</span>
                            <span className="text-gray-300">•</span>
                            <span>ห้อง {item.assignedRoom}</span>
                            <span className="text-gray-300">•</span>
                            <span>{item.assignedDoctor.split(' ')[0]}</span>
                            <span className="text-gray-300">•</span>
                            <span>นัด {item.time}</span>
                            {item.arrivedAt && (
                              <><span className="text-gray-300">•</span><span className="text-green-600">มาถึง {item.arrivedAt}</span></>
                            )}
                          </div>
                        </div>
                      </div>
                      <span className="text-xs text-green-500 font-medium flex-shrink-0">✓ เข้าคิวแล้ว</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
