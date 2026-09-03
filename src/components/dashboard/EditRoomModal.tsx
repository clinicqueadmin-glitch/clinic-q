'use client'

import { useState, useMemo, useEffect } from 'react'
import { X, Clock, User, Stethoscope, Trash2 } from 'lucide-react'
import { useClinic } from '@/lib/clinic-context'
import { useAuth } from '@/lib/auth-context'
import { getDefaultBranchData, type ClinicBranchData, type Room } from '@/lib/branch-data'
import { usePractitioners } from '@/lib/practitioner-context'

interface EditRoomModalProps {
  open: boolean
  room: Room | null
  onClose: () => void
  onSave: (updated: Room) => void
  onDelete: (roomId: number) => void
}

export default function EditRoomModal({ open, room, onClose, onSave, onDelete }: EditRoomModalProps) {
  const { currentClinic, settings } = useClinic()
  const { currentClinicId } = useAuth()
  const { practitioners } = usePractitioners()

  // Load branch data from clinic-specific storage
  const branchData: ClinicBranchData = useMemo(() => {
    if (typeof window !== 'undefined' && currentClinicId) {
      const saved = localStorage.getItem(`clinic-branch-data-${currentClinicId}`)
      if (saved) {
        try {
          const parsed = JSON.parse(saved)
          if (parsed && parsed.branches && parsed.branches.length > 0) {
            return parsed as ClinicBranchData
          }
        } catch {}
      }
      const sharedSaved = localStorage.getItem('clinic-branch-data')
      if (sharedSaved) {
        try {
          const parsed = JSON.parse(sharedSaved)
          if (parsed && parsed.branches && parsed.branches.length > 0) {
            return parsed as ClinicBranchData
          }
        } catch {}
      }
    }
    return getDefaultBranchData(currentClinic || 'dental')
  }, [currentClinicId, currentClinic])

  const dailyRoomKey = currentClinicId ? `clinic-daily-rooms-${currentClinicId}` : 'clinic-daily-rooms'

  // Form state
  const [selectedPractitionerId, setSelectedPractitionerId] = useState('')
  const [selectedBranchId, setSelectedBranchId] = useState('')
  const [startTime, setStartTime] = useState('09:00')
  const [endTime, setEndTime] = useState('17:00')
  const [showConfirmDelete, setShowConfirmDelete] = useState(false)

  // Load room data into form
  useEffect(() => {
    if (room && open) {
      setSelectedPractitionerId(room.practitionerId || '')
      setSelectedBranchId(room.branchId || '')
      setStartTime(room.workingStartTime || '09:00')
      setEndTime(room.workingEndTime || '17:00')
    }
  }, [room, open])

  // Available practitioners (exclude those assigned to other rooms)
  const activePractitioners = useMemo(() => {
    // Get all daily rooms to find assigned practitioners
    const saved = localStorage.getItem(dailyRoomKey)
    let dailyRooms: Room[] = []
    try { dailyRooms = saved ? JSON.parse(saved) : [] } catch {}
    const assignedIds = new Set(
      dailyRooms
        .filter(r => r.active && r.practitionerId && r.id !== room?.id)
        .map(r => r.practitionerId)
    )
    return practitioners.filter(p => p.active && !assignedIds.has(p.id))
  }, [practitioners, room, dailyRoomKey])

  const branches = branchData.branches.filter(b => b.active)

  const practitionerName = useMemo(() => {
    if (!selectedPractitionerId) return ''
    const p = activePractitioners.find(pr => pr.id === selectedPractitionerId)
    return p?.name || ''
  }, [selectedPractitionerId, activePractitioners])

  const branchName = useMemo(() => {
    if (!selectedBranchId) return ''
    const b = branches.find(br => br.id === selectedBranchId)
    return b?.name || ''
  }, [selectedBranchId, branches])

  const handleSave = () => {
    if (!room) return
    const updated: Room = {
      ...room,
      practitionerId: selectedPractitionerId,
      practitionerName,
      branchId: selectedBranchId,
      workingStartTime: startTime,
      workingEndTime: endTime,
    }

    // Update in localStorage
    const saved = localStorage.getItem(dailyRoomKey)
    if (saved) {
      try {
        const rooms: Room[] = JSON.parse(saved)
        const updatedRooms = rooms.map(r => r.id === room.id ? updated : r)
        localStorage.setItem(dailyRoomKey, JSON.stringify(updatedRooms))
      } catch {}
    }

    onSave(updated)
    onClose()
  }

  const handleDelete = () => {
    if (!room) return

    // Remove from localStorage
    const saved = localStorage.getItem(dailyRoomKey)
    if (saved) {
      try {
        const rooms: Room[] = JSON.parse(saved)
        const updatedRooms = rooms.filter(r => r.id !== room.id)
        localStorage.setItem(dailyRoomKey, JSON.stringify(updatedRooms))
      } catch {}
    }

    onDelete(room.id)
    setShowConfirmDelete(false)
    onClose()
  }

  if (!open || !room) return null

  return (
    <>
      {/* Main Modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
        <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md animate-scale-in">
          {/* Header */}
          <div className="flex items-center justify-between p-5 border-b border-gray-100">
            <div>
              <h2 className="text-xl font-bold text-gray-900">✏️ แก้ไขห้องตรวจ</h2>
              <p className="text-sm text-gray-500 mt-1">{room.name} — แก้ไขข้อมูลการทำงาน</p>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg">
              <X className="w-5 h-5 text-gray-500" />
            </button>
          </div>

          {/* Form */}
          <div className="p-5 space-y-4">
            {/* Room Info */}
            <div className="bg-gray-50 rounded-xl p-4 flex items-center gap-3">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold"
                style={{ backgroundColor: room.color }}
              >
                {room.id}
              </div>
              <span className="font-medium text-gray-900">{room.name}</span>
            </div>

            {/* Practitioner */}
            <div>
              <label className="flex items-center gap-1.5 text-sm font-semibold text-gray-700 mb-1.5">
                <User className="w-4 h-4" /> ผู้ทำหัตถการ
              </label>
              <select
                value={selectedPractitionerId}
                onChange={(e) => setSelectedPractitionerId(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:border-2 focus:outline-none text-sm bg-white"
              >
                <option value="">— เลือกผู้ทำหัตถการ —</option>
                {activePractitioners.map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>

            {/* Branch */}
            <div>
              <label className="flex items-center gap-1.5 text-sm font-semibold text-gray-700 mb-1.5">
                <Stethoscope className="w-4 h-4" /> สาขา
              </label>
              <select
                value={selectedBranchId}
                onChange={(e) => setSelectedBranchId(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:border-2 focus:outline-none text-sm bg-white"
              >
                <option value="">— เลือกสาขา —</option>
                {branches.map(b => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
            </div>

            {/* Time */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="flex items-center gap-1.5 text-sm font-semibold text-gray-700 mb-1.5">
                  <Clock className="w-4 h-4" /> เวลาเริ่ม
                </label>
                <input
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:border-2 focus:outline-none text-sm"
                />
              </div>
              <div>
                <label className="flex items-center gap-1.5 text-sm font-semibold text-gray-700 mb-1.5">
                  <Clock className="w-4 h-4" /> เวลาสิ้นสุด
                </label>
                <input
                  type="time"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:border-2 focus:outline-none text-sm"
                />
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between p-5 border-t border-gray-100">
            <button
              onClick={() => setShowConfirmDelete(true)}
              className="px-4 py-2.5 rounded-xl text-sm font-medium text-red-500 hover:bg-red-50 flex items-center gap-1.5"
            >
              <Trash2 className="w-4 h-4" /> ลบห้อง
            </button>
            <div className="flex gap-3">
              <button
                onClick={onClose}
                className="px-5 py-2.5 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-100"
              >
                ยกเลิก
              </button>
              <button
                onClick={handleSave}
                className="px-5 py-2.5 rounded-xl text-sm font-bold text-white shadow-lg hover:shadow-xl"
                style={{ backgroundColor: room.color }}
              >
                ✅ บันทึก
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Confirm Delete Modal */}
      {showConfirmDelete && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm p-6 text-center">
            <div className="w-16 h-16 rounded-full mx-auto mb-4 flex items-center justify-center bg-red-100">
              <Trash2 className="w-8 h-8 text-red-500" />
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">ลบห้องตรวจ?</h3>
            <p className="text-sm text-gray-500 mb-6">ต้องการลบ <b>{room.name}</b> ออกจากรายการวันนี้?</p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowConfirmDelete(false)}
                className="flex-1 py-3 rounded-xl font-medium text-gray-600 bg-gray-100 hover:bg-gray-200"
              >
                ยกเลิก
              </button>
              <button
                onClick={handleDelete}
                className="flex-1 py-3 rounded-xl font-bold text-white bg-red-500 hover:bg-red-600"
              >
                ลบ
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
