'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import { 
  type ClinicRole, 
  type UserRole,
  type ClinicMembership,
  roleConfig, 
  rolePermissions, 
  permissionLabels, 
  type Permission 
} from '@/lib/auth-types'
import { useAuth } from '@/lib/auth-context'
import { usePractitioners, type Practitioner } from '@/lib/practitioner-context'
import { getDefaultBranchData } from '@/lib/branch-data'
import PhoneInput from '@/components/ui/PhoneInput'
import { useClinic } from '@/lib/clinic-context'

import { UserPlus, Edit, Trash2, Shield, Users, Award, Plus, X, UserMinus, Lock, CheckCircle2, Copy, Clipboard, AlertTriangle } from 'lucide-react'

interface UserWithRoles {
  id: string
  email: string
  username?: string
  name: string
  phone?: string
  createdAt: string
  roles: ClinicRole[]
  branchIds?: string[] // For practitioners
  isActive: boolean
  forcePasswordChange?: boolean
}

interface RoleAssignmentForm {
  name: string
  username: string
  email: string
  phone: string
  roles: ClinicRole[]
  branchIds: string[]
}

// Synthetic staff Auth emails ({id}-{rand}@internal.clinicq.local) are credential
// identifiers created by the server for staff accounts — they are internal to the
// system and must never be shown to users as a real email address.
const isInternalEmail = (email: string) => email.toLowerCase().endsWith('@internal.clinicq.local')

