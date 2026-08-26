'use client'

import { useState } from 'react'
import { Lock, Eye, EyeOff, Shield } from 'lucide-react'
import { useAuth } from '@/lib/auth-context'

interface ForcePasswordChangeProps {
  isOpen: boolean
  onComplete: () => void
}

export default function ForcePasswordChange({ isOpen, onComplete }: ForcePasswordChangeProps) {
  const { updatePassword, user } = useAuth()
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  if (!isOpen) return null

  const handleSubmit = () => {
    setError('')
    
    if (!newPassword) {
      setError('กรุณากรอกรหัสผ่านใหม่')
      return
    }
    
    if (newPassword.length < 6) {
      setError('รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร')
      return
    }
    
    if (newPassword === '123456') {
      setError('รหัสผ่านใหม่ต้องไม่ซ้ำกับรหัสผ่านเดิม')
      return
    }
    
    if (newPassword !== confirmPassword) {
      setError('รหัสผ่านไม่ตรงกัน')
      return
    }
    
    updatePassword(newPassword)
    setSuccess(true)
    
    setTimeout(() => {
      onComplete()
    }, 1500)
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-orange-500 to-red-500 p-6 text-white">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
              <Shield className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-bold">เปลี่ยนรหัสผ่าน</h2>
              <p className="text-sm text-white/80">กรุณาเปลี่ยนรหัสผ่านก่อนเข้าใช้งาน</p>
            </div>
          </div>
        </div>
        
        {/* Body */}
        <div className="p-6">
          {success ? (
            <div className="text-center py-6">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-2">เปลี่ยนรหัสผ่านสำเร็จ!</h3>
              <p className="text-sm text-gray-500">กำลังเข้าสู่ระบบ...</p>
            </div>
          ) : (
            <>
              <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 mb-4">
                <div className="flex items-start gap-3">
                  <Lock className="w-5 h-5 text-orange-600 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-orange-800">รหัสผ่านเดิม: 123456</p>
                    <p className="text-sm text-orange-600 mt-1">กรุณาเปลี่ยนรหัสผ่านเป็นรหัสใหม่ที่มีความปลอดภัย</p>
                  </div>
                </div>
              </div>
              
              {error && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-3 mb-4">
                  <p className="text-sm text-red-600">{error}</p>
                </div>
              )}
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    รหัสผ่านใหม่ *
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="w-full px-4 py-2.5 pr-10 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-orange-300 focus:border-orange-300"
                      placeholder="กรอกรหัสผ่านใหม่ (อย่างน้อย 6 ตัวอักษร)"
                      autoFocus
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    ยืนยันรหัสผ่าน *
                  </label>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-orange-300 focus:border-orange-300"
                    placeholder="กรอกรหัสผ่านอีกครั้ง"
                  />
                </div>
              </div>
              
              <div className="mt-6">
                <button
                  onClick={handleSubmit}
                  className="w-full py-3 rounded-xl bg-gradient-to-r from-orange-500 to-red-500 text-white font-medium hover:from-orange-600 hover:to-red-600 transition-all shadow-lg shadow-orange-200"
                >
                  เปลี่ยนรหัสผ่านและเข้าสู่ระบบ
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
