'use client'

import { useMemo, useState } from 'react'
import { clsx } from 'clsx'
import {
  ChevronLeft, ChevronRight, ArrowLeft, ChevronDown, ChevronUp,
} from 'lucide-react'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend } from 'recharts'
import { useQueue, type QueueItem, type DifficultyLevel, type CompletedProcedure } from '@/lib/queue-context'
import { useClinic } from '@/lib/clinic-context'
import { getDefaultBranchData, type ClinicBranchData, type Procedure } from '@/lib/branch-data'

type TimeFilter = 'day' | 'week' | 'month' | 'year'
type DrillView = 'overview' | 'practitioner'

const bookingConfig: Record<string, { label: string; emoji: string; color: string }> = {
  walkin:      { label: 'Walk-in', emoji: '🚶', color: '#22C55E' },
  remote:      { label: 'ออนไลน์', emoji: '📱', color: '#3B82F6' },
  appointment: { label: 'นัดหมาย',  emoji: '📅', color: '#A855F7' },
}

const docColors = ['#93C5FD', '#A7F3D0', '#FCD34D', '#FDA4AF', '#D8B4FE', '#C4B5FD']

interface PractitionerDetail {
  name: string
  color: string
  totalPatients: number
  completedPatients: number
  cancelledPatients: number
  servingPatients: number
  waitingPatients: number
  totalTime: number
  avgTime: number
  procedures: { name: string; count: number; totalTime: number; avgTime: number }[]
  hourlyLoad: { hour: string; count: number }[]
  efficiency: number
  patients: QueueItem[]
}

