import { NextRequest, NextResponse } from 'next/server'
import { getAdminClient } from '@/lib/supabase-admin'
import { isPlatformOwnerEmail } from '@/lib/platform-owners'
import {
  normalizeLineSettings,
  canSendLineMessages,
  isEventEnabled,
  type LineNotifyEvent,
} from '@/lib/line-settings'
import { buildQueueMessage } from '@/lib/line-messages'
import { getTodayICT } from '@/lib/ict-date'

export const dynamic = 'force-dynamic'

/**
 * POST /api/line/notify
 *
 * Sends a queue message to a patient on LINE. Everything the patient must not
 * control is decided here:
 *
 *   • whether the clinic is enabled and which events may send
 *     (`clinic_settings.line_settings`, owned by the Platform Owner),
 *   • the recipient (resolved from the `line_users` table by phone), and
 *   • the "เหลือคิวก่อนหน้า N คิว" message, which is derived from the day's
 *     waiting queues rather than trusted from the caller.
 *
 * The channel access token never leaves the server. The caller is a signed-in
 * clinic member (the front-desk screen that calls the queue) or a platform
 * owner; the queue row itself is re-read so the clinic id, phone and number
 * come from the database, not from the request body.
 */

const NOTIFY_EVENTS: LineNotifyEvent[] = ['called', 'serving', 'completed', 'cancelled']

function normalizePhone(phone?: string | null): string {
  return (phone || '').replace(/\D/g, '')
}

async function pushLineMessage(token: string, to: string, message: unknown): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch('https://api.line.me/v2/bot/message/push', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ to, messages: [message] }),
    })
    if (!res.ok) {
      const detail = await res.text().catch(() => '')
      return { ok: false, error: `line-${res.status}${detail ? `: ${detail.slice(0, 200)}` : ''}` }
    }
    return { ok: true }
  } catch (e: any) {
    return { ok: false, error: e?.message || 'line-request-failed' }
  }
}

