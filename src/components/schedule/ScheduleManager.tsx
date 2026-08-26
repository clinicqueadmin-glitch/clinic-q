'use client'

import { useState, useMemo, useCallback } from 'react'
import {
  ChevronLeft, ChevronRight, Plus, Calendar, Clock,
  Users, Trash2, Edit, X, AlertTriangle, RotateCcw,
  Settings, Zap, Check, Ban, Plane, UserCheck,
  ArrowLeft,
} from 'lucide-react'
import { clsx } from 'clsx'
import { useClinic } from '@/lib/clinic-context'
import { getDefaultBranchData, type Room, type ClinicBranchData, getPractitionerName } from '@/lib/branch-data'
import {
  type RoomAssignment, type DayOfWeek, DAY_NAMES_SHORT, DAY_NAMES_FULL, MONTH_NAMES_TH,
  generateTimeSlots, getDaysInMonth, getFirstDayOffset,
  formatDateKey, getDayOfWeek, getThaiYear,
} from '@/lib/schedule-data'
import { useSchedule, type StaffInfo, type LeaveRequest } from '@/lib/schedule-context'
import { useQueue } from '@/lib/queue-context'
import Toast from '@/components/ui/Toast'

const roomColors = ['#93C5FD', '#A7F3D0', '#FCD34D', '#FDA4AF', '#D8B4FE']

