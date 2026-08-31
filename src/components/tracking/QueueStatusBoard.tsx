'use client'

import { useState, useEffect, useMemo } from 'react'
import { useSearchParams } from 'next/navigation'
import { Clock, Users, Stethoscope, ArrowLeft, Timer, Activity, CheckCircle, ChevronDown, ChevronRight, X, Home } from 'lucide-react'
import Link from 'next/link'
import { useQueue, type QueueItem } from '@/lib/queue-context'
import { useClinic } from '@/lib/clinic-context'
import { clinicConfig, type ClinicType } from '@/lib/queue-data'
import { getDefaultBranchData, getEstimatedDuration, type Room } from '@/lib/branch-data'

// Helper: lighten a hex color for background
function lighten(hex: string, factor = 0.85): string {
  const num = parseInt(hex.replace('#', ''), 16)
  const r = (num >> 16) & 255
  const g = (num >> 8) & 255
  const b = num & 255
  const lr = Math.round(r + (255 - r) * factor)
  const lg = Math.round(g + (255 - g) * factor)
  const lb = Math.round(b + (255 - b) * factor)
  return `rgb(${lr}, ${lg}, ${lb})`
}

// Helper: get text color that contrasts with background
function contrastText(hex: string): string {
  const num = parseInt(hex.replace('#', ''), 16)
  const r = (num >> 16) & 255
  const g = (num >> 8) & 255
  const b = num & 255
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255
  return luminance > 0.5 ? '#1E293B' : '#FFFFFF'
}

