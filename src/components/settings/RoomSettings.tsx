'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { Plus, Edit, Trash2, X } from 'lucide-react'
import { useClinic } from '@/lib/clinic-context'
import { useAuth } from '@/lib/auth-context'
import type { Room } from '@/lib/branch-data'
import Toast from '@/components/ui/Toast'
import SaveResultModal from '@/components/ui/SaveResultModal'
import { isSupabaseReady, getSupabase } from '@/lib/supabase'

const roomColors = ['#0891B2', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#22C55E', '#3B82F6']

const defaultRooms: Room[] = [
  { id: 1, name: 'ห้อง 1', color: '#0891B2', branchId: '', practitionerId: '', slotDuration: 30, workingStartTime: '09:00', workingEndTime: '17:00', active: true },
  { id: 2, name: 'ห้อง 2', color: '#10B981', branchId: '', practitionerId: '', slotDuration: 30, workingStartTime: '09:00', workingEndTime: '17:00', active: true },
  { id: 3, name: 'ห้อง 3', color: '#F59E0B', branchId: '', practitionerId: '', slotDuration: 30, workingStartTime: '09:00', workingEndTime: '17:00', active: true },
  { id: 4, name: 'ห้อง 4', color: '#EF4444', branchId: '', practitionerId: '', slotDuration: 30, workingStartTime: '09:00', workingEndTime: '17:00', active: true },
  { id: 5, name: 'ห้อง 5', color: '#8B5CF6', branchId: '', practitionerId: '', slotDuration: 30, workingStartTime: '09:00', workingEndTime: '17:00', active: true },
]

export default function RoomSettings() {
  const { config } = useClinic()
  const { currentClinicId } = useAuth()

  const storageKey = currentClinicId ? `clinic-rooms-${currentClinicId}` : 'clinic-rooms'

  const [rooms, setRooms] = useState<Room[]>(defaultRooms)
  const roomsRef = useRef(rooms)
  useEffect(() => { roomsRef.current = rooms }, [rooms])

  const [hydrated, setHydrated] = useState(false)
  const hydratedRef = useRef(false)

  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null)
  const [saveResult, setSaveResult] = useState<{ success: boolean; retry?: () => void } | null>(null)
  const [saving, setSaving] = useState(false)

  // Room modal
  const [showRoomModal, setShowRoomModal] = useState(false)
  const [editingRoom, setEditingRoom] = useState<Room | null>(null)
  const [roomForm, setRoomForm] = useState({ name: '', color: '#0891B2', image: '' })
  const [pendingImageFile, setPendingImageFile] = useState<File | null>(null)

  // Delete confirmation
  const [confirmDelete, setConfirmDelete] = useState<number | null>(null)

  // ── Load rooms: Supabase first, localStorage fallback, defaults last ──
  useEffect(() => {
    let cancelled = false
    const load = async () => {
      if (cancelled) return
      // 1. Supabase first
      if (currentClinicId && isSupabaseReady()) {
        try {
          const sb = getSupabase()
          if (sb) {
            const { data: row } = await sb
              .from('clinic_settings')
              .select('setting_value')
              .eq('clinic_id', currentClinicId)
              .eq('setting_key', 'rooms')
              .maybeSingle()
            if (cancelled) return
            const raw = row?.setting_value
            let remote: Room[] | null = null
            if (typeof raw === 'string') {
              try { remote = JSON.parse(raw) } catch {}
            } else if (Array.isArray(raw) && raw.length > 0) {
              remote = raw as unknown as Room[]
            }
            if (remote && remote.length > 0) {
              setRooms(remote)
              hydratedRef.current = true
              setHydrated(true)
              return
            }
          }
        } catch {}
      }
      if (cancelled) return
      // 2. localStorage fallback
      const saved = localStorage.getItem(storageKey)
      if (saved) {
        try {
          const parsed = JSON.parse(saved)
          if (Array.isArray(parsed) && parsed.length > 0) {
            setRooms(parsed)
            hydratedRef.current = true
            setHydrated(true)
            return
          }
        } catch {}
      }
      // 3. Defaults — display only, never auto-persisted
      if (cancelled) return
      setRooms(defaultRooms)
      hydratedRef.current = true
      setHydrated(true)
    }
    load()
    return () => { cancelled = true }
  }, [storageKey, currentClinicId])

  // localStorage cache only (fast reads). DB persistence via commitData().
  useEffect(() => {
    if (!hydrated) return
    try { localStorage.setItem(storageKey, JSON.stringify(rooms)) } catch {}
  }, [rooms, storageKey, hydrated])

  // ── Atomic upsert to Supabase ──
  const commitData = useCallback(async (): Promise<boolean> => {
    const latest = roomsRef.current
    let ok = true
    try {
      try { localStorage.setItem(storageKey, JSON.stringify(latest)) } catch {}
      if (currentClinicId && isSupabaseReady()) {
        const sb = getSupabase()
        if (sb) {
          const { error } = await sb.from('clinic_settings').upsert(
            { clinic_id: currentClinicId, setting_key: 'rooms', setting_value: latest as any },
            { onConflict: 'clinic_id,setting_key' }
          )
          ok = !error
        }
      }
    } catch { ok = false }
    return ok
  }, [storageKey, currentClinicId, isSupabaseReady])

  // ── Upload image to Storage, return public URL ──
  const uploadRoomImage = async (roomId: number, file: File): Promise<string | null> => {
    if (!currentClinicId) return null
    try {
      const fd = new FormData()
      fd.append('file', file)
      fd.append('roomId', String(roomId))
      const res = await fetch(`/api/clinics/${encodeURIComponent(currentClinicId)}/rooms/image`, { method: 'POST', body: fd })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) return null
      return data.url || null
    } catch { return null }
  }

  // ── Save rooms with optional pending image ──
  const handleSave = useCallback(async () => {
    if (!hydratedRef.current) return
    setSaving(true)
    try {
      let latest = roomsRef.current
      // If there's a pending image, upload to Storage first
      if (pendingImageFile) {
        const editingId = editingRoom?.id || (Math.max(0, ...latest.map(r => r.id)) + 1)
        const url = await uploadRoomImage(editingId, pendingImageFile)
        if (url) {
          // Replace the image URL in the room that was just edited
          latest = latest.map(r => r.id === editingId ? { ...r, image: url } : r)
          roomsRef.current = latest
          setRooms(latest)
          // Also update localStorage immediately
          try { localStorage.setItem(storageKey, JSON.stringify(latest)) } catch {}
        }
      }
      setPendingImageFile(null)
      const ok = await commitData()
      setSaveResult(ok
        ? { success: true }
        : { success: false, retry: () => { void handleSave() } })
    } catch {
      setSaveResult({ success: false, retry: () => { void handleSave() } })
    } finally {
      setSaving(false)
    }
  }, [commitData, pendingImageFile, editingRoom, storageKey])

  const showToast = (msg: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToast({ message: msg, type })
    setTimeout(() => setToast(null), 3000)
  }

  /* ───── Branch CRUD (for future use if rooms have branches) ───── */

  /* ───── Room CRUD ───── */
  const saveRoom = () => {
    if (!roomForm.name.trim()) { showToast('กรุณากรอกชื่อห้อง', 'error'); return }

    if (editingRoom) {
      setRooms(prev => prev.map(r =>
        r.id === editingRoom.id ? {
          ...r,
          name: roomForm.name,
          color: roomForm.color,
          image: roomForm.image || undefined,
        } : r
      ))
    } else {
      const maxId = Math.max(0, ...rooms.map(r => r.id))
      const newRoom: Room = {
        id: maxId + 1,
        name: roomForm.name,
        color: roomForm.color,
        image: roomForm.image || undefined,
        branchId: '',
        practitionerId: '',
        workingStartTime: '09:00',
        workingEndTime: '17:00',
        slotDuration: 30,
        active: true,
      }
      setRooms(prev => [...prev, newRoom])
    }
    setShowRoomModal(false)
    setRoomForm({ name: '', color: '#0891B2', image: '' })
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
    setPendingImageFile(file)
    const reader = new FileReader()
    reader.onload = (ev) => {
      setRoomForm(prev => ({ ...prev, image: ev.target?.result as string }))
    }
    reader.readAsDataURL(file)
  }

  const handleDeleteRoom = () => {
    if (confirmDelete === null) return
    setRooms(prev => prev.filter(r => r.id !== confirmDelete))
    setConfirmDelete(null)
  }

  const toggleRoomActive = (roomId: number) => {
    setRooms(prev => prev.map(r => r.id === roomId ? { ...r, active: !r.active } : r))
  }

  const openAddRoom = () => {
    setEditingRoom(null)
    setPendingImageFile(null)
    setRoomForm({ name: '', color: config?.color || '#0891B2', image: '' })
    setShowRoomModal(true)
  }

  const openEditRoom = (room: Room) => {
    setEditingRoom(room)
    setPendingImageFile(null)
    setRoomForm({ name: room.name, color: room.color, image: room.image || '' })
    setShowRoomModal(true)
  }

  if (!config) return null

  return (
    <div className="space-y-6">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      {saveResult && (
        <SaveResultModal
          success={saveResult.success}
          onClose={() => setSaveResult(null)}
          onRetry={saveResult.retry}
        />
      )}

      {/* ─── Room Modal ─── */}
      {showRoomModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-gray-100">
              <h2 className="text-xl font-bold">{editingRoom ? 'แก้ไขห้อง' : 'เพิ่มห้องใหม่'}</h2>
              <button onClick={() => setShowRoomModal(false)} className="p-2 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5 text-gray-500" /></button>
            </div>
            <div className="p-6 space-y-4">
              {/* Room Name */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">ชื่อห้อง *</label>
                <input
                  type="text"
                  value={roomForm.name}
                  onChange={(e) => setRoomForm({ ...roomForm, name: e.target.value })}
                  placeholder="เช่น ห้อง 1"
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:border-2 focus:outline-none text-sm"
                />
              </div>

              {/* Color */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">สีประจำห้อง</label>
                <div className="flex items-center gap-3">
                  {roomColors.map((c) => (
                    <button
                      key={c}
                      onClick={() => setRoomForm({ ...roomForm, color: c })}
                      className={`w-8 h-8 rounded-full transition-all ${roomForm.color === c ? 'ring-2 ring-offset-2 ring-gray-400 scale-110' : 'hover:scale-110'}`}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
              </div>

              {/* Image Upload */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">รูปห้องตรวจ <span className="text-gray-400 font-normal">(ไม่บังคับ)</span></label>
                <div className="flex items-center gap-3">
                  {roomForm.image ? (
                    <div className="relative">
                      <img src={roomForm.image} alt="ห้อง" className="w-20 h-20 rounded-xl object-cover border border-gray-200" />
                      <button
                        onClick={() => { setRoomForm(prev => ({ ...prev, image: '' })); setPendingImageFile(null) }}
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
              <button onClick={() => setShowRoomModal(false)} className="px-5 py-2.5 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-100">ยกเลิก</button>
              <button onClick={saveRoom} className="px-5 py-2.5 rounded-xl text-sm font-bold text-white" style={{ backgroundColor: config.color }}>บันทึก</button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Delete Confirmation ─── */}
      {confirmDelete !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 text-center">
            <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Trash2 className="w-6 h-6 text-red-500" />
            </div>
            <h3 className="text-lg font-bold text-gray-900 mb-2">ยืนยันลบห้อง</h3>
            <p className="text-sm text-gray-500 mb-6">ต้องการลบห้องนี้จริงหรือไม่?</p>
            <div className="flex justify-center gap-3">
              <button onClick={() => setConfirmDelete(null)} className="px-4 py-2 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-100">ยกเลิก</button>
              <button onClick={handleDeleteRoom} className="px-4 py-2 bg-red-500 text-white rounded-lg text-sm font-medium hover:bg-red-600">ลบ</button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Header ─── */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">ห้องตรวจ</h3>
          <p className="text-sm text-gray-500">จัดการห้องตรวจ รูปภาพ และสีประจำห้อง</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium bg-green-500 text-white hover:bg-green-600 disabled:opacity-50"
          >
            {saving ? '⏳ กำลังบันทึก...' : '💾 บันทึก'}
          </button>
          <button
            onClick={openAddRoom}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold text-white hover:opacity-90 transition-opacity"
            style={{ backgroundColor: config.color }}
          >
            <Plus className="w-4 h-4" /> เพิ่มห้อง
          </button>
        </div>
      </div>

      {/* ─── Room List ─── */}
      <div className="space-y-3">
        {rooms.map(room => (
          <div key={room.id} className={`flex items-center justify-between p-4 border rounded-xl transition-all ${room.active ? 'border-gray-100 hover:bg-gray-50' : 'border-gray-200 bg-gray-50 opacity-60'}`}>
            <div className="flex items-center gap-4">
              {room.image ? (
                <img src={room.image} alt={room.name} className="w-12 h-12 rounded-xl object-cover border border-gray-200" />
              ) : (
                <div
                  className="w-12 h-12 rounded-xl flex items-center justify-center text-white font-bold text-sm"
                  style={{ backgroundColor: room.color }}
                >
                  {room.id}
                </div>
              )}
              <div>
                <p className="font-medium text-gray-900">{room.name}</p>
                <div className="flex items-center gap-2 mt-0.5">
                  <div
                    className="w-3 h-3 rounded-full border border-gray-200"
                    style={{ backgroundColor: room.color }}
                  />
                  <span className="text-xs text-gray-500">สีประจำห้อง</span>
                  {!room.active && <span className="text-xs text-red-500 font-medium">• ปิดใช้งาน</span>}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => toggleRoomActive(room.id)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${room.active ? 'bg-emerald-500' : 'bg-gray-300'}`}
                title={room.active ? 'ปิดใช้งานห้อง' : 'เปิดใช้งานห้อง'}
              >
                <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${room.active ? 'translate-x-6' : 'translate-x-1'}`} />
              </button>
              <button
                onClick={() => openEditRoom(room)}
                className="p-2 hover:bg-gray-100 rounded-lg"
              >
                <Edit className="w-4 h-4 text-gray-500" />
              </button>
              <button
                onClick={() => setConfirmDelete(room.id)}
                className="p-2 hover:bg-red-50 rounded-lg"
              >
                <Trash2 className="w-4 h-4 text-gray-400 hover:text-red-500" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
