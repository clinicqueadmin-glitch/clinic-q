'use client'

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react'
import { type ClinicType } from './queue-data'
import { getDefaultBranchData } from './branch-data'
import { useAuth } from './auth-context'

export type BookingMode = 'walkin' | 'remote' | 'appointment'

export type DifficultyLevel = 'easy' | 'medium' | 'hard' | 'very_hard'

export interface CompletedProcedure {
  procedureId: string
  name: string
  quantity: number
  difficulty: DifficultyLevel
}

export interface QueueItem {
  id: string
  number: string
  patientName: string
  phone: string
  procedure: string
  procedureId: string
  branchId: string
  bookingMode: BookingMode
  assignedRoom: number
  assignedDoctor: string
  status: 'waiting' | 'serving' | 'completed' | 'cancelled'
  time: string
  bookedAt: string
  arrivalTime: string
  arrived: boolean
  arrivedAt?: string
  servingAt?: number
  completedProcedures?: CompletedProcedure[]
  completedAt?: string
  totalDuration?: number
  cancelReason?: string
  cancelledAt?: string
  // Online booking fields
  bookedTimeSlot?: string        // เวลาที่จองล่วงหน้า (เช่น '10:30')
  distanceFromClinic?: number    // ระยะห่างจากคลินิก (เมตร)
  checkinAt?: string             // เวลาที่เช็คอินที่เคานเตอร์
  isOnTime?: boolean             // มาตรงเวลาหรือไม่
  lateMinutes?: number           // มากี่นาที (ถ้ามาช้า)
  originalBookedTime?: string    // เวลาเดิมที่จองไว้
  // Appointment fields
  appointmentTime?: string       // เวลาที่นัด
  appointmentDate?: string       // วันที่นัด
  appointmentOnTime?: boolean    // มาตามนัดหรือไม่ (Staff ยืนยัน)
  hn?: string                     // Hospital Number
  queuePosition?: number         // ลำดับคิว (คิวที่几)
}

interface QueueContextType {
  queue: QueueItem[]
  setQueue: React.Dispatch<React.SetStateAction<QueueItem[]>>
  /** Save a single queue item change to Supabase */
  saveQueueItem: (item: QueueItem) => Promise<void>
  /** Add a new queue item */
  addQueueItem: (item: Omit<QueueItem, 'id'>) => Promise<QueueItem>
  /** Whether we're connected to Supabase */
  isSupabaseConnected: boolean
}

const QueueContext = createContext<QueueContextType | null>(null)

export function useQueue() {
  const ctx = useContext(QueueContext)
  if (!ctx) throw new Error('useQueue must be used within QueueProvider')
  return ctx
}

/* ─── Clinic ID mapping ─── */
const clinicIdMap: Record<ClinicType, string> = {
  dental: 'clinic-dental',
  medical: 'clinic-medical',
  aesthetic: 'clinic-aesthetic',
  thai: 'clinic-thai',
  chinese: 'clinic-chinese',
  physical: 'clinic-physical',
}

/* ─── Convert DB row → QueueItem ─── */
function dbRowToQueueItem(row: any, procs: any[] = []): QueueItem {
  return {
    id: row.id,
    number: row.number,
    patientName: row.patient_name,
    phone: row.phone || '',
    procedure: row.procedure,
    procedureId: row.procedure_id || '',
    branchId: row.branch_id || '',
    bookingMode: row.booking_mode || 'walkin',
    assignedRoom: row.assigned_room || 0,
    assignedDoctor: row.assigned_doctor || '',
    status: row.status || 'waiting',
    time: row.time || '',
    bookedAt: row.booked_at || '',
    arrivalTime: row.arrival_time || '',
    arrived: row.arrived ?? false,
    arrivedAt: row.arrived_at || undefined,
    servingAt: row.serving_at ? new Date(row.serving_at).getTime() : undefined,
    completedAt: row.completed_at || undefined,
    totalDuration: row.total_duration || undefined,
    // Appointment fields
    appointmentTime: row.appointment_time || undefined,
    appointmentDate: row.appointment_date || undefined,
    appointmentOnTime: row.appointment_on_time ?? undefined,
    hn: row.hn || undefined,
    queuePosition: row.queue_position || undefined,
    // Arrival tracking
    isOnTime: row.is_on_time ?? undefined,
    lateMinutes: row.late_minutes || undefined,
    originalBookedTime: row.original_booked_time || undefined,
    // Cancellation fields
    cancelReason: row.cancel_reason || undefined,
    cancelledAt: row.cancelled_at || undefined,
    // Online booking fields
    bookedTimeSlot: row.booked_time_slot || undefined,
    distanceFromClinic: row.distance_from_clinic || undefined,
    checkinAt: row.checkin_at || undefined,
    completedProcedures: procs.map((p: any) => ({
      procedureId: p.procedure_id || '',
      name: p.name,
      quantity: p.quantity || 1,
      difficulty: p.difficulty || 'medium',
    })),
  }
}

