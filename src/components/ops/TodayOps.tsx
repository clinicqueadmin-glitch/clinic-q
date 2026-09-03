'use client'

import { useState, useMemo, useEffect, useCallback } from 'react'
import {
  Clock, CheckCircle, Play, SkipForward, Plus,
  X, Trash2, UserCheck, Ban, MonitorPlay,
} from 'lucide-react'
import { clsx } from 'clsx'
import { useClinic } from '@/lib/clinic-context'
import { useAuth } from '@/lib/auth-context'
import { useQueue, type BookingMode, type DifficultyLevel, type CompletedProcedure, type QueueItem } from '@/lib/queue-context'
import { useNotification } from '@/lib/use-notification'
import Toast from '@/components/ui/Toast'
import AddRoomModal from '@/components/dashboard/AddRoomModal'
import {
  getDefaultBranchData, getAllActiveProcedures,
  findRoomForProcedure, getOvertimeStatus, getQueueWaitInfo,
  type Room, type Practitioner,
} from '@/lib/branch-data'
import { usePractitioners } from '@/lib/practitioner-context'
import { addCompletedProcedures, updateQueueStatus } from '@/lib/supabase-queue'
import PhoneInput from '@/components/ui/PhoneInput'
import SetupGuide from '@/components/guide/SetupGuide'

export const difficultyConfig: Record<DifficultyLevel, { label: string; detail: string; color: string; bg: string; multiplier: number }> = {
  easy:       { label: 'ทั่วไป', detail: 'ทำได้ตามปกติ ไม่ซับซ้อน',   color: 'text-gray-600', bg: 'bg-gray-50',  multiplier: 0.8 },
  medium:     { label: 'ต้องระวัง', detail: 'ใช้ความชำนาญพอสมควร', color: 'text-blue-600', bg: 'bg-blue-50',  multiplier: 1.0 },
  hard:       { label: 'ซับซ้อน',  detail: 'หัตถการที่ต้องวางแผน', color: 'text-orange-600', bg: 'bg-orange-50', multiplier: 1.4 },
  very_hard:  { label: 'ผ่าตัดใหญ่', detail: 'ใช้เวลานาน ต้องดูแลเป็นพิเศษ', color: 'text-red-600', bg: 'bg-red-50', multiplier: 1.8 },
}

const roomColors = ['#93C5FD', '#A7F3D0', '#FCD34D', '#FDA4AF', '#D8B4FE']

const bookingModeLabels: Record<BookingMode, { label: string; color: string; bg: string; icon: string }> = {
  walkin: { label: 'Walk-in', color: 'text-green-600', bg: 'bg-green-50', icon: '🚶' },
  remote: { label: 'ออนไลน์', color: 'text-blue-600', bg: 'bg-blue-50', icon: '📱' },
  appointment: { label: 'นัดหมาย', color: 'text-purple-600', bg: 'bg-purple-50', icon: '📅' },
}

/** Format time string (ISO or HH:MM) to 'HH:MM น.' */
/** Format time string (ISO or HH:MM) to 'HH:MM น.' in ICT timezone (UTC+7) */
function formatTimeShort(raw: string | undefined): string {
  if (!raw) return ''
  // Already HH:MM - keep as is
  if (/^\d{2}:\d{2}$/.test(raw)) return `${raw} น.`
  // ISO timestamp - convert to ICT (Asia/Bangkok, UTC+7)
  try {
    const d = new Date(raw)
    if (!isNaN(d.getTime())) {
      const ictStr = d.toLocaleString('en-GB', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
        timeZone: 'Asia/Bangkok'
      })
      return `${ictStr} น.`
    }
  } catch {}
  return raw
}

/** Calculate elapsed minutes since a time string like '09:15' */
function getElapsedMinutes(timeStr: string | undefined): number | null {
  if (!timeStr) return null
  try {
    const [h, m] = timeStr.split(':').map(Number)
    if (isNaN(h) || isNaN(m)) return null
    const now = new Date()
    const nowMinutes = now.getHours() * 60 + now.getMinutes()
    const arrivalMinutes = h * 60 + m
    const diff = nowMinutes - arrivalMinutes
    return diff >= 0 ? diff : null
  } catch {
    return null
  }
}

