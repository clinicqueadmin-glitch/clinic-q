import { NextRequest, NextResponse } from 'next/server'
import { getAdminClient } from '@/lib/supabase-admin'
import { isPlatformOwnerEmail } from '@/lib/platform-owners'

export const dynamic = 'force-dynamic'

/**
 * POST /api/line/bind
 *
 * Binds a patient's phone number to their LINE userId so the clinic can notify
 * them. The patient has no session, so this route is the only writer of
 * `line_users` (with the service-role key) and the table itself has no insert
 * policy — the browser can never write it directly.
 *
 * The clinic must exist: `clinicId` is the explicit clinic identity from the
 * QR/link (`?clinicId=`), never a value derived from a clinic type.
 */

const LINE_USER_ID = /^U[0-9a-fA-F]{32}$/

function normalizePhone(phone: string): string {
  return (phone || '').replace(/\D/g, '')
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
    const lineUserId = typeof body?.lineUserId === 'string' ? body.lineUserId.trim() : ''
    const phone = normalizePhone(body?.phoneNumber || body?.phone || '')
    const displayName = typeof body?.displayName === 'string' ? body.displayName.trim() : ''

    if (!clinicId) return NextResponse.json({ ok: false, error: 'clinicId is required' }, { status: 400 })
    if (!LINE_USER_ID.test(lineUserId)) {
      return NextResponse.json({ ok: false, error: 'รูปแบบ LINE User ID ไม่ถูกต้อง' }, { status: 400 })
    }
    if (phone.length < 9 || phone.length > 10) {
      return NextResponse.json({ ok: false, error: 'รูปแบบเบอร์โทรศัพท์ไม่ถูกต้อง' }, { status: 400 })
    }

    // Un-typed admin client (no generated DB types) — values are validated above.
    const admin = getAdminClient() as any
    if (!admin) {
      return NextResponse.json({ ok: false, error: 'server-not-configured' }, { status: 500 })
    }

    const { data: clinic } = await admin
      .from('clinics')
      .select('id')
      .eq('id', clinicId)
      .maybeSingle()
    if (!clinic) {
      return NextResponse.json({ ok: false, error: 'clinic-not-found' }, { status: 404 })
    }

    const { error } = await admin
      .from('line_users')
      .upsert(
        {
          clinic_id: clinicId,
          line_user_id: lineUserId,
          phone,
          display_name: displayName || null,
          is_active: true,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'clinic_id,line_user_id' }
      )

    if (error) {
      console.error('[line/bind] upsert failed:', error.message)
      return NextResponse.json({ ok: false, error: 'บันทึกการเชื่อมต่อไม่สำเร็จ' }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch (error: any) {
    console.error('[line/bind] error:', error)
    return NextResponse.json({ ok: false, error: 'internal-error' }, { status: 500 })
  }
}

/**
 * GET /api/line/bind?clinicId=… — the bindings of one clinic.
 *
 * Restricted to that clinic's members (and the platform owner): an open lookup
 * would let anyone test whether a phone number is bound.
 */
export async function GET(request: NextRequest) {
  try {
    const clinicId = (request.nextUrl.searchParams.get('clinicId') || '').trim()
    if (!clinicId) return NextResponse.json({ ok: false, error: 'clinicId is required' }, { status: 400 })

    const admin = getAdminClient() as any
    if (!admin) return NextResponse.json({ ok: false, error: 'server-not-configured' }, { status: 500 })

    const authHeader = request.headers.get('authorization') || ''
    const token = authHeader.toLowerCase().startsWith('bearer ') ? authHeader.slice(7).trim() : ''
    if (!token) return NextResponse.json({ ok: false, error: 'missing-token' }, { status: 401 })

    const { data: userData, error: userError } = await admin.auth.getUser(token)
    const caller = userData?.user
    if (userError || !caller) {
      return NextResponse.json({ ok: false, error: 'invalid-token' }, { status: 401 })
    }

    if (!isPlatformOwnerEmail(caller.email)) {
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

    const { data, error } = await admin
      .from('line_users')
      .select('id, line_user_id, phone, display_name, is_active, created_at, updated_at')
      .eq('clinic_id', clinicId)
      .order('created_at', { ascending: false })
      .limit(500)

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true, users: data || [], total: (data || []).length })
  } catch (error: any) {
    console.error('[line/bind] GET error:', error)
    return NextResponse.json({ ok: false, error: 'internal-error' }, { status: 500 })
  }
}