/* ─── Convert QueueItem → DB row ─── */
function queueItemToDbRow(item: QueueItem, clinicId: string) {
  const now = new Date().toISOString()
  const today = now.split('T')[0]
  return {
    id: item.id,
    clinic_id: clinicId,
    number: item.number,
    patient_name: item.patientName,
    phone: item.phone,
    procedure: item.procedure,
    procedure_id: item.procedureId || null,
    branch_id: item.branchId || null,
    booking_mode: item.bookingMode,
    assigned_room: item.assignedRoom || null,
    assigned_doctor: item.assignedDoctor || null,
    status: item.status,
    time: item.time || null,
    booked_at: item.bookedAt ? (item.bookedAt.includes('T') ? item.bookedAt : now) : now,
    arrival_time: item.arrivalTime || null,
    arrived: item.arrived,
    arrived_at: (item.arrivedAt && !isNaN(new Date(item.arrivedAt).getTime())) ? new Date(item.arrivedAt).toISOString() : null,
    serving_at: item.servingAt ? new Date(item.servingAt).toISOString() : null,
    completed_at: item.completedAt || null,
    total_duration: item.totalDuration || null,
    queue_date: today,
    updated_at: now,
    // Appointment fields
    appointment_time: item.appointmentTime || null,
    appointment_date: item.appointmentDate || null,
    appointment_on_time: item.appointmentOnTime ?? null,
    hn: item.hn || null,
    queue_position: item.queuePosition || null,
    // Arrival tracking
    is_on_time: item.isOnTime ?? null,
    late_minutes: item.lateMinutes || null,
    original_booked_time: item.originalBookedTime || null,
    // Cancellation fields
    cancel_reason: item.cancelReason || null,
    cancelled_at: item.cancelledAt || null,
    // Online booking fields
    booked_time_slot: item.bookedTimeSlot || null,
    distance_from_clinic: item.distanceFromClinic || null,
    checkin_at: item.checkinAt || null,
  }
}

/* ─── No demo data - queue starts empty ─── */
export const clinicDemoData: Record<ClinicType, QueueItem[]> = {
  dental: [],
  medical: [],
  aesthetic: [],
  thai: [],
  chinese: [],
  physical: [],
}

function getQueueStorageKey(clinic: ClinicType): string {
  const today = new Date().toISOString().split('T')[0]
  return `clinicq-queue-${clinic}-${today}`
}

/** Look up actual clinic ID from auth session or clinicq-clinics by clinic type */
function resolveClinicId(clinicType: ClinicType, authClinicId?: string | null): string {
  // Priority 1: Use the auth session's currentClinicId
  if (authClinicId) return authClinicId

  // Priority 2: Look up from localStorage clinicq-clinics
  try {
    const clinics = JSON.parse(localStorage.getItem('clinicq-clinics') || '[]')
    const matched = clinics.find((c: any) => c.type === clinicType)
    if (matched?.id) return matched.id
  } catch {}

  // Priority 3: Use hardcoded mapping as fallback
  const clinicIdMap: Record<ClinicType, string> = {
    dental: 'clinic-dental',
    medical: 'clinic-medical',
    aesthetic: 'clinic-aesthetic',
    thai: 'clinic-thai',
    chinese: 'clinic-chinese',
    physical: 'clinic-physical',
  }
  return clinicIdMap[clinicType] || 'clinic-dental'
}

