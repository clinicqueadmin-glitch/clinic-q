import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { cookies } from 'next/headers'

export const dynamic = 'force-dynamic'

// GET /api/queues?clinic_id=xxx&date=2024-01-15
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const clinicId = searchParams.get('clinic_id')
  const date = searchParams.get('date') || new Date().toISOString().split('T')[0]

  if (!clinicId) {
    return NextResponse.json({ error: 'clinic_id is required' }, { status: 400 })
  }

  const cookieStore = await cookies()
  const supabase = createClient(cookieStore)

  // Fetch queues
  const { data: queueRows, error } = await supabase
    .from('queues')
    .select('*')
    .eq('clinic_id', clinicId)
    .eq('queue_date', date)
    .order('created_at', { ascending: true })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  if (!queueRows || queueRows.length === 0) {
    return NextResponse.json([])
  }

  // Fetch completed procedures
  const queueIds = queueRows.map((q: any) => q.id)
  const { data: procRows } = await supabase
    .from('completed_procedures')
    .select('*')
    .in('queue_id', queueIds)

  const procMap: Record<string, any[]> = {}
  procRows?.forEach((p: any) => {
    if (!procMap[p.queue_id]) procMap[p.queue_id] = []
    procMap[p.queue_id].push(p)
  })

  const result = queueRows.map((row: any) => ({
    ...row,
    completed_procedures: procMap[row.id] || [],
  }))

  return NextResponse.json(result)
}

// POST /api/queues — create new queue item via atomic RPC
export async function POST(request: NextRequest) {
  const body = await request.json()

  const cookieStore = await cookies()
  const supabase = createClient(cookieStore)

  // Use atomic create_queue_item() function
  // This ensures queue number generation + INSERT are in the same transaction
  const { data, error } = await supabase.rpc('create_queue_item', {
    p_clinic_id: body.clinic_id,
    p_patient_name: body.patient_name,
    p_phone: body.phone,
    p_procedure: body.procedure,
    p_procedure_id: body.procedure_id || null,
    p_branch_id: body.branch_id || null,
    p_booking_mode: body.booking_mode || 'walkin',
    p_assigned_room: body.assigned_room || null,
    p_assigned_doctor: body.assigned_doctor || null,
    p_queue_date: null,  // Let function use today ICT
    p_time: body.time || null,
    p_arrived: body.arrived ?? true,
    p_hn: body.hn || null,
    p_appointment_time: body.appointment_time || null,
    p_appointment_date: body.appointment_date || null,
    p_appointment_on_time: body.appointment_on_time ?? null,
    p_late_minutes: body.late_minutes || null,
    p_original_booked_time: body.original_booked_time || null,
    p_booked_time_slot: body.booked_time_slot || null,
    p_distance_from_clinic: body.distance_from_clinic || null,
  })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data, { status: 201 })
}

// PATCH /api/queues — update queue status
export async function PATCH(request: NextRequest) {
  const body = await request.json()
  const { id, ...updates } = body

  if (!id) {
    return NextResponse.json({ error: 'id is required' }, { status: 400 })
  }

  updates.updated_at = new Date().toISOString()

  const cookieStore = await cookies()
  const supabase = createClient(cookieStore)

  const { error } = await supabase
    .from('queues')
    .update(updates)
    .eq('id', id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}

// DELETE /api/queues?id=xxx — delete a queue item
export async function DELETE(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')

  if (!id) {
    return NextResponse.json({ error: 'id is required' }, { status: 400 })
  }

  const cookieStore = await cookies()
  const supabase = createClient(cookieStore)

  // Delete completed procedures first
  await supabase.from('completed_procedures').delete().eq('queue_id', id)

  // Delete queue
  const { error } = await supabase.from('queues').delete().eq('id', id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
