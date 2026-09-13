'use client'

import { getSupabase } from './supabase'
import { getTodayICT } from './ict-date'

// ═══ Setting keys ═══
export type ClinicSettingKey =
  | 'general'        // clinic-q-settings: name, phone, address, openTime, closeTime, logo, operatingDays
  | 'rooms'          // clinic-rooms: room definitions
  | 'branch_data'    // clinic-branch-data: branches, procedures
  | 'tv_ads'         // clinicq-tv-ads: TV display advertisements
  | 'line_settings'  // clinic-q-line-settings: LINE OA config

// ═══ localStorage key mapping ═══
const localStorageKeys: Record<ClinicSettingKey, string> = {
  general: 'clinic-q-settings',
  rooms: 'clinic-rooms',
  branch_data: 'clinic-branch-data',
  tv_ads: 'clinicq-tv-ads',
  line_settings: 'clinic-q-line-settings',
}

// ═══ Get Supabase client (browser only) ═══
function getSB() {
  try {
    return getSupabase()
  } catch {
    return null
  }
}

// ═══ Read a setting: Supabase first, then localStorage fallback ═══
export async function getClinicSetting<T = any>(
  clinicId: string,
  key: ClinicSettingKey
): Promise<T | null> {
  // 1. Try Supabase
  const sb = getSB()
  if (sb) {
    try {
      const { data, error } = await sb
        .from('clinic_settings')
        .select('setting_value')
        .eq('clinic_id', clinicId)
        .eq('setting_key', key)
        .single()

      if (!error && data?.setting_value) {
        return data.setting_value as T
      }
    } catch {}
  }

  // 2. Fallback: localStorage
  try {
    const lsKey = localStorageKeys[key]
    const raw = localStorage.getItem(`${lsKey}-${clinicId}`)
    if (raw) return JSON.parse(raw) as T
  } catch {}

  return null
}

// ═══ Write a setting: Supabase + localStorage ═══
export async function setClinicSetting<T = any>(
  clinicId: string,
  key: ClinicSettingKey,
  value: T
): Promise<boolean> {
  let success = false

  // 1. Write to Supabase (atomic upsert — no check-then-insert race)
  const sb = getSB()
  if (sb) {
    try {
      const now = new Date().toISOString()
      const { error } = await sb
        .from('clinic_settings')
        .upsert(
          {
            clinic_id: clinicId,
            setting_key: key,
            setting_value: value,
            created_at: now,
            updated_at: now,
          },
          { onConflict: 'clinic_id,setting_key' }
        )
      if (!error) success = true
    } catch {}
  }

  // 2. Also write to localStorage (for offline/fast access)
  try {
    const lsKey = localStorageKeys[key]
    localStorage.setItem(`${lsKey}-${clinicId}`, JSON.stringify(value))
  } catch {}

  return success
}

// ═══ ICT (Asia/Bangkok) business date ═══
// Room/queue dates are business dates in the clinic timezone. The canonical
// implementation lives in ./ict-date (deliberately not 'use client') so server
// route handlers can import it too; it is re-exported here so existing client
// import paths keep working.
export { getTodayICT }

// ═══ Daily rooms storage keys ═══
// Clinic-specific key first, then the legacy shared key (some surfaces resolve
// the clinic id lazily and fall back to it).
export function dailyRoomsStorageKeys(clinicId?: string | null) {
  return {
    dataKeys: clinicId ? [`clinic-daily-rooms-${clinicId}`, 'clinic-daily-rooms'] : ['clinic-daily-rooms'],
    dateKeys: clinicId ? [`clinic-daily-rooms-date-${clinicId}`, 'clinic-daily-rooms-date'] : ['clinic-daily-rooms-date'],
  }
}

function primaryDailyRoomsKeys(clinicId?: string | null) {
  return clinicId
    ? { dataKey: `clinic-daily-rooms-${clinicId}`, dateKey: `clinic-daily-rooms-date-${clinicId}` }
    : { dataKey: 'clinic-daily-rooms', dateKey: 'clinic-daily-rooms-date' }
}

// ═══ Local cache read (synchronous, cache only — never Supabase) ═══
export function readDailyRoomsCache(clinicId?: string | null, date?: string): any[] | null {
  if (typeof window === 'undefined') return null
  const targetDate = date || getTodayICT()
  const { dataKeys, dateKeys } = dailyRoomsStorageKeys(clinicId)
  for (let i = 0; i < dataKeys.length; i++) {
    try {
      const saved = localStorage.getItem(dataKeys[i])
      const savedDate = localStorage.getItem(dateKeys[i])
      if (saved && savedDate === targetDate) {
        const parsed = JSON.parse(saved)
        if (Array.isArray(parsed)) return parsed
      }
    } catch {}
  }
  return null
}

