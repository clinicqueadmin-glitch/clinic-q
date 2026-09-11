'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  LayoutDashboard, Clock, CalendarCheck, DoorOpen, Stethoscope, BarChart3,
  MonitorPlay, Smartphone, QrCode, ShieldCheck, Building2, TrendingUp,
  Timer, ArrowRight, CheckCircle2, Sparkles, LineChart,
} from 'lucide-react'
import { clsx } from 'clsx'

/* ═══ Core capabilities — ClinicQ คือระบบจัดการคลินิก ไม่ใช่ AI ทั่วไป ═══ */
const coreFeatures = [
  {
    icon: Clock,
    title: 'จัดคิวผู้รับบริการ',
    desc: 'ลงทะเบียน Walk-in จองคิวออนไลน์ และนัดหมาย จัดลำดับคิวอัตโนมัติ พร้อมเวลารอโดยประมาณ',
    color: '#0d9488',
    bg: '#f0fdfa',
  },
  {
    icon: CalendarCheck,
    title: 'นัดหมาย & การมาถึง',
    desc: 'จัดการนัดหมาย ตรวจสอบการมาถึง ตรงเวลา/มาสาย ป้องกันการลงทะเบียนซ้ำ',
    color: '#2563EB',
    bg: '#EFF6FF',
  },
  {
    icon: DoorOpen,
    title: 'ห้องตรวจ',
    desc: 'ผูกห้องกับหัตถการและผู้ทำหัตถการ ดูสถานะห้องว่าง/กำลังให้บริการได้ทันที',
    color: '#A855F7',
    bg: '#FAF5FF',
  },
  {
    icon: Stethoscope,
    title: 'ผู้ทำหัตถการ & ทีมงาน',
    desc: 'กำหนดบทบาท Owner / Manager / Staff และจัดการสิทธิ์การเข้าถึงอย่างปลอดภัย',
    color: '#F97316',
    bg: '#FFF7ED',
  },
  {
    icon: BarChart3,
    title: 'วิเคราะห์การทำงาน',
    desc: 'สถิติผู้รับบริการ เวลารอ ผลงานผู้ทำหัตถการ การใช้ห้องตรวจ และการนัดหมาย',
    color: '#22C55E',
    bg: '#F0FDF4',
  },
  {
    icon: ShieldCheck,
    title: 'ข้อมูลปลอดภัยบน Cloud',
    desc: 'จัดเก็บเป็นระบบ แยกข้อมูลแต่ละคลินิก พร้อมสำรองข้อมูลอัตโนมัติ',
    color: '#E11D48',
    bg: '#FFF1F2',
  },
]

const extraFeatures = [
  { icon: MonitorPlay, title: 'จอ TV หน้าคลินิก', desc: 'แสดงคิวและสถานะห้องแบบเรียลไทม์ (ไม่แสดงชื่อผู้รับบริการ)' },
  { icon: QrCode, title: 'QR & ลิงก์เดียว', desc: 'ผู้รับบริการสแกนเข้าหน้าจองคิว ติดตามคิวได้จากมือถือ' },
  { icon: Smartphone, title: 'ติดตามคิวออนไลน์', desc: 'ดูคิวของตนเองและสถานะล่าสุดได้ทุกที่ทุกเวลา' },
  { icon: Building2, title: 'หลายสาขา / หลายห้อง', desc: 'รองรับหลายสาขา ห้องตรวจ และทีมงานในคลินิกเดียว' },
]

/* ═══ Clinic types — ตรงกับ config จริงในระบบ ═══ */
const clinicTypes = [
  { icon: '🦷', name: 'ทันตกรรม', color: '#A855F7' },
  { icon: '🏥', name: 'เวชกรรม', color: '#22C55E' },
  { icon: '✨', name: 'เสริมความงาม', color: '#EC4899' },
  { icon: '🌿', name: 'แพทย์แผนไทย', color: '#EAB308' },
  { icon: '🏮', name: 'แพทย์แผนจีน', color: '#F97316' },
  { icon: '🦴', name: 'กายภาพบำบัด', color: '#3B82F6' },
]

