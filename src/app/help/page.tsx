'use client'

import { useState } from 'react'
import Link from 'next/link'
import {
  ChevronDown, ChevronRight, ArrowLeft, Home,
  Users, DoorOpen, BarChart3, Settings, QrCode,
  CalendarCheck, MonitorPlay, Stethoscope, Bell,
  Search, Phone, Mail, ExternalLink,
} from 'lucide-react'

const ACCENT = '#0d9488'
const INK = '#0f172a'

interface FAQItem {
  q: string
  a: string
}

interface GuideSection {
  icon: React.ReactNode
  title: string
  desc: string
  items: string[]
}

const guideSections: GuideSection[] = [
  {
    icon: <CalendarCheck className="w-5 h-5" />,
    title: 'เริ่มต้นใช้งาน',
    desc: 'ขั้นตอนแรกสำหรับเจ้าของคลินิก',
    items: [
      'สมัครใช้งานที่ clinic-q.app/register',
      'เลือกประเภทคลินิกและกรอกข้อมูล',
      'ยืนยันอีเมลและเข้าสู่ระบบ',
      'ตั้งค่าสาขา ห้องตรวจ และผู้ให้บริการ',
      'เพิ่มรายการหัตถการที่ให้บริการ',
    ],
  },
  {
    icon: <Users className="w-5 h-5" />,
    title: 'จัดการผู้ใช้',
    desc: 'เพิ่มและจัดการทีมงาน',
    items: [
      'เข้าหน้า จัดการคลินิก > จัดการผู้ใช้',
      'เพิ่มเจ้าหน้าที่ด้วยอีเมลและบทบาท',
      'กำหนดสิทธิ์: เจ้าของ, ผู้จัดการ, เจ้าหน้าที่, ผู้ทำหัตถการ',
      'เจ้าหน้าที่เข้าใช้งานด้วยอีเมลของตัวเอง',
    ],
  },
  {
    icon: <DoorOpen className="w-5 h-5" />,
    title: 'จัดการห้องตรวจ',
    desc: 'ตั้งค่าห้องตรวจและผู้ให้บริการ',
    items: [
      'เข้าหน้า จัดการคลินิก > ห้องตรวจ',
      'คลิก "+ เพิ่มห้องตรวจ"',
      'กรอกชื่อห้อง เลือกหัตถการ และผู้ให้บริการ',
      'กำหนดเวลาเปิดทำการ',
      'เปิด/ปิดห้องตามต้องการ',
    ],
  },
  {
    icon: <QrCode className="w-5 h-5" />,
    title: 'ลงคิว Walk-in',
    desc: 'ลงทะเบียนผู้รับบริการหน้าเคาน์เตอร์',
    items: [
      'เข้าหน้า Dashboard แล้วคลิก "ลงทะเบียนใหม่"',
      'หรือเปิดหน้า /walkin ด้วย QR Code',
      'กรอกชื่อ-นามสกุล และเบอร์โทรศัพท์',
      'เลือกสาขาและหัตถการ',
      'ระบบจะออกหมายเลขคิวให้อัตโนมัติ',
    ],
  },
  {
    icon: <MonitorPlay className="w-5 h-5" />,
    title: 'จอ TV แสดงคิว',
    desc: 'ตั้งจอแสดงสถานะคิวหน้าคลินิก',
    items: [
      'เปิดหน้า /tv บนจอ TV หรือจอใหญ่',
      'แสดงหมายเลขคิวปัจจุบันและคิวรอ',
      'แสดงสถานะห้องตรวจแบบ Realtime',
      'ไม่ต้อง login — เปิดได้เลย',
    ],
  },
  {
    icon: <Stethoscope className="w-5 h-5" />,
    title: 'เรียกคิวและให้บริการ',
    desc: 'ขั้นตอนการเรียกคิว',
    items: [
      'คลิก "เรียกคิวถัดไป" บน Dashboard',
      'ระบบจะมอบหมายห้องตรวจอัตโนมัติ',
      'บันทึกสถานะ: กำลังให้บริการ > เสร็จแล้ว',
      'ระบบจะบันทึกเวลาให้บริการโดยอัตโนมัติ',
    ],
  },
  {
    icon: <BarChart3 className="w-5 h-5" />,
    title: 'ดูรายงานและวิเคราะห์',
    desc: 'ดูสถิติและประสิทธิภาพ',
    items: [
      'เข้าหน้า วิเคราะห์ข้อมูล',
      'เลือกช่วงเวลา: วัน / สัปดาห์ / เดือน / ปี',
      'ดูจำนวนคิว เวลารอ เวลาให้บริการ',
      'ดูหัตถการยอดนิยม',
    ],
  },
  {
    icon: <Settings className="w-5 h-5" />,
    title: 'ตั้งค่าคลินิก',
    desc: 'ปรับแต่งการตั้งค่าต่าง ๆ',
    items: [
      'ชื่อคลินิก เบอร์โทร เวลาเปิดทำการ',
      'เพิ่ม/แก้ไขสาขา',
      'เพิ่ม/แก้ไขหัตถการ',
      'ตั้งค่า LINE OA Notification',
    ],
  },
]