// ═══ Local cache write (cache only — never Supabase) ═══
// Used to mirror successful saves and to hydrate the cache from Supabase so
// legacy localStorage readers see the same set as the database.
export function writeDailyRoomsCache(clinicId: string | null | undefined, rooms: any[], date?: string): void {
  if (typeof window === 'undefined') return
  const targetDate = date || getTodayICT()
  const { dataKey, dateKey } = primaryDailyRoomsKeys(clinicId)
  try {
    localStorage.setItem(dateKey, targetDate)
    localStorage.setItem(dataKey, JSON.stringify(rooms))
  } catch {}
}

// ═══ Read daily rooms: Supabase first, then auto-create from config, then localStorage fallback ═══
export async function getDailyRooms(
  clinicId: string,
  date?: string
): Promise<any[] | null> {
  const targetDate = date || getTodayICT()

  // 1. Try Supabase
  const sb = getSB()
  if (sb) {
    try {
      const { data, error } = await sb
        .from('daily_rooms')
        .select('room_data')
        .eq('clinic_id', clinicId)
        .eq('room_date', targetDate)
        .limit(1)

      const row = Array.isArray(data) ? data[0] : data
      if (!error && row?.room_data) {
        const rooms = Array.isArray(row.room_data) ? row.room_data : []
        // Hydrate the local cache so localStorage readers agree with Supabase
        // (the source of truth) instead of drifting from it.
        writeDailyRoomsCache(clinicId, rooms, targetDate)
        return rooms
      }
    } catch {}
  }

  // 2. Fallback: local cache only (Supabase remains the source of truth)
  const cached = readDailyRoomsCache(clinicId, targetDate)
  if (cached && cached.length > 0) return cached

  // 3. No daily rooms for today — auto-create from room config template.
  //    This ensures the dashboard has rooms to show on the first visit of a new day.
  try {
    const roomConfig = await getClinicSetting<any[]>(clinicId, 'rooms')
    if (Array.isArray(roomConfig) && roomConfig.length > 0) {
      const created = await setDailyRooms(clinicId, roomConfig, targetDate)
      if (created) {
        writeDailyRoomsCache(clinicId, roomConfig, targetDate)
        return roomConfig
      }
    }
  } catch {}

  return null
}

// ═══ Write daily rooms: Supabase + localStorage ═══
export async function setDailyRooms(
  clinicId: string,
  rooms: any[],
  date?: string
): Promise<boolean> {
  const targetDate = date || getTodayICT()
  let success = false

  // 1. Write to Supabase (upsert)
  const sb = getSB()
  if (sb) {
    try {
      const { error } = await sb
        .from('daily_rooms')
        .upsert(
          {
            clinic_id: clinicId,
            room_date: targetDate,
            room_data: rooms,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'clinic_id,room_date' }
        )

      if (!error) success = true
    } catch {}
  }

  // 2. Mirror into the local cache so readers agree with Supabase
  writeDailyRoomsCache(clinicId, rooms, targetDate)

  return success
}

// ═══ Invite a practitioner (server-side account creation) ═══
// Single shared creation path for practitioners. The server route:
//   POST /api/clinics/[clinicId]/practitioners
// verifies the caller's owner/manager membership, creates the auth user
// via invite, and inserts users + clinic_memberships + practitioners
// atomically. Never create practitioner accounts directly from the client.
export async function invitePractitioner(
  clinicId: string,
  data: { name: string; email: string; phone?: string; branchIds?: string[] }
): Promise<{ ok: boolean; practitioner?: any; error?: string; status?: number }> {
  try {
    const res = await fetch(`/api/clinics/${encodeURIComponent(clinicId)}/practitioners`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: data.name,
        email: data.email,
        phone: data.phone || '',
        branchIds: data.branchIds || [],
      }),
    })
    const body = await res.json().catch(() => ({}))
    if (!res.ok) {
      return { ok: false, error: body?.error || 'ไม่สามารถสร้างบัญชีผู้ทำหัตถการได้', status: res.status }
    }
    return { ok: true, practitioner: body?.practitioner }
  } catch (e: any) {
    return { ok: false, error: e?.message || 'network error' }
  }
}

// ═══ Subscribe to real-time clinic settings changes ═══
export function subscribeClinicSettings(
  clinicId: string,
  callback: () => void
): () => void {
  const sb = getSB()
  if (!sb) return () => {}

  const channel = sb
    .channel(`clinic-settings-${clinicId}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'clinic_settings', filter: `clinic_id=eq.${clinicId}` },
      () => callback()
    )
    .subscribe()

  return () => { sb.removeChannel(channel) }
}
