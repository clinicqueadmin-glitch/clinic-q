'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import { useSearchParams } from 'next/navigation'
import { clsx } from 'clsx'
import Link from 'next/link'
import {
  Clock, CheckCircle, Loader2, Stethoscope, Bell, Share2, ArrowLeft, Home, X, BarChart3,
} from 'lucide-react'
import { useQueue, type QueueItem } from '@/lib/queue-context'
import { useClinic } from '@/lib/clinic-context'
import { clinicConfig, type ClinicType } from '@/lib/queue-data'
import { createClient } from '@/utils/supabase/client'
import { getClinicId, isSupabaseConfigured } from '@/lib/supabase-queue'
import { useNotification } from '@/lib/use-notification'
import { getDefaultBranchData, getQueueWaitInfo } from '@/lib/branch-data'

type ViewMode = 'search' | 'result' | 'error'

export default function QueueTracker() {
  const searchParams = useSearchParams()
  const { queue } = useQueue()
  const { config, currentClinic } = useClinic()

  const [query, setQuery] = useState('')
  const [viewMode, setViewMode] = useState<ViewMode>('search')
  const [currentTime, setCurrentTime] = useState(new Date())
  const [liveItem, setLiveItem] = useState<QueueItem | null>(null)
  const [liveQueue, setLiveQueue] = useState<QueueItem[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [notificationEnabled, setNotificationEnabled] = useState(false)
  const [prevStatus, setPrevStatus] = useState<string | null>(null)

  const useSupabase = isSupabaseConfigured()
  const { permission, requestPermission, notifyQueueCalled, notifyQueueCompleted } = useNotification()

  // Auto-refresh clock
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  // Fetch from Supabase if configured
  const fetchFromSupabase = useCallback(async (number: string) => {
    if (!useSupabase || !currentClinic) return null
    const sb = createClient()
    if (!sb) return null
    const clinicId = getClinicId(currentClinic as ClinicType)
    const { data, error } = await sb
      .from('queues')
      .select('*')
      .eq('clinic_id', clinicId)
      .ilike('number', number)
      .single()
    if (error || !data) return null
    // Convert DB row to QueueItem
    return {
      id: data.id,
      number: data.number,
      patientName: data.patient_name,
      phone: data.phone || '',
      procedure: data.procedure,
      procedureId: data.procedure_id || '',
      branchId: data.branch_id || '',
      bookingMode: data.booking_mode,
      assignedRoom: data.assigned_room || 0,
      assignedDoctor: data.assigned_doctor || '',
      status: data.status,
      time: data.time || '',
      bookedAt: data.booked_at,
      arrivalTime: data.arrival_time || '',
      arrived: data.arrived,
      arrivedAt: data.arrived_at || undefined,
      servingAt: data.serving_at ? new Date(data.serving_at).getTime() : undefined,
      completedAt: data.completed_at || undefined,
      totalDuration: data.total_duration || undefined,
      completedProcedures: [],
    } as QueueItem
  }, [useSupabase, currentClinic])

  // Fetch all queues from Supabase
  const fetchAllFromSupabase = useCallback(async () => {
    if (!useSupabase || !currentClinic) return []
    const sb = createClient()
    if (!sb) return []
    const clinicId = getClinicId(currentClinic as ClinicType)
    const today = new Date().toISOString().split('T')[0]
    const { data, error } = await sb
      .from('queues')
      .select('*')
      .eq('clinic_id', clinicId)
      .eq('queue_date', today)
      .order('created_at', { ascending: true })
    if (error || !data) return []
    return data.map((row: any) => ({
      id: row.id,
      number: row.number,
      patientName: row.patient_name,
      phone: row.phone || '',
      procedure: row.procedure,
      procedureId: row.procedure_id || '',
      branchId: row.branch_id || '',
      bookingMode: row.booking_mode,
      assignedRoom: row.assigned_room || 0,
      assignedDoctor: row.assigned_doctor || '',
      status: row.status,
      time: row.time || '',
      bookedAt: row.booked_at,
      arrivalTime: row.arrival_time || '',
      arrived: row.arrived,
      arrivedAt: row.arrived_at || undefined,
      servingAt: row.serving_at ? new Date(row.serving_at).getTime() : undefined,
      completedAt: row.completed_at || undefined,
      totalDuration: row.total_duration || undefined,
      completedProcedures: [],
    })) as QueueItem[]
  }, [useSupabase, currentClinic])

  // Auto-load from URL params (supports ?id=E024 or ?phone=081-234-5678)
  useEffect(() => {
    const id = searchParams.get('id')
    const phone = searchParams.get('phone')
    const searchVal = id || phone
    if (searchVal) {
      setQuery(searchVal)
      handleSearchWithInput(searchVal)
    }
  }, [searchParams])

  // Subscribe to real-time updates if Supabase is configured
  useEffect(() => {
    if (!useSupabase || !currentClinic) return
    const clinicId = getClinicId(currentClinic as ClinicType)
    const today = new Date().toISOString().split('T')[0]
    
    const sb = createClient()
    if (!sb) return
    const channel = sb
      .channel('track-queues')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'queues', filter: `clinic_id=eq.${clinicId}` },
        async () => {
          const allQueue = await fetchAllFromSupabase()
          setLiveQueue(allQueue)
          if (query.trim()) {
            const item = allQueue.find(q => q.number.toLowerCase() === query.trim().toLowerCase())
            setLiveItem(item || null)
          }
        }
      )
      .subscribe()

    return () => { sb.removeChannel(channel) }
  }, [useSupabase, currentClinic, query, fetchAllFromSupabase])

  // Branch data for wait time calculation (load from clinic-specific storage)
  const branchData = useMemo(() => {
    if (typeof window !== 'undefined') {
      const clinics = JSON.parse(localStorage.getItem('clinicq-clinics') || '[]')
      const matched = clinics.find((c: any) => c.type === (currentClinic || 'dental'))
      const cid = matched?.id
      if (cid) {
        const saved = localStorage.getItem(`clinic-branch-data-${cid}`)
        if (saved) {
          try {
            const parsed = JSON.parse(saved)
            if (parsed && parsed.branches && parsed.branches.length > 0) return parsed as ReturnType<typeof getDefaultBranchData>
          } catch {}
        }
        const sharedSaved = localStorage.getItem('clinic-branch-data')
        if (sharedSaved) {
          try {
            const parsed = JSON.parse(sharedSaved)
            if (parsed && parsed.branches && parsed.branches.length > 0) return parsed as ReturnType<typeof getDefaultBranchData>
          } catch {}
        }
      }
    }
    return getDefaultBranchData(currentClinic || 'dental')
  }, [currentClinic])

  // Determine which queue source to use
  const effectiveQueue = useSupabase && liveQueue.length > 0 ? liveQueue : queue

  // Find queue item by phone
  const foundItem = useMemo(() => {
    if (liveItem) return liveItem
    if (!query.trim()) return null
    const q = query.trim()
    return effectiveQueue.find(item => item.phone === q) || null
  }, [effectiveQueue, query, liveItem])

  // Calculate tracking info with accurate wait time
  const trackingInfo = useMemo(() => {
    if (!foundItem) return null

    const arrivedQueue = effectiveQueue.filter(q => q.arrived)
    const servingQueue = arrivedQueue.filter(q => q.status === 'serving')
    const completedQueue = arrivedQueue.filter(q => q.status === 'completed')

    // Use getQueueWaitInfo for accurate calculation based on procedure durations
    const waitInfo = getQueueWaitInfo(branchData, arrivedQueue as any, foundItem.id)

    return {
      item: foundItem,
      position: foundItem.status === 'waiting' ? waitInfo.position : null,
      waitingAhead: foundItem.status === 'waiting' ? waitInfo.aheadCount : null,
      totalWaiting: arrivedQueue.filter(q => q.status === 'waiting').length,
      estimatedWait: foundItem.status === 'waiting' ? waitInfo.estimatedWaitMinutes : 0,
      aheadDetails: waitInfo.aheadDetails,
      servingCount: servingQueue.length,
      completedCount: completedQueue.length,
    }
  }, [foundItem, effectiveQueue, branchData])

  const handleSearchWithInput = async (searchInput: string) => {
    if (!searchInput.trim()) return
    setIsLoading(true)
    const q = searchInput.trim()
    const today = new Date().toISOString().split('T')[0]
    
    // Try Supabase first
    if (useSupabase && currentClinic) {
      try {
        const clinicId = getClinicId(currentClinic as ClinicType)
        const sb = createClient()
        if (sb) {
          // Search by phone number, today only
          const { data, error } = await sb
            .from('queues')
            .select('*')
            .eq('clinic_id', clinicId)
            .eq('phone', q)
            .eq('queue_date', today)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle()
          if (data && !error) {
            setLiveItem({
              id: data.id, number: data.number, patientName: data.patient_name,
              phone: data.phone || '', procedure: data.procedure,
              procedureId: data.procedure_id || '', branchId: data.branch_id || '',
              bookingMode: data.booking_mode, assignedRoom: data.assigned_room || 0,
              assignedDoctor: data.assigned_doctor || '', status: data.status,
              time: data.time || '', bookedAt: data.booked_at,
              arrivalTime: data.arrival_time || '', arrived: data.arrived,
              arrivedAt: data.arrived_at || undefined,
              servingAt: data.serving_at ? new Date(data.serving_at).getTime() : undefined,
              completedAt: data.completed_at || undefined,
              totalDuration: data.total_duration || undefined,
              completedProcedures: [],
              queueDate: data.queue_date || today,
            } as QueueItem)
            setViewMode('result')
            setIsLoading(false)
            return
          }
        }
      } catch (e) {
        // Supabase table doesn't exist or query failed
        console.log('Supabase search failed')
      }
    }
    
    // Search in current queue
    const found = effectiveQueue.find(item => item.phone === q)
    setLiveItem(found || null)
    setViewMode(found ? 'result' : 'error')
    setIsLoading(false)
  }

  const handleSearch = () => handleSearchWithInput(query)

  // Watch for status changes and send notifications
  useEffect(() => {
    if (!foundItem || !notificationEnabled) return
    if (prevStatus === null) {
      setPrevStatus(foundItem.status)
      return
    }
    if (foundItem.status !== prevStatus) {
      if (foundItem.status === 'serving') {
        notifyQueueCalled(foundItem.number, foundItem.assignedRoom, foundItem.patientName)
      } else if (foundItem.status === 'completed') {
        notifyQueueCompleted(foundItem.number)
      }
      setPrevStatus(foundItem.status)
    }
  }, [foundItem, prevStatus, notificationEnabled, notifyQueueCalled, notifyQueueCompleted])

  // Auto-request permission if user hasn't decided
  useEffect(() => {
    if (permission === 'default' && viewMode === 'result') {
      // Don't auto-request — let user click the button
    }
  }, [permission, viewMode])

  const handleEnableNotification = async () => {
    const result = await requestPermission()
    if (result === 'granted') {
      setNotificationEnabled(true)
    }
  }

  const handleShare = () => {
    if (!foundItem) return
    const url = foundItem.phone
      ? `${window.location.origin}/track?phone=${encodeURIComponent(foundItem.phone)}`
      : `${window.location.origin}/track?id=${foundItem.number}`
    if (navigator.share) {
      navigator.share({ title: `ติดตามคิว ${foundItem.number}`, url })
    } else {
      navigator.clipboard.writeText(url)
    }
  }

  // Use clinic config from context or fallback
  const clinicCfg = config || clinicConfig.dental
  const accentColor = clinicCfg.color

  const timeString = currentTime.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Bangkok' }) + ' ICT'

  return (
    <div className="min-h-screen" style={{ background: `linear-gradient(135deg, ${accentColor}, ${accentColor}dd)` }}>
      {/* Header */}
      <div className="px-4 py-4 shadow-lg" style={{ backgroundColor: `${accentColor}ee` }}>
        <div className="max-w-md mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-white rounded-xl flex items-center justify-center">
              <span className="font-bold text-sm" style={{ color: accentColor }}>
                {clinicCfg.prefix || 'Q'}
              </span>
            </div>
            <div>
              <h1 className="text-white font-bold text-lg leading-tight">{clinicCfg.name}</h1>
              <p className="text-white/70 text-xs">ติดตามคิวของคุณ</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => { setViewMode('search'); setQuery(''); setLiveItem(null) }} className="p-2 bg-white/20 hover:bg-white/30 rounded-xl transition-colors">
              <Home className="w-5 h-5 text-white" />
            </button>
            {viewMode === 'result' && foundItem && (
              <button onClick={handleShare} className="p-2 bg-white/20 hover:bg-white/30 rounded-xl transition-colors">
                <Share2 className="w-5 h-5 text-white" />
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-md mx-auto px-4 py-6">
        {/* ═══ Search View ═══ */}
        {viewMode === 'search' && (
          <div className="space-y-6">
            <div className="text-center text-white">
              <div className="w-20 h-20 bg-white/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Stethoscope className="w-10 h-10 text-white" />
              </div>
              <h2 className="text-2xl font-bold mb-2">ตรวจสอบคิว</h2>
              <p className="text-white/70">ป้อนเบอร์โทรศัพท์ของคุณเพื่อตรวจสอบสถานะคิว</p>
            </div>

            <form onSubmit={(e) => { e.preventDefault(); handleSearch() }} className="space-y-3">
              <div>
                <input
                  type="tel"
                  value={query}
                  onChange={(e) => {
                    // Only allow digits, max 10
                    const val = e.target.value.replace(/[^0-9]/g, '').slice(0, 10)
                    setQuery(val)
                  }}
                  placeholder="เบอร์โทรศัพท์ 10 หลัก"
                  className="w-full px-5 py-4 text-lg rounded-2xl bg-white shadow-lg focus:outline-none focus:ring-4 focus:ring-white/30 text-center font-mono font-bold tracking-wider placeholder:text-gray-300 placeholder:font-normal"
                  autoFocus
                  inputMode="tel"
                  maxLength={10}
                  pattern="[0-9]{10}"
                />
                {query.length > 0 && query.length < 10 && (
                  <p className="text-white/60 text-xs text-center mt-1.5">กรอกหมายเลขโทรศัพท์ให้ครบ 10 หลัก ({query.length}/10)</p>
                )}
              </div>
              <button
                type="submit"
                disabled={!query.trim() || query.length !== 10}
                className={clsx(
                  'w-full py-4 rounded-2xl text-lg font-bold transition-all',
                  query.trim()
                    ? 'bg-white shadow-lg hover:shadow-xl active:scale-[0.98]'
                    : 'bg-white/30 text-white/60 cursor-not-allowed'
                )}
                style={query.trim() ? { color: accentColor } : {}}
              >
                ตรวจสอบสถานะ
              </button>
            </form>

            {/* Link to Queue Status Board */}
            <Link
              href={`/queue-status?clinic=${currentClinic || 'dental'}`}
              className="block w-full py-3 px-4 bg-white/15 hover:bg-white/25 rounded-2xl text-center text-white/90 hover:text-white font-medium text-sm transition-all backdrop-blur-sm border border-white/10"
            >
              <BarChart3 className="w-4 h-4 inline mr-1.5" />
              ดูสถานะคิวรวมและเวลาคาดการณ์
            </Link>

          </div>
        )}

        {/* ═══ Error View ═══ */}
        {viewMode === 'error' && (
          <div className="text-center text-white space-y-6">
            <div className="w-20 h-20 bg-white/20 rounded-2xl flex items-center justify-center mx-auto">
              <span className="text-4xl">🔍</span>
            </div>
            <div>
              <h2 className="text-xl font-bold mb-2">ไม่มีข้อมูลในระบบ</h2>
              <p className="text-white/70">ไม่พบเบอร์โทร "{query}" สำหรับวันนี้</p>
              <p className="text-white/50 text-sm mt-2">หากคุณมีคิวในวันนี้ กรุณาติดต่อเจ้าหน้าที่หน้าห้องตรวจ</p>
            </div>
            <button
              onClick={() => { setViewMode('search'); setQuery('') }}
              className="w-full py-4 bg-white text-gray-900 rounded-2xl font-bold shadow-lg hover:shadow-xl"
            >
              ลองใหม่
            </button>
          </div>
        )}

        {/* ═══ Result View ═══ */}
        {viewMode === 'result' && trackingInfo && (
          <div className="space-y-4">
            {/* Status Card */}
            <div className="bg-white rounded-3xl shadow-xl overflow-hidden">
              {/* Status Banner */}
              <div className="px-6 py-4 flex items-center justify-between" style={{ backgroundColor: accentColor }}>
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{clinicCfg.icon}</span>
                  <div>
                    <p className="text-white/80 text-xs">{clinicCfg.name}</p>
                    <p className="text-white font-bold text-sm">{timeString} น.</p>
                  </div>
                </div>
                <StatusBadge status={trackingInfo.item.status} />
              </div>

              {/* Queue Number */}
              <div className="px-6 py-8 text-center border-b border-gray-100">
                <p className="text-xs text-gray-500 uppercase tracking-wider mb-2">หมายเลขคิวของคุณ</p>
                <p className="text-6xl font-mono font-black tabular-nums leading-none" style={{ color: accentColor }}>
                  {trackingInfo.item.number}
                </p>
                <p className="text-gray-600 mt-3 text-lg">{trackingInfo.item.patientName}</p>
              </div>

              {/* Notification Permission */}
              {trackingInfo.item.status === 'waiting' && (
                <div className="px-6 py-3">
                  {permission === 'granted' ? (
                    <div className="flex items-center justify-center gap-2 py-3 bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-xl">
                      <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center">
                        <CheckCircle className="w-4 h-4 text-green-600" />
                      </div>
                      <div className="text-left">
                        <p className="text-sm font-bold text-green-700">🔔 การแจ้งเตือนเปิดอยู่</p>
                        <p className="text-xs text-green-600">จะแจ้งเตือนเมื่อถึงคิวของคุณ</p>
                      </div>
                    </div>
                  ) : (
                    <button
                      onClick={handleEnableNotification}
                      className="w-full flex items-center justify-center gap-3 py-4 bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600 text-white rounded-xl text-sm font-bold transition-all shadow-lg shadow-blue-500/20 active:scale-95"
                    >
                      <Bell className="w-5 h-5" />
                      <div className="text-left">
                        <p>เปิดการแจ้งเตือนเมื่อถึงคิว</p>
                        <p className="text-xs text-blue-100 font-normal">กดเพื่อรับการแจ้งเตือนผ่านเบราว์เซอร์</p>
                      </div>
                    </button>
                  )}
                </div>
              )}

              {/* Waiting Status */}
              {trackingInfo.item.status === 'waiting' && (
                <div className="px-6 py-5 space-y-4">
                  <InfoRow
                    icon={<Clock className="w-5 h-5 text-amber-500" />}
                    iconBg="bg-amber-50"
                    label="คิวก่อนหน้า"
                    value={`${trackingInfo.waitingAhead} คิว`}
                    valueColor="text-amber-600"
                  />
                  <InfoRow
                    icon={<Clock className="w-5 h-5" style={{ color: accentColor }} />}
                    iconBg="bg-gray-50"
                    label="เวลารอโดยประมาณ"
                    value={`~${trackingInfo.estimatedWait} นาที`}
                    valueColor="text-gray-900"
                  />
                  <InfoRow
                    icon={<Bell className="w-5 h-5 text-blue-500" />}
                    iconBg="bg-blue-50"
                    label="ลำดับคิว"
                    value={`${trackingInfo.position} / ${trackingInfo.totalWaiting}`}
                    valueColor="text-gray-900"
                  />
                  {/* Progress */}
                  <div>
                    <div className="flex justify-between text-xs text-gray-500 mb-1">
                      <span>ความคืบหน้า</span>
                      <span>{(() => {
                        const completed = trackingInfo.completedCount ?? 0
                        const waitingAhead = trackingInfo.waitingAhead ?? 0
                        const totalPeople = (trackingInfo.totalWaiting ?? 0) + completed
                        if (totalPeople === 0) return 100
                        const progress = Math.round(((completed + ((trackingInfo.totalWaiting ?? 0) - waitingAhead)) / totalPeople) * 100)
                        return Math.min(100, Math.max(0, progress))
                      })()}%</span>
                    </div>
                    <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full rounded-full transition-all duration-500" style={{
                        width: `${(() => {
                          const completed = trackingInfo.completedCount ?? 0
                          const waitingAhead = trackingInfo.waitingAhead ?? 0
                          const totalPeople = (trackingInfo.totalWaiting ?? 0) + completed
                          if (totalPeople === 0) return 100
                          const progress = ((completed + ((trackingInfo.totalWaiting ?? 0) - waitingAhead)) / totalPeople) * 100
                          return Math.min(100, Math.max(0, progress))
                        })()}%`,
                        backgroundColor: accentColor,
                      }} />
                    </div>
                    <p className="text-[10px] text-gray-400 mt-1">เสร็จแล้ว {trackingInfo.completedCount ?? 0} / {(trackingInfo.totalWaiting ?? 0) + (trackingInfo.completedCount ?? 0)} คน</p>
                  </div>
                </div>
              )}

              {/* Serving Status */}
              {trackingInfo.item.status === 'serving' && (
                <div className="px-6 py-8 text-center">
                  <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
                    <Stethoscope className="w-8 h-8 text-green-600" />
                  </div>
                  <p className="text-lg font-bold text-green-600 mb-1">กำลังให้บริการ</p>
                  <p className="text-gray-500">ห้อง {trackingInfo.item.assignedRoom}</p>
                </div>
              )}

              {/* Completed Status */}
              {trackingInfo.item.status === 'completed' && (
                <div className="px-6 py-8 text-center">
                  <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
                    <CheckCircle className="w-8 h-8 text-green-600" />
                  </div>
                  <p className="text-lg font-bold text-green-600 mb-1">✅ เสร็จสิ้นแล้ว</p>
                  <p className="text-gray-500">ทำการรักษาเสร็จเรียบร้อย</p>
                  {trackingInfo.item.totalDuration && (
                    <p className="text-sm text-gray-400 mt-2">ใช้เวลาทั้งหมด {trackingInfo.item.totalDuration} นาที</p>
                  )}
                  {trackingInfo.item.completedAt && (
                    <p className="text-sm text-gray-400">เสร็จเมื่อ {trackingInfo.item.completedAt}</p>
                  )}
                </div>
              )}
            </div>

            {/* Back to Search */}
            <button
              onClick={() => { setViewMode('search'); setQuery('') }}
              className="text-white/80 hover:text-white text-sm font-medium text-center w-full py-2"
            >
              ตรวจสอบคิวอื่น →
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

function StatusBadge({ status }: { status: QueueItem['status'] }) {
  const config: Record<string, { label: string; bg: string; icon: any }> = {
    waiting: { label: 'กำลังรอ', bg: 'bg-amber-500', icon: Clock },
    serving: { label: 'กำลังให้บริการ', bg: 'bg-green-500', icon: Stethoscope },
    completed: { label: 'เสร็จสิ้น', bg: 'bg-gray-500', icon: CheckCircle },
    cancelled: { label: 'ยกเลิกแล้ว', bg: 'bg-red-500', icon: X },
  }
  const c = config[status]
  return (
    <span className={clsx('inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold text-white', c.bg)}>
      <c.icon className="w-3 h-3" />
      {c.label}
    </span>
  )
}

function InfoRow({ icon, iconBg, label, value, valueColor }: {
  icon: React.ReactNode; iconBg: string; label: string; value: string; valueColor: string
}) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-3">
        <div className={clsx('w-10 h-10 rounded-xl flex items-center justify-center', iconBg)}>
          {icon}
        </div>
        <p className="text-sm text-gray-500">{label}</p>
      </div>
      <p className={clsx('text-lg font-bold', valueColor)}>{value}</p>
    </div>
  )
}