export async function POST(request: NextRequest) {
  try {
    let body: any = {}
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ ok: false, error: 'invalid-body' }, { status: 400 })
    }

    const event = String(body?.event || '') as LineNotifyEvent
    if (!NOTIFY_EVENTS.includes(event)) {
      return NextResponse.json({ ok: false, error: 'invalid-event' }, { status: 400 })
    }

    // The admin client has no generated DB types (the schema is not typed), so it is
    // used loosely here — every value it returns is validated before use.
    const admin = getAdminClient() as any
    if (!admin) {
      return NextResponse.json({ ok: false, error: 'server-not-configured' }, { status: 200 })
    }

    // ── Authorize the caller ──
    const authHeader = request.headers.get('authorization') || ''
    const token = authHeader.toLowerCase().startsWith('bearer ') ? authHeader.slice(7).trim() : ''
    if (!token) return NextResponse.json({ ok: false, error: 'missing-token' }, { status: 401 })

    const { data: userData, error: userError } = await admin.auth.getUser(token)
    const caller = userData?.user
    if (userError || !caller) {
      return NextResponse.json({ ok: false, error: 'invalid-token' }, { status: 401 })
    }
    const isPlatformOwner = isPlatformOwnerEmail(caller.email)

    // ── Resolve the queue row (authoritative clinic/phone/number) ──
    const queueId = typeof body?.queueId === 'string' ? body.queueId.trim() : ''
    let queueRow: any = null
    if (queueId) {
      const { data } = await admin
        .from('queues')
        .select('id, clinic_id, number, patient_name, phone, queue_date')
        .eq('id', queueId)
        .maybeSingle()
      queueRow = data || null
    }

    const clinicId = String(queueRow?.clinic_id || body?.clinicId || '').trim()
    if (!clinicId) {
      return NextResponse.json({ ok: false, error: 'clinicId is required' }, { status: 400 })
    }
    if (queueRow && body?.clinicId && String(body.clinicId) !== String(queueRow.clinic_id)) {
      return NextResponse.json({ ok: false, error: 'clinic-mismatch' }, { status: 403 })
    }

    if (!isPlatformOwner) {
      const { data: membership } = await admin
        .from('clinic_memberships')
        .select('id')
        .eq('user_id', caller.id)
        .eq('clinic_id', clinicId)
        .eq('is_active', true)
        .limit(1)
        .maybeSingle()
      if (!membership) {
        return NextResponse.json({ ok: false, error: 'forbidden' }, { status: 403 })
      }
    }

    // ── Platform-managed settings ──
    const { data: settingsRow } = await admin
      .from('clinic_settings')
      .select('setting_value')
      .eq('clinic_id', clinicId)
      .eq('setting_key', 'line_settings')
      .maybeSingle()
    const settings = normalizeLineSettings(settingsRow?.setting_value)

    if (!canSendLineMessages(settings)) {
      return NextResponse.json({ ok: true, skipped: 'line-disabled' })
    }

    const phone = normalizePhone(queueRow?.phone || body?.phone)
    const queueNumber = String(queueRow?.number || body?.queueNumber || '')
    const patientName = String(queueRow?.patient_name || body?.patientName || '')
    const roomNumber = typeof body?.roomNumber === 'number' ? body.roomNumber : undefined
    const practitionerName = typeof body?.practitionerName === 'string' ? body.practitionerName : undefined

    const results: Record<string, unknown> = {}

    // ── The patient's own event message ──
    if (isEventEnabled(settings, event)) {
      const recipient = await resolveRecipient(admin, clinicId, phone, body?.lineUserId)
      if (!recipient) {
        results[event] = 'no-line-user'
      } else {
        const message = buildQueueMessage(event, { queueNumber, patientName, roomNumber, practitionerName })
        const sent = await pushLineMessage(settings.channelToken, recipient, message)
        results[event] = sent.ok ? 'sent' : sent.error
      }
    } else {
      results[event] = 'event-disabled'
    }

    // ── "อีก N คิวจะถึงคิวของคุณ" ──
    // Sent when a queue is called: the patient now exactly `queuesAhead` places
    // from the front of the day's waiting list is notified once.
    const queuesAhead = settings.notifications.queuesAhead
    if (event === 'called' && queuesAhead > 0) {
      const date = queueRow?.queue_date || getTodayICT()
      const { data: waiting } = await admin
        .from('queues')
        .select('id, number, patient_name, phone, created_at')
        .eq('clinic_id', clinicId)
        .eq('queue_date', date)
        .eq('status', 'waiting')
        .order('created_at', { ascending: true })

      const target = Array.isArray(waiting) ? waiting[queuesAhead] : undefined
      if (!target) {
        results.ahead = 'no-queue-at-position'
      } else {
        const recipient = await resolveRecipient(admin, clinicId, normalizePhone(target.phone))
        if (!recipient) {
          results.ahead = 'no-line-user'
        } else {
          const message = buildQueueMessage('ahead', {
            queueNumber: String(target.number || ''),
            patientName: String(target.patient_name || ''),
            queuesAhead,
          })
          const sent = await pushLineMessage(settings.channelToken, recipient, message)
          results.ahead = sent.ok ? 'sent' : sent.error
        }
      }
    }

    return NextResponse.json({ ok: true, results })
  } catch (error: any) {
    console.error('[line/notify] error:', error)
    return NextResponse.json({ ok: false, error: 'internal-error' }, { status: 500 })
  }
}

/**
 * The LINE userId to send to: an explicit one from the caller, otherwise the
 * active binding for this phone in this clinic (the DB is the source of truth;
 * the browser cache is not consulted server-side).
 */
async function resolveRecipient(
  admin: any,
  clinicId: string,
  phone: string,
  explicit?: unknown
): Promise<string | null> {
  const given = typeof explicit === 'string' ? explicit.trim() : ''
  if (given) return given
  if (!phone) return null

  const { data } = await admin
    .from('line_users')
    .select('line_user_id')
    .eq('clinic_id', clinicId)
    .eq('phone', phone)
    .eq('is_active', true)
    .limit(1)
    .maybeSingle()

  return data?.line_user_id || null
}
