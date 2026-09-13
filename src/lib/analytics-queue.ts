// ═══ Analytics: read a clinic's queue over a date range ═══
//
// The live queue context only ever holds ONE business day (queue_date = today
// ICT), so the Analytics screen could not show a week/month/year. This module
// fetches `queues` for the period the user picked, always scoped to a verified
// clinic id, and maps rows with the canonical mapper so the shape is identical
// to the live queue.
//
// The period→range math lives in ./analytics-range (pure, dependency-free).

import { dbRowToQueueItem, type QueueItem } from './queue-context'
import type { ICTDateRange } from './analytics-range'

/** Upper bound on rows pulled for one period, so a year view cannot flood the browser. */
const MAX_ROWS = 2000
/** completed_procedures are fetched in chunks so the `in.(…)` URL stays small. */
const ID_CHUNK = 100

/**
 * Load every queue row for one clinic between two ICT business dates (inclusive),
 * with its completed procedures attached.
 *
 * Throws when the request fails, so the caller can tell "the period is empty"
 * apart from "we could not load it" and never shows a silent zero.
 */
export async function fetchClinicQueueRange(
  clinicId: string,
  range: ICTDateRange,
): Promise<QueueItem[]> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  if (!supabaseUrl || !supabaseKey) throw new Error('ไม่มีการตั้งค่า Supabase')

  const headers = { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` }

  const res = await fetch(
    `${supabaseUrl}/rest/v1/queues?clinic_id=eq.${encodeURIComponent(clinicId)}` +
      `&queue_date=gte.${range.start}&queue_date=lte.${range.end}` +
      `&order=queue_date.asc,created_at.asc&limit=${MAX_ROWS}`,
    { headers },
  )
  if (!res.ok) throw new Error(`โหลดคิวไม่สำเร็จ (HTTP ${res.status})`)

  const rows: any[] = await res.json()
  if (!Array.isArray(rows) || rows.length === 0) return []

  const ids = rows.map(r => r.id).filter(Boolean)
  const procedures: any[] = []
  for (let i = 0; i < ids.length; i += ID_CHUNK) {
    const chunk = ids.slice(i, i + ID_CHUNK)
    const procRes = await fetch(
      `${supabaseUrl}/rest/v1/completed_procedures?queue_id=in.(${chunk.join(',')})`,
      { headers },
    )
    if (procRes.ok) {
      const procRows = await procRes.json()
      if (Array.isArray(procRows)) procedures.push(...procRows)
    }
  }

  const byQueue: Record<string, any[]> = {}
  procedures.forEach(p => { (byQueue[p.queue_id] ||= []).push(p) })

  return rows.map(row => dbRowToQueueItem(row, byQueue[row.id] || []))
}