export default function UserManagement({ canManageUsers = false, currentRole }: { canManageUsers?: boolean; currentRole?: string | null }) {
  const { currentClinicId } = useAuth()
  const { currentClinic } = useClinic()
  const { practitioners, addPractitioner, deletePractitioner } = usePractitioners()
  const branchData = getDefaultBranchData(currentClinic || 'dental')

  // Supabase (via the server API) is the single source of truth for the
  // member list — localStorage is never used to store users/roles.
  const [users, setUsers] = useState<UserWithRoles[]>([])
  const [loadingUsers, setLoadingUsers] = useState(true)
  // Distinguish a genuine empty clinic from a failed/unpermitted load.
  // status 0 = network error, 401 = session expired, 403 = no access, else server error.
  const [loadError, setLoadError] = useState<{ status: number; message: string } | null>(null)
  const [saving, setSaving] = useState(false)
  const [showAddModal, setShowAddModal] = useState(false)
  const [editingUser, setEditingUser] = useState<UserWithRoles | null>(null)
  const [form, setForm] = useState<RoleAssignmentForm>({
    name: '',
    username: '',
    email: '',
    phone: '',
    roles: [],
    branchIds: []
  })

  // Reset form to defaults
  const resetForm = () => setForm({ name: '', username: '', email: '', phone: '', roles: [], branchIds: [] })
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null)
  const [showAddRoleModal, setShowAddRoleModal] = useState(false)
  const [newRole, setNewRole] = useState<ClinicRole>('front_desk')
  const [newBranchIds, setNewBranchIds] = useState<string[]>([])
  const [tempCredentials, setTempCredentials] = useState<{ username: string; tempPassword: string; name: string; roles: ClinicRole[] } | null>(null)
  const [resettingPassword, setResettingPassword] = useState<string | null>(null)
  const [resetTempPassword, setResetTempPassword] = useState<string | null>(null)
  const [copiedField, setCopiedField] = useState<'username' | 'password' | null>(null)
  // Detail view of a member row — opened by clicking the user name.
  const [detailUser, setDetailUser] = useState<UserWithRoles | null>(null)
  // Copy feedback for the username shown in the detail modal.
  const [usernameCopied, setUsernameCopied] = useState(false)

  const branches = branchData.branches.filter(b => b.active)

  // Load the member list from the server (GET /api/clinics/[clinicId]/users).
  // Called on mount and re-called after every mutation so the UI always
  // reflects the real Supabase state.
  const loadUsers = useCallback(async () => {
    if (!currentClinicId) {
      setUsers([])
      setLoadError(null)
      setLoadingUsers(false)
      return
    }
    setLoadingUsers(true)
    try {
      const res = await fetch(`/api/clinics/${encodeURIComponent(currentClinicId)}/users`)
      if (!res.ok) {
        setUsers([])
        if (res.status === 401) {
          setLoadError({ status: 401, message: 'เซสชันหมดอายุหรือยังไม่ได้เข้าสู่ระบบ กรุณาเข้าสู่ระบบใหม่อีกครั้ง' })
        } else if (res.status === 403) {
          setLoadError({ status: 403, message: 'คุณไม่มีสิทธิ์เข้าถึงคลินิกนี้ กรุณาติดต่อผู้ดูแลระบบ' })
        } else {
          setLoadError({ status: res.status, message: `ไม่สามารถโหลดรายชื่อผู้ใช้ได้ (HTTP ${res.status}) กรุณาลองใหม่อีกครั้ง` })
        }
        return
      }
      const data = await res.json()
      setUsers(Array.isArray(data.users) ? data.users : [])
      setLoadError(null)
    } catch {
      setUsers([])
      setLoadError({ status: 0, message: 'ไม่สามารถโหลดรายชื่อผู้ใช้ได้ เกิดข้อผิดพลาดของเครือข่าย กรุณาลองใหม่อีกครั้ง' })
    } finally {
      setLoadingUsers(false)
    }
  }, [currentClinicId])

  useEffect(() => {
    setLoadingUsers(true)
    void loadUsers()
  }, [loadUsers])

  // All members returned by the server belong to this clinic — no filtering needed.
  const clinicUsers = useMemo(() => users, [users])

  // Whether the CURRENT caller may manage a given member row.
  // Owner rows are protected from everyone. A manager caller may only manage
  // staff-level members (front_desk / practitioner).
  const canManageUserRow = useCallback((user: UserWithRoles) => {
    if (!canManageUsers) return false
    const roles = user.roles || []
    if (roles.includes('owner')) return false
    if (currentRole === 'manager') {
      return roles.length > 0 && roles.every(r => r === 'front_desk' || r === 'practitioner')
    }
    return true
  }, [canManageUsers, currentRole])

  // Role management (assign/change/remove roles + practitioner branch
  // assignments) is restricted to the clinic owner. Managers may still add
  // users and manage staff, but can never choose or change a role.
  const canManageRoles = currentRole === 'owner' || currentRole === 'platform_owner'

  // Open add user modal
  const openAddUser = () => {
    setEditingUser(null)
    resetForm()
    setShowAddModal(true)
  }

  // Open edit user modal
  const openEditUser = (user: UserWithRoles) => {
    setEditingUser(user)
    setForm({
      name: user.name,
      username: user.username || '',
      email: user.email || '',
      phone: user.phone || '',
      roles: [...user.roles],
      branchIds: [...(user.branchIds || [])]
    })
    setShowAddModal(true)
  }

  // Save user
  const handleSaveUser = async () => {
    if (!form.name) return

    if (editingUser) {
      // Update an existing member via the server API:
      //   PATCH /api/clinics/[clinicId]/users
      if (!currentClinicId) {
        alert('ยังไม่ได้เลือกคลินิก')
        return
      }
      setSaving(true)
      try {
        const res = await fetch(`/api/clinics/${encodeURIComponent(currentClinicId)}/users`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: editingUser.id,
            name: form.name,
            phone: form.phone || undefined,
            // Only send roles when at least one is selected AND the caller may
            // manage roles; otherwise keep the existing role set untouched
            // (e.g. a manager editing name/phone, or a deactivated user).
            ...(canManageRoles && form.roles.length > 0 ? { roles: form.roles, branchIds: form.branchIds } : {}),
            // Username — owner-only; only sent when a non-empty value is set.
            ...(canManageRoles && form.username ? { username: form.username } : {}),
          }),
        })
        const body = await res.json().catch(() => ({}))
        if (!res.ok) {
          alert(body?.error || 'ไม่สามารถบันทึกการแก้ไขได้')
          return
        }
        await loadUsers()
      } catch (e: any) {
        alert(e?.message || 'เกิดข้อผิดพลาดของเครือข่าย')
      } finally {
        setSaving(false)
      }
    } else {
      // Create a REAL auth account via the server-side API:
      //   POST /api/clinics/[clinicId]/users
      // The server creates auth.users (with generated temp password),
      // users, clinic_memberships, staff_usernames, and optionally practitioners.
      // Never create the auth account client-side.
      if (!currentClinicId) {
        alert('ยังไม่ได้เลือกคลินิก')
        return
      }
      setSaving(true)
      try {
        const res = await fetch(`/api/clinics/${encodeURIComponent(currentClinicId)}/users`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: form.name,
            phone: form.phone || undefined,
            roles: form.roles,
            branchIds: form.branchIds,
          }),
        })
        const body = await res.json().catch(() => ({}))
        if (!res.ok) {
          alert(body?.error || 'ไม่สามารถสร้างบัญชีผู้ใช้ได้')
          return
        }
        const u = body.user
        const tempPassword = body.temporaryPassword
        // Show temporary credentials ONCE
        if (tempPassword && u.username) {
          setTempCredentials({
            username: u.username,
            tempPassword,
            name: u.name,
            roles: u.roles,
          })
        }
        // Re-fetch the member list so the new user appears from Supabase.
        await loadUsers()
      } catch (e: any) {
        alert(e?.message || 'เกิดข้อผิดพลาดของเครือข่าย')
      } finally {
        setSaving(false)
      }
    }
    setShowAddModal(false)
  }

  // Delete (soft-delete) user via the server API:
  //   DELETE /api/clinics/[clinicId]/users/[userId]
  const deleteUser = async (userId: string) => {
    if (!confirm('ต้องการลบผู้ใช้งานนี้ออกจากระบบหรือไม่?')) return
    if (!currentClinicId) return
    setSaving(true)
    try {
      const res = await fetch(`/api/clinics/${encodeURIComponent(currentClinicId)}/users/${encodeURIComponent(userId)}`, {
        method: 'DELETE',
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) {
        alert(body?.error || 'ไม่สามารถลบผู้ใช้ได้')
        return
      }
      // Remove practitioner from the local cache if it exists
      const user = users.find(u => u.id === userId)
      if (user?.roles.includes('practitioner')) {
        const practitioner = practitioners.find(p => p.userId === userId)
        if (practitioner) {
          deletePractitioner(practitioner.id)
        }
      }
      await loadUsers()
    } catch (e: any) {
      alert(e?.message || 'เกิดข้อผิดพลาดของเครือข่าย')
    } finally {
      setSaving(false)
    }
  }

  // Sync existing users with practitioners (cache-only; real accounts are
  // created via the server API). Only sync users that have a REAL auth id
  // (returned by the API) — never fabricate practitioner records for the
  // placeholder `user-<ts>` ids of role-only entries.
  useEffect(() => {
    if (users.length === 0) return
    
    // For each user with practitioner role, check if they have a practitioner record
    users.filter(u => u.roles.includes('practitioner') && !u.id.startsWith('user-')).forEach(user => {
      const existingPractitioner = practitioners.find(p => p.userId === user.id)
      if (!existingPractitioner) {
        // Cache-only practitioner record for a real account
        addPractitioner({
          id: `pract-${user.id}`,
          name: user.name,
          phone: user.phone || '',
          branchId: user.branchIds?.[0] || '',
          active: user.isActive,
          userId: user.id,
          clinicId: currentClinicId || undefined,
        })
      }
    })
  }, [users, practitioners, addPractitioner, currentClinicId])

  // Toggle user active status via the server API (PATCH isActive)
  const toggleUserActive = async (user: UserWithRoles) => {
    if (!currentClinicId) return
    setSaving(true)
    try {
      const res = await fetch(`/api/clinics/${encodeURIComponent(currentClinicId)}/users`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, isActive: !user.isActive }),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) {
        alert(body?.error || 'ไม่สามารถเปลี่ยนสถานะผู้ใช้ได้')
        return
      }
      await loadUsers()
    } catch (e: any) {
      alert(e?.message || 'เกิดข้อผิดพลาดของเครือข่าย')
    } finally {
      setSaving(false)
    }
  }

  // Open add role modal
  const openAddRole = (userId: string) => {
    setSelectedUserId(userId)
    setNewRole('front_desk')
    setNewBranchIds([])
    setShowAddRoleModal(true)
  }

  // Add role to user via the server API (PATCH roles)
  const handleAddRole = async () => {
    if (!selectedUserId || !currentClinicId) return

    const target = users.find(u => u.id === selectedUserId)
    if (!target) return
    if (target.roles.includes(newRole)) {
      alert('บทบาทนี้มีอยู่แล้ว')
      return
    }

    const updatedBranchIds = newRole === 'practitioner'
      ? [...new Set([...(target.branchIds || []), ...newBranchIds])]
      : target.branchIds

    setSaving(true)
    try {
      const res = await fetch(`/api/clinics/${encodeURIComponent(currentClinicId)}/users`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: selectedUserId,
          roles: [...target.roles, newRole],
          branchIds: updatedBranchIds,
        }),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) {
        alert(body?.error || 'ไม่สามารถเพิ่มบทบาทได้')
        return
      }
      await loadUsers()
      setShowAddRoleModal(false)
    } catch (e: any) {
      alert(e?.message || 'เกิดข้อผิดพลาดของเครือข่าย')
    } finally {
      setSaving(false)
    }
  }

  // Remove role from user via the server API (PATCH roles)
  const removeRole = async (userId: string, role: ClinicRole) => {
    if (!confirm(`ต้องการลบบทบาท ${roleConfig[role].label} ออกหรือไม่?`)) return
    if (!currentClinicId) return

    const target = users.find(u => u.id === userId)
    if (!target) return
    const newRoles = target.roles.filter(r => r !== role)
    const newBranchIds = role === 'practitioner' ? [] : target.branchIds

    setSaving(true)
    try {
      const res = await fetch(`/api/clinics/${encodeURIComponent(currentClinicId)}/users`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          roles: newRoles,
          branchIds: newBranchIds,
        }),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) {
        alert(body?.error || 'ไม่สามารถลบบทบาทได้')
        return
      }
      await loadUsers()
    } catch (e: any) {
      alert(e?.message || 'เกิดข้อผิดพลาดของเครือข่าย')
    } finally {
      setSaving(false)
    }
  }

  // Remove branch from practitioner via the server API (PATCH branchIds)
  const removeBranch = async (userId: string, branchId: string) => {
    if (!currentClinicId) return

    const target = users.find(u => u.id === userId)
    if (!target) return

    setSaving(true)
    try {
      const res = await fetch(`/api/clinics/${encodeURIComponent(currentClinicId)}/users`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          roles: target.roles,
          branchIds: (target.branchIds || []).filter(b => b !== branchId),
        }),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) {
        alert(body?.error || 'ไม่สามารถลบสาขาได้')
        return
      }
      await loadUsers()
    } catch (e: any) {
      alert(e?.message || 'เกิดข้อผิดพลาดของเครือข่าย')
    } finally {
      setSaving(false)
    }
  }

  // Reset password for a staff/user
  const handleResetPassword = async (userId: string, userRoles: ClinicRole[]) => {
    if (!currentClinicId) return
    setResettingPassword(userId)
    try {
      const res = await fetch(`/api/clinics/${encodeURIComponent(currentClinicId)}/users/${encodeURIComponent(userId)}/reset-password`, {
        method: 'POST',
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) {
        alert(body?.error || 'ไม่สามารถรีเซ็ตรหัสผ่านได้')
        return
      }
      setResetTempPassword(body.temporaryPassword || '')
      alert(`รีเซ็ตรหัสผ่านสำเร็จ กรุณาแจ้งรหัสผ่านชั่วคราวนี้ให้ผู้ใช้:

รหัสผ่านชั่วคราว: ${body.temporaryPassword}

หมายเหตุ: รหัสผ่านนี้แสดงเพียงครั้งเดียว หลังจากนั้นระบบจะไม่สามารถแสดงอีกได้`)
    } catch (e: any) {
      alert(e?.message || 'เกิดข้อผิดพลาดของเครือข่าย')
    } finally {
      setResettingPassword(null)
    }
  }

  // Format role badge
  const RoleBadge = ({ role }: { role: ClinicRole }) => {
    const config = roleConfig[role]
    return (
      <span 
        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium"
        style={{ backgroundColor: config.bgColor, color: config.color }}
      >
        {config.icon} {config.label}
      </span>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <Shield className="w-5 h-5 text-indigo-500" /> จัดการผู้ใช้และบทบาท
          </h3>
          <p className="text-sm text-gray-500">
            จัดการผู้ใช้งานและกำหนดบทบาท • 1 คนมีได้หลายบทบาท
          </p>
          {/* Guidance for users with manage permission */}
          {canManageUsers && (
            <div className="mt-2 p-3 bg-indigo-50 border border-indigo-100 rounded-xl">
              <p className="text-xs text-indigo-600 leading-relaxed">
                💡 <strong>Owner</strong> ใช้อีเมลในการเข้าสู่ระบบ •{' '}
                <strong>Manager / Staff / Practitioner</strong> ใช้ Username + รหัสผ่านที่ระบบสร้างให้โดยอัตโนมัติ
                {' '}•{' '}
                เมื่อสร้างผู้ใช้สำเร็จ ระบบจะแสดง Username และรหัสผ่านชั่วคราวให้ <span className="font-medium">ครั้งเดียวเท่านั้น</span>
              </p>
            </div>
          )
          }
        </div>
        {canManageUsers && (
          <button
            onClick={openAddUser}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-500 text-white text-sm font-medium hover:bg-indigo-600 transition-colors"
          >
            <UserPlus className="w-4 h-4" /> เพิ่มผู้ใช้
          </button>
        )}
      </div>

      {/* Users Table */}
      <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
        <table className="w-full">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-100">
              <th className="text-left px-4 py-3 text-xs font-bold text-gray-500">ผู้ใช้</th>
              <th className="text-left px-4 py-3 text-xs font-bold text-gray-500">บทบาทในคลินิก</th>
              <th className="text-left px-4 py-3 text-xs font-bold text-gray-500">สาขา (สำหรับผู้ทำหัตถการ)</th>
              <th className="text-left px-4 py-3 text-xs font-bold text-gray-500">สถานะ</th>
              <th className="text-right px-4 py-3 text-xs font-bold text-gray-500">จัดการ</th>
            </tr>
          </thead>
          <tbody>
            {loadingUsers ? (
              <tr>
                <td colSpan={5} className="px-4 py-12 text-center text-gray-400">
                  <div className="mx-auto w-8 h-8 rounded-full border-2 border-indigo-200 border-t-indigo-500 animate-spin mb-3" />
                  <p className="font-medium">กำลังโหลดรายชื่อผู้ใช้...</p>
                </td>
              </tr>
            ) : loadError ? (
              <tr>
                <td colSpan={5} className="px-4 py-12 text-center">
                  <AlertTriangle className="w-10 h-10 mx-auto mb-3 text-red-400" />
                  <p className="font-medium text-red-600">{loadError.message}</p>
                  <button
                    onClick={() => void loadUsers()}
                    className="mt-3 px-4 py-2 rounded-xl bg-indigo-500 text-white text-sm font-medium hover:bg-indigo-600 transition-colors"
                  >
                    ลองใหม่อีกครั้ง
                  </button>
                </td>
              </tr>
            ) : clinicUsers.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-12 text-center text-gray-400">
                  <Users className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                  <p className="font-medium">ยังไม่มีผู้ใช้ในคลินิก</p>
                  {canManageUsers ? (
                    <p className="text-sm mt-1">กดปุ่ม "เพิ่มผู้ใช้" เพื่อเริ่มต้น</p>
                  ) : (
                    <p className="text-sm mt-1">ผู้ใช้ที่มีสิทธิ์จัดการจะสามารถเพิ่มผู้ใช้ได้</p>
                  )}
                </td>
              </tr>
            ) : (
              clinicUsers.map(user => (
                <tr key={user.id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3">
                    {/* Click the user name/row to open the detail modal. Username is deliberately NOT shown in the list — it lives in the detail view. */}
                    <button
                      onClick={() => setDetailUser(user)}
                      className="group flex items-center gap-3 w-full text-left"
                      title="ดูรายละเอียดผู้ใช้งาน"
                    >
                      <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-sm font-bold text-white ${
                        user.roles.includes('owner') ? 'bg-orange-500' :
                        user.roles.includes('manager') ? 'bg-yellow-500' :
                        user.roles.includes('front_desk') ? 'bg-green-500' :
                        'bg-indigo-500'
                      }`}>
                        {user.name.charAt(0)}
                      </div>
                      <div>
                        <div className="text-sm font-medium text-gray-900 group-hover:text-indigo-600">{user.name}</div>
                        {user.phone ? (
                          <div className="text-xs text-gray-500">📞 {user.phone}</div>
                        ) : (
                          <div className="text-xs text-gray-400">ไม่มีเบอร์โทร</div>
                        )}
                      </div>
                    </button>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {user.roles.map(role => (
                        <div key={role} className="flex items-center gap-1">
                          <RoleBadge role={role} />
                          {canManageUserRow(user) && canManageRoles && role !== 'owner' && (
                            <button
                              onClick={() => removeRole(user.id, role)}
                              className="p-0.5 rounded hover:bg-red-100 transition-colors"
                              title={`ลบบทบาท ${roleConfig[role].label}`}
                            >
                              <X className="w-3 h-3 text-red-400" />
                            </button>
                          )}
                        </div>
                      ))}
                      {canManageUserRow(user) && canManageRoles && user.roles.length < Object.keys(roleConfig).length && (
                        <button
                          onClick={() => openAddRole(user.id)}
                          className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[10px] font-medium bg-gray-100 text-gray-500 hover:bg-gray-200 transition-colors"
                        >
                          <Plus className="w-3 h-3" /> เพิ่ม
                        </button>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {user.roles.includes('practitioner') ? (
                      <div className="flex flex-wrap gap-1">
                        {(user.branchIds || []).length === 0 ? (
                          <span className="text-xs text-orange-500">⚠ ยังไม่ได้เลือกสาขา</span>
                        ) : (
                          user.branchIds?.map(branchId => {
                            const branch = branches.find(b => b.id === branchId)
                            return (
                              <span key={branchId} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-blue-100 text-blue-600">
                                {branch?.name || branchId}
                                {canManageUserRow(user) && canManageRoles && (
                                  <button
                                    onClick={() => removeBranch(user.id, branchId)}
                                    className="hover:text-red-500"
                                  >
                                    <X className="w-2.5 h-2.5" />
                                  </button>
                                )}
                              </span>
                            )
                          })
                        )}
                      </div>
                    ) : (
                      <span className="text-xs text-gray-400">-</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {canManageUserRow(user) ? (
                      <button
                        onClick={() => toggleUserActive(user)}
                        disabled={saving}
                        className={`px-2 py-0.5 rounded-full text-[10px] font-medium transition-colors ${
                          user.isActive
                            ? 'bg-green-100 text-green-600 hover:bg-green-200'
                            : 'bg-gray-100 text-gray-400 hover:bg-gray-200'
                        }`}
                      >
                        {user.isActive ? '✓ ใช้งาน' : '○ ปิดใช้งาน'}
                      </button>
                    ) : (
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${
                        user.isActive ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-400'
                      }`}>
                        {user.isActive ? '✓ ใช้งาน' : '○ ปิดใช้งาน'}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1.5 flex-wrap">
                      {canManageUserRow(user) && (
                        <>
                          <button
                            onClick={() => openEditUser(user)}
                            className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
                            title="แก้ไข"
                          >
                            <Edit className="w-3.5 h-3.5 text-gray-400" />
                          </button>
                          <button
                            onClick={() => deleteUser(user.id)}
                            className="p-1.5 rounded-lg hover:bg-red-50 transition-colors"
                            title="ลบ"
                          >
                            <Trash2 className="w-3.5 h-3.5 text-red-400" />
                          </button>
                          {/* Reset password for staff/manager/counter/practitioner — text label, never icon-only */}
                          {user.roles.some(r => r !== 'owner') && (
                            <button
                              onClick={() => handleResetPassword(user.id, user.roles)}
                              disabled={resettingPassword === user.id || saving}
                              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-700 text-xs font-medium transition-colors"
                            >
                              {resettingPassword === user.id ? (
                                <>
                                  <div className="w-3.5 h-3.5 rounded-full border-2 border-amber-400 border-t-transparent animate-spin" />
                                  กำลังรีเซ็ต...
                                </>
                              ) : (
                                <>
                                  <Lock className="w-3.5 h-3.5 text-amber-500" />
                                  Reset รหัสผ่าน
                                </>
                              )}
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Permission Matrix */}
      {canManageUsers && (
        <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <Shield className="w-4 h-4 text-indigo-500" />
            <p className="text-sm font-bold text-gray-900">🔐 สิทธิ์การใช้งานแต่ละบทบาท</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs" style={{ minWidth: '600px' }}>
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-2 px-2 font-bold text-gray-700 sticky left-0 bg-white z-10 w-[200px]">สิทธิ์</th>
                  {Object.entries(roleConfig).filter(([key]) => key !== 'platform_owner').map(([key, cfg]) => (
                    <th key={key} className="text-center py-2 px-1.5 font-bold">
                      <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] whitespace-nowrap" style={{ backgroundColor: cfg.bgColor, color: cfg.color }}>
                        {cfg.icon} {cfg.label}
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {Object.entries(permissionLabels).map(([perm, label]) => (
                  <tr key={perm} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                    <td className="py-1.5 px-2 font-medium text-gray-700 sticky left-0 bg-white z-10 text-[11px]">{label}</td>
                    {Object.entries(roleConfig).filter(([key]) => key !== 'platform_owner').map(([key]) => {
                      const has = rolePermissions[key as ClinicRole]?.includes(perm as Permission)
                      return (
                        <td key={key} className="text-center py-1.5 px-1.5">
                          {has ? (
                            <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-green-100 text-green-600 font-bold text-[10px]">✓</span>
                          ) : (
                            <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-gray-100 text-gray-300 text-[10px]">✕</span>
                          )}
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ═══ Add/Edit User Modal ═══ */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-gray-100 sticky top-0 bg-white z-10">
              <h2 className="text-lg font-bold text-gray-900">
                {editingUser ? 'แก้ไขผู้ใช้' : 'เพิ่มผู้ใช้ใหม่'}
              </h2>
              <button onClick={() => setShowAddModal(false)} className="p-1 rounded-lg hover:bg-gray-100">✕</button>
            </div>
            <div className="p-6 space-y-4">
              {/* Name */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">ชื่อ-นามสกุล *</label>
                <input 
                  value={form.name} 
                  onChange={(e) => setForm({ ...form, name: e.target.value })} 
                  className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300" 
                  placeholder="เช่น สมชาย ใจดี" 
                />
              </div>

              {/* Phone */}
              <PhoneInput
                label="เบอร์โทรศัพท์"
                value={form.phone}
                onChange={(v) => setForm({ ...form, phone: v })}
              />

              {/* Username — only the clinic owner may change the login username.
                  Managers never see or edit it (server also enforces this). */}
              {canManageRoles && editingUser && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Username <span className="text-xs text-gray-400">(ใช้เข้าสู่ระบบ)</span>
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">@</span>
                    <input
                      value={form.username}
                      onChange={(e) => setForm({ ...form, username: e.target.value })}
                      className="w-full pl-7 pr-3 py-2 rounded-xl border border-gray-200 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-300"
                      placeholder="เช่น SM4827-staff01"
                    />
                  </div>
                  <p className="text-xs text-gray-400 mt-1">
                    เปลี่ยน Username แล้วผู้ใช้จะเข้าสู่ระบบด้วย Username ใหม่ (ห้ามซ้ำกับผู้ใช้อื่น)
                  </p>
                </div>
              )}

              {/* Account info — username + password generated by server */}
              {!editingUser && (
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                  <p className="text-sm text-blue-700 leading-relaxed">
                    🔑 ระบบจะสร้าง <strong>Username</strong> และ <strong>รหัสผ่านชั่วคราว</strong> ให้โดยอัตโนมัติ
                    {' '}•{' '}
                    ผู้ใช้เข้าสู่ระบบด้วย Username + รหัสผ่านชั่วคราวได้ทันที
                  </p>
                  <p className="text-xs text-blue-600 mt-2">
                    รหัสผ่านชั่วคราวจะแสดงเพียงครั้งเดียวหลังสร้างสำเร็จ
                  </p>
                </div>
              )}

              {/* Roles — single select for new users (username auto-generated per role).
                  Only the clinic owner may assign or change roles; managers see
                  a locked notice instead of the selector. */}
              {canManageRoles ? (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  บทบาท * {editingUser ? '(เลือกได้หลายบทบาท)' : '(เลือก 1 บทบาท)'}
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {Object.entries(roleConfig)
                    .filter(([key]) => key !== 'platform_owner' && key !== 'owner')
                    .map(([key, cfg]) => {
                      const isSelected = editingUser
                        ? form.roles.includes(key as ClinicRole)
                        : form.roles[0] === key
                      return (
                        <button
                          key={key}
                          type="button"
                          onClick={() => {
                            if (editingUser) {
                              if (isSelected) {
                                setForm({ 
                                  ...form, 
                                  roles: form.roles.filter(r => r !== key),
                                  branchIds: key === 'practitioner' ? [] : form.branchIds
                                })
                              } else {
                                setForm({ ...form, roles: [...form.roles, key as ClinicRole] })
                              }
                            } else {
                              // Add mode: single role → the system generates the
                              // username ({code}-{role}NN) and temp password.
                              setForm({
                                ...form,
                                roles: [key as ClinicRole],
                                branchIds: key === 'practitioner' ? form.branchIds : [],
                              })
                            }
                          }}
                          className={`flex items-center gap-2 p-3 rounded-xl border-2 transition-all text-left ${
                            isSelected
                              ? 'border-current'
                              : 'border-gray-200 hover:border-gray-300'
                          }`}
                          style={{ 
                            borderColor: isSelected ? cfg.color : undefined,
                            backgroundColor: isSelected ? cfg.bgColor : 'white'
                          }}
                        >
                          <span className="text-lg">{cfg.icon}</span>
                          <div className="flex-1">
                            <div className="font-medium text-sm" style={{ color: cfg.color }}>{cfg.label}</div>
                            <div className="text-[10px] text-gray-500">{cfg.labelEn}</div>
                          </div>
                          {isSelected && (
                            <span className="text-green-500">✓</span>
                          )}
                        </button>
                      )
                    })}
                </div>
              </div>
              ) : (
                <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
                  <p className="text-sm text-gray-600">
                    🔒 เฉพาะเจ้าของคลินิกเท่านั้นที่กำหนดบทบาทได้
                    {editingUser
                      ? ' — บทบาทของผู้ใช้รายนี้จะไม่ถูกแก้ไข'
                      : ' — ผู้ใช้ใหม่จะถูกสร้างด้วยบทบาทเริ่มต้น (พนักงานเคาน์เตอร์)'}
                  </p>
                </div>
              )}

              {/* Branch Selection for Practitioner */}
              {form.roles.includes('practitioner') && (
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                  <label className="block text-sm font-medium text-blue-800 mb-2">
                    🏥 เลือกสาขา/ความเชี่ยวชาญ (เลือกได้หลายสาขา)
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {branches.map(branch => {
                      const isSelected = form.branchIds.includes(branch.id)
                      return (
                        <button
                          key={branch.id}
                          type="button"
                          onClick={() => {
                            if (isSelected) {
                              setForm({ 
                                ...form, 
                                branchIds: form.branchIds.filter(b => b !== branch.id) 
                              })
                            } else {
                              setForm({ 
                                ...form, 
                                branchIds: [...form.branchIds, branch.id] 
                              })
                            }
                          }}
                          className={`flex items-center gap-2 p-2 rounded-lg border transition-all text-left ${
                            isSelected
                              ? 'border-blue-500 bg-blue-100'
                              : 'border-gray-200 hover:border-blue-300 bg-white'
                          }`}
                        >
                          <div 
                            className="w-3 h-3 rounded-full flex-shrink-0 bg-blue-400"
                          />
                          <span className="text-xs font-medium text-gray-700">{branch.name}</span>
                          {isSelected && (
                            <span className="ml-auto text-blue-600">✓</span>
                          )}
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
            <div className="flex gap-3 p-6 border-t border-gray-100 bg-white">
              <button onClick={() => setShowAddModal(false)} className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50">
                ยกเลิก
              </button>
              <button
                onClick={handleSaveUser}
                disabled={!form.name || saving}
                className="flex-1 py-2.5 rounded-xl bg-indigo-500 text-white text-sm font-medium hover:bg-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? '⏳ กำลังสร้างบัญชี...' : editingUser ? 'บันทึกการแก้ไข' : 'เพิ่มผู้ใช้'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══ Success Modal — Username + Temp Password (shown once after creation) ═══ */}
      {tempCredentials && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="bg-gradient-to-r from-emerald-500 to-teal-500 p-5 text-center">
              <div className="w-14 h-14 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-3">
                <CheckCircle2 className="w-7 h-7 text-white" />
              </div>
              <h3 className="text-lg font-extrabold text-white">สร้างผู้ใช้งานสำเร็จ</h3>
              <p className="text-xs text-white/80 mt-1">บันทึกข้อมูลการเข้าสู่ระบบนี้ไว้ให้เรียบร้อย</p>
            </div>
            <div className="p-6 space-y-4">
              <div className="bg-gray-50 rounded-xl p-4">
                <div className="text-sm text-gray-500 mb-1">
                  ชื่อ: <span className="font-medium text-gray-900">{tempCredentials.name}</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-gray-600 mb-3">
                  บทบาท:
                  {tempCredentials.roles.map(r => (
                    <span key={r} className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-indigo-100 text-indigo-700">
                      {roleConfig[r]?.label || r}
                    </span>
                  ))}
                </div>
                <div className="space-y-2">
                  <div>
                    <div className="text-xs text-gray-400 mb-0.5">Username</div>
                    <code className="block bg-white border border-gray-200 px-3 py-2 rounded-lg text-sm font-mono text-gray-900 break-all">
                      {tempCredentials.username}
                    </code>
                  </div>
                  <div>
                    <div className="text-xs text-gray-400 mb-0.5">รหัสผ่านชั่วคราว</div>
                    <code className="block bg-white border border-gray-200 px-3 py-2 rounded-lg text-sm font-mono text-gray-900 tracking-wider">
                      {tempCredentials.tempPassword}
                    </code>
                  </div>
                </div>
              </div>
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
                <p className="text-xs text-amber-700 leading-relaxed">
                  ⚠️ <strong>กรุณาบันทึกข้อมูลการเข้าสู่ระบบนี้ไว้</strong>
                  {' '}— รหัสผ่านชั่วคราวจะแสดงเพียงครั้งเดียว ระบบจะไม่สามารถแสดงซ้ำได้อีก
                </p>
              </div>
            </div>
            <div className="flex gap-3 p-6 border-t border-gray-100 bg-gray-50">
              <button
                onClick={() => {
                  navigator.clipboard?.writeText(tempCredentials.username).catch(() => {})
                  setCopiedField('username')
                  setTimeout(() => setCopiedField(null), 2000)
                }}
                className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-700 hover:bg-white transition-colors"
              >
                {copiedField === 'username' ? '✓ คัดลอกแล้ว' : 'คัดลอก Username'}
              </button>
              <button
                onClick={() => {
                  navigator.clipboard?.writeText(tempCredentials.tempPassword).catch(() => {})
                  setCopiedField('password')
                  setTimeout(() => setCopiedField(null), 2000)
                }}
                className="flex-1 py-2.5 rounded-xl border border-amber-200 text-sm font-medium text-amber-700 hover:bg-white transition-colors"
              >
                {copiedField === 'password' ? '✓ คัดลอกแล้ว' : 'คัดลอกรหัสผ่าน'}
              </button>
              <button
                onClick={() => setTempCredentials(null)}
                className="flex-1 py-2.5 rounded-xl bg-emerald-500 text-white text-sm font-medium hover:bg-emerald-600 transition-colors"
              >
                เสร็จสิ้น
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══ Reset Password Result Modal ═══ */}
      {resetTempPassword && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
            <div className="p-5 text-center">
              <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <CheckCircle2 className="w-6 h-6 text-green-600" />
              </div>
              <h3 className="text-lg font-bold text-gray-900">รีเซ็ตรหัสผ่านสำเร็จ</h3>
              <p className="text-sm text-gray-500 mt-1">แจ้งรหัสผ่านชั่วคราวให้ผู้ใช้ทาง LINE หรือช่องทางที่ปลอดภัย</p>
            </div>
            <div className="p-5">
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                <div className="text-xs text-amber-600 mb-2">รหัสผ่านชั่วคราว (แสดงเพียงครั้งเดียว)</div>
                <div className="flex items-center gap-2">
                  <code className="flex-1 bg-white border border-amber-200 px-3 py-2 rounded-lg text-sm font-mono text-amber-900 tracking-wider">
                    {resetTempPassword}
                  </code>
                  <button
                    type="button"
                    onClick={() => navigator.clipboard?.writeText(resetTempPassword).then(() => {
                      const btn = document.querySelector('[data-copy-reset-password]') as HTMLButtonElement
                      if (btn) {
                        btn.textContent = '✓ คัดลอก'
                        setTimeout(() => { btn.textContent = 'คัดลอก' }, 2000)
                      }
                    }).catch(() => {})}
                    className="px-3 py-2 rounded-lg bg-amber-500 text-white text-xs font-medium hover:bg-amber-600 transition-colors data-copy-reset-password"
                  >
                    📋 คัดลอก
                  </button>
                </div>
              </div>
            </div>
            <div className="flex gap-3 p-5 border-t border-gray-100 bg-gray-50">
              <button
                onClick={() => { setResetTempPassword(null) }}
                className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-700 hover:bg-white transition-colors"
              >
                ปิด
              </button>
              <button
                onClick={() => { navigator.clipboard?.writeText(resetTempPassword!).catch(() => {}); setResetTempPassword(null) }}
                className="flex-1 py-2.5 rounded-xl bg-green-500 text-white text-sm font-medium hover:bg-green-600 transition-colors"
              >
                คัดลอก & ปิด
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══ Add Role Modal ═══ */}
      {showAddRoleModal && selectedUserId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm">
            <div className="flex items-center justify-between p-6 border-b border-gray-100">
              <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                <Award className="w-5 h-5 text-indigo-500" />
                เพิ่มบทบาท
              </h2>
              <button onClick={() => setShowAddRoleModal(false)} className="p-1 rounded-lg hover:bg-gray-100">✕</button>
            </div>
            <div className="p-6 space-y-4">
              <div className="text-center">
                <p className="text-sm text-gray-600">เพิ่มบทบาทให้</p>
                <p className="text-lg font-bold text-gray-900">
                  {users.find(u => u.id === selectedUserId)?.name}
                </p>
              </div>
              
              {/* Role Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">เลือกบทบาทที่ต้องการเพิ่ม</label>
                <div className="space-y-2">
                  {Object.entries(roleConfig)
                    .filter(([key]) =>
                      key !== 'platform_owner' &&
                      key !== 'owner' &&
                      !(currentRole === 'manager' && key === 'manager') &&
                      !users.find(u => u.id === selectedUserId)?.roles.includes(key as ClinicRole)
                    )
                    .map(([key, cfg]) => (
                      <button
                        key={key}
                        onClick={() => setNewRole(key as ClinicRole)}
                        className={`w-full flex items-center gap-3 p-3 rounded-xl border-2 transition-all ${
                          newRole === key
                            ? 'border-current'
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                        style={{ 
                          borderColor: newRole === key ? cfg.color : undefined,
                          backgroundColor: newRole === key ? cfg.bgColor : 'white'
                        }}
                      >
                        <span className="text-xl">{cfg.icon}</span>
                        <div className="text-left flex-1">
                          <div className="font-medium" style={{ color: cfg.color }}>{cfg.label}</div>
                          <div className="text-xs text-gray-500">{cfg.labelEn}</div>
                        </div>
                        {newRole === key && (
                          <span className="text-green-500">✓</span>
                        )}
                      </button>
                    ))
                  }
                </div>
              </div>

              {/* Branch Selection (only for practitioners) */}
              {newRole === 'practitioner' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">สาขา/ความเชี่ยวชาญ (เลือกได้หลายสาขา)</label>
                  <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto">
                    {branches.map(branch => {
                      const isSelected = newBranchIds.includes(branch.id)
                      return (
                        <button
                          key={branch.id}
                          type="button"
                          onClick={() => {
                            if (isSelected) {
                              setNewBranchIds(newBranchIds.filter(b => b !== branch.id))
                            } else {
                              setNewBranchIds([...newBranchIds, branch.id])
                            }
                          }}
                          className={`flex items-center gap-2 p-2 rounded-lg border transition-all text-left ${
                            isSelected
                              ? 'border-blue-500 bg-blue-100'
                              : 'border-gray-200 hover:border-blue-300 bg-white'
                          }`}
                        >
                          <div 
                            className="w-3 h-3 rounded-full flex-shrink-0 bg-blue-400"
                          />
                          <span className="text-xs font-medium text-gray-700">{branch.name}</span>
                          {isSelected && (
                            <span className="ml-auto text-blue-600">✓</span>
                          )}
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
            <div className="flex gap-3 p-6 border-t border-gray-100">
              <button onClick={() => setShowAddRoleModal(false)} className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50">
                ยกเลิก
              </button>
              <button 
                onClick={handleAddRole}
                disabled={newRole === 'practitioner' && newBranchIds.length === 0}
                className="flex-1 py-2.5 rounded-xl bg-indigo-500 text-white text-sm font-medium hover:bg-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                เพิ่มบทบาท
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══ User Detail Modal — opened by clicking a member row ═══ */}
      {detailUser && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => setDetailUser(null)}
        >
          <div
            className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="bg-gradient-to-r from-indigo-500 to-purple-500 p-5 text-center">
              <div className="w-16 h-16 rounded-2xl bg-white/20 flex items-center justify-center text-2xl font-black text-white mx-auto mb-3">
                {detailUser.name.charAt(0)}
              </div>
              <h3 className="text-lg font-extrabold text-white">{detailUser.name}</h3>
              <p className="text-xs text-white/80 mt-1">
                {detailUser.roles.map(r => roleConfig[r]?.label).join(' · ')}
              </p>
            </div>
            <div className="p-6 space-y-4">
              {/* Name */}
              <div>
                <div className="text-xs text-gray-400 mb-0.5">ชื่อผู้ใช้งาน</div>
                <div className="text-sm font-medium text-gray-900">{detailUser.name}</div>
              </div>
              {/* Email — only real emails are shown. Synthetic staff Auth emails
                  ({id}-{rand}@internal.clinicq.local) are credential identifiers used
                  by the system for staff login and must never be presented as a real
                  email address. */}
              <div>
                <div className="text-xs text-gray-400 mb-0.5">อีเมล (ใช้เข้าสู่ระบบ)</div>
                {detailUser.email && !isInternalEmail(detailUser.email) ? (
                  <div className="text-sm font-medium text-gray-900 break-all">{detailUser.email}</div>
                ) : (
                  <div className="text-sm text-gray-400">ไม่มีข้อมูล</div>
                )}
              </div>
              {/* Phone */}
              <div>
                <div className="text-xs text-gray-400 mb-0.5">เบอร์โทรศัพท์</div>
                {detailUser.phone ? (
                  <a href={`tel:${detailUser.phone}`} className="text-sm font-medium text-blue-600 hover:underline">
                    📞 {detailUser.phone}
                  </a>
                ) : (
                  <div className="text-sm text-gray-400">ไม่มีข้อมูล</div>
                )}
              </div>
              {/* Roles */}
              <div>
                <div className="text-xs text-gray-400 mb-1">บทบาท</div>
                <div className="flex flex-wrap gap-1">
                  {detailUser.roles.map(role => <RoleBadge key={role} role={role} />)}
                </div>
              </div>
              {/* Username — only visible in the detail view, not in the list.
                  Field name `username` comes straight from GET /api/clinics/[clinicId]/users
                  (joined from staff_usernames) — never hardcoded. */}
              <div>
                <div className="text-xs text-gray-400 mb-0.5">Username สำหรับเข้าสู่ระบบ</div>
                <div className="flex items-center gap-2">
                  {detailUser.username ? (
                    <>
                      <code className="text-sm font-mono font-medium text-gray-900">@{detailUser.username}</code>
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(detailUser.username || '').catch(() => {})
                          setUsernameCopied(true)
                          setTimeout(() => setUsernameCopied(false), 1500)
                        }}
                        className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-600 text-xs font-medium transition-colors"
                        title="คัดลอก Username"
                      >
                        <Copy className="w-3 h-3" /> {usernameCopied ? 'คัดลอกแล้ว' : 'คัดลอก'}
                      </button>
                    </>
                  ) : (
                    <div className="text-sm text-gray-400">— (เข้าสู่ระบบด้วยอีเมล)</div>
                  )}
                </div>
                {detailUser.username && (
                  <p className="text-[10px] text-gray-400 mt-1">ใช้ Username นี้ร่วมกับรหัสผ่านเพื่อเข้าสู่ระบบ</p>
                )}
              </div>
              {/* Account status */}
              <div>
                <div className="text-xs text-gray-400 mb-1">สถานะบัญชี</div>
                <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${
                  detailUser.isActive ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-400'
                }`}>
                  {detailUser.isActive ? '✓ ใช้งาน' : '○ ปิดใช้งาน'}
                </span>
              </div>
              {/* Created date */}
              <div>
                <div className="text-xs text-gray-400 mb-0.5">วันที่สร้าง</div>
                <div className="text-sm font-medium text-gray-900">
                  {detailUser.createdAt
                    ? new Date(detailUser.createdAt).toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric' })
                    : 'ไม่มีข้อมูล'}
                </div>
              </div>
            </div>
            <div className="flex gap-3 p-6 border-t border-gray-100 bg-gray-50">
              {canManageUserRow(detailUser) && (
                <button
                  onClick={() => handleResetPassword(detailUser.id, detailUser.roles)}
                  disabled={resettingPassword === detailUser.id || saving}
                  className="flex-1 py-2.5 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-700 text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {resettingPassword === detailUser.id ? (
                    <span className="inline-flex items-center gap-1.5">
                      <div className="w-3.5 h-3.5 rounded-full border-2 border-amber-400 border-t-transparent animate-spin" />
                      กำลังรีเซ็ต...
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5">
                      <Lock className="w-4 h-4 text-amber-500" />
                      Reset รหัสผ่าน
                    </span>
                  )}
                </button>
              )}
              <button
                onClick={() => setDetailUser(null)}
                className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-700 hover:bg-white transition-colors"
              >
                ปิด
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
