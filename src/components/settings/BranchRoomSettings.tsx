'use client'

import { useState, useMemo } from 'react'
import {
  Plus, Edit, Trash2, X, AlertTriangle, Stethoscope,
  DoorOpen, ChevronDown, ChevronRight, Check,
} from 'lucide-react'
import { clsx } from 'clsx'
import { useClinic } from '@/lib/clinic-context'
import {
  type Branch, type Practitioner, type Room, type Procedure,
  type ClinicBranchData,
  getDefaultBranchData,
} from '@/lib/branch-data'
import Toast from '@/components/ui/Toast'

export default function BranchRoomSettings() {
  const { config, currentClinic } = useClinic()
  const [data, setData] = useState<ClinicBranchData>(() => getDefaultBranchData(currentClinic || 'dental'))
  const [expandedBranch, setExpandedBranch] = useState<string | null>(data.branches[0]?.id || null)
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null)

  // Modals
  const [showBranchModal, setShowBranchModal] = useState(false)
  const [editingBranch, setEditingBranch] = useState<Branch | null>(null)
  const [branchForm, setBranchForm] = useState({ name: '' })

  const [showProcedureModal, setShowProcedureModal] = useState(false)
  const [editingProcedure, setEditingProcedure] = useState<{ branchId: string; procedure: Procedure | null }>({ branchId: '', procedure: null })
  const [procForm, setProcForm] = useState({ name: '', estimatedDuration: 30 })

  const [showRoomModal, setShowRoomModal] = useState(false)
  const [editingRoom, setEditingRoom] = useState<Room | null>(null)
  const [roomForm, setRoomForm] = useState({ name: '', color: '#0891B2', image: '' })

  const [confirmDelete, setConfirmDelete] = useState<{ type: 'branch' | 'procedure' | 'room'; id: string; branchId?: string } | null>(null)

  const showToast = (msg: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToast({ msg, type } as any)
    setToast({ message: msg, type })
    setTimeout(() => setToast(null), 3000)
  }

  const getBranchName = (branchId: string) => data.branches.find(b => b.id === branchId)?.name || '—'
  const getPractitionerName = (id: string) => data.practitioners.find(p => p.id === id)?.name || '—'

  /* ───── Branch CRUD ───── */
  const saveBranch = () => {
    if (!branchForm.name.trim()) { showToast('กรุณากรอกชื่อสาขา', 'error'); return }
    if (editingBranch) {
      setData(prev => ({ ...prev, branches: prev.branches.map(b => b.id === editingBranch.id ? { ...b, name: branchForm.name } : b) }))
      showToast('แก้ไขสาขาสำเร็จ!')
    } else {
      const newBranch: Branch = { id: `branch-${Date.now()}`, name: branchForm.name, category: currentClinic || 'dental', procedures: [], active: true }
      setData(prev => ({ ...prev, branches: [...prev.branches, newBranch] }))
      showToast('เพิ่มสาขาสำเร็จ!')
    }
    setShowBranchModal(false)
  }

  /* ───── Procedure CRUD ───── */
  const saveProcedure = () => {
    if (!procForm.name.trim()) { showToast('กรุณากรอกชื่อหัตถการ', 'error'); return }
    const { branchId, procedure } = editingProcedure
    if (procedure) {
      setData(prev => ({
        ...prev,
        branches: prev.branches.map(b => b.id === branchId
          ? { ...b, procedures: b.procedures.map(p => p.id === procedure.id ? { ...p, name: procForm.name, estimatedDuration: procForm.estimatedDuration } : p) }
          : b
        ),
      }))
      showToast('แก้ไขหัตถการสำเร็จ!')
    } else {
      const newProc: Procedure = { id: `proc-${Date.now()}`, name: procForm.name, estimatedDuration: procForm.estimatedDuration, active: true }
      setData(prev => ({
        ...prev,
        branches: prev.branches.map(b => b.id === branchId ? { ...b, procedures: [...b.procedures, newProc] } : b),
      }))
      showToast('เพิ่มหัตถการสำเร็จ!')
    }
    setShowProcedureModal(false)
  }

  const toggleProcedure = (branchId: string, procId: string) => {
    setData(prev => ({
      ...prev,
      branches: prev.branches.map(b => b.id === branchId
        ? { ...b, procedures: b.procedures.map(p => p.id === procId ? { ...p, active: !p.active } : p) }
        : b
      ),
    }))
  }

  /* ───── Room CRUD ───── */
  const saveRoom = () => {
    if (!roomForm.name) {
      showToast('กรุณากรอกชื่อห้อง', 'error'); return
    }
    if (editingRoom) {
      setData(prev => ({
        ...prev,
        rooms: prev.rooms.map(r => r.id === editingRoom.id ? { ...r, name: roomForm.name, color: roomForm.color, image: roomForm.image || undefined } : r),
      }))
      showToast('แก้ไขห้องสำเร็จ!')
    } else {
      const maxId = Math.max(0, ...data.rooms.map(r => r.id))
      const newRoom: Room = { id: maxId + 1, name: roomForm.name, color: roomForm.color, image: roomForm.image || undefined, branchId: '', practitionerId: '', slotDuration: 30, workingStartTime: '09:00', workingEndTime: '17:00', active: true }
      setData(prev => ({ ...prev, rooms: [...prev.rooms, newRoom] }))
      showToast('เพิ่มห้องสำเร็จ!')
    }
    setShowRoomModal(false)
  }

  const handleRoomImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) {
      showToast('กรุณาเลือกไฟล์รูปภาพ', 'error')
      return
    }
    if (file.size > 500 * 1024) {
      showToast('ขนาดไฟล์ต้องไม่เกิน 500 KB', 'error')
      return
    }
    const reader = new FileReader()
    reader.onload = (ev) => {
      setRoomForm(prev => ({ ...prev, image: ev.target?.result as string }))
    }
    reader.readAsDataURL(file)
  }

  const handleDelete = () => {
    if (!confirmDelete) return
    const { type, id, branchId } = confirmDelete
    if (type === 'branch') {
      setData(prev => ({ ...prev, branches: prev.branches.filter(b => b.id !== id), rooms: prev.rooms.filter(r => r.branchId !== id) }))
      showToast('ลบสาขาแล้ว', 'info')
    } else if (type === 'procedure') {
      setData(prev => ({
        ...prev,
        branches: prev.branches.map(b => b.id === branchId ? { ...b, procedures: b.procedures.filter(p => p.id !== id) } : b),
      }))
      showToast('ลบหัตถการแล้ว', 'info')
    } else if (type === 'room') {
      setData(prev => ({ ...prev, rooms: prev.rooms.filter(r => r.id !== Number(id)) }))
      showToast('ลบห้องแล้ว', 'info')
    }
    setConfirmDelete(null)
  }

  if (!config) return null

  return (
    <div className="space-y-6">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      {/* ─── Branch Modal ─── */}
      {showBranchModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between p-6 border-b border-gray-100">
              <h2 className="text-xl font-bold">{editingBranch ? 'แก้ไขสาขา' : 'เพิ่มสาขาใหม่'}</h2>
              <button onClick={() => setShowBranchModal(false)} className="p-2 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">ชื่อสาขาและหัตถการ *</label>
                <input type="text" value={branchForm.name} onChange={(e) => setBranchForm({ name: e.target.value })} placeholder="เช่น ทันตกรรมจัดฟัน" className="input-field" />
              </div>
            </div>
            <div className="flex justify-end gap-3 p-6 border-t border-gray-100">
              <button onClick={() => setShowBranchModal(false)} className="btn-secondary">ยกเลิก</button>
              <button onClick={saveBranch} className="btn-primary" style={{ backgroundColor: config.color }}>บันทึก</button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Procedure Modal ─── */}
      {showProcedureModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between p-6 border-b border-gray-100">
              <h2 className="text-xl font-bold">{editingProcedure.procedure ? 'แก้ไขหัตถการ' : 'เพิ่มหัตถการ'}</h2>
              <button onClick={() => setShowProcedureModal(false)} className="p-2 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">ชื่อหัตถการ *</label>
                <input type="text" value={procForm.name} onChange={(e) => setProcForm({ ...procForm, name: e.target.value })} placeholder="เช่น ขูดหินปูน" className="input-field" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">ระยะเวลา (นาที)</label>
                <select value={procForm.estimatedDuration} onChange={(e) => setProcForm({ ...procForm, estimatedDuration: Number(e.target.value) })} className="input-field">
                  {[10, 15, 20, 30, 45, 60, 90].map(d => <option key={d} value={d}>{d} นาที</option>)}
                </select>
              </div>
            </div>
            <div className="flex justify-end gap-3 p-6 border-t border-gray-100">
              <button onClick={() => setShowProcedureModal(false)} className="btn-secondary">ยกเลิก</button>
              <button onClick={saveProcedure} className="btn-primary" style={{ backgroundColor: config.color }}>บันทึก</button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Room Modal ─── */}
      {showRoomModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm">
            <div className="flex items-center justify-between p-6 border-b border-gray-100">
              <h2 className="text-xl font-bold">{editingRoom ? 'แก้ไขห้อง' : 'เพิ่มห้องใหม่'}</h2>
              <button onClick={() => setShowRoomModal(false)} className="p-2 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">ชื่อห้อง *</label>
                <input type="text" value={roomForm.name} onChange={(e) => setRoomForm({ ...roomForm, name: e.target.value })} placeholder="เช่น ห้อง 1" className="input-field" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">สีประจำห้อง</label>
                <div className="flex items-center gap-3">
                  <input type="color" value={roomForm.color} onChange={(e) => setRoomForm({ ...roomForm, color: e.target.value })} className="w-12 h-12 rounded-lg cursor-pointer border border-gray-200" />
                  <div className="flex-1">
                    <div className="h-8 rounded-lg" style={{ backgroundColor: roomForm.color }} />
                    <p className="text-[10px] text-gray-400 mt-1">ตัวอย่างสี</p>
                  </div>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">รูปห้องตรวจ <span className="text-gray-400 font-normal">(ไม่บังคับ)</span></label>
                <div className="flex items-center gap-3">
                  {roomForm.image ? (
                    <div className="relative">
                      <img src={roomForm.image} alt="ห้อง" className="w-20 h-20 rounded-xl object-cover border border-gray-200" />
                      <button
                        onClick={() => setRoomForm(prev => ({ ...prev, image: '' }))}
                        className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center text-xs hover:bg-red-600"
                      >×</button>
                    </div>
                  ) : (
                    <label className="w-20 h-20 rounded-xl border-2 border-dashed border-gray-300 flex flex-col items-center justify-center cursor-pointer hover:border-primary-400 hover:bg-gray-50 transition-colors">
                      <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      <span className="text-[9px] text-gray-400 mt-1">เลือกรูป</span>
                      <input type="file" accept="image/png,image/jpeg" className="hidden" onChange={handleRoomImageUpload} />
                    </label>
                  )}
                  <div className="flex-1 text-xs text-gray-500">
                    <p>รองรับ PNG หรือ JPEG</p>
                    <p>ขนาดไม่เกิน 500 KB</p>
                  </div>
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-3 p-6 border-t border-gray-100">
              <button onClick={() => setShowRoomModal(false)} className="btn-secondary">ยกเลิก</button>
              <button onClick={saveRoom} className="btn-primary" style={{ backgroundColor: config.color }}>บันทึก</button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Delete Confirmation ─── */}
      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center"><AlertTriangle className="w-5 h-5 text-red-500" /></div>
              <h3 className="text-lg font-bold">ยืนยันการลบ</h3>
            </div>
            <p className="text-gray-600 mb-6">ต้องการลบรายการนี้ใช่หรือไม่?</p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setConfirmDelete(null)} className="btn-secondary">ยกเลิก</button>
              <button onClick={handleDelete} className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 font-medium">ลบ</button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Branches Section ─── */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">สาขาและหัตถการ</h3>
            <p className="text-sm text-gray-500">จัดการสาขา หัตถการ และผู้ทำหัตถการ</p>
          </div>
          <button onClick={() => { setEditingBranch(null); setBranchForm({ name: '' }); setShowBranchModal(true) }} className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white" style={{ backgroundColor: config.color }}>
            <Plus className="w-4 h-4" /> เพิ่มสาขา
          </button>
        </div>

        <div className="space-y-3">
          {data.branches.map((branch) => {
            const isExpanded = expandedBranch === branch.id
            const practitioner = data.practitioners.find(p => p.branchId === branch.id)
            return (
              <div key={branch.id} className="rounded-xl overflow-hidden border-2" style={{ borderColor: isExpanded ? config.color : '#E5E7EB' }}>
                {/* Branch Header */}
                <div className="flex items-center justify-between p-4 cursor-pointer transition-colors" style={{ backgroundColor: isExpanded ? `${config.color}08` : '#FAFAFA' }} onClick={() => setExpandedBranch(isExpanded ? null : branch.id)}>
                  <div className="flex items-center gap-3">
                    {isExpanded ? <ChevronDown className="w-4 h-4" style={{ color: config.color }} /> : <ChevronRight className="w-4 h-4 text-gray-400" />}
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ backgroundColor: config.color }}>
                      <Stethoscope className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <p className="font-bold text-base" style={{ color: config.color }}>{branch.name}</p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        <span className="font-medium text-gray-700">{branch.procedures.filter(p => p.active).length} หัตถการ</span>
                        {practitioner && <><span className="text-gray-300 mx-1">•</span><span>{practitioner.name}</span></>}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                    <button onClick={() => { setEditingBranch(branch); setBranchForm({ name: branch.name }); setShowBranchModal(true) }} className="p-2 hover:bg-gray-100 rounded-lg"><Edit className="w-4 h-4 text-gray-500" /></button>
                    <button onClick={() => setConfirmDelete({ type: 'branch', id: branch.id })} className="p-2 hover:bg-red-50 rounded-lg"><Trash2 className="w-4 h-4 text-gray-400 hover:text-red-500" /></button>
                  </div>
                </div>

                {/* Branch Content */}
                {isExpanded && (
                  <div className="border-t border-dashed p-4 space-y-2" style={{ borderColor: `${config.color}30`, backgroundColor: 'white' }}>
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: config.color }}>🩺 รายการหัตถการของ{branch.name}</p>
                      <button onClick={() => { setEditingProcedure({ branchId: branch.id, procedure: null }); setProcForm({ name: '', estimatedDuration: 30 }); setShowProcedureModal(true) }} className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium text-white" style={{ backgroundColor: config.color }}>
                        <Plus className="w-3 h-3" /> เพิ่มหัตถการ
                      </button>
                    </div>
                    {branch.procedures.length === 0 && <p className="text-sm text-gray-400 text-center py-4">ยังไม่มีหัตถการ</p>}
                    {branch.procedures.map(proc => (
                      <div key={proc.id} className="flex items-center justify-between py-2.5 px-3 rounded-lg hover:bg-gray-50 transition-colors">
                        <div className="flex items-center gap-3">
                          <div className="w-5 h-5 rounded flex items-center justify-center border" style={{ borderColor: proc.active ? config.color : '#D1D5DB', backgroundColor: proc.active ? `${config.color}15` : 'transparent' }}>
                            <div className={clsx('w-2 h-2 rounded-sm', proc.active ? '' : 'bg-gray-300')} style={proc.active ? { backgroundColor: config.color } : {}} />
                          </div>
                          <span className={clsx('text-sm', proc.active ? 'font-medium text-gray-900' : 'text-gray-400 line-through')}>{proc.name}</span>
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-500 font-medium">{proc.estimatedDuration} น.</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => toggleProcedure(branch.id, proc.id)}
                            className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${proc.active ? 'bg-emerald-500' : 'bg-gray-300'}`}
                            title={proc.active ? 'ปิดใช้งานหัตถการ' : 'เปิดใช้งานหัตถการ'}
                          >
                            <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${proc.active ? 'translate-x-4' : 'translate-x-0.5'}`} />
                          </button>
                          <button onClick={() => { setEditingProcedure({ branchId: branch.id, procedure: proc }); setProcForm({ name: proc.name, estimatedDuration: proc.estimatedDuration }); setShowProcedureModal(true) }} className="p-1 hover:bg-gray-200 rounded"><Edit className="w-3 h-3 text-gray-500" /></button>
                          <button onClick={() => setConfirmDelete({ type: 'procedure', id: proc.id, branchId: branch.id })} className="p-1 hover:bg-red-100 rounded"><Trash2 className="w-3 h-3 text-gray-400 hover:text-red-500" /></button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* ─── Rooms Section ─── */}
      <div className="pt-6 border-t border-gray-100">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">ห้องตรวจ</h3>
            <p className="text-sm text-gray-500">กำหนดห้อง สาขาที่รับผิดชอบ และผู้ทำหัตถการ</p>
          </div>
          <button onClick={() => { setEditingRoom(null); setRoomForm({ name: '', color: config.color, image: '' }); setShowRoomModal(true) }} className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white" style={{ backgroundColor: config.color }}>
            <Plus className="w-4 h-4" /> เพิ่มห้อง
          </button>
        </div>

        <div className="space-y-3">
          {data.rooms.filter(r => r.active).map(room => (
            <div key={room.id} className="flex items-center justify-between p-4 border border-gray-100 rounded-xl hover:bg-gray-50">
              <div className="flex items-center gap-4">
                {room.image ? (
                  <img src={room.image} alt={room.name} className="w-12 h-12 rounded-xl object-cover border border-gray-200" />
                ) : (
                  <div className="w-12 h-12 rounded-xl flex items-center justify-center text-white font-bold text-sm" style={{ backgroundColor: room.color }}>
                    {room.id}
                  </div>
                )}
                <div>
                  <p className="font-medium text-gray-900">{room.name}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <div className="w-3 h-3 rounded-full border border-gray-200" style={{ backgroundColor: room.color }} />
                    <span className="text-xs text-gray-500">สีประจำห้อง</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => { setEditingRoom(room); setRoomForm({ name: room.name, color: room.color, image: room.image || '' }); setShowRoomModal(true) }} className="p-2 hover:bg-gray-100 rounded-lg"><Edit className="w-4 h-4 text-gray-500" /></button>
                <button onClick={() => setConfirmDelete({ type: 'room', id: String(room.id) })} className="p-2 hover:bg-red-50 rounded-lg"><Trash2 className="w-4 h-4 text-gray-400 hover:text-red-500" /></button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
