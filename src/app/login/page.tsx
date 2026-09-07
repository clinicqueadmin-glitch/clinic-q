'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useAuth } from '@/lib/auth-context'
import { clsx } from 'clsx'
import { KeyRound, X, CheckCircle, Mail, Lock, Eye, EyeOff } from 'lucide-react'
import { isRecoveryRedirect, getRecoverySession, supabaseUpdatePassword } from '@/lib/supabase-auth'

export default function LoginPage() {
  const { login, resetPasswordByEmail } = useAuth()
  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  
  // Forgot Password state
  const [showForgot, setShowForgot] = useState(false)
  const [forgotEmail, setForgotEmail] = useState('')
  const [forgotLoading, setForgotLoading] = useState(false)
  const [forgotResult, setForgotResult] = useState<{ success: boolean; message: string } | null>(null)

  // Password Recovery (from Supabase recovery email) state
  const [recoveryMode, setRecoveryMode] = useState(false)
  const [recoveryChecking, setRecoveryChecking] = useState(false)
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showRecoveryPassword, setShowRecoveryPassword] = useState(false)
  const [showRecoveryConfirm, setShowRecoveryConfirm] = useState(false)
  const [passwordUpdateLoading, setPasswordUpdateLoading] = useState(false)
  const [passwordUpdateResult, setPasswordUpdateResult] = useState<{ success: boolean; message: string } | null>(null)

  // Clear form fields on mount to prevent browser autocomplete
  useEffect(() => {
    setIdentifier('')
    setPassword('')
  }, [])

  // ═══ Detect Supabase password-recovery redirect (email link with token) ═══
  useEffect(() => {
    if (typeof window === 'undefined') return
    if (!isRecoveryRedirect()) return

    setRecoveryMode(true)
    setRecoveryChecking(true)
    getRecoverySession().then((session) => {
      setRecoveryChecking(false)
      if (!session) {
        setPasswordUpdateResult({
          success: false,
          message: 'ลิงก์รีเซ็ตรหัสผ่านไม่ถูกต้องหรือหมดอายุแล้ว กรุณาขอลิงก์ใหม่จากหน้าเข้าสู่ระบบ',
        })
      }
    })
  }, [recoveryMode])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    const result = await login(identifier, password)
    setLoading(false)
    if (result.success) {
      window.location.href = '/'
    } else {
      setError(result.error || 'เข้าสู่ระบบไม่สำเร็จ')
    }
  }

  const handleForgotPassword = async () => {
    if (!forgotEmail.trim()) {
      setForgotResult({ success: false, message: 'กรุณากรอกอีเมล' })
      return
    }
    setForgotLoading(true)
    setForgotResult(null)
    const result = await resetPasswordByEmail(forgotEmail.trim())
    setForgotLoading(false)
    if (result.success) {
      setForgotResult({ 
        success: true, 
        message: 'ระบบได้ส่งลิงก์สำหรับตั้งรหัสผ่านใหม่ไปยังอีเมลของคุณแล้ว กรุณาตรวจสอบอีเมล (รวมถึงโฟลเดอร์สแปม)' 
      })
    } else {
      setForgotResult({ success: false, message: result.error || 'ไม่สามารถส่งลิงก์รีเซ็ตรหัสผ่านได้' })
    }
  }

  // ═══ Set new password from the recovery session ═══
  const handleSetNewPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    if (newPassword.length < 6) {
      setPasswordUpdateResult({ success: false, message: 'รหัสผ่านใหม่ต้องมีความยาวอย่างน้อย 6 ตัวอักษร' })
      return
    }
    if (newPassword !== confirmPassword) {
      setPasswordUpdateResult({ success: false, message: 'รหัสผ่านทั้งสองช่องไม่ตรงกัน' })
      return
    }
    setPasswordUpdateLoading(true)
    setPasswordUpdateResult(null)
    const result = await supabaseUpdatePassword(newPassword)
    setPasswordUpdateLoading(false)
    if (result.success) {
      setPasswordUpdateResult({ success: true, message: 'ตั้งรหัสผ่านใหม่สำเร็จ! กำลังเข้าสู่ระบบ...' })
      // Remove the recovery token from the URL
      window.history.replaceState({}, '', '/login')
      setTimeout(() => { window.location.href = '/' }, 1500)
    } else {
      setPasswordUpdateResult({
        success: false,
        message: result.error || 'ไม่สามารถตั้งรหัสผ่านใหม่ได้ กรุณาขอลิงก์รีเซ็ตรหัสผ่านใหม่',
      })
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-50 via-blue-50 to-green-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <img src="/brand-logo.png" alt="Clinic-Q" className="h-20 mx-auto mb-4" />
          <h1 className="text-3xl font-bold text-gray-900">Clinic-Q</h1>
          <p className="text-gray-500 mt-2">ระบบจัดการคิวคลินิก</p>
        </div>

        {recoveryMode ? (
          /* ═══════ SET NEW PASSWORD (from Supabase recovery email) ═══════ */
          <div className="bg-white rounded-3xl shadow-xl border border-gray-100 p-8">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-xl bg-teal-100 flex items-center justify-center">
                <Lock className="w-5 h-5 text-teal-600" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-gray-900">ตั้งรหัสผ่านใหม่</h2>
                <p className="text-xs text-gray-500">กำหนดรหัสผ่านใหม่สำหรับบัญชีของคุณ</p>
              </div>
            </div>

            {recoveryChecking ? (
              <p className="text-sm text-gray-500 text-center py-6">⏳ กำลังตรวจสอบลิงก์รีเซ็ตรหัสผ่าน...</p>
            ) : (
              <form onSubmit={handleSetNewPassword} className="space-y-4" autoComplete="off">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">รหัสผ่านใหม่</label>
                  <div className="relative">
                    <input
                      type={showRecoveryPassword ? 'text' : 'password'}
                      autoComplete="new-password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full px-4 py-3 pr-10 rounded-2xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-teal-300 focus:border-transparent transition-all text-sm"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowRecoveryPassword(!showRecoveryPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      {showRecoveryPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">ยืนยันรหัสผ่านใหม่</label>
                  <div className="relative">
                    <input
                      type={showRecoveryConfirm ? 'text' : 'password'}
                      autoComplete="new-password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full px-4 py-3 pr-10 rounded-2xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-teal-300 focus:border-transparent transition-all text-sm"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowRecoveryConfirm(!showRecoveryConfirm)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      {showRecoveryConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {passwordUpdateResult && (
                  <div className={clsx(
                    'p-3 rounded-xl border text-sm',
                    passwordUpdateResult.success 
                      ? 'bg-green-50 border-green-200 text-green-700' 
                      : 'bg-red-50 border-red-200 text-red-600'
                  )}>
                    {passwordUpdateResult.success ? '✅' : '❌'} {passwordUpdateResult.message}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={passwordUpdateLoading}
                  className="w-full py-3 rounded-2xl bg-gradient-to-r from-teal-500 to-teal-600 text-white font-bold text-sm hover:from-teal-600 hover:to-teal-700 transition-all shadow-md hover:shadow-lg disabled:opacity-50"
                >
                  {passwordUpdateLoading ? '⏳ กำลังบันทึก...' : '🔒 ตั้งรหัสผ่านใหม่'}
                </button>

                <div className="text-center">
                  <a href="/login" className="text-sm text-teal-600 hover:text-teal-700 font-medium hover:underline">
                    ← กลับไปหน้าเข้าสู่ระบบ
                  </a>
                </div>
              </form>
            )}
          </div>
        ) : (
          /* ═══════ LOGIN FORM ═══════ */          <div className="bg-white rounded-3xl shadow-xl border border-gray-100 p-8">
            <h2 className="text-xl font-bold text-gray-900 mb-2 text-center">เข้าสู่ระบบ</h2>
            {/* Guidance text */}
            <p className="text-xs text-gray-500 text-center mb-6">
              Owner ใช้ Email ส่วน Manager และพนักงานใช้ Username ที่ได้รับจากคลินิก
            </p>
            <form onSubmit={handleSubmit} className="space-y-4" autoComplete="off">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  อีเมล หรือ Username
                </label>
                <input
                  type={identifier.includes('@') ? 'email' : 'text'}
                  autoComplete="off"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  placeholder="email@example.com หรือ SM4827-manager"
                  className="w-full px-4 py-3 rounded-2xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-teal-300 focus:border-transparent transition-all text-sm"
                  required
                />
              </div>
              <div className="relative">
                <label className="block text-sm font-medium text-gray-700 mb-1.5">รหัสผ่าน</label>
                <input
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full px-4 py-3 pr-10 rounded-2xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-teal-300 focus:border-transparent transition-all text-sm"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>

              {/* Forgot Password Link */}
              <div className="text-right">
                <button
                  type="button"
                  onClick={() => { setShowForgot(true); setForgotEmail(identifier); setForgotResult(null) }}
                  className="text-sm text-teal-600 hover:text-teal-700 font-medium hover:underline"
                >
                  🔑 ลืมรหัสผ่าน?
                </button>
              </div>

              {error && (<div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-600 text-sm">❌ {error}</div>)}
              <button type="submit" disabled={loading} className="w-full py-3 rounded-2xl bg-gradient-to-r from-teal-500 to-teal-600 text-white font-bold text-sm hover:from-teal-600 hover:to-teal-700 transition-all shadow-md hover:shadow-lg disabled:opacity-50">
                {loading ? '⏳ กำลังเข้าสู่ระบบ...' : '🚀 เข้าสู่ระบบ'}
              </button>

              {/* First-time user guidance */}
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 mt-3">
                <p className="text-xs text-blue-700">
                  👤 ผู้ใช้ครั้งแรก: ให้ใช้รหัสผ่านชั่วคราวที่ได้รับจากผู้จัดการ จากนั้นระบบจะให้เปลี่ยนรหัสผ่านใหม่
                </p>
              </div>
            </form>
          </div>
        )}

        {/* Footer links */}
        <p className="text-center text-xs text-gray-400 mt-4">
          ยังไม่มีบัญชี?{' '}
          <a href="/register" className="text-purple-500 font-bold hover:underline">สมัครใช้งานฟรี</a>
          {' '}·{' '}
          <a href="/pricing" className="text-purple-500 font-bold hover:underline">ดูราคา</a>
        </p>
        <p className="text-center text-xs text-gray-400 mt-2">
          ติดต่อ Admin · <a href="https://lin.ee/OqlmFFG" target="_blank" rel="noopener noreferrer" className="text-green-500 font-bold hover:underline">💬 LINE OA</a>
        </p>
        <p className="text-center text-xs text-gray-400 mt-1">
          Clinic-Q Platform v1.0 · <Link href="/terms" className="hover:text-gray-600">เงื่อนไข</Link> · <Link href="/privacy" className="hover:text-gray-600">นโยบายความเป็นส่วนตัว</Link>
        </p>
      </div>

      {/* ═══════ FORGOT PASSWORD MODAL ═══════ */}
      {showForgot && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md animate-scale-in">
            <div className="flex items-center justify-between p-5 border-b border-gray-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center">
                  <KeyRound className="w-5 h-5 text-amber-600" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-gray-900">🔑 ลืมรหัสผ่าน</h2>
                  <p className="text-xs text-gray-500">ส่งลิงก์สำหรับตั้งรหัสผ่านใหม่ไปยังอีเมลของคุณ</p>
                </div>
              </div>
              <button onClick={() => setShowForgot(false)} className="p-2 hover:bg-gray-100 rounded-lg">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            
            <div className="p-5 space-y-4">
              {/* Info */}
              <div className="bg-teal-50 border border-teal-200 rounded-xl p-4">
                <p className="text-sm text-teal-700">
                  <CheckCircle className="w-4 h-4 inline mr-1" />
                  ระบบจะส่งลิงก์สำหรับตั้งรหัสผ่านใหม่ไปยังอีเมลของคุณ กรุณาตรวจสอบอีเมล (รวมถึงโฟลเดอร์สแปม)
                </p>
              </div>

              {/* Email Input */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  <Mail className="w-4 h-4 inline mr-1" /> อีเมลที่สมัครไว้
                </label>
                <input
                  type="email"
                  value={forgotEmail}
                  onChange={(e) => setForgotEmail(e.target.value)}
                  placeholder="your@email.com"
                  className="w-full px-4 py-3 rounded-2xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-amber-300 focus:border-transparent transition-all text-sm"
                />
              </div>

              {/* Result Message */}
              {forgotResult && (
                <div className={clsx(
                  'p-3 rounded-xl border text-sm',
                  forgotResult.success 
                    ? 'bg-green-50 border-green-200 text-green-700' 
                    : 'bg-red-50 border-red-200 text-red-600'
                )}>
                  {forgotResult.success ? '✅' : '❌'} {forgotResult.message}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex gap-3 p-5 border-t border-gray-100">
              <button
                onClick={() => setShowForgot(false)}
                className="flex-1 py-3 rounded-xl font-medium text-gray-500 bg-gray-100 hover:bg-gray-200 transition-colors text-sm"
              >
                ยกเลิก
              </button>
              <button
                onClick={handleForgotPassword}
                disabled={forgotLoading || !forgotEmail.trim()}
                className="flex-1 py-3 rounded-xl font-bold text-white bg-amber-500 hover:bg-amber-600 transition-colors text-sm shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {forgotLoading ? '⏳ กำลังส่ง...' : '🔑 ส่งลิงก์ตั้งรหัสผ่าน'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}