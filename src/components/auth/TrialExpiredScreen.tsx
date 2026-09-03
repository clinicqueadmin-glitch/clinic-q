'use client'

import { useRouter } from 'next/navigation'
import { Clock, CreditCard, ArrowRight, AlertTriangle } from 'lucide-react'

interface TrialExpiredScreenProps {
  daysExpired: number
  clinicName?: string
}

export default function TrialExpiredScreen({ daysExpired, clinicName }: TrialExpiredScreenProps) {
  const router = useRouter()

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-red-50 via-white to-orange-50 p-4">
      <div className="max-w-md w-full">
        {/* Main Card */}
        <div className="bg-white rounded-3xl shadow-2xl overflow-hidden border border-red-100">
          {/* Header */}
          <div className="bg-gradient-to-r from-red-500 to-red-600 p-8 text-center">
            <div className="w-20 h-20 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <AlertTriangle className="w-10 h-10 text-white" />
            </div>
            <h1 className="text-2xl font-black text-white mb-2">ทดลองใช้สิ้นสุดแล้ว</h1>
            <p className="text-white/80 text-sm">
              {clinicName && <span className="font-medium">{clinicName} — </span>}
              หมดอายุไปแล้ว {daysExpired} วัน
            </p>
          </div>

          {/* Content */}
          <div className="p-6 text-center space-y-4">
            {/* Days Expired Badge */}
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-red-50 rounded-full border border-red-200">
              <Clock className="w-4 h-4 text-red-500" />
              <span className="text-sm font-bold text-red-700">หมดอายุ {daysExpired} วัน</span>
            </div>

            <p className="text-gray-600 text-sm leading-relaxed">
              บัญชีของคุณอยู่นอกช่วงทดลองใช้งาน 30 วันแล้ว กรุณาอัปเกรดเป็นแพ็กเกจชำระเงินเพื่อใช้งานต่อ
            </p>

            {/* Features Reminder */}
            <div className="bg-gray-50 rounded-xl p-4 text-left space-y-2">
              <p className="text-xs font-bold text-gray-700 mb-2">สิทธิ์ที่คุณจะได้รับ:</p>
              {[
                '✅ คิวไม่จำกัด สาขา ห้อง ผู้ใช้ไม่จำกัด',
                '✅ วิเคราะห์ข้อมูล + กราฟ',
                '✅ TV Display จอแสดงคิว',
                '✅ QR Code & Link สำหรับคนไข้',
                '✅ Push Notification',
              ].map((feature, i) => (
                <p key={i} className="text-xs text-gray-600">{feature}</p>
              ))}
            </div>
          </div>

          {/* Actions */}
          <div className="p-6 pt-0 space-y-3">
            <button
              onClick={() => router.push('/pricing')}
              className="w-full flex items-center justify-center gap-2 px-6 py-4 bg-gradient-to-r from-pink-500 to-purple-600 text-white rounded-2xl font-bold text-base shadow-lg hover:shadow-xl transition-all hover:scale-[1.02]"
            >
              <CreditCard className="w-5 h-5" />
              อัปเกรดเป็นแพ็กเกจชำระเงิน
              <ArrowRight className="w-4 h-4" />
            </button>
            
            <button
              onClick={() => router.push('/login')}
              className="w-full px-6 py-3 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-xl font-medium text-sm transition-colors"
            >
              เข้าสู่ระบบด้วยบัญชีอื่น
            </button>
          </div>
        </div>

        {/* Contact */}
        <p className="text-center text-xs text-gray-400 mt-4">
          ติดต่อ Admin • <a href="mailto:support@clinic-q.com" className="underline">support@clinic-q.com</a>
        </p>
      </div>
    </div>
  )
}
