'use client'

import { useState, useMemo, useCallback } from 'react'
import {
  Plus, Search, Clock, CheckCircle,
  Play, SkipForward, X, AlertTriangle,
  Smartphone, CalendarCheck, ScanLine, Filter, MapPin,
  UserCheck, Calendar, Trash2,
} from 'lucide-react'
import { clsx } from 'clsx'
import { useClinic } from '@/lib/clinic-context'
import { useQueue, type QueueItem, type BookingMode } from '@/lib/queue-context'
import { sendQueueCalledNotification, sendQueueCompletedNotification } from '@/lib/line-notification'
import Toast from '@/components/ui/Toast'

type StatusFilter = 'all' | 'waiting' | 'serving' | 'completed'

const bookingModeConfig: Record<BookingMode, { label: string; icon: React.ComponentType<{ className?: string }>; color: string; bg: string }> = {
  walkin: { label: 'Walk-in', icon: ScanLine, color: 'text-green-600', bg: 'bg-green-50' },
  remote: { label: 'ออนไลน์', icon: Smartphone, color: 'text-blue-600', bg: 'bg-blue-50' },
  appointment: { label: 'นัดหมาย', icon: CalendarCheck, color: 'text-purple-600', bg: 'bg-purple-50' },
}

export default function QueueManager() {
  const { config } = useClinic()
  const { queue, setQueue } = useQueue()

  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [modeFilter, setModeFilter] = useState<BookingMode | 'all'>('all')
  const [showFilters, setShowFilters] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null)

  const showToastMsg = useCallback((message: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToast({ message, type })
    setTimeout(() => setToast(null), 3000)
  }, [])

  // Stats
  const stats = useMemo(() => ({
    total: queue.length,
    arrived: queue.filter(q => q.arrived).length,
    upcoming: queue.filter(q => !q.arrived).length,
    waiting: queue.filter(q => q.status === 'waiting' && q.arrived).length,
    serving: queue.filter(q => q.status === 'serving').length,
    completed: queue.filter(q => q.status === 'completed').length,
  }), [queue])

  // Filtered queue
  const filteredQueue = useMemo(() => {
    return queue.filter(item => {
      if (statusFilter !== 'all' && item.status !== statusFilter) return false
      if (modeFilter !== 'all' && item.bookingMode !== modeFilter) return false
      if (searchQuery) {
        const q = searchQuery.toLowerCase()
        if (!item.patientName.toLowerCase().includes(q) && !item.number.toLowerCase().includes(q) && !item.procedure.toLowerCase().includes(q)) return false
      }
      return true
    })
  }, [queue, statusFilter, modeFilter, searchQuery])

  // Split filtered
  const arrivedFiltered = useMemo(() => filteredQueue.filter(q => q.arrived), [filteredQueue])
  const upcomingFiltered = useMemo(() => filteredQueue.filter(q => !q.arrived), [filteredQueue])

  const callQueue = async (id: string) => {
    const item = queue.find(q => q.id === id)
    if (!item) return
    setQueue(prev => prev.map(q => q.id === id ? { ...q, status: 'serving' as const, servingAt: Date.now() } : q))
    showToastMsg(`เรียก ${item.number} → ห้อง ${item.assignedRoom}`, 'success')
    
    // Send LINE notification
    if (item.phone) {
      try {
        await sendQueueCalledNotification(
          item.phone,
          item.number,
          item.patientName,
          item.assignedRoom,
          item.assignedDoctor
        )
      } catch (error) {
        console.error('Failed to send LINE notification:', error)
      }
    }
  }

  const completeQueue = async (id: string) => {
    const item = queue.find(q => q.id === id)
    setQueue(prev => prev.map(q => q.id === id ? { ...q, status: 'completed' as const } : q))
    showToastMsg('เสร็จสิ้น', 'success')
    
    // Send LINE notification
    if (item?.phone) {
      try {
        await sendQueueCompletedNotification(
          item.phone,
          item.number,
          item.patientName
        )
      } catch (error) {
        console.error('Failed to send LINE notification:', error)
      }
    }
  }

  const deleteQueue = (id: string) => {
    setQueue(prev => prev.filter(q => q.id !== id))
    setConfirmDelete(null)
    showToastMsg('ลบคิวแล้ว', 'info')
  }

  const handleMarkArrived = (id: string) => {
    // Simple mark arrived — set arrived=true and arrivedAt=now
    const now = new Date()
    const timeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`
    setQueue(prev => {
      const item = prev.find(q => q.id === id)
      if (!item) return prev
      const arrivedItem = { ...item, arrived: true, arrivedAt: timeStr }
      const arrived = prev.filter(q => q.arrived && q.id !== id)
      const upcoming = prev.filter(q => !q.arrived && q.id !== id)
      // Insert arrived item after last waiting item that has time <= arrivalTime
      const insertIdx = arrived.filter(q => q.status !== 'completed').length
      const active = arrived.filter(q => q.status !== 'completed')
      const completed = arrived.filter(q => q.status === 'completed')
      active.splice(insertIdx, 0, arrivedItem)
      return [...active, ...completed, ...upcoming]
    })
    showToastMsg('คนไข้มาถึงแล้ว', 'success')
  }

  if (!config) return null

  const hasActiveFilters = statusFilter !== 'all' || modeFilter !== 'all' || searchQuery !== ''

  return (
    <div className="space-y-4">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      {/* Delete Confirmation */}
      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center"><Trash2 className="w-5 h-5 text-red-500" /></div>
              <h3 className="text-lg font-bold text-gray-900">ยืนยันการลบ</h3>
            </div>
            <p className="text-gray-600 mb-6">ต้องการลบคิวนี้ออกจากระบบ?</p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setConfirmDelete(null)} className="px-4 py-2 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-100">ยกเลิก</button>
              <button onClick={() => deleteQueue(confirmDelete)} className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 font-medium text-sm">ลบ</button>
            </div>
          </div>
        </div>
      )}

      {/* ═══ HEADER ═══ */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900">🎫 จัดการคิว</h1>
          <p className="text-sm text-gray-500">{config.name} — ข้อมูลเดียวกับ Dashboard</p>
        </div>
        <div className="flex items-center gap-3 text-sm">
          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-50 rounded-lg">
            <span className="text-gray-400">ทั้งหมด</span>
            <span className="font-bold text-gray-900">{stats.total}</span>
          </div>
          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-yellow-50 rounded-lg">
            <span className="text-yellow-500">●</span>
            <span className="font-bold text-yellow-600">{stats.waiting}</span>
          </div>
          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-green-50 rounded-lg">
            <span className="text-green-500">●</span>
            <span className="font-bold text-green-600">{stats.serving}</span>
          </div>
          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 rounded-lg">
            <span className="text-gray-400">✓</span>
            <span className="font-bold text-gray-500">{stats.completed}</span>
          </div>
        </div>
      </div>

      {/* ═══ SEARCH + FILTER ═══ */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="flex items-center gap-3">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="ค้นหาชื่อ, หมายเลขอิว, หรือหัตถการ..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2.5 rounded-lg border border-gray-200 focus:border-primary-400 focus:outline-none text-sm"
            />
          </div>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={clsx(
              'flex items-center gap-1.5 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
              showFilters || hasActiveFilters ? 'bg-primary-50 text-primary-600 border border-primary-200' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            )}>
            <Filter className="w-4 h-4" />
            ตัวกรอง
            {hasActiveFilters && <span className="w-1.5 h-1.5 rounded-full bg-primary-500" />}
          </button>
        </div>

        {showFilters && (
          <div className="mt-3 pt-3 border-t border-gray-100 space-y-2">
            {/* Status */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500 w-16">สถานะ:</span>
              <div className="flex gap-1">
                {([
                  ['all', 'ทั้งหมด'],
                  ['waiting', 'รอเรียก'],
                  ['serving', 'กำลังทำ'],
                  ['completed', 'เสร็จแล้ว'],
                ] as [StatusFilter, string][]).map(([key, label]) => (
                  <button key={key} onClick={() => setStatusFilter(key)}
                    className={clsx('px-2.5 py-1 rounded-lg text-xs font-medium transition-colors',
                      statusFilter === key ? 'text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200')}
                    style={statusFilter === key ? { backgroundColor: config.color } : {}}>
                    {label}
                  </button>
                ))}
              </div>
            </div>
            {/* Mode */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500 w-16">ประเภท:</span>
              <div className="flex gap-1">
                <button onClick={() => setModeFilter('all')}
                  className={clsx('px-2.5 py-1 rounded-lg text-xs font-medium transition-colors',
                    modeFilter === 'all' ? 'text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200')}
                  style={modeFilter === 'all' ? { backgroundColor: config.color } : {}}>
                  ทั้งหมด
                </button>
                {(Object.entries(bookingModeConfig) as [BookingMode, typeof bookingModeConfig[BookingMode]][]).map(([mode, cfg]) => (
                  <button key={mode} onClick={() => setModeFilter(mode)}
                    className={clsx('flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium transition-colors',
                      modeFilter === mode ? 'text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200')}
                    style={modeFilter === mode ? { backgroundColor: config.color } : {}}>
                    <cfg.icon className="w-3 h-3" /> {cfg.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ═══ TABLE: ARRIVED ═══ */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-4 py-3 bg-gray-50 border-b border-gray-200 flex items-center gap-2">
          <UserCheck className="w-4 h-4 text-green-500" />
          <h2 className="text-sm font-bold text-gray-900">คนไข้มาถึงแล้ว ({arrivedFiltered.length})</h2>
        </div>

        {arrivedFiltered.length === 0 ? (
          <div className="px-4 py-8 text-center text-gray-400 text-sm">ไม่มีข้อมูล</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-left">
                  <th className="px-4 py-2.5 text-xs font-medium text-gray-500 w-20">คิว</th>
                  <th className="px-4 py-2.5 text-xs font-medium text-gray-500">ชื่อผู้รับบริการ</th>
                  <th className="px-4 py-2.5 text-xs font-medium text-gray-500 hidden sm:table-cell">ประเภท</th>
                  <th className="px-4 py-2.5 text-xs font-medium text-gray-500 hidden md:table-cell">หัตถการ</th>
                  <th className="px-4 py-2.5 text-xs font-medium text-gray-500 hidden lg:table-cell">ห้อง</th>
                  <th className="px-4 py-2.5 text-xs font-medium text-gray-500 hidden lg:table-cell">แพทย์</th>
                  <th className="px-4 py-2.5 text-xs font-medium text-gray-500 text-center">สถานะ</th>
                  <th className="px-4 py-2.5 text-xs font-medium text-gray-500 text-right w-32">จัดการ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {arrivedFiltered.map(item => {
                  const modeCfg = bookingModeConfig[item.bookingMode]
                  const ModeIcon = modeCfg.icon
                  return (
                    <tr key={item.id} className="hover:bg-gray-50/50 transition-colors">
                      {/* คิว */}
                      <td className="px-4 py-2.5">
                        <div className="w-12 h-10 rounded-lg flex flex-col items-center justify-center font-bold"
                          style={{
                            backgroundColor: item.status === 'serving' ? config.color : item.status === 'waiting' ? `${config.color}15` : '#F1F5F9',
                            color: item.status === 'completed' ? '#94A3B8' : item.status === 'waiting' ? config.color : '#FFF',
                          }}>
                          <span className="text-xs leading-none">{item.number.charAt(0)}</span>
                          <span className="text-[9px]">{item.number.slice(1)}</span>
                        </div>
                      </td>
                      {/* ชื่อ */}
                      <td className="px-4 py-2.5">
                        <p className="font-medium text-gray-900 truncate">{item.patientName}</p>
                        <p className="text-[11px] text-gray-400 mt-0.5">{item.phone}</p>
                      </td>
                      {/* ประเภท */}
                      <td className="px-4 py-2.5 hidden sm:table-cell">
                        <span className={clsx('inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium', modeCfg.bg, modeCfg.color)}>
                          <ModeIcon className="w-3 h-3" /> {modeCfg.label}
                        </span>
                        {item.arrivedAt && item.bookingMode !== 'walkin' && (
                          <p className="text-[10px] text-green-600 mt-0.5">มาถึง {item.arrivedAt}</p>
                        )}
                      </td>
                      {/* หัตถการ */}
                      <td className="px-4 py-2.5 hidden md:table-cell">
                        <p className="text-gray-700 truncate">{item.procedure}</p>
                      </td>
                      {/* ห้อง */}
                      <td className="px-4 py-2.5 hidden lg:table-cell">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-gray-100 text-gray-600 text-xs">
                          🏥 {item.assignedRoom}
                        </span>
                      </td>
                      {/* แพทย์ */}
                      <td className="px-4 py-2.5 hidden lg:table-cell">
                        <span className="text-xs text-gray-600">{item.assignedDoctor}</span>
                      </td>
                      {/* สถานะ */}
                      <td className="px-4 py-2.5 text-center">
                        {item.status === 'serving' ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-green-100 text-green-700">
                            🔄 กำลังทำ
                          </span>
                        ) : item.status === 'waiting' ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-yellow-100 text-yellow-700">
                            ⏳ รอเรียก
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-gray-100 text-gray-500">
                            ✓ เสร็จ
                          </span>
                        )}
                      </td>
                      {/* จัดการ */}
                      <td className="px-4 py-2.5 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <span className="text-[10px] text-gray-400 font-mono mr-1">{item.time}</span>
                          {item.status === 'waiting' ? (
                            <>
                              <button onClick={() => callQueue(item.id)}
                                className="p-1.5 rounded-lg text-white hover:opacity-90 transition-colors"
                                style={{ backgroundColor: config.color }} title="เรียก">
                                <Play className="w-3 h-3" />
                              </button>
                              <button onClick={() => {
                                setQueue(prev => {
                                  const qi = prev.find(q => q.id === item.id)
                                  if (!qi) return prev
                                  return [...prev.filter(q => q.id !== item.id), qi]
                                })
                              }}
                                className="p-1.5 rounded-lg bg-gray-100 text-gray-500 hover:bg-gray-200 transition-colors" title="ข้าม">
                                <SkipForward className="w-3 h-3" />
                              </button>
                            </>
                          ) : item.status === 'serving' ? (
                            <span className="text-[10px] px-2 py-1 text-green-600 font-medium">กำลังทำ...</span>
                          ) : (
                            <span className="text-[10px] text-gray-300">✓</span>
                          )}
                          <button onClick={() => setConfirmDelete(item.id)}
                            className="p-1.5 rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors" title="ลบ">
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ═══ TABLE: UPCOMING ═══ */}
      {upcomingFiltered.length > 0 && (
        <div className="bg-white rounded-xl border border-purple-200 overflow-hidden">
          <div className="px-4 py-3 bg-purple-50/50 border-b border-purple-100 flex items-center gap-2">
            <Calendar className="w-4 h-4 text-purple-500" />
            <h2 className="text-sm font-bold text-purple-900">คิวนัดที่ยังไม่มาถึง ({upcomingFiltered.length})</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-left">
                  <th className="px-4 py-2.5 text-xs font-medium text-gray-500 w-20">คิว</th>
                  <th className="px-4 py-2.5 text-xs font-medium text-gray-500">ชื่อผู้รับบริการ</th>
                  <th className="px-4 py-2.5 text-xs font-medium text-gray-500 hidden sm:table-cell">ประเภท</th>
                  <th className="px-4 py-2.5 text-xs font-medium text-gray-500 hidden md:table-cell">หัตถการ</th>
                  <th className="px-4 py-2.5 text-xs font-medium text-gray-500 hidden lg:table-cell">ห้อง</th>
                  <th className="px-4 py-2.5 text-xs font-medium text-gray-500 hidden lg:table-cell">แพทย์</th>
                  <th className="px-4 py-2.5 text-xs font-medium text-gray-500 text-center">ถึงเวลา</th>
                  <th className="px-4 py-2.5 text-xs font-medium text-gray-500 text-right w-32">จัดการ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {upcomingFiltered.map(item => {
                  const modeCfg = bookingModeConfig[item.bookingMode]
                  const ModeIcon = modeCfg.icon
                  return (
                    <tr key={item.id} className="hover:bg-purple-50/30 transition-colors">
                      <td className="px-4 py-2.5">
                        <div className="w-12 h-10 rounded-lg flex flex-col items-center justify-center font-bold bg-purple-50 text-purple-600">
                          <span className="text-xs leading-none">{item.number.charAt(0)}</span>
                          <span className="text-[9px]">{item.number.slice(1)}</span>
                        </div>
                      </td>
                      <td className="px-4 py-2.5">
                        <p className="font-medium text-gray-900 truncate">{item.patientName}</p>
                        <p className="text-[11px] text-gray-400 mt-0.5">{item.phone}</p>
                      </td>
                      <td className="px-4 py-2.5 hidden sm:table-cell">
                        <span className={clsx('inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium', modeCfg.bg, modeCfg.color)}>
                          <ModeIcon className="w-3 h-3" /> {modeCfg.label}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 hidden md:table-cell">
                        <p className="text-gray-700 truncate">{item.procedure}</p>
                      </td>
                      <td className="px-4 py-2.5 hidden lg:table-cell">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-gray-100 text-gray-600 text-xs">
                          🏥 {item.assignedRoom}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 hidden lg:table-cell">
                        <span className="text-xs text-gray-600">{item.assignedDoctor}</span>
                      </td>
                      <td className="px-4 py-2.5 text-center">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-purple-100 text-purple-700">
                          🕐 {item.arrivalTime}
                        </span>
                        <p className="text-[10px] text-gray-400 mt-0.5">จอง {item.bookedAt}</p>
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button onClick={() => handleMarkArrived(item.id)}
                            className="px-2.5 py-1 bg-blue-500 text-white rounded-lg text-[10px] font-medium hover:bg-blue-600 transition-colors flex items-center gap-1">
                            <MapPin className="w-3 h-3" /> มาถึงแล้ว
                          </button>
                          <button onClick={() => setConfirmDelete(item.id)}
                            className="p-1.5 rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors" title="ลบ">
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
