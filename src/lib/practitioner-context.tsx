'use client'

import { useState, useCallback, useMemo, useEffect, type ReactNode } from 'react'
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

function loadPractitioners(clinicType: ClinicType, clinicId?: string | null): Practitioner[] {
  if (typeof window === 'undefined') return []
  
  // Try clinic-specific storage first — strictly filter by clinicId
  const storageKey = clinicId ? `clinic-practitioners-${clinicId}` : 'clinic-practitioners'
  const saved = localStorage.getItem(storageKey)
  if (saved && clinicId) {
    try {
      const parsed = JSON.parse(saved)
      if (Array.isArray(parsed)) {
        // Only include practitioners that explicitly belong to THIS clinic
        // Legacy practitioners without clinicId are excluded to prevent cross-clinic leakage
        const filtered = parsed.filter((p: any) => p.clinicId === clinicId)
        const cleaned = filtered.map((p: any) => ({
          ...p,
          userId: p.userId || undefined,
          clinicId: clinicId, // Always force correct clinicId
        }))
        // Auto-clean: save cleaned data back to remove cross-clinic leakage permanently
        if (filtered.length !== parsed.length) {
          localStorage.setItem(storageKey, JSON.stringify(cleaned))
        }
        return cleaned
      }
    } catch {}
  }
  
  // Fallback: try shared key and STRICTLY filter by clinicId
  const sharedSaved = localStorage.getItem('clinic-practitioners')
  if (sharedSaved && clinicId) {
    try {
      const parsed = JSON.parse(sharedSaved)
      if (Array.isArray(parsed)) {
        // Only include practitioners that explicitly belong to THIS clinic
        const filtered = parsed.filter((p: any) => p.clinicId && p.clinicId === clinicId)
        return filtered.map((p: any) => ({
          ...p,
          userId: p.userId || undefined,
          clinicId: clinicId, // Always force the correct clinicId
        }))
      }
    } catch {}
  }
  
  // Start empty - practitioners are created via User Management
  return []
}

// Filter practitioners by current clinic ID
function filterByClinic(practitioners: Practitioner[], clinicId: string | null): Practitioner[] {
  if (!clinicId) return [] // Never show practitioners without a clinic selected
  // Strict: only show practitioners that explicitly belong to THIS clinic
  // Practitioners without clinicId are excluded to prevent cross-clinic leakage
  return practitioners.filter(p => p.clinicId && p.clinicId === clinicId)
}

const PractitionerContext = createContext<PractitionerContextType | null>(null)

export function PractitionerProvider({ children, clinicType, clinicId }: { children: ReactNode; clinicType: ClinicType; clinicId?: string | null }) {
  const [practitioners, setPractitioners] = useState<Practitioner[]>(() => loadPractitioners(clinicType, clinicId))

  // Load from Supabase on mount / clinic change, then merge with localStorage
  useEffect(() => {
    // First load from localStorage
    setPractitioners(loadPractitioners(clinicType, clinicId))

    // Then fetch from Supabase and merge
    if (!clinicId) return
    const fetchFromSupabase = async () => {
      try {
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
        const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
        if (!supabaseUrl || !supabaseKey) return

        // 1. Fetch from practitioners table
        const res = await fetch(`${supabaseUrl}/rest/v1/practitioners?clinic_id=eq.${clinicId}&is_active=eq.true&select=id,name,clinic_id`, {
          headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` },
        })
        if (!res.ok) return
        const rows = await res.json()
        if (!Array.isArray(rows) || rows.length === 0) return

        // 2. Merge with existing localStorage data
        setPractitioners(prev => {
          const existingIds = new Set(prev.filter(p => p.clinicId === clinicId).map(p => p.id))
          const newPractitioners: Practitioner[] = rows
            .filter((r: any) => !existingIds.has(r.id))
            .map((r: any) => ({
              id: r.id,
              name: r.name,
              clinicId: clinicId,
              branchId: '',
              phone: r.phone || '',
              active: true,
            }))
          if (newPractitioners.length === 0) return prev
          const merged = [...prev, ...newPractitioners]
          // Save merged data to localStorage
          const storageKey = `clinic-practitioners-${clinicId}`
          localStorage.setItem(storageKey, JSON.stringify(merged.filter(p => p.clinicId === clinicId)))
          return merged
        })
      } catch {}
    }
    fetchFromSupabase()
  }, [clinicId, clinicType])

  // Filter practitioners by current clinic
  const filteredPractitioners = useMemo(() => {
    return filterByClinic(practitioners, clinicId || null)
  }, [practitioners, clinicId])

  const saveToStorage = useCallback((data: Practitioner[]) => {
    const storageKey = clinicId ? `clinic-practitioners-${clinicId}` : 'clinic-practitioners'
    localStorage.setItem(storageKey, JSON.stringify(data))
    // Also save to Supabase in background
    if (clinicId) {
      const clinicPractitioners = data.filter(p => p.clinicId === clinicId)
      import('./clinic-data').then(({ setClinicSetting }) => {
        setClinicSetting(clinicId, 'branch_data', { practitioners: clinicPractitioners })
      }).catch(() => {})
    }
  }, [clinicId])

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
