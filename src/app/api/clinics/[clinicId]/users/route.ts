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

  // ── 3a. Role escalation guard (server-side) ────────────────────
  // Owner role may only be assigned by the registration flow
  // (createClinicAndOwner). Manager must never create an owner.
  const rawRoles = Array.isArray(body?.roles) ? body.roles.filter((r: unknown): r is string => typeof r === 'string') : []
  if (rawRoles.includes('owner')) {
    return NextResponse.json({ error: 'cannot create owner account through this endpoint' }, { status: 403 })
  }
  if (callerRole === 'manager' && rawRoles.includes('manager')) {
    return NextResponse.json({ error: 'manager cannot create another manager account' }, { status: 403 })
  }
  // Only the clinic owner may choose the role of a new account. A manager
  // caller may still add users, but the account is always created with the
  // default staff role (front_desk) server-side — the manager never gets to
  // pick or escalate a role.
  if (callerRole === 'manager' && rawRoles.length > 0) {
    return NextResponse.json({ error: 'manager cannot assign roles — contact the clinic owner' }, { status: 403 })
  }

  // Regular staff creation mode
  const name = typeof body?.name === 'string' ? body.name.trim() : ''
  const username = typeof body?.username === 'string' ? body.username.trim() : ''
  const phone = typeof body?.phone === 'string' && body.phone.trim() ? body.phone.trim() : ''
  const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : ''
  const roles = callerRole === 'manager'
    ? ['front_desk']
    : (Array.isArray(body?.roles) ? body.roles.filter((r: unknown): r is string => typeof r === 'string') : [])
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
  // constraint may be created through this endpoint. Owner is deliberately
  // excluded — owner accounts are created only by the registration flow.
  const ALLOWED_ROLES = ['manager', 'front_desk', 'practitioner']
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

// ────────────────────────────────────────────────────────────────
// GET /api/clinics/[clinicId]/users
// ────────────────────────────────────────────────────────────────

/**
 * List every member of the clinic with their roles.
 *
 * Authorization:
 *   - Any ACTIVE member of the clinic may view the member list
 *     (matches the pre-existing UI behavior where the users tab is
 *     visible to every clinic role).
 *
 * Data source: Supabase is the single source of truth. No localStorage.
 * Returns members merged from users + clinic_memberships +
 * staff_usernames + practitioners.
 */
export async function GET(
  _request: NextRequest,
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

  // ── 2. Verify caller is an ACTIVE member of the clinic ─────────
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

  // ── 3. Read all clinic members via service role (server-side only) ──
  const admin = getAdminClient()
  if (!admin) {
    return NextResponse.json({ error: 'server not configured' }, { status: 500 })
  }
  const db = admin as any

  const [membershipsRes, usersRes, usernamesRes, practitionersRes] = await Promise.all([
    db.from('clinic_memberships').select('user_id, role, is_active').eq('clinic_id', clinicId),
    db.from('users').select('id, email, name, phone, created_at, force_password_change'),
    db.from('staff_usernames').select('user_id, username').eq('clinic_id', clinicId),
    db.from('practitioners').select('user_id, branch_ids, is_active').eq('clinic_id', clinicId),
  ])

  const memberships = membershipsRes.data || []
  const users = usersRes.data || []
  const usernames = usernamesRes.data || []
  const practitioners = practitionersRes.data || []

  const usernameByUserId = new Map<string, string>()
  for (const u of usernames) usernameByUserId.set(u.user_id, u.username)

  const practitionerByUserId = new Map<string, { branch_ids: string[]; is_active: boolean }>()
  for (const p of practitioners) {
    practitionerByUserId.set(p.user_id, { branch_ids: p.branch_ids || [], is_active: p.is_active })
  }

  // Group memberships per user — roles come from ACTIVE memberships only.
  const rolesByUserId = new Map<string, string[]>()
  const anyActiveByUserId = new Map<string, boolean>()
  for (const m of memberships) {
    const roles = rolesByUserId.get(m.user_id) || []
    if (m.is_active && !roles.includes(m.role)) roles.push(m.role)
    rolesByUserId.set(m.user_id, roles)
    if (m.is_active) anyActiveByUserId.set(m.user_id, true)
  }

  const memberIds = new Set(memberships.map((m: any) => m.user_id))

  const result = users
    .filter((u: any) => memberIds.has(u.id))
    .map((u: any) => {
      const pract = practitionerByUserId.get(u.id)
      return {
        id: u.id,
        email: u.email || '',
        username: usernameByUserId.get(u.id) || '',
        name: u.name || '',
        phone: u.phone || '',
        createdAt: u.created_at || new Date().toISOString(),
        roles: rolesByUserId.get(u.id) || [],
        branchIds: pract?.branch_ids || [],
        isActive: anyActiveByUserId.has(u.id) || false,
        forcePasswordChange: u.force_password_change || false,
      }
    })
    .sort((a: any, b: any) => a.name.localeCompare(b.name, 'th'))

  return NextResponse.json({ users: result }, { status: 200 })
}

