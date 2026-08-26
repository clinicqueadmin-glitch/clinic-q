import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { cookies } from 'next/headers'

export const dynamic = 'force-dynamic'

// GET /api/queues/summary?clinic_id=clinic-dental&date=2024-01-15
// Returns queue summary grouped by branch with wait time estimation
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const clinicId = searchParams.get('clinic_id')
  const date = searchParams.get('date') || new Date().toISOString().split('T')[0]

  if (!clinicId) {
    return NextResponse.json({ error: 'clinic_id is required' }, { status: 400 })
  }

  const cookieStore = await cookies()
  const supabase = createClient(cookieStore)

  // Fetch all queues for this clinic today
  const { data: queues, error } = await supabase
    .from('queues')
    .select('*')
    .eq('clinic_id', clinicId)
    .eq('queue_date', date)
    .order('created_at', { ascending: true })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  if (!queues || queues.length === 0) {
    return NextResponse.json({
      total_waiting: 0,
      total_serving: 0,
      total_completed: 0,
      total_cancelled: 0,
      estimated_wait_minutes: 0,
      branches: [],
    })
  }

  // Fetch completed procedures
  const queueIds = queues.map((q: any) => q.id)
  const { data: procRows } = await supabase
    .from('completed_procedures')
    .select('*')
    .in('queue_id', queueIds)

  const procMap: Record<string, any[]> = {}
  procRows?.forEach((p: any) => {
    if (!procMap[p.queue_id]) procMap[p.queue_id] = []
    procMap[p.queue_id].push(p)
  })

  // Group by branch
  const branchMap: Record<string, {
    branch_id: string
    waiting: any[]
    serving: any[]
    completed: any[]
    cancelled: any[]
  }> = {}

  queues.forEach((q: any) => {
    const branchId = q.branch_id || '_other'
    if (!branchMap[branchId]) {
      branchMap[branchId] = { branch_id: branchId, waiting: [], serving: [], completed: [], cancelled: [] }
    }
    const status = q.status || 'waiting'
    if (status === 'completed') branchMap[branchId].completed.push(q)
    else if (status === 'cancelled') branchMap[branchId].cancelled.push(q)
    else if (status === 'serving') branchMap[branchId].serving.push(q)
    else branchMap[branchId].waiting.push(q)
  })

  // Calculate wait times per branch
  const now = Date.now()
  const branches = Object.values(branchMap).map(branch => {
    // Remaining time for serving patients
    const servingRemaining = branch.serving.reduce((sum: number, q: any) => {
      const expected = 30 // default 30 min per procedure
      const elapsed = q.serving_at ? Math.max(0, Math.floor((now - new Date(q.serving_at).getTime()) / 60000)) : 0
      return sum + Math.max(0, expected - elapsed)
    }, 0)

    // Duration for waiting patients
    const waitingDuration = branch.waiting.length * 30 // default 30 min each

    return {
      branch_id: branch.branch_id,
      waiting_count: branch.waiting.length,
      serving_count: branch.serving.length,
      completed_count: branch.completed.length,
      cancelled_count: branch.cancelled.length,
      estimated_wait_minutes: Math.round(servingRemaining + waitingDuration),
      serving_remaining_minutes: Math.round(servingRemaining),
      waiting_duration_minutes: waitingDuration,
    }
  })

  const totalWaiting = queues.filter((q: any) => q.status === 'waiting' && q.arrived).length
  const totalServing = queues.filter((q: any) => q.status === 'serving').length
  const totalCompleted = queues.filter((q: any) => q.status === 'completed').length
  const totalCancelled = queues.filter((q: any) => q.status === 'cancelled').length

  return NextResponse.json({
    total_waiting: totalWaiting,
    total_serving: totalServing,
    total_completed: totalCompleted,
    total_cancelled: totalCancelled,
    estimated_wait_minutes: branches.reduce((sum, b) => sum + b.estimated_wait_minutes, 0),
    branches,
  })
}