export function QueueProvider({ children }: { children: ReactNode }) {
  const { currentClinicId } = useAuth()
  const [clinicType, setClinicType] = useState<ClinicType | null>(null)
  const [queue, setQueue] = useState<QueueItem[]>([])
  const [isSupabaseConnected, setIsSupabaseConnected] = useState(false)
  const [loadedFromStorage, setLoadedFromStorage] = useState(false)

  // Read clinic type from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('clinic-q-type') as ClinicType | null
    setClinicType(saved)
    const handler = (e: StorageEvent) => {
      if (e.key === 'clinic-q-type') setClinicType(e.newValue as ClinicType | null)
    }
    window.addEventListener('storage', handler)
    return () => window.removeEventListener('storage', handler)
  }, [])

  useEffect(() => {
    const interval = setInterval(() => {
      const saved = localStorage.getItem('clinic-q-type') as ClinicType | null
      setClinicType(prev => prev !== saved ? saved : prev)
    }, 500)
    return () => clearInterval(interval)
  }, [])

  // ─── Fetch from Supabase or use demo data (with localStorage persistence) ───
  const fetchData = useCallback(async (clinic: ClinicType) => {
    const storageKey = getQueueStorageKey(clinic)

    // Try Supabase first
    try {
      const clinicId = resolveClinicId(clinic, currentClinicId)
      const today = new Date().toISOString().split('T')[0]
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
      const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
      if (!supabaseUrl || !supabaseKey) throw new Error('No Supabase')

      const res = await fetch(`${supabaseUrl}/rest/v1/queues?clinic_id=eq.${clinicId}&queue_date=eq.${today}&order=created_at.asc`, {
        headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` },
      })
      if (!res.ok) throw new Error('Fetch failed')
      const rows = await res.json()
      if (!rows || rows.length === 0) throw new Error('No data')

      const ids = rows.map((r: any) => r.id)
      const procRes = await fetch(`${supabaseUrl}/rest/v1/completed_procedures?queue_id=in.(${ids.join(',')})`, {
        headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` },
      })
      const procs = procRes.ok ? await procRes.json() : []
      const procMap: Record<string, any[]> = {}
      procs.forEach((p: any) => { if (!procMap[p.queue_id]) procMap[p.queue_id] = []; procMap[p.queue_id].push(p) })

      const items = rows.map((row: any) => dbRowToQueueItem(row, procMap[row.id] || []))
      setQueue(items)
      localStorage.setItem(storageKey, JSON.stringify(items))
      setIsSupabaseConnected(true)
      return
    } catch {
      // Fallback: try localStorage first, then demo data
      try {
        const saved = localStorage.getItem(storageKey)
        if (saved) {
          setQueue(JSON.parse(saved))
          setIsSupabaseConnected(false)
          return
        }
      } catch {}
      // Final fallback: empty queue
      setQueue([])
      localStorage.setItem(storageKey, JSON.stringify([]))
      setIsSupabaseConnected(false)
    }
  }, [currentClinicId])

  // ─── Sync queue to localStorage whenever it changes ───
  useEffect(() => {
    if (clinicType && queue.length > 0) {
      localStorage.setItem(getQueueStorageKey(clinicType), JSON.stringify(queue))
    }
  }, [queue, clinicType])

  // ─── Listen for cross-tab queue updates ───
  useEffect(() => {
    const handler = (e: StorageEvent) => {
      if (!clinicType) return
      const storageKey = getQueueStorageKey(clinicType)
      if (e.key === storageKey && e.newValue) {
        try {
          const newQueue = JSON.parse(e.newValue) as QueueItem[]
          setQueue(newQueue)
        } catch {}
      }
    }
    window.addEventListener('storage', handler)
    return () => window.removeEventListener('storage', handler)
  }, [clinicType])

  useEffect(() => {
    if (clinicType) fetchData(clinicType)
  }, [clinicType, fetchData])

  // ─── Realtime subscription ───
  useEffect(() => {
    if (!isSupabaseConnected || !clinicType) return
    const clinicId = resolveClinicId(clinicType, currentClinicId)
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
    if (!supabaseUrl || !supabaseKey) return

    // Poll every 3 seconds for realtime-like updates (simpler than WebSocket for demo)
    const interval = setInterval(() => fetchData(clinicType), 3000)
    return () => clearInterval(interval)
  }, [isSupabaseConnected, clinicType, fetchData])

  // ─── Save to Supabase ───
  const saveToSupabase = useCallback(async (item: QueueItem) => {
    if (!isSupabaseConnected || !clinicType) return
    const clinicId = resolveClinicId(clinicType, currentClinicId)
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
    if (!supabaseUrl || !supabaseKey) return

    const dbRow = queueItemToDbRow(item, clinicId)
    await fetch(`${supabaseUrl}/rest/v1/queues?id=eq.${item.id}`, {
      method: 'PATCH',
      headers: {
        apikey: supabaseKey,
        Authorization: `Bearer ${supabaseKey}`,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal',
      },
      body: JSON.stringify(dbRow),
    })
  }, [isSupabaseConnected, clinicType, currentClinicId])

  const saveQueueItem = useCallback(async (item: QueueItem) => {
    setQueue(prev => prev.map(q => q.id === item.id ? item : q))
    await saveToSupabase(item)
  }, [saveToSupabase])

  const addQueueItem = useCallback(async (item: Omit<QueueItem, 'id'>): Promise<QueueItem> => {
    const newItem: QueueItem = { ...item, id: crypto.randomUUID() }
    if (isSupabaseConnected && clinicType) {
      const clinicId = resolveClinicId(clinicType, currentClinicId)
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
      const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
      if (supabaseUrl && supabaseKey) {
        const dbRow = queueItemToDbRow(newItem, clinicId)
        const res = await fetch(`${supabaseUrl}/rest/v1/queues`, {
          method: 'POST',
          headers: {
            apikey: supabaseKey,
            Authorization: `Bearer ${supabaseKey}`,
            'Content-Type': 'application/json',
            Prefer: 'return=representation',
          },
          body: JSON.stringify(dbRow),
        })
        if (res.ok) {
          const saved = await res.json()
          if (saved?.[0]) newItem.id = saved[0].id
        }
      }
    }

    setQueue(prev => [...prev, newItem])
    return newItem
  }, [isSupabaseConnected, clinicType, currentClinicId])

  return (
    <QueueContext.Provider value={{ queue, setQueue, saveQueueItem, addQueueItem, isSupabaseConnected }}>
      {children}
    </QueueContext.Provider>
  )
}
