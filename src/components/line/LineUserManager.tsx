'use client'

import { useState, useEffect, useCallback } from 'react'
import { Users, Phone, Trash2, Search, X, MessageCircle, UserPlus, Check } from 'lucide-react'
import { clsx } from 'clsx'
import { getAllLineUsers, removeLineUser, type LineUserProfile } from '@/lib/line-notification'
import Toast from '@/components/ui/Toast'

export default function LineUserManager() {
  const [lineUsers, setLineUsers] = useState<LineUserProfile[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null)
  const [showAddModal, setShowAddModal] = useState(false)
  const [addForm, setAddForm] = useState({ userId: '', phoneNumber: '', displayName: '' })
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)

  const showToastMsg = useCallback((message: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToast({ message, type })
    setTimeout(() => setToast(null), 3000)
  }, [])

  const loadUsers = useCallback(() => {
    const users = getAllLineUsers()
    setLineUsers(users)
  }, [])

  useEffect(() => {
    loadUsers()
  }, [loadUsers])

  const filteredUsers = lineUsers.filter(user => {
    const searchLower = searchQuery.toLowerCase()
    return (
      user.displayName.toLowerCase().includes(searchLower) ||
      user.phoneNumber?.includes(searchQuery) ||
      user.userId.includes(searchQuery)
    )
  })

  const handleAddUser = () => {
    if (!addForm.userId || !addForm.phoneNumber) {
      showToastMsg('กรุณากรอกข้อมูลให้ครบถ้วน', 'error')
      return
    }

    const newUser: LineUserProfile = {
      userId: addForm.userId,
      displayName: addForm.displayName || `LINE User ${addForm.userId.slice(-6)}`,
      phoneNumber: addForm.phoneNumber,
      clinicId: 'current-clinic', // ควรใช้ clinicId จริง
      createdAt: new Date(),
    }

    // Save to localStorage
    const existingUsers = getAllLineUsers()
    const updatedUsers = [...existingUsers, newUser]
    localStorage.setItem('clinic-q-line-users', JSON.stringify(updatedUsers))
    setLineUsers(updatedUsers)

    setShowAddModal(false)
    setAddForm({ userId: '', phoneNumber: '', displayName: '' })
    showToastMsg('เพิ่ม LINE User สำเร็จ!', 'success')
  }

  const handleDeleteUser = (userId: string) => {
    removeLineUser(userId)
    loadUsers()
    setConfirmDelete(null)
    showToastMsg('ลบ LINE User แล้ว', 'info')
  }

  return (
    <div className="space-y-4">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <MessageCircle className="w-5 h-5 text-green-600" />
          <h3 className="text-lg font-bold text-gray-900">LINE Users</h3>
          <span className="px-2 py-0.5 bg-green-100 text-green-700 text-xs font-medium rounded-full">
            {lineUsers.length} คน
          </span>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-1 px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-lg transition-colors"
        >
          <UserPlus className="w-4 h-4" />
          เพิ่ม
        </button>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          type="text"
          placeholder="ค้นหาชื่อ หรือ เบอร์โทร..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500"
        />
      </div>

      {/* User List */}
      <div className="space-y-2">
        {filteredUsers.length === 0 ? (
          <div className="text-center py-8 text-gray-400 border-2 border-dashed border-gray-200 rounded-xl">
            <MessageCircle className="w-8 h-8 mx-auto mb-2 opacity-30" />
            <p className="text-sm">ยังไม่มี LINE User ที่เชื่อมต่อ</p>
            <p className="text-xs text-gray-400 mt-1">เมื่อลูกค้าสแกน QR Code LINE OA แล้ว จะปรากฏที่นี่</p>
          </div>
        ) : (
          filteredUsers.map((user) => (
            <div key={user.userId} className="flex items-center gap-3 p-3 bg-white border border-gray-200 rounded-xl hover:bg-gray-50">
              <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
                {user.pictureUrl ? (
                  <img src={user.pictureUrl} alt={user.displayName} className="w-10 h-10 rounded-full" />
                ) : (
                  <MessageCircle className="w-5 h-5 text-green-600" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-gray-900 truncate">{user.displayName}</p>
                <div className="flex items-center gap-2 text-sm text-gray-500">
                  <Phone className="w-3 h-3" />
                  {user.phoneNumber || 'ไม่มีเบอร์โทร'}
                </div>
                <p className="text-xs text-gray-400 mt-0.5">ID: {user.userId.slice(0, 12)}...</p>
              </div>
              <button
                onClick={() => setConfirmDelete(user.userId)}
                className="p-2 hover:bg-red-50 rounded-lg flex-shrink-0"
              >
                <Trash2 className="w-4 h-4 text-gray-400 hover:text-red-500" />
              </button>
            </div>
          ))
        )}
      </div>

      {/* Add User Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between p-4 border-b border-gray-100">
              <h3 className="text-lg font-bold text-gray-900">เพิ่ม LINE User</h3>
              <button onClick={() => setShowAddModal(false)} className="p-2 hover:bg-gray-100 rounded-lg">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            <div className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">LINE User ID *</label>
                <input
                  type="text"
                  value={addForm.userId}
                  onChange={(e) => setAddForm({ ...addForm, userId: e.target.value })}
                  placeholder="U1234567890abcdef..."
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                />
                <p className="text-xs text-gray-400 mt-1">หาได้จาก Webhook Event Log ใน LINE Developers Console</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">เบอร์โทรศัพท์ *</label>
                <input
                  type="tel"
                  value={addForm.phoneNumber}
                  onChange={(e) => setAddForm({ ...addForm, phoneNumber: e.target.value })}
                  placeholder="081-234-5678"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">ชื่อ (ถ้ารู้)</label>
                <input
                  type="text"
                  value={addForm.displayName}
                  onChange={(e) => setAddForm({ ...addForm, displayName: e.target.value })}
                  placeholder="ชื่อที่แสดงใน LINE"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                />
              </div>
            </div>
            <div className="flex justify-end gap-3 p-4 border-t border-gray-100">
              <button onClick={() => setShowAddModal(false)} className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg text-sm font-medium">
                ยกเลิก
              </button>
              <button onClick={handleAddUser} className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium flex items-center gap-1">
                <Check className="w-4 h-4" /> เพิ่ม
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation */}
      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-5">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
                <Trash2 className="w-5 h-5 text-red-500" />
              </div>
              <h3 className="text-lg font-bold text-gray-900">ยืนยันการลบ</h3>
            </div>
            <p className="text-gray-600 mb-5">ต้องการลบ LINE User นี้ออกจากระบบใช่หรือไม่?</p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setConfirmDelete(null)} className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg text-sm font-medium">
                ยกเลิก
              </button>
              <button onClick={() => handleDeleteUser(confirmDelete)} className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg text-sm font-medium">
                ลบ
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
