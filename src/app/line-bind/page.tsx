'use client'

import { useState, useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { Phone, MessageCircle, Check, AlertCircle, User, ArrowRight } from 'lucide-react'
import { saveLineUserProfile, type LineUserProfile } from '@/lib/line-notification'

function LineBindForm() {
  const searchParams = useSearchParams()
  const lineUserId = searchParams.get('userId') || ''
  
  const [phoneNumber, setPhoneNumber] = useState('')
  const [name, setName] = useState('')
  const [clinicId, setClinicId] = useState('')
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [errorMessage, setErrorMessage] = useState('')
  const [clinicName, setClinicName] = useState('')

  useEffect(() => {
    // Get clinic info from URL or localStorage
    const clinic = searchParams.get('clinic') || 'dental'
    setClinicId(clinic)
    
    // Get clinic name from settings (clinic-specific)
    const clinics = JSON.parse(localStorage.getItem('clinicq-clinics') || '[]')
    const matchedClinic = clinics.find((c: any) => c.type === clinic)
    const cid = matchedClinic?.id
    const saved = (cid ? localStorage.getItem(`clinic-q-settings-${cid}`) : null) || localStorage.getItem('clinic-q-settings')
    if (saved) {
      try {
        const parsed = JSON.parse(saved)
        setClinicName(parsed.clinicName || 'คลินิก')
      } catch {
        setClinicName('คลินิก')
      }
    }
  }, [searchParams])

  const formatPhoneNumber = (value: string) => {
    const numbers = value.replace(/\D/g, '')
    if (numbers.length <= 3) return numbers
    if (numbers.length <= 6) return `${numbers.slice(0, 3)}-${numbers.slice(3)}`
    return `${numbers.slice(0, 3)}-${numbers.slice(3, 6)}-${numbers.slice(6, 10)}`
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!phoneNumber || phoneNumber.replace(/\D/g, '').length < 10) {
      setErrorMessage('กรุณากรอกเบอร์โทรศัพท์ให้ถูกต้อง (10 หลัก)')
      setStatus('error')
      return
    }

    if (!lineUserId) {
      setErrorMessage('ไม่พบ LINE User ID กรุณาสแกน QR Code จาก LINE OA อีกครั้ง')
      setStatus('error')
      return
    }

    setStatus('loading')
    
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1500))
    
    // Save LINE user profile
    const profile: LineUserProfile = {
      userId: lineUserId,
      displayName: name || `LINE User ${lineUserId.slice(-6)}`,
      phoneNumber: phoneNumber,
      clinicId: clinicId,
      createdAt: new Date(),
    }
    
    saveLineUserProfile(profile)
    setStatus('success')
  }

  if (status === 'success') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-400 to-green-600 flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden">
          <div className="p-8 text-center">
            <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <Check className="w-10 h-10 text-green-600" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">เชื่อมต่อสำเร็จ!</h1>
            <p className="text-gray-600 mb-6">
              บัญชี LINE ของคุณเชื่อมต่อกับเบอร์ <strong>{phoneNumber}</strong> เรียบร้อยแล้ว
            </p>
            <div className="bg-green-50 border border-green-200 rounded-xl p-4 mb-6">
              <div className="flex items-center gap-2 text-green-700 mb-2">
                <MessageCircle className="w-5 h-5" />
                <span className="font-medium">เปิดใช้งานการแจ้งเตือน</span>
              </div>
              <p className="text-sm text-green-600">
                ตอนนี้คุณจะได้รับการแจ้งเตือนผ่าน LINE เมื่อถึงคิวของคุณ
              </p>
            </div>
            <p className="text-sm text-gray-500">
              ปิดหน้านี้เพื่อกลับไป LINE
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-400 to-green-600 flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden">
        {/* Header */}
        <div className="bg-[#06c755] p-6 text-center">
          <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-[#06c755] font-bold text-xl">Q+</span>
          </div>
          <h1 className="text-xl font-bold text-white">เชื่อมต่อบัญชี LINE</h1>
          <p className="text-white/80 text-sm mt-1">{clinicName}</p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* LINE User ID Display */}
          <div className="bg-gray-50 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <MessageCircle className="w-4 h-4 text-[#06c755]" />
              <span className="text-sm font-medium text-gray-700">LINE User ID</span>
            </div>
            {lineUserId ? (
              <p className="text-sm text-gray-600 font-mono bg-white p-2 rounded-lg border border-gray-200">
                {lineUserId.slice(0, 12)}...
              </p>
            ) : (
              <div className="flex items-center gap-2 text-amber-600">
                <AlertCircle className="w-4 h-4" />
                <p className="text-sm">ไม่พบ LINE User ID</p>
              </div>
            )}
          </div>

          {/* Phone Number */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <div className="flex items-center gap-2">
                <Phone className="w-4 h-4 text-gray-500" />
                เบอร์โทรศัพท์ *
              </div>
            </label>
            <input
              type="tel"
              value={phoneNumber}
              onChange={(e) => {
                const formatted = formatPhoneNumber(e.target.value)
                setPhoneNumber(formatted)
                setErrorMessage('')
                setStatus('idle')
              }}
              placeholder="081-234-5678"
              maxLength={12}
              className="w-full px-4 py-3 border border-gray-200 rounded-xl text-lg text-center font-mono focus:outline-none focus:ring-2 focus:ring-[#06c755] focus:border-[#06c755] transition-colors"
              disabled={status === 'loading'}
            />
            <p className="text-xs text-gray-400 mt-2 text-center">
              ใช้เบอร์โทรเดียวกับที่ลงทะเบียนไว้ที่คลินิก
            </p>
          </div>

          {/* Name (Optional) */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <div className="flex items-center gap-2">
                <User className="w-4 h-4 text-gray-500" />
                ชื่อ (ไม่บังคับ)
              </div>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="ชื่อที่ต้องการให้แสดง"
              className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#06c755] focus:border-[#06c755] transition-colors"
              disabled={status === 'loading'}
            />
          </div>

          {/* Error Message */}
          {status === 'error' && (
            <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-xl text-red-700">
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
              <p className="text-sm">{errorMessage}</p>
            </div>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            disabled={status === 'loading' || !phoneNumber}
            className={`w-full py-3 rounded-xl font-bold text-white transition-all flex items-center justify-center gap-2 ${
              status === 'loading'
                ? 'bg-gray-400 cursor-not-allowed'
                : 'bg-[#06c755] hover:bg-[#05b34b] active:scale-95'
            }`}
          >
            {status === 'loading' ? (
              <>
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                กำลังเชื่อมต่อ...
              </>
            ) : (
              <>
                เชื่อมต่อบัญชี LINE
                <ArrowRight className="w-5 h-5" />
              </>
            )}
          </button>
        </form>

        {/* Footer */}
        <div className="px-6 pb-6">
          <div className="bg-gray-50 rounded-xl p-4">
            <p className="text-xs text-gray-500 text-center">
              การเชื่อมต่อบัญชี LINE ช่วยให้คุณได้รับการแจ้งเตือนสถานะคิวผ่าน LINE
              <br />
             เมื่อถึงคิวของคุณ ระบบจะแจ้งเตือนให้คุณทราบทันที
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function LineBindPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-green-50">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-green-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">กำลังโหลด...</p>
        </div>
      </div>
    }>
      <LineBindForm />
    </Suspense>
  )
}