const faqs: FAQItem[] = [
  {
    q: 'ClinicQ คืออะไร?',
    a: 'ClinicQ เป็นระบบจัดการคลินิกครบวงจร รวมการจัดคิว นัดหมาย ห้องตรวจ ผู้ให้บริการ และการวิเคราะห์การทำงานไว้ในระบบเดียว',
  },
  {
    q: 'ทดลองใช้ฟรีกี่วัน?',
    a: 'ทดลองใช้ฟรี 30 วัน ไม่ต้องใช้บัตรเครดิต ใช้ได้ทุกฟีเจอร์ครบทุกอย่าง',
  },
  {
    q: 'ผู้รับบริการเข้าคิวได้อย่างไร?',
    a: 'สแกน QR Code ที่หน้าคลินิก หรือจองคิวออนไลน์ผ่านเว็บไซต์ ไม่ต้องติดตั้งแอป',
  },
  {
    q: 'ตั้งค่าห้องตรวจอย่างไร?',
    a: 'เข้าหน้า จัดการคลินิก > ห้องตรวจ > เพิ่มห้องตรวจใหม่ > เลือกหัตถการและผู้ให้บริการ',
  },
  {
    q: 'ดูรายงานย้อนหลังได้หรือไม่?',
    a: 'ได้ครับ เข้าหน้าวิเคราะห์ข้อมูลแล้วเลือกช่วงเวลา: วัน / สัปดาห์ / เดือน / ปี',
  },
  {
    q: 'ตั้งค่า LINE Notification อย่างไร?',
    a: 'เข้าหน้า ตั้งค่าคลินิก > LINE Notification > เชื่อมต่อ LINE OA > เปิดการแจ้งเตือน',
  },
  {
    q: 'มีหลายสาขาได้หรือไม่?',
    a: 'ได้ครับ ไม่จำกัดสาขา ไม่จำกัดห้อง ไม่จำกัดผู้ใช้',
  },
  {
    q: 'ข้อมูลปลอดภัยหรือไม่?',
    a: 'ปลอดภัยครับ ข้อมูลเก็บบน Cloud และสำรองข้อมูลอัตโนมัติ',
  },
]