// ────────────────────────────────────────────────────────────────
// PATCH /api/clinics/[clinicId]/users
// ────────────────────────────────────────────────────────────────

/**
 * Edit an existing clinic member.
 *
 * Request body:
 *   {
 *     userId: string,          // required — target member
 *     name?: string,
 *     phone?: string,
 *     roles?: ClinicRole[],    // replaces the member's role set
 *     branchIds?: string[],    // practitioner branches
 *     isActive?: boolean,      // true = activate, false = soft-deactivate
 *   }
 *
 * Authorization (server-side enforcement):
 *   - Caller must be an ACTIVE owner or manager of the clinic.
 *   - Manager:
 *       • may only target staff-level members (front_desk / practitioner)
 *       • may NOT target owner or another manager
 *       • may NOT assign the owner or manager role
 *   - Owner:
 *       • may target manager / front_desk / practitioner
 *       • may NOT target another owner-role member
 *       • may NOT assign the owner role (registration flow only)
 *       • may NOT deactivate their own account
 *   - No caller may deactivate an owner-role member.
 *
 * Effects:
 *   - users.name / users.phone
 *   - clinic_memberships: adds new role memberships, soft-removes removed
 *     ones (is_active = false), activates/deactivates on isActive toggle
 *   - practitioners.branch_ids / is_active when practitioner role involved
 */
