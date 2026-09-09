import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createClient } from '@/utils/supabase/server'
import { getAdminClient } from '@/lib/supabase-admin'

export const dynamic = 'force-dynamic'

const BUCKET = 'clinic-logos'
const MAX_SIZE = 2 * 1024 * 1024 // 2 MB
const ALLOWED_TYPES: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
}

/**
 * POST /api/clinics/:clinicId/logo
 *
 * Uploads the clinic logo to Supabase Storage ('clinic-logos' bucket) and
 * returns the public URL. The caller must be an ACTIVE MEMBER of the clinic.
 *
 * The storage write is done server-side with the service-role client (RLS
 * bypass) — the service-role key never reaches the browser. File type and
 * size are validated here, not just on the client.
 *
 * Body: multipart/form-data with a single file field named "file".
 * Response: { url } on success; { error } with 4xx/5xx on failure.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ clinicId: string }> }
) {
  const { clinicId } = await params

  // ── 1. Auth: caller must be an active member of this clinic ──
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

  // ── 2. Parse multipart form ──
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

  // ── 3. Validate type + size ──
  const ext = ALLOWED_TYPES[file.type]
  if (!ext) {
    return NextResponse.json({ error: 'รองรับเฉพาะไฟล์ PNG, JPEG หรือ WebP' }, { status: 400 })
  }
  if (file.size > MAX_SIZE) {
    return NextResponse.json({ error: 'ขนาดไฟล์ต้องไม่เกิน 2 MB' }, { status: 400 })
  }
  if (file.size === 0) {
    return NextResponse.json({ error: 'ไฟล์ว่างเปล่า' }, { status: 400 })
  }

  // ── 4. Upload to Storage (server-side, service role) ──
  const admin = getAdminClient()
  if (!admin) {
    return NextResponse.json({ error: 'server misconfigured' }, { status: 500 })
  }

  const buffer = Buffer.from(await file.arrayBuffer())
  const objectPath = `${clinicId}/logo` // stable path — re-upload overwrites
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