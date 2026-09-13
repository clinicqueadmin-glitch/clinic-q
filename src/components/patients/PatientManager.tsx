'use client'

import { useState, useMemo, useCallback, useEffect } from 'react'
import { Plus, Search, Edit, Trash2, Eye, X, Phone, User, PhoneCall, Filter, Clock, Stethoscope, FileText, Calendar, ChevronLeft, ChevronRight } from 'lucide-react'
import { clsx } from 'clsx'
import { useClinic } from '@/lib/clinic-context'
import { useQueue, type QueueItem } from '@/lib/queue-context'
import { analyticsDateRange, type AnalyticsPeriod } from '@/lib/analytics-range'
import { fetchClinicQueueRange } from '@/lib/analytics-queue'
import { getTodayICT } from '@/lib/ict-date'
import Toast from '@/components/ui/Toast'
import PhoneInput from '@/components/ui/PhoneInput'

interface PatientRecord {
  phone: string
  name: string
  visits: VisitRecord[]
}

interface VisitRecord {
  date: string
  practitioner: string
  procedure: string
  duration?: number
  queueNumber: string
}

/** Calculate months since a given date */
function monthsSince(dateStr: string): number {
  const d = new Date(dateStr)
  const now = new Date()
  return (now.getFullYear() - d.getFullYear()) * 12 + (now.getMonth() - d.getMonth())
}

/** Check if patient needs recall (>6 months since last visit) */
function needsRecall(lastVisit: string): boolean {
  return monthsSince(lastVisit) >= 6
}

/** Format the months since last visit for display */
function formatMonthsAgo(lastVisit: string): string {
  const m = monthsSince(lastVisit)
  if (m < 1) return 'เดือนนี้'
  if (m < 12) return `${m} เดือนที่แล้ว`
  const y = Math.floor(m / 12)
  const rem = m % 12
  return rem > 0 ? `${y} ปี ${rem} เดือนที่แล้ว` : `${y} ปีที่แล้ว`
}

/** Format date for display */
function formatDate(dateStr: string): string {
  if (!dateStr) return '—'
  try {
    // Handle time-only strings like '14:30'
    if (/^\d{1,2}:\d{2}$/.test(dateStr)) return dateStr
    const d = new Date(dateStr)
    if (isNaN(d.getTime())) return dateStr // Invalid date, return as-is
    return d.toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' })
  } catch {
    return dateStr
  }
}

/** Stable empty list so the period memo deps do not churn on every render. */
const EMPTY_QUEUE: QueueItem[] = []

