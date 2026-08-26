'use client'

import { useState, useMemo } from 'react'
import { X, Save, Clock, User, Stethoscope, ChevronDown, ChevronUp } from 'lucide-react'
import { clsx } from 'clsx'
import { useClinic } from '@/lib/clinic-context'
import {
  getDefaultBranchData,
  type Room,
  type Branch,
  type Practitioner,
  type Procedure,
} from '@/lib/branch-data'

interface RoomSetup {
  roomId: number
  practitionerId: string
  branchId: string
  procedureIds: string[]
  startTime: string
  endTime: string
  slotDuration: number
}

interface QuickRoomSetupProps {
  onClose: () => void
  onSave: (setups: RoomSetup[]) => void
  currentSetups?: RoomSetup[]
}

const slotOptions = [10, 15, 30, 45, 60]

export default function QuickRoomSetup({ onClose, onSave, currentSetups }: QuickRoomSetupProps) {
  const { currentClinic } = useClinic()
  const branchData = useMemo(() => getDefaultBranchData(currentClinic || 'dental'), [currentClinic])
  const activeRooms = useMemo(() => branchData.rooms.filter(r => r.active), [branchData])

  // Initialize setups from current room data or saved setups
  const [setups, setSetups] = useState<RoomSetup[]>(() => {
    if (currentSetups && currentSetups.length > 0) return currentSetups
    return activeRooms.map(room => ({
      roomId: room.id,
      practitionerId: room.practitionerId,
      branchId: room.branchId,
      procedureIds: [],
      startTime: room.workingStartTime || '09:00',
      endTime: room.workingEndTime || '17:00',
      slotDuration: room.slotDuration || 30,
    }))
  })

  const [expandedRoom, setExpandedRoom] = useState<number | null>(activeRooms.length > 0 ? activeRooms[0].id : null)

  const getPractitionerName = (id: string) => {
    const p = branchData.practitioners.find(pr => pr.id === id)
    return p?.name || ''
  }

  const getBranchName = (id: string) => {
    const b = branchData.branches.find(br => br.id === id)
    return b?.name || ''
  }

  const updateSetup = (roomId: number, updates: Partial<RoomSetup>) => {
    setSetups(prev =>
      prev.map(s => (s.roomId === roomId ? { ...s, ...updates } : s))
    )
  }

  const toggleProcedure = (roomId: number, procId: string) => {
    setSetups(prev =>
      prev.map(s => {
        if (s.roomId !== roomId) return s
        const has = s.procedureIds.includes(procId)
        return {
          ...s,
          procedureIds: has
            ? s.procedureIds.filter(id => id !== procId)
            : [...s.procedureIds, procId],
        }
      })
    )
  }

  const handleSave = () => {
    onSave(setups)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[85vh] overflow-hidden flex flex-col animate-fade-in">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-gray-100 flex-shrink-0">
          <div>
            <h2 className="text-xl font-bold text-gray-900">⚙️ ตั้งค่าห้องวันนี้</h2>
            <p className="text-base text-gray-500 mt-1">
              กำหนดผู้ทำหัตถการ สาขา เวลา และหัตถการสำหรับแต่ละห้อง
            </p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Room List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {setups.map((setup) => {
            const room = activeRooms.find(r => r.id === setup.roomId)
            if (!room) return null
            const isExpanded = expandedRoom === setup.roomId
            const practitioners = branchData.practitioners.filter(p => p.active)
            const branches = branchData.branches.filter(b => b.active)
            const selectedBranch = branches.find(b => b.id === setup.branchId)
            const procedures = selectedBranch?.procedures.filter(p => p.active) || []

            return (
              <div
                key={setup.roomId}
                className="rounded-xl border-2 transition-all"
                style={{ borderColor: isExpanded ? room.color : '#E5E7EB' }}
              >
                {/* Room Header */}
                <button
                  onClick={() => setExpandedRoom(isExpanded ? null : setup.roomId)}
                  className="w-full flex items-center gap-3 p-4 text-left hover:bg-gray-50/50 rounded-xl transition-colors"
                >
                  <div
                    className="w-10 h-10 rounded-lg flex items-center justify-center text-white text-lg font-bold flex-shrink-0"
                    style={{ backgroundColor: room.color }}
                  >
                    {room.id}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-lg font-bold text-gray-900">{room.name}</p>
                    <p className="text-sm text-gray-500">
                      {getPractitionerName(setup.practitionerId) || 'ยังไม่ได้เลือก'} · {getBranchName(setup.branchId) || 'ยังไม่ได้เลือก'}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className="text-sm text-gray-400 font-mono">
                      {setup.startTime} - {setup.endTime}
                    </span>
                    {isExpanded ? (
                      <ChevronUp className="w-5 h-5 text-gray-400" />
                    ) : (
                      <ChevronDown className="w-5 h-5 text-gray-400" />
                    )}
                  </div>
                </button>

                {/* Expanded Settings */}
                {isExpanded && (
                  <div className="px-4 pb-4 space-y-4 border-t border-gray-100">
                    {/* Practitioner */}
                    <div className="pt-3">
                      <label className="flex items-center gap-2 text-base font-semibold text-gray-700 mb-2">
                        <User className="w-4 h-4" /> ผู้ทำหัตถการ
                      </label>
                      <select
                        value={setup.practitionerId}
                        onChange={(e) => updateSetup(setup.roomId, { practitionerId: e.target.value })}
                        className="w-full px-4 py-2.5 rounded-lg border border-gray-200 focus:border-primary-400 focus:outline-none text-base bg-white"
                      >
                        <option value="">— เลือกผู้ทำหัตถการ —</option>
                        {practitioners.map(p => (
                          <option key={p.id} value={p.id}>{p.name}</option>
                        ))}
                      </select>
                    </div>

                    {/* Branch */}
                    <div>
                      <label className="flex items-center gap-2 text-base font-semibold text-gray-700 mb-2">
                        <Stethoscope className="w-4 h-4" /> สาขา
                      </label>
                      <select
                        value={setup.branchId}
                        onChange={(e) => updateSetup(setup.roomId, { branchId: e.target.value, procedureIds: [] })}
                        className="w-full px-4 py-2.5 rounded-lg border border-gray-200 focus:border-primary-400 focus:outline-none text-base bg-white"
                      >
                        <option value="">— เลือกสาขา —</option>
                        {branches.map(b => (
                          <option key={b.id} value={b.id}>{b.name}</option>
                        ))}
                      </select>
                    </div>

                    {/* Procedures */}
                    {procedures.length > 0 && (
                      <div>
                        <label className="flex items-center gap-2 text-base font-semibold text-gray-700 mb-2">
                          🩺 หัตถการที่ทำได้
                        </label>
                        <div className="flex flex-wrap gap-2">
                          {procedures.map(proc => {
                            const isSelected = setup.procedureIds.includes(proc.id)
                            return (
                              <button
                                key={proc.id}
                                onClick={() => toggleProcedure(setup.roomId, proc.id)}
                                className={clsx(
                                  'px-3 py-1.5 rounded-full text-sm font-medium border-2 transition-all',
                                  isSelected
                                    ? 'text-white shadow-sm'
                                    : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
                                )}
                                style={isSelected ? { backgroundColor: room.color, borderColor: room.color } : {}}
                              >
                                {proc.name} <span className="opacity-70">({proc.estimatedDuration}น.)</span>
                              </button>
                            )
                          })}
                        </div>
                      </div>
                    )}

                    {/* Time & Slot */}
                    <div className="grid grid-cols-3 gap-3">
                      <div>
                        <label className="flex items-center gap-1 text-sm font-semibold text-gray-700 mb-1">
                          <Clock className="w-3.5 h-3.5" /> เวลาเริ่ม
                        </label>
                        <input
                          type="time"
                          value={setup.startTime}
                          onChange={(e) => updateSetup(setup.roomId, { startTime: e.target.value })}
                          className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:border-primary-400 focus:outline-none text-base"
                        />
                      </div>
                      <div>
                        <label className="flex items-center gap-1 text-sm font-semibold text-gray-700 mb-1">
                          <Clock className="w-3.5 h-3.5" /> เวลาสิ้นสุด
                        </label>
                        <input
                          type="time"
                          value={setup.endTime}
                          onChange={(e) => updateSetup(setup.roomId, { endTime: e.target.value })}
                          className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:border-primary-400 focus:outline-none text-base"
                        />
                      </div>
                      <div>
                        <label className="flex items-center gap-1 text-sm font-semibold text-gray-700 mb-1">
                          ⏱️ Slot ละ
                        </label>
                        <select
                          value={setup.slotDuration}
                          onChange={(e) => updateSetup(setup.roomId, { slotDuration: parseInt(e.target.value) })}
                          className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:border-primary-400 focus:outline-none text-base"
                        >
                          {slotOptions.map(s => (
                            <option key={s} value={s}>{s} นาที</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 p-5 border-t border-gray-100 flex-shrink-0">
          <button
            onClick={onClose}
            className="px-5 py-2.5 rounded-lg text-base font-medium text-gray-600 hover:bg-gray-100"
          >
            ยกเลิก
          </button>
          <button
            onClick={handleSave}
            className="flex items-center gap-2 px-6 py-2.5 rounded-lg text-base font-bold bg-emerald-700 text-white hover:bg-emerald-800 shadow-lg transition-all"
          >
            <Save className="w-5 h-5" /> บันทึกการตั้งค่า
          </button>
        </div>
      </div>
    </div>
  )
}
