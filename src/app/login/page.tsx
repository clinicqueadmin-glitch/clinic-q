'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useAuth } from '@/lib/auth-context'
import { clsx } from 'clsx'

// No demo accounts - users are created through User Management

export default function LoginPage() {
  const { login } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    const result = await login(email, password)
    setLoading(false)
    if (result.success) {
      window.location.href = '/'
    } else {
      setError(result.error || 'เข้าสู่ระบบไม่สำเร็จ')
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

        {/* Login Form */}
        <div className="bg-white rounded-3xl shadow-xl border border-gray-100 p-8">
          <h2 className="text-xl font-bold text-gray-900 mb-6 text-center">เข้าสู่ระบบ</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">อีเมล</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="your@email.com" className="w-full px-4 py-3 rounded-2xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-teal-300 focus:border-transparent transition-all text-sm" required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">รหัสผ่าน</label>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" className="w-full px-4 py-3 rounded-2xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-teal-300 focus:border-transparent transition-all text-sm" required />
            </div>
            {error && (<div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-600 text-sm">❌ {error}</div>)}
            <button type="submit" disabled={loading} className="w-full py-3 rounded-2xl bg-gradient-to-r from-teal-500 to-teal-600 text-white font-bold text-sm hover:from-teal-600 hover:to-teal-700 transition-all shadow-md hover:shadow-lg disabled:opacity-50">
              {loading ? '⏳ กำลังเข้าสู่ระบบ...' : '🚀 เข้าสู่ระบบ'}
            </button>
          </form>
        </div>

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
    </div>
  )
}