export default function TodayOps() {
  const { config, currentClinic, settings } = useClinic()
  const { user, currentRole, currentClinicId } = useAuth()
  // Clinic-specific storage keys
  const roomKey = currentClinicId ? `clinic-rooms-${currentClinicId}` : 'clinic-rooms'
  const dailyRoomKey = currentClinicId ? `clinic-daily-rooms-${currentClinicId}` : 'clinic-daily-rooms'
  const dailyDateKey = currentClinicId ? `clinic-daily-rooms-date-${currentClinicId}` : 'clinic-daily-rooms-date'
  const settingsKey = currentClinicId ? `clinic-q-settings-${currentClinicId}` : 'clinic-q-settings'
  const { practitioners } = usePractitioners()
  const [branchData, setBranchData] = useState(() => getDefaultBranchData(currentClinic || 'dental'))
  
  // Load branch data from clinic-specific storage
  useEffect(() => {
    if (typeof window !== 'undefined' && currentClinicId) {
      const saved = localStorage.getItem(`clinic-branch-data-${currentClinicId}`)
      if (saved) {
        try {
          const parsed = JSON.parse(saved)
          if (parsed && parsed.branches && parsed.branches.length > 0) {
            setBranchData(parsed)
            return
          }
        } catch {}
      }
    }
    setBranchData(getDefaultBranchData(currentClinic || 'dental'))
  }, [currentClinicId, currentClinic])
  
  // Setup guide for new clinics
  const [showSetupGuide, setShowSetupGuide] = useState(() => {
    if (typeof window === 'undefined') return false
    const guideKey = `clinicq-setup-guide-shown-${currentClinic || 'default'}`
    return !localStorage.getItem(guideKey)
  })
  
  const closeSetupGuide = () => {
    setShowSetupGuide(false)
    if (typeof window !== 'undefined') {
      localStorage.setItem(`clinicq-setup-guide-shown-${currentClinic || 'default'}`, 'true')
    }
  }
  
  // Read room settings from localStorage (RoomSettings - basic room info)
  const [savedRooms, setSavedRooms] = useState<Room[]>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem(roomKey)
      if (saved) {
        try { return JSON.parse(saved) } catch {}
      }
    }
    return []
  })
  
  // Read daily room schedule from separate localStorage (practitioner, branch, time for today)
  const [dailyRooms, setDailyRooms] = useState<Room[]>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem(dailyRoomKey)
      const savedDate = localStorage.getItem(dailyDateKey)
      const today = new Date().toISOString().split('T')[0]
      // If date doesn't match today, clear daily rooms (new day)
      if (savedDate !== today) {
        localStorage.removeItem(dailyRoomKey)
        localStorage.setItem(dailyDateKey, today)
        return []
      }
      if (saved) {
        try { return JSON.parse(saved) } catch {}
      }
    }
    return []
  })

  // Reset daily rooms when clinic closes
  useEffect(() => {
    const checkClosingTime = () => {
      const savedSettings = localStorage.getItem(settingsKey)
      if (!savedSettings) return
      try {
        const settings = JSON.parse(savedSettings)
        const closeTime = settings.closeTime || '20:00'
        const now = new Date()
        const [closeHour, closeMin] = closeTime.split(':').map(Number)
        const currentMinutes = now.getHours() * 60 + now.getMinutes()
        const closeMinutes = closeHour * 60 + closeMin
        // If past closing time, clear daily rooms and queue
        if (currentMinutes >= closeMinutes) {
          const savedDate = localStorage.getItem(dailyDateKey)
          const today = now.toISOString().split('T')[0]
          if (savedDate === today) {
            localStorage.removeItem(dailyRoomKey)
            localStorage.removeItem(`clinicq-queue-${currentClinic}-${today}`)
            localStorage.setItem(dailyDateKey, '')
            setDailyRooms([])
          }
        }
      } catch {}
    }
    checkClosingTime()
    const interval = setInterval(checkClosingTime, 60000) // Check every minute
    return () => clearInterval(interval)
  }, [currentClinic])
  
  // Merge RoomSettings + daily schedule for dashboard display
  const allActiveRooms = useMemo(() => {
    // Start with rooms from daily schedule (these have practitioner, branch, time)
    const activeDailyRooms = dailyRooms.filter(r => r.active)
    
    // If no daily rooms, use rooms from RoomSettings
    if (activeDailyRooms.length === 0) {
      return savedRooms.filter(r => r.active).map(room => ({
        ...room,
        name: room.name || `ห้อง ${room.id}`,
        color: room.color || '#93C5FD',
        branchId: room.branchId || '',
        practitionerId: room.practitionerId || '',
      }))
    }
    
    // Use daily rooms (they already have room info from RoomSettings + practitioner/branch/time)
    return activeDailyRooms.map(room => ({
      ...room,
      name: room.name || `ห้อง ${room.id}`,
      color: room.color || '#93C5FD',
    }))
  }, [savedRooms, dailyRooms, branchData])
  
  // Listen for localStorage changes (when RoomSettings or daily schedule is updated)
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === roomKey && e.newValue) {
        try {
          setSavedRooms(JSON.parse(e.newValue))
        } catch {}
      }
      if (e.key === dailyRoomKey && e.newValue) {
        try {
          setDailyRooms(JSON.parse(e.newValue))
        } catch {}
      }
    }
    window.addEventListener('storage', handleStorageChange)
    return () => window.removeEventListener('storage', handleStorageChange)
  }, [roomKey, dailyRoomKey])
  const allProcedures = useMemo(() => getAllActiveProcedures(branchData), [branchData])

  // Provider sees only their assigned room(s)
  const isProvider = currentRole === 'practitioner'
  // Get practitioner name - prefer room.practitionerName, then context, then users
  const getPractitionerNameFromRoom = useCallback((room: { practitionerId: string; practitionerName?: string }): string => {
    // 1. Use stored name from daily room data (most reliable)
    if (room.practitionerName) return room.practitionerName
    // 2. Look up from practitioner context
    const practitioner = practitioners.find(p => p.id === room.practitionerId)
    if (practitioner) return practitioner.name
    // 3. Look up from users with practitioner role
    if (typeof window !== 'undefined') {
      const users = JSON.parse(localStorage.getItem('clinicq-users-with-roles') || '[]')
      const user = users.find((u: any) => u.id === room.practitionerId)
      if (user) return user.name
    }
    return 'ไม่ระบุ'
  }, [practitioners])

  const providerRoomIds = useMemo(() => {
    if (!isProvider || !user) return null
    // Find practitioner record linked to this user
    const myPractitioner = practitioners.find(p => p.userId === user.id)
    if (!myPractitioner) return null // No practitioner record found, show nothing
    // Match by practitionerId OR by stored practitionerName
    const matchingRoomIds = allActiveRooms
      .filter(r => r.practitionerId === myPractitioner.id || (r.practitionerName && r.practitionerName === myPractitioner.name))
      .map(r => r.id)
    return matchingRoomIds.length > 0 ? matchingRoomIds : null
  }, [isProvider, user, allActiveRooms, practitioners])
  const activeRooms = useMemo(() => {
    if (!providerRoomIds) return allActiveRooms
    return allActiveRooms.filter(r => providerRoomIds.includes(r.id))
  }, [allActiveRooms, providerRoomIds])

  const [now, setNow] = useState(new Date())
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null)

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  // Queue (shared context)
  const { queue, setQueue, saveQueueItem, addQueueItem } = useQueue()
  const { notifyQueueCalled, notifyQueueCompleted, playSound } = useNotification()

  // Room Selection modal (for calling queue)
  const [showRoomSelect, setShowRoomSelect] = useState(false)
  const [roomSelectItem, setRoomSelectItem] = useState<QueueItem | null>(null)
  const [availableRooms, setAvailableRooms] = useState<{ room: typeof activeRooms[0]; branchName: string; practitionerName: string; matchScore: number }[]>([])

  // Confirm Call modal (confirm patient is present before sending to room)
  const [showConfirmCall, setShowConfirmCall] = useState(false)
  const [confirmCallItem, setConfirmCallItem] = useState<QueueItem | null>(null)

  // Room Confirm modal (confirm before sending to room)
  const [showRoomConfirm, setShowRoomConfirm] = useState(false)
  const [roomConfirmData, setRoomConfirmData] = useState<{item: QueueItem; roomId: number; roomName: string; roomColor: string; practitionerName: string} | null>(null)

  // Add Room modal
  const [showAddRoom, setShowAddRoom] = useState(false)

  // Complete Queue modal
  const [showComplete, setShowComplete] = useState(false)
  const [completingItem, setCompletingItem] = useState<QueueItem | null>(null)
  const [completedProcs, setCompletedProcs] = useState<CompletedProcedure[]>([])
  const [procSelect, setProcSelect] = useState('')
  const [procQty, setProcQty] = useState(1)
  const [procDifficulty, setProcDifficulty] = useState<DifficultyLevel>('medium')

  // Cancel Queue modal
  const [showCancel, setShowCancel] = useState(false)
  const [cancellingItem, setCancellingItem] = useState<QueueItem | null>(null)
  const [showCompleted, setShowCompleted] = useState(false)
  const [showCancelled, setShowCancelled] = useState(false)

  // Appointment registration modal
  const [showAppointment, setShowAppointment] = useState(false)
  const [apptForm, setApptForm] = useState({
    patientName: '', phone: '',
    appointmentTime: '',
    isOnTime: true, lateMinutes: 0,
    branchId: '', procedureId: '', practitionerName: '',
  })
  const [cancelReason, setCancelReason] = useState('')

  const showToastMsg = useCallback((message: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToast({ message, type })
    setTimeout(() => setToast(null), 3000)
  }, [])

  // ═══════ Online booking patients not yet arrived ═══════
  const notArrivedOnlineQueue = useMemo(() => {
    return queue.filter(q => q.bookingMode === 'remote' && !q.arrived && q.status === 'waiting')
  }, [queue])

  // Mark online booking patient as arrived
  const markAsArrived = (item: QueueItem) => {
    const timeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`
    // Calculate if on time or late
    const bookedTime = item.bookedTimeSlot || item.time
    const [bh, bm] = bookedTime.split(':').map(Number)
    const [ah, am] = timeStr.split(':').map(Number)
    const bookedMin = bh * 60 + bm
    const arriveMin = ah * 60 + am
    const diff = arriveMin - bookedMin
    const isOnTime = diff <= 10 // 10 min tolerance
    const lateMinutes = diff > 10 ? diff : 0

    const updated = {
      ...item,
      arrived: true,
      arrivedAt: timeStr,
      checkinAt: timeStr,
      isOnTime,
      lateMinutes,
      assignedRoom: 0,
      assignedDoctor: '',
    }
    setQueue(prev => prev.map(q => q.id === item.id ? updated : q))
    saveQueueItem(updated)
    showToastMsg(`${item.number} ${item.patientName} — เช็คอิน${isOnTime ? 'ตรงเวลา' : `ช้า ${lateMinutes} นาที`}`, isOnTime ? 'success' : 'info')
  }

  // ═══════ All queue items (walk-in only) ═══════
  const arrivedQueue = useMemo(() => {
    let q = queue.filter(qi => qi.arrived)
    if (providerRoomIds) {
      q = q.filter(qi => providerRoomIds.includes(qi.assignedRoom))
    }
    return q
  }, [queue, providerRoomIds])

  // Completed items filtered by provider name (for provider view)
  const providerCompletedQueue = useMemo(() => {
    if (!isProvider || !user) return []
    const firstName = user.name.split(' ').slice(0, 2).join(' ')
    return queue.filter(qi => qi.status === 'completed' && qi.assignedDoctor && qi.assignedDoctor.includes(firstName))
  }, [queue, isProvider, user])

  const stats = useMemo(() => ({
    total: queue.length,
    arrived: arrivedQueue.length,
    serving: queue.filter(q => q.status === 'serving').length,
    completed: queue.filter(q => q.status === 'completed').length,
    waiting: queue.filter(q => q.status === 'waiting' && q.arrived).length,
    cancelled: queue.filter(q => q.status === 'cancelled').length,
  }), [queue, arrivedQueue])

  const roomStatus = useMemo(() => {
    return activeRooms.map((room, i) => {
      const serving = queue.find(q => q.assignedRoom === room.id && q.status === 'serving')
      const branch = branchData.branches.find(b => b.id === room.branchId)
      // Use room's color from RoomSettings, fallback to roomColors if not set
      const roomColor = room.color || roomColors[i % roomColors.length]
      return { ...room, serving, branchName: branch?.name || '', color: roomColor }
    })
  }, [activeRooms, queue, branchData])

  // ═══ Waiting queue grouped by branch (with room colors) ═══
  const waitingByBranch = useMemo(() => {
    const waitingItems = arrivedQueue.filter(q => q.status === 'waiting')
    const groups: Record<string, { branchName: string; color: string; items: typeof waitingItems; rooms: { id: number; name: string; color: string }[] }> = {}

    waitingItems.forEach(item => {
      // Find branch: first by branchId, then by procedureId
      let branchId = item.branchId || ''
      let branch = branchData.branches.find(b => b.id === branchId)
      if (!branch && item.procedureId) {
        branch = branchData.branches.find(b => b.procedures.some(p => p.id === item.procedureId))
        if (branch) branchId = branch.id
      }
      if (!branch && item.procedure) {
        branch = branchData.branches.find(b => b.procedures.some(p => p.name === item.procedure))
        if (branch) branchId = branch.id
      }
      if (!branchId) branchId = '__unknown__'
      if (!groups[branchId]) {
        const branchRooms = branchData.rooms.filter(r => r.branchId === branchId && r.active)
        const branchColor = branchRooms.length > 0 ? branchRooms[0].color : '#93C5FD'
        groups[branchId] = {
          branchName: branch?.name || 'ไม่ระบุสาขา',
          color: branchColor,
          items: [],
          rooms: branchRooms.map(r => ({ id: r.id, name: r.name, color: r.color })),
        }
      }
      groups[branchId].items.push(item)
    })

    return Object.values(groups)
  }, [arrivedQueue, branchData])

  const nextQueue = useMemo(() => queue.find(q => q.status === 'waiting' && q.arrived), [queue])

  // Track which rooms are currently occupied by serving patients
  const occupiedRoomIds = useMemo(() => {
    return new Set(queue.filter(q => q.status === 'serving').map(q => q.assignedRoom))
  }, [queue])

  // Find an available room for a procedure (skipping occupied rooms)
  const findAvailableRoomForProcedure = useCallback((procId: string) => {
    const preferred = findRoomForProcedure(branchData, procId)
    if (preferred && !occupiedRoomIds.has(preferred.id)) return preferred
    const branch = branchData.branches.find(b => b.procedures.some(p => p.id === procId))
    if (branch) {
      const available = branchData.rooms.find(r => r.branchId === branch.id && r.active && !occupiedRoomIds.has(r.id))
      if (available) return available
    }
    const anyAvailable = branchData.rooms.find(r => r.active && !occupiedRoomIds.has(r.id))
    return anyAvailable || preferred
  }, [branchData, occupiedRoomIds])

  // ═══════ Actions ═══════

  // Find ALL available rooms for a queue item, scored by match
  const findAvailableRoomsForItem = useCallback((item: QueueItem) => {
    const procId = item.procedureId
    const branch = branchData.branches.find(b => b.procedures.some(p => p.id === procId))
    const results: { room: typeof activeRooms[0]; branchName: string; practitionerName: string; matchScore: number }[] = []

    activeRooms.forEach(room => {
      if (occupiedRoomIds.has(room.id)) return
      const roomBranch = branchData.branches.find(b => b.id === room.branchId)
      const practitionerName = getPractitionerNameFromRoom(room)
      let matchScore = 0
      // Best match: room's branch matches patient's procedure branch
      if (branch && room.branchId === branch.id) matchScore = 2
      // Good match: room can do this procedure
      if (roomBranch?.procedures.some(p => p.id === procId)) matchScore = Math.max(matchScore, 1)
      results.push({
        room,
        branchName: roomBranch?.name || '',
        practitionerName: practitionerName.split(' ').slice(0, 2).join(' '),
        matchScore,
      })
    })
    // Only show rooms from the same branch as patient's procedure
    // If no matching rooms, show all (fallback)
    const matchingBranchRooms = results.filter(r => r.matchScore >= 1)
    const finalRooms = matchingBranchRooms.length > 0 ? matchingBranchRooms : results
    // Sort: best match first, then by room id
    finalRooms.sort((a, b) => b.matchScore - a.matchScore || a.room.id - b.room.id)
    return finalRooms
  }, [activeRooms, branchData, occupiedRoomIds])

  // Open confirmation popup before calling queue item
  const openConfirmCall = (item: QueueItem) => {
    setConfirmCallItem(item)
    setShowConfirmCall(true)
  }

  // User confirms patient is present → proceed to room selection
  const confirmPatientPresent = () => {
    if (!confirmCallItem) return
    setShowConfirmCall(false)
    const item = confirmCallItem
    setConfirmCallItem(null)
    openRoomSelect(item)
  }

  // User skips patient → move to end of queue and call next
  const skipAndCallNext = () => {
    if (!confirmCallItem) return
    const skippedItem = confirmCallItem
    setShowConfirmCall(false)
    setConfirmCallItem(null)
    // Move to end of queue
    setQueue(prev => {
      const item = prev.find(q => q.id === skippedItem.id)
      if (!item) return prev
      const rest = prev.filter(q => q.id !== skippedItem.id)
      return [...rest, item]
    })
    saveQueueItem({ ...skippedItem, time: skippedItem.time })
    showToastMsg(`ข้าม ${skippedItem.number} — เลื่อนไปท้ายคิว`, 'info')
    // Find and call next available
    setTimeout(() => {
      const nextItem = queue.find(q => q.id !== skippedItem.id && q.status === 'waiting' && q.arrived)
      if (nextItem) openRoomSelect(nextItem)
    }, 300)
  }

  // Open room selection modal for a queue item
  const openRoomSelect = (item: QueueItem) => {
    const rooms = findAvailableRoomsForItem(item)
    if (rooms.length === 0) {
      showToastMsg(`ไม่มีห้องว่าง — รอให้มีห้องเสร็จก่อน`, 'error')
      return
    }
    if (rooms.length === 1) {
      setAvailableRooms(rooms)
      confirmCallWithRoom(item, rooms[0].room.id, rooms)
      return
    }
    setRoomSelectItem(item)
    setAvailableRooms(rooms)
    setShowRoomSelect(true)
  }

  // Select room → open confirmation dialog
  const confirmCallWithRoom = (item: QueueItem, roomId: number, rooms?: typeof availableRooms) => {
    setShowRoomSelect(false)
    const pool = rooms || availableRooms
    const selected = pool.find(r => r.room.id === roomId)
    setRoomConfirmData({
      item,
      roomId,
      roomName: selected?.room.name || `ห้อง ${roomId}`,
      roomColor: selected?.room.color || config?.color || '#3B82F6',
      practitionerName: selected?.practitionerName || item.assignedDoctor || 'ไม่ระบุ',
    })
    setShowRoomConfirm(true)
  }

  // User confirms → actually send to room
  const handleConfirmSendToRoom = () => {
    if (!roomConfirmData) return
    const { item, roomId, practitionerName } = roomConfirmData
    const updated = {
      ...item,
      assignedRoom: roomId,
      assignedDoctor: practitionerName,
      status: 'serving' as const,
      servingAt: Date.now(),
    }
    setQueue(prev => prev.map(q => q.id === item.id ? updated : q))
    saveQueueItem(updated)
    playSound('called')
    notifyQueueCalled(item.number, roomId, item.patientName, item.phone, practitionerName)
    showToastMsg(`เรียก ${item.number} → ห้อง ${roomId} (${practitionerName})`, 'success')
    setShowRoomConfirm(false)
    setRoomConfirmData(null)
    setRoomSelectItem(null)
  }

  // User cancels room confirmation
  const cancelRoomConfirm = () => {
    setShowRoomConfirm(false)
    setRoomConfirmData(null)
  }

  // Call next (open confirm popup first)
  const callNext = () => {
    if (!nextQueue) return
    openConfirmCall(nextQueue)
  }

  // Add new room handler
  const handleAddRoom = () => {
    // Refresh daily rooms from localStorage
    const saved = localStorage.getItem(dailyRoomKey)
    if (saved) {
      try {
        setDailyRooms(JSON.parse(saved))
      } catch {}
    }
    showToastMsg(`เพิ่มห้องตรวจวันนี้สำเร็จ!`, 'success')
  }

  const handleRegisterAppointment = () => {
    if (!apptForm.patientName.trim() || !apptForm.appointmentTime || !apptForm.branchId || !apptForm.procedureId) {
      showToastMsg('กรุณากรอกข้อมูลให้ครบทุกช่อง', 'error')
      return
    }
    if (apptForm.phone && apptForm.phone.length !== 10 && apptForm.phone.length !== 0) {
      showToastMsg('เบอร์โทรศัพท์ต้องเป็นตัวเลข 10 หลัก', 'error')
      return
    }
    const branch = branchData.branches.find(b => b.id === apptForm.branchId)
    const proc = branch?.procedures.find(p => p.id === apptForm.procedureId)
    const timeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`
    // Determine if late
    const [ah, am] = apptForm.appointmentTime.split(':').map(Number)
    const [ch, cm] = timeStr.split(':').map(Number)
    const diffMinutes = (ch * 60 + cm) - (ah * 60 + am)
    const isOnTime = diffMinutes <= 10
    const lateMins = isOnTime ? 0 : diffMinutes

    const newItem: Omit<QueueItem, 'id'> = {
      number: `E${(queue.length + 100).toString().padStart(3, '0')}`,
      patientName: apptForm.patientName.trim(),
      phone: apptForm.phone.trim(),
      procedure: proc?.name || '',
      procedureId: apptForm.procedureId,
      branchId: apptForm.branchId,
      bookingMode: 'appointment',
      assignedRoom: 0,
      assignedDoctor: apptForm.practitionerName,
      status: 'waiting',
      time: apptForm.appointmentTime,
      bookedAt: new Date().toISOString().split('T')[0],
      arrivalTime: timeStr,
      arrived: true,
      arrivedAt: timeStr,
      appointmentTime: apptForm.appointmentTime,
      appointmentDate: new Date().toISOString().split('T')[0],
      appointmentOnTime: isOnTime,
      isOnTime,
      lateMinutes: lateMins,
      originalBookedTime: apptForm.appointmentTime,
      hn: `HN${(queue.length + 100).toString()}`,
      queuePosition: arrivedQueue.filter(q => q.status === 'waiting').length + 1,
    }
    addQueueItem(newItem as any)
    showToastMsg(`ลงทะเบียนนัดสำเร็จ! ${apptForm.patientName} ${isOnTime ? '✓ มาตามนัด' : `⚠ ช้า ${lateMins} น.`}`, 'success')
    setShowAppointment(false)
    setApptForm({ patientName: '', phone: '', appointmentTime: '', isOnTime: true, lateMinutes: 0, branchId: '', procedureId: '', practitionerName: '' })
    // Redirect to main page after 1 second
    setTimeout(() => { window.location.href = '/' }, 1000)
  }

  const openCompleteModal = (item: QueueItem) => {
    setCompletingItem(item)
    setCompletedProcs([])
    setProcSelect('')
    setProcQty(1)
    setProcDifficulty('medium')
    setShowComplete(true)
  }

  const addCompletedProc = () => {
    if (!procSelect) {
      showToastMsg('กรุณาเลือกหัตถการ', 'error')
      return
    }
    const allFlat = allProcedures.flatMap(bp => bp.procedures)
    const proc = allFlat.find(p => p.id === procSelect)
    if (!proc) return

    const newProc: CompletedProcedure = {
      procedureId: procSelect,
      name: proc.name,
      quantity: procQty,
      difficulty: procDifficulty,
    }
    setCompletedProcs(prev => [...prev, newProc])
    setProcSelect('')
    setProcQty(1)
    setProcDifficulty('medium')
    showToastMsg(`เพิ่ม ${proc.name} x${procQty} แล้ว`, 'success')
  }

  const removeCompletedProc = (index: number) => {
    setCompletedProcs(prev => prev.filter((_, i) => i !== index))
  }

  const confirmComplete = () => {
    if (!completingItem) return
    if (completedProcs.length === 0) {
      showToastMsg('กรุณาระบุหัตถการอย่างน้อย 1 รายการ', 'error')
      return
    }
    const servingTime = completingItem.servingAt || Date.now()
    const totalDur = Math.max(1, Math.round((Date.now() - servingTime) / 60000))
    const timeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`

    const updated = {
      ...completingItem,
      status: 'completed' as const,
      completedProcedures: completedProcs,
      completedAt: timeStr,
      totalDuration: totalDur,
    }
    setQueue(prev => prev.map(q => q.id === completingItem.id ? updated : q))
    saveQueueItem(updated)
    // Save completed_procedures to Supabase
    if (completedProcs.length > 0) {
      addCompletedProcedures(completingItem.id, completedProcs.map(p => ({
        procedure_id: p.procedureId,
        name: p.name,
        quantity: p.quantity,
        difficulty: p.difficulty,
      }))).catch(() => {})
    }
    playSound('completed')
    notifyQueueCompleted(completingItem.number, completingItem.patientName, completingItem.phone)
    setShowComplete(false)
    setCompletingItem(null)
    showToastMsg(`เสร็จสิ้น ${completingItem.number} — ${completedProcs.length} หัตถการ — เวลา ${totalDur} นาที`, 'success')
  }

  const skipQueue = (id: string) => {
    setQueue(prev => {
      const item = prev.find(q => q.id === id)
      if (!item) return prev
      return [...prev.filter(q => q.id !== id), item]
    })
    showToastMsg('ข้ามคิว', 'info')
  }

  // Return patient to queue (from room back to counter)
  const returnToQueue = (item: QueueItem) => {
    const updated = { ...item, status: 'waiting' as const, assignedRoom: 0, assignedDoctor: '' }
    setQueue(prev => prev.map(q => q.id === item.id ? updated : q))
    saveQueueItem(updated)
    showToastMsg(`คืนคิว ${item.number} — ${item.patientName} กลับไปรอที่เคานเตอร์แล้ว`, 'success')
  }

  // Cancel queue item
  const openCancelModal = (item: QueueItem) => {
    setCancellingItem(item)
    setCancelReason('')
    setShowCancel(true)
  }

  const confirmCancel = () => {
    if (!cancellingItem) return
    if (!cancelReason.trim()) {
      showToastMsg('กรุณาระบุสาเหตุที่ยกเลิก', 'error')
      return
    }
    const timeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`
    const updated = {
      ...cancellingItem,
      status: 'cancelled' as const,
      cancelReason: cancelReason.trim(),
      cancelledAt: timeStr,
    }
    setQueue(prev => prev.map(q => q.id === cancellingItem.id ? updated : q))
    saveQueueItem(updated)
    setShowCancel(false)
    setCancellingItem(null)
    setCancelReason('')
    showToastMsg(`ยกเลิกคิว ${cancellingItem.number} แล้ว`, 'info')
  }

  if (!config) return null

  // ═══════ Helper: render queue item ═══════
  const renderQueueItem = (item: QueueItem, waitInfo?: { aheadCount: number; estimatedWaitMinutes: number }) => {
    const modeCfg = bookingModeLabels[item.bookingMode]
    const elapsedWait = (item.status === 'waiting' && item.arrived) ? getElapsedMinutes(item.arrivalTime || item.arrivedAt || item.time) : null
    const positionLabel = item.queuePosition ? `คิวที่ ${item.queuePosition}` : item.number

    return (
      <div key={item.id} className="px-5 py-4 hover:bg-gray-50/50 transition-colors border-b border-gray-100 last:border-0">
        <div className="flex items-start justify-between gap-4">
          {/* Left: Queue number + Patient info */}
          <div className="flex items-start gap-4 min-w-0">
            {/* Queue Number Block */}
            <div className="flex-shrink-0 text-center">
              <div className="w-14 h-14 rounded-xl flex flex-col items-center justify-center font-bold shadow-sm"
                style={{
                  backgroundColor: item.status === 'serving' ? config.color : item.status === 'completed' ? '#E2E8F0' : item.status === 'cancelled' ? '#FEE2E2' : `${config.color}12`,
                  color: item.status === 'completed' ? '#94A3B8' : item.status === 'cancelled' ? '#EF4444' : item.status === 'serving' ? '#FFF' : config.color,
                }}>
                <span className="text-base leading-none font-extrabold">{item.number.charAt(0)}</span>
                <span className="text-xs font-bold">{item.number.slice(1)}</span>
              </div>
              <p className="text-[10px] text-gray-400 mt-1 font-medium">{positionLabel}</p>
            </div>

            {/* Patient Details */}
            <div className="min-w-0 flex-1">
              {/* Name + HN + Badges */}
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-base font-bold text-gray-900 truncate">{item.patientName}</span>
                {item.hn && <span className="text-xs text-gray-400 font-mono">HN: {item.hn}</span>}
                {/* Status badges */}
                <span className={clsx('text-xs px-2 py-0.5 rounded-full font-bold border',
                  item.status === 'waiting' && 'bg-amber-50 text-amber-600 border-amber-200',
                  item.status === 'serving' && 'bg-green-50 text-green-700 border-green-200',
                  item.status === 'completed' && 'bg-gray-100 text-gray-500 border-gray-200',
                  item.status === 'cancelled' && 'bg-red-50 text-red-500 border-red-200',
                )}>
                  {item.status === 'waiting' && 'รอคิว'}
                  {item.status === 'serving' && 'กำลังทำ'}
                  {item.status === 'completed' && 'เสร็จสิ้น'}
                  {item.status === 'cancelled' && 'ยกเลิก'}
                </span>
                {/* Booking mode badge */}
                <span className={clsx('text-xs px-2 py-0.5 rounded-full font-medium border', modeCfg.bg, modeCfg.color, 'border-current/20')}>
                  {modeCfg.icon} {modeCfg.label}
                </span>
                {/* Check-in time badge */}
                {item.arrived && item.arrivedAt && (
                  <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-emerald-50 text-emerald-600 border border-emerald-200">
                    เข้าคิวแล้ว {formatTimeShort(item.arrivedAt)}
                  </span>
                )}
                {/* Appointment on-time/late */}
                {item.bookingMode === 'appointment' && item.arrived && (
                  <span className={clsx('text-xs px-2 py-0.5 rounded-full font-medium border', item.appointmentOnTime ? 'bg-green-50 text-green-600 border-green-200' : 'bg-orange-50 text-orange-600 border-orange-200')}>
                    {item.appointmentOnTime ? '✓ มาตามนัด' : `⚠ ช้า ${item.lateMinutes} น.`}
                  </span>
                )}
                {/* Online check-in status */}
                {item.bookingMode === 'remote' && item.checkinAt && (
                  <span className={clsx('text-xs px-2 py-0.5 rounded-full font-medium border', item.isOnTime ? 'bg-green-50 text-green-600 border-green-200' : 'bg-orange-50 text-orange-600 border-orange-200')}>
                    {item.isOnTime ? '✓ เช็คอินตรงเวลา' : `⚠ ช้า ${item.lateMinutes} น.`}
                  </span>
                )}
              </div>

              {/* Info row: Time, Procedure, Wait */}
              <div className="flex items-center gap-3 mt-2 flex-wrap">
                {/* Appointment/Booked time */}
                {(item.appointmentTime || item.bookedTimeSlot) && (
                  <span className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-lg bg-gray-100 text-gray-600 font-medium">
                    🕐 บัตร {item.appointmentTime || item.bookedTimeSlot} น.
                  </span>
                )}
                {/* Phone */}
                {item.phone && typeof item.phone === 'string' && (
                  <a href={`tel:${item.phone.replace(/-/g, '')}`} className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-lg bg-teal-50 text-teal-600 font-medium hover:bg-teal-100 hover:text-teal-700 hover:underline cursor-pointer">
                    📞 {item.phone}
                  </a>
                )}
                {/* Procedure */}
                <span className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-lg bg-blue-50 text-blue-600 font-medium">
                  📋 {item.procedure}
                </span>
                {/* Room (if serving) */}
                {item.status === 'serving' && (
                  <span className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-lg bg-purple-50 text-purple-600 font-medium">
                    🏥 ห้อง {item.assignedRoom} • {item.assignedDoctor.split(' ')[0]}
                  </span>
                )}
                {/* Wait time */}
                {elapsedWait !== null && (
                  <span className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-lg bg-orange-50 text-orange-600 font-bold">
                    ⏳ รอ {elapsedWait} นาที
                  </span>
                )}
                {/* Estimated wait */}
                {waitInfo && item.status === 'waiting' && (
                  <span className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-lg bg-amber-50 text-amber-600 font-medium">
                    ประมาณ {waitInfo.estimatedWaitMinutes} น.
                  </span>
                )}
              </div>

              {/* Completed procedures */}
              {item.completedProcedures && item.completedProcedures.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {item.completedProcedures.map((proc, i) => (
                    <span key={i} className="inline-flex items-center gap-1 text-xs px-2 py-0.5 bg-green-50 text-green-700 rounded-full border border-green-100">
                      ✓ {proc.name} x{proc.quantity}
                    </span>
                  ))}
                  <span className="inline-flex items-center text-xs px-2 py-0.5 bg-blue-50 text-blue-600 rounded-full font-bold">
                    {item.totalDuration} น.
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Right: Action Buttons */}
          <div className="flex flex-col gap-1.5 flex-shrink-0">
            {item.status === 'serving' ? (
              <>
                <button onClick={() => openCompleteModal(item)} className="px-4 py-2 rounded-lg text-sm font-bold transition-all flex items-center gap-1.5 border-2 border-emerald-500 text-emerald-600 hover:bg-emerald-50">
                  <CheckCircle className="w-4 h-4" /> เสร็จ
                </button>
                <button onClick={() => openCancelModal(item)} className="px-4 py-2 rounded-lg text-sm font-bold transition-all flex items-center gap-1.5 border-2 border-red-300 text-red-500 hover:bg-red-50">
                  <Ban className="w-4 h-4" /> ยกเลิก
                </button>
              </>
            ) : item.status === 'waiting' && item.arrived ? (
              <>
                <button onClick={() => openConfirmCall(item)} className="px-4 py-2 rounded-lg text-sm font-bold transition-all flex items-center gap-1.5 border-2 border-emerald-500 text-emerald-600 hover:bg-emerald-50">
                  <Play className="w-4 h-4" /> เรียก
                </button>
                <button onClick={() => openCancelModal(item)} className="px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-1.5 border-2 border-red-200 text-red-500 hover:bg-red-50">
                  <Ban className="w-4 h-4" /> ยกเลิก
                </button>
              </>
            ) : item.status === 'cancelled' ? (
              <span className="text-xs text-red-400 font-bold px-3 py-2">❌ ยกเลิก</span>
            ) : (
              <span className="text-xs text-gray-300 font-bold px-3 py-2">✓ เสร็จ</span>
            )}
          </div>
        </div>
      </div>
    )
  }

  // Check if any room is within 30 minutes of closing
  const closingWarnings = useMemo(() => {
    const warnings: { roomName: string; practitionerName: string; endTime: string; minsLeft: number }[] = []
    const nowMinutes = now.getHours() * 60 + now.getMinutes()
    activeRooms.forEach(room => {
      if (!room.workingEndTime) return
      const [ch, cm] = room.workingEndTime.split(':').map(Number)
      const closeMinutes = ch * 60 + cm
      const minsLeft = closeMinutes - nowMinutes
      if (minsLeft <= 30 && minsLeft > 0) {
        warnings.push({
          roomName: room.name || `ห้อง ${room.id}`,
          practitionerName: room.practitionerName || 'ไม่ระบุ',
          endTime: room.workingEndTime,
          minsLeft,
        })
      }
    })
    return warnings
  }, [activeRooms, now])

  return (
    <div className="space-y-4 page-enter">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      {/* 30-minute end-of-shift warning */}
      {closingWarnings.length > 0 && (
        <div className="bg-orange-50 border border-orange-200 rounded-2xl p-4">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-xl bg-orange-100 flex items-center justify-center flex-shrink-0">
              <span className="text-lg">⏰</span>
            </div>
            <div>
              <p className="text-sm font-bold text-orange-700">⚠️ เตือน: ใกล้หมดเวลาทำการ</p>
              {closingWarnings.map((w, i) => (
                <p key={i} className="text-xs text-orange-600 mt-1">
                  {w.roomName} ({w.practitionerName}) — เหลือเวลาอีก <strong>{w.minsLeft} นาที</strong> (ปิด {w.endTime} น.)
                </p>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ═══════ APPOINTMENT REGISTRATION MODAL ═══════ */}
      {showAppointment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg animate-scale-in">
            <div className="p-6">
              <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-orange-100 flex items-center justify-center">
                    <Clock className="w-5 h-5 text-orange-600" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-gray-900">📋 ลงทะเบียนคนไข้นัด</h2>
                    <p className="text-xs text-gray-500">ระบุข้อมูลการนัดของคนไข้</p>
                  </div>
                </div>
                <button onClick={() => setShowAppointment(false)} className="p-2 hover:bg-gray-100 rounded-xl"><X className="w-5 h-5" /></button>
              </div>

              <div className="space-y-4">
                {/* Patient name */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">ชื่อคนไข้</label>
                  <input type="text" value={apptForm.patientName} onChange={e => setApptForm(f => ({ ...f, patientName: e.target.value }))} className="input-field" placeholder="เช่น สมชาย ใจดี" />
                </div>
                {/* Phone */}
                <PhoneInput
                  label="เบอร์โทรศัพท์"
                  value={apptForm.phone}
                  onChange={(v) => setApptForm(f => ({ ...f, phone: v }))}
                  required
                />
                {/* Appointment time */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">⏰ เวลาที่นัด</label>
                  <input type="time" value={apptForm.appointmentTime} onChange={e => setApptForm(f => ({ ...f, appointmentTime: e.target.value }))} className="input-field" />
                </div>
                {/* On time or late */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">สถานะการมา</label>
                  <div className="flex gap-2">
                    <button onClick={() => setApptForm(f => ({ ...f, isOnTime: true, lateMinutes: 0 }))} className={clsx('flex-1 py-2.5 rounded-xl text-sm font-bold border-2 transition-all', apptForm.isOnTime ? 'border-green-400 bg-green-50 text-green-700' : 'border-gray-200 bg-white text-gray-500 hover:border-green-300')}>
                      ✅ มาตามนัด
                    </button>
                    <button onClick={() => setApptForm(f => ({ ...f, isOnTime: false }))} className={clsx('flex-1 py-2.5 rounded-xl text-sm font-bold border-2 transition-all', !apptForm.isOnTime ? 'border-orange-400 bg-orange-50 text-orange-700' : 'border-gray-200 bg-white text-gray-500 hover:border-orange-300')}>
                      ⚠️ มาล่าช้า
                    </button>
                  </div>
                  {!apptForm.isOnTime && (
                    <div className="mt-2">
                      <label className="block text-xs text-gray-500 mb-1">ล่าช้ากี่นาที</label>
                      <input type="number" min={0} value={apptForm.lateMinutes} onChange={e => setApptForm(f => ({ ...f, lateMinutes: parseInt(e.target.value) || 0 }))} className="input-field" placeholder="นาที" />
                    </div>
                  )}
                </div>
                {/* Branch */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">🏥 สาขา</label>
                  <select value={apptForm.branchId} onChange={e => setApptForm(f => ({ ...f, branchId: e.target.value, procedureId: '' }))} className="input-field">
                    <option value="">-- เลือกสาขา --</option>
                    {branchData.branches.filter(b => b.active).map(b => (
                      <option key={b.id} value={b.id}>{b.name}</option>
                    ))}
                  </select>
                </div>
                {/* Procedure */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">🦷 หัตถการ</label>
                  <select value={apptForm.procedureId} onChange={e => setApptForm(f => ({ ...f, procedureId: e.target.value }))} className="input-field" disabled={!apptForm.branchId}>
                    <option value="">-- เลือกหัตถการ --</option>
                    {branchData.branches.find(b => b.id === apptForm.branchId)?.procedures.filter(p => p.active).map(p => (
                      <option key={p.id} value={p.id}>{p.name} (~{p.estimatedDuration} น.)</option>
                    ))}
                  </select>
                </div>
                {/* Practitioner */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">👨‍⚕️ แพทย์ผู้นัด</label>
                  <select value={apptForm.practitionerName} onChange={e => setApptForm(f => ({ ...f, practitionerName: e.target.value }))} className="input-field">
                    <option value="">-- เลือกแพทย์ --</option>
                    {practitioners.filter(p => p.active && (!currentClinic || p.branchId === '' || branchData.branches.some(b => b.id === p.branchId && b.active))).map(p => (
                      <option key={p.id} value={p.name}>{p.name}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
            <div className="px-6 pb-6 flex gap-3">
              <button onClick={() => setShowAppointment(false)} className="flex-1 py-3 rounded-2xl font-bold text-gray-500 bg-gray-100 hover:bg-gray-200 transition-colors">
                ยกเลิก
              </button>
              <button onClick={handleRegisterAppointment} className="flex-1 py-3 rounded-2xl font-bold text-white shadow-lg transition-all" style={{ backgroundColor: '#F97316' }}>
                ✅ ลงทะเบียนนัด
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══════ ROOM SELECTION MODAL ═══════ */}
      {showRoomSelect && roomSelectItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md max-h-[80vh] overflow-y-auto animate-scale-in">
            <div className="flex items-center justify-between p-5 border-b border-gray-100">
              <div>
                <h2 className="text-xl font-bold text-gray-900">🚪 เลือกห้องตรวจ</h2>
                <p className="text-base text-gray-500 mt-1">
                  <span className="font-semibold">{roomSelectItem.number}</span> {roomSelectItem.patientName} — {roomSelectItem.procedure}
                </p>
              </div>
              <button onClick={() => { setShowRoomSelect(false); setRoomSelectItem(null) }} className="p-2 hover:bg-gray-100 rounded-lg">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            <div className="p-4 space-y-2">
              {availableRooms.map(({ room, branchName, practitionerName, matchScore }) => (
                <button
                  key={room.id}
                  onClick={() => confirmCallWithRoom(roomSelectItem, room.id)}
                  className="w-full flex items-center gap-4 p-4 rounded-xl border-2 hover:shadow-md transition-all text-left"
                  style={{
                    borderColor: matchScore >= 2 ? room.color : matchScore >= 1 ? '#D1D5DB' : '#E5E7EB',
                    backgroundColor: matchScore >= 2 ? `${room.color}08` : '#FFFFFF',
                  }}
                >
                  <div className="w-12 h-12 rounded-xl flex items-center justify-center text-white text-lg font-bold flex-shrink-0"
                    style={{ backgroundColor: room.color }}>
                    {room.id}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-lg font-bold text-gray-900">{room.name}</p>
                    <p className="text-base text-gray-600">👨‍⚕️ {practitionerName}</p>
                    {branchName && (
                      <p className="text-sm mt-0.5">
                        <span className="px-2 py-0.5 rounded-full font-medium" style={{ backgroundColor: `${room.color}15`, color: room.color }}>{branchName}</span>
                      </p>
                    )}
                  </div>
                  <div className="flex-shrink-0 text-right">
                    {matchScore >= 2 ? (
                      <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-bold text-green-700 bg-green-100">
                        ✅ ตรงสาขา
                      </span>
                    ) : matchScore >= 1 ? (
                      <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium text-blue-600 bg-blue-50">
                        ✓ ทำได้
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm text-gray-400 bg-gray-50">
                        ว่าง
                      </span>
                    )}
                  </div>
                </button>
              ))}
              {availableRooms.length === 0 && (
                <div className="py-8 text-center text-gray-400 text-base">
                  ไม่มีห้องว่างในขณะนี้
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ═══════ ROOM CONFIRM MODAL ═══════ */}
      {showRoomConfirm && roomConfirmData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm animate-scale-in">
            <div className="p-6 text-center">
              {/* Room icon */}
              <div className="w-16 h-16 rounded-2xl mx-auto mb-4 flex items-center justify-center text-white text-2xl font-bold shadow-lg" style={{ backgroundColor: roomConfirmData.roomColor }}>
                {roomConfirmData.roomId}
              </div>
              <h2 className="text-xl font-bold text-gray-900 mb-2">ยืนยันส่งเข้าห้องตรวจ</h2>
              <p className="text-base text-gray-500 mb-4">ตรวจสอบข้อมูลก่อนส่งคนไข้เข้าห้อง</p>
              {/* Patient info */}
              <div className="bg-gray-50 rounded-2xl p-4 mb-5 text-left space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm text-gray-500">คิว</span>
                  <span className="text-sm font-bold text-gray-900">{roomConfirmData.item.number}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-500">ชื่อคนไข้</span>
                  <span className="text-sm font-bold text-gray-900">{roomConfirmData.item.patientName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-500">หัตถการ</span>
                  <span className="text-sm font-bold text-gray-900">{roomConfirmData.item.procedure}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-500">ห้องตรวจ</span>
                  <span className="text-sm font-bold" style={{ color: roomConfirmData.roomColor }}>{roomConfirmData.roomName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-500">แพทย์ผู้รักษา</span>
                  <span className="text-sm font-bold text-gray-900">👨‍⚕️ {roomConfirmData.practitionerName}</span>
                </div>
              </div>
              {/* Action buttons */}
              <div className="space-y-3">
                <button
                  onClick={handleConfirmSendToRoom}
                  className="w-full py-3.5 rounded-xl font-bold text-white text-base transition-all shadow-lg hover:shadow-xl flex items-center justify-center gap-2"
                  style={{ backgroundColor: roomConfirmData.roomColor }}
                >
                  ✅ ยืนยันส่งเข้าห้องตรวจ
                </button>
                <button
                  onClick={cancelRoomConfirm}
                  className="w-full py-3 rounded-xl font-medium text-gray-500 bg-gray-100 text-sm transition-all hover:bg-gray-200 flex items-center justify-center gap-2"
                >
                  ⬅️ กลับไปเลือกห้องใหม่
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ═══════ COMPLETE QUEUE MODAL ═══════ */}
      {showComplete && completingItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto animate-scale-in">
            <div className="flex items-center justify-between p-5 border-b border-gray-100 sticky top-0 bg-white z-10">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold text-sm" style={{ backgroundColor: config.color }}>
                  {completingItem.number.charAt(0)}
                </div>
                <div>
                  <h2 className="text-lg font-bold text-gray-900">เสร็จสิ้น — {completingItem.number}</h2>
                  <p className="text-xs text-gray-500">{completingItem.patientName} • ห้อง {completingItem.assignedRoom} • {completingItem.assignedDoctor.split(' ')[0]}</p>
                </div>
              </div>
              <button onClick={() => setShowComplete(false)} className="p-2 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5 text-gray-500" /></button>
            </div>

            <div className="p-5 space-y-4">
              {/* Duration info */}
              {completingItem.servingAt && (
                <div className="p-3 bg-blue-50 rounded-xl flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-blue-500" />
                    <span className="text-xs text-blue-700 font-medium">เวลาในห้อง</span>
                  </div>
                  <span className="text-sm font-bold text-blue-700">
                    {Math.max(1, Math.round((Date.now() - completingItem.servingAt) / 60000))} นาที
                  </span>
                </div>
              )}

              {/* Added procedures list */}
              {completedProcs.length > 0 && (
                <div>
                  <h3 className="text-xs font-semibold text-gray-700 mb-2">หัตถการที่ทำแล้ว ({completedProcs.length})</h3>
                  <div className="space-y-1.5">
                    {completedProcs.map((proc, i) => (
                      <div key={i} className="flex items-center gap-2 p-2.5 bg-gray-50 rounded-lg">
                        <div className="w-7 h-7 rounded-lg flex items-center justify-center bg-white text-sm font-bold text-gray-600 shadow-sm">
                          {proc.quantity}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">{proc.name}</p>
                        </div>
                        <button onClick={() => removeCompletedProc(i)} className="p-1.5 hover:bg-red-50 rounded-lg transition-colors" title="ลบ">
                          <Trash2 className="w-3.5 h-3.5 text-gray-400 hover:text-red-500" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Add procedure form */}
              <div className="p-4 bg-gray-50 rounded-xl border border-gray-100">
                <h3 className="text-xs font-semibold text-gray-700 mb-3">➕ เพิ่มหัตถการ</h3>
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">เลือกหัตถการ</label>
                    <select
                      value={procSelect}
                      onChange={(e) => setProcSelect(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:border-primary-400 focus:outline-none text-sm bg-white"
                    >
                      <option value="">— เลือกหัตถการ —</option>
                      {allProcedures.map(group => (
                        <optgroup key={group.branch.id} label={group.branch.name}>
                          {group.procedures.map(p => (
                            <option key={p.id} value={p.id}>{p.name}</option>
                          ))}
                        </optgroup>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">จำนวน</label>
                    <input
                      type="number" min={1} max={99}
                      value={procQty}
                      onChange={(e) => setProcQty(Math.max(1, parseInt(e.target.value) || 1))}
                      className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:border-primary-400 focus:outline-none text-sm"
                    />
                  </div>
                  <button
                    onClick={addCompletedProc}
                    disabled={!procSelect}
                    className={clsx(
                      'w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all',
                      procSelect ? 'bg-white border-2 border-dashed border-gray-300 text-gray-700 hover:border-primary-400 hover:text-primary-600' : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                    )}
                  >
                    <Plus className="w-4 h-4" /> เพิ่ม
                  </button>
                </div>
              </div>

            </div>

            <div className="flex justify-end gap-3 p-5 border-t border-gray-100 sticky bottom-0 bg-white">
              <button onClick={() => setShowComplete(false)} className="px-4 py-2.5 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-200 transition-colors">
                ยกเลิก
              </button>
              <button
                onClick={confirmComplete}
                disabled={completedProcs.length === 0}
                className={clsx(
                  'flex items-center gap-2 px-6 py-2.5 rounded-lg text-sm font-bold transition-all',
                  completedProcs.length > 0 ? 'text-white shadow-lg hover:shadow-xl' : 'bg-gray-100 text-gray-300 cursor-not-allowed'
                )}
                style={completedProcs.length > 0 ? { backgroundColor: config.color, filter: 'brightness(0.85)' } : {}}
              >
                <CheckCircle className="w-4 h-4" />
                บันทึก ({completedProcs.length} หัตถการ)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══════ CANCEL QUEUE MODAL ═══════ */}
      {showCancel && cancellingItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm animate-scale-in">
            <div className="flex items-center justify-between p-5 border-b border-gray-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-red-100 flex items-center justify-center">
                  <Ban className="w-5 h-5 text-red-500" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-gray-900">ยกเลิกคิว</h2>
                  <p className="text-xs text-gray-500">{cancellingItem.number} • {cancellingItem.patientName}</p>
                </div>
              </div>
              <button onClick={() => setShowCancel(false)} className="p-2 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5 text-gray-500" /></button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">สาเหตุที่ยกเลิก *</label>
                <textarea
                  value={cancelReason}
                  onChange={e => setCancelReason(e.target.value)}
                  placeholder="เช่น คนไข้เปลี่ยนใจ, นัดหมายซ้ำ, เหตุฉุกเฉิน..."
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-red-200 focus:border-red-300 resize-none"
                  rows={3}
                />
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowCancel(false)}
                  className="flex-1 py-3 rounded-xl font-bold text-gray-500 bg-gray-100 hover:bg-gray-200 transition-colors text-sm"
                >
                  กลับ
                </button>
                <button
                  onClick={confirmCancel}
                  disabled={!cancelReason.trim()}
                  className="flex-1 py-3 rounded-xl font-bold text-white bg-red-500 hover:bg-red-600 transition-colors text-sm shadow-md disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <Ban className="w-4 h-4 inline mr-1" /> ยืนยันยกเลิก
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ═══════ CONFIRM CALL MODAL ═══════ */}
      {showConfirmCall && confirmCallItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm animate-scale-in">
            <div className="p-6 text-center">
              <div className="w-16 h-16 rounded-full mx-auto mb-4 flex items-center justify-center"
                style={{ backgroundColor: `${config.color}15` }}>
                <span className="text-3xl">📋</span>
              </div>
              <h2 className="text-xl font-bold text-gray-900 mb-2">เรียกคิว {confirmCallItem.number}</h2>
              <p className="text-base font-semibold text-gray-700 mb-1">{confirmCallItem.patientName}</p>
              {confirmCallItem.hn && <p className="text-sm text-gray-400 mb-3">HN: {confirmCallItem.hn}</p>}
              <p className="text-sm text-gray-500 mb-6">{confirmCallItem.procedure}</p>
              <div className="space-y-3">
                <button
                  onClick={confirmPatientPresent}
                  className="w-full py-3.5 rounded-xl font-bold text-white text-base transition-all shadow-lg hover:shadow-xl flex items-center justify-center gap-2"
                  style={{ backgroundColor: config.color }}
                >
                  ✅ คนไข้มาถึงแล้ว — ส่งเข้าห้องตรวจ
                </button>
                <button
                  onClick={skipAndCallNext}
                  className="w-full py-3.5 rounded-xl font-bold text-orange-600 bg-orange-50 border-2 border-orange-200 text-base transition-all hover:bg-orange-100 flex items-center justify-center gap-2"
                >
                  ⏭ ข้าม — เลื่อนไปท้ายคิว
                </button>
                <button
                  onClick={() => { setShowConfirmCall(false); setConfirmCallItem(null) }}
                  className="w-full py-2.5 rounded-xl text-sm font-medium text-gray-400 hover:text-gray-600 transition-colors"
                >
                  ยกเลิก
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ═══════ HEADER — Candy UI ═══════ */}
      <div className="candy-card p-0 overflow-hidden">
        {/* Top: Clinic info + clock */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-3 sm:py-4">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl flex items-center justify-center text-white font-extrabold text-lg shadow-lg animate-float" style={{ background: `linear-gradient(135deg, ${config.color}, ${config.color}cc)` }}>{config.prefix}</div>
            <div>
              <h1 className="text-lg font-extrabold text-gray-800">{settings.clinicName || config.name}</h1>
              <p className="text-xs text-pink-400 font-semibold">
                {now.toLocaleDateString('th-TH', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
              </p>
            </div>
          </div>
          <p className="text-xl font-extrabold text-gray-800 font-mono tabular-nums tracking-tight">{now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit', timeZone: 'Asia/Bangkok' })} ICT</p>
        </div>
        {/* Stats row - Mobile */}
        {!isProvider && (
        <div className="sm:hidden grid grid-cols-5 gap-1 px-3 py-2">
          <div className="text-center py-2 rounded-xl bg-pink-50/50">
            <p className="text-lg font-black tabular-nums" style={{ color: config.color }}>{stats.total}</p>
            <p className="text-[9px] font-bold text-pink-400">รวม</p>
          </div>
          <div className="text-center py-2 rounded-xl bg-amber-50/50">
            <p className="text-lg font-black text-amber-500 tabular-nums">{stats.waiting}</p>
            <p className="text-[9px] font-bold text-amber-400">รอ</p>
          </div>
          <div className="text-center py-2 rounded-xl bg-emerald-50/50">
            <p className="text-lg font-black text-emerald-500 tabular-nums">{stats.serving}</p>
            <p className="text-[9px] font-bold text-emerald-400">ทำ</p>
          </div>
          <div className="text-center py-2 rounded-xl bg-blue-50/50">
            <p className="text-lg font-black text-blue-500 tabular-nums">{stats.completed}</p>
            <p className="text-[9px] font-bold text-blue-400">เสร็จ</p>
          </div>
          <div className="text-center py-2 rounded-xl bg-red-50/50">
            <p className="text-lg font-black text-red-400 tabular-nums">{stats.cancelled}</p>
            <p className="text-[9px] font-bold text-red-400">ยกเลิก</p>
          </div>
        </div>
        )}
        {/* Stats row - Desktop */}
        {!isProvider && (
        <div className="hidden sm:grid grid-cols-5 divide-x divide-pink-100/50">
          <div className="text-center px-4 py-4 bg-pink-50/50">
            <p className="text-3xl font-black tabular-nums" style={{ color: config.color }}>{stats.total}</p>
            <p className="text-[11px] font-bold text-pink-400 mt-0.5">รวมวันนี้</p>
          </div>
          <div className="text-center px-4 py-4 bg-amber-50/50">
            <p className="text-3xl font-black text-amber-500 tabular-nums">{stats.waiting}</p>
            <p className="text-[11px] font-bold text-amber-400 mt-0.5">รอเรียก</p>
          </div>
          <div className="text-center px-4 py-4 bg-emerald-50/50">
            <p className="text-3xl font-black text-emerald-500 tabular-nums">{stats.serving}</p>
            <p className="text-[11px] font-bold text-emerald-400 mt-0.5">กำลังทำ</p>
          </div>
          <div className="text-center px-4 py-4 bg-blue-50/50">
            <p className="text-3xl font-black text-blue-500 tabular-nums">{stats.completed}</p>
            <p className="text-[11px] font-bold text-blue-400 mt-0.5">เสร็จแล้ว</p>
          </div>
          <div className="text-center px-4 py-4 bg-red-50/50">
            <p className="text-3xl font-black text-red-400 tabular-nums">{stats.cancelled}</p>
            <p className="text-[11px] font-bold text-red-400 mt-0.5">ยกเลิก</p>
          </div>
        </div>
        )}
      </div>

      {/* Action Buttons — Candy Pills */}
      {!isProvider && (
      <div className="flex flex-wrap items-center gap-2">
        <a href="/walkin?staff=1" className="candy-btn candy-btn-primary shadow-lg">
          <Plus className="w-4 h-4" /> ลงคิวคนไข้ {config?.name ? `(${config.name})` : ''}
        </a>
        {nextQueue && (
          <button onClick={callNext} className="candy-btn candy-btn-success shadow-lg">
            <Play className="w-4 h-4" /> เรียกคิวถัดไป ({nextQueue.number})
          </button>
        )}
        {!isProvider && (
          <a href="/tv" target="_blank" className="candy-btn shadow-lg" style={{ backgroundColor: '#8B5CF6', color: 'white' }}>
            <MonitorPlay className="w-4 h-4" /> จอ TV
          </a>
        )}
      </div>
      )}

      {/* ═══════ ROOM STATUS — Candy ═══════ */}
      <div className="candy-card p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">                    <h2 className="text-sm font-extrabold text-gray-800">🏥 สถานะห้องตรวจ ({roomStatus.length} ห้อง){isProvider && providerRoomIds && ` — ห้องของคุณ`}</h2>
            {!isProvider && (
              <button onClick={() => setShowAddRoom(true)} className="flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold bg-emerald-50 text-emerald-600 hover:bg-emerald-100 transition-colors">
                <Plus className="w-3 h-3" /> เพิ่มห้องตรวจ
              </button>
            )}
          </div>
          <div className="flex items-center gap-3 text-xs text-gray-500">
            <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-emerald-400" /> มีคนไข้ {roomStatus.filter(r => r.serving).length}</span>
            <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-gray-300" /> ว่าง {roomStatus.filter(r => !r.serving).length}</span>
          </div>
        </div>
        {roomStatus.length === 0 ? (
          <div className="text-center py-8">
            <div className="w-20 h-20 rounded-2xl mx-auto mb-4 flex items-center justify-center bg-amber-100">
              <span className="text-4xl">🏥</span>
            </div>
            <h3 className="text-lg font-extrabold text-gray-800 mb-2">⚠️ ยังไม่มีห้องตรวจวันนี้</h3>
            <p className="text-sm text-gray-500 mb-3 max-w-md mx-auto">
              กรุณาเพิ่มห้องตรวจเพื่อเริ่มใช้งานระบบจัดคิววันนี้
            </p>
            <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 mb-5 max-w-md mx-auto">
              <p className="text-xs text-blue-700 font-medium">
                📅 ห้องตรวจจะถูกรีเซ็ตทุกวัน — ต้องเพิ่มห้องใหม่เมื่อเริ่มวันใหม่หรือเลยเวลาปิดทำการ
              </p>
            </div>
            <button
              onClick={() => setShowAddRoom(true)}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl text-base font-bold text-white shadow-lg hover:shadow-xl transition-all"
              style={{ backgroundColor: config.color }}
            >
              <Plus className="w-5 h-5" /> เพิ่มห้องตรวจวันนี้
            </button>
          </div>
        ) : (
        <div className={clsx('candy-grid', roomStatus.length <= 2 ? 'candy-grid-2' : roomStatus.length <= 4 ? 'candy-grid-3' : '')}>
          {roomStatus.map((room) => (
            <div key={room.id} className="candy-card p-4 text-center transition-all"
              style={{ borderColor: room.serving ? room.color : undefined }}>
              {room.image ? (
                <img src={room.image} alt={room.name} className="w-10 h-10 rounded-lg mx-auto mb-1.5 object-cover border border-gray-200" />
              ) : (
                <div className="w-8 h-8 rounded-lg mx-auto mb-1.5 flex items-center justify-center text-white text-sm font-bold" style={{ backgroundColor: room.color }}>
                  {room.id}
                </div>
              )}
              <p className="text-xs font-bold text-gray-900">{room.name}</p>
              <p className="text-xs text-gray-500">{getPractitionerNameFromRoom(room).split(' ').slice(0, 2).join(' ')}</p>
              {room.branchName && (
                <p className="text-xs mt-0.5 px-1.5 py-0.5 rounded inline-block font-medium" style={{ backgroundColor: `${room.color}15`, color: room.color }}>{room.branchName}</p>
              )}
              {room.workingStartTime && room.workingEndTime && (
                <p className="text-[10px] text-gray-400 mt-0.5">🕐 {room.workingStartTime} - {room.workingEndTime}</p>
              )}
              <div className="mt-2">
                {room.serving ? (
                  <div className="px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700">
                    ✅ กำลังให้บริการ
                  </div>
                ) : (
                  <div className="px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-400">ว่าง</div>
                )}
              </div>
              {room.serving && (() => {
                const ot = room.serving.servingAt ? getOvertimeStatus(branchData, room.serving.procedureId, room.serving.servingAt, now.getTime()) : null
                return (
                  <>
                    {/* Procedure + elapsed timer */}
                    <div className="mt-2 px-2 py-1 rounded-lg text-xs font-bold" style={{ backgroundColor: `${room.color}15`, color: room.color }}>
                      <span className="truncate block">{room.serving.procedure}</span>
                      <span className="font-mono text-sm">⏱ {room.serving.servingAt ? Math.max(1, Math.floor((now.getTime() - room.serving.servingAt) / 60000)) : 0} น.</span>
                      {ot && <span className="text-[10px] font-normal text-gray-500"> / {ot.expected} น.</span>}
                    </div>
                    {/* Overtime warning */}
                    {ot?.isOvertime && (
                      <div className={`mt-1.5 px-2 py-0.5 rounded text-xs font-bold border ${ot.severity === 'critical' ? 'bg-red-50 text-red-600 border-red-200 animate-pulse' : 'bg-amber-50 text-amber-600 border-amber-200'}`}>                         ⏰ เลยเวลา {ot.overtimeBy} นาที
                      </div>
                    )}

                    <div className="mt-2 flex gap-1.5">
                      <button
                        onClick={() => openCompleteModal(room.serving!)}
                        className="flex-1 px-3 py-1.5 bg-emerald-700 text-white rounded-lg text-xs font-bold hover:bg-emerald-800 transition-colors flex items-center justify-center gap-1 shadow-md"
                      >
                        <CheckCircle className="w-3 h-3" /> เสร็จ
                      </button>
                      <button
                        onClick={() => returnToQueue(room.serving!)}
                        className="px-3 py-1.5 bg-amber-100 text-amber-700 rounded-lg text-xs font-bold hover:bg-amber-200 transition-colors flex items-center justify-center gap-1"
                      >
                        <SkipForward className="w-3 h-3" /> คืนคิว
                      </button>
                      <button
                        onClick={() => openCancelModal(room.serving!)}
                        className="px-3 py-1.5 bg-red-100 text-red-600 rounded-lg text-xs font-bold hover:bg-red-200 transition-colors flex items-center justify-center gap-1"
                      >
                        <Ban className="w-3 h-3" /> ยกเลิก
                      </button>
                    </div>
                  </>
                )
              })()}
            </div>
          ))}
        </div>
        )}
      </div>

      {/* ═══════ SECTION 1: ARRIVED QUEUE — Candy ═══════ */}
      {!isProvider && (
      <div className="candy-card">
        <div className="px-5 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <UserCheck className="w-4 h-4 text-emerald-500" />             <h2 className="text-sm font-bold text-gray-900">🎫 คิววันนี้ <span className="text-gray-400 font-normal">({arrivedQueue.length} มาถึงแล้ว)</span></h2>
          </div>
          <div className="flex items-center gap-3 text-xs text-gray-500">
            <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-amber-400" /> รอเรียก {stats.waiting}</span>
            <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-emerald-400" /> กำลังทำ {stats.serving}</span>
            <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-blue-400" /> เสร็จ {stats.completed}</span>
            {stats.cancelled > 0 && <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-red-400" /> ยกเลิก {stats.cancelled}</span>}
          </div>
        </div>
        <div className="candy-divider" />
        <div className="divide-y divide-gray-50">
          {arrivedQueue.filter(q => q.status === 'waiting').length === 0 ? (
            <div className="px-5 py-8 text-center text-gray-400 text-sm">
              ไม่มีคนไข้รอคิว
            </div>
          ) : (
            waitingByBranch.map((group, gi) => (
              <div key={gi}>
                {/* Branch Header */}
                <div className="px-5 py-3 flex items-center gap-3" style={{ backgroundColor: `${group.color}15` }}>
                  <div className="w-3 h-8 rounded-full flex-shrink-0" style={{ backgroundColor: group.color }} />
                  <div className="flex-1">
                    <span className="text-sm font-bold text-gray-900">{group.branchName}</span>
                    <span className="text-xs text-gray-500 ml-2">{group.items.length} คิวรอ</span>
                  </div>

                </div>
                {/* Queue Items in this branch */}
                <div className="divide-y divide-gray-50">
                  {group.items.map(item => {
                    const wi = getQueueWaitInfo(branchData, arrivedQueue as any, item.id)
                    const room = branchData.rooms.find(r => r.id === item.assignedRoom)
                    return (
                      <div key={item.id} style={{ borderLeft: `4px solid ${room?.color || group.color}` }}>
                        {renderQueueItem(item, { aheadCount: wi.aheadCount, estimatedWaitMinutes: wi.estimatedWaitMinutes })}
                      </div>
                    )
                  })}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
      )}



      {/* ═══════ ONLINE BOOKING — NOT YET ARRIVED ═══════ */}
      {!isProvider && notArrivedOnlineQueue.length > 0 && (
        <div className="candy-card">
          <div className="px-5 py-3.5 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-lg">📱</span>
              <h2 className="text-sm font-bold text-gray-900">จองออนไลน์ — ยังไม่มาถึง <span className="text-gray-400 font-normal">({notArrivedOnlineQueue.length} คน)</span></h2>
            </div>
          </div>
          <div className="candy-divider" />
          <div className="divide-y divide-gray-50">
            {notArrivedOnlineQueue.map(item => (
              <div key={item.id} className="px-5 py-4 hover:bg-gray-50/50 transition-colors flex items-center justify-between gap-4">
                <div className="flex items-start gap-4 min-w-0">
                  <div className="w-12 h-12 rounded-xl flex flex-col items-center justify-center font-bold bg-blue-50 text-blue-600 shadow-sm flex-shrink-0">
                    <span className="text-sm leading-none font-extrabold">{item.number.charAt(0)}</span>
                    <span className="text-xs font-bold">{item.number.slice(1)}</span>
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-base font-bold text-gray-900">{item.patientName}</span>
                      {item.hn && <span className="text-xs text-gray-400 font-mono">HN: {item.hn}</span>}
                      <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-blue-50 text-blue-600 border border-blue-200">📱 ออนไลน์</span>
                    </div>
                    <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                      <span className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-lg bg-gray-100 text-gray-600 font-medium">🕐 จอง {item.bookedTimeSlot || item.time} น.</span>
                      <span className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-lg bg-blue-50 text-blue-600 font-medium">📋 {item.procedure}</span>
                      {item.distanceFromClinic && <span className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-lg bg-purple-50 text-purple-600 font-medium">📍 {item.distanceFromClinic} ม.</span>}
                      {item.phone && <a href={`tel:${item.phone.replace(/-/g, '')}`} className="inline-flex items-center gap-1 text-xs text-blue-500 hover:text-blue-700 hover:underline cursor-pointer">📞 {item.phone}</a>}
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => markAsArrived(item)}
                  className="px-5 py-2.5 rounded-xl text-sm font-bold transition-all flex items-center gap-2 shadow-md hover:shadow-lg flex-shrink-0"
                  style={{ backgroundColor: config.color, color: 'white' }}
                >
                  ✅ มาถึงแล้ว
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ═══════ SECTION 3 & 4: COMPLETED + CANCELLED — Collapsible Buttons ═══════ */}
      {!isProvider && (stats.completed > 0 || stats.cancelled > 0) && (
        <div className="candy-card">
          <div className="p-4 flex items-center gap-3">
            {/* Completed Button */}
            {stats.completed > 0 && (
              <button
                onClick={() => { setShowCompleted(!showCompleted); setShowCancelled(false) }}
                className={clsx(
                  'flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold transition-all border',
                  showCompleted
                    ? 'bg-green-50 border-green-300 text-green-700 shadow-sm'
                    : 'bg-white border-gray-200 text-gray-600 hover:border-green-300 hover:bg-green-50'
                )}
              >
                <CheckCircle className="w-4 h-4" />
                ✅ เสร็จสิ้น ({stats.completed})
                {showCompleted ? '▲' : '▼'}
              </button>
            )}
            {/* Cancelled Button */}
            {stats.cancelled > 0 && (
              <button
                onClick={() => { setShowCancelled(!showCancelled); setShowCompleted(false) }}
                className={clsx(
                  'flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold transition-all border',
                  showCancelled
                    ? 'bg-red-50 border-red-300 text-red-600 shadow-sm'
                    : 'bg-white border-gray-200 text-gray-600 hover:border-red-300 hover:bg-red-50'
                )}
              >
                <Ban className="w-4 h-4" />
                ❌ ยกเลิก ({stats.cancelled})
                {showCancelled ? '▲' : '▼'}
              </button>
            )}
          </div>

          {/* ═══ Completed Table (expanded) ═══ */}
          {showCompleted && (
            <>
              <div className="candy-divider" />
              <div className="px-4 py-2 bg-green-50/50 flex items-center gap-2 text-xs text-green-700 font-medium">
                <CheckCircle className="w-3.5 h-3.5" /> เวลาเฉลี่ย {arrivedQueue.filter(q => q.status === 'completed' && q.totalDuration).length > 0 ? Math.round(arrivedQueue.filter(q => q.status === 'completed' && q.totalDuration).reduce((sum, q) => sum + (q.totalDuration || 0), 0) / arrivedQueue.filter(q => q.status === 'completed' && q.totalDuration).length) : 0} น.
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="bg-black/[0.02] text-[11px] text-gray-400 font-semibold uppercase tracking-wider">
                      <th className="px-4 py-2 text-left">คิว</th>
                      <th className="px-4 py-2 text-left">ชื่อคนไข้</th>
                      <th className="px-4 py-2 text-left">ห้อง</th>
                      <th className="px-4 py-2 text-left">แพทย์</th>
                      <th className="px-4 py-2 text-left">หัตถการ</th>
                      <th className="px-4 py-2 text-center">เวลา</th>
                      <th className="px-4 py-2 text-center">เสร็จ</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {arrivedQueue.filter(q => q.status === 'completed').map(item => {
                      const modeCfg = bookingModeLabels[item.bookingMode]
                      return (
                        <tr key={item.id} className="hover:bg-gray-50/50 transition-colors">
                          <td className="px-4 py-3">
                            <div className="w-10 h-10 rounded-lg flex flex-col items-center justify-center font-bold bg-gray-100 text-gray-500">
                              <span className="text-sm leading-none">{item.number.charAt(0)}</span>
                              <span className="text-xs">{item.number.slice(1)}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <div>
                              <span className="text-sm font-medium text-gray-900">{item.patientName}</span>
                              {item.phone && <a href={`tel:${item.phone.replace(/-/g, '')}`} className="text-xs text-blue-500 hover:text-blue-700 hover:underline cursor-pointer block">📞 {item.phone}</a>}
                            </div>
                          </td>
                          <td className="px-4 py-3"><span className="text-sm text-gray-600">ห้อง {item.assignedRoom}</span></td>
                          <td className="px-4 py-3"><span className="text-sm text-gray-600">{item.assignedDoctor.split(' ')[0]}</span></td>
                          <td className="px-4 py-3">
                            <div className="flex flex-wrap gap-1">
                              {item.completedProcedures?.map((proc, i) => (
                                <span key={i} className="inline-flex items-center gap-1 text-xs px-2 py-0.5 bg-green-50 text-green-700 rounded-full border border-green-100">{proc.name} x{proc.quantity}</span>
                              ))}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-center"><span className="text-sm font-bold text-gray-900">{item.totalDuration} น.</span></td>
                          <td className="px-4 py-3 text-center"><span className="text-xs text-gray-500 font-mono">{formatTimeShort(item.completedAt)}</span></td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {/* ═══ Cancelled Table (expanded) ═══ */}
          {showCancelled && (
            <>
              <div className="candy-divider" />
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="bg-black/[0.02] text-[11px] text-gray-400 font-semibold uppercase tracking-wider">
                      <th className="px-4 py-2 text-left">คิว</th>
                      <th className="px-4 py-2 text-left">ชื่อผู้รับบริการ</th>
                      <th className="px-4 py-2 text-left">หัตถการ</th>
                      <th className="px-4 py-2 text-left">สาเหตุ</th>
                      <th className="px-4 py-2 text-center">เวลายกเลิก</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {arrivedQueue.filter(q => q.status === 'cancelled').map(item => (
                      <tr key={item.id} className="hover:bg-red-50/30 transition-colors">
                        <td className="px-4 py-3">
                          <div className="w-10 h-10 rounded-lg flex flex-col items-center justify-center font-bold bg-red-50 text-red-400">
                            <span className="text-sm leading-none">{item.number.charAt(0)}</span>
                            <span className="text-xs">{item.number.slice(1)}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div>
                            <span className="text-sm font-medium text-gray-900">{item.patientName}</span>
                            {item.phone && <a href={`tel:${item.phone.replace(/-/g, '')}`} className="text-xs text-blue-500 hover:text-blue-700 hover:underline cursor-pointer block">📞 {item.phone}</a>}
                          </div>
                        </td>
                        <td className="px-4 py-3"><span className="text-sm text-gray-600">{item.procedure}</span></td>
                        <td className="px-4 py-3"><span className="text-sm text-red-600 font-medium">{item.cancelReason}</span></td>                          <td className="px-4 py-3 text-center"><span className="text-xs text-gray-500 font-mono">{formatTimeShort(item.cancelledAt)}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      )}

      {/* ═══════ ADD ROOM MODAL ═══════ */}
      <AddRoomModal
        open={showAddRoom}
        onClose={() => setShowAddRoom(false)}
        onSave={handleAddRoom}
      />

      {/* Setup Guide for new clinics */}
      <SetupGuide
        open={showSetupGuide}
        onClose={closeSetupGuide}
        clinicName={settings.clinicName || config?.name}
      />
    </div>
  )
}
