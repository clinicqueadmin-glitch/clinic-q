'use client'

import { useState, useEffect, useMemo } from 'react'
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
import { UserPlus, Edit, Trash2, Shield, Users, Award, Plus, X, UserMinus } from 'lucide-react'

interface UserWithRoles {
  id: string
  email: string
  name: string
  phone?: string
  password?: string
  createdAt: string
  roles: ClinicRole[]
  branchIds?: string[] // For practitioners
  isActive: boolean
  forcePasswordChange?: boolean
}

interface RoleAssignmentForm {
  name: string
  email: string
  phone: string
  password: string
  roles: ClinicRole[]
  branchIds: string[]
}

export default function UserManagement({ isOwner = false }: { isOwner?: boolean }) {
  const { currentClinicId } = useAuth()
  const { currentClinic } = useClinic()
  const { practitioners, addPractitioner, updatePractitioner, deletePractitioner } = usePractitioners()
  const branchData = getDefaultBranchData(currentClinic || 'dental')
  
  const [users, setUsers] = useState<UserWithRoles[]>([])
  const [showAddModal, setShowAddModal] = useState(false)
  const [editingUser, setEditingUser] = useState<UserWithRoles | null>(null)
  const [form, setForm] = useState<RoleAssignmentForm>({
    name: '',
    email: '',
    phone: '',
    password: '123456',
    roles: [],
    branchIds: []
  })
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null)
  const [showAddRoleModal, setShowAddRoleModal] = useState(false)
  const [newRole, setNewRole] = useState<ClinicRole>('front_desk')
  const [newBranchIds, setNewBranchIds] = useState<string[]>([])

  const branches = branchData.branches.filter(b => b.active)

  // Load users from localStorage
  useEffect(() => {
    if (typeof window === 'undefined') return
    
    const savedUsers = localStorage.getItem('clinicq-users-with-roles')
    if (savedUsers) {
      try {
        const parsed = JSON.parse(savedUsers)
        if (Array.isArray(parsed) && parsed.length > 0) {
          setUsers(parsed)
          return
        }
      } catch {}
    }
    
    // Initialize from auth context demo users if no saved data
    const authUsers = localStorage.getItem('clinicq-users')
    if (authUsers) {
      try {
        const users = JSON.parse(authUsers)
        if (Array.isArray(users)) {
          const memberships = JSON.parse(localStorage.getItem('clinicq-memberships') || '[]')
          const initializedUsers = users.map(user => {
            const userMemberships = memberships.filter((m: any) => m.userId === user.id && m.isActive)
            return {
              id: user.id,
              email: user.email,
              name: user.name,
              phone: user.phone || '',
              createdAt: user.createdAt,
              roles: userMemberships.map((m: any) => m.role),
              branchIds: [],
              isActive: true,
              forcePasswordChange: false,
            }
          })
          setUsers(initializedUsers)
          localStorage.setItem('clinicq-users-with-roles', JSON.stringify(initializedUsers))
        }
      } catch {}
    }
  }, [])

  // Save to localStorage + sync with auth system
  useEffect(() => {
    if (users.length > 0) {
      localStorage.setItem('clinicq-users-with-roles', JSON.stringify(users))
      // Sync with auth system's user store so login can find them
      const authUsers = users.map(u => ({
        id: u.id,
        email: u.email,
        name: u.name,
        phone: u.phone || '',
        createdAt: u.createdAt,
        forcePasswordChange: u.forcePasswordChange ?? true,
      }))
      localStorage.setItem('clinicq-users', JSON.stringify(authUsers))
    }
  }, [users])

  // Get users with roles for current clinic
  const clinicUsers = useMemo(() => {
    return users.filter(u => u.roles.length > 0)
  }, [users])

  // Open add user modal
  const openAddUser = () => {
    setEditingUser(null)
    setForm({
      name: '',
      email: '',
      phone: '',
      password: '123456',
      roles: [],
      branchIds: []
    })
    setShowAddModal(true)
  }

  // Open edit user modal
  const openEditUser = (user: UserWithRoles) => {
    setEditingUser(user)
    setForm({
      name: user.name,
      email: user.email,
      phone: user.phone || '',
      password: '123456',
      roles: [...user.roles],
      branchIds: [...(user.branchIds || [])]
    })
    setShowAddModal(true)
  }

  // Save user
  const handleSaveUser = () => {
    if (!form.name || !form.email) return
    
    // Check if email already exists (for new users)
    if (!editingUser && users.some(u => u.email === form.email)) {
      alert('อีเมลนี้มีในระบบแล้ว')
      return
    }

    if (editingUser) {
      // Update existing user
      setUsers(prev => prev.map(u => 
        u.id === editingUser.id 
          ? { 
              ...u, 
              name: form.name, 
              email: form.email, 
              phone: form.phone,
              roles: form.roles,
              branchIds: form.branchIds
            }
          : u
      ))
      
      // Sync practitioner if user has practitioner role
      if (form.roles.includes('practitioner')) {
        const existingPractitioner = practitioners.find(p => p.userId === editingUser.id)
        if (existingPractitioner) {
          // Update existing practitioner
          updatePractitioner(existingPractitioner.id, {
            name: form.name,
            phone: form.phone,
            branchId: form.branchIds?.[0] || existingPractitioner.branchId,
            userId: editingUser.id,
            clinicId: currentClinicId || undefined,
          })
        } else {
          // Create new practitioner record
          addPractitioner({
            id: `pract-${Date.now()}`,
            name: form.name,
            phone: form.phone || '',
            branchId: form.branchIds?.[0] || '',
            active: true,
            userId: editingUser.id,
            clinicId: currentClinicId || undefined,
          })
        }
      }
    } else {
      // Create new user
      const newUser: UserWithRoles = {
        id: `user-${Date.now()}`,
        name: form.name,
        email: form.email,
        phone: form.phone,
        password: form.password,
        createdAt: new Date().toISOString(),
        roles: form.roles,
        branchIds: form.branchIds,
        isActive: true,
        forcePasswordChange: true  // Set flag to require password change on first login
      }
      setUsers(prev => [...prev, newUser])
      // Store password for login
      const userPasswords = JSON.parse(localStorage.getItem('clinicq-user-passwords') || '{}')
      userPasswords[form.email] = form.password
      localStorage.setItem('clinicq-user-passwords', JSON.stringify(userPasswords))
      // Also add membership for this clinic
      const memberships = JSON.parse(localStorage.getItem('clinicq-memberships') || '[]')
      const newMembership = {
        id: `membership-${Date.now()}`,
        userId: newUser.id,
        clinicId: currentClinicId || '',
        role: form.roles[0] || 'front_desk',
        isActive: true,
        createdAt: new Date().toISOString(),
      }
      localStorage.setItem('clinicq-memberships', JSON.stringify([...memberships, newMembership]))
      
      // Create practitioner record if user has practitioner role
      if (form.roles.includes('practitioner')) {
        addPractitioner({
          id: `pract-${Date.now()}`,
          name: form.name,
          phone: form.phone || '',
          branchId: form.branchIds?.[0] || '',
          active: true,
          userId: newUser.id,
          clinicId: currentClinicId || undefined,
        })
      }
    }
    setShowAddModal(false)
  }

  // Delete user
  const deleteUser = (userId: string) => {
    if (!confirm('ต้องการลบผู้ใช้งานนี้ออกจากระบบหรือไม่?')) return
    
    // Remove practitioner if exists
    const user = users.find(u => u.id === userId)
    if (user?.roles.includes('practitioner')) {
      const practitioner = practitioners.find(p => p.userId === userId)
      if (practitioner) {
        deletePractitioner(practitioner.id)
      }
    }
    
    setUsers(prev => prev.filter(u => u.id !== userId))
  }

  // Sync existing users with practitioners
  useEffect(() => {
    if (users.length === 0) return
    
    // For each user with practitioner role, check if they have a practitioner record
    users.filter(u => u.roles.includes('practitioner')).forEach(user => {
      const existingPractitioner = practitioners.find(p => p.userId === user.id)
      if (!existingPractitioner) {
        // Create practitioner record for this user
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

  // Toggle user active status
  const toggleUserActive = (userId: string) => {
    setUsers(prev => prev.map(u => 
      u.id === userId ? { ...u, isActive: !u.isActive } : u
    ))
  }

  // Open add role modal
  const openAddRole = (userId: string) => {
    setSelectedUserId(userId)
    setNewRole('front_desk')
    setNewBranchIds([])
    setShowAddRoleModal(true)
  }

  // Add role to user
  const handleAddRole = () => {
    if (!selectedUserId) return
    
    setUsers(prev => prev.map(u => {
      if (u.id === selectedUserId) {
        // Check if role already exists
        if (u.roles.includes(newRole)) {
          alert('บทบาทนี้มีอยู่แล้ว')
          return u
        }
        
        const updatedBranchIds = newRole === 'practitioner' 
          ? [...new Set([...(u.branchIds || []), ...newBranchIds])]
          : u.branchIds
        
        return {
          ...u,
          roles: [...u.roles, newRole],
          branchIds: updatedBranchIds
        }
      }
      return u
    }))
    setShowAddRoleModal(false)
  }

  // Remove role from user
  const removeRole = (userId: string, role: ClinicRole) => {
    if (!confirm(`ต้องการลบบทบาท ${roleConfig[role].label} ออกหรือไม่?`)) return
    
    setUsers(prev => prev.map(u => {
      if (u.id === userId) {
        const newRoles = u.roles.filter(r => r !== role)
        // If removing practitioner role, clear branchIds
        const newBranchIds = role === 'practitioner' ? [] : u.branchIds
        return { ...u, roles: newRoles, branchIds: newBranchIds }
      }
      return u
    }))
  }

  // Remove branch from practitioner
  const removeBranch = (userId: string, branchId: string) => {
    setUsers(prev => prev.map(u => {
      if (u.id === userId) {
        return {
          ...u,
          branchIds: (u.branchIds || []).filter(b => b !== branchId)
        }
      }
      return u
    }))
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
        </div>
        {isOwner && (
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
            {clinicUsers.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-12 text-center text-gray-400">
                  <Users className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                  <p className="font-medium">ยังไม่มีผู้ใช้ในคลินิก</p>
                  <p className="text-sm mt-1">กดปุ่ม "เพิ่มผู้ใช้" เพื่อเริ่มต้น</p>
                </td>
              </tr>
            ) : (
              clinicUsers.map(user => (
                <tr key={user.id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-sm font-bold text-white ${
                        user.roles.includes('owner') ? 'bg-orange-500' :
                        user.roles.includes('manager') ? 'bg-yellow-500' :
                        user.roles.includes('front_desk') ? 'bg-green-500' :
                        'bg-indigo-500'
                      }`}>
                        {user.name.charAt(0)}
                      </div>
                      <div>
                        <div className="text-sm font-medium text-gray-900">{user.name}</div>
                        <div className="text-xs text-gray-500">{user.email}</div>
                        {user.phone && (
                          <a href={`tel:${user.phone}`} className="text-xs text-blue-600 hover:underline">
                            📞 {user.phone}
                          </a>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {user.roles.map(role => (
                        <div key={role} className="flex items-center gap-1">
                          <RoleBadge role={role} />
                          {isOwner && role !== 'owner' && (
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
                      {isOwner && user.roles.length < Object.keys(roleConfig).length && (
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
                                {isOwner && (
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
                    <button
                      onClick={() => toggleUserActive(user.id)}
                      className={`px-2 py-0.5 rounded-full text-[10px] font-medium transition-colors ${
                        user.isActive
                          ? 'bg-green-100 text-green-600 hover:bg-green-200'
                          : 'bg-gray-100 text-gray-400 hover:bg-gray-200'
                      }`}
                    >
                      {user.isActive ? '✓ ใช้งาน' : '○ ปิดใช้งาน'}
                    </button>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      {isOwner && (
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
      {isOwner && (
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

              {/* Email */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">อีเมล *</label>
                <input 
                  type="email"
                  value={form.email} 
                  onChange={(e) => setForm({ ...form, email: e.target.value })} 
                  className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300" 
                  placeholder="email@example.com" 
                />
              </div>

              {/* Phone */}
              <PhoneInput
                label="เบอร์โทรศัพท์"
                value={form.phone}
                onChange={(v) => setForm({ ...form, phone: v })}
              />

              {/* Password */}
              {!editingUser && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">รหัสผ่านเริ่มต้น</label>
                  <input 
                    type="password"
                    value={form.password} 
                    onChange={(e) => setForm({ ...form, password: e.target.value })} 
                    className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300" 
                  />
                  <p className="text-xs text-gray-400 mt-1">รหัสผ่านเริ่มต้น: 123456</p>
                </div>
              )}

              {/* Roles */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">บทบาทในคลินิก (เลือกได้หลายบทบาท)</label>
                <div className="grid grid-cols-2 gap-2">
                  {Object.entries(roleConfig).filter(([key]) => key !== 'platform_owner').map(([key, cfg]) => {
                    const isSelected = form.roles.includes(key as ClinicRole)
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => {
                          if (isSelected) {
                            setForm({ 
                              ...form, 
                              roles: form.roles.filter(r => r !== key),
                              branchIds: key === 'practitioner' ? [] : form.branchIds
                            })
                          } else {
                            setForm({ ...form, roles: [...form.roles, key as ClinicRole] })
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
            <div className="flex gap-3 p-6 border-t border-gray-100 sticky bottom-0 bg-white">
              <button onClick={() => setShowAddModal(false)} className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50">
                ยกเลิก
              </button>
              <button 
                onClick={handleSaveUser} 
                disabled={!form.name || !form.email || form.roles.length === 0}
                className="flex-1 py-2.5 rounded-xl bg-indigo-500 text-white text-sm font-medium hover:bg-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {editingUser ? 'บันทึกการแก้ไข' : 'เพิ่มผู้ใช้'}
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
                    .filter(([key]) => key !== 'platform_owner' && !users.find(u => u.id === selectedUserId)?.roles.includes(key as ClinicRole))
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
    </div>
  )
}
