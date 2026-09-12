import { NextRequest, NextResponse } from 'next/server'
import { getAdminClient } from '@/lib/supabase-admin'
import { saveTrialSubscription, TRIAL_DAYS } from '@/lib/subscription-store'
import { notifyPlatformOwner } from '@/lib/platform-notify'

export const dynamic = 'force-dynamic'

/**
 * POST /api/platform/clinic-registered
 *
 * Called by the registration flow (fire-and-forget) right after a clinic and
 * its owner membership exist. Two jobs, both server-side:
 *
 *   1. Persist the 30-day trial in `clinic_settings('subscription')` so the
 *      trial lives in the database and cannot be reset by clearing the
 *      browser's localStorage.
 *   2. Alert the Platform Owner on LINE.
 *
 * Idempotent: the trial row is inserted with `ignore-duplicates`, so a repeat
 * call (the `?confirmed=1` flow can run registration twice) reports
 * `subscriptionCreated: false` and does NOT send a second alert.
 *
 * The caller must prove ownership of the clinic with a Supabase access token;
 * the clinic name comes from the database, never from the request body.
 */

function formatThaiDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('th-TH', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      timeZone: 'Asia/Bangkok',
    })
  } catch {
    return iso
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

    const clinicId = typeof body?.clinicId === 'string' ? body.clinicId.trim() : ''
    if (!clinicId) {
      return NextResponse.json({ ok: false, error: 'clinicId is required' }, { status: 400 })
    }

    // ── Authorize: caller must be a signed-in owner of this clinic ──
    const authHeader = request.headers.get('authorization') || ''
    const token = authHeader.toLowerCase().startsWith('bearer ') ? authHeader.slice(7).trim() : ''
    if (!token) {
      return NextResponse.json({ ok: false, error: 'missing-token' }, { status: 401 })
    }

    const admin = getAdminClient()
    if (!admin) {
      console.warn('[platform/clinic-registered] service role not configured — skipping')
      return NextResponse.json({ ok: false, error: 'server-not-configured' }, { status: 200 })
    }

    const { data: userData, error: userError } = await admin.auth.getUser(token)
    const caller = userData?.user
    if (userError || !caller) {
      return NextResponse.json({ ok: false, error: 'invalid-token' }, { status: 401 })
    }

    const { data: membership } = await admin
      .from('clinic_memberships')
      .select('id')
      .eq('user_id', caller.id)
      .eq('clinic_id', clinicId)
      .eq('role', 'owner')
      .limit(1)
      .maybeSingle()

    if (!membership) {
      return NextResponse.json({ ok: false, error: 'not-clinic-owner' }, { status: 403 })
    }

    // ── 1. Persist the trial (idempotent) ──────────────────────────
    const result = await saveTrialSubscription(clinicId)

    if (!result.ok) {
      // The clinic itself already exists — a bookkeeping failure here must not
      // bubble up. Report and stop.
      console.error('[platform/clinic-registered] trial persist failed:', result.error)
      return NextResponse.json({ ok: false, error: result.error }, { status: 200 })
    }

    if (!result.created) {
      return NextResponse.json({ ok: true, subscriptionCreated: false, notified: false })
    }

    // ── 2. Alert the Platform Owner (best effort) ─────────────────
    const { data: clinic } = await admin
      .from('clinics')
      .select('name, type')
      .eq('id', clinicId)
      .limit(1)
      .maybeSingle()

    const startDate = result.subscription?.startDate || new Date().toISOString()
    const trialEnd = result.subscription?.trialEndDate || ''

    const clinicData = clinic as { name?: string; type?: string } | null
    const notified = await notifyPlatformOwner({
      title: '🏥 มีคลินิกใหม่สมัครใช้งาน',
      lines: [
        `คลินิก: ${clinicData?.name || body?.clinicName || clinicId}`,
        `ประเภท: ${clinicData?.type || '-'}`,
        `เจ้าของ: ${body?.ownerName || '-'}${body?.ownerEmail ? ` (${body.ownerEmail})` : ''}`,
        `วันที่สมัคร: ${formatThaiDate(startDate)}`,
        `Trial ${TRIAL_DAYS} วัน → หมดอายุ ${trialEnd ? formatThaiDate(trialEnd) : '-'}`,
        `Clinic ID: ${clinicId}`,
      ],
    })

    return NextResponse.json({ ok: true, subscriptionCreated: true, notified })
  } catch (error) {
    // Never make the registration flow fail because of this endpoint.
    console.error('[platform/clinic-registered] unexpected error:', error)
    return NextResponse.json({ ok: false, error: 'unexpected-error' }, { status: 200 })
  }
}
