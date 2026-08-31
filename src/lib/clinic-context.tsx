'use client'

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react'
import { type ClinicType, clinicConfig } from './queue-data'

export interface ClinicSettings {
  clinicName?: string // custom clinic name
  logo?: string // base64 data URL
  operatingDays: string[] // ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']
  openTime?: string // เวลาเปิดทำการ (HH:mm)
  closeTime?: string // เวลาปิดทำการ (HH:mm)
}

interface ClinicContextType {
  currentClinic: ClinicType | null
  setClinic: (clinic: ClinicType) => void
  clearClinic: () => void
  config: typeof clinicConfig[ClinicType] | null
  isConfigured: boolean
  settings: ClinicSettings
  updateSettings: (settings: Partial<ClinicSettings>) => void
}

const ClinicContext = createContext<ClinicContextType>({
  currentClinic: null,
  setClinic: () => {},
  clearClinic: () => {},
  config: null,
  isConfigured: false,
  settings: { operatingDays: ['mon', 'tue', 'wed', 'thu', 'fri'] },
  updateSettings: () => {},
})

const defaultSettings: ClinicSettings = {
  operatingDays: ['mon', 'tue', 'wed', 'thu', 'fri'],
}

export function ClinicProvider({ children }: { children: ReactNode }) {
  const [currentClinic, setCurrentClinic] = useState<ClinicType | null>(null)
  const [isLoaded, setIsLoaded] = useState(false)
  const [settings, setSettings] = useState<ClinicSettings>(defaultSettings)

  // Load from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem('clinic-q-type') as ClinicType | null
    if (saved && clinicConfig[saved]) {
      setCurrentClinic(saved)
    }
    // Load settings
    const savedSettings = localStorage.getItem('clinic-q-settings')
    if (savedSettings) {
      try {
        const parsed = JSON.parse(savedSettings)
        setSettings({ ...defaultSettings, ...parsed })
      } catch {}
    }
    setIsLoaded(true)
  }, [])

  const setClinic = useCallback((clinic: ClinicType) => {
    setCurrentClinic(clinic)
    localStorage.setItem('clinic-q-type', clinic)
  }, [])

  const clearClinic = useCallback(() => {
    setCurrentClinic(null)
    localStorage.removeItem('clinic-q-type')
  }, [])

  const updateSettings = useCallback((newSettings: Partial<ClinicSettings>) => {
    setSettings(prev => {
      const updated = { ...prev, ...newSettings }
      localStorage.setItem('clinic-q-settings', JSON.stringify(updated))
      return updated
    })
  }, [])

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
    <ClinicContext.Provider value={{ currentClinic, setClinic, clearClinic, config, isConfigured: currentClinic !== null, settings, updateSettings }}>
      {children}
    </ClinicContext.Provider>
  )
}

export function useClinic() {
  return useContext(ClinicContext)
}
