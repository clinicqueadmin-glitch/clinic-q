'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  Stethoscope, Clock, BarChart3, Users, Smartphone, MonitorPlay,
  ArrowRight, CheckCircle, Sparkles, Shield, Zap, Heart,
  ChevronRight,  Globe,
} from 'lucide-react'
import { clsx } from 'clsx'

const features = [
  {
    icon: Clock,
    title: 'จัดคิวอัตโนมัติ',
    desc: 'ระบบจัดคิวอัจฉริยะ คำนวณเวลารอโดยประมาณ แจ้งเตือนเมื่อถึงคิว',
    color: '#F472B6',
    bg: 'bg-pink-50',
  },
  {
    icon: MonitorPlay,
    title: 'จอ TV หน้าคลินิก',
    desc: 'แสดงสถานะห้องและคิวถัดไปแบบ Realtime พร้อมโฆษณา',
    color: '#60A5FA',
    bg: 'bg-blue-50',
  },
  {
    icon: BarChart3,
    title: 'วิเคราะห์ข้อมูล',
    desc: 'กราฟสถิติประสิทธิภาพผู้ทำหัตถการ เปรียบเทียบกับมาตรฐาน',
    color: '#34D399',
    bg: 'bg-green-50',
  },
  {
    icon: Smartphone,
    title: 'ติดตามคิวผ่านมือถือ',
    desc: 'คนไข้ดูคิวของตนเองผ่าน QR Code หรือ LINE OA สะดวกทุกที่',
    color: '#A78BFA',
    bg: 'bg-purple-50',
  },
  {
    icon: Users,
    title: 'จัดการผู้ใช้งาน',
    desc: 'กำหนดสิทธิ์เจ้าของคลินิก ผู้จัดการ เจ้าหน้าที่ และผู้ทำหัตถการ',
    color: '#FB923C',
    bg: 'bg-orange-50',
  },
  {
    icon: Shield,
    title: 'ปลอดภัย เชื่อถือได้',
    desc: 'ข้อมูลถูกเก็บอย่างปลอดภัยบน Cloud สำรองข้อมูลอัตโนมัติ',
    color: '#F87171',
    bg: 'bg-red-50',
  },
]

const clinicTypes = [
  { icon: '🦷', name: 'ทันตกรรม' },
  { icon: '💊', name: 'เวชกรรม' },
  { icon: '✨', name: 'เสริมความงาม' },
  { icon: '🌿', name: 'แพทย์แผนไทย' },
  { icon: '🧠', name: 'แพทย์แผนจีน' },
  { icon: '🦴', name: 'กายภาพบำบัด' },
]

