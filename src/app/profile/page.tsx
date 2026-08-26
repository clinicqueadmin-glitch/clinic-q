'use client'

import { useState, useEffect } from 'react'
import { User, Mail, Phone, Calendar, Shield, Save, ArrowLeft, Camera, CheckCircle, Lock, Eye, EyeOff } from 'lucide-react'
import { useAuth } from '@/lib/auth-context'
import { roleConfig } from '@/lib/auth-types'
import { useRouter } from 'next/navigation'

export default function ProfilePage() {
  const { user, currentRole } = useAuth()
  const router = useRouter()
  const roleCfg = currentRole ? roleConfig[currentRole] : null

  const [name, setName] = useState(user?.name || '')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState(user?.email || '')
  const [isSaving, setIsSaving] = useState(false)
  const [showSuccess, setShowSuccess] = useState(false)
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showCurrentPw, setShowCurrentPw] = useState(false)
  const [showNewPw, setShowNewPw] = useState(false)
  const [pwError, setPwError] = useState('')
  const [pwSuccess, setPwSuccess] = useState(false)
  const isOwner = currentRole === 'owner' || currentRole === 'platform_owner'

  // Load saved profile data from localStorage
  useEffect(() => {
    if (user) {
      const saved = localStorage.getItem(`clinicq-profile-${user.id}`)
      if (saved) {
        try {
          const data = JSON.parse(saved)
          if (data.name) setName(data.name)
          if (data.phone) setPhone(data.phone)
        } catch {}
      }
    }
  }, [user])

  const handleSave = () => {
    if (!user) return
    setIsSaving(true)
    // Save to localStorage
    localStorage.setItem(`clinicq-profile-${user.id}`, JSON.stringify({
      name,
      phone,
      email,
    }))
    // Update session name if changed
    if (name !== user.name) {
      const session = JSON.parse(localStorage.getItem('clinicq-auth') || '{}')
      if (session.user) {
        session.user.name = name
        localStorage.setItem('clinicq-auth', JSON.stringify(session))
      }
    }
    setTimeout(() => {
      setIsSaving(false)
      setShowSuccess(true)
      setTimeout(() => setShowSuccess(false), 2000)
    }, 500)
  }

  const handleChangePassword = () => {
    setPwError('')
    setPwSuccess(false)
    if (!currentPassword || !newPassword || !confirmPassword) {
      setPwError('กรุณากรอกรหัสผ่านให้ครบทุกช่อง')
      return
    }
    if (newPassword.length < 6) {
      setPwError('รหัสผ่านใหม่ต้องมีอย่างน้อย 6 ตัวอักษร')
      return
    }
    if (newPassword !== confirmPassword) {
      setPwError('รหัสผ่านใหม่ไม่ตรงกัน')
      return
    }
    // Check current password against demo data
    if (!user) return
    const storedPw = localStorage.getItem(`clinicq-pw-${user.id}`)
    const defaultPw = user.email.split('@')[0] + '123'
    if (currentPassword !== (storedPw || defaultPw)) {
      setPwError('รหัสผ่านเดิมไม่ถูกต้อง')
      return
    }
    // Save new password
    localStorage.setItem(`clinicq-pw-${user.id}`, newPassword)
    setCurrentPassword('')
    setNewPassword('')
    setConfirmPassword('')
    setPwSuccess(true)
    setTimeout(() => setPwSuccess(false), 2000)
  }

  if (!user) return null

  return (
    <div className="max-w-2xl mx-auto p-4 sm:p-6 space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => router.back()}
          className="p-2 hover:bg-gray-100 rounded-xl transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-gray-600" />
        </button>
        <h1 className="text-2xl font-bold text-gray-900">โปรไฟล์ของฉัน</h1>
      </div>

      {/* Profile Card */}
      <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
        {/* Avatar Section */}
        <div className="bg-gradient-to-r from-pink-50 to-purple-50 px-6 py-8 flex flex-col items-center">
          <div className="relative">
            <div
              className="w-24 h-24 rounded-full flex items-center justify-center text-white text-3xl font-bold shadow-lg"
              style={{ backgroundColor: roleCfg?.color || '#9CA3AF' }}
            >
              {name.charAt(0)}
            </div>
            <button className="absolute bottom-0 right-0 p-2 bg-white rounded-full shadow-md hover:shadow-lg transition-shadow">
              <Camera className="w-4 h-4 text-gray-600" />
            </button>
          </div>
          <h2 className="mt-4 text-xl font-bold text-gray-900">{name}</h2>
          <span
            className="mt-2 px-3 py-1 rounded-full text-xs font-bold"
            style={{ backgroundColor: roleCfg?.bgColor, color: roleCfg?.color }}
          >
            {roleCfg?.icon} {roleCfg?.label}
          </span>
        </div>

        {/* Form */}
        <div className="p-6 space-y-5">
          {/* Name */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              <User className="w-4 h-4 inline mr-2" />
              ชื่อ-นามสกุล
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-pink-400 focus:ring-2 focus:ring-pink-100 outline-none transition-all text-gray-900 font-medium"
            />
          </div>

          {/* Email */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              <Mail className="w-4 h-4 inline mr-2" />
              อีเมล
            </label>
            <input
              type="email"
              value={email}
              disabled
              className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 text-gray-500 cursor-not-allowed"
            />
            <p className="text-xs text-gray-400 mt-1">ไม่สามารถเปลี่ยนอีเมลได้</p>
          </div>

          {/* Phone */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              <Phone className="w-4 h-4 inline mr-2" />
              เบอร์โทรศัพท์
            </label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="กรอกเบอร์โทรศัพท์"
              className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-pink-400 focus:ring-2 focus:ring-pink-100 outline-none transition-all text-gray-900 font-medium"
            />
          </div>

          {/* Role */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              <Shield className="w-4 h-4 inline mr-2" />
              บทบาท
            </label>
            <div className="px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 text-gray-600 font-medium">
              {roleCfg?.label || 'ไม่ทราบบทบาท'}
            </div>
          </div>

          {/* Created */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              <Calendar className="w-4 h-4 inline mr-2" />
              วันที่สมัคร
            </label>
            <div className="px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 text-gray-600 font-medium">
              {user.createdAt ? new Date(user.createdAt).toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric' }) : 'ไม่ทราบ'}
            </div>
          </div>

          {/* Password Change */}
          <div className="border-t border-gray-100 pt-6 mt-2">
            <h3 className="text-sm font-bold text-gray-900 mb-4 flex items-center gap-2">
              <Lock className="w-4 h-4" /> เปลี่ยนรหัสผ่าน
            </h3>

            {pwError && (
              <div className="mb-3 px-4 py-2 rounded-xl bg-red-50 text-red-600 text-sm font-medium">
                {pwError}
              </div>
            )}
            {pwSuccess && (
              <div className="mb-3 px-4 py-2 rounded-xl bg-green-50 text-green-600 text-sm font-medium flex items-center gap-2">
                <CheckCircle className="w-4 h-4" /> เปลี่ยนรหัสผ่านสำเร็จ!
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">รหัสผ่านเดิม</label>
                <div className="relative">
                  <input
                    type={showCurrentPw ? 'text' : 'password'}
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder="กรอกรหัสผ่านเดิม"
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:border-pink-400 focus:ring-2 focus:ring-pink-100 outline-none transition-all text-sm"
                  />
                  <button type="button" onClick={() => setShowCurrentPw(!showCurrentPw)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                    {showCurrentPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">รหัสผ่านใหม่</label>
                <div className="relative">
                  <input
                    type={showNewPw ? 'text' : 'password'}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="กรอกรหัสผ่านใหม่ (อย่างน้อย 6 ตัว)"
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:border-pink-400 focus:ring-2 focus:ring-pink-100 outline-none transition-all text-sm"
                  />
                  <button type="button" onClick={() => setShowNewPw(!showNewPw)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                    {showNewPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">ยืนยันรหัสผ่านใหม่</label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="กรอกรหัสผ่านใหม่อีกครั้ง"
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:border-pink-400 focus:ring-2 focus:ring-pink-100 outline-none transition-all text-sm"
                />
              </div>
              <button
                onClick={handleChangePassword}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border-2 border-gray-200 text-gray-700 font-bold hover:bg-gray-50 transition-all text-sm"
              >
                <Lock className="w-4 h-4" /> เปลี่ยนรหัสผ่าน
              </button>
            </div>
          </div>

          {/* Save Button */}
          <div className="pt-4">
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="w-full flex items-center justify-center gap-2 px-6 py-3 rounded-xl text-white font-bold shadow-lg hover:shadow-xl transition-all disabled:opacity-50"
              style={{ backgroundColor: roleCfg?.color || '#F97316' }}
            >
              {isSaving ? (
                <span className="animate-spin w-5 h-5 border-2 border-white border-t-transparent rounded-full" />
              ) : showSuccess ? (
                <>
                  <CheckCircle className="w-5 h-5" /> บันทึกสำเร็จ!
                </>
              ) : (
                <>
                  <Save className="w-5 h-5" /> บันทึกการเปลี่ยนแปลง
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
