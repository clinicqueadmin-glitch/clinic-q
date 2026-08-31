import { NextResponse } from 'next/server'

// Check which tables exist in Supabase
export async function GET() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY

  if (!supabaseUrl || !supabaseKey) {
    return NextResponse.json({ 
      success: false, 
      message: 'Supabase ไม่ได้ตั้งค่าenv variables',
      tables: {} 
    })
  }

  const tables = ['clinics', 'branches', 'rooms', 'queues', 'completed_procedures', 'users', 'clinic_memberships', 'practitioners']
  const results: Record<string, boolean> = {}

  for (const table of tables) {
    try {
      const res = await fetch(`${supabaseUrl}/rest/v1/${table}?select=id&limit=1`, {
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
        },
      })
      results[table] = res.ok
    } catch {
      results[table] = false
    }
  }

  const allExist = Object.values(results).every(Boolean)

  return NextResponse.json({
    success: allExist,
    message: allExist 
      ? '✅ ทุกตารางพร้อมใช้งาน!' 
      : '❌ บางตารางยังไม่ถูกสร้าง — กรุณารัน SQL ใน Supabase SQL Editor',
    tables: results,
  })
}