/* ═══ Mock data for the real system preview (Dashboard) ═══ */
const dashboardKpis = [
  { label: 'รวมวันนี้', value: 24, color: '#EC4899', bg: '#FDF2F8' },
  { label: 'รอเรียก', value: 8, color: '#F59E0B', bg: '#FFFBEB' },
  { label: 'กำลังทำ', value: 3, color: '#22C55E', bg: '#F0FDF4' },
  { label: 'เสร็จแล้ว', value: 13, color: '#2563EB', bg: '#EFF6FF' },
]

const dashboardRooms = [
  { room: 'ห้อง 1', doc: 'ทพ.สมบูรณ์', status: 'กำลังให้บริการ', queue: 'E021', color: '#22C55E' },
  { room: 'ห้อง 2', doc: 'ทพ.วิชัย', status: 'เลยเวลา', queue: 'E022', color: '#F59E0B' },
  { room: 'ห้อง 3', doc: 'ว่าง', status: 'ว่าง', queue: null, color: '#9CA3AF' },
]

/* ═══ Mock data for analytics preview ═══ */
const weeklyBars = [
  { day: 'จ', v: 45 }, { day: 'อ', v: 62 }, { day: 'พ', v: 58 },
  { day: 'พฤ', v: 74 }, { day: 'ศ', v: 88 }, { day: 'ส', v: 70 }, { day: 'อา', v: 30 },
]

const insights = [
  'ช่วง 17:00–18:00 มีเวลารอเฉลี่ยสูงที่สุด',
  'ห้อง 1 ถูกใช้งานสูงกว่าห้องอื่นในสัปดาห์นี้',
  'ผู้รับบริการมาสายเฉลี่ย 12 นาที',
  'เวลารอเฉลี่ยลดลงจากสัปดาห์ก่อน 8%',
]

const steps = [
  { step: 1, title: 'สมัครใช้งาน', desc: 'เลือกประเภทคลินิก กรอกข้อมูล ใช้เวลาไม่ถึง 2 นาที', icon: '📝', color: '#0d9488' },
  { step: 2, title: 'ตั้งค่าคลินิก', desc: 'เพิ่มสาขา ห้องตรวจ ผู้ทำหัตถการ และรายการหัตถการ', icon: '⚙️', color: '#A855F7' },
  { step: 3, title: 'เริ่มใช้งาน', desc: 'ลงทะเบียนผู้รับบริการ เรียกคิว ดูสถิติ ครบจบในที่เดียว', icon: '🚀', color: '#22C55E' },
]

