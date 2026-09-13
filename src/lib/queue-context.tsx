'use client'

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react'
import { type ClinicType } from './queue-data'
import { getDefaultBranchData } from './branch-data'
import { useAuth } from './auth-context'
import { getTodayICT } from './clinic-data'

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
  queueDate?: string             // Service date (ICT) assigned by the server

  /**
   * Privacy-safe display name for public-facing call queue / TV display / TTS voice.
   * Always first name only (ไม่แสดงนามสกุล).
   * Populated by the call-side caller; never stored in Supabase.
   */
  firstName?: string
}

interface QueueContextType {
  queue: QueueItem[]
  setQueue: React.Dispatch<React.SetStateAction<QueueItem[]>>
  /** Save a single queue item change to Supabase */
  saveQueueItem: (item: QueueItem) => Promise<void>
  /** Add a new queue item — queue number is generated server-side by create_queue_item() RPC */
  addQueueItem: (item: Omit<QueueItem, 'id' | 'number'>) => Promise<QueueItem>
  /** Whether we're connected to Supabase */
  isSupabaseConnected: boolean
}

const QueueContext = createContext<QueueContextType | null>(null)

export function useQueue() {
  const ctx = useContext(QueueContext)
  if (!ctx) throw new Error('useQueue must be used within QueueProvider')
  return ctx
}

