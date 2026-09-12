'use client'

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { useSearchParams } from 'next/navigation'
import { clsx } from 'clsx'
import { Volume2, VolumeX, Maximize, Minimize, RefreshCw } from 'lucide-react'
import { useQueue, type QueueItem } from '@/lib/queue-context'
import { useClinic } from '@/lib/clinic-context'
import { getDefaultBranchData, getOvertimeStatus, type Room } from '@/lib/branch-data'
import { useDailyRooms } from '@/lib/use-daily-rooms'
import TVCalledAlert from './TVCalledAlert'
import TVAdDisplay, { type TVAd } from './TVAdDisplay'

const roomColors = ['#93C5FD', '#A7F3D0', '#FCD34D', '#FDA4AF', '#D8B4FE']

function formatDuration(servingAt: number): string {
  const diff = Math.max(0, Date.now() - servingAt)
  const mins = Math.floor(diff / 60000)
  const secs = Math.floor((diff % 60000) / 1000)
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
}

function DurationTimer({ servingAt }: { servingAt: number }) {
  const [elapsed, setElapsed] = useState(formatDuration(servingAt))
  useEffect(() => {
    const timer = setInterval(() => setElapsed(formatDuration(servingAt)), 1000)
    return () => clearInterval(timer)
  }, [servingAt])
  return <span className="font-mono tabular-nums">{elapsed}</span>
}

function RoomStatus({ serving, branchData }: { serving: QueueItem; branchData: any }) {
  const ot = serving.servingAt ? getOvertimeStatus(branchData, serving.procedureId, serving.servingAt, Date.now()) : null
  return (
    <>
      {ot?.isOvertime ? (
        <div className={`px-3 py-1.5 rounded-full text-xs font-bold ${ot.severity === 'critical' ? 'bg-red-500/30 text-red-400 animate-pulse' : 'bg-amber-500/20 text-amber-400'}`}>
          ⚠️ เลยเวลา {ot.overtimeBy} น.
        </div>
      ) : (
        <div className="px-3 py-1.5 rounded-full text-xs font-bold bg-green-500/20 text-green-400">
          🔄 กำลังให้บริการ
        </div>
      )}
      {serving.servingAt && (
        <div className={`text-sm font-bold font-mono tabular-nums ${ot?.isOvertime ? (ot.severity === 'critical' ? 'text-red-400' : 'text-amber-400') : 'text-green-400'}`}>
          ⏱ <DurationTimer servingAt={serving.servingAt} />
          {ot && <span className="text-[10px] font-normal text-gray-500"> / {ot.expected}น.</span>}
        </div>
      )}
      {/* Privacy: จอ TV แสดงเฉพาะหมายเลขคิว ห้ามแสดงชื่อผู้ป่วย */}
      <p className="text-xl font-bold text-white mt-2 truncate">
        {serving.number}
      </p>
    </>
  )
}

