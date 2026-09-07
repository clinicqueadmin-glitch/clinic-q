import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createClient } from '@/utils/supabase/server'
import { getAdminClient } from '@/lib/supabase-admin'

export const dynamic = 'force-dynamic'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

// ── Rate limiter ───────────────────────────────────────────────
// Simple in-memory limiter per caller per hour. Production should
// replace this with Redis / Upstash.
const RATE_LIMIT = 10
const RATE_WINDOW_MS = 60 * 60 * 1000
const inviteTimestamps = new Map<string, number[]>()

function isRateLimited(userId: string): boolean {
  const now = Date.now()
  const hits = (inviteTimestamps.get(userId) || []).filter(t => now - t < RATE_WINDOW_MS)
  if (hits.length >= RATE_LIMIT) return true
  hits.push(now)
  inviteTimestamps.set(userId, hits)
  return false
}

/**
 * Generate a secure temporary password.
 *
 * Same policy as the reset endpoint:
 *  - 12 chars, mixed case letters + digits, no ambiguous chars
 *  - NOT "123456" or any static default
 *  - Never stored in any application table
 */
function generateTempPassword(): string {
  const LOWER = 'abcdefghjkmnpqrstuvwxyz'
  const UPPER = 'ABCDEFGHJKMNPQRSTUVWXYZ'
  const DIGITS = '23456789'
  const ALL = LOWER + UPPER + DIGITS

  const array = new Uint8Array(12)
  crypto.getRandomValues(array)
  let result = ''
  for (let i = 0; i < 12; i++) {
    result += ALL[array[i] % ALL.length]
  }

  // Ensure at least one digit and one letter.
  if (!/\d/.test(result)) {
    result = result.slice(0, 11) + DIGITS[array[11] % DIGITS.length]
  }
  if (!/[a-zA-Z]/.test(result)) {
    result = result.slice(0, 11) + LOWER[array[11] % LOWER.length]
  }

  return result
}

/**
 * Generate a deterministic clinic code like 'SM4827'.
 *
 * Two-part: 2-letter prefix (clinic type based) + 4 alphanumeric chars
 * from a random source. The code is stored in clinics.code and used as
 * the prefix for default usernames like SM4827-manager.
 *
 * For new clinics this is generated at creation time and stored.
 * For existing clinics missing a code, the migration seeds one.
 */
function generateClinicCode(clinicType?: string): string {
  const prefix = clinicType === 'dental' ? 'DT'
    : clinicType === 'medical' ? 'MD'
    : clinicType === 'aesthetic' ? 'AE'
    : clinicType === 'thai' ? 'TH'
    : clinicType === 'chinese' ? 'CH'
    : clinicType === 'physical' ? 'PH'
    : 'CL'

  const array = new Uint8Array(4)
  crypto.getRandomValues(array)
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // no I/O/0/1
  let suffix = ''
  for (let i = 0; i < 4; i++) {
    suffix += chars[array[i] % chars.length]
  }

  return prefix + suffix
}

/**
 * Build a synthetic auth email that:
 *  - is unique per auth user
 *  - cannot collide with real owner emails (internal domain)
 *  - cannot be used to actually send email externally
 *  - is never shown to staff
 *
 * Format: <uuid>@internal.clinicq.local
 *
 * Supabase Auth uses this as the credential identifier; staff login
 * always goes through username → auth user → auth email resolution.
 */
function buildSyntheticAuthEmail(authUserId: string): string {
  // Use a portion of the auth user id plus a random segment for safety.
  const array = new Uint8Array(4)
  crypto.getRandomValues(array)
  const rand = Array.from(array, b => b.toString(16).padStart(2, '0')).join('')
  return `${authUserId}-${rand}@internal.clinicq.local`
}

/**
 * Generate default staff username from clinic code and role.
 *
 * Examples:
 *   SM4827-manager
 *   SM4827-counter
 *   SM4827-staff01
 */
function buildDefaultUsername(clinicCode: string, role: string, index?: number): string {
  if (role === 'manager') return `${clinicCode}-manager`
  if (role === 'counter') return `${clinicCode}-counter`
  // For staff / other roles, use a counter suffix
  const suffix = index != null ? String(index).padStart(2, '0') : '01'
  return `${clinicCode}-staff${suffix}`
}

