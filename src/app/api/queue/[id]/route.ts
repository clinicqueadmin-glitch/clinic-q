import { NextResponse } from 'next/server'
import { initialQueue, type QueueItem, type ClinicType } from '@/lib/queue-data'

// In production this would query a real database
const queueStore = new Map<string, QueueItem>(initialQueue.map(q => [q.id, q]))

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  const queueId = params.id
  
  // Search by ID or queue number
  let found: QueueItem | undefined
  for (const item of queueStore.values()) {
    if (item.id === queueId || item.number.toLowerCase() === queueId.toLowerCase()) {
      found = item
      break
    }
  }

  if (!found) {
    return NextResponse.json(
      { error: 'ไม่พบคิวนี้ในระบบ', code: 'NOT_FOUND' },
      { status: 404 }
    )
  }

  // Count people ahead in queue
  const allItems = Array.from(queueStore.values())
  const waitingItems = allItems
    .filter(q => q.status === 'waiting' && q.clinicType === found.clinicType)
    .sort((a, b) => a.number.localeCompare(b.number))

  const positionInQueue = waitingItems.findIndex(q => q.id === found.id) + 1
  const waitingCount = waitingItems.length

  return NextResponse.json({
    queue: found,
    position: found.status === 'waiting' ? positionInQueue : null,
    waitingAhead: found.status === 'waiting' ? positionInQueue - 1 : null,
    totalWaitingInClinic: waitingCount,
    estimatedWaitMinutes: found.status === 'waiting' ? positionInQueue * 12 : 0,
  })
}
