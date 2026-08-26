'use client'

import { useState, useMemo, useCallback } from 'react'
import { Plus, Search, Edit, Trash2, Eye, X, Phone, User, PhoneCall, Filter, Clock, Stethoscope, FileText, Calendar } from 'lucide-react'
import { clsx } from 'clsx'
import { useClinic } from '@/lib/clinic-context'
import Toast from '@/components/ui/Toast'

interface Patient {
  id: string
  name: string
  phone: string
  notes?: string
}

interface ServiceHistory {
  id: string
  date: string
  practitioner: string
  procedure: string
  duration?: number
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

// No demo data - patients are loaded from Supabase
const initialPatients: Patient[] = []
const serviceHistoryData: Record<string, ServiceHistory[]> = {}

const emptyForm: Omit<Patient, 'id'> = {
  name: '',
  phone: '',
}

export default function PatientManager() {
  const { config } = useClinic()
  const [patients] = useState<Patient[]>(initialPatients)
  const [searchQuery, setSearchQuery] = useState('')
  const [filterMode, setFilterMode] = useState<'all' | 'recall'>('all')
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null)
  const [showViewModal, setShowViewModal] = useState<string | null>(null)
  const [showEditModal, setShowEditModal] = useState<string | null>(null)
  const [showAddModal, setShowAddModal] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  const [editForm, setEditForm] = useState(emptyForm)

  const showToastMsg = useCallback((message: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToast({ message, type })
    setTimeout(() => setToast(null), 3000)
  }, [])

  const filteredPatients = useMemo(() => {
    return patients.filter(patient => {
      const matchesSearch = patient.name.includes(searchQuery) || patient.phone.includes(searchQuery)
      // For recall filter, we need to check service history
      if (filterMode === 'recall') {
        const history = serviceHistoryData[patient.phone] || []
        if (history.length === 0) return false
        const lastVisit = history[history.length - 1].date
        return matchesSearch && needsRecall(lastVisit)
      }
      return matchesSearch
    })
  }, [patients, searchQuery, filterMode])

  const recallCount = useMemo(() => {
    return patients.filter(p => {
      const history = serviceHistoryData[p.phone] || []
      if (history.length === 0) return true
      const lastVisit = history[history.length - 1].date
      return needsRecall(lastVisit)
    }).length
  }, [patients])

  const viewingPatient = showViewModal ? patients.find(p => p.id === showViewModal) : null

  const patientHistory = useMemo(() => {
    if (!viewingPatient) return []
    return (serviceHistoryData[viewingPatient.phone] || []).sort((a, b) => 
      new Date(b.date).getTime() - new Date(a.date).getTime()
    )
  }, [viewingPatient])

  if (!config) return null