/**
 * Create a staff Supabase Auth user with a generated temporary password
 * and a synthetic auth email.
 *
 * Returns { authUserId, authEmail, tempPassword } or throws.
 */
async function createStaffAuthUser(
  admin: any,
  name: string,
  clinicId: string,
  clinicCode: string,
  role: string,
  tempPassword: string,
  username: string,
): Promise<{ authUserId: string; authEmail: string }> {
  const syntheticEmail = buildSyntheticAuthEmail(`staff-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`)

  const { data: authData, error: authError } = await (admin.auth.admin as any).createUser({
    email: syntheticEmail,
    password: tempPassword,
    options: {
      emailConfirm: false,            // staff can log in immediately
      redirectTo: '/login',
      data: {
        name,
        clinic_id: clinicId,
        username,
        role,
        is_staff: true,
      },
    },
  })

  if (authError) {
    const msg = (authError.message || '').toLowerCase()
    if (msg.includes('already registered') || msg.includes('already been registered')) {
      throw new Error('AUTH_DUPLICATE')
    }
    throw new Error(`AUTH_CREATE_FAILED: ${authError.message}`)
  }

  const authUserId = authData?.user?.id
  if (!authUserId) {
    throw new Error('AUTH_NO_ID')
  }

  return { authUserId, authEmail: syntheticEmail }
}

// ────────────────────────────────────────────────────────────────
// POST /api/clinics/[clinicId]/users
// ────────────────────────────────────────────────────────────────

