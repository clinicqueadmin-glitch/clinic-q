'use client'

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react'
import { type ClinicType } from './queue-data'
import { getDefaultBranchData } from './branch-data'

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
  return {
    id: item.id,
    clinic_id: clinicId,
    number: item.number,
    patient_name: item.patientName,
    phone: item.phone,
    procedure: item.procedure,
    procedure_id: item.procedureId,
    branch_id: item.branchId,
    booking_mode: item.bookingMode,
    assigned_room: item.assignedRoom,
    assigned_doctor: item.assignedDoctor,
    status: item.status,
    time: item.time || null,
    booked_at: item.bookedAt ? (item.bookedAt.includes('T') ? item.bookedAt : new Date().toISOString()) : new Date().toISOString(),
    arrival_time: item.arrivalTime || null,
    arrived: item.arrived,
    arrived_at: (item.arrivedAt && !isNaN(new Date(item.arrivedAt).getTime())) ? new Date(item.arrivedAt).toISOString() : null,
    serving_at: item.servingAt ? new Date(item.servingAt).toISOString() : null,
    completed_at: item.completedAt || null,
    total_duration: item.totalDuration || null,
    queue_date: new Date().toISOString().split('T')[0],
    updated_at: new Date().toISOString(),
  }
}

/* ─── Clinic-specific demo data (fallback) ─── */
export const clinicDemoData: Record<ClinicType, QueueItem[]> = {
  dental: [
    // ═══ Walk-in patients (เดินเข้ามาเอง) ═══
    { id: '1', number: 'E024', patientName: 'สมชาย ใจดี', phone: '081-234-5678', procedure: 'ขูดหินปูน', procedureId: 'dg-clean', branchId: 'dental-general', bookingMode: 'walkin', assignedRoom: 1, assignedDoctor: 'ทพ.สมบูรณ์ สุขใจ', status: 'serving', time: '09:15', bookedAt: '09:15', arrivalTime: '09:15', arrived: true, arrivedAt: '09:15', servingAt: Date.now() - 25 * 60 * 1000, hn: 'HN0001', queuePosition: 1 },
    { id: '2', number: 'E025', patientName: 'สมหญิง รักสวย', phone: '082-345-6789', procedure: 'จัดฟัน', procedureId: 'do-adjust', branchId: 'dental-ortho', bookingMode: 'walkin', assignedRoom: 2, assignedDoctor: 'ทพ.วิชัย มั่นคง', status: 'serving', time: '09:30', bookedAt: '09:30', arrivalTime: '09:30', arrived: true, arrivedAt: '09:28', servingAt: Date.now() - 40 * 60 * 1000, hn: 'HN0002', queuePosition: 2 },
    { id: '3', number: 'E026', patientName: 'วิชัย มั่นคง', phone: '083-456-7890', procedure: 'อุดฟัน', procedureId: 'dg-fill', branchId: 'dental-general', bookingMode: 'walkin', assignedRoom: 1, assignedDoctor: 'ทพ.สมบูรณ์ สุขใจ', status: 'waiting', time: '09:45', bookedAt: '09:45', arrivalTime: '09:45', arrived: true, arrivedAt: '09:45', hn: 'HN0008', queuePosition: 3 },
    { id: '7', number: 'E030', patientName: 'ประสงค์ สุขสันต์', phone: '087-890-1234', procedure: 'ตรวจสุขภาพฟัน', procedureId: 'dg-checkup', branchId: 'dental-general', bookingMode: 'walkin', assignedRoom: 1, assignedDoctor: 'ทพ.สมบูรณ์ สุขใจ', status: 'waiting', time: '10:30', bookedAt: '10:30', arrivalTime: '10:30', arrived: true, arrivedAt: '10:30', hn: 'HN0009', queuePosition: 4 },
    { id: '5', number: 'E028', patientName: 'พิมพ์ใจ สดใส', phone: '085-678-9012', procedure: 'ฟอกสีฟัน', procedureId: 'dg-whiten', branchId: 'dental-general', bookingMode: 'walkin', assignedRoom: 4, assignedDoctor: 'ทพ.หญิงพิมพ์ใจ รักสวย', status: 'completed', time: '08:30', bookedAt: '08:30', arrivalTime: '08:30', arrived: true, arrivedAt: '08:30', servingAt: Date.now() - 60 * 60 * 1000, completedProcedures: [{ procedureId: 'dg-whiten', name: 'ฟอกสีฟัน', quantity: 1, difficulty: 'hard' }, { procedureId: 'dg-checkup', name: 'ตรวจสุขภาพฟัน', quantity: 1, difficulty: 'easy' }], completedAt: '09:15', totalDuration: 45, hn: 'HN0005', queuePosition: 5 },
    // ═══ Online booking patients (จองทางออนไลน์ - ยังไม่มา) ═══
    { id: '8', number: 'E031', patientName: 'กานดา รักสุขภาพ', phone: '088-111-2222', procedure: 'ตรวจสุขภาพฟัน', procedureId: 'dg-checkup', branchId: 'dental-general', bookingMode: 'remote', assignedRoom: 0, assignedDoctor: '', status: 'waiting', time: '11:00', bookedAt: '10:00', arrivalTime: '', arrived: false, bookedTimeSlot: '11:00', distanceFromClinic: 500, originalBookedTime: '11:00', hn: 'HN0011', queuePosition: 6 },
    { id: '9', number: 'E032', patientName: 'วิภา ใจเย็น', phone: '089-333-4444', procedure: 'อุดฟัน', procedureId: 'dg-fill', branchId: 'dental-general', bookingMode: 'remote', assignedRoom: 0, assignedDoctor: '', status: 'waiting', time: '11:30', bookedAt: '10:15', arrivalTime: '', arrived: false, bookedTimeSlot: '11:30', distanceFromClinic: 300, originalBookedTime: '11:30', hn: 'HN0012', queuePosition: 7 },
    // ═══ Online booking - มาถึงแล้ว ตรงเวลา ═══
    { id: '10', number: 'E033', patientName: 'นภา สุขใส', phone: '081-555-6666', procedure: 'ขูดหินปูน', procedureId: 'dg-clean', branchId: 'dental-general', bookingMode: 'remote', assignedRoom: 1, assignedDoctor: 'ทพ.สมบูรณ์ สุขใจ', status: 'waiting', time: '10:00', bookedAt: '09:00', arrivalTime: '10:00', arrived: true, arrivedAt: '10:02', bookedTimeSlot: '10:00', distanceFromClinic: 200, checkinAt: '10:02', isOnTime: true, lateMinutes: 0, originalBookedTime: '10:00', hn: 'HN0013', queuePosition: 8 },
    // ═══ Online booking - มาช้ากว่า 10 นาที ═══
    { id: '11', number: 'E034', patientName: 'บุญมี สายช้า', phone: '082-777-8888', procedure: 'ถอนฟัน', procedureId: 'ds-extract', branchId: 'dental-surgery', bookingMode: 'remote', assignedRoom: 3, assignedDoctor: 'ทพ.สมพงษ์ กล้าแข็ง', status: 'waiting', time: '09:00', bookedAt: '08:00', arrivalTime: '09:25', arrived: true, arrivedAt: '09:25', bookedTimeSlot: '09:00', distanceFromClinic: 800, checkinAt: '09:25', isOnTime: false, lateMinutes: 25, originalBookedTime: '09:00', hn: 'HN0014', queuePosition: 9 },
    // ═══ Appointment patients (คนไข้นัด) ═══
    { id: '12', number: 'E035', patientName: 'ประเสริฐ มีสุข', phone: '083-999-0000', procedure: 'จัดฟัน', procedureId: 'do-adjust', branchId: 'dental-ortho', bookingMode: 'appointment', assignedRoom: 2, assignedDoctor: 'ทพ.วิชัย มั่นคง', status: 'waiting', time: '10:30', bookedAt: '2026-08-15', arrivalTime: '10:28', arrived: true, arrivedAt: '10:28', appointmentTime: '10:30', appointmentDate: '2026-08-22', appointmentOnTime: true, isOnTime: true, lateMinutes: 0, originalBookedTime: '10:30', hn: 'HN0015', queuePosition: 10 },
    { id: '13', number: 'E036', patientName: 'สุภาพร นัดหมาย', phone: '084-111-3333', procedure: 'ผ่าตัดฟันคุด', procedureId: 'ds-impacted', branchId: 'dental-surgery', bookingMode: 'appointment', assignedRoom: 3, assignedDoctor: 'ทพ.สมพงษ์ กล้าแข็ง', status: 'waiting', time: '09:00', bookedAt: '2026-08-10', arrivalTime: '09:40', arrived: true, arrivedAt: '09:40', appointmentTime: '09:00', appointmentDate: '2026-08-22', appointmentOnTime: false, isOnTime: false, lateMinutes: 40, originalBookedTime: '09:00', hn: 'HN0016', queuePosition: 11 },
    // ═══ Walk-in ที่มาถึงเคานเตอร์ ═══
    { id: '4', number: 'E027', patientName: 'ธนากร เจริญสุข', phone: '084-567-8901', procedure: 'ผ่าตัดฟันคุด', procedureId: 'ds-impacted', branchId: 'dental-surgery', bookingMode: 'walkin', assignedRoom: 3, assignedDoctor: 'ทพ.สมพงษ์ กล้าแข็ง', status: 'waiting', time: '09:00', bookedAt: '08:30', arrivalTime: '09:00', arrived: true, arrivedAt: '09:05', hn: 'HN0004', queuePosition: 12 },
    // ═══ Cancelled patients (ยกเลิกคิว) ═══
    { id: '14', number: 'E037', patientName: 'สมศักดิ์ ขี้เกียจ', phone: '085-123-4567', procedure: 'ขูดหินปูน', procedureId: 'dg-clean', branchId: 'dental-general', bookingMode: 'walkin', assignedRoom: 0, assignedDoctor: '', status: 'cancelled', time: '08:00', bookedAt: '08:00', arrivalTime: '08:00', arrived: true, arrivedAt: '08:00', cancelReason: 'รอคิวนานเกินไป', hn: 'HN0017', queuePosition: 13 },
    { id: '15', number: 'E038', patientName: 'สุมาลี กลับบ้าน', phone: '086-234-5678', procedure: 'ถอนฟัน', procedureId: 'ds-extract', branchId: 'dental-surgery', bookingMode: 'remote', assignedRoom: 0, assignedDoctor: '', status: 'cancelled', time: '09:30', bookedAt: '09:00', arrivalTime: '09:30', arrived: true, arrivedAt: '09:30', cancelReason: 'เปลี่ยนใจไม่ทำแล้ว', hn: 'HN0018', queuePosition: 14 },
    { id: '16', number: 'E039', patientName: 'บุญมี ย้ายคลินิก', phone: '087-345-6789', procedure: 'อุดฟัน', procedureId: 'dg-fill', branchId: 'dental-general', bookingMode: 'walkin', assignedRoom: 0, assignedDoctor: '', status: 'cancelled', time: '10:00', bookedAt: '10:00', arrivalTime: '', arrived: false, cancelReason: 'ย้ายไปคลินิกอื่น', hn: 'HN0019', queuePosition: 15 },
    { id: '17', number: 'E040', patientName: 'พงศ์ มั่นใจ', phone: '088-456-7890', procedure: 'จัดฟัน', procedureId: 'do-adjust', branchId: 'dental-ortho', bookingMode: 'appointment', assignedRoom: 0, assignedDoctor: '', status: 'cancelled', time: '11:00', bookedAt: '2026-08-20', arrivalTime: '', arrived: false, cancelReason: '', hn: 'HN0020', queuePosition: 16 },
  ],
  medical: [
    { id: '1', number: 'A024', patientName: 'สมชาย ใจดี', phone: '081-234-5678', procedure: 'ตรวจสุขภาพทั่วไป', procedureId: 'mg-checkup', branchId: 'med-general', bookingMode: 'walkin', assignedRoom: 1, assignedDoctor: 'นพ.นรินทร์ สุขสมบูรณ์', status: 'serving', time: '09:15', bookedAt: '09:15', arrivalTime: '09:15', arrived: true, arrivedAt: '09:15', servingAt: Date.now() - 20 * 60 * 1000 },
    { id: '2', number: 'A025', patientName: 'สมหญิง รักสวย', phone: '082-345-6789', procedure: 'ฉีดวัคซีน', procedureId: 'mg-vaccine', branchId: 'med-general', bookingMode: 'walkin', assignedRoom: 1, assignedDoctor: 'นพ.นรินทร์ สุขสมบูรณ์', status: 'waiting', time: '09:30', bookedAt: '09:30', arrivalTime: '09:30', arrived: true, arrivedAt: '09:28' },
    { id: '3', number: 'B018', patientName: 'วิชัย มั่นคง', phone: '083-456-7890', procedure: 'รักษาสิว', procedureId: 'ms-acne', branchId: 'med-skin', bookingMode: 'walkin', assignedRoom: 2, assignedDoctor: 'พญ.สิริพร ผิวงาม', status: 'waiting', time: '10:00', bookedAt: '10:00', arrivalTime: '10:00', arrived: true, arrivedAt: '10:00' },
  ],
  aesthetic: [
    { id: '1', number: 'B018', patientName: 'สมชาย ใจดี', phone: '081-234-5678', procedure: 'ฉีดโบتو็อกซ์', procedureId: 'ai-botox', branchId: 'aes-inject', bookingMode: 'walkin', assignedRoom: 1, assignedDoctor: 'นพ.อริยะ หน้าใส', status: 'serving', time: '10:15', bookedAt: '10:15', arrivalTime: '10:15', arrived: true, arrivedAt: '10:15', servingAt: Date.now() - 25 * 60 * 1000 },
    { id: '2', number: 'B019', patientName: 'สมหญิง รักสวย', phone: '082-345-6789', procedure: 'ฉีดฟิลเลอร์', procedureId: 'ai-filler', branchId: 'aes-inject', bookingMode: 'walkin', assignedRoom: 1, assignedDoctor: 'นพ.อริยะ หน้าใส', status: 'waiting', time: '10:30', bookedAt: '10:30', arrivalTime: '10:30', arrived: true, arrivedAt: '10:30' },
  ],
  thai: [
    { id: '1', number: 'C012', patientName: 'สมชาย ใจดี', phone: '081-234-5678', procedure: 'นวดแผนไทยเต็มตัว', procedureId: 'tm-full', branchId: 'thai-massage', bookingMode: 'walkin', assignedRoom: 1, assignedDoctor: 'นายสมศักดิ์ นวดเก่ง', status: 'serving', time: '09:00', bookedAt: '09:00', arrivalTime: '09:00', arrived: true, arrivedAt: '09:00', servingAt: Date.now() - 45 * 60 * 1000 },
  ],
  chinese: [
    { id: '1', number: 'D008', patientName: 'สมชาย ใจดี', phone: '081-234-5678', procedure: 'ฝังเข็มทั่วไป', procedureId: 'ca-general', branchId: 'cn-acu', bookingMode: 'walkin', assignedRoom: 1, assignedDoctor: 'อาจารย์หมออู จีนเทวะ', status: 'serving', time: '09:30', bookedAt: '09:30', arrivalTime: '09:30', arrived: true, arrivedAt: '09:30', servingAt: Date.now() - 30 * 60 * 1000 },
  ],
  physical: [
    { id: '1', number: 'F015', patientName: 'สมชาย ใจดี', phone: '081-234-5678', procedure: 'กายภาพบำบัดไหล่', procedureId: 'pg-shoulder', branchId: 'pt-general', bookingMode: 'walkin', assignedRoom: 1, assignedDoctor: 'นายสมใจ กายภาพ', status: 'serving', time: '09:00', bookedAt: '09:00', arrivalTime: '09:00', arrived: true, arrivedAt: '09:00', servingAt: Date.now() - 35 * 60 * 1000 },
  ],
}

