'use client'

import { createContext, useContext, useState, useEffect, useRef, useCallback, type ReactNode } from 'react'
import { type ClinicType, clinicConfig } from './queue-data'
import { getClinicSetting, getClinicName, setClinicSetting } from './clinic-data'

export interface DaySchedule {
  enabled: boolean
  openTime: string  // HH:mm
  closeTime: string // HH:mm
}

export type WeeklySchedule = Record<string, DaySchedule> // keys: mon, tue, wed, thu, fri, sat, sun

export interface ClinicSettings {
  clinicName?: string // custom clinic name
  logo?: string // base64 data URL
  operatingDays: string[] // legacy: ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']
  openTime?: string // legacy: single เวลาเปิดทำการ (HH:mm)
  closeTime?: string // legacy: single เวลาปิดทำการ (HH:mm)
  weeklySchedule?: WeeklySchedule // per-day schedule: { mon: { enabled, openTime, closeTime }, ... }
}

/** Get the DaySchedule for a specific day code (mon, tue, etc.) */
export function getDaySchedule(settings: ClinicSettings, dayCode: string): DaySchedule {
  if (settings.weeklySchedule && settings.weeklySchedule[dayCode]) {
    return settings.weeklySchedule[dayCode]
  }
  // Fallback: derive from legacy openTime/closeTime/operatingDays
  return {
    enabled: settings.operatingDays?.includes(dayCode) ?? false,
    openTime: settings.openTime || '08:00',
    closeTime: settings.closeTime || '20:00',
  }
}

/** Check if clinic is open right now based on weekly schedule */
export function isClinicOpenNow(settings: ClinicSettings, now?: Date): boolean {
  const d = now || new Date()
  const dayNames = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat']
  const dayCode = dayNames[d.getDay()]
  const schedule = getDaySchedule(settings, dayCode)
  if (!schedule.enabled) return false
  const currentMinutes = d.getHours() * 60 + d.getMinutes()
  const [openH, openM] = schedule.openTime.split(':').map(Number)
  const [closeH, closeM] = schedule.closeTime.split(':').map(Number)
  return currentMinutes >= openH * 60 + openM && currentMinutes < closeH * 60 + closeM
}

interface ClinicContextType {
  currentClinic: ClinicType | null
  setClinic: (clinic: ClinicType) => void
  clearClinic: () => void
  config: typeof clinicConfig[ClinicType] | null
  isConfigured: boolean
  settings: ClinicSettings
  /**
   * The clinic's own display name, from its clinic_settings / clinics row.
   * Deliberately NOT derived from the clinic type: clinicConfig holds the seed
   * clinics' names, so a type lookup would label the wrong clinic.
   * Null means "not resolved" — callers must show a neutral placeholder.
   */
  clinicName: string | null
  /** Persist settings to Supabase (source of truth). Resolves true only when the DB write succeeded. */
  updateSettings: (settings: Partial<ClinicSettings>) => Promise<boolean>
}

const ClinicContext = createContext<ClinicContextType>({
  currentClinic: null,
  setClinic: () => {},
  clearClinic: () => {},
  config: null,
  isConfigured: false,
  settings: { operatingDays: ['mon', 'tue', 'wed', 'thu', 'fri'] },
  clinicName: null,
  updateSettings: async () => true,
})

const defaultSettings: ClinicSettings = {
  operatingDays: ['mon', 'tue', 'wed', 'thu', 'fri'],
}