/**
 * Create one staff/manager/counter/practitioner user.
 *
 * The caller must be an active owner or manager of the clinic.
 *
 * Request body:
 *   {
 *     name: string,
 *     username?: string,          // optional; auto-generated if absent
 *     phone?: string,
 *     email?: string,             // optional; required for owner accounts only
 *     roles: string[],
 *     branchIds?: string[],
 *     type: 'staff' | 'default',  // 'default' = create default manager + counter
 *   }
 *
 * Behavior:
 *   - For regular staff: create a real Supabase Auth user (synthetic email,
 *     generated temp password), insert public.users, clinic_memberships,
 *     staff_usernames, and practitioners if applicable.
 *   - For default clinic accounts: also read clinics.code and create
 *     default manager + counter accounts for the new clinic.
 *
 * Response returns the created username + temporary password ONCE.
 * The password is never stored or returned again.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { clinicId: string } }
) {
  const { clinicId } = params
  if (!clinicId) {
    return NextResponse.json({ error: 'clinicId is required' }, { status: 400 })
  }

  // ── 1. Authenticated caller ───────────────────────────────────
  const cookieStore = await cookies()
  const sb = createClient(cookieStore)

  const { data: { user: caller }, error: callerError } = await sb.auth.getUser()
  if (callerError || !caller) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  // ── 2. Verify caller is active owner/manager of the clinic ────
  const { data: membership, error: memError } = await sb
    .from('clinic_memberships')
    .select('id, role')
    .eq('user_id', caller.id)
    .eq('clinic_id', clinicId)
    .in('role', ['owner', 'manager'])
    .eq('is_active', true)
    .maybeSingle()

  if (memError || !membership) {
    return NextResponse.json({ error: 'not authorized for this clinic' }, { status: 403 })
  }

  const callerRole = membership.role as string

  // ── 3. Parse + validate input ──────────────────────────────────
  let body: any
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  // Detect "create default clinic accounts" mode
  const isDefaultMode = body?.type === 'default'

  if (isDefaultMode) {
    return createDefaultClinicAccounts(caller, callerRole, clinicId, sb)
  }

  // Regular staff creation mode
  const name = typeof body?.name === 'string' ? body.name.trim() : ''
  const username = typeof body?.username === 'string' ? body.username.trim() : ''
  const phone = typeof body?.phone === 'string' && body.phone.trim() ? body.phone.trim() : ''
  const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : ''
  const roles = Array.isArray(body?.roles) ? body.roles.filter((r: unknown): r is string => typeof r === 'string') : []
  const branchIds = Array.isArray(body?.branchIds)
    ? body.branchIds.filter((b: unknown): b is string => typeof b === 'string')
    : []
  const isPractitioner = roles.includes('practitioner')

  if (!name) {
    return NextResponse.json({ error: 'name is required' }, { status: 400 })
  }
  if (roles.length === 0) {
    return NextResponse.json({ error: 'at least one role is required' }, { status: 400 })
  }

  // Phone validation: if provided, must be exactly 10 digits
  if (phone && !/^[0-9]{10}$/.test(phone.replace(/[^0-9]/g, ''))) {
    return NextResponse.json(
      { error: 'เบอร์โทรศัพท์ต้องเป็นตัวเลข 10 หลัก 정확히' },
      { status: 400 }
    )
  }
  // Normalize phone to digits only
  const normalizedPhone = phone.replace(/[^0-9]/g, '')

  // Username: required for staff accounts; optional for owners
  const requiresUsername = !isPractitioner || roles.includes('practitioner')
  if (!username && requiresUsername) {
    // Will be auto-generated below
  }

  // ── 4. Rate limit ─────────────────────────────────────────────
  if (isRateLimited(caller.id)) {
    return NextResponse.json({ error: 'too many invites, try again later' }, { status: 429 })
  }

  // ── 5. Service-role client ─────────────────────────────────────
  const admin = getAdminClient()
  if (!admin) {
    return NextResponse.json({ error: 'server not configured for account creation' }, { status: 500 })
  }

  const db = admin as any

  // ── 6. Get clinic code (for default username generation) ──────
  const { data: clinic } = await db.from('clinics').select('code').eq('id', clinicId).single()
  const clinicCode = clinic?.code || 'CL0000'

  // ── 7. Resolve or generate username ───────────────────────────
  const finalUsername = username || buildDefaultUsername(clinicCode, roles[0], undefined)

  // ── 8. Duplicate checks ────────────────────────────────────────
  // Check username uniqueness in staff_usernames
  const { data: existingUsername } = await db
    .from('staff_usernames')
    .select('id')
    .eq('clinic_id', clinicId)
    .eq('username', finalUsername)
    .maybeSingle()

  if (existingUsername) {
    return NextResponse.json({ error: 'username already exists in this clinic' }, { status: 409 })
  }

  // For practitioner: check name uniqueness in practitioners table
  if (isPractitioner) {
    const { data: existingPractitioner } = await db
      .from('practitioners')
      .select('id')
      .eq('clinic_id', clinicId)
      .eq('name', name)
      .maybeSingle()
    if (existingPractitioner) {
      return NextResponse.json({ error: 'practitioner already exists in this clinic' }, { status: 409 })
    }
  }

  // For email-based accounts (practitioners with real email): check email uniqueness
  const effectiveEmail = isPractitioner && email && EMAIL_RE.test(email) ? email : ''
  if (effectiveEmail) {
    const { data: existingEmailUser } = await db
      .from('users')
      .select('id')
      .eq('email', effectiveEmail)
      .maybeSingle()
    if (existingEmailUser) {
      return NextResponse.json({ error: 'email already registered' }, { status: 409 })
    }
  }

  // ── 9. Generate temporary password ────────────────────────────
  const tempPassword = generateTempPassword()

  // ── 10. Create auth user (transaction) ────────────────────────
  // We create the auth user, then do all the local inserts. If local inserts
  // fail, we delete the orphan auth user. This prevents orphan auth accounts.
  let authUserId: string | null = null
  let authEmail: string | null = null

  try {
    // 10a. Create the Supabase Auth user
    if (effectiveEmail && EMAIL_RE.test(effectiveEmail)) {
      // Practitioner with real email: use the real email
      const { data: authData, error: authError } = await (admin.auth.admin as any).createUser({
        email: effectiveEmail,
        password: tempPassword,
        options: {
          emailConfirm: false,
          redirectTo: '/login',
          data: {
            name,
            clinic_id: clinicId,
            username: finalUsername,
            role: isPractitioner ? 'practitioner' : roles[0],
            is_staff: true,
          },
        },
      })

      if (authError) {
        const msg = (authError.message || '').toLowerCase()
        if (msg.includes('already registered') || msg.includes('already been registered')) {
          return NextResponse.json({ error: 'email already registered' }, { status: 409 })
        }
        return NextResponse.json({ error: 'failed to create auth account' }, { status: 500 })
      }

      authUserId = authData?.user?.id || null
      authEmail = effectiveEmail
    } else {
      // Staff / manager / counter: synthetic auth email
      const result = await createStaffAuthUser(admin, name, clinicId, clinicCode, roles[0], tempPassword, finalUsername)
      authUserId = result.authUserId
      authEmail = result.authEmail
    }

    if (!authUserId) {
      return NextResponse.json({ error: 'failed to create auth account' }, { status: 500 })
    }

    // 10b. Insert public.users
    await db.from('users').insert({
      id: authUserId,
      email: authEmail,           // synthetic email stored here, not exposed to staff
      name,
      phone: normalizedPhone || '',
      force_password_change: true,
    })

    // 10c. Insert clinic_memberships (one per role)
    const membershipIdBase = `mem-${authUserId}`
    for (const role of roles) {
      await db.from('clinic_memberships').insert({
        id: `${membershipIdBase}-${role}`,
        user_id: authUserId,
        clinic_id: clinicId,
        role,
        is_active: true,
      })
    }

    // 10d. Insert staff_usernames
    await db.from('staff_usernames').insert({
      clinic_id: clinicId,
      username: finalUsername,
      user_id: authUserId,
    })

    // 10e. Insert practitioners if applicable
    let practitionerId: string | null = null
    if (isPractitioner) {
      practitionerId = `pract-${authUserId}`
      await db.from('practitioners').insert({
        id: practitionerId,
        user_id: authUserId,
        clinic_id: clinicId,
        name,
        branch_ids: branchIds.length > 0 ? branchIds : [],
        is_active: true,
      })
    }

    // ── 11. Return safe data (temp password ONCE) ─────────────────
    return NextResponse.json({
      user: {
        id: authUserId,
        name,
        username: finalUsername,
        phone,
        roles,
        branchIds: isPractitioner ? branchIds : [],
        isPractitioner,
      },
      temporaryPassword: tempPassword,
      message: isPractitioner && effectiveEmail
        ? 'Account created. If the practitioner has a real email, they can use it to log in. Otherwise they must use their username and the temporary password above, then change it on first login.'
        : 'Account created. The user must log in with username + the temporary password above, then change it on first login.',
    }, { status: 201 })

  } catch (err: any) {
    // ── 12. Compensation: delete orphan auth user ────────────────
    if (authUserId) {
      try {
        await (admin.auth.admin as any).deleteUser(authUserId)
      } catch (delErr) {
        console.error('Compensation deleteUser failed for', authUserId, delErr)
      }
    }

    // Distinguish duplicate errors for friendly messages
    const msg = (err?.message || '').toLowerCase()
    if (msg === 'username already exists in this clinic' || msg.includes('duplicate')) {
      return NextResponse.json({ error: 'username already exists in this clinic' }, { status: 409 })
    }
    if (msg === 'AUTH_DUPLICATE' || msg.includes('already registered')) {
      return NextResponse.json({ error: 'email already registered' }, { status: 409 })
    }
    if (msg === 'AUTH_NO_ID') {
      return NextResponse.json({ error: 'failed to resolve auth account' }, { status: 500 })
    }

    return NextResponse.json({ error: 'failed to create user' }, { status: 500 })
  }
}

// ────────────────────────────────────────────────────────────────
// Default clinic accounts (manager + counter)
// ────────────────────────────────────────────────────────────────

/**
 * Create default manager + counter accounts when a new clinic is created.
 *
 * Called when the registration flow creates a new clinic and wants the
 * clinic to be immediately usable with default staff accounts.
 *
 * Returns both accounts' usernames + temporary passwords ONCE.
 */