function getQueueStorageKey(clinic: ClinicType): string {
  const today = new Date().toISOString().split('T')[0]
  return `clinicq-queue-${clinic}-${today}`
}

export function QueueProvider({ children }: { children: ReactNode }) {
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
      const clinicId = clinicIdMap[clinic]
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
      // Final fallback: demo data
      const demo = clinicDemoData[clinic] || []
      setQueue(demo)
      localStorage.setItem(storageKey, JSON.stringify(demo))
      setIsSupabaseConnected(false)
    }
  }, [])

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
    const clinicId = clinicIdMap[clinicType]
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
    const clinicId = clinicIdMap[clinicType]
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
  }, [isSupabaseConnected, clinicType])

  const saveQueueItem = useCallback(async (item: QueueItem) => {
    setQueue(prev => prev.map(q => q.id === item.id ? item : q))
    await saveToSupabase(item)
  }, [saveToSupabase])

  const addQueueItem = useCallback(async (item: Omit<QueueItem, 'id'>): Promise<QueueItem> => {
    const newItem: QueueItem = { ...item, id: crypto.randomUUID() }
    if (isSupabaseConnected && clinicType) {
      const clinicId = clinicIdMap[clinicType]
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
  }, [isSupabaseConnected, clinicType])

  return (
    <QueueContext.Provider value={{ queue, setQueue, saveQueueItem, addQueueItem, isSupabaseConnected }}>
      {children}
    </QueueContext.Provider>
  )
}