/* ═══════ Drill-down for individual practitioner ═══════ */
function PractitionerDrillDown({ doc, onBack, branchData }: { doc: PractitionerDetail; onBack: () => void; branchData: ClinicBranchData }) {
  const [expandedStep, setExpandedStep] = useState<number | null>(1)
  const toggleStep = (n: number) => setExpandedStep(prev => prev === n ? null : n)

  const maxProcCount = doc.procedures.length > 0 ? Math.max(...doc.procedures.map(p => p.count)) : 1
  const maxHourCount = doc.hourlyLoad.length > 0 ? Math.max(...doc.hourlyLoad.map(h => h.count)) : 1

  // Get standard time for each procedure from branch data
  const getStandardTime = (procName: string): number => {
    for (const branch of branchData.branches) {
      const proc = branch.procedures.find(p => p.name === procName)
      if (proc) return proc.estimatedDuration
    }
    return 30 // default
  }

  // Prepare procedure comparison data
  const procComparisonData = doc.procedures.map(p => ({
    name: p.name,
    actualTime: p.avgTime,
    standardTime: getStandardTime(p.name),
    count: p.count,
  }))

  return (
    <div className="space-y-4 page-enter">
      {/* Back + Doctor Header */}
      <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
        <button onClick={onBack} className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mb-4 transition-colors">
          <ArrowLeft className="w-4 h-4" /> กลับ
        </button>
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-white font-bold text-xl flex-shrink-0" style={{ backgroundColor: doc.color }}>
            {doc.name.split(' ').map(w => w.charAt(0)).join('').substring(0, 2)}
          </div>
          <div className="flex-1">
            <h2 className="text-xl font-bold text-gray-900">{doc.name}</h2>
            <p className="text-sm text-gray-500">ประสิทธิภาพการทำงาน</p>
          </div>
        </div>
      </div>

      {/* Summary Boxes */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {[
          { label: 'ทั้งหมด', value: doc.totalPatients, color: '#3B82F6', icon: '👥' },
          { label: 'เสร็จแล้ว', value: doc.completedPatients, color: '#22C55E', icon: '✅' },
          { label: 'กำลังทำ', value: doc.servingPatients, color: '#F59E0B', icon: '🔄' },
          { label: 'รอคิว', value: doc.waitingPatients, color: '#6B7280', icon: '⏳' },
          { label: 'ยกเลิก', value: doc.cancelledPatients, color: '#EF4444', icon: '❌' },
        ].map((s, i) => (
          <div key={i} className="bg-white rounded-2xl border border-gray-200 p-4 text-center shadow-sm">
            <p className="text-2xl mb-1">{s.icon}</p>
            <p className="text-3xl font-black" style={{ color: s.color }}>{s.value}</p>
            <p className="text-xs text-gray-500 mt-1">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-white rounded-2xl border border-gray-200 p-4 shadow-sm">
          <p className="text-xs text-gray-500 mb-1">⏱ เวลาเฉลี่ยรวม</p>
          <p className="text-2xl font-black text-gray-900">{doc.avgTime} <span className="text-sm font-normal text-gray-500">นาที/คน</span></p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-200 p-4 shadow-sm">
          <p className="text-xs text-gray-500 mb-1">⚡ ประสิทธิภาพ</p>
          <p className="text-2xl font-black text-gray-900">{doc.efficiency} <span className="text-sm font-normal text-gray-500">คน/ชม.</span></p>
        </div>
      </div>

      {/* ⏱ เวลาเฉลี่ยแยกตามหัตถการ */}
      <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
        <h3 className="text-base font-bold text-gray-900 mb-1">⏱ เวลาเฉลี่ยแยกตามหัตถการ</h3>
        <p className="text-xs text-gray-400 mb-4">เวลาเฉลี่ยที่ผู้ทำหัตถการท่านนี้ใช้สำหรับแต่ละหัตถการ เทียบกับค่ามาตรฐาน</p>
        {doc.procedures.length > 0 ? (
          <div className="space-y-3">
            {doc.procedures.map((proc, i) => {
              const standard = getStandardTime(proc.name)
              const diff = proc.avgTime - standard
              const diffPercent = standard > 0 ? Math.round((diff / standard) * 100) : 0
              const maxTime = Math.max(...doc.procedures.map(p => p.avgTime), standard)
              const barWidth = maxTime > 0 ? Math.min(100, (proc.avgTime / maxTime) * 100) : 0
              const stdWidth = maxTime > 0 ? Math.min(100, (standard / maxTime) * 100) : 0
              const statusColor = diff === 0 ? '#22C55E' : diff < 0 ? '#22C55E' : diffPercent > 20 ? '#EF4444' : '#F59E0B'
              const statusLabel = diff === 0 ? '✓ ตรงมาตรฐาน' : diff < 0 ? `✓ เร็วกว่า ${Math.abs(diffPercent)}%` : diffPercent > 20 ? `⚠ ช้ากว่า ${diffPercent}%` : `▽ ช้ากว่า ${diffPercent}%`
              return (
                <div key={i} className="bg-gray-50 rounded-xl p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-gray-800">🦷 {proc.name}</span>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 font-medium">
                        {proc.count} ครั้ง
                      </span>
                    </div>
                    <span className="text-xs font-bold px-2 py-1 rounded-lg" style={{ backgroundColor: statusColor + '15', color: statusColor }}>
                      {statusLabel}
                    </span>
                  </div>
                  {/* Standard time bar */}
                  <div className="mb-1.5">
                    <div className="flex items-center justify-between mb-0.5">
                      <span className="text-[10px] text-gray-500">📊 มาตรฐาน</span>
                      <span className="text-[10px] font-bold text-gray-600">{standard} น.</span>
                    </div>
                    <div className="h-2.5 bg-gray-200 rounded-full overflow-hidden">
                      <div className="h-full rounded-full bg-gray-400 transition-all duration-700" style={{ width: `${stdWidth}%` }} />
                    </div>
                  </div>
                  {/* Actual time bar */}
                  <div>
                    <div className="flex items-center justify-between mb-0.5">
                      <span className="text-[10px] text-gray-500">⏱ เวลาจริง (เฉลี่ย)</span>
                      <span className="text-[10px] font-bold" style={{ color: statusColor }}>{proc.avgTime} น. ({proc.count} ครั้ง)</span>
                    </div>
                    <div className="h-3 bg-gray-200 rounded-full overflow-hidden">
                      <div className="h-full rounded-full transition-all duration-700" style={{ backgroundColor: statusColor, width: `${barWidth}%` }} />
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          <p className="text-sm text-gray-400 text-center py-6">ไม่มีข้อมูลหัตถการ</p>
        )}
      </div>

      {/* Step 1: Procedure breakdown */}
      <button onClick={() => toggleStep(1)} className="w-full text-left">
        <div className={clsx('bg-white rounded-2xl border border-gray-200 p-4 shadow-sm transition-all cursor-pointer', expandedStep === 1 && 'ring-2 ring-blue-200')}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-blue-500 flex items-center justify-center text-sm font-bold text-white">1</div>
              <span className="text-sm font-bold text-gray-900">🩺 หัตถการที่ทำ — จำนวนและเวลาเฉลี่ย</span>
            </div>
            {expandedStep === 1 ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
          </div>
        </div>
      </button>
      {expandedStep === 1 && (
        <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
          {procComparisonData.length > 0 ? (
            <div>
              <p className="text-sm font-medium text-gray-700 mb-3">⏱ เวลาเฉลี่ยแยกตามหัตถการ</p>
              <p className="text-[10px] text-gray-400 mb-3">เวลาเฉลี่ยที่ใช้ทำหัตถการ เทียบกับค่ามาตรฐาน เร็วกว่ามาตรฐานแสดงว่าทำได้ดี</p>
              {/* Comparison table with progress bars */}
              <div className="space-y-3">
                {procComparisonData.map((p, i) => {
                  const diff = p.actualTime - p.standardTime
                  const percent = p.standardTime > 0 ? Math.round((diff / p.standardTime) * 100) : 0
                  const maxTime = Math.max(p.actualTime, p.standardTime, 1)
                  const standardWidth = Math.min(100, (p.standardTime / maxTime) * 100)
                  const actualWidth = Math.min(100, (p.actualTime / maxTime) * 100)
                  const isFaster = diff < 0
                  const statusColor = diff === 0 ? '#22C55E' : isFaster ? '#22C55E' : percent > 20 ? '#EF4444' : '#F59E0B'
                  const statusLabel = diff === 0 ? '✓ ตรงมาตรฐาน' : isFaster ? `✓ เร็วกว่า ${Math.abs(percent)}%` : percent > 20 ? `⚠ ช้ากว่า ${percent}%` : `▽ ช้ากว่า ${percent}%`
                  return (
                    <div key={i} className="bg-gray-50 rounded-xl p-4">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-gray-800">🦷 {p.name}</span>
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-100 text-blue-600 font-medium">{p.count} ครั้ง</span>
                        </div>
                        <span className="text-xs font-bold px-2 py-1 rounded-lg" style={{ backgroundColor: statusColor + '15', color: statusColor }}>
                          {statusLabel}
                        </span>
                      </div>
                      {/* Standard time bar */}
                      <div className="mb-1.5">
                        <div className="flex items-center justify-between mb-0.5">
                          <span className="text-[10px] text-gray-500">📊 มาตรฐาน</span>
                          <span className="text-[10px] font-bold text-gray-600">{p.standardTime} น.</span>
                        </div>
                        <div className="h-2.5 bg-gray-200 rounded-full overflow-hidden">
                          <div className="h-full rounded-full bg-gray-400" style={{ width: `${standardWidth}%` }} />
                        </div>
                      </div>
                      {/* Actual time bar */}
                      <div>
                        <div className="flex items-center justify-between mb-0.5">
                          <span className="text-[10px] text-gray-500">⏱ เวลาจริง (เฉลี่ย)</span>
                          <span className="text-[10px] font-bold" style={{ color: statusColor }}>{p.actualTime} น.</span>
                        </div>
                        <div className="h-3 bg-gray-200 rounded-full overflow-hidden">
                          <div className="h-full rounded-full" style={{ backgroundColor: statusColor, width: `${actualWidth}%` }} />
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          ) : (
            <p className="text-sm text-gray-400 text-center py-6">ไม่มีข้อมูลหัตถการ</p>
          )}
        </div>
      )}

      {/* Step 2: Hourly distribution */}
      <button onClick={() => toggleStep(2)} className="w-full text-left">
        <div className={clsx('bg-white rounded-2xl border border-gray-200 p-4 shadow-sm transition-all cursor-pointer', expandedStep === 2 && 'ring-2 ring-orange-200')}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-orange-500 flex items-center justify-center text-sm font-bold text-white">2</div>
              <span className="text-sm font-bold text-gray-900">⏰ ช่วงเวลาที่มีงานมาก/น้อย</span>
            </div>
            {expandedStep === 2 ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
          </div>
        </div>
      </button>
      {expandedStep === 2 && (
        <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
          {doc.hourlyLoad.length > 0 ? (
            <div>
              <p className="text-sm font-medium text-gray-700 mb-3">📊 ช่วงเวลามีคนไข้มาก/น้อย</p>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={doc.hourlyLoad} barCategoryGap="20%">
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                    <XAxis dataKey="hour" tick={{ fontSize: 10 }} interval={0} angle={0} />
                    <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                    <Tooltip
                      formatter={(value) => [`${value} คน`, 'จำนวนคนไข้']}
                      labelFormatter={(label) => `เวลา ${label} น.`}
                    />
                    <Bar dataKey="count" name="จำนวนคนไข้" radius={[4, 4, 0, 0]}>
                      {doc.hourlyLoad.map((entry, index) => (
                        <Cell key={index} fill={entry.count >= Math.max(...doc.hourlyLoad.map(h => h.count)) ? '#F97316' : '#FDBA74'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
              {/* Peak hour summary */}
              {(() => {
                const maxCount = Math.max(...doc.hourlyLoad.map(h => h.count))
                const peakHours = doc.hourlyLoad.filter(h => h.count === maxCount).map(h => h.hour)
                const quietHours = doc.hourlyLoad.filter(h => h.count === 0).map(h => h.hour)
                return (
                  <div className="flex flex-wrap gap-2 mt-3">
                    {peakHours.length > 0 && (
                      <span className="inline-flex items-center gap-1 text-[10px] px-2 py-1 rounded-full bg-orange-100 text-orange-700 font-medium">
                        🔥 ช่วงpeak: {peakHours.join(', ')} น.
                      </span>
                    )}
                    {quietHours.length > 0 && quietHours.length < doc.hourlyLoad.length && (
                      <span className="inline-flex items-center gap-1 text-[10px] px-2 py-1 rounded-full bg-green-100 text-green-700 font-medium">
                        ✅ ช่วงว่าง: {quietHours.slice(0, 3).join(', ')}{quietHours.length > 3 ? ` +${quietHours.length - 3}` : ''} น.
                      </span>
                    )}
                  </div>
                )
              })()}
              <p className="text-[10px] text-gray-400 text-center mt-2">แสดงช่วงเวลาตั้งแต่เริ่มปฎิบัติงานจนสิ้นสุด</p>
            </div>
          ) : (
            <p className="text-sm text-gray-400 text-center py-6">ไม่มีข้อมูลช่วงเวลา</p>
          )}
        </div>
      )}

      {/* Step 3: Patient list */}
      <button onClick={() => toggleStep(3)} className="w-full text-left">
        <div className={clsx('bg-white rounded-2xl border border-gray-200 p-4 shadow-sm transition-all cursor-pointer', expandedStep === 3 && 'ring-2 ring-purple-200')}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-purple-500 flex items-center justify-center text-sm font-bold text-white">3</div>
              <span className="text-sm font-bold text-gray-900">📝 รายชื่อผู้รับบริการ — ลำดับ หัตถการ เวลา</span>
            </div>
            {expandedStep === 3 ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
          </div>
        </div>
      </button>
      {expandedStep === 3 && (
        <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm space-y-2">
          {doc.patients.map((p, i) => (
            <div key={p.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold text-white flex-shrink-0" style={{ backgroundColor: doc.color }}>
                {i + 1}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-gray-900">{p.number}</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-gray-200 text-gray-600">{bookingConfig[p.bookingMode]?.emoji} {bookingConfig[p.bookingMode]?.label}</span>
                </div>
                <p className="text-xs text-gray-500 mt-0.5">🩺 {p.procedure} {p.totalDuration && `• ⏱ ${p.totalDuration} น.`}</p>
              </div>
              <div className="text-right flex-shrink-0">
                <p className="text-xs font-bold text-gray-700">{p.time}</p>
                <p className="text-[10px] text-gray-400">{p.status === 'completed' ? '✅ เสร็จ' : p.status === 'serving' ? '🔄 ทำอยู่' : '⏳ รอ'}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Step 4: Cancelled patients */}
      {doc.cancelledPatients > 0 && (
        <>
          <button onClick={() => toggleStep(4)} className="w-full text-left">
            <div className={clsx('bg-white rounded-2xl border border-gray-200 p-4 shadow-sm transition-all cursor-pointer', expandedStep === 4 && 'ring-2 ring-red-200')}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-red-500 flex items-center justify-center text-sm font-bold text-white">4</div>
                  <span className="text-sm font-bold text-gray-900">❌ ผู้รับบริการที่ยกเลิก — จำนวนและเหตุผล</span>
                </div>
                {expandedStep === 4 ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
              </div>
            </div>
          </button>
          {expandedStep === 4 && (
            <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
              <div className="grid grid-cols-3 gap-3 mb-4">
                <div className="bg-red-50 rounded-xl p-3 text-center">
                  <p className="text-2xl font-black text-red-600">{doc.cancelledPatients}</p>
                  <p className="text-[10px] text-red-700 mt-1">ยกเลิกทั้งหมด</p>
                </div>
                <div className="bg-orange-50 rounded-xl p-3 text-center">
                  <p className="text-2xl font-black text-orange-600">{doc.patients.filter(p => p.status === 'cancelled' && p.cancelReason).length}</p>
                  <p className="text-[10px] text-orange-700 mt-1">ระบุเหตุผล</p>
                </div>
                <div className="bg-gray-50 rounded-xl p-3 text-center">
                  <p className="text-2xl font-black text-gray-600">{doc.patients.filter(p => p.status === 'cancelled' && !p.cancelReason).length}</p>
                  <p className="text-[10px] text-gray-700 mt-1">ไม่ระบุเหตุผล</p>
                </div>
              </div>
              {/* Cancel Reasons Chart */}
              {doc.patients.filter(p => p.status === 'cancelled' && p.cancelReason).length > 0 && (
                <div className="mb-4">
                  <p className="text-sm font-medium text-gray-700 mb-3">📊 สาเหตุการยกเลิก</p>
                  <div className="space-y-2">
                    {(() => {
                      const reasons: Record<string, number> = {}
                      doc.patients.filter(p => p.status === 'cancelled' && p.cancelReason).forEach(p => {
                        const r = p.cancelReason || 'ไม่ระบุ'
                        reasons[r] = (reasons[r] || 0) + 1
                      })
                      const maxR = Math.max(...Object.values(reasons), 1)
                      return Object.entries(reasons).sort((a, b) => b[1] - a[1]).map(([reason, count]) => (
                        <div key={reason} className="flex items-center gap-3">
                          <span className="text-sm text-gray-700 w-48 truncate">{reason}</span>
                          <div className="flex-1 h-6 bg-gray-100 rounded-full overflow-hidden">
                            <div className="h-full bg-gradient-to-r from-red-400 to-red-500 rounded-full transition-all duration-500" style={{ width: `${(count / maxR) * 100}%` }} />
                          </div>
                          <span className="text-sm font-bold text-red-600 w-12 text-right">{count}</span>
                        </div>
                      ))
                    })()}
                  </div>
                </div>
              )}
              {/* Cancelled Patient List */}
              <p className="text-sm font-medium text-gray-700 mb-3">📋 รายชื่อผู้รับบริการที่ยกเลิก</p>
              <div className="space-y-2">
                {doc.patients.filter(p => p.status === 'cancelled').map((p, i) => (
                  <div key={p.id} className="flex items-center gap-3 p-3 bg-red-50 rounded-xl border border-red-100">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold text-white flex-shrink-0 bg-red-400">
                      {i + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-gray-900">{p.number}</span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-gray-200 text-gray-600">{bookingConfig[p.bookingMode]?.emoji} {bookingConfig[p.bookingMode]?.label}</span>
                      </div>
                      <p className="text-xs text-gray-500 mt-0.5">🩺 {p.procedure}</p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-xs font-bold text-gray-700">{p.time}</p>
                      {p.cancelReason && <p className="text-[10px] text-red-500 mt-0.5">💬 {p.cancelReason}</p>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}

/* ═══════ MAIN ANALYTICS ═══════ */
export default function Analytics() {
  const { queue } = useQueue()
  const { config } = useClinic()

  const [timeFilter, setTimeFilter] = useState<TimeFilter>('day')
  const [selectedDate, setSelectedDate] = useState(new Date())
  const [selectedWeekStart, setSelectedWeekStart] = useState(() => {
    const d = new Date(); const day = d.getDay(); const diff = d.getDate() - day + (day === 0 ? -6 : 1); d.setDate(diff); d.setHours(0, 0, 0, 0); return d
  })
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth())
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear())
  const [drillView, setDrillView] = useState<DrillView>('overview')
  const [selectedDoc, setSelectedDoc] = useState<PractitionerDetail | null>(null)

  const today = new Date()
  const filteredQueue = useMemo(() => queue, [queue])

  const total = filteredQueue.length
  const completedCount = filteredQueue.filter(q => q.status === 'completed').length
  const servingCount = filteredQueue.filter(q => q.status === 'serving').length
  const waitingCount = filteredQueue.filter(q => q.status === 'waiting' && q.arrived).length
  const cancelledCount = filteredQueue.filter(q => q.status === 'cancelled').length
  const avgDuration = completedCount > 0
    ? Math.round(filteredQueue.filter(q => q.totalDuration).reduce((s, q) => s + (q.totalDuration || 0), 0) / completedCount)
    : 0

  const dateLabel = useMemo(() => {
    if (timeFilter === 'day') return selectedDate.toLocaleDateString('th-TH', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
    if (timeFilter === 'week') {
      const weekEnd = new Date(selectedWeekStart); weekEnd.setDate(weekEnd.getDate() + 6)
      return `สัปดาห์ ${selectedWeekStart.toLocaleDateString('th-TH', { day: 'numeric', month: 'short' })} - ${weekEnd.toLocaleDateString('th-TH', { day: 'numeric', month: 'short' })}`
    }
    if (timeFilter === 'month') return `${new Date(selectedYear, selectedMonth).toLocaleDateString('th-TH', { month: 'long', year: 'numeric' })}`
    return `ปี ${selectedYear + 543}`
  }, [timeFilter, selectedDate, selectedWeekStart, selectedMonth, selectedYear])

  const navigateDate = (dir: number) => {
    if (timeFilter === 'day') { const d = new Date(selectedDate); d.setDate(d.getDate() + dir); setSelectedDate(d) }
    else if (timeFilter === 'week') { const d = new Date(selectedWeekStart); d.setDate(d.getDate() + dir * 7); setSelectedWeekStart(d) }
    else if (timeFilter === 'month') { setSelectedMonth(prev => prev + dir) }
    else { setSelectedYear(prev => prev + dir) }
  }

  // ═══ Booking Mode Pie ═══
  const bookingPieData = useMemo(() => {
    const walkin = filteredQueue.filter(q => q.bookingMode === 'walkin').length
    const remote = filteredQueue.filter(q => q.bookingMode === 'remote').length
    const appointment = filteredQueue.filter(q => q.bookingMode === 'appointment').length
    return [
      { name: 'Walk-in', value: walkin, color: '#22C55E' },
      { name: 'ออนไลน์', value: remote, color: '#3B82F6' },
      { name: 'นัดหมาย', value: appointment, color: '#A855F7' },
    ].filter(d => d.value > 0)
  }, [filteredQueue])

  // ═══ Procedure Stats ═══
  const procedureStats = useMemo(() => {
    const map: Record<string, { name: string; count: number; totalTime: number; avgTime: number }> = {}
    filteredQueue.forEach(q => {
      const procs = q.completedProcedures?.length ? q.completedProcedures : [{ name: q.procedure, quantity: 1, difficulty: 'medium' as DifficultyLevel, procedureId: '' }]
      procs.forEach(proc => {
        if (!map[proc.name]) map[proc.name] = { name: proc.name, count: 0, totalTime: 0, avgTime: 0 }
        map[proc.name].count += proc.quantity
        if (q.totalDuration) map[proc.name].totalTime += q.totalDuration
      })
    })
    return Object.values(map).sort((a, b) => b.count - a.count).map(p => ({ ...p, avgTime: p.count > 0 ? Math.round(p.totalTime / p.count) : 0 }))
  }, [filteredQueue])

  // ═══ Doctor Stats ═══
  const { doctorStats, doctorDetails } = useMemo(() => {
    const map: Record<string, {
      name: string; patientCount: number; totalTime: number;
      completed: number; cancelled: number; serving: number; waiting: number;
      hourlyLoad: Record<string, number>;
      procedureDetails: Record<string, { count: number; totalTime: number }>;
      patientList: QueueItem[];
    }> = {}

    filteredQueue.forEach(q => {
      if (!map[q.assignedDoctor]) map[q.assignedDoctor] = {
        name: q.assignedDoctor, patientCount: 0, totalTime: 0,
        completed: 0, cancelled: 0, serving: 0, waiting: 0,
        hourlyLoad: {}, procedureDetails: {}, patientList: [],
      }
      const d = map[q.assignedDoctor]
      d.patientCount++
      d.patientList.push(q)
      if (q.totalDuration) d.totalTime += q.totalDuration
      if (q.status === 'completed') d.completed++
      if (q.status === 'cancelled') d.cancelled++
      if (q.status === 'serving') d.serving++
      if (q.status === 'waiting' && q.arrived) d.waiting++
      const hour = q.time.split(':')[0] + ':00'
      d.hourlyLoad[hour] = (d.hourlyLoad[hour] || 0) + 1
      const procs = q.completedProcedures?.length ? q.completedProcedures : [{ name: q.procedure, quantity: 1, difficulty: 'medium' as DifficultyLevel, procedureId: '' }]
      procs.forEach(proc => {
        if (!d.procedureDetails[proc.name]) d.procedureDetails[proc.name] = { count: 0, totalTime: 0 }
        d.procedureDetails[proc.name].count += proc.quantity
        if (q.totalDuration) d.procedureDetails[proc.name].totalTime += q.totalDuration
      })
    })

    const stats = Object.values(map).sort((a, b) => b.patientCount - a.patientCount).map(d => ({
      name: d.name,
      patients: d.patientCount,
      avgTime: d.patientCount > 0 ? Math.round(d.totalTime / d.patientCount) : 0,
      topProcedure: Object.entries(d.procedureDetails).sort((a, b) => b[1].count - a[1].count)[0]?.[0] || '-',
      procedures: Object.entries(d.procedureDetails).map(([name, pd]) => ({
        name,
        count: pd.count,
        totalTime: pd.totalTime,
        avgTime: pd.count > 0 ? Math.round(pd.totalTime / pd.count) : 0,
      })).sort((a, b) => b.count - a.count),
    }))

    const details: Record<string, PractitionerDetail> = {}
    Object.entries(map).forEach(([key, d]) => {
      const colorIdx = Object.keys(map).indexOf(key) % docColors.length
      details[key] = {
        name: d.name, color: docColors[colorIdx],
        totalPatients: d.patientList.length, completedPatients: d.completed,
        cancelledPatients: d.cancelled, servingPatients: d.serving, waitingPatients: d.waiting,
        totalTime: d.totalTime,
        avgTime: d.patientCount > 0 ? Math.round(d.totalTime / d.patientCount) : 0,
        procedures: Object.entries(d.procedureDetails).map(([name, pd]) => ({
          name, count: pd.count, totalTime: pd.totalTime,
          avgTime: pd.count > 0 ? Math.round(pd.totalTime / pd.count) : 0,
        })).sort((a, b) => b.count - a.count),
        hourlyLoad: Object.entries(d.hourlyLoad).map(([hour, count]) => ({ hour, count })).sort((a, b) => a.hour.localeCompare(b.hour)),
        efficiency: d.totalTime > 0 ? Math.round((d.patientCount / (d.totalTime / 60)) * 10) / 10 : 0,
        patients: d.patientList,
      }
    })

    return { doctorStats: stats, doctorDetails: details }
  }, [filteredQueue])

  const { currentClinic } = useClinic()
  // ═══ Branch Data for Standard Times ═══
  const branchData = useMemo(() => {
    return getDefaultBranchData(currentClinic || 'dental')
  }, [currentClinic])

  // ═══ Actual vs Standard Time Comparison ═══
  const comparisonData = useMemo(() => {
    const map: Record<string, Record<string, { actualTime: number; standardTime: number; count: number }>> = {}

    filteredQueue.forEach(q => {
      if (!q.totalDuration || q.totalDuration <= 0) return
      const docShort = q.assignedDoctor.split(' ').slice(0, 2).join(' ')
      if (!map[docShort]) map[docShort] = {}
      if (!map[docShort][q.procedure]) {
        // Find standard time from branch data
        let standardTime = 30 // default
        for (const branch of branchData.branches) {
          const proc = branch.procedures.find(p => p.name === q.procedure)
          if (proc) { standardTime = proc.estimatedDuration; break }
        }
        map[docShort][q.procedure] = { actualTime: 0, standardTime, count: 0 }
      }
      map[docShort][q.procedure].actualTime += q.totalDuration
      map[docShort][q.procedure].count++
    })

    // Convert to flat array with averages
    const result: { practitioner: string; procedure: string; avgActual: number; standardTime: number; diff: number; diffPercent: number; count: number; color: string }[] = []
    Object.entries(map).forEach(([docName, procs]) => {
      const colorIdx = Object.keys(map).indexOf(docName) % docColors.length
      Object.entries(procs).forEach(([procName, data]) => {
        const avgActual = data.count > 0 ? Math.round(data.actualTime / data.count) : 0
        const diff = avgActual - data.standardTime
        const diffPercent = data.standardTime > 0 ? Math.round(((avgActual - data.standardTime) / data.standardTime) * 100) : 0
        result.push({
          practitioner: docName,
          procedure: procName,
          avgActual,
          standardTime: data.standardTime,
          diff,
          diffPercent,
          count: data.count,
          color: docColors[colorIdx],
        })
      })
    })

    return result.sort((a, b) => b.count - a.count)
  }, [filteredQueue, branchData])

  // Drill-down view
  if (drillView === 'practitioner' && selectedDoc) {
    return (
      <div className="space-y-4">
        <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-xl font-bold text-gray-900">📈 วิเคราะห์ข้อมูล</h1>
              <p className="text-sm text-gray-500 mt-0.5">{dateLabel}</p>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex bg-black/[0.04] rounded-2xl p-1">
                {(['day', 'week', 'month', 'year'] as TimeFilter[]).map(tf => (
                  <button key={tf} onClick={() => setTimeFilter(tf)} className={clsx('px-3 py-1.5 rounded-lg text-xs font-medium transition-all', timeFilter === tf ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700')}>
                    {tf === 'day' ? 'วัน' : tf === 'week' ? 'สัปดาห์' : tf === 'month' ? 'เดือน' : 'ปี'}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-1">
                <button onClick={() => navigateDate(-1)} className="p-1.5 rounded-lg hover:bg-gray-100"><ChevronLeft className="w-4 h-4 text-gray-500" /></button>
                <button onClick={() => { setSelectedDate(new Date()); setSelectedWeekStart(() => { const d = new Date(); const day = d.getDay(); const diff = d.getDate() - day + (day === 0 ? -6 : 1); d.setDate(diff); d.setHours(0, 0, 0, 0); return d }); setSelectedMonth(today.getMonth()); setSelectedYear(today.getFullYear()) }} className="px-3 py-1.5 rounded-lg bg-gray-100 text-xs font-medium text-gray-700 hover:bg-gray-200">วันนี้</button>
                <button onClick={() => navigateDate(1)} className="p-1.5 rounded-lg hover:bg-gray-100"><ChevronRight className="w-4 h-4 text-gray-500" /></button>
              </div>
            </div>
          </div>
        </div>
        <PractitionerDrillDown doc={selectedDoc} onBack={() => { setDrillView('overview'); setSelectedDoc(null) }} branchData={branchData} />
      </div>
    )
  }

  const maxDoctorPatients = doctorStats.length > 0 ? Math.max(...doctorStats.map(d => d.patients)) : 1

  return (
    <div className="space-y-5 page-enter">
      {/* Header + Filter */}
      <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-gray-900">📊 วิเคราะห์ข้อมูล</h1>
            <p className="text-sm text-gray-500 mt-0.5">{dateLabel}</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex bg-black/[0.04] rounded-2xl p-1">
              {(['day', 'week', 'month', 'year'] as TimeFilter[]).map(tf => (
                <button key={tf} onClick={() => setTimeFilter(tf)} className={clsx('px-3 py-1.5 rounded-xl text-xs font-semibold transition-all', timeFilter === tf ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700')}>
                  {tf === 'day' ? 'วัน' : tf === 'week' ? 'สัปดาห์' : tf === 'month' ? 'เดือน' : 'ปี'}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-1">
              <button onClick={() => navigateDate(-1)} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors"><ChevronLeft className="w-4 h-4 text-gray-500" /></button>
              <button onClick={() => { setSelectedDate(new Date()); setSelectedWeekStart(() => { const d = new Date(); const day = d.getDay(); const diff = d.getDate() - day + (day === 0 ? -6 : 1); d.setDate(diff); d.setHours(0, 0, 0, 0); return d }); setSelectedMonth(today.getMonth()); setSelectedYear(today.getFullYear()) }} className="px-3 py-1.5 rounded-lg bg-gray-100 text-xs font-medium text-gray-700 hover:bg-gray-200 transition-colors">วันนี้</button>
              <button onClick={() => navigateDate(1)} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors"><ChevronRight className="w-4 h-4 text-gray-500" /></button>
            </div>
          </div>
        </div>
      </div>

      {/* ═══ Summary Boxes ═══ */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-white rounded-2xl border-2 border-gray-200 p-5 text-center shadow-md hover:shadow-lg transition-all">
          <div className="w-12 h-12 mx-auto rounded-xl bg-pink-50 flex items-center justify-center text-2xl mb-2">📋</div>
          <p className="text-5xl font-black text-gray-900 leading-none">{total}</p>
          <p className="text-sm text-gray-500 mt-2 font-medium">ผู้เข้ารับบริการทั้งหมด</p>
          <div className="flex justify-center gap-3 mt-3 text-xs flex-wrap">
            <span className="text-green-600 font-semibold">✓ {completedCount} เสร็จ</span>
            <span className="text-blue-600 font-semibold">🔄 {servingCount} ทำอยู่</span>
            <span className="text-gray-500 font-semibold">⏳ {waitingCount} รอ</span>
            {cancelledCount > 0 && <span className="text-red-600 font-semibold">✕ {cancelledCount} ยกเลิก</span>}
          </div>
        </div>
        <div className="bg-white rounded-2xl border-2 border-emerald-200 p-5 text-center shadow-md hover:shadow-lg transition-all">
          <div className="w-12 h-12 mx-auto rounded-xl bg-emerald-50 flex items-center justify-center text-2xl mb-2">🏁</div>
          <p className="text-5xl font-black text-emerald-600 leading-none">{completedCount}</p>
          <p className="text-sm text-gray-500 mt-2 font-medium">เสร็จสิ้น</p>
        </div>
        <div className="bg-white rounded-2xl border-2 border-amber-200 p-5 text-center shadow-md hover:shadow-lg transition-all">
          <div className="w-12 h-12 mx-auto rounded-xl bg-amber-50 flex items-center justify-center text-2xl mb-2">⏱️</div>
          <p className="text-5xl font-black text-amber-600 leading-none">{avgDuration}</p>
          <p className="text-sm text-gray-500 mt-2 font-medium">นาที เฉลี่ย/คน</p>
        </div>
        <div className="bg-white rounded-2xl border-2 border-red-200 p-5 text-center shadow-md hover:shadow-lg transition-all">
          <div className="w-12 h-12 mx-auto rounded-xl bg-red-50 flex items-center justify-center text-2xl mb-2">❌</div>
          <p className="text-5xl font-black text-red-600 leading-none">{cancelledCount}</p>
          <p className="text-sm text-gray-500 mt-2 font-medium">ยกเลิก</p>
        </div>
        <div className="bg-white rounded-2xl border-2 p-5 text-center shadow-md hover:shadow-lg transition-all" style={{ borderColor: (config?.color || '#93C5FD') + '40' }}>
          <div className="w-12 h-12 mx-auto rounded-xl flex items-center justify-center text-2xl mb-2" style={{ backgroundColor: (config?.color || '#93C5FD') + '15' }}>🩺</div>
          <p className="text-5xl font-black leading-none" style={{ color: config?.color || '#93C5FD' }}>{procedureStats.length}</p>
          <p className="text-sm text-gray-500 mt-2 font-medium">หัตถการที่ทำวันนี้</p>
        </div>
      </div>

      {/* ═══ Cancellation Stats ═══ */}
      {cancelledCount > 0 && (
        <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
          <h3 className="text-base font-bold text-gray-900 mb-1">❌ สถิติการยกเลิก</h3>
          <p className="text-xs text-gray-400 mb-4">ผู้รับบริการที่ยกเลิกคิว {cancelledCount} ราย</p>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="bg-red-50 rounded-xl p-4 text-center">
              <p className="text-3xl font-black text-red-600">{cancelledCount}</p>
              <p className="text-xs text-red-700 mt-1">ยกเลิกทั้งหมด</p>
            </div>
            <div className="bg-orange-50 rounded-xl p-4 text-center">
              <p className="text-3xl font-black text-orange-600">{total > 0 ? Math.round((cancelledCount / total) * 100) : 0}%</p>
              <p className="text-xs text-orange-700 mt-1">อัตราการยกเลิก</p>
            </div>
            <div className="bg-purple-50 rounded-xl p-4 text-center">
              <p className="text-3xl font-black text-purple-600">{filteredQueue.filter(q => q.status === 'cancelled' && q.cancelReason).length}</p>
              <p className="text-xs text-purple-700 mt-1">ระบุเหตุผล</p>
            </div>
            <div className="bg-gray-50 rounded-xl p-4 text-center">
              <p className="text-3xl font-black text-gray-600">{filteredQueue.filter(q => q.status === 'cancelled' && !q.cancelReason).length}</p>
              <p className="text-xs text-gray-700 mt-1">ไม่ระบุเหตุผล</p>
            </div>
          </div>
          {/* Cancellation Reasons Chart */}
          {filteredQueue.filter(q => q.status === 'cancelled' && q.cancelReason).length > 0 && (
            <div className="mt-4">
              <p className="text-sm font-medium text-gray-700 mb-3">📊 สาเหตุการยกเลิก</p>
              <div className="space-y-2">
                {(() => {
                  const reasons: Record<string, number> = {}
                  filteredQueue.filter(q => q.status === 'cancelled' && q.cancelReason).forEach(q => {
                    const r = q.cancelReason || 'ไม่ระบุ'
                    reasons[r] = (reasons[r] || 0) + 1
                  })
                  const maxReason = Math.max(...Object.values(reasons), 1)
                  return Object.entries(reasons).sort((a, b) => b[1] - a[1]).map(([reason, count]) => (
                    <div key={reason} className="flex items-center gap-3">
                      <span className="text-sm text-gray-700 w-40 truncate">{reason}</span>
                      <div className="flex-1 h-6 bg-gray-100 rounded-full overflow-hidden">
                        <div className="h-full bg-gradient-to-r from-red-400 to-red-500 rounded-full transition-all duration-500" style={{ width: `${(count / maxReason) * 100}%` }} />
                      </div>
                      <span className="text-sm font-bold text-red-600 w-12 text-right">{count}</span>
                    </div>
                  ))
                })()}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ═══ Row 1: Booking Pie + Procedure Count ═══ */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Pie Chart — Booking Mode */}
        <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
          <h3 className="text-base font-bold text-gray-900 mb-4">📊 สัดส่วนประเภทผู้รับบริการ</h3>
          {bookingPieData.length > 0 ? (
            <div className="flex items-center gap-6">
              <ResponsiveContainer width="50%" height={200}>
                <PieChart>
                  <Pie data={bookingPieData} cx="50%" cy="50%" innerRadius={50} outerRadius={85} paddingAngle={4} dataKey="value" label={({ value }) => `${value}`} labelLine={false}>
                    {bookingPieData.map((entry, index) => (
                      <Cell key={index} fill={entry.color} stroke="white" strokeWidth={2} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value, name) => [`${value} คน`, name]} />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex-1 space-y-4">
                {bookingPieData.map((d, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <div className="w-5 h-5 rounded-full flex-shrink-0" style={{ backgroundColor: d.color }} />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-700">{d.name}</p>
                      <div className="h-2.5 bg-gray-100 rounded-full mt-1">
                        <div className="h-full rounded-full" style={{ width: `${total > 0 ? (d.value / total) * 100 : 0}%`, backgroundColor: d.color }} />
                      </div>
                    </div>
                    <span className="text-xl font-black tabular-nums" style={{ color: d.color }}>{d.value}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <p className="text-sm text-gray-400 text-center py-12">ไม่มีข้อมูล</p>
          )}
        </div>

        {/* Procedure Count — Simple Bar List */}
        <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
          <h3 className="text-base font-bold text-gray-900 mb-4">🩺 จำนวนหัตถการแต่ละประเภท</h3>
          {procedureStats.length > 0 ? (
            <div className="space-y-3">
              {procedureStats.slice(0, 6).map((p, i) => {
                const maxCount = procedureStats[0]?.count || 1
                const barColors = ['#93C5FD', '#A7F3D0', '#FCD34D', '#FDA4AF', '#D8B4FE', '#C4B5FD']
                return (
                  <div key={i}>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-sm font-medium text-gray-700">{p.name}</span>
                      <span className="text-sm font-bold text-gray-900">{p.count} ครั้ง</span>
                    </div>
                    <div className="h-4 bg-gray-100 rounded-lg overflow-hidden">
                      <div
                        className="h-full rounded-lg transition-all duration-700"
                        style={{ backgroundColor: barColors[i % barColors.length], width: `${(p.count / maxCount) * 100}%` }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <p className="text-sm text-gray-400 text-center py-12">ไม่มีข้อมูล</p>
          )}
        </div>
      </div>

      {/* ═══ Row 2: Avg Time per Procedure ═══ */}
      <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
        <h3 className="text-base font-bold text-gray-900 mb-1">⏱ เวลาเฉลี่ยแต่ละหัตถการ</h3>
        <p className="text-xs text-gray-400 mb-5">เวลาที่ใช้จริงต่อครั้ง (นาที)</p>
        {procedureStats.filter(p => p.avgTime > 0).length > 0 ? (
          <div className="space-y-3">
            {procedureStats.filter(p => p.avgTime > 0).slice(0, 8).map((p, i) => {
              const maxTime = Math.max(...procedureStats.filter(p => p.avgTime > 0).map(p => p.avgTime))
              return (
                <div key={i}>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-sm font-medium text-gray-700">{p.name}</span>
                    <span className="text-sm font-bold" style={{ color: config?.color || '#93C5FD' }}>{p.avgTime} นาที</span>
                  </div>
                  <div className="h-4 bg-gray-100 rounded-lg overflow-hidden">
                    <div
                      className="h-full rounded-lg transition-all duration-700"
                      style={{ backgroundColor: config?.color || '#93C5FD', width: `${(p.avgTime / maxTime) * 100}%` }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          <p className="text-sm text-gray-400 text-center py-8">ไม่มีข้อมูลเวลา</p>
        )}
      </div>



      {/* ═══ Practitioner Performance — Simple Cards ═══ */}
      <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
        <h3 className="text-base font-bold text-gray-900 mb-1">⚡ ประสิทธิภาพผู้ทำหัตถการ</h3>
        <p className="text-xs text-gray-400 mb-5">จำนวนผู้รับบริการ เวลาเฉลี่ย และหัตถการหลัก</p>
        <div className="space-y-4">
          {doctorStats.map((doc, i) => {
            const detail = doctorDetails[doc.name]
            const color = detail?.color || docColors[i % docColors.length]
            return (
              <button key={i} onClick={() => { if (detail) { setSelectedDoc(detail); setDrillView('practitioner') } }}
                className="w-full text-left bg-gray-50 rounded-2xl p-4 hover:bg-gray-100 transition-all group">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl flex items-center justify-center text-white font-bold text-lg flex-shrink-0" style={{ backgroundColor: color }}>
                    {doc.name.split(' ').map(w => w.charAt(0)).join('').substring(0, 2)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-base font-bold text-gray-900 truncate">{doc.name}</p>
                      <span className="text-2xl font-black flex-shrink-0 ml-2" style={{ color }}>{doc.patients}</span>
                    </div>
                    <div className="flex items-center gap-4 text-xs text-gray-500 mb-2">
                      <span>⏱ เฉลี่ย {doc.avgTime} น./คน</span>
                      <span>🦷 {doc.topProcedure}</span>
                    </div>
                    <div className="h-3 bg-gray-200 rounded-full overflow-hidden">
                      <div className="h-full rounded-full transition-all duration-500" style={{ backgroundColor: color, width: `${(doc.patients / maxDoctorPatients) * 100}%` }} />
                    </div>
                  </div>
                </div>
              </button>
            )
          })}
        </div>
      </div>

      {/* ═══ Practitioner Performance Line Chart ═══ */}
      {doctorStats.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
          <h3 className="text-base font-bold text-gray-900 mb-1">📈 กราฟเปรียบเทียบประสิทธิภาพ</h3>
          <p className="text-xs text-gray-400 mb-5">เวลาเฉลี่ยแยกตามประเภทหัตถการของแต่ละผู้ทำหัตถการ</p>
          
          {/* Patient Count Bar Chart */}
          <div className="mb-6">
            <p className="text-sm font-medium text-gray-700 mb-3">👥 จำนวนผู้รับบริการ</p>
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={doctorStats.map(doc => ({ name: doc.name.split(' ')[0], patients: doc.patients }))}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="patients" stroke="#3B82F6" strokeWidth={3} name="จำนวนคนไข้" dot={{ r: 6 }} activeDot={{ r: 8 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Procedure-specific Average Time Chart */}
          <div>
            <p className="text-sm font-medium text-gray-700 mb-3">⏱ เวลาเฉลี่ยแยกตามหัตถการ (นาที/คน)</p>
            {/* Build chart data: one row per practitioner, one field per procedure */}
            {(() => {
              // Collect all procedure names across all practitioners
              const allProcs = new Set<string>()
              doctorStats.forEach(doc => {
                doc.procedures?.forEach(p => allProcs.add(p.name))
              })
              const procNames = Array.from(allProcs).slice(0, 6) // max 6 procedures
              const procColors = ['#3B82F6', '#22C55E', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899']
              
              const chartData = doctorStats.map(doc => {
                const row: Record<string, any> = { name: doc.name.split(' ')[0] }
                procNames.forEach(procName => {
                  const proc = doc.procedures?.find((p: any) => p.name === procName)
                  row[procName] = proc?.avgTime || 0
                })
                return row
              })

              return (
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                      <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} label={{ value: 'นาที', angle: -90, position: 'insideLeft', fontSize: 11 }} />
                      <Tooltip formatter={(value: any) => `${value} นาที`} />
                      <Legend wrapperStyle={{ fontSize: 11 }} />
                      {procNames.map((procName, idx) => (
                        <Line
                          key={procName}
                          type="monotone"
                          dataKey={procName}
                          stroke={procColors[idx % procColors.length]}
                          strokeWidth={2}
                          name={procName}
                          dot={{ r: 4 }}
                          activeDot={{ r: 6 }}
                        />
                      ))}
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )
            })()}
          </div>
        </div>
      )}
    </div>
  )
}
