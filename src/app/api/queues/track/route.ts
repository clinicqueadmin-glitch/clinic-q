import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { cookies } from 'next/headers'

// GET /api/queues/track?number=E024&clinic_id=xxx
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const number = searchParams.get('number')
  const clinicId = searchParams.get('clinic_id')

  if (!number || !clinicId) {
    return NextResponse.json({ error: 'number and clinic_id are required' }, { status: 400 })
  }

  const cookieStore = await cookies()
  const supabase = createClient(cookieStore)

  // Fetch queue by number
  const { data: row, error } = await supabase
    .from('queues')
    .select('*')
    .eq('clinic_id', clinicId)
    .ilike('number', number)
    .single()

  if (error || !row) {
    return NextResponse.json({ error: 'Queue not found' }, { status: 404 })
  }

  // Fetch completed procedures
  const { data: procRows } = await supabase
    .from('completed_procedures')
    .select('*')
    .eq('queue_id', row.id)

  // Count waiting queue ahead
  const { count: waitingAhead } = await supabase
    .from('queues')
    .select('*', { count: 'exact', head: true })
    .eq('clinic_id', clinicId)
    .eq('queue_date', row.queue_date)
    .eq('status', 'waiting')
    .eq('arrived', true)
    .lt('created_at', row.created_at)

  return NextResponse.json({
    ...row,
    completed_procedures: procRows || [],
    waiting_ahead: waitingAhead || 0,
  })
}
