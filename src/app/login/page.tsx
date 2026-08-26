'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useAuth } from '@/lib/auth-context'
import { clsx } from 'clsx'

interface DemoAccount {
  email: string
  password: string
  role: string
  roleShort: string
  color: string
}

interface ClinicDemoGroup {
  name: string
  icon: string
  color: string
  accounts: DemoAccount[]
}

const clinicDemoGroups: ClinicDemoGroup[] = [
  {
    name: '🏥 เจ้าของระบบ',
    icon: '🔴',
    color: '#DC2626',
    accounts: [
      { email: 'admin@clinicq.com', password: 'admin123', role: 'Platform Owner', roleShort: 'owner', color: '#DC2626' },
    ],
  },
  {
    name: '🦷 คลินิกทันตกรรม',
    icon: '🦷',
    color: '#A855F7',
    accounts: [
      { email: 'owner@dental.com', password: 'owner123', role: 'เจ้าของคลินิก', roleShort: 'owner', color: '#EA580C' },
      { email: 'manager@dental.com', password: 'manager123', role: 'ผู้จัดการ', roleShort: 'manager', color: '#CA8A04' },
      { email: 'front@dental.com', password: 'front123', role: 'เจ้าหน้าที่', roleShort: 'front', color: '#16A34A' },
      { email: 'doctor@dental.com', password: 'doctor123', role: 'ผู้ทำหัตถการ', roleShort: 'doctor', color: '#2563EB' },
    ],
  },
  {
    name: '💊 คลินิกเวชกรรม',
    icon: '💊',
    color: '#22C55E',
    accounts: [
      { email: 'owner@medical.com', password: 'owner123', role: 'เจ้าของคลินิก', roleShort: 'owner', color: '#EA580C' },
      { email: 'manager@medical.com', password: 'manager123', role: 'ผู้จัดการ', roleShort: 'manager', color: '#CA8A04' },
      { email: 'front@medical.com', password: 'front123', role: 'เจ้าหน้าที่', roleShort: 'front', color: '#16A34A' },
      { email: 'doctor@medical.com', password: 'doctor123', role: 'ผู้ทำหัตถการ', roleShort: 'doctor', color: '#2563EB' },
    ],
  },
  {
    name: '✨ คลินิกเสริมความงาม',
    icon: '✨',
    color: '#EC4899',
    accounts: [
      { email: 'owner@aesthetic.com', password: 'owner123', role: 'เจ้าของคลินิก', roleShort: 'owner', color: '#EA580C' },
      { email: 'manager@aesthetic.com', password: 'manager123', role: 'ผู้จัดการ', roleShort: 'manager', color: '#CA8A04' },
      { email: 'front@aesthetic.com', password: 'front123', role: 'เจ้าหน้าที่', roleShort: 'front', color: '#16A34A' },
      { email: 'doctor@aesthetic.com', password: 'doctor123', role: 'ผู้ทำหัตถการ', roleShort: 'doctor', color: '#2563EB' },
    ],
  },
  {
    name: '🌿 แพทย์แผนไทย',
    icon: '🌿',
    color: '#EAB308',
    accounts: [
      { email: 'owner@thai.com', password: 'owner123', role: 'เจ้าของคลินิก', roleShort: 'owner', color: '#EA580C' },
      { email: 'manager@thai.com', password: 'manager123', role: 'ผู้จัดการ', roleShort: 'manager', color: '#CA8A04' },
      { email: 'front@thai.com', password: 'front123', role: 'เจ้าหน้าที่', roleShort: 'front', color: '#16A34A' },
      { email: 'doctor@thai.com', password: 'doctor123', role: 'ผู้ทำหัตถการ', roleShort: 'doctor', color: '#2563EB' },
    ],
  },
  {
    name: '🏮 แพทย์แผนจีน',
    icon: '🏮',
    color: '#F97316',
    accounts: [
      { email: 'owner@chinese.com', password: 'owner123', role: 'เจ้าของคลินิก', roleShort: 'owner', color: '#EA580C' },
      { email: 'manager@chinese.com', password: 'manager123', role: 'ผู้จัดการ', roleShort: 'manager', color: '#CA8A04' },
      { email: 'front@chinese.com', password: 'front123', role: 'เจ้าหน้าที่', roleShort: 'front', color: '#16A34A' },
      { email: 'doctor@chinese.com', password: 'doctor123', role: 'ผู้ทำหัตถการ', roleShort: 'doctor', color: '#2563EB' },
    ],
  },
  {
    name: '🦴 กายภาพบำบัด',
    icon: '🦴',
    color: '#3B82F6',
    accounts: [
      { email: 'owner@physical.com', password: 'owner123', role: 'เจ้าของคลินิก', roleShort: 'owner', color: '#EA580C' },
      { email: 'manager@physical.com', password: 'manager123', role: 'ผู้จัดการ', roleShort: 'manager', color: '#CA8A04' },
      { email: 'front@physical.com', password: 'front123', role: 'เจ้าหน้าที่', roleShort: 'front', color: '#16A34A' },
      { email: 'doctor@physical.com', password: 'doctor123', role: 'ผู้ทำหัตถการ', roleShort: 'doctor', color: '#2563EB' },
    ],
  },
]

export default function LoginPage() {
  const { login } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [expandedClinic, setExpandedClinic] = useState<string | null>(null)

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

  const fillDemo = (acc: DemoAccount) => {
    setEmail(acc.email)
    setPassword(acc.password)
    setError('')
    // Clear any previous clinic registration to use the correct clinic
    const registered = JSON.parse(localStorage.getItem('clinicq-registered-clinics') || '{}')
    delete registered[acc.email]
    localStorage.setItem('clinicq-registered-clinics', JSON.stringify(registered))
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

          {/* Demo Accounts */}
          <div className="mt-6 pt-6 border-t border-gray-100">
            <p className="text-xs text-gray-400 text-center mb-3">บัญชีทดสอบ · รหัสผ่าน: ตาม role + 123</p>
            <div className="space-y-2 max-h-[400px] overflow-y-auto pr-1">
              {clinicDemoGroups.map((group, gi) => (
                <div key={gi}>
                  <button
                    onClick={() => setExpandedClinic(expandedClinic === group.name ? null : group.name)}
                    className="w-full text-left px-3 py-2 rounded-xl bg-gray-50 hover:bg-gray-100 transition-colors text-xs flex items-center justify-between font-medium"
                  >
                    <span className="text-gray-700">{group.name}</span>
                    <span className="text-gray-400 text-[10px]">{expandedClinic === group.name ? '▲' : '▼'}</span>
                  </button>
                  {expandedClinic === group.name && (
                    <div className="ml-2 mt-1 space-y-1">
                      {group.accounts.map((acc, ai) => (
                        <button
                          key={ai}
                          onClick={() => fillDemo(acc)}
                          className="w-full text-left px-3 py-2 rounded-lg hover:bg-gray-50 transition-colors text-[11px] flex items-center gap-2"
                        >
                          <span className="w-5 h-5 rounded-full flex items-center justify-center text-[8px] font-bold text-white flex-shrink-0" style={{ backgroundColor: acc.color }}>
                            {acc.roleShort.charAt(0).toUpperCase()}
                          </span>
                          <span className="font-medium text-gray-700 truncate">{acc.email}</span>
                          <span className="text-gray-400 ml-auto flex-shrink-0">{acc.role}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
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