/* ─── Convert DB row → QueueItem ─── */
function dbRowToQueueItem(row: any, procs: any[] = []): QueueItem {
  return {
    id: row.id,
    number: row.number,
    queueDate: row.queue_date || undefined,
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
    completedAt: row.completed_at ? (row.completed_at.includes('T') ? new Date(row.completed_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Bangkok' }) : row.completed_at) : undefined,
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
    cancelledAt: row.cancelled_at ? (row.cancelled_at.includes('T') ? new Date(row.cancelled_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Bangkok' }) : row.cancelled_at) : undefined,
    // First name (privacy-safe display)
    firstName: row.first_name || undefined,
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
  // Business date in ICT (UTC+7) — the time strings below are stored in ICT.
  const today = getTodayICT()
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
    arrived_at: item.arrivedAt ? (item.arrivedAt.includes('T') ? item.arrivedAt : `${today}T${item.arrivedAt}:00+07:00`) : null,
    serving_at: item.servingAt ? new Date(item.servingAt).toISOString() : null,
    completed_at: item.completedAt ? (item.completedAt.includes('T') ? item.completedAt : `${today}T${item.completedAt}:00+07:00`) : null,
    total_duration: item.totalDuration || null,
    queue_date: today,
    updated_at: now,
    // Appointment fields
    appointment_time: item.appointmentTime || null,
    appointment_date: item.appointmentDate || null,
    appointment_on_time: item.appointmentOnTime ?? null,
    hn: item.hn || null,
    queue_position: item.queuePosition || null,
    first_name: item.firstName || null,
    // Arrival tracking
    is_on_time: item.isOnTime ?? null,
    late_minutes: item.lateMinutes || null,
    original_booked_time: item.originalBookedTime || null,
    // Cancellation fields
    cancel_reason: item.cancelReason || null,
    cancelled_at: item.cancelledAt ? (item.cancelledAt.includes('T') ? item.cancelledAt : `${today}T${item.cancelledAt}:00+07:00`) : null,
    // Online booking fields
    booked_time_slot: item.bookedTimeSlot || null,
    distance_from_clinic: item.distanceFromClinic || null,
    checkin_at: item.checkinAt ? (item.checkinAt.includes('T') ? item.checkinAt : `${today}T${item.checkinAt}:00+07:00`) : null,
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
  return `clinicq-queue-${clinic}-${getTodayICT()}`
}

/**
 * Resolve the clinic ID used for queue reads/writes (P0).
 *
 * The ONLY trustworthy source is the authenticated session's clinic id. We never
 * fall back to a clinic *type* (cache-by-type) or to the hardcoded seed clinic
 * IDs, because that could silently target a different clinic. Returns null when
 * there is no verified identity — callers must then skip the read/write instead
 * of guessing.
 */
function resolveClinicId(authClinicId?: string | null): string | null {
  if (typeof authClinicId !== 'string') return null
  const clinicId = authClinicId.trim()
  return clinicId.length > 0 ? clinicId : null
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
    const clinicId = resolveClinicId(currentClinicId)

    // P0: with no verified clinic identity we must not query ANY clinic. Fall
    // back to the local cache only, and never write to the database.
    if (!clinicId) {
      try {
        const saved = localStorage.getItem(storageKey)
        setQueue(saved ? JSON.parse(saved) : [])
      } catch {
        setQueue([])
      }
      setIsSupabaseConnected(false)
      return
    }

    // Try Supabase first
    try {
      const today = getTodayICT()  // Use ICT date, not UTC
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
      const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
      if (!supabaseUrl || !supabaseKey) throw new Error('No Supabase')

      const res = await fetch(`${supabaseUrl}/rest/v1/queues?clinic_id=eq.${clinicId}&queue_date=eq.${today}&order=created_at.asc`, {
        headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` },
      })
      if (!res.ok) throw new Error('Fetch failed')
      const rows = await res.json()

      // Mark as connected even if no data (table exists, API works)
      setIsSupabaseConnected(true)

      if (!rows || rows.length === 0) {
        // Supabase is source of truth — DB has 0 queues for today
        // Clear stale localStorage so old data doesn't affect calculations
        setQueue([])
        localStorage.setItem(storageKey, JSON.stringify([]))
        return
      }

      const ids = rows.map((r: any) => r.id)
      const procRes = await fetch(`${supabaseUrl}/rest/v1/completed_procedures?queue_id=in.(${ids.join(',')})`, {
        headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` },
      })
      const procs = procRes.ok ? await procRes.json() : []
      const procMap: Record<string, any[]> = {}
      procs.forEach((p: any) => { if (!procMap[p.queue_id]) procMap[p.queue_id] = []; procMap[p.queue_id].push(p) })

      const items = rows.map((row: any) => dbRowToQueueItem(row, procMap[row.id] || []))

      // Auto-reset stale 'serving' items (stuck for more than 8 hours)
      const now = Date.now()
      const staleThreshold = 8 * 60 * 60 * 1000 // 8 hours
      const staleItems = items.filter((item: QueueItem) =>
        item.status === 'serving' &&
        item.servingAt &&
        (now - item.servingAt) > staleThreshold
      )
      if (staleItems.length > 0) {
        // Reset stale items to 'completed'
        for (const stale of staleItems) {
          stale.status = 'completed'
          stale.completedAt = new Date().toISOString()
          // Update in Supabase
          try {
            await fetch(`${supabaseUrl}/rest/v1/queues?id=eq.${stale.id}`, {
              method: 'PATCH',
              headers: {
                apikey: supabaseKey,
                Authorization: `Bearer ${supabaseKey}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({ status: 'completed' }),
            })
          } catch {}
        }
      }

      setQueue(items)
      localStorage.setItem(storageKey, JSON.stringify(items))
      setIsSupabaseConnected(true)
      return
    } catch {
      // Supabase fetch failed — use localStorage as fallback
      try {
        const saved = localStorage.getItem(storageKey)
        if (saved) {
          setQueue(JSON.parse(saved))
          setIsSupabaseConnected(false)
          return
        }
      } catch {}
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
    // P0: no verified clinic identity → do not poll or query any clinic.
    if (!resolveClinicId(currentClinicId)) return
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
    const clinicId = resolveClinicId(currentClinicId)
    // P0: no verified clinic identity → never write to the database.
    if (!clinicId) return
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

  const addQueueItem = useCallback(async (item: Omit<QueueItem, 'id' | 'number'>): Promise<QueueItem> => {
    // If connected to Supabase, use atomic RPC function
    // This ensures queue number generation + INSERT are in the same transaction
    if (isSupabaseConnected && clinicType) {
      const clinicId = resolveClinicId(currentClinicId)
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
      const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
      // P0: no verified clinic identity → skip the RPC and fall through to local
      // mode rather than creating a queue under a guessed clinic.
      if (clinicId && supabaseUrl && supabaseKey) {
        try {
          // Call atomic create_queue_item() via RPC
          const res = await fetch(`${supabaseUrl}/rest/v1/rpc/create_queue_item`, {
            method: 'POST',
            headers: {
              apikey: supabaseKey,
              Authorization: `Bearer ${supabaseKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              p_clinic_id: clinicId,
              p_patient_name: item.patientName,
              p_phone: item.phone,
              p_procedure: item.procedure,
              p_procedure_id: item.procedureId || null,
              p_branch_id: item.branchId || null,
              p_booking_mode: item.bookingMode || 'walkin',
              p_assigned_room: item.assignedRoom || null,
              p_assigned_doctor: item.assignedDoctor || null,
              p_queue_date: item.queueDate || null,  // Use provided date or let function use today ICT
              p_time: item.time || null,
              p_arrived: item.arrived ?? true,
              p_hn: item.hn || null,
              p_appointment_time: item.appointmentTime || null,
              p_appointment_date: item.appointmentDate || null,
              p_appointment_on_time: item.appointmentOnTime ?? null,
              p_late_minutes: item.lateMinutes || null,
              p_original_booked_time: item.originalBookedTime || null,
              p_booked_time_slot: item.bookedTimeSlot || null,
              p_distance_from_clinic: item.distanceFromClinic || null,
            }),
          })

          if (res.ok) {
            // create_queue_item() returns RETURNS TABLE → PostgREST responds with a
            // JSON array even for a single row, so read result[0] (or the object if
            // the server ever returns one directly).
            const result = await res.json()
            const row = Array.isArray(result) ? result[0] : result
            if (row && row.id) {
              // RPC returned the created queue item
              const newItem: QueueItem = {
                ...item,
                id: row.id,
                number: row.number,  // Use server-generated number
                status: row.status || 'waiting',
                queueDate: row.queue_date || getTodayICT(),  // Server business date
              }
              setQueue(prev => [...prev, newItem])
              return newItem
            }
          }
          // If RPC fails, fall through to localStorage-only mode
          console.warn('create_queue_item RPC failed, falling back to local mode')
        } catch (e) {
          console.error('create_queue_item error:', e)
        }
      }
    }

    // Fallback: local mode (no Supabase) — no client-side queue number.
    // The number is only assigned by the DB function; when offline the item
    // stays unnumbered until a connection can persist it.
    const newItem: QueueItem = { ...item, id: crypto.randomUUID(), number: '', queueDate: getTodayICT() }
    setQueue(prev => [...prev, newItem])
    return newItem
  }, [isSupabaseConnected, clinicType, currentClinicId])

  return (
    <QueueContext.Provider value={{ queue, setQueue, saveQueueItem, addQueueItem, isSupabaseConnected }}>
      {children}
    </QueueContext.Provider>
  )
}