export default function TVDisplay() {
  const searchParams = useSearchParams()
  const { queue, setQueue, saveQueueItem } = useQueue()
  const { config, currentClinic, settings } = useClinic()
  // Get clinicId from URL param (passed by Dashboard) or resolve from clinicq-clinics
  const resolvedClinicId = useMemo(() => {
    // Priority 1: URL param ?clinicId=xxx
    const urlClinicId = searchParams.get('clinicId')
    if (urlClinicId) return urlClinicId
    // Priority 2: find from clinicq-clinics by type
    try {
      const clinics = JSON.parse(localStorage.getItem('clinicq-clinics') || '[]')
      const matched = clinics.find((c: any) => c.type === (currentClinic || 'dental'))
      if (matched?.id) return matched.id
    } catch {}
    return null
  }, [searchParams, currentClinic])

  // Load branch data from clinic-specific storage
  const branchData = useMemo(() => {
    if (typeof window !== 'undefined' && resolvedClinicId) {
      const saved = localStorage.getItem(`clinic-branch-data-${resolvedClinicId}`)
      if (saved) {
        try {
          const parsed = JSON.parse(saved)
          if (parsed && parsed.branches && parsed.branches.length > 0) return parsed as ReturnType<typeof getDefaultBranchData>
        } catch {}
      }
    }
    // Clinic-specific key not found → defaults
    return getDefaultBranchData(currentClinic || 'dental')
  }, [currentClinic, resolvedClinicId])
  
  // Today's daily rooms — Supabase-first (localStorage is only a cache).
  // Falls back to the clinic's room definitions when nothing is set for today.
  const { rooms: dailyRoomsSource } = useDailyRooms<Room>(resolvedClinicId)
  const activeRooms = useMemo(() => {
    const daily = dailyRoomsSource.filter((r) => r.active)
    if (daily.length > 0) return daily
    return branchData.rooms.filter(r => r.active)
  }, [dailyRoomsSource, branchData])

  const [lastCalled, setLastCalled] = useState<QueueItem | null>(null)
  const [showAlert, setShowAlert] = useState(false)
  const [soundEnabled, setSoundEnabled] = useState(true)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [currentTime, setCurrentTime] = useState(new Date())

  // TV display options (persisted together with ads as a single tv_ads object)
  const [theme, setTheme] = useState<'dark' | 'light'>('dark')
  const [fontSize, setFontSize] = useState<'normal' | 'large' | 'xlarge'>('large')
  const [maxDisplay, setMaxDisplay] = useState(10)
  const [showWaiting, setShowWaiting] = useState(true)
  const [showServing, setShowServing] = useState(true)
  const [showCompleted, setShowCompleted] = useState(false)

  // Ad rotation state
  const [currentAdIndex, setCurrentAdIndex] = useState(0)

  // Normalize one ad entry — supports the legacy array shape ({text,type,
  // enabled,duration}) and the current TVAd shape.
  const normalizeAd = (a: any, i: number): TVAd => ({
    id: String(a.id ?? i),
    type: a.type || 'text',
    url: a.url || '',
    text: a.text || '',
    duration: a.duration ?? 15,
    active: a.active ?? a.enabled ?? true,
  })

  // Load ads + display options from Supabase clinic_settings or localStorage.
  const [ads, setAds] = useState<TVAd[]>([
    { id: '1', type: 'text', url: '', text: '🦷 โปรโมชั่นพิเศษ! ขูดหินปูน + ตรวจสุขภาพฟัน เพียง 599 บาท', duration: 15, active: true },
  ])

  const applyTvSettings = useCallback((raw: any) => {
    if (!raw) return false
    // Legacy shape: plain array of ads.
    if (Array.isArray(raw)) {
      if (raw.length === 0) return false
      setAds(raw.map(normalizeAd))
      return true
    }
    // Current shape: { ads, theme, fontSize, maxDisplay, showServing,
    //   showWaiting, soundEnabled, showCompleted }
    if (Array.isArray(raw?.ads) && raw.ads.length > 0) {
      setAds(raw.ads.map(normalizeAd))
    }
    if (raw.theme === 'dark' || raw.theme === 'light') setTheme(raw.theme)
    if (['normal', 'large', 'xlarge'].includes(raw.fontSize)) setFontSize(raw.fontSize)
    if (typeof raw.maxDisplay === 'number') setMaxDisplay(raw.maxDisplay)
    if (typeof raw.showWaiting === 'boolean') setShowWaiting(raw.showWaiting)
    if (typeof raw.showServing === 'boolean') setShowServing(raw.showServing)
    if (typeof raw.showCompleted === 'boolean') setShowCompleted(raw.showCompleted)
    if (typeof raw.soundEnabled === 'boolean') setSoundEnabled(raw.soundEnabled)
    return true
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined' || !resolvedClinicId) return
    const loadAds = async () => {
      // Try Supabase first
      try {
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
        const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
        if (supabaseUrl && supabaseKey) {
          const res = await fetch(`${supabaseUrl}/rest/v1/clinic_settings?clinic_id=eq.${resolvedClinicId}&setting_key=eq.tv_ads&select=setting_value`, {
            headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` },
          })
          if (res.ok) {
            const rows = await res.json()
            if (rows?.[0]?.setting_value && applyTvSettings(rows[0].setting_value)) {
              return
            }
          }
        }
      } catch {}
      // Fallback: localStorage
      try {
        const saved = localStorage.getItem(`clinicq-tv-ads-${resolvedClinicId}`)
        if (saved) {
          const parsed = JSON.parse(saved)
          if (applyTvSettings(parsed)) return
        }
      } catch {}
    }
    loadAds()
  }, [resolvedClinicId, applyTvSettings])

  // Rotate ads
  useEffect(() => {
    const activeAds = ads.filter(a => a.active)
    if (activeAds.length === 0) return
    const timer = setInterval(() => {
      setCurrentAdIndex(prev => (prev + 1) % activeAds.length)
    }, activeAds[currentAdIndex % activeAds.length].duration * 1000)
    return () => clearInterval(timer)
  }, [ads, currentAdIndex])

  // Update clock
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  // Play beep
  const playBeep = useCallback(() => {
    if (!soundEnabled) return
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)()
      const frequencies = [523.25, 659.25, 783.99]
      frequencies.forEach((freq, i) => {
        const osc = ctx.createOscillator()
        const gain = ctx.createGain()
        osc.connect(gain)
        gain.connect(ctx.destination)
        osc.type = 'sine'
        osc.frequency.value = freq
        const t = ctx.currentTime + i * 0.15
        gain.gain.setValueAtTime(0, t)
        gain.gain.linearRampToValueAtTime(0.3, t + 0.05)
        gain.gain.linearRampToValueAtTime(0, t + 0.12)
        osc.start(t)
        osc.stop(t + 0.15)
      })
    } catch {}
  }, [soundEnabled])

  // Overtime alert state
  const [overtimeAlerted, setOvertimeAlerted] = useState<Set<number>>(new Set())

  // Room status
  const roomStatus = useMemo(() => {
    return activeRooms.map((room, i) => {
      const serving = queue.find(q => q.assignedRoom === room.id && q.status === 'serving')
      const branch = branchData.branches.find(b => b.id === room.branchId)
      return { ...room, serving, branchName: branch?.name || '', color: roomColors[i % roomColors.length] }
    })
  }, [activeRooms, queue, branchData])

  // Check for overtime rooms and play alert
  useEffect(() => {
    roomStatus.forEach(room => {
      if (!room.serving?.servingAt) return
      const ot = getOvertimeStatus(branchData, room.serving.procedureId, room.serving.servingAt, Date.now())
      if (ot.isOvertime && ot.severity === 'critical' && !overtimeAlerted.has(room.id)) {
        setOvertimeAlerted(prev => new Set(prev).add(room.id))
        // Play overtime alert sound (different from call queue beep)
        if (soundEnabled) {
          try {
            const ctx = new (window.AudioContext || (window as any).webkitAudioContext)()
            const freqs = [880, 660, 880, 660]
            freqs.forEach((freq, i) => {
              const osc = ctx.createOscillator()
              const gain = ctx.createGain()
              osc.connect(gain)
              gain.connect(ctx.destination)
              osc.type = 'square'
              osc.frequency.value = freq
              const t = ctx.currentTime + i * 0.2
              gain.gain.setValueAtTime(0, t)
              gain.gain.linearRampToValueAtTime(0.15, t + 0.05)
              gain.gain.linearRampToValueAtTime(0, t + 0.15)
              osc.start(t)
              osc.stop(t + 0.2)
            })
          } catch {}
        }
      }
      // Reset if back to normal
      if (!ot.isOvertime && overtimeAlerted.has(room.id)) {
        setOvertimeAlerted(prev => { const n = new Set(prev); n.delete(room.id); return n })
      }
    })
  }, [roomStatus, overtimeAlerted, soundEnabled, branchData])

  const nextQueue = useMemo(() => queue.find(q => q.status === 'waiting' && q.arrived), [queue])

  const stats = useMemo(() => ({
    serving: queue.filter(q => q.status === 'serving').length,
    waiting: queue.filter(q => q.status === 'waiting' && q.arrived).length,
    completed: queue.filter(q => q.status === 'completed').length,
    total: queue.length,
  }), [queue])

  const callNextQueue = useCallback(() => {
    if (!nextQueue) return
    // Privacy: จอ TV ไม่ส่ง/แสดงชื่อผู้ป่วย
    const updated = { ...nextQueue, status: 'serving' as const, servingAt: Date.now() }
    setQueue(prev => prev.map(q => q.id === nextQueue.id ? updated : q))
    // Also save to Supabase so other devices see the change
    saveQueueItem(updated).catch(() => {})
    setLastCalled(updated)
    setShowAlert(true)
    playBeep()
    setTimeout(() => setShowAlert(false), 8000)
  }, [nextQueue, setQueue, saveQueueItem, playBeep])

  // ═══ Room notification: play sound + show procedure when patient arrives ═══
  const [roomNotification, setRoomNotification] = useState<{ roomId: number; procedure: string; color: string } | null>(null)
  const prevServingRef = useRef<Set<number>>(new Set())

  // Play room notification sound
  const playRoomSound = useCallback(() => {
    if (!soundEnabled) return
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)()
      const freqs = [440, 554, 659, 880] // A4 C#5 E5 A5 — welcoming chime
      freqs.forEach((freq, i) => {
        const osc = ctx.createOscillator()
        const gain = ctx.createGain()
        osc.connect(gain)
        gain.connect(ctx.destination)
        osc.type = 'sine'
        osc.frequency.value = freq
        const t = ctx.currentTime + i * 0.18
        gain.gain.setValueAtTime(0, t)
        gain.gain.linearRampToValueAtTime(0.25, t + 0.05)
        gain.gain.linearRampToValueAtTime(0, t + 0.25)
        osc.start(t)
        osc.stop(t + 0.3)
      })
    } catch {}
  }, [soundEnabled])

  // Detect new patient arriving at room
  useEffect(() => {
    const currentServing = new Set(
      queue.filter(q => q.status === 'serving' && q.assignedRoom > 0).map(q => q.assignedRoom)
    )
    // Find newly assigned rooms
    currentServing.forEach(roomId => {
      if (!prevServingRef.current.has(roomId)) {
        const item = queue.find(q => q.assignedRoom === roomId && q.status === 'serving')
        if (item) {
          const room = activeRooms.find(r => r.id === roomId)
          playRoomSound()
          setRoomNotification({
            roomId,
            procedure: item.procedure || 'ไม่ระบุหัตถการ',
            color: room?.color || '#93C5FD',
          })
          setTimeout(() => setRoomNotification(null), 6000)
        }
      }
    })
    prevServingRef.current = currentServing
  }, [queue, activeRooms, playRoomSound])

  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen()
      setIsFullscreen(true)
    } else {
      document.exitFullscreen()
      setIsFullscreen(false)
    }
  }, [])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'F11') { e.preventDefault(); toggleFullscreen() }
      if (e.key === 'Escape') setShowAlert(false)
      if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); callNextQueue() }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [toggleFullscreen, callNextQueue])

  const timeString = currentTime.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit', timeZone: 'Asia/Bangkok' }) + ' ICT'
  const dateString = currentTime.toLocaleDateString('th-TH', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', timeZone: 'Asia/Bangkok' })
  const accentColor = config?.color || '#93C5FD'
  const activeAds = ads.filter(a => a.active)
  const currentAd = activeAds[currentAdIndex % activeAds.length]

  const fontSizeClass = fontSize === 'normal' ? 'text-5xl' : fontSize === 'xlarge' ? 'text-7xl' : 'text-6xl'

  return (
    <div className={clsx('min-h-screen overflow-hidden relative', theme === 'light'
      ? 'bg-gradient-to-br from-slate-100 via-white to-slate-100 text-slate-900'
      : 'bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 text-white')}>
      {/* Called Alert */}
      {showAlert && lastCalled && (
        <TVCalledAlert queue={lastCalled} clinic={config ? { name: settings?.clinicName || config.name, nameEn: config.nameEn || config.name, color: config.color, bg: config.bg, icon: config.prefix, prefix: config.prefix } : { name: 'Clinic', nameEn: 'Clinic', color: '#93C5FD', bg: '#EFF6FF', icon: 'Q', prefix: 'Q' }} onDismiss={() => setShowAlert(false)} />
      )}

      {/* Room Notification — procedure only, NO patient name */}
      {roomNotification && (
        <div className="fixed top-4 right-4 z-50 animate-slide-in">
          <div
            className="flex items-center gap-4 px-6 py-4 rounded-2xl shadow-2xl border-2 backdrop-blur-sm"
            style={{
              backgroundColor: roomNotification.color + '20',
              borderColor: roomNotification.color,
            }}
          >
            <div
              className="w-14 h-14 rounded-xl flex items-center justify-center text-white text-2xl font-bold shadow-lg"
              style={{ backgroundColor: roomNotification.color }}
            >
              {roomNotification.roomId}
            </div>
            <div>
              <p className="text-white/60 text-xs font-medium">ห้อง {roomNotification.roomId} — มีคนไข้เข้าห้อง</p>
              <p className="text-white text-lg font-bold">📋 {roomNotification.procedure}</p>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <header className="flex items-center justify-between px-6 py-3 bg-black/30 backdrop-blur-sm border-b border-white/10">
        <div className="flex items-center gap-3">
          {settings?.logo ? (
            <img src={settings.logo} alt="Logo" className="w-10 h-10 rounded-xl object-cover border border-white/20" />
          ) : (
            <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold text-xl" style={{ backgroundColor: accentColor }}>
              {config?.prefix || 'Q'}
            </div>
          )}
          <div>
            <h1 className="text-lg font-bold">{settings?.clinicName || config?.name || 'Clinic-Q'}</h1>
            <p className="text-[10px] text-gray-400">จอแสดงคิว</p>
          </div>
        </div>
        <div className="flex items-center gap-6">
          <div className="text-right">
            <p className="text-2xl font-mono font-bold tabular-nums">{timeString}</p>
            <p className="text-[10px] text-gray-400">{dateString}</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setSoundEnabled(!soundEnabled)} className={clsx('p-2 rounded-lg transition-colors', soundEnabled ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400')}>
              {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
            </button>
            <button onClick={toggleFullscreen} className="p-2 bg-white/10 hover:bg-white/20 rounded-lg transition-colors">
              {isFullscreen ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
            </button>
            <button onClick={callNextQueue} className="p-2 bg-emerald-500 hover:bg-emerald-600 rounded-lg transition-colors">
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Layout: Top = Queue + Rooms, Bottom = Ads Marquee */}
      <div className="flex flex-col h-[calc(100vh-61px)]">
        {/* Top Section: Room Status + Next Queue */}
        <div className="flex-1 flex overflow-hidden">
          {/* LEFT — Room Status */}
          <div className="flex-1 p-5 overflow-y-auto">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
              <h2 className="text-sm font-bold text-gray-300 uppercase tracking-wider">🖥️ สถานะห้องตรวจ</h2>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
              {roomStatus.map((room) => (
                <div
                  key={room.id}
                  className="rounded-2xl border-2 p-4 text-center transition-all"
                  style={{
                    borderColor: room.serving ? room.color : 'rgba(255,255,255,0.08)',
                    backgroundColor: room.serving ? `${room.color}12` : 'rgba(255,255,255,0.03)',
                  }}
                >
                  <div className="w-12 h-12 rounded-2xl mx-auto mb-2 flex items-center justify-center text-white text-lg font-bold" style={{ backgroundColor: room.color }}>
                    {room.id}
                  </div>
                  <p className="text-sm font-bold text-white">{room.name}</p>
                  {room.branchName && (
                    <p className="text-[10px] mt-1 px-2 py-0.5 rounded-lg inline-block font-medium" style={{ backgroundColor: `${room.color}25`, color: room.color }}>{room.branchName}</p>
                  )}
                  <div className="mt-3">
                    {room.serving ? (
                      <div className="space-y-1.5">
                        <RoomStatus serving={room.serving} branchData={branchData} />
                      </div>
                    ) : (
                      <div className="px-3 py-1.5 rounded-full text-xs font-medium bg-white/5 text-gray-500">
                        ✅ ว่าง
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* RIGHT — Next Queue + Waiting */}
          <div className="w-80 xl:w-96 bg-black/20 border-l border-white/10 flex flex-col">
            {/* Next Queue Number */}
            {nextQueue && (
              <div className="p-5 border-b border-white/10 bg-emerald-500/10">
                <p className="text-[10px] text-emerald-400 font-medium uppercase tracking-wider mb-1">⏭ คิวถัดไป</p>
                <div className={`${fontSizeClass} font-mono font-black text-emerald-400 tabular-nums mb-3`}>{nextQueue.number}</div>
                {/* Privacy: จอ TV ไม่แสดงชื่อผู้ป่วย */}
                <p className="text-sm text-emerald-400/60 mb-3">เชิญเข้าห้อง {nextQueue.assignedRoom}</p>
                <button onClick={callNextQueue} className="w-full px-4 py-3 bg-emerald-500 hover:bg-emerald-600 text-white rounded-2xl font-bold text-sm transition-colors shadow-lg shadow-emerald-500/30">
                  ▶ เรียกคิว
                </button>
              </div>
            )}

            {/* Waiting Queue */}
            {showWaiting && (
              <>
                <div className="px-4 pt-4 pb-2 border-b border-white/10">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-semibold text-gray-200 text-sm">คิวที่กำลังรอ</h3>
                      <p className="text-[10px] text-gray-500">มาถึงแล้ว</p>
                    </div>
                    <span className="text-3xl font-black text-yellow-400 tabular-nums">{stats.waiting}</span>
                  </div>
                </div>
                <div className="flex-1 overflow-y-auto p-3 space-y-2">
                  {queue.filter(q => q.status === 'waiting' && q.arrived).slice(0, maxDisplay).map((item) => (
                    <div key={item.id} className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-white/5 border border-white/5">
                      <div className="w-12 h-12 rounded-xl flex items-center justify-center font-bold text-base flex-shrink-0" style={{ backgroundColor: accentColor + '20', color: accentColor }}>
                        {item.number}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-gray-500">ห้อง {item.assignedRoom}</p>
                      </div>
                      <div className="w-2 h-2 bg-yellow-500 rounded-full animate-pulse flex-shrink-0" />
                    </div>
                  ))}
                  {stats.waiting === 0 && (
                    <div className="text-center py-8">
                      <p className="text-gray-500 text-xs">ไม่มีคิวรอ</p>
                    </div>
                  )}
                </div>
              </>
            )}

            {/* Stats Footer */}
            <div className="p-3 border-t border-white/10 grid gap-2 relative" style={{ gridTemplateColumns: [showServing, showWaiting, showCompleted].filter(Boolean).length > 0 ? `repeat(${[showServing, showWaiting, showCompleted].filter(Boolean).length}, 1fr)` : '1fr' }}>
              {showServing && (
                <div className="text-center p-2 rounded-xl bg-green-500/10">
                  <p className="text-xl font-bold text-green-400 tabular-nums">{stats.serving}</p>
                  <p className="text-[9px] text-gray-500">กำลังทำ</p>
                </div>
              )}
              {showWaiting && (
                <div className="text-center p-2 rounded-xl bg-yellow-500/10">
                  <p className="text-xl font-bold text-yellow-400 tabular-nums">{stats.waiting}</p>
                  <p className="text-[9px] text-gray-500">รอเรียก</p>
                </div>
              )}
              {showCompleted && (
                <div className="text-center p-2 rounded-xl bg-gray-500/10">
                  <p className="text-xl font-bold text-gray-400 tabular-nums">{stats.completed}</p>
                  <p className="text-[9px] text-gray-500">เสร็จแล้ว</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Bottom Section: Ad Area + Branding */}
        <div className="border-t border-white/10">
          {/* Clinic-Q Branding — bottom left */}
          <div className="absolute bottom-3 left-3 flex items-center gap-2 opacity-40 hover:opacity-80 transition-opacity">
            <img src="/brand-logo.png" alt="Clinic-Q" className="w-6 h-6 rounded-lg" />
            <div>
              <p className="text-[10px] font-bold text-white/70">Clinic-Q</p>
              <p className="text-[8px] text-white/50">Smart Clinic, Smooth Queue</p>
            </div>
          </div>
          {/* Rotating Ad Display */}
          {activeAds.length > 0 && (
            <div className="h-32">
              <TVAdDisplay ads={ads} height={128} />
            </div>
          )}
        </div>
      </div>

      {/* Room notification animation */}
      <style jsx>{`
        @keyframes slide-in {
          from { transform: translateX(100%); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
        .animate-slide-in {
          animation: slide-in 0.4s ease-out forwards;
        }
      `}</style>
    </div>
  )
}
