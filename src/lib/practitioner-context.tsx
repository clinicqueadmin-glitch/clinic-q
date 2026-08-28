'use client'

import { useState, useCallback, useMemo, type ReactNode } from 'react'
import { createContext, useContext } from 'react'
import { type ClinicType } from './queue-data'
import { getDefaultBranchData } from './branch-data'
import type { Practitioner } from './branch-data'

export type { Practitioner }

interface PractitionerContextType {
  practitioners: Practitioner[]
  updatePractitioner: (id: string, updates: Partial<Practitioner>) => void
  addPractitioner: (practitioner: Practitioner) => void
  deletePractitioner: (id: string) => void
  togglePractitioner: (id: string) => void
  getPractitionerByUserId: (userId: string) => Practitioner | undefined
  getPractitionersByClinicId: (clinicId: string) => Practitioner[]
}

const STORAGE_KEY = 'clinic-practitioners'

function loadPractitioners(clinicType: ClinicType): Practitioner[] {
  if (typeof window === 'undefined') return getDefaultBranchData(clinicType).practitioners
  
  const saved = localStorage.getItem(STORAGE_KEY)
  if (saved) {
    try {
      const parsed = JSON.parse(saved)
      if (Array.isArray(parsed) && parsed.length > 0) {
        // Ensure backward compatibility - add userId and clinicId if missing
        return parsed.map((p: any) => ({
          ...p,
          userId: p.userId || undefined,
          clinicId: p.clinicId || undefined,
        }))
      }
    } catch {}
  }
  
  // Initialize from default data
  const defaultData = getDefaultBranchData(clinicType)
  const practitionersWithMeta = defaultData.practitioners.map(p => ({
    ...p,
    userId: undefined, // Legacy practitioners don't have user accounts
    clinicId: undefined, // Will be set based on context
  }))
  localStorage.setItem(STORAGE_KEY, JSON.stringify(practitionersWithMeta))
  return practitionersWithMeta
}

// Filter practitioners by current clinic ID
function filterByClinic(practitioners: Practitioner[], clinicId: string | null): Practitioner[] {
  if (!clinicId) return practitioners
  // Show practitioners that belong to this clinic OR have no clinicId (legacy)
  return practitioners.filter(p => !p.clinicId || p.clinicId === clinicId)
}

const PractitionerContext = createContext<PractitionerContextType | null>(null)

export function PractitionerProvider({ children, clinicType, clinicId }: { children: ReactNode; clinicType: ClinicType; clinicId?: string | null }) {
  const [practitioners, setPractitioners] = useState<Practitioner[]>(() => loadPractitioners(clinicType))
  
  // Filter practitioners by current clinic
  const filteredPractitioners = useMemo(() => {
    return filterByClinic(practitioners, clinicId || null)
  }, [practitioners, clinicId])

  const saveToStorage = useCallback((data: Practitioner[]) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
  }, [])

  const updatePractitioner = useCallback((id: string, updates: Partial<Practitioner>) => {
    setPractitioners(prev => {
      const updated = prev.map(p => p.id === id ? { ...p, ...updates } : p)
      saveToStorage(updated)
      return updated
    })
  }, [saveToStorage])

  const addPractitioner = useCallback((practitioner: Practitioner) => {
    setPractitioners(prev => {
      const updated = [...prev, practitioner]
      saveToStorage(updated)
      return updated
    })
  }, [saveToStorage])

  const deletePractitioner = useCallback((id: string) => {
    setPractitioners(prev => {
      const updated = prev.filter(p => p.id !== id)
      saveToStorage(updated)
      return updated
    })
  }, [saveToStorage])

  const togglePractitioner = useCallback((id: string) => {
    setPractitioners(prev => {
      const updated = prev.map(p => p.id === id ? { ...p, active: !p.active } : p)
      saveToStorage(updated)
      return updated
    })
  }, [saveToStorage])

  // Get practitioner by user ID (for linking users to practitioners)
  const getPractitionerByUserId = useCallback((userId: string): Practitioner | undefined => {
    return practitioners.find(p => p.userId === userId)
  }, [practitioners])

  // Get practitioners for a specific clinic
  const getPractitionersByClinicId = useCallback((clinicId: string): Practitioner[] => {
    return practitioners.filter(p => p.clinicId === clinicId && p.active)
  }, [practitioners])

  return (
    <PractitionerContext.Provider value={{ 
      practitioners: filteredPractitioners,
      updatePractitioner, 
      addPractitioner, 
      deletePractitioner,
      togglePractitioner,
      getPractitionerByUserId,
      getPractitionersByClinicId
    }}>
      {children}
    </PractitionerContext.Provider>
  )
}

export function usePractitioners() {
  const context = useContext(PractitionerContext)
  if (!context) {
    throw new Error('usePractitioners must be used within a PractitionerProvider')
  }
  return context
}