export default function HelpPage() {
  const [openFaq, setOpenFaq] = useState<number | null>(null)
  const [searchQuery, setSearchQuery] = useState('')

  const filteredFaqs = faqs.filter(
    (f) =>
      f.q.toLowerCase().includes(searchQuery.toLowerCase()) ||
      f.a.toLowerCase().includes(searchQuery.toLowerCase())
  )

  return (
    <div className="min-h-screen bg-gradient-to-br from-teal-50 via-white to-blue-50">
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <button
            onClick={() => window.history.back()}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-xl transition-all"
          >
            <ArrowLeft className="w-4 h-4" /> กลับ
          </button>
          <Link
            href="/"
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-xl transition-all"
          >
            <Home className="w-4 h-4" /> หน้าหลัก
          </Link>
        </div>

        {/* Hero */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-teal-100 text-teal-700 rounded-full text-sm font-bold mb-4">
            📚 คู่มือการใช้งาน
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-gray-900">
            วิธีใช้งาน ClinicQ
          </h1>
          <p className="text-gray-500 mt-3 text-lg">
            คู่มือครบจบ ตั้งแต่เริ่มต้นจนถึงการใช้งานขั้นสูง
          </p>
        </div>

        {/* Search */}
        <div className="max-w-xl mx-auto mb-12">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="ค้นหาวิธีใช้งาน..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-12 pr-4 py-3.5 rounded-2xl border border-gray-200 focus:border-teal-400 focus:ring-2 focus:ring-teal-100 text-sm bg-white transition-all"
            />
          </div>
        </div>

        {/* Quick Links */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-12">
          {[
            { icon: '注册', label: 'สมัครใช้งาน', href: '/register' },
            { icon: '🔑', label: 'เข้าสู่ระบบ', href: '/login' },
            { icon: '💰', label: 'ดูราคา', href: '/pricing' },
            { icon: '💬', label: 'ติดต่อ Admin', href: 'https://lin.ee/OqlmFFG', external: true },
          ].map((link) => (
            <Link
              key={link.label}
              href={link.href}
              target={link.external ? '_blank' : undefined}
              rel={link.external ? 'noopener noreferrer' : undefined}
              className="flex items-center gap-3 p-4 bg-white rounded-2xl border border-gray-100 hover:border-teal-200 hover:shadow-md transition-all"
            >
              <span className="text-2xl">{link.icon}</span>
              <div>
                <p className="text-sm font-bold text-gray-900">{link.label}</p>
                {link.external && <ExternalLink className="w-3 h-3 text-gray-400 inline ml-1" />}
              </div>
            </Link>
          ))}
        </div>

        {/* Guide Sections */}
        <div className="mb-12">
          <h2 className="text-xl font-bold text-gray-900 mb-6">📖 คู่มือทีละขั้นตอน</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {guideSections.map((section, idx) => (
              <div
                key={idx}
                className="bg-white rounded-2xl border border-gray-100 p-5 hover:border-teal-200 hover:shadow-md transition-all"
              >
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-xl bg-teal-50 flex items-center justify-center flex-shrink-0 text-teal-600">
                    {section.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-gray-900">{section.title}</h3>
                    <p className="text-xs text-gray-500 mt-0.5">{section.desc}</p>
                    <ul className="mt-3 space-y-1.5">
                      {section.items.map((item, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm text-gray-600">
                          <ChevronRight className="w-4 h-4 text-teal-500 flex-shrink-0 mt-0.5" />
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* FAQ */}
        <div className="mb-12">
          <h2 className="text-xl font-bold text-gray-900 mb-6">❓ คำถามที่พบบ่อย</h2>
          <div className="space-y-3">
            {filteredFaqs.map((faq, idx) => (
              <div
                key={idx}
                className="bg-white rounded-2xl border border-gray-100 overflow-hidden"
              >
                <button
                  onClick={() => setOpenFaq(openFaq === idx ? null : idx)}
                  className="w-full flex items-center justify-between p-5 text-left"
                >
                  <span className="font-bold text-gray-900 text-sm">{faq.q}</span>
                  <ChevronDown
                    className={`w-5 h-5 text-gray-400 transition-transform ${
                      openFaq === idx ? 'rotate-180' : ''
                    }`}
                  />
                </button>
                {openFaq === idx && (
                  <div className="px-5 pb-5">
                    <p className="text-sm text-gray-600 leading-relaxed">{faq.a}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Contact */}
        <div className="bg-gradient-to-r from-teal-500 to-teal-600 rounded-3xl p-8 text-white text-center">
          <h2 className="text-2xl font-extrabold mb-2">ยังมีคำถาม?</h2>
          <p className="text-teal-100 mb-6">
            ติดต่อทีมงานผ่าน LINE OA ได้เลย เราพร้อมช่วยเหลือ
          </p>
          <a
            href="https://lin.ee/OqlmFFG"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-8 py-4 bg-white text-teal-600 font-bold rounded-2xl hover:shadow-xl transition-all"
          >
            💬 ติดต่อ Admin ผ่าน LINE
          </a>
        </div>

        {/* Footer */}
        <div className="mt-12 text-center">
          <p className="text-xs text-gray-400">
            © 2026 Clinic-Q Platform ·{' '}
            <Link href="/" className="text-teal-500 font-bold hover:underline">
              กลับหน้าหลัก
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
