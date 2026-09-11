'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  getDailyRooms,
  getTodayICT,
  readDailyRoomsCache,
  writeDailyRoomsCache,
} from './clinic-data'

/**
 * Daily Rooms for the current business day (ICT) — Supabase-first.
 *
 * Source of truth is the `daily_rooms` row for (clinic_id, room_date). The
 * localStorage entry is only a cache: it is painted immediately so the UI does
 * not flicker, then reconciled with — and hydrated from — Supabase.
 *
 * Reading never writes to Supabase, so simply opening a page can never create
 * or duplicate rooms. When there is no Supabase row for the day, the cached
 * value (if any) is kept, which preserves the previous per-device behaviour for
 * clinics that have not migrated yet.
 */
export function useDailyRooms<T = any>(clinicId: string | null | undefined) {
  const [rooms, setRoomsState] = useState<T[]>(
    () => (readDailyRoomsCache(clinicId) as T[] | null) || []
  )
  const [reloadToken, setReloadToken] = useState(0)
  // Guards against a late response from a previous clinic overwriting state.
  const requestId = useRef(0)

  const reload = useCallback(() => setReloadToken((t) => t + 1), [])

  useEffect(() => {
    const activeClinicId = clinicId || null

    // Paint the cache first (instant, no flicker) …
    setRoomsState((readDailyRoomsCache(activeClinicId) as T[] | null) || [])
    if (!activeClinicId) return

    // … then reconcile with Supabase, the source of truth.
    const id = ++requestId.current
    let cancelled = false

    getDailyRooms(activeClinicId, getTodayICT()).then((fresh) => {
      if (cancelled || id !== requestId.current) return
      if (Array.isArray(fresh)) setRoomsState(fresh as T[])
    })

    return () => {
      cancelled = true
    }
  }, [clinicId, reloadToken])

  // Same-browser updates (another tab or component edited today's rooms). The
  // cache is our in-browser sync channel; the DB stays authoritative.
  useEffect(() => {
    if (typeof window === 'undefined') return
    const onStorage = (e: StorageEvent) => {
      if (!e.key || !e.key.startsWith('clinic-daily-rooms')) return
      const cached = readDailyRoomsCache(clinicId)
      if (cached) setRoomsState(cached as T[])
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [clinicId])

  // Replace the set locally and keep the cache in step.
  const setRooms = useCallback(
    (next: T[]) => {
      writeDailyRoomsCache(clinicId, next as any[])
      setRoomsState(next)
    },
    [clinicId]
  )

  return { rooms, reload, setRooms }
}