export function ClinicProvider({ children, clinicId }: { children: ReactNode; clinicId?: string | null }) {
  const [currentClinic, setCurrentClinic] = useState<ClinicType | null>(null)
  const [isLoaded, setIsLoaded] = useState(false)
  const [settings, setSettings] = useState<ClinicSettings>(defaultSettings)
  const [clinicRowName, setClinicRowName] = useState<string | null>(null)
  const settingsRef = useRef<ClinicSettings>(defaultSettings)
  useEffect(() => { settingsRef.current = settings }, [settings])
  
  // Settings are always clinic-scoped. Without a clinic identity there is no key
  // that belongs to this session, so nothing is read — the legacy shared key is
  // never used as a cross-clinic fallback.
  const settingsKey = clinicId ? `clinic-q-settings-${clinicId}` : ''

  // Load from localStorage on mount, then sync from Supabase
  useEffect(() => {
    const saved = localStorage.getItem('clinic-q-type') as ClinicType | null
    if (saved && clinicConfig[saved]) {
      setCurrentClinic(saved)
    }
    // Reset first: on a clinic switch the previous clinic's name/hours must not
    // linger while the newly-selected clinic's settings load.
    setSettings(defaultSettings)
    // Load settings from the clinic-specific key only (fast, immediate)
    const savedSettings = settingsKey ? localStorage.getItem(settingsKey) : null
    if (savedSettings) {
      try {
        const parsed = JSON.parse(savedSettings)
        setSettings({ ...defaultSettings, ...parsed })
      } catch {}
    }
    setIsLoaded(true)

    // Then sync from Supabase in background — Supabase is source of truth
    if (clinicId) {
      getClinicSetting(clinicId, 'general').then((dbSettings) => {
        if (dbSettings && typeof dbSettings === 'object') {
          setSettings(prev => {
            const merged = { ...defaultSettings, ...dbSettings } as ClinicSettings
            // Update localStorage cache with DB values
            try {
              localStorage.setItem(settingsKey, JSON.stringify(merged))
            } catch {}
            return merged
          })
        }
      }).catch(() => {})
    }
  }, [settingsKey, clinicId])

  // Display name comes from the clinic itself: clinic_settings.general.clinicName
  // (DB-backed, editable by the clinic) first, then the clinics row. Never from the
  // clinic type, and never from another clinic's cached settings.
  useEffect(() => {
    let cancelled = false
    setClinicRowName(null)
    if (!clinicId) return
    getClinicName(clinicId)
      .then((name) => { if (!cancelled) setClinicRowName(name) })
      .catch(() => {})
    return () => { cancelled = true }
  }, [clinicId])

  const clinicName = settings.clinicName?.trim() || clinicRowName || null

  const setClinic = useCallback((clinic: ClinicType) => {
    setCurrentClinic(clinic)
    localStorage.setItem('clinic-q-type', clinic)
  }, [])

  const clearClinic = useCallback(() => {
    setCurrentClinic(null)
    localStorage.removeItem('clinic-q-type')
  }, [])

  const updateSettings = useCallback(async (newSettings: Partial<ClinicSettings>): Promise<boolean> => {
    const updated = { ...settingsRef.current, ...newSettings }
    settingsRef.current = updated
    setSettings(updated)

    // Cache to localStorage under the clinic-scoped key (best-effort; quota errors
    // must not block the DB write). Without a clinic identity there is no key this
    // session owns, so nothing is cached — never the shared legacy key.
    if (settingsKey) {
      try {
        localStorage.setItem(settingsKey, JSON.stringify(updated))
      } catch {
        // Quota exceeded — localStorage cache is optional, Supabase is the source of truth
      }
    }

    // Persist to Supabase — success is reported back so the UI can show a real result
    if (!clinicId) return true
    try {
      return await setClinicSetting(clinicId, 'general', updated)
    } catch {
      return false
    }
  }, [settingsKey, clinicId])

  const config = currentClinic ? clinicConfig[currentClinic] : null

  // Don't render children until we've checked localStorage
  if (!isLoaded) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-primary-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-500">กำลังโหลด...</p>
        </div>
      </div>
    )
  }

  return (
    <ClinicContext.Provider value={{ currentClinic, setClinic, clearClinic, config, isConfigured: currentClinic !== null, settings, clinicName, updateSettings }}>
      {children}
    </ClinicContext.Provider>
  )
}

export function useClinic() {
  return useContext(ClinicContext)
}