export default function QueueStatusBoard() {
  const searchParams = useSearchParams()
  const { queue } = useQueue()
  const { currentClinic } = useClinic()
  const [currentTime, setCurrentTime] = useState(new Date())
  const [showCompleted, setShowCompleted] = useState(false)
  const [showCancelled, setShowCancelled] = useState(false)
  const [refreshTick, setRefreshTick] = useState(0)
  const [lastRefresh, setLastRefresh] = useState(new Date())

  // Read clinic from URL param (?clinic=dental) or fall back to currentClinic or 'dental'
  const clinicType = (searchParams.get('clinic') || currentClinic || 'dental') as ClinicType

  // Auto-refresh every 30 seconds
  useEffect(() => {
    const refreshTimer = setInterval(() => {
      setRefreshTick(t => t + 1)
      setLastRefresh(new Date())
    }, 30000)
    return () => clearInterval(refreshTimer)
  }, [])

  // Use queue data (from Supabase or localStorage)
  const effectiveQueue = useMemo(() => {
    if (queue.length > 0) return queue
    // Re-read from localStorage on refreshTick changes
    try {
      const today = new Date().toISOString().split('T')[0]
      const storageKey = `clinicq-queue-${clinicType}-${today}`
      const saved = localStorage.getItem(storageKey)
      if (saved) return JSON.parse(saved) as QueueItem[]
    } catch {}
    return []
  }, [queue, clinicType, refreshTick])
  const clinicCfg = clinicConfig[clinicType]
  const accentColor = clinicCfg.color
  const branchData = useMemo(() => getDefaultBranchData(clinicType), [clinicType])

  // Auto-refresh clock
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  // Get active branches for this clinic type
  const activeBranches = useMemo(() => {
    return branchData.branches.filter(b => b.active)
  }, [branchData])

  // ═══ Filter by status ═══
  const arrivedWaiting = useMemo(() => {
    return effectiveQueue.filter(q => q.arrived && q.status === 'waiting')
  }, [effectiveQueue])

  const serving = useMemo(() => {
    return effectiveQueue.filter(q => q.status === 'serving')
  }, [effectiveQueue])

  const completed = useMemo(() => {
    return effectiveQueue.filter(q => q.status === 'completed')
  }, [effectiveQueue])

  const cancelled = useMemo(() => {
    return effectiveQueue.filter(q => q.status === 'cancelled')
  }, [effectiveQueue])

  // ═══ Read daily rooms from localStorage ═══
  const dailyRooms = useMemo(() => {
    if (typeof window === 'undefined') return []
    try {
      const saved = localStorage.getItem('clinic-daily-rooms')
      const savedDate = localStorage.getItem('clinic-daily-rooms-date')
      const today = new Date().toISOString().split('T')[0]
      if (savedDate === today && saved) {
        const rooms: Room[] = JSON.parse(saved)
        return rooms.filter(r => r.active)
      }
    } catch {}
    return []
  }, [refreshTick])

  // ═══ Per-room status ═══
  const roomStatuses = useMemo(() => {
    return dailyRooms.map(room => {
      const roomServing = serving.find(q => q.assignedRoom === room.id)
      const roomWaiting = arrivedWaiting.filter(q => q.assignedRoom === room.id)
      const waitingCount = roomWaiting.length
      const now = Date.now()

      // Calculate wait time: remaining time for serving + estimated for waiting
      let waitMinutes = 0
      if (roomServing) {
        const expected = getEstimatedDuration(branchData, roomServing.procedureId)
        const elapsed = roomServing.servingAt ? Math.max(0, Math.floor((now - roomServing.servingAt) / 60000)) : 0
        waitMinutes = Math.max(0, expected - elapsed)
      }
      roomWaiting.forEach(item => {
        waitMinutes += getEstimatedDuration(branchData, item.procedureId)
      })

      // Expected free time
      let expectedFreeTime = ''
      if (roomServing || waitingCount > 0) {
        const freeDate = new Date(now + waitMinutes * 60000)
        expectedFreeTime = freeDate.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Bangkok' })
      }

      return {
        room,
        serving: roomServing,
        waitingCount,
        waitMinutes: Math.round(waitMinutes),
        expectedFreeTime,
        isFree: !roomServing && waitingCount === 0,
      }
    })
  }, [dailyRooms, serving, arrivedWaiting, branchData])

  // ═══ Stats ═══
  const totalEstimatedWait = useMemo(() => {
    return arrivedWaiting.reduce((sum, item) => {
      return sum + getEstimatedDuration(branchData, item.procedureId)
    }, 0)
  }, [arrivedWaiting, branchData])

  const avgWaitPerPatient = useMemo(() => {
    if (arrivedWaiting.length === 0) return 0
    return Math.round(totalEstimatedWait / arrivedWaiting.length)
  }, [totalEstimatedWait, arrivedWaiting.length])

  const timeStr = currentTime.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit', timeZone: 'Asia/Bangkok' }) + ' ICT'
  const dateStr = currentTime.toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'Asia/Bangkok' })

  const totalWaiting = arrivedWaiting.length + serving.length

  return (
    <div className="min-h-screen" style={{ backgroundColor: `${accentColor}05` }}>
      {/* Header */}
      <div className="px-4 py-4 shadow-sm" style={{ backgroundColor: accentColor }}>
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              href="/track"
              className="w-9 h-9 rounded-xl bg-white/20 hover:bg-white/30 flex items-center justify-center transition-colors"
            >
              <ArrowLeft className="w-5 h-5 text-white" />
            </Link>
            <div>
              <h1 className="text-white font-bold text-lg">📊 สถานะคิววันนี้</h1>
              <p className="text-white/70 text-xs">{clinicCfg.icon} {clinicCfg.name}</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-white font-mono font-bold text-lg">{timeStr}</p>
            <p className="text-white/60 text-[10px]">{dateStr}</p>
            <p className="text-white/40 text-[9px] mt-0.5">🔄 อัปเดตอัตโนมัติทุก 30 วินาที</p>
          </div>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-6 space-y-4">
        {/* ═══════ SUMMARY CARDS ═══════ */}
        <div className="grid grid-cols-3 gap-3">
          <div className="bento-card p-3 text-center">
            <div className="w-8 h-8 rounded-lg mx-auto mb-1.5 flex items-center justify-center" style={{ backgroundColor: `${accentColor}15` }}>
              <Stethoscope className="w-4 h-4" style={{ color: accentColor }} />
            </div>
            <p className="text-2xl font-black" style={{ color: accentColor }}>{dailyRooms.length}</p>
            <p className="text-[10px] text-gray-500 mt-0.5">ห้องทำหัตถการ</p>
          </div>
          <div className="bento-card p-3 text-center">
            <div className="w-8 h-8 rounded-lg mx-auto mb-1.5 flex items-center justify-center bg-amber-50">
              <Timer className="w-4 h-4 text-amber-500" />
            </div>
            <p className="text-2xl font-black text-amber-600">
              {arrivedWaiting.length > 0 ? `~${totalEstimatedWait}` : '0'}
            </p>
            <p className="text-[10px] text-gray-500 mt-0.5">นาที รอทั้งหมด</p>
          </div>
          <div className="bento-card p-3 text-center">
            <div className="w-8 h-8 rounded-lg mx-auto mb-1.5 flex items-center justify-center bg-emerald-50">
              <Users className="w-4 h-4 text-emerald-500" />
            </div>
            <p className="text-2xl font-black text-emerald-600">{arrivedWaiting.length + serving.length}</p>
            <p className="text-[10px] text-gray-500 mt-0.5">คิวทั้งหมด</p>
          </div>
        </div>

        {/* ═══════ WAIT TIME ═══════ */}
        {arrivedWaiting.length > 0 && (
          <div className="bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-100 rounded-2xl p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center">
                <Clock className="w-5 h-5 text-amber-600" />
              </div>
              <div>
                <p className="text-xs text-gray-500">เวลารอเฉลี่ยต่อคิว</p>
                <p className="text-lg font-bold text-gray-900">~{avgWaitPerPatient} นาที</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-xs text-gray-500">คิวสุดท้ายรอ</p>
              <p className="text-xl font-black" style={{ color: accentColor }}>~{totalEstimatedWait} น.</p>
            </div>
          </div>
        )}

        {/* ═══════ ROOM STATUS ═══════ */}
        {dailyRooms.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 px-1">
              <Stethoscope className="w-4 h-4 text-gray-400" />
              <h2 className="font-bold text-gray-700 text-sm">สถานะห้องตรวจ</h2>
            </div>

            {roomStatuses.map(({ room, serving: roomServing, waitingCount, waitMinutes, expectedFreeTime, isFree }) => {
              const bgColor = room.color || '#93C5FD'
              const lightBg = lighten(bgColor)
              const textColor = contrastText(bgColor)

              return (
                <div
                  key={room.id}
                  className="rounded-2xl overflow-hidden border-2 transition-all"
                  style={{ borderColor: isFree ? '#E2E8F0' : bgColor, backgroundColor: isFree ? '#F8FAFC' : lightBg }}
                >
                  <div className="px-5 py-4 flex items-center justify-between">
                    {/* Left: Room info */}
                    <div className="flex items-center gap-3">
                      <div
                        className="w-12 h-12 rounded-xl flex items-center justify-center font-bold text-lg text-white shadow-sm"
                        style={{ backgroundColor: bgColor }}
                      >
                        {room.id}
                      </div>
                      <div>
                        <p className="font-bold text-sm" style={{ color: isFree ? '#374151' : textColor }}>{room.name}</p>
                        <p className="text-[10px] mt-0.5" style={{ color: isFree ? '#9CA3AF' : textColor }}>
                          {room.practitionerName || 'ไม่ระบุผู้ทำหัตถการ'}
                        </p>
                      </div>
                    </div>

                    {/* Right: Status */}
                    <div className="text-right">
                      {isFree ? (
                        <div>
                          <span className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-700">
                            ✅ ว่าง
                          </span>
                        </div>
                      ) : (
                        <div>
                          <p className="text-2xl font-black" style={{ color: bgColor }}>
                            ~{waitMinutes}
                          </p>
                          <p className="text-[10px]" style={{ color: textColor }}>นาที</p>
                          {expectedFreeTime && (
                            <p className="text-[9px] mt-0.5" style={{ color: textColor }}>
                              คาดว่าง ~{expectedFreeTime} น.
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* ═══════ NO QUEUE ═══════ */}
        {totalWaiting === 0 && (
          <div className="bento-card p-8 text-center">
            <div className="w-14 h-14 rounded-2xl mx-auto mb-3 flex items-center justify-center" style={{ backgroundColor: `${accentColor}10` }}>
              <CheckCircle className="w-7 h-7" style={{ color: accentColor }} />
            </div>
            <h3 className="text-lg font-bold text-gray-900 mb-1">ไม่มีคิวรอในขณะนี้</h3>
            <p className="text-sm text-gray-500">คิวว่าง ไม่มีผู้รอรับบริการ</p>
          </div>
        )}

        {/* ═══════ COLLAPSIBLE: COMPLETED ═══════ */}
        {completed.length > 0 && (
          <button
            onClick={() => setShowCompleted(!showCompleted)}
            className="w-full bento-card px-4 py-3 flex items-center justify-between hover:bg-gray-50/50 transition-colors"
          >
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-blue-500" />
              <span className="text-sm font-medium text-gray-700">เสร็จสิ้นวันนี้</span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-100 text-blue-600 font-medium">{completed.length}</span>
            </div>
            {showCompleted ? (
              <ChevronDown className="w-4 h-4 text-gray-400" />
            ) : (
              <ChevronRight className="w-4 h-4 text-gray-400" />
            )}
          </button>
        )}
        {showCompleted && completed.length > 0 && (
          <div className="bento-card overflow-hidden -mt-2">
            <div className="divide-y divide-gray-50">
              {completed.map(item => (
                <div key={item.id} className="px-4 py-2.5 flex items-center gap-3 bg-gray-50/30">
                  <div className="w-6 h-6 rounded-md bg-blue-100 flex items-center justify-center flex-shrink-0">
                    <CheckCircle className="w-3 h-3 text-blue-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs text-gray-500">{item.number}</span>
                      <span className="text-xs text-gray-400">{item.patientName}</span>
                    </div>
                  </div>
                  <span className="text-[10px] text-gray-400">{item.completedAt || ''}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ═══════ COLLAPSIBLE: CANCELLED ═══════ */}
        {cancelled.length > 0 && (
          <button
            onClick={() => setShowCancelled(!showCancelled)}
            className="w-full bento-card px-4 py-3 flex items-center justify-between hover:bg-gray-50/50 transition-colors"
          >
            <div className="flex items-center gap-2">
              <X className="w-4 h-4 text-red-400" />
              <span className="text-sm font-medium text-gray-700">คิวที่ยกเลิก</span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-100 text-red-600 font-medium">{cancelled.length}</span>
            </div>
            {showCancelled ? (
              <ChevronDown className="w-4 h-4 text-gray-400" />
            ) : (
              <ChevronRight className="w-4 h-4 text-gray-400" />
            )}
          </button>
        )}
        {showCancelled && cancelled.length > 0 && (
          <div className="bento-card overflow-hidden -mt-2">
            <div className="divide-y divide-gray-50">
              {cancelled.map(item => (
                <div key={item.id} className="px-4 py-2.5 flex items-center gap-3 bg-red-50/30">
                  <div className="w-6 h-6 rounded-md bg-red-100 flex items-center justify-center flex-shrink-0">
                    <X className="w-3 h-3 text-red-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs text-gray-400 line-through">{item.number}</span>
                      <span className="text-xs text-gray-400 line-through">{item.patientName}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="text-center space-y-2 pt-2 pb-4">
          <p className="text-[10px] text-gray-400">ข้อมูลอัปเดตแบบเรียลไทม์ — {clinicCfg.icon} {clinicCfg.name}</p>
          <Link
            href="/track"
            className="inline-flex items-center gap-1.5 text-xs font-medium px-4 py-2 rounded-xl transition-colors"
            style={{ color: accentColor, backgroundColor: `${accentColor}10` }}
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            กลับไปติดตามคิว
          </Link>
        </div>
      </div>
    </div>
  )
}
