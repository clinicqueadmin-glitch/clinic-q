'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import {
  CheckCircle, Sparkles, ArrowRight, Zap, Clock, Gift,
  ArrowLeft, Home, Shield, Headphones, RefreshCw, Smartphone,
  MonitorPlay, BarChart3, Users, QrCode, Bell, Database,
} from 'lucide-react'
import { clsx } from 'clsx'

export default function PricingPage() {
  const router = useRouter()
  const [billing, setBilling] = useState<'monthly' | 'yearly'>('yearly')
  const [trialDaysLeft, setTrialDaysLeft] = useState<number>(30)
  const [isEarlyBird, setIsEarlyBird] = useState(true)
  const [subscriptionEnd, setSubscriptionEnd] = useState('')

  useEffect(() => {
    const auth = localStorage.getItem('clinicQ_auth')
    if (auth) {
      try {
        const data = JSON.parse(auth)
        if (data.trialEndDate) {
          const end = new Date(data.trialEndDate)
          const now = new Date()
          const days = Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
          setTrialDaysLeft(Math.max(0, days))
          setIsEarlyBird(days > 0)
        }
        if (data.subscriptionEndDate) {
          const d = new Date(data.subscriptionEndDate)
          setSubscriptionEnd(d.toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric' }))
        }
      } catch {}
    }
  }, [])

  const features = [
    { icon: Users, label: 'ผู้ใช้ไม่จำกัด', desc: 'เจ้าของคลินิก, เจ้าหน้าที่, ผู้ทำหัตถการ' },
    { icon: MonitorPlay, label: 'จอ TV แสดงคิว', desc: 'แสดงสถานะห้องและคิวถัดไปแบบ Realtime' },
    { icon: BarChart3, label: 'วิเคราะห์ข้อมูลขั้นสูง', desc: 'กราฟสถิติ เปรียบเทียบประสิทธิภาพ' },
    { icon: Smartphone, label: 'ติดตามคิวผ่านมือถือ', desc: 'QR Code & Link สำหรับคนไข้' },
    { icon: Bell, label: 'Push Notification', desc: 'แจ้งเตือนเมื่อถึงคิว' },
    { icon: QrCode, label: 'QR Code & Link', desc: 'สำหรับสแกนลงทะเบียนและตรวจสอบคิว' },
    { icon: Database, label: 'ข้อมูลปลอดภัย', desc: 'เก็บบน Cloud สำรองอัตโนมัติ' },
    { icon: Headphones, label: 'ซัพพอร์ตผ่าน LINE OA', desc: 'ติดต่อ Admin ได้ตลอดเวลา' },
  ]

  return (
    <div className="min-h-screen bg-gradient-to-br from-teal-50 via-white to-blue-50">
      <div className="max-w-5xl mx-auto px-4 py-8">
        {/* ═══ TOP BAR ═══ */}
        <div className="flex items-center justify-between mb-8">
          <button
            onClick={() => router.back()}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-xl transition-all"
          >
            <ArrowLeft className="w-4 h-4" /> กลับ
          </button>
          <button
            onClick={() => router.push('/')}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-xl transition-all"
          >
            <Home className="w-4 h-4" /> หน้าหลัก
          </button>
        </div>

        {/* ═══ HEADER ═══ */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-teal-100 text-teal-700 rounded-full text-sm font-bold mb-4">
            <Sparkles className="w-4 h-4" /> ราคาและแพ็กเกจ
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-gray-900">
            แพ็กเกจเดียว ครบทุกฟีเจอร์
          </h1>
          <p className="text-gray-500 mt-3 text-lg">
            เริ่มทดลองใช้ฟรี 30 วัน · ไม่ต้องบัตรเครดิต · ไม่มีสัญญาผูกมัด
          </p>

          {/* Billing Toggle */}
          <div className="flex items-center justify-center gap-3 mt-6">
            <span className={clsx('text-sm font-bold', billing === 'monthly' ? 'text-gray-900' : 'text-gray-400')}>รายเดือน</span>
            <button
              onClick={() => setBilling(b => b === 'monthly' ? 'yearly' : 'monthly')}
              className={clsx('relative w-12 h-6 rounded-full transition-colors', billing === 'yearly' ? 'bg-teal-500' : 'bg-gray-300')}
            >
              <div className={clsx('absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform', billing === 'yearly' ? 'translate-x-6' : 'translate-x-0.5')} />
            </button>
            <span className={clsx('text-sm font-bold', billing === 'yearly' ? 'text-gray-900' : 'text-gray-400')}>
              รายปี <span className="text-green-600 text-xs">ประหยัดสุด!</span>
            </span>
          </div>
        </div>

        {/* ═══ EARLY BIRD BANNER ═══ */}
        {isEarlyBird && billing === 'yearly' && (
          <div className="mb-8 p-4 bg-gradient-to-r from-amber-50 to-orange-50 border-2 border-amber-300 rounded-2xl text-center animate-bounce-in">
            <div className="flex items-center justify-center gap-2 mb-2">
              <Gift className="w-5 h-5 text-amber-600" />
              <span className="font-extrabold text-amber-700">🎉 Early Bird Special!</span>
            </div>
            <p className="text-sm text-amber-700">
              สมัครก่อนหมดอายุทดลอง — ราคาพิเศษ <span className="font-extrabold text-lg">3,999 บาท/ปี</span>
            </p>
            <p className="text-xs text-amber-600 mt-1">ประหยัดกว่าปกติ 2,000 บาท! เหลืออีก {trialDaysLeft} วัน</p>
          </div>
        )}

        {/* ═══ SINGLE PLAN CARD ═══ */}
        <div className="max-w-xl mx-auto">
          <div className="relative bg-white rounded-3xl border-2 border-teal-400 shadow-xl overflow-hidden">
            {/* Top badge */}
            <div className="bg-gradient-to-r from-teal-500 to-teal-600 text-white text-center py-3">
              <span className="text-sm font-bold">⭐ แพ็กเกจเดียว ครบทุกฟีเจอร์</span>
            </div>

            <div className="p-8">
              {/* Plan name */}
              <div className="text-center mb-6">
                <span className="text-5xl">🦷</span>
                <h3 className="text-2xl font-extrabold text-gray-900 mt-3">Clinic-Q Professional</h3>
                <p className="text-gray-500 mt-2">ระบบจัดการคิวคลินิกครบวงจร สำหรับทุกประเภทคลินิก</p>
              </div>

              {/* Price */}
              <div className="text-center mb-8 py-6 bg-gradient-to-r from-teal-50 to-blue-50 rounded-2xl">
                {billing === 'monthly' ? (
                  <div>
                    <div className="flex items-baseline justify-center gap-1">
                      <span className="text-5xl font-extrabold text-teal-600">599</span>
                      <span className="text-lg text-gray-400">บาท/เดือน</span>
                    </div>
                    <p className="text-sm text-gray-500 mt-2">จ่ายรายเดือน ไม่มีสัญญาผูกมัด</p>
                  </div>
                ) : (
                  <div>
                    {isEarlyBird ? (
                      <>
                        <div className="flex items-baseline justify-center gap-1">
                          <span className="text-5xl font-extrabold text-amber-600">3,999</span>
                          <span className="text-lg text-gray-400">บาท/ปี</span>
                        </div>
                        <div className="mt-2">
                          <span className="text-lg text-gray-400 line-through">5,999</span>
                          <span className="ml-2 px-2 py-0.5 bg-amber-100 text-amber-700 text-xs font-bold rounded-full">
                            ประหยัด 2,000 บาท
                          </span>
                        </div>
                        <p className="text-sm text-amber-600 mt-2 font-medium">🎉 ราคา Early Bird — ก่อนหมดอายุทดลอง</p>
                      </>
                    ) : (
                      <>
                        <div className="flex items-baseline justify-center gap-1">
                          <span className="text-5xl font-extrabold text-teal-600">5,999</span>
                          <span className="text-lg text-gray-400">บาท/ปี</span>
                        </div>
                        <p className="text-sm text-gray-500 mt-2">เฉลี่ยเพียง 500 บาท/เดือน</p>
                      </>
                    )}
                  </div>
                )}
              </div>

              {/* Features grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-8">
                {features.map((f, i) => {
                  const Icon = f.icon
                  return (
                    <div key={i} className="flex items-start gap-3 p-3 rounded-xl bg-gray-50">
                      <div className="w-8 h-8 rounded-lg bg-teal-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <Icon className="w-4 h-4 text-teal-600" />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-gray-900">{f.label}</p>
                        <p className="text-xs text-gray-500">{f.desc}</p>
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* CTA */}
              <button
                onClick={() => router.push('/register')}
                className="w-full py-4 rounded-2xl font-bold text-white bg-gradient-to-r from-teal-500 to-teal-600 hover:from-teal-600 hover:to-teal-700 transition-all shadow-lg hover:shadow-xl flex items-center justify-center gap-2 text-lg"
              >
                เริ่มทดลองใช้ฟรี 30 วัน <ArrowRight className="w-5 h-5" />
              </button>

              <p className="text-center text-xs text-gray-400 mt-4">
                ทดลองฟรี 30 วัน · ไม่ต้องบัตรเครดิต · ยกเลิกเมื่อไหร่ก็ได้
              </p>
              <p className="text-center text-xs mt-3">
                ติดต่อ Admin · <a href="https://lin.ee/OqlmFFG" target="_blank" rel="noopener noreferrer" className="text-green-500 font-bold hover:underline">💬 LINE OA</a>
              </p>
            </div>
          </div>
        </div>

        {/* ═══ VALUE PROPS ═══ */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-12 max-w-3xl mx-auto">
          <div className="text-center p-5 bg-white rounded-2xl border border-gray-100">
            <div className="w-12 h-12 bg-teal-100 rounded-xl flex items-center justify-center mx-auto mb-3">
              <Zap className="w-6 h-6 text-teal-600" />
            </div>
            <h4 className="font-bold text-gray-900">ติดตั้งง่าย</h4>
            <p className="text-sm text-gray-500 mt-1">พร้อมใช้งานใน 5 นาที ไม่ต้องติดตั้งโปรแกรม</p>
          </div>
          <div className="text-center p-5 bg-white rounded-2xl border border-gray-100">
            <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center mx-auto mb-3">
              <Clock className="w-6 h-6 text-green-600" />
            </div>
            <h4 className="font-bold text-gray-900">ไม่มีสัญญา</h4>
            <p className="text-sm text-gray-500 mt-1">จ่ายรายเดือน ยกเลิกเมื่อไหร่ก็ได้ ไม่มีค่าปรับ</p>
          </div>
          <div className="text-center p-5 bg-white rounded-2xl border border-gray-100">
            <div className="w-12 h-12 bg-amber-100 rounded-xl flex items-center justify-center mx-auto mb-3">
              <RefreshCw className="w-6 h-6 text-amber-600" />
            </div>
            <h4 className="font-bold text-gray-900">อัปเดตตลอด</h4>
            <p className="text-sm text-gray-500 mt-1">ฟีเจอร์ใหม่ทุกเดือน ไม่มีค่าใช้จ่ายเพิ่ม</p>
          </div>
        </div>

        {/* ═══ COMPARISON TABLE ═══ */}
        <div className="mt-16 max-w-2xl mx-auto">
          <h2 className="text-xl font-bold text-gray-900 text-center mb-6">เปรียบเทียบ รายเดือน vs รายปี</h2>
          <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left p-4 text-sm font-bold text-gray-600"></th>
                  <th className="text-center p-4 text-sm font-bold text-gray-900">รายเดือน</th>
                  <th className="text-center p-4 text-sm font-bold text-teal-600">รายปี</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-gray-50">
                  <td className="p-4 text-sm text-gray-600">ราคา</td>
                  <td className="p-4 text-center text-sm font-bold text-gray-900">599 บาท/เดือน</td>
                  <td className="p-4 text-center text-sm font-bold text-teal-600">5,999 บาท/ปี</td>
                </tr>
                <tr className="border-b border-gray-50">
                  <td className="p-4 text-sm text-gray-600">เฉลี่ยต่อเดือน</td>
                  <td className="p-4 text-center text-sm text-gray-900">599 บาท</td>
                  <td className="p-4 text-center text-sm font-bold text-teal-600">500 บาท</td>
                </tr>
                {isEarlyBird && (
                  <tr className="border-b border-gray-50 bg-amber-50">
                    <td className="p-4 text-sm text-amber-700 font-bold">Early Bird</td>
                    <td className="p-4 text-center text-sm text-gray-400">—</td>
                    <td className="p-4 text-center text-sm font-bold text-amber-600">3,999 บาท/ปี</td>
                  </tr>
                )}
                <tr className="border-b border-gray-50">
                  <td className="p-4 text-sm text-gray-600">ประหยัด</td>
                  <td className="p-4 text-center text-sm text-gray-400">—</td>
                  <td className="p-4 text-center text-sm font-bold text-green-600">
                    {isEarlyBird ? 'ประหยัด 38%' : 'ประหยัด 17%'}
                  </td>
                </tr>
                <tr>
                  <td className="p-4 text-sm text-gray-600">ฟีเจอร์</td>
                  <td className="p-4 text-center text-sm text-gray-600">ครบทุกฟีเจอร์</td>
                  <td className="p-4 text-center text-sm font-bold text-teal-600">ครบทุกฟีเจอร์</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* ═══ FAQ ═══ */}
        <div className="mt-16 text-center">
          <h2 className="text-xl font-bold text-gray-900 mb-6">คำถามที่พบบ่อย</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-3xl mx-auto text-left">
            <FAQ q="ทดลองใช้ฟรีกี่วัน?" a="30 วัน ไม่ต้องใช้บัตรเครดิต ใช้ได้ทุกฟีเจอร์ครบทุกอย่าง" />
            <FAQ q="จ่ายรายเดือนหรือรายปีดี?" a="รายปีคุ้มกว่า! จ่าย 5,999/ปี (เฉลี่ย 500/เดือน) หรือ Early Bird 3,999/ปี" />
            <FAQ q="Early Bird คืออะไร?" a="สมัครก่อนหมดอายุทดลอง 30 วัน ลดเหลือ 3,999/ปี (ประหยัด 2,000 บาท)" />
            <FAQ q="ชำระเงินช่องทางไหนได้บ้าง?" a="โอนผ่านธนาคาร, PromptPay รองรับบัตรเครดิตเร็วๆ นี้" />
            <FAQ q="ข้อมูลจะหายหลังหมดอายุไหม?" a="ไม่หาย ข้อมูลเก็บไว้ 90 วันหลังหมดอายุ สามารถต่ออายุได้ทันที" />
            <FAQ q="มีข้อจำกัดอะไรบ้าง?" a="ไม่มี! คิวไม่จำกัด สาขาไม่จำกัด ห้องไม่จำกัด ผู้ใช้ไม่จำกัด" />
            <FAQ q="ใช้กี่สาขาได้บ้าง?" a="ไม่จำกัดสาขา ไม่จำกัดห้อง ไม่จำกัดผู้ใช้ ใช้ได้ทุกที่ทุกเวลา" />
            <FAQ q="เปลี่ยนจากเดือนเป็นปีได้ไหม?" a="ได้! จ่ายส่วนต่างเมื่อไหร่ก็ได้ เริ่มคำนวณจากวันที่เปลี่ยน" />
          </div>
        </div>

        {/* ═══ CTA ═══ */}
        <div className="mt-16 text-center">
          <div className="bg-gradient-to-r from-teal-500 to-teal-600 rounded-3xl p-8 text-white">
            <h2 className="text-2xl font-extrabold mb-2">พร้อมที่จะเริ่มต้น?</h2>
            <p className="text-teal-100 mb-6">สมัครวันนี้ ทดลองใช้ฟรี 30 วัน ไม่ต้องบัตรเครดิต</p>
            <button
              onClick={() => router.push('/register')}
              className="px-8 py-4 rounded-2xl bg-white text-teal-600 font-bold text-lg hover:shadow-xl transition-all shadow-lg inline-flex items-center gap-2"
            >
              🚀 เริ่มทดลองใช้ฟรี <ArrowRight className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* ═══ FOOTER ═══ */}
        <div className="mt-12 text-center">
          <p className="text-xs text-gray-400">
            © 2026 Clinic-Q Platform · <a href="https://lin.ee/OqlmFFG" target="_blank" rel="noopener noreferrer" className="text-green-500 font-bold hover:underline">💬 ติดต่อ Admin</a>
          </p>
        </div>
      </div>
    </div>
  )
}

function FAQ({ q, a }: { q: string; a: string }) {
  return (
    <div className="bg-white rounded-2xl p-4 border border-gray-100">
      <p className="font-bold text-gray-900 text-sm">{q}</p>
      <p className="text-sm text-gray-500 mt-1">{a}</p>
    </div>
  )
}