export default function ScheduleManager() {
  const { config, currentClinic } = useClinic()
  const branchData = useMemo(() => getDefaultBranchData(currentClinic || 'dental'), [currentClinic])
  const activeRooms = useMemo(() => branchData.rooms.filter(r => r.active), [branchData])
  const { assignments, setAssignments, staff, leaves, setLeaves } = useSchedule()
  const { queue, setQueue } = useQueue()

  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null)
  const today = new Date()
  const [viewYear, setViewYear] = useState(today.getFullYear())
  const [viewMonth, setViewMonth] = useState(today.getMonth())
  const [selectedDate, setSelectedDate] = useState(formatDateKey(today))
  const [selectedStaffId, setSelectedStaffId] = useState<string | null>(null)

  // Create schedule modal
  const [showCreateSchedule, setShowCreateSchedule] = useState(false)
  const [schedForm, setSchedForm] = useState({
    staffId: '',
    roomId: 1,
    startTime: '09:00',
    endTime: '17:00',
    slotDuration: 30,
    mode: 'regular' as 'regular' | 'adhoc',
    regularDays: [] as DayOfWeek[],
    targetMonth: today.getMonth(),
    targetYear: today.getFullYear(),
    adhocDates: [] as string[],
  })

  // Leave modal
  const [showLeaveModal, setShowLeaveModal] = useState(false)
  const [leaveStaffId, setLeaveStaffId] = useState('')
  const [leaveDates, setLeaveDates] = useState<string[]>([])
  const [leaveReason, setLeaveReason] = useState('')
  const [showLeaveApproval, setShowLeaveApproval] = useState(false)

  const allProcedures = useMemo(() => {
    const procs: { id: string; name: string }[] = []
    branchData.branches.forEach(b => {
      b.procedures.forEach(p => {
        procs.push({ id: p.id, name: p.name })
      })
    })
    return procs
  }, [branchData])

  const showToastMsg = useCallback((message: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToast({ message, type })
    setTimeout(() => setToast(null), 3000)
  }, [])

  // Calendar data
  const daysInMonth = useMemo(() => {
    const days: Date[] = []
    const lastDay = new Date(viewYear, viewMonth + 1, 0).getDate()
    for (let i = 1; i <= lastDay; i++) {
      days.push(new Date(viewYear, viewMonth, i))
    }
    return days
  }, [viewYear, viewMonth])

  const firstDayOffset = useMemo(() => {
    return new Date(viewYear, viewMonth, 1).getDay()
  }, [viewYear, viewMonth])

  // Assignments for selected date
  const assignmentsOnDate = useMemo(() => {
    return assignments.filter(a => a.date === selectedDate)
  }, [assignments, selectedDate])

  // Staff working on selected date with their rooms and slots
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

  // Slots for selected staff
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

  // Group slots by room
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

  // Calendar data for each day
  const calendarData = useMemo(() => {
    const map: Record<string, { entries: { roomId: number; roomName: string; staffName: string }[]; totalSlots: number }> = {}
    daysInMonth.forEach(day => {
      const dateKey = formatDateKey(day)
      const dayAssignments = assignments.filter(a => a.date === dateKey)
      
      // Group by room
      const roomStaffMap = new Map<number, Set<string>>()
      dayAssignments.forEach(a => {
        if (!roomStaffMap.has(a.roomId)) {
          roomStaffMap.set(a.roomId, new Set())
        }
        roomStaffMap.get(a.roomId)!.add(a.staffId)
      })
      
      const entries: { roomId: number; roomName: string; staffName: string }[] = []
      roomStaffMap.forEach((staffIds, roomId) => {
        const room = activeRooms.find(r => r.id === roomId)
        staffIds.forEach(staffId => {
          const staffMember = staff.find(s => s.id === staffId)
          // Get only first name without title (remove ทพ., นพ., พญ., etc.)
          const fullName = staffMember?.name || '?'
          const firstName = fullName.split(' ')[0].replace(/^(นพ\.|ทพ\.|พญ\.|อาจารย์|นาย|นางสาว|นาง)/, '')
          entries.push({
            roomId,
            roomName: room?.name || `ห้อง ${roomId}`,
            staffName: firstName,
          })
        })
      })
      
      map[dateKey] = {
        entries,
        totalSlots: dayAssignments.length,
      }
    })
    return map
  }, [daysInMonth, assignments, staff, activeRooms])

  // Check if a slot is already booked
  const isSlotBooked = (slotId: string) => {
    return queue.some(q => q.status !== 'completed' && q.time && slotId.includes(q.time))
  }

  const selectedStaff = staff.find(s => s.id === selectedStaffId)

  const navigateMonth = (dir: number) => {
    let newMonth = viewMonth + dir
    let newYear = viewYear
    if (newMonth < 0) { newMonth = 11; newYear-- }
    if (newMonth > 11) { newMonth = 0; newYear++ }
    setViewMonth(newMonth)
    setViewYear(newYear)
    setSelectedStaffId(null)
  }

  const goToToday = () => {
    setViewMonth(today.getMonth())
    setViewYear(today.getFullYear())
    setSelectedDate(formatDateKey(today))
    setSelectedStaffId(null)
  }

  const isToday = (dateStr: string) => dateStr === formatDateKey(today)

  // Generate schedule from form
  const generateSchedule = () => {
    const staffMember = staff.find(s => s.id === schedForm.staffId)
    if (!staffMember) { showToastMsg('กรุณาเลือกผู้ทำหัตถการ', 'error'); return }

    const room = activeRooms.find(r => r.id === schedForm.roomId)
    if (!room) { showToastMsg('กรุณาเลือกห้อง', 'error'); return }

    const newAssignments: RoomAssignment[] = []

    if (schedForm.mode === 'regular') {
      const daysInTarget = getDaysInMonth(schedForm.targetYear, schedForm.targetMonth)
      daysInTarget.forEach(day => {
        const dateKey = formatDateKey(day)
        const dow = getDayOfWeek(dateKey)
        if (schedForm.regularDays.includes(dow as DayOfWeek)) {
          const slots = generateTimeSlots(schedForm.startTime, schedForm.endTime, schedForm.slotDuration)
          slots.forEach(slot => {
            const conflict = [...assignments, ...newAssignments].some(
              a => a.date === dateKey && a.roomId === schedForm.roomId && a.slotId === slot.id
            )
            if (!conflict) {
              newAssignments.push({
                id: `gen-${schedForm.roomId}-${dateKey}-${slot.id}`,
                date: dateKey,
                roomId: schedForm.roomId,
                slotId: slot.id,
                staffId: staffMember.id,
                staffName: staffMember.name,
                isManual: false,
              })
            }
          })
        }
      })
    } else {
      schedForm.adhocDates.forEach(dateKey => {
        const slots = generateTimeSlots(schedForm.startTime, schedForm.endTime, schedForm.slotDuration)
        slots.forEach(slot => {
          const conflict = [...assignments, ...newAssignments].some(
            a => a.date === dateKey && a.roomId === schedForm.roomId && a.slotId === slot.id
          )
          if (!conflict) {
            newAssignments.push({
              id: `gen-${schedForm.roomId}-${dateKey}-${slot.id}`,
              date: dateKey,
              roomId: schedForm.roomId,
              slotId: slot.id,
              staffId: staffMember.id,
              staffName: staffMember.name,
              isManual: false,
            })
          }
        })
      })
    }

    if (newAssignments.length === 0) {
      showToastMsg('ไม่มี slot ใหม่ที่ต้องสร้าง (อาจสร้างไปแล้ว)', 'info')
      return
    }

    setAssignments(prev => [...prev, ...newAssignments])
    setShowCreateSchedule(false)
    showToastMsg(`สร้าง ${newAssignments.length} slot สำเร็จสำหรับ ${staffMember.name}`, 'success')
  }

  // Clear auto-generated
  const clearAutoGenerated = () => {
    setAssignments(prev => prev.filter(a => !a.id.startsWith('gen-')))
    showToastMsg('ล้าง slot อัตโนมัติแล้ว', 'info')
  }

  // Submit leave request
  const submitLeave = () => {
    const staffMember = staff.find(s => s.id === leaveStaffId)
    if (!staffMember || leaveDates.length === 0 || !leaveReason) {
      showToastMsg('กรุณากรอกข้อมูลให้ครบทุกช่อง', 'error')
      return
    }
    const newLeave: LeaveRequest = {
      id: `leave-${Date.now()}`,
      staffId: leaveStaffId,
      staffName: staffMember.name,
      dates: leaveDates,
      reason: leaveReason,
      status: 'pending',
      requestedAt: formatDateKey(today),
    }
    setLeaves(prev => [...prev, newLeave])
    setShowLeaveModal(false)
    setLeaveStaffId('')
    setLeaveDates([])
    setLeaveReason('')
    showToastMsg(`ส่งคำขอลางาน ${staffMember.name} สำเร็จ — รอการยืนยัน`, 'success')
  }

  // Approve/reject leave
  const updateLeaveStatus = (leaveId: string, status: 'approved' | 'rejected') => {
    setLeaves(prev => prev.map(l => l.id === leaveId ? { ...l, status } : l))
    const leave = leaves.find(l => l.id === leaveId)
    showToastMsg(status === 'approved' ? `อนุมัติการลา ${leave?.staffName}` : `ปฏิเสธการลา ${leave?.staffName}`, status === 'approved' ? 'success' : 'info')
  }

  const pendingLeaves = useMemo(() => leaves.filter(l => l.status === 'pending'), [leaves])

  // Open booking modal
  const openBookingModal = (slotId: string, staffId: string, roomId: number) => {
    setBookingSlotId(slotId)
    setBookingStaffId(staffId)
    setBookingRoomId(roomId)
    setBookingName('')
    setBookingPhone('')
    setBookingProcedure('')
    setShowBookingModal(true)
  }

  // Confirm booking
  const confirmBooking = () => {
    if (!bookingName || !bookingPhone || !bookingProcedure) {
      showToastMsg('กรุณากรอกข้อมูลให้ครบทุกช่อง', 'error')
      setTimeout(() => setToast(null), 3000)
      return
    }

    const staffMember = staff.find(s => s.id === bookingStaffId)
    const proc = allProcedures.find(p => p.id === bookingProcedure)
    const timeMatch = bookingSlotId.match(/slot-(\d{2}:\d{2})/)
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
      assignedRoom: bookingRoomId,
      assignedDoctor: staffMember?.name || '',
      status: 'waiting' as const,
      time: timeStr,
      bookedAt: timeStr,
      arrivalTime: timeStr,
      arrived: false,
    }

    setQueue(prev => [...prev, newQueue])
    setShowBookingModal(false)
    showToastMsg(`นัดหมายสำเร็จ — ${bookingName} กับ ${staffMember?.name} เวลา ${timeStr}`, 'success')
    setTimeout(() => setToast(null), 3000)
  }

  // Booking modal state
  const [showBookingModal, setShowBookingModal] = useState(false)
  const [bookingSlotId, setBookingSlotId] = useState('')
  const [bookingStaffId, setBookingStaffId] = useState('')
  const [bookingRoomId, setBookingRoomId] = useState(1)
  const [bookingName, setBookingName] = useState('')
  const [bookingPhone, setBookingPhone] = useState('')
  const [bookingProcedure, setBookingProcedure] = useState('')

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
                  {selectedStaff?.name} • ห้อง {bookingRoomId} • {bookingSlotId.replace('slot-', '').replace('-', ' - ')}
                </p>
              </div>
              <button onClick={() => setShowBookingModal(false)} className="p-2 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5 text-gray-500" /></button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">ชื่อ-นามสกุล *</label>
                <input type="text" value={bookingName} onChange={(e) => setBookingName(e.target.value)} placeholder="กรอกชื่อผู้รับบริการ" className="w-full px-3 py-2.5 rounded-lg border border-gray-200 focus:border-primary-400 focus:outline-none text-sm" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">เบอร์โทรศัพท์ *</label>
                <input type="tel" value={bookingPhone} onChange={(e) => setBookingPhone(e.target.value)} placeholder="0xx-xxx-xxxx" className="w-full px-3 py-2.5 rounded-lg border border-gray-200 focus:border-primary-400 focus:outline-none text-sm" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">หัตถการที่ต้องการ *</label>
                <select value={bookingProcedure} onChange={(e) => setBookingProcedure(e.target.value)} className="w-full px-3 py-2.5 rounded-lg border border-gray-200 focus:border-primary-400 focus:outline-none text-sm">
                  <option value="">— เลือกหัตถการ —</option>
                  {allProcedures.map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
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

      {/* Create Schedule Modal */}
      {showCreateSchedule && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b border-gray-100 sticky top-0 bg-white z-10">
              <div>
                <h2 className="text-lg font-bold text-gray-900">สร้างตารางเวร</h2>
                <p className="text-xs text-gray-500">กำหนดผู้ทำหัตถการ เวลา และ slot</p>
              </div>
              <button onClick={() => setShowCreateSchedule(false)} className="p-2 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5 text-gray-500" /></button>
            </div>
            <div className="p-5 space-y-4">
              {/* Practitioner */}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">ผู้ทำหัตถการ *</label>
                <select value={schedForm.staffId} onChange={e => setSchedForm(f => ({ ...f, staffId: e.target.value }))} className="w-full px-3 py-2.5 rounded-lg border border-gray-200 focus:border-primary-400 focus:outline-none text-sm">
                  <option value="">— เลือกผู้ทำหัตถการ —</option>
                  {staff.map(s => <option key={s.id} value={s.id}>{s.name} ({s.role === 'doctor' ? 'แพทย์' : s.role === 'nurse' ? 'พยาบาล' : 'เจ้าหน้าที่'})</option>)}
                </select>
              </div>

              {/* Room */}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">ห้อง *</label>
                <select value={schedForm.roomId} onChange={e => setSchedForm(f => ({ ...f, roomId: parseInt(e.target.value) }))} className="w-full px-3 py-2.5 rounded-lg border border-gray-200 focus:border-primary-400 focus:outline-none text-sm">
                  {activeRooms.map((r, i) => <option key={r.id} value={r.id}>{r.name}</option>)}
                </select>
              </div>

              {/* Time */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">เวลาเริ่ม *</label>
                  <input type="time" value={schedForm.startTime} onChange={e => setSchedForm(f => ({ ...f, startTime: e.target.value }))} className="w-full px-3 py-2.5 rounded-lg border border-gray-200 focus:border-primary-400 focus:outline-none text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">เวลาสิ้นสุด *</label>
                  <input type="time" value={schedForm.endTime} onChange={e => setSchedForm(f => ({ ...f, endTime: e.target.value }))} className="w-full px-3 py-2.5 rounded-lg border border-gray-200 focus:border-primary-400 focus:outline-none text-sm" />
                </div>
              </div>

              {/* Slot Duration */}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">ระยะเวลาต่อ Slot (นาที) *</label>
                <div className="grid grid-cols-6 gap-2">
                  {[10, 15, 20, 30, 45, 60].map(d => (
                    <button key={d} onClick={() => setSchedForm(f => ({ ...f, slotDuration: d }))}
                      className={clsx('py-2 rounded-lg text-sm font-medium transition-all border', schedForm.slotDuration === d ? 'border-green-500 bg-green-50 text-green-700' : 'border-gray-200 bg-white text-gray-500 hover:border-gray-300')}>
                      {d}
                    </button>
                  ))}
                </div>
              </div>

              {/* Mode */}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-2">รูปแบบการจัดตาราง</label>
                <div className="grid grid-cols-2 gap-2">
                  <button onClick={() => setSchedForm(f => ({ ...f, mode: 'regular' }))}
                    className={clsx('p-3 rounded-xl border-2 text-center transition-all', schedForm.mode === 'regular' ? 'border-green-500 bg-green-50' : 'border-gray-200 hover:border-gray-300')}>
                    <Calendar className="w-5 h-5 mx-auto mb-1 text-green-600" />
                    <p className="text-xs font-bold text-gray-900">ทำงานประจำ</p>
                    <p className="text-[10px] text-gray-500">เลือกวัน + เดือน</p>
                  </button>
                  <button onClick={() => setSchedForm(f => ({ ...f, mode: 'adhoc' }))}
                    className={clsx('p-3 rounded-xl border-2 text-center transition-all', schedForm.mode === 'adhoc' ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300')}>
                    <Clock className="w-5 h-5 mx-auto mb-1 text-blue-600" />
                    <p className="text-xs font-bold text-gray-900">指定วัน</p>
                    <p className="text-[10px] text-gray-500">เลือกวันที่ต้องการ</p>
                  </button>
                </div>
              </div>

              {/* Regular mode */}
              {schedForm.mode === 'regular' && (
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-2">วันที่เข้างาน (ทำซ้ำทุกสัปดาห์)</label>
                    <div className="grid grid-cols-7 gap-1">
                      {DAY_NAMES_SHORT.map((d, i) => {
                        const dayNum = i === 0 ? 0 : i
                        const isSelected = schedForm.regularDays.includes(dayNum as DayOfWeek)
                        return (
                          <button key={i} onClick={() => {
                            setSchedForm(f => ({
                              ...f,
                              regularDays: isSelected ? f.regularDays.filter(dd => dd !== dayNum) : [...f.regularDays, dayNum as DayOfWeek]
                            }))
                          }} className={clsx('py-2 rounded-lg text-xs font-medium transition-all border', isSelected ? 'bg-green-500 text-white border-green-500' : 'bg-white text-gray-500 border-gray-200 hover:border-green-300')}>
                            {d}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">เดือน</label>
                      <select value={schedForm.targetMonth} onChange={e => setSchedForm(f => ({ ...f, targetMonth: parseInt(e.target.value) }))} className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:border-primary-400 focus:outline-none text-sm">
                        {MONTH_NAMES_TH.map((m, i) => <option key={i} value={i}>{m}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">ปี</label>
                      <select value={schedForm.targetYear} onChange={e => setSchedForm(f => ({ ...f, targetYear: parseInt(e.target.value) }))} className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:border-primary-400 focus:outline-none text-sm">
                        {[today.getFullYear() - 1, today.getFullYear(), today.getFullYear() + 1].map(y => <option key={y} value={y}>{y + 543}</option>)}
                      </select>
                    </div>
                  </div>
                </div>
              )}

              {/* Ad-hoc mode */}
              {schedForm.mode === 'adhoc' && (
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-2">เลือกวันที่ต้องการ ({schedForm.adhocDates.length} วัน)</label>
                  <div className="grid grid-cols-7 gap-0.5 text-center mb-1">
                    {DAY_NAMES_SHORT.map(d => <div key={d} className="text-[10px] font-medium text-gray-400 py-1">{d}</div>)}
                  </div>
                  <div className="grid grid-cols-7 gap-0.5">
                    {Array.from({ length: firstDayOffset }).map((_, i) => <div key={`e-${i}`} />)}
                    {daysInMonth.map(day => {
                      const dateKey = formatDateKey(day)
                      const isAdhoc = schedForm.adhocDates.includes(dateKey)
                      return (
                        <button key={dateKey} onClick={() => {
                          setSchedForm(f => ({
                            ...f,
                            adhocDates: isAdhoc ? f.adhocDates.filter(d => d !== dateKey) : [...f.adhocDates, dateKey]
                          }))
                        }} className={clsx('w-full aspect-square rounded-lg flex items-center justify-center text-[11px] font-medium transition-all border', isAdhoc ? 'bg-blue-500 text-white border-blue-500' : 'bg-white text-gray-600 border-gray-100 hover:border-blue-300')}>
                          {day.getDate()}
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
            <div className="flex justify-end gap-3 p-5 border-t border-gray-100 sticky bottom-0 bg-white">
              <button onClick={() => setShowCreateSchedule(false)} className="px-4 py-2.5 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-100">ยกเลิก</button>
              <button onClick={generateSchedule} className="flex items-center gap-2 px-6 py-2.5 rounded-lg text-sm font-bold text-white shadow-md hover:shadow-lg hover:bg-opacity-90" style={{ backgroundColor: config.color }}>
                <Zap className="w-4 h-4" /> สร้างตารางเวร
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Leave Request Modal */}
      {showLeaveModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between p-5 border-b border-gray-100">
              <div>
                <h2 className="text-lg font-bold text-gray-900">ขอลางาน</h2>
                <p className="text-xs text-gray-500">เลือกผู้ทำหัตถการและวันที่ต้องการลา</p>
              </div>
              <button onClick={() => setShowLeaveModal(false)} className="p-2 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5 text-gray-500" /></button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">ผู้ทำหัตถการ *</label>
                <select value={leaveStaffId} onChange={e => setLeaveStaffId(e.target.value)} className="w-full px-3 py-2.5 rounded-lg border border-gray-200 focus:border-primary-400 focus:outline-none text-sm">
                  <option value="">— เลือก —</option>
                  {staff.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-2">วันที่ต้องการลา ({leaveDates.length} วัน)</label>
                <div className="grid grid-cols-7 gap-0.5 text-center mb-1">
                  {DAY_NAMES_SHORT.map(d => <div key={d} className="text-[10px] font-medium text-gray-400 py-1">{d}</div>)}
                </div>
                <div className="grid grid-cols-7 gap-0.5 max-h-48 overflow-y-auto">
                  {Array.from({ length: firstDayOffset }).map((_, i) => <div key={`e-${i}`} />)}
                  {daysInMonth.map(day => {
                    const dateKey = formatDateKey(day)
                    const isLeave = leaveDates.includes(dateKey)
                    return (
                      <button key={dateKey} onClick={() => {
                        setLeaveDates(prev => isLeave ? prev.filter(d => d !== dateKey) : [...prev, dateKey])
                      }} className={clsx('w-full aspect-square rounded-lg flex items-center justify-center text-[11px] font-medium transition-all border', isLeave ? 'bg-red-500 text-white border-red-500' : 'bg-white text-gray-600 border-gray-100 hover:border-red-300')}>
                        {day.getDate()}
                      </button>
                    )
                  })}
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">เหตุผล *</label>
                <textarea value={leaveReason} onChange={e => setLeaveReason(e.target.value)} placeholder="กรอกเหตุผลการลา..." rows={2} className="w-full px-3 py-2.5 rounded-lg border border-gray-200 focus:border-primary-400 focus:outline-none text-sm" />
              </div>
            </div>
            <div className="flex justify-end gap-3 p-5 border-t border-gray-100">
              <button onClick={() => setShowLeaveModal(false)} className="px-4 py-2.5 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-100">ยกเลิก</button>
              <button onClick={submitLeave} className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-bold bg-orange-500 text-white hover:bg-orange-600 shadow-sm">
                <Plane className="w-4 h-4" /> ส่งคำขอ
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Leave Approval Modal */}
      {showLeaveApproval && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b border-gray-100 sticky top-0 bg-white z-10">
              <div>
                <h2 className="text-lg font-bold text-gray-900">ตรวจสอบการลา</h2>
                <p className="text-xs text-gray-500">อนุมัติหรือปฏิเสธคำขอลางาน</p>
              </div>
              <button onClick={() => setShowLeaveApproval(false)} className="p-2 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5 text-gray-500" /></button>
            </div>
            <div className="p-5 space-y-3">
              {leaves.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-8">ไม่มีคำขอลางาน</p>
              ) : (
                leaves.map(leave => (
                  <div key={leave.id} className={clsx('p-4 rounded-xl border', leave.status === 'pending' ? 'border-orange-200 bg-orange-50' : leave.status === 'approved' ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50')}>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <div className={clsx('w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold', leave.status === 'pending' ? 'bg-orange-100 text-orange-600' : leave.status === 'approved' ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600')}>
                          {leave.status === 'pending' ? '⏳' : leave.status === 'approved' ? '✓' : '✗'}
                        </div>
                        <div>
                          <p className="text-sm font-bold text-gray-900">{leave.staffName}</p>
                          <p className="text-[10px] text-gray-500">{leave.reason}</p>
                        </div>
                      </div>
                      <span className={clsx('text-[10px] px-2 py-0.5 rounded-full font-medium', leave.status === 'pending' ? 'bg-orange-100 text-orange-600' : leave.status === 'approved' ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600')}>
                        {leave.status === 'pending' ? 'รอตรวจสอบ' : leave.status === 'approved' ? 'อนุมัติแล้ว' : 'ปฏิเสธแล้ว'}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-1 mb-2">
                      {leave.dates.map(d => (
                        <span key={d} className="text-[10px] px-2 py-0.5 bg-white rounded border border-gray-200 text-gray-600">
                          {new Date(d).getDate()} {MONTH_NAMES_TH[new Date(d).getMonth()]}
                        </span>
                      ))}
                    </div>
                    {leave.status === 'pending' && (
                      <div className="flex gap-2">
                        <button onClick={() => updateLeaveStatus(leave.id, 'approved')} className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-emerald-600 text-white rounded-lg text-xs font-medium hover:bg-emerald-700 shadow-sm">
                          <Check className="w-3 h-3" /> อนุมัติ
                        </button>
                        <button onClick={() => updateLeaveStatus(leave.id, 'rejected')} className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-rose-500 text-white rounded-lg text-xs font-medium hover:bg-rose-600 shadow-sm">
                          <Ban className="w-3 h-3" /> ปฏิเสธ
                        </button>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold text-sm" style={{ backgroundColor: config.color }}>
            {config.prefix}
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">จัดตารางเวร</h1>
            <p className="text-xs text-gray-500">{config.name}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {pendingLeaves.length > 0 && (
            <button onClick={() => setShowLeaveApproval(true)} className="flex items-center gap-2 px-3 py-2 bg-orange-50 text-orange-600 rounded-lg text-sm font-medium hover:bg-orange-100 transition-colors border border-orange-200">
              <Plane className="w-4 h-4" /> ลารอตรวจสอบ ({pendingLeaves.length})
            </button>
          )}
          <button onClick={() => setShowLeaveModal(true)} className="flex items-center gap-2 px-3 py-2 bg-gray-100 text-gray-600 rounded-lg text-sm font-medium hover:bg-gray-200 transition-colors">
            <Plane className="w-4 h-4" /> ขอลางาน
          </button>
          <button onClick={() => setShowCreateSchedule(true)} className="flex items-center gap-2 px-4 py-2 bg-green-500 text-white rounded-lg text-sm font-medium hover:bg-green-600 shadow-sm">
            <Zap className="w-4 h-4" /> สร้างตารางเวร
          </button>
          <button onClick={clearAutoGenerated} className="flex items-center gap-2 px-3 py-2 bg-orange-500 text-white rounded-lg text-sm font-medium hover:bg-orange-600 shadow-sm">
            <RotateCcw className="w-4 h-4" /> ล้างอัตโนมัติ
          </button>
        </div>
      </div>

      {/* ═══ CALENDAR ═══ */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        {/* Month Navigation */}
        <div className="flex items-center justify-between mb-4">
          <button onClick={() => navigateMonth(-1)} className="p-2 hover:bg-gray-100 rounded-lg">
            <ChevronLeft className="w-5 h-5 text-gray-500" />
          </button>
          <div className="text-center">
            <p className="text-lg font-bold text-gray-900">{MONTH_NAMES_TH[viewMonth]} {getThaiYear(new Date(viewYear, viewMonth))}</p>
          </div>
          <button onClick={() => navigateMonth(1)} className="p-2 hover:bg-gray-100 rounded-lg">
            <ChevronRight className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Day Headers */}
        <div className="grid grid-cols-7 gap-1 mb-2">
          {DAY_NAMES_SHORT.map(d => (
            <div key={d} className="text-center text-[11px] font-bold text-gray-500 py-2">{d}</div>
          ))}
        </div>

        {/* Calendar Grid */}
        <div className="grid grid-cols-7 gap-1">
          {Array.from({ length: firstDayOffset }).map((_, i) => (
            <div key={`empty-${i}`} className="aspect-square" />
          ))}
          {daysInMonth.map(day => {
            const dateKey = formatDateKey(day)
            const isSelected = dateKey === selectedDate
            const todayFlg = isToday(dateKey)
            const data = calendarData[dateKey]
            const isWeekend = day.getDay() === 0 || day.getDay() === 6

            return (
              <button
                key={dateKey}
                onClick={() => { setSelectedDate(dateKey); setSelectedStaffId(null) }}
                className={clsx(
                  'aspect-square rounded-xl p-1 text-center transition-all border-2 flex flex-col',
                  isSelected ? 'border-current shadow-md' : 'border-transparent hover:bg-gray-50',
                  isWeekend && 'opacity-50'
                )}
                style={isSelected ? { borderColor: config.color, backgroundColor: `${config.color}08` } : {}}
              >
                <span className={clsx(
                  'text-sm font-bold w-6 h-6 rounded-full flex items-center justify-center mx-auto',
                  todayFlg ? 'text-white' : isSelected ? 'text-current' : 'text-gray-900'
                )}
                  style={{
                    ...(todayFlg ? { backgroundColor: config.color } : {}),
                    ...(isSelected && !todayFlg ? { color: config.color } : {})
                  }}>
                  {day.getDate()}
                </span>
                {data && data.entries.length > 0 && (
                  <div className="mt-1 flex flex-col gap-0.5">
                    {data.entries.slice(0, 3).map((entry, i) => (
                      <div key={i} className="flex items-center gap-0.5">
                        <span className="w-3 h-3 rounded text-[6px] font-bold text-white flex items-center justify-center flex-shrink-0"
                          style={{ backgroundColor: roomColors[(entry.roomId - 1) % roomColors.length] }}>
                          {entry.roomId}
                        </span>
                        <span className="text-[7px] font-medium text-gray-600 leading-none truncate">
                          {entry.staffName}
                        </span>
                      </div>
                    ))}
                    {data.entries.length > 3 && (
                      <span className="text-[7px] text-gray-400 leading-none">+{data.entries.length - 3}</span>
                    )}
                  </div>
                )}
              </button>
            )
          })}
        </div>
      </div>

      {/* ═══ SELECTED DATE DETAILS ═══ */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <div className="flex items-center gap-2 mb-4">
          <Calendar className="w-4 h-4" style={{ color: config.color }} />
          <h2 className="text-sm font-bold text-gray-900">
            {DAY_NAMES_FULL[new Date(selectedDate).getDay()]}ที่ {new Date(selectedDate).getDate()} {MONTH_NAMES_TH[new Date(selectedDate).getMonth()]}
          </h2>
          <span className="text-[10px] text-gray-400">({assignmentsOnDate.length} slot)</span>
        </div>

        {/* Staff List */}
        {selectedStaffId === null && (
          <div className="space-y-3">
            {staffOnDate.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-8">ไม่มีแพทย์เข้าวันนี้</p>
            ) : (
              staffOnDate.map((staffData, i) => {
                const { staff: s, rooms, totalSlots } = staffData
                const branch = branchData.branches.find(b => b.id === s.branchId)
                const roomList = Array.from(rooms.values())

                return (
                  <button key={s.id} onClick={() => setSelectedStaffId(s.id)}
                    className="w-full p-4 rounded-xl border-2 border-gray-100 hover:border-current hover:shadow-md transition-all text-left">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold text-sm flex-shrink-0"
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
              })
            )}
          </div>
        )}

        {/* Staff Slots */}
        {selectedStaffId !== null && selectedStaff && (
          <div>
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
                            <button key={slot.id} onClick={() => !booked && openBookingModal(slot.slotId, slot.staffId, slot.roomId)}
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
      </div>
    </div>
  )
}
