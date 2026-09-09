import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createClient } from '@/utils/supabase/server'
import { getAdminClient } from '@/lib/supabase-admin'

export const dynamic = 'force-dynamic'

const BUCKET = 'clinic-logos'
const MAX_SIZE = 500 * 1024 // 500 KB
const ALLOWED_TYPES: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
}

/**
 * POST /api/clinics/:clinicId/rooms/image
 *
 * Uploads a room image to Supabase Storage and returns the public URL.
 * The caller must be an ACTIVE MEMBER of the clinic.
 *
 * Body: multipart/form-data with fields:
 *   - file: the image file (PNG or JPEG, ≤500 KB)
 *   - roomId: the room identifier (used in the storage path)
 *
 * Storage path: {clinicId}/rooms/{roomId}
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ clinicId: string }> }
) {
  const { clinicId } = await params

  // ── 1. Auth ──────────────────────────────────────────────────
  const cookieStore = await cookies()
  const sb = createClient(cookieStore)
  const { data: { user: caller }, error: callerError } = await sb.auth.getUser()
  if (callerError || !caller) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const { data: membership, error: memError } = await sb
    .from('clinic_memberships')
    .select('id')
    .eq('user_id', caller.id)
    .eq('clinic_id', clinicId)
    .eq('is_active', true)
    .maybeSingle()
  if (memError || !membership) {
    return NextResponse.json({ error: 'not authorized for this clinic' }, { status: 403 })
  }

  // ── 2. Parse form ────────────────────────────────────────────
  let form: FormData
  try {
    form = await request.formData()
  } catch {
    return NextResponse.json({ error: 'รูปแบบคำขอไม่ถูกต้อง' }, { status: 400 })
  }

  const file = form.get('file')
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'กรุณาเลือกไฟล์รูปภาพ' }, { status: 400 })
  }

  const roomId = typeof form.get('roomId') === 'string' ? form.get('roomId') as string : null
  if (!roomId) {
    return NextResponse.json({ error: 'roomId is required' }, { status: 400 })
  }

  // ── 3. Validate ──────────────────────────────────────────────
  const ext = ALLOWED_TYPES[file.type]
  if (!ext) {
    return NextResponse.json({ error: 'รองรับเฉพาะไฟล์ PNG หรือ JPEG' }, { status: 400 })
  }
  if (file.size > MAX_SIZE) {
    return NextResponse.json({ error: 'ขนาดไฟล์ต้องไม่เกิน 500 KB' }, { status: 400 })
  }
  if (file.size === 0) {
    return NextResponse.json({ error: 'ไฟล์ว่างเปล่า' }, { status: 400 })
  }

  // ── 4. Upload to Storage ─────────────────────────────────────
  const admin = getAdminClient()
  if (!admin) {
    return NextResponse.json({ error: 'server misconfigured' }, { status: 500 })
  }

  const buffer = Buffer.from(await file.arrayBuffer())
  const objectPath = `${clinicId}/rooms/${roomId}`
  const { error: upError } = await admin.storage
    .from(BUCKET)
    .upload(objectPath, buffer, {
      contentType: file.type,
      upsert: true,
      cacheControl: '3600',
    })
  if (upError) {
    return NextResponse.json(
      { error: `ไม่สามารถอัปโหลดรูปภาพได้ (${upError.message})` },
      { status: 500 }
    )
  }

  const { data: publicUrlData } = admin.storage.from(BUCKET).getPublicUrl(objectPath)
  const url = publicUrlData?.publicUrl
  if (!url) {
    return NextResponse.json({ error: 'ไม่สามารถสร้าง URL รูปภาพได้' }, { status: 500 })
  }

  return NextResponse.json({ url })
}