export default function PatientManager() {
  const { config, clinicName, clinicId } = useClinic()
  const { queue } = useQueue()
  const [searchQuery, setSearchQuery] = useState('')
  const [filterMode, setFilterMode] = useState<'all' | 'recall'>('all')
  const [timeFilter, setTimeFilter] = useState<AnalyticsPeriod>('month')
  const [selectedDate, setSelectedDate] = useState(new Date())
  const [selectedWeekStart, setSelectedWeekStart] = useState(() => {
    const d = new Date(); const day = d.getDay(); const diff = d.getDate() - day + (day === 0 ? -6 : 1); d.setDate(diff); d.setHours(0, 0, 0, 0); return d
  })
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth())
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear())
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null)
  const [showViewModal, setShowViewModal] = useState<string | null>(null)
  const [showEditModal, setShowEditModal] = useState<string | null>(null)
  const [showAddModal, setShowAddModal] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  const [editForm, setEditForm] = useState({ name: '', phone: '' })

  const showToastMsg = useCallback((message: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToast({ message, type })
    setTimeout(() => setToast(null), 3000)
  }, [])

  // ═══ Selected period → an inclusive queue_date range (ICT business dates) ═══
  // The live queue context only ever holds today, which is why a patient's past
  // visits disappeared from this screen. Every other period is fetched for its own
  // date range — the same range math and row mapper Analytics uses — always scoped
  // to this clinic.
  const range = useMemo(
    () => analyticsDateRange(timeFilter, {
      date: selectedDate,
      weekStart: selectedWeekStart,
      month: selectedMonth,
      year: selectedYear,
    }),
    [timeFilter, selectedDate, selectedWeekStart, selectedMonth, selectedYear],
  )
  const isLiveToday = range.start === range.end && range.start === getTodayICT()
  const today = new Date()

  const [rangeQueue, setRangeQueue] = useState<QueueItem[] | null>(null)
  const [rangeError, setRangeError] = useState<string | null>(null)

  // Today keeps using the live queue context (it polls and is already scoped to
  // this clinic). Any other period is read from Supabase for its own dates.
  useEffect(() => {
    if (isLiveToday || !clinicId) {
      setRangeQueue(null)
      setRangeError(null)
      return
    }
    let cancelled = false
    setRangeError(null)
    fetchClinicQueueRange(clinicId, range)
      .then(rows => { if (!cancelled) setRangeQueue(rows) })
      .catch((e: unknown) => {
        if (cancelled) return
        // A failed load must never look like "no patients ever visited".
        setRangeQueue(EMPTY_QUEUE)
        setRangeError(e instanceof Error ? e.message : 'โหลดข้อมูลไม่สำเร็จ')
      })
    return () => { cancelled = true }
  }, [clinicId, range, isLiveToday])

  // Without a verified clinic identity there is nothing to show — never a cached
  // queue that may belong to another clinic.
  const effectiveQueue = !clinicId
    ? EMPTY_QUEUE
    : isLiveToday
      ? queue
      : (rangeQueue ?? EMPTY_QUEUE)

  const periodNotice = !clinicId
    ? 'ไม่พบคลินิกที่กำลังใช้งาน — จึงยังแสดงประวัติผู้รับบริการไม่ได้'
    : rangeError
      ? `โหลดประวัติช่วงเวลานี้ไม่สำเร็จ: ${rangeError}`
      : !isLiveToday && rangeQueue === null
        ? 'กำลังโหลดประวัติผู้รับบริการ…'
        : null

  const periodLabel = useMemo(() => {
    // Anchored to ICT so the label names the same business dates the query asks for.
    const moment = { timeZone: 'Asia/Bangkok' } as const
    if (timeFilter === 'day') {
      if (isLiveToday) return 'ข้อมูลจากคิววันนี้'
      return `ข้อมูลวันที่ ${selectedDate.toLocaleDateString('th-TH', { ...moment, day: 'numeric', month: 'short', year: 'numeric' })}`
    }
    if (timeFilter === 'week') {
      const weekEnd = new Date(selectedWeekStart); weekEnd.setDate(weekEnd.getDate() + 6)
      return `ข้อมูลสัปดาห์ ${selectedWeekStart.toLocaleDateString('th-TH', { ...moment, day: 'numeric', month: 'short' })} - ${weekEnd.toLocaleDateString('th-TH', { ...moment, day: 'numeric', month: 'short' })}`
    }
    if (timeFilter === 'month') return `ข้อมูลเดือน${new Date(selectedYear, selectedMonth).toLocaleDateString('th-TH', { ...moment, month: 'long', year: 'numeric' })}`
    return `ข้อมูลปี ${selectedYear + 543}`
  }, [timeFilter, isLiveToday, selectedDate, selectedWeekStart, selectedMonth, selectedYear])

  const navigateDate = (dir: number) => {
    if (timeFilter === 'day') { const d = new Date(selectedDate); d.setDate(d.getDate() + dir); setSelectedDate(d) }
    else if (timeFilter === 'week') { const d = new Date(selectedWeekStart); d.setDate(d.getDate() + dir * 7); setSelectedWeekStart(d) }
    else if (timeFilter === 'month') { setSelectedMonth(prev => prev + dir) }
    else { setSelectedYear(prev => prev + dir) }
  }

  // Build patient list from the selected period's data (grouped by phone)
  const patients = useMemo(() => {
    const patientMap = new Map<string, PatientRecord>()

    effectiveQueue.forEach(item => {
      if (!item.phone || item.phone.length < 9) return
      
      const existing = patientMap.get(item.phone)
      // The service date the server assigned to this row is authoritative; the
      // booking timestamps come next, and today's ICT date is only a last resort.
      const visitDate = item.queueDate
        || item.appointmentDate
        || item.bookedAt
        || item.arrivalTime?.split('T')[0]
        || getTodayICT()
      const visit: VisitRecord = {
        date: visitDate,
        practitioner: item.assignedDoctor || 'ไม่ระบุ',
        procedure: item.procedure || item.completedProcedures?.map(p => p.name).join(', ') || 'ไม่ระบุ',
        duration: item.totalDuration,
        queueNumber: item.number,
      }

      if (existing) {
        // Update name if we have a better one
        if (item.patientName && item.patientName !== 'ไม่ระบุ' && (existing.name === 'ไม่ระบุ' || existing.name === '')) {
          existing.name = item.patientName
        }
        existing.visits.push(visit)
      } else {
        patientMap.set(item.phone, {
          phone: item.phone,
          name: item.patientName || 'ไม่ระบุ',
          visits: [visit],
        })
      }
    })

    // Sort visits by date (newest first)
    patientMap.forEach(patient => {
      patient.visits.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    })

    return Array.from(patientMap.values())
  }, [effectiveQueue])

  const filteredPatients = useMemo(() => {
    return patients.filter(patient => {
      const matchesSearch = patient.name.includes(searchQuery) || patient.phone.includes(searchQuery)
      if (filterMode === 'recall') {
        if (patient.visits.length === 0) return matchesSearch
        const lastVisit = patient.visits[0].date
        return matchesSearch && needsRecall(lastVisit)
      }
      return matchesSearch
    })
  }, [patients, searchQuery, filterMode])

  const recallCount = useMemo(() => {
    return patients.filter(p => {
      if (p.visits.length === 0) return true
      return needsRecall(p.visits[0].date)
    }).length
  }, [patients])

  const viewingPatient = showViewModal ? patients.find(p => p.phone === showViewModal) : null

  if (!config) return null

  return (
    <div className="space-y-6">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      {/* View Modal */}
      {viewingPatient && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-gray-100">
              <h2 className="text-xl font-bold text-gray-900">ข้อมูลผู้รับบริการ</h2>
              <button onClick={() => setShowViewModal(null)} className="p-2 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5 text-gray-500" /></button>
            </div>
            <div className="p-6 space-y-6">
              {/* Patient Info Card */}
              <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-xl">
                <div className="w-16 h-16 rounded-full bg-blue-100 flex items-center justify-center text-blue-600">
                  <User className="w-8 h-8" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-gray-900">{viewingPatient.name}</h3>
                  <a href={`tel:${viewingPatient.phone}`} className="flex items-center gap-1 text-blue-600 hover:text-blue-800 hover:underline">
                    <Phone className="w-4 h-4" />
                    {viewingPatient.phone}
                  </a>
                  <p className="text-xs text-gray-400 mt-1">เข้ารับบริการ {viewingPatient.visits.length} ครั้ง</p>
                  {viewingPatient.visits.length > 0 && (
                    <p className="text-xs text-blue-600 mt-0.5">📅 มารับบริการล่าสุด: {formatDate(viewingPatient.visits[0].date)}</p>
                  )}
                </div>
              </div>

              {/* Service History */}
              <div>
                <h4 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                  <FileText className="w-5 h-5 text-gray-500" />
                  ประวัติการมาใช้บริการ ({viewingPatient.visits.length} ครั้ง)
                </h4>
                
                {viewingPatient.visits.length === 0 ? (
                  <div className="text-center py-8 text-gray-400 border-2 border-dashed border-gray-200 rounded-xl">
                    <Stethoscope className="w-8 h-8 mx-auto mb-2 opacity-30" />
                    <p>ยังไม่มีประวัติการเข้ารับบริการ</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {viewingPatient.visits.map((record, idx) => (
                      <div key={idx} className="flex items-start gap-3 p-3 bg-white border border-gray-200 rounded-xl hover:bg-gray-50">
                        <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center flex-shrink-0">
                          <Calendar className="w-5 h-5 text-blue-600" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-bold text-gray-900">{formatDate(record.date)}</span>
                            <span className="text-xs text-gray-400">{record.queueNumber}</span>
                            {record.duration && (
                              <span className="text-xs text-gray-500 flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                {record.duration} นาที
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-gray-600 mt-0.5">
                            <span className="text-gray-500">หัตถการ:</span>{' '}
                            <span className="font-medium">{record.procedure}</span>
                          </p>
                          <p className="text-sm text-gray-600">
                            <span className="text-gray-500">ผู้ทำหัตถการ:</span>{' '}
                            <span className="font-medium">👨‍⚕️ {record.practitioner}</span>
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Recall Warning */}
              {viewingPatient.visits.length > 0 && needsRecall(viewingPatient.visits[0].date) && (
                <div className="flex items-center gap-3 p-3 bg-amber-50 border border-amber-200 rounded-xl">
                  <PhoneCall className="w-5 h-5 text-amber-500 flex-shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-amber-700">ควรโทร Recall</p>
                    <p className="text-xs text-amber-600">
                      ไม่ได้มาใช้บริการมากกว่า {monthsSince(viewingPatient.visits[0].date)} เดือน — แนะนำให้โทรนัด
                    </p>
                  </div>
                </div>
              )}
            </div>
            <div className="flex justify-end p-6 border-t border-gray-100">
              <button onClick={() => setShowViewModal(null)} className="px-4 py-2 rounded-lg text-sm font-medium text-gray-600 bg-gray-100 hover:bg-gray-200">ปิด</button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation */}
      {confirmDelete && (() => {
        const p = patients.find(pt => pt.phone === confirmDelete)
        if (!p) return null
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center"><Trash2 className="w-5 h-5 text-red-500" /></div>
                <h3 className="text-lg font-bold text-gray-900">ยืนยันการลบ</h3>
              </div>
              <p className="text-gray-600 mb-6">ต้องการลบข้อมูล <strong>{p.name}</strong> ({p.phone}) ใช่หรือไม่?</p>
              <div className="flex justify-end gap-3">
                <button onClick={() => setConfirmDelete(null)} className="px-4 py-2 rounded-lg text-sm font-medium text-gray-600 bg-gray-100 hover:bg-gray-200">ยกเลิก</button>
                <button onClick={() => { showToastMsg('ลบผู้รับบริการแล้ว', 'info'); setConfirmDelete(null) }} className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 font-medium">ลบ</button>
              </div>
            </div>
          </div>
        )
      })()}

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white font-bold text-sm" style={{ backgroundColor: config.color }}>{config.prefix}</div>
            <h1 className="text-2xl md:text-3xl font-bold text-gray-900">ผู้รับบริการ</h1>
          </div>
          <p className="text-gray-500">{clinicName || 'คลินิก'} — {periodLabel}</p>
          {periodNotice && (
            <p className={clsx('text-xs mt-1 font-medium', rangeError ? 'text-amber-600' : 'text-gray-400')}>
              {periodNotice}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <div className="flex bg-black/[0.04] rounded-2xl p-1">
            {(['day', 'week', 'month', 'year'] as AnalyticsPeriod[]).map(tf => (
              <button key={tf} onClick={() => setTimeFilter(tf)} className={clsx('px-3 py-1.5 rounded-lg text-xs font-medium transition-all', timeFilter === tf ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700')}>
                {tf === 'day' ? 'วัน' : tf === 'week' ? 'สัปดาห์' : tf === 'month' ? 'เดือน' : 'ปี'}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-1">
            <button onClick={() => navigateDate(-1)} className="p-1.5 rounded-lg hover:bg-gray-100" title="ช่วงก่อนหน้า"><ChevronLeft className="w-4 h-4 text-gray-500" /></button>
            <button onClick={() => { setSelectedDate(new Date()); setSelectedWeekStart(() => { const d = new Date(); const day = d.getDay(); const diff = d.getDate() - day + (day === 0 ? -6 : 1); d.setDate(diff); d.setHours(0, 0, 0, 0); return d }); setSelectedMonth(today.getMonth()); setSelectedYear(today.getFullYear()) }} className="px-3 py-1.5 rounded-lg bg-gray-100 text-xs font-medium text-gray-700 hover:bg-gray-200">วันนี้</button>
            <button onClick={() => navigateDate(1)} className="p-1.5 rounded-lg hover:bg-gray-100" title="ช่วงถัดไป"><ChevronRight className="w-4 h-4 text-gray-500" /></button>
          </div>
        </div>
      </div>

      {/* Search & Filter */}
      <div className="card p-4">
        <div className="flex flex-col md:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input type="text" placeholder="ค้นหาชื่อ หรือ เบอร์โทร..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-300 text-sm" />
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setFilterMode('all')}
              className={clsx(
                'px-4 py-2 rounded-lg text-sm font-medium transition-colors',
                filterMode === 'all' ? 'text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              )}
              style={filterMode === 'all' ? { backgroundColor: config.color } : {}}
            >
              ทั้งหมด ({patients.length})
            </button>
            <button
              onClick={() => setFilterMode('recall')}
              title={`นับจากผู้รับบริการในช่วงเวลาที่เลือก (${periodLabel})`}
              className={clsx(
                'px-4 py-2 rounded-lg text-sm font-medium transition-colors',
                filterMode === 'recall' ? 'bg-amber-500 text-white' : 'bg-amber-50 text-amber-700 hover:bg-amber-100'
              )}
            >
              ควร Recall ({recallCount})
            </button>
          </div>
        </div>
      </div>

      {/* Patient List */}
      <div className="space-y-3">
        {filteredPatients.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            <User className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p className="text-lg">ไม่พบผู้รับบริการในช่วงเวลานี้</p>
            <p className="text-sm mt-1">
              {searchQuery
                ? 'ลองล้างคำค้นหา หรือเลือกช่วงเวลาอื่น'
                : 'ลองเลือก “สัปดาห์ / เดือน / ปี” เพื่อดูประวัติย้อนหลัง — ข้อมูลจะถูกบันทึกอัตโนมัติเมื่อมีคนไข้เข้าคิว'}
            </p>
          </div>
        ) : (
          filteredPatients.map((patient) => {
            const lastVisit = patient.visits.length > 0 ? patient.visits[0].date : null
            const totalVisits = patient.visits.length
            const isRecallNeeded = lastVisit ? needsRecall(lastVisit) : true

            return (
              <div key={patient.phone} className="card p-4 hover:shadow-md transition-shadow">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className={clsx('w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0', isRecallNeeded ? 'bg-amber-100 text-amber-600' : 'bg-blue-100 text-blue-600')}>
                      <User className="w-6 h-6" />
                    </div>
                    <div className="min-w-0">
                      <h3 className="font-bold text-gray-900 truncate">{patient.name}</h3>
                      <div className="flex items-center gap-2 text-sm text-gray-500">
                        <a href={`tel:${patient.phone}`} className="flex items-center gap-1 text-blue-600 hover:text-blue-800 hover:underline">
                          <Phone className="w-3 h-3" />
                          {patient.phone}
                        </a>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-gray-400 mt-1">
                        <span>{totalVisits} ครั้ง</span>
                        {lastVisit && <span>ล่าสุด: {formatDate(lastVisit)} ({formatMonthsAgo(lastVisit)})</span>}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button onClick={() => setShowViewModal(patient.phone)} className="p-2 hover:bg-gray-100 rounded-lg" title="ดูข้อมูล">
                      <Eye className="w-4 h-4 text-gray-500" />
                    </button>
                    <button onClick={() => setConfirmDelete(patient.phone)} className="p-2 hover:bg-red-50 rounded-lg" title="ลบ">
                      <Trash2 className="w-4 h-4 text-gray-400 hover:text-red-500" />
                    </button>
                  </div>
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
