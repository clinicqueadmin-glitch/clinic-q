'use client'

import { useState, useMemo, useEffect } from 'react'
import { X, Clock, User, Stethoscope, AlertTriangle } from 'lucide-react'
import { useClinic } from '@/lib/clinic-context'
import { getDefaultBranchData, type Room } from '@/lib/branch-data'
import { usePractitioners } from '@/lib/practitioner-context'

interface AddRoomModalProps {
  open: boolean
  onClose: () => void
  onSave: () => void
}

export default function AddRoomModal({ open, onClose, onSave }: AddRoomModalProps) {
  const { currentClinic, settings } = useClinic()
  const { practitioners } = usePractitioners()
  const branchData = useMemo(() => getDefaultBranchData(currentClinic || 'dental'), [currentClinic])

  // Read rooms from RoomSettings (localStorage - source of truth for room info)
  const [savedRooms] = useState<Room[]>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('clinic-rooms')
      if (saved) {
        try { return JSON.parse(saved) } catch {}
      }
    }
    return branchData.rooms
  })

  // Read daily room schedule from separate localStorage key
  const [dailyRooms, setDailyRooms] = useState<Room[]>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('clinic-daily-rooms')
      if (saved) {
        try { return JSON.parse(saved) } catch {}
      }
    }
    return []
  })

  const [selectedRoomId, setSelectedRoomId] = useState<number | ''>('')
  const [selectedPractitionerId, setSelectedPractitionerId] = useState('')
  const [selectedBranchId, setSelectedBranchId] = useState('')
  const [startTime, setStartTime] = useState(settings.openTime || '09:00')
  const [endTime, setEndTime] = useState(settings.closeTime || '17:00')

  // Confirm modal
  const [showConfirm, setShowConfirm] = useState(false)

  // Filter out practitioners already assigned to other daily rooms
  const activePractitioners = useMemo(() => {
    const assignedIds = new Set(
      dailyRooms.filter(r => r.active && r.practitionerId).map(r => r.practitionerId)
    )
    return practitioners.filter(p => p.active && !assignedIds.has(p.id))
  }, [practitioners, dailyRooms])
  const branches = branchData.branches.filter(b => b.active)

  // Get selected room data from RoomSettings
  const selectedRoom = useMemo(() => {
    if (selectedRoomId === '') return null
    return savedRooms.find(r => r.id === selectedRoomId) || null
  }, [selectedRoomId, savedRooms])

  // Get display names
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

  // Auto-fill from room settings when room is selected
  useEffect(() => {
    if (selectedRoom) {
      setSelectedPractitionerId(selectedRoom.practitionerId || '')
      setSelectedBranchId(selectedRoom.branchId || '')
      setStartTime(selectedRoom.workingStartTime || '09:00')
      setEndTime(selectedRoom.workingEndTime || '17:00')
    }
  }, [selectedRoom])

  // Available rooms (rooms that are active in RoomSettings AND not already selected today)
  const availableRooms = useMemo(() => {
    const usedRoomIds = new Set(dailyRooms.filter(r => r.active).map(r => r.id))
    return savedRooms.filter(r => r.active && !usedRoomIds.has(r.id))
  }, [savedRooms, dailyRooms])

  // Show confirm dialog before saving
  const handleConfirm = () => {
    if (selectedRoomId === '' || !selectedRoom) return
    setShowConfirm(true)
  }

  // Actually save after confirmation
  const handleSave = () => {
    if (selectedRoomId === '' || !selectedRoom) return
    
    // Create daily room entry with room info from RoomSettings + user selections
    const dailyRoom: Room = {
      id: selectedRoom.id,
      name: selectedRoom.name,
      color: selectedRoom.color,
      image: selectedRoom.image,
      practitionerId: selectedPractitionerId,
      practitionerName,
      branchId: selectedBranchId,
      workingStartTime: startTime,
      workingEndTime: endTime,
      slotDuration: selectedRoom.slotDuration || 30,
      active: true,
    }

    // Save to daily rooms localStorage
    const updatedDailyRooms = [...dailyRooms, dailyRoom]
    setDailyRooms(updatedDailyRooms)
    localStorage.setItem('clinic-daily-rooms', JSON.stringify(updatedDailyRooms))

    // Callback to refresh parent
    onSave()
    
    // Reset
    setSelectedRoomId('')
    setSelectedPractitionerId('')
    setSelectedBranchId('')
    setStartTime(settings.openTime || '09:00')
    setEndTime(settings.closeTime || '17:00')
    setShowConfirm(false)
    onClose()
  }

  if (!open) return null

  return (
    <>
      {/* Main Modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
        <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md animate-scale-in">
          {/* Header */}
          <div className="flex items-center justify-between p-5 border-b border-gray-100">
            <div>
              <h2 className="text-xl font-bold text-gray-900">🏥 เพิ่มห้องตรวจวันนี้</h2>
              <p className="text-sm text-gray-500 mt-1">เลือกห้องตรวจและกำหนดข้อมูลการทำงาน</p>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg">
              <X className="w-5 h-5 text-gray-500" />
            </button>
          </div>

          {/* Daily Setup Banner */}
          <div className="mx-5 mt-4 p-3 bg-blue-50 border border-blue-100 rounded-xl">
            <p className="text-xs text-blue-700 font-medium">
              📅 การจัดห้องตรวจทำทุกวัน — ข้อมูลจะถูกรีเซ็ตเมื่อเริ่มวันใหม่หรือเลยเวลาปิดทำการ
            </p>
          </div>

          {/* Form */}
          <div className="p-5 space-y-4 max-h-[70vh] overflow-y-auto">
            {/* Room Selection */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">📝 เลือกห้องตรวจ *</label>
              <select
                value={selectedRoomId}
                onChange={(e) => setSelectedRoomId(e.target.value ? Number(e.target.value) : '')}
                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:border-2 focus:outline-none text-sm bg-white"
              >
                <option value="">— เลือกห้องตรวจ —</option>
                {availableRooms.length === 0 ? (
                  <option value="" disabled>✅ เลือกห้องครบทุกห้องแล้ว</option>
                ) : (
                  availableRooms.map(room => (
                    <option key={room.id} value={room.id}>{room.name}</option>
                  ))
                )}
              </select>
            </div>

            {/* Show selected room info */}
            {selectedRoom && (
              <div className="bg-gray-50 rounded-xl p-4">
                <div className="flex items-center gap-3">
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold"
                    style={{ backgroundColor: selectedRoom.color }}
                  >
                    {selectedRoom.id}
                  </div>
                  <span className="font-medium text-gray-900">{selectedRoom.name}</span>
                </div>
              </div>
            )}

            {/* Practitioner - from User Management (localStorage) */}
            <div>
              <label className="flex items-center gap-1.5 text-sm font-semibold text-gray-700 mb-1.5">
                <User className="w-4 h-4" /> ผู้ทำหัตถการ (จากจัดการผู้ใช้)
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
          <div className="flex justify-end gap-3 p-5 border-t border-gray-100">
            <button
              onClick={onClose}
              className="px-5 py-2.5 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-100 transition-colors"
            >
              ยกเลิก
            </button>
            <button
              onClick={handleConfirm}
              disabled={!selectedRoomId}
              className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-bold text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-xl"
              style={{ backgroundColor: selectedRoom ? selectedRoom.color : '#9CA3AF' }}
            >
              ✅ เพิ่มห้องตรวจ
            </button>
          </div>
        </div>
      </div>

      {/* Confirm Modal */}
      {showConfirm && selectedRoom && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm animate-scale-in">
            <div className="p-6 text-center">
              <div className="w-16 h-16 rounded-full mx-auto mb-4 flex items-center justify-center bg-amber-100">
                <AlertTriangle className="w-8 h-8 text-amber-600" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">ยืนยันการเพิ่มห้องตรวจ</h3>
              <p className="text-sm text-gray-500 mb-4">ตรวจสอบข้อมูลก่อนยืนยัน</p>
              
              {/* Summary */}
              <div className="bg-gray-50 rounded-xl p-4 text-left space-y-2 mb-6">
                <div className="flex items-center gap-3">
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold"
                    style={{ backgroundColor: selectedRoom.color }}
                  >
                    {selectedRoom.id}
                  </div>
                  <span className="font-medium text-gray-900">{selectedRoom.name}</span>
                </div>
                {practitionerName && (
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <User className="w-4 h-4 text-gray-400" />
                    <span>{practitionerName}</span>
                  </div>
                )}
                {branchName && (
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <Stethoscope className="w-4 h-4 text-gray-400" />
                    <span>{branchName}</span>
                  </div>
                )}
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <Clock className="w-4 h-4 text-gray-400" />
                  <span>{startTime} - {endTime}</span>
                </div>
              </div>

              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 mb-6">
                <p className="text-xs text-amber-700 font-medium">⚠️ เมื่อยืนยันแล้วจะไม่สามารถแก้ไขได้</p>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setShowConfirm(false)}
                  className="flex-1 py-3 rounded-xl font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 transition-colors"
                >
                  ยกเลิก
                </button>
                <button
                  onClick={handleSave}
                  className="flex-1 py-3 rounded-xl font-bold text-white transition-all shadow-lg hover:shadow-xl"
                  style={{ backgroundColor: selectedRoom.color }}
                >
                  ✅ ยืนยัน
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