export default function LandingPage() {
  const router = useRouter()
  const [scrollY, setScrollY] = useState(0)

  useEffect(() => {
    const handleScroll = () => setScrollY(window.scrollY)
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  return (
    <div className="min-h-screen relative z-[2]">
      {/* ═══════ NAVBAR ═══════ */}
      <nav className={clsx(
        'fixed top-0 left-0 right-0 z-50 transition-all duration-300',
        scrollY > 50 ? 'bg-white/90 backdrop-blur-lg shadow-md border-b border-gray-100' : 'bg-transparent'
      )}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-2">
              <img src="/brand-logo.png" alt="Clinic-Q" className="h-9 w-auto" />
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => router.push('/login')}
                className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors"
              >
                เข้าสู่ระบบ
              </button>
              <button
                onClick={() => router.push('/register')}
                className="px-5 py-2 rounded-xl bg-gradient-to-r from-teal-500 to-teal-600 text-white text-sm font-bold hover:shadow-lg transition-all shadow-md"
              >
                สมัครใช้งานฟรี
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* ═══════ HERO ═══════ */}
      <section className="pt-24 pb-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center max-w-3xl mx-auto">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-white rounded-full shadow-sm border border-gray-100 mb-6">
              <Sparkles className="w-4 h-4 text-teal-500" />
              <span className="text-sm font-medium text-gray-600">ทดลองใช้ฟรี 30 วัน · ไม่ต้องบัตรเครดิต</span>
            </div>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-gray-900 leading-tight">
              ระบบจัดการคิว{' '}
              <span className="bg-gradient-to-r from-teal-500 to-teal-600 bg-clip-text text-transparent">คลินิก</span>
              <br />
              ที่ทำให้ชีวิตง่ายขึ้น
            </h1>
            <p className="mt-6 text-lg text-gray-500 leading-relaxed max-w-2xl mx-auto">
              จัดคิวอัตโนมัติ · จอ TV แสดงสถานะ · ติดตามคิวผ่านมือถือ · วิเคราะห์ข้อมูลแบบ Realtime
              <br />
              เหมาะสำหรับทุกประเภทคลินิก ตั้งแต่ทันตกรรมไปจนถึงกายภาพบำบัด
            </p>
            <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
              <button
                onClick={() => router.push('/register')}
                className="w-full sm:w-auto px-8 py-4 rounded-2xl bg-gradient-to-r from-teal-500 to-teal-600 text-white font-bold text-lg hover:shadow-xl transition-all shadow-lg flex items-center justify-center gap-2"
              >
                เริ่มใช้งานฟรี <ArrowRight className="w-5 h-5" />
              </button>
              <button
                onClick={() => router.push('/login')}
                className="w-full sm:w-auto px-8 py-4 rounded-2xl bg-white text-gray-700 font-bold text-lg hover:shadow-lg transition-all shadow-md border border-gray-200 flex items-center justify-center gap-2"
              >
                เข้าสู่ระบบ
              </button>
            </div>

            {/* Clinic types */}
            <div className="mt-12 flex flex-wrap items-center justify-center gap-3">
              {clinicTypes.map(ct => (
                <div key={ct.name} className="flex items-center gap-2 px-4 py-2 bg-white rounded-xl shadow-sm border border-gray-100">
                  <span className="text-xl">{ct.icon}</span>
                  <span className="text-sm font-medium text-gray-600">{ct.name}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Hero visual - Dashboard preview */}
          <div className="mt-16 max-w-5xl mx-auto">
            <div className="bg-white rounded-3xl shadow-2xl border border-gray-100 overflow-hidden p-6">
              <div className="grid grid-cols-4 gap-4 mb-4">
                <div className="bg-pink-50 rounded-2xl p-4 text-center">
                  <p className="text-3xl font-black text-pink-500">24</p>
                  <p className="text-xs font-bold text-pink-400 mt-1">รวมวันนี้</p>
                </div>
                <div className="bg-amber-50 rounded-2xl p-4 text-center">
                  <p className="text-3xl font-black text-amber-500">8</p>
                  <p className="text-xs font-bold text-amber-400 mt-1">รอเรียก</p>
                </div>
                <div className="bg-emerald-50 rounded-2xl p-4 text-center">
                  <p className="text-3xl font-black text-emerald-500">3</p>
                  <p className="text-xs font-bold text-emerald-400 mt-1">กำลังทำ</p>
                </div>
                <div className="bg-blue-50 rounded-2xl p-4 text-center">
                  <p className="text-3xl font-black text-blue-500">13</p>
                  <p className="text-xs font-bold text-blue-400 mt-1">เสร็จแล้ว</p>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                {[
                  { room: 1, doc: 'ทพ.สมบูรณ์', status: 'กำลังให้บริการ', patient: 'สมชาย', color: '#34D399' },
                  { room: 2, doc: 'ทพ.วิชัย', status: 'เลยเวลา', patient: 'สมหญิง', color: '#F59E0B' },
                  { room: 3, doc: 'ทพ.สมพงษ์', status: 'ว่าง', patient: null, color: '#9CA3AF' },
                ].map(r => (
                  <div key={r.room} className="bg-gray-50 rounded-xl p-3 border border-gray-100">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-sm font-bold" style={{ backgroundColor: r.color }}>{r.room}</div>
                      <div>
                        <p className="text-xs font-bold text-gray-900">ห้อง {r.room}</p>
                        <p className="text-[10px] text-gray-500">{r.doc}</p>
                      </div>
                    </div>
                    <div className="px-2 py-1 rounded-full text-[10px] font-medium" style={{ backgroundColor: `${r.color}15`, color: r.color }}>
                      {r.patient ? `🔄 ${r.patient}` : 'ว่าง'}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ═══════ FEATURES ═══════ */}
      <section className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-extrabold text-gray-900">
              ฟีเจอร์ที่ทำให้ Clinic-Q <span className="text-pink-500">แตกต่าง</span>
            </h2>
            <p className="mt-4 text-lg text-gray-500 max-w-2xl mx-auto">
              ครบทุกฟีเจอร์ที่คลินิกต้องการ ตั้งแต่จัดคิวไปจนถึงวิเคราะห์ข้อมูล
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((f, i) => {
              const Icon = f.icon
              return (
                <div key={i} className="group bg-white rounded-2xl p-6 border border-gray-100 hover:shadow-xl hover:-translate-y-1 transition-all duration-300">
                  <div className={clsx('w-12 h-12 rounded-xl flex items-center justify-center mb-4', f.bg)}>
                    <Icon className="w-6 h-6" style={{ color: f.color }} />
                  </div>
                  <h3 className="text-lg font-bold text-gray-900 mb-2">{f.title}</h3>
                  <p className="text-sm text-gray-500 leading-relaxed">{f.desc}</p>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* ═══════ HOW IT WORKS ═══════ */}
      <section className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-extrabold text-gray-900">
              เริ่มใช้งาน <span className="text-purple-500">ง่ายนิดเดียว</span>
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              { step: 1, title: 'สมัครใช้งาน', desc: 'เลือกประเภทคลินิก กรอกข้อมูล ใช้เวลาไม่ถึง 2 นาที', icon: '📝', color: '#F472B6' },
              { step: 2, title: 'ตั้งค่าคลินิก', desc: 'เพิ่มสาขา ห้องตรวจ ผู้ทำหัตถการ และรายการหัตถการ', icon: '⚙️', color: '#A78BFA' },
              { step: 3, title: 'เริ่มใช้งาน', desc: 'ลงทะเบียนคนไข้ เรียกคิว ดูสถิติ ครบจบในที่เดียว', icon: '🚀', color: '#34D399' },
            ].map((s, i) => (
              <div key={i} className="relative">
                {i < 2 && (
                  <div className="hidden md:block absolute top-12 left-full w-full h-0.5 bg-gradient-to-r from-gray-200 to-transparent z-0" />
                )}
                <div className="relative bg-white rounded-2xl p-6 border border-gray-100 shadow-sm text-center">
                  <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-3xl mx-auto mb-4" style={{ backgroundColor: `${s.color}15` }}>
                    {s.icon}
                  </div>
                  <div className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-gray-900 text-white text-xs font-bold mb-3">{s.step}</div>
                  <h3 className="text-lg font-bold text-gray-900 mb-2">{s.title}</h3>
                  <p className="text-sm text-gray-500">{s.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════ PRICING TEASER ═══════ */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-gradient-to-br from-teal-50 via-white to-blue-50">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl sm:text-4xl font-extrabold text-gray-900 mb-4">
            แพ็กเกจเดียว ครบทุกฟีเจอร์
          </h2>
          <p className="text-lg text-gray-500 mb-8">
            ทดลองใช้ฟรี 30 วัน · ไม่ต้องบัตรเครดิต · ไม่มีสัญญาผูกมัด
          </p>

          {/* Yearly Promotion Banner */}
          <div className="max-w-2xl mx-auto mb-8">
            <div className="bg-gradient-to-r from-purple-600 via-pink-500 to-teal-400 rounded-3xl p-6 text-center text-white shadow-xl">
              <p className="text-2xl md:text-3xl font-extrabold leading-relaxed">
                🎉 สมัครรายปี
              </p>
              <p className="text-xl md:text-2xl font-bold mt-2 leading-relaxed">
                เราจะตั้งค่าแจ้งเตือนเมื่อถึงคิวนัดทาง <span className="text-yellow-200">LineOA</span>
              </p>
              <p className="text-lg md:text-xl font-bold mt-2 leading-relaxed">
                พร้อมทำหน้า <span className="text-yellow-200">Rich Menu</span> สำหรับระบบนัดคิวให้ <span className="text-yellow-200 text-2xl">ฟรี!</span>
              </p>
            </div>
          </div>

          <div className="max-w-lg mx-auto">
            <div className="bg-white rounded-3xl border-2 border-teal-400 shadow-xl p-8">
              <span className="inline-block px-4 py-1.5 bg-teal-100 text-teal-700 text-sm font-bold rounded-full mb-4">⭐ แพ็กเกจเดียว ครบทุกฟีเจอร์</span>
              <h3 className="text-2xl font-extrabold text-gray-900">Clinic-Q Professional</h3>
              <div className="mt-4">
                <span className="text-4xl font-extrabold text-teal-600">599</span>
                <span className="text-lg text-gray-400"> บาท/เดือน</span>
              </div>
              <p className="text-sm text-gray-500 mt-2">หรือ 5,999 บาท/ปี (Early Bird 3,999 บาท/ปี)</p>
              <div className="mt-6 space-y-2 text-left max-w-sm mx-auto">
                {['คิวไม่จำกัด', 'สาขา ห้อง ผู้ใช้ ไม่จำกัด', 'วิเคราะห์ข้อมูล + กราฟ', 'TV Display จอแสดงคิว', 'QR Code & Link สำหรับคนไข้', 'Push Notification'].map((f, i) => (
                  <div key={i} className="flex items-center gap-2 text-sm text-gray-600">
                    <CheckCircle className="w-4 h-4 text-teal-500 flex-shrink-0" /> {f}
                  </div>
                ))}
              </div>
              <button
                onClick={() => router.push('/pricing')}
                className="mt-6 px-8 py-3 rounded-2xl bg-gradient-to-r from-teal-500 to-teal-600 text-white font-bold hover:shadow-lg transition-all shadow-md"
              >
                ดูรายละเอียด <ArrowRight className="w-4 h-4 inline" />
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* ═══════ CTA ═══════ */}
      <section className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl sm:text-4xl font-extrabold text-gray-900 mb-4">
            พร้อมที่จะเปลี่ยนแปลงคลินิกของคุณ?
          </h2>
          <p className="text-lg text-gray-500 mb-8">
            เริ่มต้นใช้ Clinic-Q วันนี้ แล้วคุณจะไม่กลับไปใช้ระบบเดิมอีกเลย
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <button
              onClick={() => router.push('/register')}
              className="w-full sm:w-auto px-8 py-4 rounded-2xl bg-gradient-to-r from-pink-500 to-purple-500 text-white font-bold text-lg hover:shadow-xl transition-all shadow-lg flex items-center justify-center gap-2"
            >
              สมัครใช้งานฟรี <ArrowRight className="w-5 h-5" />
            </button>
            <button
              onClick={() => router.push('/login')}
              className="w-full sm:w-auto px-8 py-4 rounded-2xl bg-white text-gray-700 font-bold text-lg hover:shadow-lg transition-all shadow-md border border-gray-200 flex items-center justify-center gap-2"
            >
              เข้าสู่ระบบ
            </button>
          </div>
        </div>
      </section>

      {/* ═══════ FOOTER ═══════ */}
      <footer className="py-8 px-4 sm:px-6 lg:px-8 border-t border-gray-100">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <img src="/brand-logo.png" alt="Clinic-Q" className="h-8 w-auto" />
            <span className="text-xs text-gray-400">v1.0</span>
          </div>
          <p className="text-xs text-gray-400">© 2026 Clinic-Q Platform. All rights reserved.</p>
          <div className="flex items-center gap-4">
            <a href="https://lin.ee/OqlmFFG" target="_blank" rel="noopener noreferrer" className="text-xs text-green-500 font-bold hover:underline">💬 ติดต่อ Admin</a>
            <Link href="/terms" className="text-xs text-gray-400 hover:text-gray-600">เงื่อนไข</Link>
            <Link href="/privacy" className="text-xs text-gray-400 hover:text-gray-600">นโยบายความเป็นส่วนตัว</Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
