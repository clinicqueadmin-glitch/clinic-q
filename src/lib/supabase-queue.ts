'use client'

import { getSupabase } from './supabase'
import type { ClinicType } from './queue-data'

export interface QueueItemDB {
  id: string
  clinic_id: string
  number: string
  patient_name: string
  phone: string | null
  procedure: string
  procedure_id: string | null
  branch_id: string | null
  booking_mode: string
  assigned_room: number | null
  assigned_doctor: string | null
  status: string
  time: string | null
  booked_at: string
  arrival_time: string | null
  arrived: boolean
  arrived_at: string | null
  serving_at: string | null
  completed_at: string | null
  total_duration: number | null
  queue_date: string
}

export interface CompletedProcedureDB {
  id: number
  queue_id: string
  procedure_id: string | null
  name: string
  quantity: number
  difficulty: string
}

// ═══ Convert DB row → QueueItem (for context) ═══
export function dbToQueueItem(row: QueueItemDB, procedures: CompletedProcedureDB[] = []) {
  return {
    id: row.id,
    number: row.number,
    patientName: row.patient_name,
    phone: row.phone || '',
    procedure: row.procedure,
    procedureId: row.procedure_id || '',
    branchId: row.branch_id || '',
    bookingMode: row.booking_mode as any,
    assignedRoom: row.assigned_room || 0,
    assignedDoctor: row.assigned_doctor || '',
    status: row.status as 'waiting' | 'serving' | 'completed',
    time: row.time || '',
    bookedAt: row.booked_at,
    arrivalTime: row.arrival_time || '',
    arrived: row.arrived,
    arrivedAt: row.arrived_at || undefined,
    servingAt: row.serving_at ? new Date(row.serving_at).getTime() : undefined,
    completedAt: row.completed_at || undefined,
    totalDuration: row.total_duration || undefined,
    completedProcedures: procedures.map(p => ({
      procedureId: p.procedure_id || '',
      name: p.name,
      quantity: p.quantity,
      difficulty: p.difficulty as any,
    })),
  }
}

// ═══ Fetch queues for a clinic on a specific date ═══
export async function fetchQueues(clinicId: string, date?: string) {
  const sb = getSupabase()
  if (!sb) return []

  const targetDate = date || new Date().toISOString().split('T')[0]
  
  const { data: queueRows, error } = await sb
    .from('queues')
    .select('*')
    .eq('clinic_id', clinicId)
    .eq('queue_date', targetDate)
    .order('created_at', { ascending: true })

  if (error || !queueRows) return []

  const queueIds = queueRows.map((q: any) => q.id)
  const { data: procRows } = await sb
    .from('completed_procedures')
    .select('*')
    .in('queue_id', queueIds)

  const procMap: Record<string, CompletedProcedureDB[]> = {}
  procRows?.forEach((p: any) => {
    if (!procMap[p.queue_id]) procMap[p.queue_id] = []
    procMap[p.queue_id].push(p)
  })

  return queueRows.map((row: any) => dbToQueueItem(row, procMap[row.id] || []))
}

// ═══ Fetch a single queue item by number (for /track) ═══
export async function fetchQueueByNumber(clinicId: string, number: string) {
  const sb = getSupabase()
  if (!sb) return null

  const { data: row, error } = await sb
    .from('queues')
    .select('*')
    .eq('clinic_id', clinicId)
    .ilike('number', number)
    .single()

  if (error || !row) return null

  const { data: procRows } = await sb
    .from('completed_procedures')
    .select('*')
    .eq('queue_id', row.id)

  return dbToQueueItem(row, procRows || [])
}

// ═══ Fetch a single queue item by id (for /track) ═══
export async function fetchQueueById(id: string) {
  const sb = getSupabase()
  if (!sb) return null

  const { data: row, error } = await sb
    .from('queues')
    .select('*')
    .eq('id', id)
    .single()

  if (error || !row) return null

  const { data: procRows } = await sb
    .from('completed_procedures')
    .select('*')
    .eq('queue_id', row.id)

  return dbToQueueItem(row, procRows || [])
}

// ═══ Insert a new queue item ═══
export async function insertQueue(item: {
  clinic_id: string
  number: string
  patient_name: string
  phone?: string
  procedure: string
  procedure_id?: string
  branch_id?: string
  booking_mode?: string
  assigned_room?: number
  assigned_doctor?: string
  time?: string
  arrived?: boolean
  arrived_at?: string
}) {
  const sb = getSupabase()
  if (!sb) return null

  const today = new Date().toISOString().split('T')[0]
  
  const { data, error } = await sb
    .from('queues')
    .insert({
      ...item,
      queue_date: today,
      status: 'waiting',
    })
    .select()
    .single()

  if (error) throw error
  return data
}

// ═══ Update queue status ═══
export async function updateQueueStatus(
  id: string, 
  status: 'waiting' | 'serving' | 'completed',
  extra?: { assigned_room?: number; assigned_doctor?: string; serving_at?: string; completed_at?: string; total_duration?: number }
) {
  const sb = getSupabase()
  if (!sb) return

  const update: any = { status, updated_at: new Date().toISOString() }
  if (extra) Object.assign(update, extra)

  const { error } = await sb
    .from('queues')
    .update(update)
    .eq('id', id)

  if (error) throw error
}

// ═══ Add completed procedures to a queue ═══
export async function addCompletedProcedures(
  queueId: string,
  procedures: { procedure_id?: string; name: string; quantity: number; difficulty: string }[]
) {
  const sb = getSupabase()
  if (!sb) return

  const rows = procedures.map(p => ({ ...p, queue_id: queueId }))
  const { error } = await sb.from('completed_procedures').insert(rows)
  if (error) throw error
}

// ═══ Subscribe to real-time queue changes ═══
export function subscribeQueueChanges(clinicId: string, callback: () => void) {
  const sb = getSupabase()
  if (!sb) return () => {}
  
  const channel = sb
    .channel('queues-changes')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'queues', filter: `clinic_id=eq.${clinicId}` },
      () => callback()
    )
    .subscribe()

  return () => { sb.removeChannel(channel) }
}

// ═══ Clinic ID mapping ═══
const clinicIdMap: Record<ClinicType, string> = {
  dental: 'clinic-dental',
  medical: 'clinic-medical',
  aesthetic: 'clinic-aesthetic',
  thai: 'clinic-thai',
  chinese: 'clinic-chinese',
  physical: 'clinic-physical',
}

export function getClinicId(type: ClinicType): string {
  // 1. Try to find actual clinic ID from clinicq-clinics localStorage
  try {
    const clinics = JSON.parse(localStorage.getItem('clinicq-clinics') || '[]')
    const matched = clinics.find((c: any) => c.type === type)
    if (matched?.id) return matched.id
  } catch {}
  // 2. Fallback to hardcoded mapping
  return clinicIdMap[type] || 'clinic-dental'
}

// ═══ Check if Supabase is configured ═══
export function isSupabaseConfigured(): boolean {
  return !!(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY)
}
