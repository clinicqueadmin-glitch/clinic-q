/**
 * LINE notification client helpers.
 *
 * LINE *sending* is done server-side (`/api/line/notify`) so the clinic's
 * channel access token never has to live in a browser and the Platform Owner's
 * enabled/disabled setting is actually enforced. This module only:
 *
 *   • binds a patient's phone to their LINE userId (persisted in the DB by
 *     `/api/line/bind`, mirrored into localStorage as a local cache), and
 *   • asks the server to send a queue message.
 */

import { getSupabase } from './supabase'
import type { LineNotifyEvent } from './line-settings'

// LINE User Profile (kept in the browser as a cache only — Supabase is the
// source of truth via the line_users table)
export interface LineUserProfile {
  userId: string
  displayName: string
  pictureUrl?: string
  statusMessage?: string
  phoneNumber?: string // เบอร์โทรที่เชื่อมกับ LINE
  clinicId: string
  createdAt: Date
}

/** Digits only — the shape phone numbers are stored and compared in. */
export function normalizePhone(phone: string): string {
  return phone.replace(/\D/g, '')
}

/**
 * Bind a patient's phone to their LINE userId.
 *
 * The write goes to the DB through the server route (the patient has no
 * session, so the browser must not write the table itself); localStorage is
 * only a cache for the device that performed the bind.
 */
export async function bindLineUser(input: {
  clinicId: string
  lineUserId: string
  phoneNumber: string
  displayName?: string
}): Promise<{ ok: boolean; error?: string }> {
  const profile: LineUserProfile = {
    userId: input.lineUserId,
    displayName: input.displayName || `LINE User ${input.lineUserId.slice(-6)}`,
    phoneNumber: normalizePhone(input.phoneNumber),
    clinicId: input.clinicId,
    createdAt: new Date(),
  }
  // Local cache first — the UI stays responsive even if the network is slow.
  saveLineUserProfile(profile, input.clinicId)

  try {
    const res = await fetch('/api/line/bind', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        clinicId: input.clinicId,
        lineUserId: input.lineUserId,
        phone: normalizePhone(input.phoneNumber),
        displayName: profile.displayName,
      }),
    })
    const body = await res.json().catch(() => ({}))
    if (!res.ok || body?.ok === false) {
      return { ok: false, error: body?.error || 'บันทึกการเชื่อมต่อไม่สำเร็จ' }
    }
    return { ok: true }
  } catch (e: any) {
    return { ok: false, error: e?.message || 'network error' }
  }
}

export interface QueueLineEventInput {
  event: LineNotifyEvent
  clinicId?: string | null
  /** The queue row this event belongs to — the server re-reads the data it needs. */
  queueId?: string | null
  phone?: string | null
  queueNumber: string
  patientName: string
  roomNumber?: number
  practitionerName?: string
}

/**
 * Ask the server to send a queue message to the patient on LINE.
 *
 * The server owns the decision (enabled? which events? how many queues ahead?)
 * and resolves the recipient, so the browser only reports the event. Returns
 * `skipped` reasons instead of throwing: a missing LINE binding or a disabled
 * clinic is a normal outcome, not an error.
 */
export async function notifyQueueViaLine(
  input: QueueLineEventInput
): Promise<{ ok: boolean; skipped?: string; error?: string }> {
  try {
    const sb = getSupabase()
    const token = sb ? (await sb.auth.getSession()).data.session?.access_token : null
    if (!token) return { ok: false, error: 'no-session' }

    const res = await fetch('/api/line/notify', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(input),
    })
    const body = await res.json().catch(() => ({}))
    if (!res.ok) return { ok: false, error: body?.error || `http-${res.status}` }
    return { ok: true, skipped: body?.skipped }
  } catch (e: any) {
    return { ok: false, error: e?.message || 'network error' }
  }
}

// ═══ Local cache (per clinic, with the legacy shared key as a fallback) ═══

function lineUsersKeys(clinicId?: string): string[] {
  return clinicId ? [`clinic-q-line-users-${clinicId}`, 'clinic-q-line-users'] : ['clinic-q-line-users']
}

/**
 * ดึง LINE User ID จากหมายเลขโทรศัพท์ (clinic-specific cache)
 */
export function getLineUserId(phone: string, clinicId?: string): string | null {
  if (typeof window === 'undefined') return null
  const normalizedPhone = normalizePhone(phone)
  for (const key of lineUsersKeys(clinicId)) {
    const lineUsers = localStorage.getItem(key)
    if (!lineUsers) continue
    try {
      const users: LineUserProfile[] = JSON.parse(lineUsers)
      const user = users.find(u => u.phoneNumber && normalizePhone(u.phoneNumber) === normalizedPhone)
      if (user?.userId) return user.userId
    } catch {}
  }
  return null
}

/**
 * บันทึก LINE User Profile ลง cache ของเบราว์เซอร์
 */
export function saveLineUserProfile(profile: LineUserProfile, clinicId?: string): void {
  if (typeof window === 'undefined') return

  const storageKey = clinicId ? `clinic-q-line-users-${clinicId}` : 'clinic-q-line-users'
  let users: LineUserProfile[] = []
  try {
    users = JSON.parse(localStorage.getItem(storageKey) || '[]')
    if (!Array.isArray(users)) users = []
  } catch {
    users = []
  }

  const existingIndex = users.findIndex(u => u.userId === profile.userId)
  if (existingIndex >= 0) users[existingIndex] = profile
  else users.push(profile)

  try {
    localStorage.setItem(storageKey, JSON.stringify(users))
  } catch {}
}

/**
 * ดึงรายชื่อ LINE Users ทั้งหมด (จาก cache ของเบราว์เซอร์)
 */
export function getAllLineUsers(clinicId?: string): LineUserProfile[] {
  if (typeof window === 'undefined') return []
  for (const key of lineUsersKeys(clinicId)) {
    const raw = localStorage.getItem(key)
    if (!raw) continue
    try {
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed)) return parsed
    } catch {}
  }
  return []
}

/**
 * ลบ LINE User ออกจาก cache
 */
export function removeLineUser(userId: string, clinicId?: string): void {
  if (typeof window === 'undefined') return
  for (const key of lineUsersKeys(clinicId)) {
    const raw = localStorage.getItem(key)
    if (!raw) continue
    try {
      const users: LineUserProfile[] = JSON.parse(raw)
      const filtered = users.filter(u => u.userId !== userId)
      localStorage.setItem(key, JSON.stringify(filtered))
    } catch {}
  }
}