async function createDefaultClinicAccounts(
  caller: any,
  callerRole: string,
  clinicId: string,
  sb: any,
): Promise<NextResponse> {
  const admin = getAdminClient()
  if (!admin) {
    return NextResponse.json({ error: 'server not configured for account creation' }, { status: 500 })
  }

  const db = admin as any

  // Read clinic code
  const { data: clinic } = await db.from('clinics').select('code').eq('id', clinicId).single()
  if (!clinic?.code) {
    return NextResponse.json({ error: 'clinic code not found; ensure clinic.code is set' }, { status: 400 })
  }
  const clinicCode = clinic.code

  // Check that default accounts don't already exist
  const { data: existingManager } = await db
    .from('staff_usernames')
    .select('id')
    .eq('clinic_id', clinicId)
    .eq('username', `${clinicCode}-manager`)
    .maybeSingle()
  if (existingManager) {
    return NextResponse.json({ error: 'default manager account already exists for this clinic' }, { status: 409 })
  }

  const { data: existingCounter } = await db
    .from('staff_usernames')
    .select('id')
    .eq('clinic_id', clinicId)
    .eq('username', `${clinicCode}-counter`)
    .maybeSingle()
  if (existingCounter) {
    return NextResponse.json({ error: 'default counter account already exists for this clinic' }, { status: 409 })
  }

  // Generate temporary passwords
  const managerTempPassword = generateTempPassword()
  const counterTempPassword = generateTempPassword()

  let managerAuthUserId: string | null = null
  let counterAuthUserId: string | null = null

  try {
    // ── Manager ─────────────────────────────────────────────────
    const managerUsername = `${clinicCode}-manager`
    const managerResult = await createStaffAuthUser(
      admin,
      'ผู้จัดการคลินิก',
      clinicId,
      clinicCode,
      'manager',
      managerTempPassword,
      managerUsername,
    )
    managerAuthUserId = managerResult.authUserId

    // public.users
    await db.from('users').insert({
      id: managerAuthUserId,
      email: managerResult.authEmail,
      name: 'ผู้จัดการคลินิก',
      phone: '',
      force_password_change: true,
    })

    // clinic_memberships
    await db.from('clinic_memberships').insert({
      id: `mem-${managerAuthUserId}-manager`,
      user_id: managerAuthUserId,
      clinic_id: clinicId,
      role: 'manager',
      is_active: true,
    })

    // staff_usernames
    await db.from('staff_usernames').insert({
      clinic_id: clinicId,
      username: managerUsername,
      user_id: managerAuthUserId,
    })

    // ── Counter ─────────────────────────────────────────────────
    const counterUsername = `${clinicCode}-counter`
    const counterResult = await createStaffAuthUser(
      admin,
      'เจ้าหน้าที่เคาน์เตอร์',
      clinicId,
      clinicCode,
      'counter',
      counterTempPassword,
      counterUsername,
    )
    counterAuthUserId = counterResult.authUserId

    // public.users
    await db.from('users').insert({
      id: counterAuthUserId,
      email: counterResult.authEmail,
      name: 'เจ้าหน้าที่เคาน์เตอร์',
      phone: '',
      force_password_change: true,
    })

    // clinic_memberships
    await db.from('clinic_memberships').insert({
      id: `mem-${counterAuthUserId}-counter`,
      user_id: counterAuthUserId,
      clinic_id: clinicId,
      role: 'counter',
      is_active: true,
    })

    // staff_usernames
    await db.from('staff_usernames').insert({
      clinic_id: clinicId,
      username: counterUsername,
      user_id: counterAuthUserId,
    })

    // ── Return both accounts ────────────────────────────────────
    return NextResponse.json({
      accounts: [
        {
          role: 'manager',
          username: managerUsername,
          name: 'ผู้จัดการคลินิก',
          temporaryPassword: managerTempPassword,
        },
        {
          role: 'counter',
          username: counterUsername,
          name: 'เจ้าหน้าที่เคาน์เตอร์',
          temporaryPassword: counterTempPassword,
        },
      ],
      message: 'Default manager and counter accounts created. Save the temporary passwords now — they cannot be retrieved later.',
    }, { status: 201 })

  } catch (err: any) {
    // Compensation: delete any created auth users
    if (managerAuthUserId) {
      try {
        await (admin.auth.admin as any).deleteUser(managerAuthUserId)
      } catch (e) {
        console.error('Compensation deleteUser failed for manager', managerAuthUserId, e)
      }
    }
    if (counterAuthUserId) {
      try {
        await (admin.auth.admin as any).deleteUser(counterAuthUserId)
      } catch (e) {
        console.error('Compensation deleteUser failed for counter', counterAuthUserId, e)
      }
    }

    const msg = (err?.message || '').toLowerCase()
    if (msg.includes('already exists')) {
      return NextResponse.json({ error: 'default account already exists' }, { status: 409 })
    }

    return NextResponse.json({ error: 'failed to create default accounts' }, { status: 500 })
  }
}