export async function PATCH(
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

  // ── 2. Verify caller is an ACTIVE owner/manager of the clinic ──
  const { data: callerMembership, error: memError } = await sb
    .from('clinic_memberships')
    .select('id, role')
    .eq('user_id', caller.id)
    .eq('clinic_id', clinicId)
    .in('role', ['owner', 'manager'])
    .eq('is_active', true)
    .maybeSingle()

  if (memError || !callerMembership) {
    return NextResponse.json({ error: 'not authorized for this clinic' }, { status: 403 })
  }

  const callerRole = callerMembership.role as string

  // ── 3. Parse + validate input ──────────────────────────────────
  let body: any
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const userId = typeof body?.userId === 'string' ? body.userId.trim() : ''
  if (!userId) {
    return NextResponse.json({ error: 'userId is required' }, { status: 400 })
  }

  const name = typeof body?.name === 'string' ? body.name.trim() : undefined
  const phone = typeof body?.phone === 'string' && body.phone.trim() ? body.phone.trim() : undefined
  const newUsername = typeof body?.username === 'string' ? body.username.trim() : undefined
  const roles: string[] | undefined = Array.isArray(body?.roles)
    ? (body.roles as unknown[]).filter((r): r is string => typeof r === 'string')
    : undefined
  const branchIds = Array.isArray(body?.branchIds)
    ? body.branchIds.filter((b: unknown): b is string => typeof b === 'string')
    : undefined
  const isActive = typeof body?.isActive === 'boolean' ? body.isActive : undefined

  if (name !== undefined && !name) {
    return NextResponse.json({ error: 'name cannot be empty' }, { status: 400 })
  }
  if (phone !== undefined && !/^[0-9]{10}$/.test(phone)) {
    return NextResponse.json({ error: 'กรุณากรอกเบอร์โทรศัพท์ 10 หลัก' }, { status: 400 })
  }

  const EDITABLE_ROLES = ['manager', 'front_desk', 'practitioner']
  if (roles !== undefined) {
    if (roles.length === 0) {
      return NextResponse.json({ error: 'at least one role is required' }, { status: 400 })
    }
    const invalidRole = roles.find(r => !EDITABLE_ROLES.includes(r))
    if (invalidRole) {
      return NextResponse.json({ error: 'บทบาทไม่ถูกต้อง' }, { status: 400 })
    }
    // Role escalation: nobody may assign the owner role through this API.
    if (roles.includes('owner')) {
      return NextResponse.json({ error: 'cannot assign owner role through this endpoint' }, { status: 403 })
    }
    // Manager may not assign the manager role.
    if (callerRole === 'manager' && roles.includes('manager')) {
      return NextResponse.json({ error: 'manager cannot assign the manager role' }, { status: 403 })
    }
  }

  // Only the clinic owner may change roles, practitioner branch
  // assignments, or the username. A manager may still update name/phone/
  // active state of staff accounts, but never the role configuration or
  // the login username.
  if (callerRole === 'manager' && (roles !== undefined || branchIds !== undefined || newUsername !== undefined)) {
    return NextResponse.json({ error: 'manager cannot change roles or branch assignments' }, { status: 403 })
  }

  // Username validation — matches the clinic-scoped uniqueness rule used by
  // account creation. Changing the username updates staff_usernames so the
  // new value is the one used for login (login resolves username → staff_usernames).
  if (newUsername !== undefined) {
    if (!newUsername) {
      return NextResponse.json({ error: 'username cannot be empty' }, { status: 400 })
    }
    if (!/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,49}$/.test(newUsername)) {
      return NextResponse.json(
        { error: 'กรุณากรอก Username ที่ถูกต้อง (ตัวอักษร ตัวเลข . _ - เท่านั้น)' },
        { status: 400 }
      )
    }
  }

  // ── 4. Resolve target membership(s) in this clinic ────────────
  const admin = getAdminClient()
  if (!admin) {
    return NextResponse.json({ error: 'server not configured for account management' }, { status: 500 })
  }
  const db = admin as any

  // Username uniqueness — clinic-scoped, same rule as account creation.
  if (newUsername !== undefined) {
    const { data: dup } = await db
      .from('staff_usernames')
      .select('id')
      .eq('clinic_id', clinicId)
      .eq('username', newUsername)
      .neq('user_id', userId)
      .maybeSingle()
    if (dup) {
      return NextResponse.json({ error: 'username already exists in this clinic' }, { status: 409 })
    }
  }

  const { data: targetMemberships, error: targetMemError } = await db
    .from('clinic_memberships')
    .select('id, role, is_active')
    .eq('user_id', userId)
    .eq('clinic_id', clinicId)

  if (targetMemError) {
    return NextResponse.json({ error: 'failed to resolve target membership' }, { status: 500 })
  }
  if (!targetMemberships || targetMemberships.length === 0) {
    return NextResponse.json({ error: 'user is not a member of this clinic' }, { status: 403 })
  }

  const currentRoles = targetMemberships
    .filter((m: any) => m.is_active)
    .map((m: any) => m.role)
  const targetIsOwner = currentRoles.includes('owner')
  const targetIsManager = currentRoles.includes('manager')

  // ── 5. Authorization rules ─────────────────────────────────────
  if (callerRole === 'manager') {
    if (targetIsOwner) {
      return NextResponse.json({ error: 'cannot edit owner account' }, { status: 403 })
    }
    if (targetIsManager) {
      return NextResponse.json({ error: 'cannot edit another manager account' }, { status: 403 })
    }
  } else if (callerRole === 'owner') {
    if (targetIsOwner && userId !== caller.id) {
      return NextResponse.json({ error: 'cannot edit another owner account' }, { status: 403 })
    }
    // Owner editing themself: only name/phone allowed, roles must stay put.
    if (userId === caller.id && targetIsOwner) {
      if (roles !== undefined || isActive !== undefined) {
        return NextResponse.json({ error: 'owner cannot change own roles or status here' }, { status: 403 })
      }
    }
  }

  // Self-deactivation guard — nobody may deactivate their own account.
  if (isActive === false && userId === caller.id) {
    return NextResponse.json({ error: 'cannot deactivate your own account' }, { status: 400 })
  }
  // No caller may deactivate an owner-role member.
  if (isActive === false && targetIsOwner) {
    return NextResponse.json({ error: 'cannot deactivate owner account' }, { status: 403 })
  }

  // ── 6. Apply changes (best-effort transaction with compensation) ──
  const nextRoles = roles !== undefined ? roles : currentRoles

  // Phone duplicate guard — reject moving a phone onto another clinic member.
  if (phone !== undefined) {
    const { data: phoneUser } = await db
      .from('users')
      .select('id')
      .eq('phone', phone)
      .neq('id', userId)
      .maybeSingle()
    if (phoneUser) {
      const { data: sameClinicMember } = await db
        .from('clinic_memberships')
        .select('id')
        .eq('user_id', phoneUser.id)
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

  // 6a. Update public.users (name / phone)
  if (name !== undefined || phone !== undefined) {
    const patch: Record<string, unknown> = {}
    if (name !== undefined) patch.name = name
    if (phone !== undefined) patch.phone = phone
    const { error: userErr } = await db.from('users').update(patch).eq('id', userId)
    if (userErr) {
      return NextResponse.json({ error: 'failed to update user profile' }, { status: 500 })
    }
  }

  // 6a2. Update username (staff_usernames) — owner-only, uniqueness enforced above.
  if (newUsername !== undefined) {
    const { error: unErr } = await db
      .from('staff_usernames')
      .update({ username: newUsername })
      .eq('user_id', userId)
      .eq('clinic_id', clinicId)
    if (unErr) {
      return NextResponse.json({ error: 'failed to update username' }, { status: 500 })
    }
  }

  // 6b. Sync clinic_memberships to the new role set / active state
  try {
    const activeTargetIds = new Set(
      targetMemberships.filter((m: any) => m.is_active).map((m: any) => m.role)
    )

    // Add / re-activate role memberships. A membership row with the
    // deterministic id `mem-{userId}-{role}` may already exist as an
    // INACTIVE row (role removed or user soft-deleted earlier) — re-activate
    // it instead of inserting, which would violate the primary key.
    for (const role of nextRoles) {
      if (activeTargetIds.has(role)) continue
      const existing = targetMemberships.find((m: any) => m.role === role)
      if (existing) {
        const { error: updErr } = await db
          .from('clinic_memberships')
          .update({ is_active: true })
          .eq('id', existing.id)
        if (updErr) throw updErr
      } else {
        const { error: insErr } = await db.from('clinic_memberships').insert({
          id: `mem-${userId}-${role}`,
          user_id: userId,
          clinic_id: clinicId,
          role,
          is_active: true,
        })
        if (insErr) throw insErr
      }
    }

    // Soft-remove roles that are no longer in the set
    for (const m of targetMemberships) {
      if (!nextRoles.includes(m.role) && m.is_active) {
        const { error: updErr } = await db
          .from('clinic_memberships')
          .update({ is_active: false })
          .eq('id', m.id)
        if (updErr) throw updErr
      }
    }

    // Activation / deactivation toggle — only affects the CURRENT role set.
    // Removed roles stay soft-removed (inactive).
    if (isActive !== undefined) {
      for (const m of targetMemberships) {
        if (!nextRoles.includes(m.role)) continue
        if (m.is_active === isActive) continue
        const { error: updErr } = await db
          .from('clinic_memberships')
          .update({ is_active: isActive })
          .eq('id', m.id)
        if (updErr) throw updErr
      }
    }

    // 6c. Sync practitioners (branch assignment + active state)
    const { data: existingPractitioner } = await db
      .from('practitioners')
      .select('id, is_active')
      .eq('user_id', userId)
      .eq('clinic_id', clinicId)
      .maybeSingle()

    const practActive = nextRoles.includes('practitioner') && (isActive === undefined ? true : isActive)
    if (nextRoles.includes('practitioner') && !existingPractitioner) {
      const { error: insErr } = await db.from('practitioners').insert({
        id: `pract-${userId}`,
        user_id: userId,
        clinic_id: clinicId,
        name: name !== undefined ? name : 'ผู้ทำหัตถการ',
        branch_ids: branchIds !== undefined ? branchIds : [],
        is_active: practActive,
      })
      if (insErr) throw insErr
    } else if (existingPractitioner) {
      const practPatch: Record<string, unknown> = {
        is_active: practActive,
      }
      if (name !== undefined) practPatch.name = name
      if (branchIds !== undefined) practPatch.branch_ids = branchIds
      const { error: updErr } = await db
        .from('practitioners')
        .update(practPatch)
        .eq('id', existingPractitioner.id)
      if (updErr) throw updErr
    }
  } catch (err: any) {
    return NextResponse.json({ error: 'failed to update user roles' }, { status: 500 })
  }

  // ── 7. Return the refreshed member ────────────────────────────
  const [membershipsRes, usersRes, usernamesRes, practitionersRes] = await Promise.all([
    db.from('clinic_memberships').select('user_id, role, is_active').eq('user_id', userId).eq('clinic_id', clinicId),
    db.from('users').select('id, email, name, phone, created_at, force_password_change').eq('id', userId),
    db.from('staff_usernames').select('user_id, username').eq('clinic_id', clinicId),
    db.from('practitioners').select('user_id, branch_ids, is_active').eq('user_id', userId).eq('clinic_id', clinicId),
  ])

  const updatedMemberships = membershipsRes.data || []
  const updatedUsers = usersRes.data || []
  const updatedUsernames = usernamesRes.data || []
  const updatedPractitioners = practitionersRes.data || []

  const username = updatedUsernames.find((u: any) => u.user_id === userId)?.username || ''
  const pract = updatedPractitioners[0]
  const activeRoles = updatedMemberships
    .filter((m: any) => m.is_active)
    .map((m: any) => m.role)
  const anyActive = updatedMemberships.some((m: any) => m.is_active)

  const updatedUser = {
    id: userId,
    email: updatedUsers[0]?.email || '',
    username,
    name: updatedUsers[0]?.name || '',
    phone: updatedUsers[0]?.phone || '',
    createdAt: updatedUsers[0]?.created_at || new Date().toISOString(),
    roles: activeRoles,
    branchIds: pract?.branch_ids || [],
    isActive: anyActive,
    forcePasswordChange: updatedUsers[0]?.force_password_change || false,
  }

  return NextResponse.json({ user: updatedUser }, { status: 200 })
}
