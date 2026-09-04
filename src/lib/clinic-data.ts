'use client'

import { getSupabase } from './supabase'

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

  // 1. Write to Supabase (upsert)
  const sb = getSB()
  if (sb) {
    try {
      const { error } = await sb
        .from('clinic_settings')
        .upsert(
          {
            clinic_id: clinicId,
            setting_key: key,
            setting_value: value,
            updated_at: new Date().toISOString(),
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

// ═══ Read daily rooms: Supabase first, then localStorage fallback ═══
export async function getDailyRooms(
  clinicId: string,
  date?: string
): Promise<any[] | null> {
  const targetDate = date || new Date().toISOString().split('T')[0]

  // 1. Try Supabase
  const sb = getSB()
  if (sb) {
    try {
      const { data, error } = await sb
        .from('daily_rooms')
        .select('room_data')
        .eq('clinic_id', clinicId)
        .eq('room_date', targetDate)
        .single()

      if (!error && data?.room_data) {
        return Array.isArray(data.room_data) ? data.room_data : []
      }
    } catch {}
  }

  // 2. Fallback: localStorage
  try {
    const dateKey = `clinic-daily-rooms-date-${clinicId}`
    const dataKey = `clinic-daily-rooms-${clinicId}`
    const savedDate = localStorage.getItem(dateKey)
    const saved = localStorage.getItem(dataKey)
    if (savedDate === targetDate && saved) {
      const parsed = JSON.parse(saved)
      return Array.isArray(parsed) ? parsed : []
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
  const targetDate = date || new Date().toISOString().split('T')[0]
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

  // 2. Also write to localStorage
  try {
    localStorage.setItem(`clinic-daily-rooms-date-${clinicId}`, targetDate)
    localStorage.setItem(`clinic-daily-rooms-${clinicId}`, JSON.stringify(rooms))
  } catch {}

  return success
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