  return (
    <div className="space-y-6">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      {/* Add/Edit Modal */}
      {(showAddModal || showEditModal) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-gray-100">
              <h2 className="text-xl font-bold text-gray-900">{showAddModal ? 'เพิ่มผู้รับบริการใหม่' : 'แก้ไขข้อมูล'}</h2>
              <button onClick={() => { setShowAddModal(false); setShowEditModal(null) }} className="p-2 hover:bg-gray-100 rounded-lg">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">ชื่อ-นามสกุล *</label>
                <input type="text" value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} placeholder="กรอกชื่อ-นามสกุล" className="input-field" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">เบอร์โทร *</label>
                <input type="tel" value={editForm.phone} onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })} placeholder="0xx-xxx-xxxx" className="input-field" />
                <p className="text-xs text-gray-400 mt-1">ใช้เป็นหลักในการค้นหาประวัติการเข้ารับบริการ</p>
              </div>
            </div>
            <div className="flex justify-end gap-3 p-6 border-t border-gray-100">
              <button onClick={() => { setShowAddModal(false); setShowEditModal(null) }} className="btn-secondary">ยกเลิก</button>
              <button onClick={() => { showToastMsg(showAddModal ? 'เพิ่มผู้รับบริการสำเร็จ' : 'แก้ไขสำเร็จ'); setShowAddModal(false); setShowEditModal(null) }} className="btn-primary" style={{ backgroundColor: config.color }}>
                {showAddModal ? 'เพิ่มผู้รับบริการ' : 'บันทึก'}
              </button>
            </div>
          </div>
        </div>
      )}

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
                  <a href={`tel:${viewingPatient.phone.replace(/-/g, '')}`} className="flex items-center gap-1 text-blue-600 hover:text-blue-800 hover:underline">
                    <Phone className="w-4 h-4" />
                    {viewingPatient.phone}
                  </a>
                </div>
              </div>

              {/* Service History */}
              <div>
                <h4 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                  <FileText className="w-5 h-5 text-gray-500" />
                  ประวัติการมาใช้บริการ
                </h4>
                
                {patientHistory.length === 0 ? (
                  <div className="text-center py-8 text-gray-400 border-2 border-dashed border-gray-200 rounded-xl">
                    <Stethoscope className="w-8 h-8 mx-auto mb-2 opacity-30" />
                    <p>ยังไม่มีประวัติการเข้ารับบริการ</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {patientHistory.map((record) => (
                      <div key={record.id} className="flex items-start gap-3 p-3 bg-white border border-gray-200 rounded-xl hover:bg-gray-50">
                        <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center flex-shrink-0">
                          <Calendar className="w-5 h-5 text-blue-600" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-bold text-gray-900">{record.date}</span>
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
                            <span className="font-medium">{record.practitioner}</span>
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Recall Warning */}
              {patientHistory.length > 0 && needsRecall(patientHistory[0].date) && (
                <div className="flex items-center gap-3 p-3 bg-amber-50 border border-amber-200 rounded-xl">
                  <PhoneCall className="w-5 h-5 text-amber-500 flex-shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-amber-700">ควรโทร Recall</p>
                    <p className="text-xs text-amber-600">
                      ไม่ได้มาใช้บริการมากกว่า {monthsSince(patientHistory[0].date)} เดือน — แนะนำให้โทรนัด
                    </p>
                  </div>
                </div>
              )}
            </div>
            <div className="flex justify-end p-6 border-t border-gray-100">
              <button onClick={() => setShowViewModal(null)} className="btn-secondary">ปิด</button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation */}
      {confirmDelete && (() => {
        const p = patients.find(pt => pt.id === confirmDelete)
        if (!p) return null
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center"><Trash2 className="w-5 h-5 text-red-500" /></div>
                <h3 className="text-lg font-bold text-gray-900">ยืนยันการลบ</h3>
              </div>
              <p className="text-gray-600 mb-6">ต้องการลบข้อมูล <strong>{p.name}</strong> ใช่หรือไม่?</p>
              <div className="flex justify-end gap-3">
                <button onClick={() => setConfirmDelete(null)} className="btn-secondary">ยกเลิก</button>
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
          <p className="text-gray-500">{config.name}</p>
        </div>
      </div>

      {/* Search & Filter */}
      <div className="card p-4">
        <div className="flex flex-col md:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input type="text" placeholder="ค้นหาชื่อ หรือ เบอร์โทร..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="input-field pl-10" />
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
            <p className="text-lg">ไม่พบผู้รับบริการ</p>
          </div>
        ) : (
          filteredPatients.map((patient) => {
            const history = serviceHistoryData[patient.phone] || []
            const lastVisit = history.length > 0 ? history[history.length - 1].date : null
            const totalVisits = history.length
            const isRecallNeeded = lastVisit ? needsRecall(lastVisit) : true

            return (
              <div key={patient.id} className="card p-4 hover:shadow-md transition-shadow">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className={clsx('w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0', isRecallNeeded ? 'bg-amber-100 text-amber-600' : 'bg-blue-100 text-blue-600')}>
                      <User className="w-6 h-6" />
                    </div>
                    <div className="min-w-0">
                      <h3 className="font-bold text-gray-900 truncate">{patient.name}</h3>
                      <div className="flex items-center gap-2 text-sm text-gray-500">
                        <a href={`tel:${patient.phone.replace(/-/g, '')}`} className="flex items-center gap-1 text-blue-600 hover:text-blue-800 hover:underline">
                          <Phone className="w-3 h-3" />
                          {patient.phone}
                        </a>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-gray-400 mt-1">
                        <span>{totalVisits} ครั้ง</span>
                        {lastVisit && <span>ล่าสุด: {lastVisit} ({formatMonthsAgo(lastVisit)})</span>}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button onClick={() => setShowViewModal(patient.id)} className="p-2 hover:bg-gray-100 rounded-lg" title="ดูข้อมูล">
                      <Eye className="w-4 h-4 text-gray-500" />
                    </button>
                    <button onClick={() => { setEditForm({ name: patient.name, phone: patient.phone }); setShowEditModal(patient.id) }} className="p-2 hover:bg-gray-100 rounded-lg" title="แก้ไข">
                      <Edit className="w-4 h-4 text-gray-500" />
                    </button>
                    <button onClick={() => setConfirmDelete(patient.id)} className="p-2 hover:bg-red-50 rounded-lg" title="ลบ">
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
