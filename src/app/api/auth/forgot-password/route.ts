import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

/**
 * POST /api/auth/forgot-password
 *
 * Accepts:
 *   - email (owner) → calls Supabase resetPasswordForEmail
 *   - username (staff) → generates temp password, returns it on screen
 *
 * Staff users have internal emails (xxx@internal.clinicq.local) that
 * cannot receive Supabase reset emails, so we generate a temp password
 * instead and return it to display on screen.
 */
export async function POST(request: NextRequest) {
  let body: any
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const identifier = typeof body?.identifier === 'string' ? body.identifier.trim() : ''
  if (!identifier) {
    return NextResponse.json({ error: 'กรุณากรอกอีเมลหรือชื่อผู้ใช้' }, { status: 400 })
  }

  const isEmail = identifier.includes('@') && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(identifier)

  if (isEmail) {
    // ── Owner / email-based user: use Supabase resetPasswordForEmail ──
    const { getAdminClient } = await import('@/lib/supabase-admin')
    const admin = getAdminClient()
    if (!admin) {
      return NextResponse.json({ error: 'Supabase ไม่ได้เชื่อมต่อ' }, { status: 500 })
    }

    const db = admin as any
    const { error } = await db.auth.resetPasswordForEmail(identifier, {
      redirectTo: `${request.headers.get('origin') || 'https://clinic-q.app'}/login`,
    })

    if (error) {
      // For security, don't reveal whether the email exists
      return NextResponse.json({
        success: true,
        message: 'หากอีเมลนี้มีอยู่ในระบบ ระบบได้ส่งลิงก์สำหรับตั้งรหัสผ่านใหม่ไปยังอีเมลของคุณแล้ว กรุณาตรวจสอบอีเมล (รวมถึงโฟลเดอร์สแปม)',
      })
    }

    return NextResponse.json({
      success: true,
      message: 'ระบบได้ส่งลิงก์สำหรับตั้งรหัสผ่านใหม่ไปยังอีเมลของคุณแล้ว กรุณาตรวจสอบอีเมล (รวมถึงโฟลเดอร์สแปม)',
    })
  } else {
    // ── Staff username: generate temp password ──
    const { getAdminClient } = await import('@/lib/supabase-admin')
    const admin = getAdminClient()
    if (!admin) {
      return NextResponse.json({ error: 'ระบบยังไม่พร้อม กรุณาติดต่อผู้ดูแลระบบ' }, { status: 500 })
    }

    const db = admin as any

    // 1. Look up username in staff_usernames
    const { data: usernameRow, error: usernameError } = await db
      .from('staff_usernames')
      .select('user_id')
      .eq('username', identifier)
      .maybeSingle()

    if (usernameError || !usernameRow) {
      // For security, don't reveal whether the username exists
      return NextResponse.json({
        success: true,
        message: 'หากชื่อผู้ใช้นี้มีอยู่ในระบบ ระบบได้สร้างรหัสผ่านชั่วคราวใหม่แล้ว กรุณาใช้รหัสผ่านชั่วคราวด้านล่างเข้าสู่ระบบ',
      })
    }

    // 2. Get auth user info
    const { data: authUser } = await db.auth.admin.getUserById(usernameRow.user_id)
    if (!authUser?.user) {
      return NextResponse.json({
        success: true,
        message: 'หากชื่อผู้ใช้นี้มีอยู่ในระบบ ระบบได้สร้างรหัสผ่านชั่วคราวใหม่แล้ว กรุณาใช้รหัสผ่านชั่วคราวด้านล่างเข้าสู่ระบบ',
      })
    }

    // 3. Check if the auth email is internal (staff) — only allow temp password for internal emails
    const authEmail = authUser.user.email || ''
    const isInternal = authEmail.endsWith('@internal.clinicq.local')

    if (!isInternal) {
      // Non-internal email → use Supabase resetPasswordForEmail
      const { getAdminClient } = await import('@/lib/supabase-admin')
      const adminClient = getAdminClient()
      if (adminClient) {
        await (adminClient as any).auth.resetPasswordForEmail(authEmail, {
          redirectTo: `${request.headers.get('origin') || 'https://clinic-q.app'}/login`,
        })
      }
      return NextResponse.json({
        success: true,
        message: 'ระบบได้ส่งลิงก์สำหรับตั้งรหัสผ่านใหม่ไปยังอีเมลของคุณแล้ว กรุณาตรวจสอบอีเมล',
      })
    }

    // 4. Generate temp password (8 chars, mixed case + digits)
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789'
    let tempPassword = ''
    for (let i = 0; i < 10; i++) {
      tempPassword += chars.charAt(Math.floor(Math.random() * chars.length))
    }

    // 5. Set new password via admin API
    const { error: updateError } = await db.auth.admin.updateUserById(usernameRow.user_id, {
      password: tempPassword,
    })

    if (updateError) {
      return NextResponse.json({ error: 'ไม่สามารถสร้างรหัสผ่านชั่วคราวได้ กรุณาลองใหม่' }, { status: 500 })
    }

    // 6. Return temp password to display on screen
    return NextResponse.json({
      success: true,
      tempPassword,
      message: 'ระบบได้สร้างรหัสผ่านชั่วคราวใหม่แล้ว ใช้รหัสผ่านด้านล่างเข้าสู่ระบบ แล้วเปลี่ยนรหัสผ่านทันที',
    })
  }
}
