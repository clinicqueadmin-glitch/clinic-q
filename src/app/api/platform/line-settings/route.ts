import { NextRequest, NextResponse } from 'next/server'
import { getAdminClient } from '@/lib/supabase-admin'
import { isPlatformOwnerEmail } from '@/lib/platform-owners'
import { normalizeLineSettings, type LineSettings } from '@/lib/line-settings'

export const dynamic = 'force-dynamic'

/**
 * /api/platform/line-settings — Platform Owner only.
 *
 *   GET  → every clinic with its LINE notification status.
 *   PUT  → update one clinic's `clinic_settings('line_settings')` row.
 *
 * The clinic owner cannot reach this: the caller's Supabase token is verified
 * server-side and the email must be on the platform-owner allowlist. Channel
 * secrets/tokens are never returned to the browser — only whether one is set —
 * so the Platform Owner can see the state without the credentials leaking into
 * page source, and the sending route reads them with the service role.
 */

interface ClinicStatus {
  id: string
  name: string
  type: string
  enabled: boolean
  hasSecret: boolean
  hasToken: boolean
  notifications: LineSettings['notifications']
  boundUsers: number
  updatedAt: string | null
}

async function requirePlatformOwner(request: NextRequest): Promise<
  | { ok: true; admin: any }
  | { ok: false; response: NextResponse }
> {
  const admin = getAdminClient()
  if (!admin) {
    return { ok: false, response: NextResponse.json({ ok: false, error: 'server-not-configured' }, { status: 500 }) }
  }

  const authHeader = request.headers.get('authorization') || ''
  const token = authHeader.toLowerCase().startsWith('bearer ') ? authHeader.slice(7).trim() : ''
  if (!token) {
    return { ok: false, response: NextResponse.json({ ok: false, error: 'missing-token' }, { status: 401 }) }
  }

  const { data: userData, error } = await admin.auth.getUser(token)
  const caller = userData?.user
  if (error || !caller) {
    return { ok: false, response: NextResponse.json({ ok: false, error: 'invalid-token' }, { status: 401 }) }
  }
  if (!isPlatformOwnerEmail(caller.email)) {
    return { ok: false, response: NextResponse.json({ ok: false, error: 'forbidden' }, { status: 403 }) }
  }

  return { ok: true, admin }
}

export async function GET(request: NextRequest) {
  const auth = await requirePlatformOwner(request)
  if (!auth.ok) return auth.response
  const { admin } = auth

  try {
    const { data: clinics, error } = await admin
      .from('clinics')
      .select('id, name, type')
      .order('name', { ascending: true })
    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
    }

    const { data: settingsRows } = await admin
      .from('clinic_settings')
      .select('clinic_id, setting_value, updated_at')
      .eq('setting_key', 'line_settings')

    // `line_users` may not exist yet on an environment where the migration has not
    // been applied — the console must still render, showing 0 bound users.
    const { data: boundRows, error: boundError } = await admin
      .from('line_users')
      .select('clinic_id')
      .eq('is_active', true)
      .limit(5000)
    if (boundError) {
      console.warn('[platform/line-settings] line_users unavailable:', boundError.message)
    }

    const settingsByClinic = new Map<string, { value: unknown; updated_at: string | null }>()
    for (const row of settingsRows || []) {
      settingsByClinic.set(row.clinic_id, { value: row.setting_value, updated_at: row.updated_at })
    }

    const boundCounts = new Map<string, number>()
    for (const row of boundRows || []) {
      boundCounts.set(row.clinic_id, (boundCounts.get(row.clinic_id) || 0) + 1)
    }

    const clinicStatuses: ClinicStatus[] = (clinics || []).map((c: any) => {
      const row = settingsByClinic.get(c.id)
      const settings = normalizeLineSettings(row?.value)
      return {
        id: c.id,
        name: c.name || '',
        type: c.type || '',
        enabled: settings.enabled,
        hasSecret: !!settings.channelSecret,
        hasToken: !!settings.channelToken,
        notifications: settings.notifications,
        boundUsers: boundCounts.get(c.id) || 0,
        updatedAt: row?.updated_at || null,
      }
    })

    return NextResponse.json({ ok: true, clinics: clinicStatuses })
  } catch (error: any) {
    console.error('[platform/line-settings] GET error:', error)
    return NextResponse.json({ ok: false, error: 'internal-error' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  const auth = await requirePlatformOwner(request)
  if (!auth.ok) return auth.response
  const { admin } = auth

  try {
    let body: any = {}
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ ok: false, error: 'invalid-body' }, { status: 400 })
    }

    const clinicId = typeof body?.clinicId === 'string' ? body.clinicId.trim() : ''
    if (!clinicId) return NextResponse.json({ ok: false, error: 'clinicId is required' }, { status: 400 })

    const { data: clinic } = await admin.from('clinics').select('id, name').eq('id', clinicId).maybeSingle()
    if (!clinic) return NextResponse.json({ ok: false, error: 'clinic-not-found' }, { status: 404 })

    // Merge with the stored row: an omitted secret/token keeps the existing one,
    // an explicit value replaces it (an empty string clears it).
    const { data: existingRow } = await admin
      .from('clinic_settings')
      .select('setting_value')
      .eq('clinic_id', clinicId)
      .eq('setting_key', 'line_settings')
      .maybeSingle()
    const existing = normalizeLineSettings(existingRow?.setting_value)

    const incoming = normalizeLineSettings({
      channelSecret: 'channelSecret' in body ? body.channelSecret : existing.channelSecret,
      channelToken: 'channelToken' in body ? body.channelToken : existing.channelToken,
      enabled: 'enabled' in body ? body.enabled : existing.enabled,
      notifications: 'notifications' in body ? body.notifications : existing.notifications,
    })

    const now = new Date().toISOString()
    const { error } = await admin
      .from('clinic_settings')
      .upsert(
        {
          clinic_id: clinicId,
          setting_key: 'line_settings',
          setting_value: incoming,
          updated_at: now,
        },
        { onConflict: 'clinic_id,setting_key' }
      )

    if (error) {
      console.error('[platform/line-settings] upsert failed:', error.message)
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
    }

    return NextResponse.json({
      ok: true,
      clinic: {
        id: clinic.id,
        name: clinic.name || '',
        enabled: incoming.enabled,
        hasSecret: !!incoming.channelSecret,
        hasToken: !!incoming.channelToken,
        notifications: incoming.notifications,
        updatedAt: now,
      },
    })
  } catch (error: any) {
    console.error('[platform/line-settings] PUT error:', error)
    return NextResponse.json({ ok: false, error: 'internal-error' }, { status: 500 })
  }
}
