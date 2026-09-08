import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createClient } from '@/utils/supabase/server'

export const dynamic = 'force-dynamic'

/**
 * GET /auth/callback
 *
 * Landing page for Supabase email links (signup confirmation and password
 * recovery). The code in the URL is exchanged for a session cookie via the
 * server-side client, then the user is redirected back into the app.
 *
 *   - signup confirmation → /register?confirmed=1 (finishes clinic setup)
 *   - password recovery   → /login (recovery flow shows "set new password")
 *
 * If the exchange fails, the user is sent to /login with an error flag.
 */
export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')
  const type = requestUrl.searchParams.get('type')

  if (code) {
    const cookieStore = await cookies()
    const supabase = createClient(cookieStore)
    const { error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error) {
      if (type === 'recovery') {
        return NextResponse.redirect(new URL('/login', requestUrl.origin))
      }
      // Signup confirmation — finish clinic registration on the register page
      return NextResponse.redirect(new URL('/register?confirmed=1', requestUrl.origin))
    }
  }

  // Missing/invalid code → back to login
  return NextResponse.redirect(new URL('/login?error=auth', requestUrl.origin))
}