const planFeatures = [
  'คิวไม่จำกัด',
  'สาขา ห้อง ผู้ใช้ ไม่จำกัด',
  'นัดหมาย & Walk-in & จองออนไลน์',
  'วิเคราะห์การทำงาน + กราฟ',
  'TV Display จอแสดงคิว',
  'QR Code & ลิงก์สำหรับผู้รับบริการ',
  'จัดการสิทธิ์ Owner / Manager / Staff',
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
        scrollY > 40 ? 'bg-white/90 backdrop-blur-lg shadow-md border-b border-teal-50' : 'bg-transparent'
      )}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-2">
              <img src="/brand-logo.png" alt="Clinic-Q" className="h-9 w-auto" />
              <span className="hidden sm:block text-lg font-extrabold text-gray-900">Clinic-Q</span>
            </div>
            <div className="flex items-center gap-2 sm:gap-3">
              <button
                onClick={() => router.push('/login')}
                className="candy-btn text-gray-600 hover:text-gray-900"
              >
                เข้าสู่ระบบ
              </button>
              <button
                onClick={() => router.push('/register')}
                className="candy-btn candy-btn-primary !px-5 !py-2"
              >
                สมัครใช้งานฟรี
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* ═══════ HERO ═══════ */}
      <section className="pt-28 pb-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center max-w-3xl mx-auto page-enter">
            <div className="candy-badge bg-white text-gray-600 shadow-sm border border-teal-100 mb-6 !px-4 !py-2 !text-sm">
              <Sparkles className="w-4 h-4 text-teal-500" />
              ทดลองใช้ฟรี 30 วัน · ไม่ต้องบัตรเครดิต
            </div>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-gray-900 leading-tight">
              ระบบจัดการ{' '}
              <span className="candy-gradient-text">คลินิก</span>
              <br />
              ครบจบในที่เดียว
            </h1>
            <p className="mt-6 text-lg text-gray-500 leading-relaxed max-w-2xl mx-auto">
              จัดคิว นัดหมาย ห้องตรวจ ผู้ทำหัตถการ และวิเคราะห์การทำงานของคลินิก
              <br className="hidden sm:block" />
              เหมาะสำหรับคลินิกทุกประเภท ตั้งแต่ทันตกรรมไปจนถึงกายภาพบำบัด
            </p>
            <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
              <button
                onClick={() => router.push('/register')}
                className="candy-btn candy-btn-primary w-full sm:w-auto !px-8 !py-4 !text-base justify-center"
              >
                เริ่มใช้งานฟรี <ArrowRight className="w-5 h-5" />
              </button>
              <button
                onClick={() => router.push('/login')}
                className="candy-btn w-full sm:w-auto !px-8 !py-4 !text-base justify-center bg-white text-gray-700 border border-gray-200 shadow-md hover:shadow-lg"
              >
                เข้าสู่ระบบ
              </button>
            </div>

            {/* Clinic types */}
            <div className="mt-12 flex flex-wrap items-center justify-center gap-3">
              {clinicTypes.map(ct => (
                <div key={ct.name} className="candy-badge bg-white text-gray-600 shadow-sm border border-gray-100 !px-4 !py-2 !text-sm">
                  <span className="text-lg">{ct.icon}</span>
                  {ct.name}
                </div>
              ))}
            </div>
          </div>

          {/* Hero visual — REAL system preview (Dashboard) */}
          <div className="mt-16 max-w-5xl mx-auto animate-float">
            <div className="candy-card p-4 sm:p-6">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 rounded-xl bg-teal-50 flex items-center justify-center">
                  <LayoutDashboard className="w-4 h-4 text-teal-600" />
                </div>
                <p className="text-sm font-bold text-gray-700">ภาพรวมคลินิกวันนี้</p>
                <span className="candy-badge bg-emerald-50 text-emerald-600 ml-auto">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> LIVE
                </span>
              </div>

              {/* KPI row */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
                {dashboardKpis.map((k, i) => (
                  <div key={i} className="rounded-2xl p-4 text-center" style={{ backgroundColor: k.bg }}>
                    <p className="text-3xl font-black" style={{ color: k.color }}>{k.value}</p>
                    <p className="text-xs font-bold text-gray-500 mt-1">{k.label}</p>
                  </div>
                ))}
              </div>

              {/* Room status */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {dashboardRooms.map((r, i) => (
                  <div key={i} className="bg-gray-50 rounded-2xl p-3 border border-gray-100">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-xs font-bold" style={{ backgroundColor: r.color }}>
                        {i + 1}
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-gray-900">{r.room}</p>
                        <p className="text-[10px] text-gray-500 truncate">{r.doc}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {r.queue && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold font-mono" style={{ backgroundColor: `${r.color}18`, color: r.color }}>
                          {r.queue}
                        </span>
                      )}
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-medium" style={{ backgroundColor: `${r.color}15`, color: r.color }}>
                        {r.status}
                      </span>
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
          <div className="text-center mb-14">
            <h2 className="text-3xl sm:text-4xl font-extrabold text-gray-900">
              จัดการคลินิก <span className="candy-gradient-text">ครบทุกด้าน</span>
            </h2>
            <p className="mt-4 text-lg text-gray-500 max-w-2xl mx-auto">
              ทุกฟังก์ชันที่คลินิกต้องใช้จริง ตั้งแต่วันแรกที่ผู้รับบริการเดินเข้า ไปจนถึงรายงานภาพรวม
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {coreFeatures.map((f, i) => {
              const Icon = f.icon
              return (
                <div key={i} className="candy-card p-6">
                  <div className="w-12 h-12 rounded-2xl flex items-center justify-center mb-4" style={{ backgroundColor: f.bg }}>
                    <Icon className="w-6 h-6" style={{ color: f.color }} />
                  </div>
                  <h3 className="text-lg font-bold text-gray-900 mb-2">{f.title}</h3>
                  <p className="text-sm text-gray-500 leading-relaxed">{f.desc}</p>
                </div>
              )
            })}
          </div>

          {/* Extra capabilities */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-6">
            {extraFeatures.map((f, i) => {
              const Icon = f.icon
              return (
                <div key={i} className="candy-card p-4 flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-teal-50 flex items-center justify-center flex-shrink-0">
                    <Icon className="w-5 h-5 text-teal-600" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-gray-900">{f.title}</h4>
                    <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">{f.desc}</p>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* ═══════ ANALYTICS ═══════ */}
      <section className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 items-center">
            <div>
              <div className="candy-badge bg-teal-50 text-teal-700 mb-4 !px-4 !py-2 !text-sm">
                <TrendingUp className="w-4 h-4" /> วิเคราะห์การทำงานของคลินิก
              </div>
              <h2 className="text-3xl sm:text-4xl font-extrabold text-gray-900 leading-tight">
                รู้ว่าคลินิกทำงาน<br />
                <span className="candy-gradient-text">เป็นอย่างไรทุกวัน</span>
              </h2>
              <p className="mt-4 text-gray-500 leading-relaxed">
                ไม่ใช่แค่จำนวนคิว แต่เห็นภาพรวมผู้รับบริการ เวลารอ ผลงานผู้ทำหัตถการ
                การใช้ห้องตรวจ และการนัดหมาย เพื่อวางแผนและเพิ่มประสิทธิภาพได้จริง
              </p>
              <div className="mt-6 space-y-3">
                {insights.map((t, i) => (
                  <div key={i} className="flex items-start gap-2 text-sm text-gray-600">
                    <LineChart className="w-4 h-4 text-teal-500 flex-shrink-0 mt-0.5" />
                    <span>{t}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Chart preview */}
            <div className="candy-card p-6">
              <div className="flex items-center justify-between mb-1">
                <p className="text-sm font-bold text-gray-700">ผู้รับบริการรายสัปดาห์</p>
                <span className="candy-badge bg-emerald-50 text-emerald-600">+12%</span>
              </div>
              <p className="text-xs text-gray-400 mb-5">จำนวนผู้รับบริการ (คน)</p>
              <div className="flex items-end justify-between gap-2 h-40">
                {weeklyBars.map((b, i) => (
                  <div key={i} className="flex-1 flex flex-col items-center gap-2">
                    <div
                      className="w-full rounded-t-lg bg-gradient-to-t from-teal-400 to-teal-500"
                      style={{ height: `${b.v}%` }}
                    />
                    <span className="text-[10px] font-medium text-gray-400">{b.day}</span>
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-3 gap-3 mt-6 pt-5 border-t border-gray-100">
                {[
                  { icon: Timer, label: 'เวลารอเฉลี่ย', value: '18 น.' },
                  { icon: Clock, label: 'เวลาให้บริการ', value: '32 น.' },
                  { icon: BarChart3, label: 'ใช้ห้อง', value: '76%' },
                ].map((s, i) => {
                  const Icon = s.icon
                  return (
                    <div key={i} className="text-center">
                      <Icon className="w-4 h-4 text-teal-500 mx-auto mb-1" />
                      <p className="text-base font-black text-gray-900">{s.value}</p>
                      <p className="text-[10px] text-gray-400">{s.label}</p>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ═══════ CLINIC TYPES ═══════ */}
      <section className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-extrabold text-gray-900">
              รองรับคลินิก <span className="candy-gradient-text">ทุกประเภท</span>
            </h2>
            <p className="mt-4 text-lg text-gray-500 max-w-2xl mx-auto">
              ตั้งค่าหัตถการ ห้องตรวจ และผู้ทำหัตถการได้ตามรูปแบบของคลินิกคุณ
            </p>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
            {clinicTypes.map((ct, i) => (
              <div key={i} className="candy-card p-5 text-center">
                <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl mx-auto mb-3" style={{ backgroundColor: `${ct.color}15` }}>
                  {ct.icon}
                </div>
                <p className="text-sm font-bold text-gray-900">{ct.name}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════ HOW IT WORKS ═══════ */}
      <section className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-14">
            <h2 className="text-3xl sm:text-4xl font-extrabold text-gray-900">
              เริ่มใช้งาน <span className="candy-gradient-text">ง่ายนิดเดียว</span>
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {steps.map((s, i) => (
              <div key={i} className="relative">
                {i < 2 && (
                  <div className="hidden md:block absolute top-14 left-full w-full h-0.5 bg-gradient-to-r from-teal-200 to-transparent z-0" />
                )}
                <div className="candy-card p-6 text-center relative">
                  <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-3xl mx-auto mb-4" style={{ backgroundColor: `${s.color}15` }}>
                    {s.icon}
                  </div>
                  <div className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-teal-500 text-white text-xs font-bold mb-3">{s.step}</div>
                  <h3 className="text-lg font-bold text-gray-900 mb-2">{s.title}</h3>
                  <p className="text-sm text-gray-500">{s.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════ PRICING ═══════ */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-gradient-to-br from-teal-50 via-white to-blue-50">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl sm:text-4xl font-extrabold text-gray-900 mb-4">
            แพ็กเกจเดียว ครบทุกฟีเจอร์
          </h2>
          <p className="text-lg text-gray-500 mb-8">
            ทดลองใช้ฟรี 30 วัน · ไม่ต้องบัตรเครดิต · ไม่มีสัญญาผูกมัด
          </p>

          {/* Yearly promotion */}
          <div className="max-w-2xl mx-auto mb-8">
            <div className="candy-card p-6 text-white" style={{ background: 'linear-gradient(135deg, #14b8a6, #0d9488)' }}>
              <p className="text-xl sm:text-2xl font-extrabold">🎉 สมัครรายปี</p>
              <p className="text-base sm:text-lg font-bold mt-2 leading-relaxed">
                ตั้งค่าแจ้งเตือนเมื่อถึงคิวนัดทาง <span className="text-yellow-200">LINE OA</span> ให้ฟรี
              </p>
              <p className="text-sm opacity-90 mt-2">พร้อมจัดทำ Rich Menu สำหรับระบบนัดคิว</p>
            </div>
          </div>

          <div className="max-w-lg mx-auto">
            <div className="candy-card p-8 border-2 !border-teal-400">
              <span className="candy-badge bg-teal-50 text-teal-700 !px-4 !py-1.5 !text-sm">⭐ แพ็กเกจเดียว ครบทุกฟีเจอร์</span>
              <h3 className="text-2xl font-extrabold text-gray-900 mt-4">Clinic-Q Professional</h3>
              <div className="mt-4">
                <span className="text-4xl font-extrabold text-teal-600">599</span>
                <span className="text-lg text-gray-400"> บาท/เดือน</span>
              </div>
              <p className="text-sm text-gray-500 mt-2">หรือ 5,999 บาท/ปี (Early Bird 3,999 บาท/ปี)</p>
              <div className="mt-6 space-y-2 text-left max-w-sm mx-auto">
                {planFeatures.map((f, i) => (
                  <div key={i} className="flex items-center gap-2 text-sm text-gray-600">
                    <CheckCircle2 className="w-4 h-4 text-teal-500 flex-shrink-0" /> {f}
                  </div>
                ))}
              </div>
              <button
                onClick={() => router.push('/pricing')}
                className="candy-btn candy-btn-primary w-full justify-center mt-6 !py-3"
              >
                ดูรายละเอียด <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* ═══════ CTA ═══════ */}
      <section className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl sm:text-4xl font-extrabold text-gray-900 mb-4">
            พร้อมที่จะจัดการคลินิกให้เป็นระบบขึ้น?
          </h2>
          <p className="text-lg text-gray-500 mb-8">
            เริ่มต้นใช้ Clinic-Q วันนี้ แล้วบริหารคลินิกได้ง่ายกว่าที่เคย
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <button
              onClick={() => router.push('/register')}
              className="candy-btn candy-btn-primary w-full sm:w-auto !px-8 !py-4 !text-base justify-center"
            >
              สมัครใช้งานฟรี <ArrowRight className="w-5 h-5" />
            </button>
            <button
              onClick={() => router.push('/login')}
              className="candy-btn w-full sm:w-auto !px-8 !py-4 !text-base justify-center bg-white text-gray-700 border border-gray-200 shadow-md hover:shadow-lg"
            >
              เข้าสู่ระบบ
            </button>
          </div>
        </div>
      </section>

      {/* ═══════ FOOTER ═══════ */}
      <footer className="py-8 px-4 sm:px-6 lg:px-8 border-t border-teal-100">
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
