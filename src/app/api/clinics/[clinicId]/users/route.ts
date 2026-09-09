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
 * Generate a unique staff username from clinic code + role + running number.
 *
 * Format: {clinicCode}-{roleKey}{NN}
 *   CL4469-manager01
 *   CL4469-staff01
 *   CL4469-practitioner01
 *   CL4469-manager02   (second manager — running number increments)
 *
 * Uniqueness is checked against staff_usernames (clinic-scoped) before
 * returning, and the running number is incremented until a free username
 * is found. Never returns a username that already exists.
 */
async function generateUniqueUsername(
  db: any,
  clinicCode: string,
  role: string,
  clinicId: string,
): Promise<string> {
  const roleKey = role === 'front_desk' ? 'staff'
    : role === 'manager' ? 'manager'
    : role === 'practitioner' ? 'practitioner'
    : 'staff'

  for (let i = 1; i <= 999; i++) {
    const candidate = `${clinicCode}-${roleKey}${String(i).padStart(2, '0')}`
    const { data: existing } = await db
      .from('staff_usernames')
      .select('id')
      .eq('clinic_id', clinicId)
      .eq('username', candidate)
      .maybeSingle()
    if (!existing) return candidate
  }

  throw new Error('UNABLE_TO_GENERATE_USERNAME')
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

  // Phone validation: if provided, must be EXACTLY 10 digits.
  // 9/11 digits, letters, spaces and symbols are all rejected — no
  // silent stripping or truncation.
  if (phone && !/^[0-9]{10}$/.test(phone)) {
    return NextResponse.json(
      { error: 'กรุณากรอกเบอร์โทรศัพท์ 10 หลัก' },
      { status: 400 }
    )
  }
  const normalizedPhone = phone

  // Role whitelist: only roles allowed by the clinic_memberships CHECK
  // constraint may be created through this endpoint.
  const ALLOWED_ROLES = ['owner', 'manager', 'front_desk', 'practitioner']
  const invalidRole = (roles as string[]).find(r => !ALLOWED_ROLES.includes(r))
  if (invalidRole) {
    return NextResponse.json({ error: 'บทบาทไม่ถูกต้อง' }, { status: 400 })
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
  // If the client supplied a username, keep it. Otherwise auto-generate a
  // unique {code}-{role}{NN} username server-side (never from the client).
  let finalUsername: string
  if (username) {
    finalUsername = username
  } else {
    finalUsername = await generateUniqueUsername(db, clinicCode, roles[0], clinicId)
  }

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

  // Duplicate phone check: reject creating a second user with the same phone
  // inside the same clinic (prevents accidental duplicate staff accounts).
  if (normalizedPhone) {
    const { data: existingPhoneUser } = await db
      .from('users')
      .select('id')
      .eq('phone', normalizedPhone)
      .maybeSingle()
    if (existingPhoneUser) {
      const { data: sameClinicMember } = await db
        .from('clinic_memberships')
        .select('id')
        .eq('user_id', existingPhoneUser.id)
        .eq('clinic_id', clinicId)
        .maybeSingle()
      if (sameClinicMember) {
        return NextResponse.json(
          { error: 'เบอร์โทรศัพท์นี้ถูกใช้โดยผู้ใช้ในคลินิกนี้แล้ว' },
          { status: 409 }
        )
      }
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
  // NOTE: force_password_change is no longer enforced in the MVP — users log
  // in immediately with the temporary password. The column is kept for future use.

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
      force_password_change: false,
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
        ? 'Account created. The user can log in with their email or username and the temporary password above.'
        : 'Account created. The user can log in with username + the temporary password above.',
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
    if (msg === 'UNABLE_TO_GENERATE_USERNAME') {
      return NextResponse.json({ error: 'ไม่สามารถสร้าง Username อัตโนมัติได้ กรุณาลองใหม่' }, { status: 500 })
    }

    return NextResponse.json({ error: 'failed to create user' }, { status: 500 })
  }
}

// ────────────────────────────────────────────────────────────────
// Default clinic accounts (manager + counter)
// ────────────────────────────────────────────────────────────────

/**
 * Create default manager + staff + practitioner accounts when a new clinic
 * is created.
 *
 * Called when the registration flow creates a new clinic and wants the
 * clinic to be immediately usable with default accounts for each role:
 *
 *   {code}-manager       → ผู้จัดการ        (role: manager)
 *   {code}-staff         → เจ้าหน้าที่      (role: front_desk)
 *   {code}-practitioner  → ผู้ทำหัตถการ    (role: practitioner)
 *
 * Returns all accounts' usernames + temporary passwords ONCE.
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

  // Default account definitions (role must match the clinic_memberships
  // CHECK constraint: owner | manager | front_desk | practitioner)
  const defaults = [
    { username: `${clinicCode}-manager`, role: 'manager', name: 'ผู้จัดการ' },
    { username: `${clinicCode}-staff`, role: 'front_desk', name: 'เจ้าหน้าที่' },
    { username: `${clinicCode}-practitioner`, role: 'practitioner', name: 'ผู้ทำหัตถการ' },
  ]

  // Check which defaults already exist — if all exist, treat as already created
  let allExist = true
  for (const d of defaults) {
    const { data: existing } = await db
      .from('staff_usernames')
      .select('id')
      .eq('clinic_id', clinicId)
      .eq('username', d.username)
      .maybeSingle()
    if (!existing) {
      allExist = false
      break
    }
  }
  if (allExist) {
    return NextResponse.json({ error: 'default accounts already exist for this clinic' }, { status: 409 })
  }

  // Generate temporary passwords
  const tempPasswords = defaults.map(() => generateTempPassword())
  const createdAuthUserIds: string[] = []

  try {
    const accounts: Array<{ role: string; username: string; name: string; temporaryPassword: string }> = []

    for (let i = 0; i < defaults.length; i++) {
      const d = defaults[i]
      const tempPassword = tempPasswords[i]

      // Skip if this specific account already exists (partial retry)
      const { data: existing } = await db
        .from('staff_usernames')
        .select('id')
        .eq('clinic_id', clinicId)
        .eq('username', d.username)
        .maybeSingle()
      if (existing) continue

      const result = await createStaffAuthUser(
        admin,
        d.name,
        clinicId,
        clinicCode,
        d.role,
        tempPassword,
        d.username,
      )
      createdAuthUserIds.push(result.authUserId)

      // public.users
      await db.from('users').insert({
        id: result.authUserId,
        email: result.authEmail,
        name: d.name,
        phone: '',
        force_password_change: false,
      })

      // clinic_memberships
      await db.from('clinic_memberships').insert({
        id: `mem-${result.authUserId}-${d.role}`,
        user_id: result.authUserId,
        clinic_id: clinicId,
        role: d.role,
        is_active: true,
      })

      // staff_usernames
      await db.from('staff_usernames').insert({
        clinic_id: clinicId,
        username: d.username,
        user_id: result.authUserId,
      })

      // practitioners (only for practitioner role)
      if (d.role === 'practitioner') {
        await db.from('practitioners').insert({
          id: `pract-${result.authUserId}`,
          user_id: result.authUserId,
          clinic_id: clinicId,
          name: d.name,
          branch_ids: [],
          is_active: true,
        })
      }

      accounts.push({
        role: d.role,
        username: d.username,
        name: d.name,
        temporaryPassword: tempPassword,
      })
    }

    return NextResponse.json({
      accounts,
      message: 'Default manager, staff and practitioner accounts created. Save the temporary passwords now — they cannot be retrieved later.',
    }, { status: 201 })

  } catch (err: any) {
    // Compensation: delete any created auth users
    for (const id of createdAuthUserIds) {
      try {
        await (admin.auth.admin as any).deleteUser(id)
      } catch (e) {
        console.error('Compensation deleteUser failed for', id, e)
      }
    }

    const msg = (err?.message || '').toLowerCase()
    if (msg.includes('already exists')) {
      return NextResponse.json({ error: 'default account already exists' }, { status: 409 })
    }

    return NextResponse.json({ error: 'failed to create default accounts' }, { status: 500 })
  }
}
