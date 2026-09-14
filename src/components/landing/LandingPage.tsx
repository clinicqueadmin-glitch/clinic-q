'use client'

import Link from 'next/link'
import type { ReactNode } from 'react'
import {
  LayoutDashboard, Clock, CalendarCheck, DoorOpen, Stethoscope, BarChart3,
  MonitorPlay, Smartphone, QrCode, ShieldCheck, Building2, TrendingUp,
  Timer, ArrowRight, Users, Workflow, ListChecks, Bell,
} from 'lucide-react'

/* ═══════════════════════════════════════════════════════════════
   Design tokens — one visual language for the whole page.
   Deliberately independent of the app's `candy-*` classes: the
   marketing page is its own surface, not an app screen.
   ═══════════════════════════════════════════════════════════════ */
const FONT = { fontFamily: "'Prompt','Nunito',system-ui,sans-serif" }
const ACCENT = '#0d9488'
const INK = '#0f172a'

const NAV = [
  { label: 'ภาพรวม', href: '#overview' },
  { label: 'ความสามารถ', href: '#capabilities' },
  { label: 'การทำงาน', href: '#workflow' },
  { label: 'ประเภทคลินิก', href: '#clinic-types' },
]

/* ═══ What ClinicQ unifies — the one-sentence promise, unpacked ═══ */
const pillars = [
  { icon: Clock, label: 'คิว', desc: 'Walk-in, จองออนไลน์ และนัดหมาย ในลำดับเดียว' },
  { icon: CalendarCheck, label: 'นัดหมาย', desc: 'ตรวจการมาถึง ตรงเวลา และการลงทะเบียนซ้ำ' },
  { icon: DoorOpen, label: 'ห้องตรวจ', desc: 'สถานะห้องว่างและห้องที่กำลังให้บริการ' },
  { icon: Stethoscope, label: 'ผู้ให้บริการ', desc: 'ตารางงาน บทบาท และสิทธิ์ของทีม' },
  { icon: BarChart3, label: 'การวิเคราะห์', desc: 'เวลารอ เวลาให้บริการ และภาระงานจริง' },
]

/* ═══ Workflow — what actually happens in a clinic, in order ═══ */
const workflow = [
  {
    icon: QrCode,
    step: '01',
    title: 'ผู้รับบริการเข้าคิว',
    desc: 'สแกน QR ที่หน้าคลินิก ลงทะเบียน Walk-in หรือจองคิวออนไลน์และนัดหมายไว้ล่วงหน้า ระบบออกหมายเลขคิวให้ทันที',
  },
  {
    icon: Workflow,
    step: '02',
    title: 'เจ้าหน้าที่จัดการคิว',
    desc: 'เห็นคิวทั้งวันในจอเดียว เรียกคิวถัดไป มอบหมายห้องตรวจและผู้ให้บริการ พร้อมบันทึกเวลารอและเวลาให้บริการโดยอัตโนมัติ',
  },
  {
    icon: TrendingUp,
    step: '03',
    title: 'ผู้บริหารเห็นภาพรวม',
    desc: 'ดูจำนวนผู้รับบริการ ช่วงเวลาที่งานหนัก เวลารอเฉลี่ย ประสิทธิภาพห้องและทีมงาน จากข้อมูลที่ระบบเก็บไว้แล้ว',
  },
]

/* ═══ Capabilities ═══ */
const capabilities = [
  {
    icon: ListChecks,
    title: 'จัดคิวและลำดับอัตโนมัติ',
    desc: 'รวม Walk-in จองออนไลน์ และนัดหมายไว้ในลำดับเดียว แสดงเวลารอโดยประมาณของผู้รับบริการแต่ละคิว',
  },
  {
    icon: CalendarCheck,
    title: 'นัดหมายและการมาถึง',
    desc: 'จัดการนัดหมายล่วงหน้า บันทึกการมาถึง ตรวจว่ามาตรงเวลาหรือมาสาย และกันการลงทะเบียนซ้ำ',
  },
  {
    icon: DoorOpen,
    title: 'ห้องตรวจและผู้ให้บริการ',
    desc: 'ผูกห้องกับหัตถการและผู้ให้บริการ ดูได้ทันทีว่าห้องไหนว่าง ห้องไหนกำลังให้บริการ',
  },
  {
    icon: Users,
    title: 'ทีมงานและสิทธิ์การใช้งาน',
    desc: 'กำหนดบทบาท Owner, Manager, Staff และผู้ทำหัตถการ พร้อมสิทธิ์การเข้าถึงที่แยกตามหน้าที่',
  },
  {
    icon: MonitorPlay,
    title: 'จอแสดงคิวและ QR',
    desc: 'จอ TV หน้าคลินิกแสดงคิวและสถานะห้องแบบเรียลไทม์ และ QR สำหรับให้ผู้รับบริการเข้าคิวเอง',
  },
  {
    icon: ShieldCheck,
    title: 'ข้อมูลแยกตามคลินิก',
    desc: 'ข้อมูลแต่ละคลินิกถูกแยกออกจากกัน จัดเก็บบนคลาวด์ และสำรองข้อมูลอัตโนมัติ',
  },
]

const clinicTypes = [
  { name: 'ทันตกรรม', desc: 'คิวตามห้องและทันตแพทย์' },
  { name: 'เวชกรรม', desc: 'ผู้ป่วยนอกและนัดหมายซ้ำ' },
  { name: 'กายภาพบำบัด', desc: 'คอร์สการรักษาหลายครั้ง' },
  { name: 'แพทย์แผนไทย', desc: 'หัตถการและเวลาบริการที่ยืดหยุ่น' },
  { name: 'แพทย์แผนจีน', desc: 'หัตถการและห้องเฉพาะทาง' },
  { name: 'เสริมความงาม', desc: 'นัดหมายและผู้ให้บริการหลายคน' },
]

const insights = [
  'ช่วง 17:00–18:00 มีเวลารอเฉลี่ยสูงที่สุดของวัน',
  'ห้องตรวจ 1 ถูกใช้งานสูงกว่าห้องอื่นในสัปดาห์นี้',
  'เวลารอเฉลี่ยลดลง 8% เมื่อเทียบกับสัปดาห์ก่อน',
]

const weeklyBars = [
  { day: 'จ', v: 45 }, { day: 'อ', v: 62 }, { day: 'พ', v: 58 },
  { day: 'พฤ', v: 74 }, { day: 'ศ', v: 88 }, { day: 'ส', v: 70 }, { day: 'อา', v: 30 },
]

/* ═══════════════════════════════════════════════════════════════
   Screen mockups — built from the real ClinicQ layout (sidebar,
   KPI row, queue list, room panel) so the page shows the product
   itself rather than decoration. Pure markup: no images, no data.
   ═══════════════════════════════════════════════════════════════ */

function Frame({ url, children }: { url: string; children: ReactNode }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-[0_24px_60px_-24px_rgba(15,23,42,0.25)] overflow-hidden">
      <div className="flex items-center gap-3 px-4 py-2.5 border-b border-slate-100 bg-slate-50/80">
        <div className="flex gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-slate-300" />
          <span className="w-2.5 h-2.5 rounded-full bg-slate-300" />
          <span className="w-2.5 h-2.5 rounded-full bg-slate-300" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="mx-auto max-w-[280px] truncate rounded-md border border-slate-200 bg-white px-3 py-1 text-center text-[11px] text-slate-400">
            {url}
          </div>
        </div>
      </div>
      <div className="bg-slate-50/60">{children}</div>
    </div>
  )
}

function StatusDot({ tone }: { tone: 'wait' | 'serving' | 'done' }) {
  const map = {
    wait: { bg: '#fef3c7', text: '#b45309', label: 'รอเรียก' },
    serving: { bg: '#ccfbf1', text: '#0f766e', label: 'กำลังให้บริการ' },
    done: { bg: '#e2e8f0', text: '#475569', label: 'เสร็จแล้ว' },
  }[tone]
  return (
    <span
      className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium"
      style={{ backgroundColor: map.bg, color: map.text }}
    >
      {map.label}
    </span>
  )
}

function DashboardMockup() {
  const kpis = [
    { label: 'รวมวันนี้', value: '24', tone: '#0f172a' },
    { label: 'รอเรียก', value: '5', tone: '#b45309' },
    { label: 'กำลังให้บริการ', value: '3', tone: ACCENT },
    { label: 'เสร็จแล้ว', value: '15', tone: '#475569' },
    { label: 'ยกเลิก', value: '1', tone: '#be123c' },
  ]
  const rows = [
    { no: 'A012', name: 'สมชาย ก.', proc: 'กายภาพบำบัดคอ', tone: 'serving' as const, room: 'ห้อง 1' },
    { no: 'A013', name: 'มาลี ว.', proc: 'กายภาพบำบัดหลัง', tone: 'wait' as const, room: '—' },
    { no: 'A014', name: 'ปิยะ ส.', proc: 'อัลตราซาวด์', tone: 'wait' as const, room: '—' },
    { no: 'A011', name: 'อรทัย พ.', proc: 'ปรับท่าทาง', tone: 'done' as const, room: 'ห้อง 2' },
  ]
  const nav = [
    { icon: LayoutDashboard, label: 'แดชบอร์ด', active: true },
    { icon: Users, label: 'ผู้รับบริการ', active: false },
    { icon: BarChart3, label: 'วิเคราะห์ข้อมูล', active: false },
    { icon: DoorOpen, label: 'จัดการคลินิก', active: false },
  ]

  return (
    <Frame url="clinic-q.app/dashboard">
      <div className="flex">
        {/* sidebar */}
        <aside className="hidden sm:flex w-[168px] flex-shrink-0 flex-col border-r border-slate-100 bg-white px-3 py-4">
          <div className="flex items-center gap-2 px-1">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg text-[11px] font-bold text-white" style={{ background: ACCENT }}>
              CQ
            </div>
            <div className="min-w-0">
              <p className="truncate text-[11px] font-semibold" style={{ color: INK }}>Clinic-Q</p>
              <p className="truncate text-[9px] text-slate-400">คลินิกกายภาพ</p>
            </div>
          </div>
          <nav className="mt-4 space-y-0.5">
            {nav.map((n) => (
              <div
                key={n.label}
                className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-[10px]"
                style={{
                  background: n.active ? '#f0fdfa' : 'transparent',
                  color: n.active ? '#0f766e' : '#64748b',
                  fontWeight: n.active ? 600 : 400,
                }}
              >
                <n.icon className="h-3.5 w-3.5" />
                {n.label}
              </div>
            ))}
          </nav>
        </aside>

        {/* main */}
        <div className="min-w-0 flex-1 p-4">
          <div className="flex items-center justify-between">
            <p className="text-[13px] font-semibold" style={{ color: INK }}>แดชบอร์ด</p>
            <span className="rounded-md border border-slate-200 bg-white px-2 py-0.5 text-[9px] text-slate-500">
              วันนี้ · 09:40 น.
            </span>
          </div>

          <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-5">
            {kpis.map((k) => (
              <div key={k.label} className="rounded-xl border border-slate-100 bg-white px-2.5 py-2">
                <p className="text-[15px] font-bold leading-none" style={{ color: k.tone }}>{k.value}</p>
                <p className="mt-1 text-[9px] text-slate-400">{k.label}</p>
              </div>
            ))}
          </div>

          <div className="mt-3 rounded-xl border border-slate-100 bg-white">
            <div className="flex items-center justify-between border-b border-slate-100 px-3 py-2">
              <p className="text-[10px] font-semibold text-slate-700">คิววันนี้</p>
              <span className="rounded-md px-2 py-0.5 text-[9px] font-medium text-white" style={{ background: ACCENT }}>
                เรียกคิวถัดไป
              </span>
            </div>
            <div className="divide-y divide-slate-50">
              {rows.map((r) => (
                <div key={r.no} className="flex items-center gap-3 px-3 py-2">
                  <span className="w-11 flex-shrink-0 rounded-md bg-slate-100 py-0.5 text-center text-[10px] font-semibold text-slate-700">
                    {r.no}
                  </span>
                  <span className="w-20 flex-shrink-0 truncate text-[10px] text-slate-700">{r.name}</span>
                  <span className="hidden flex-1 truncate text-[10px] text-slate-400 sm:block">{r.proc}</span>
                  <span className="hidden w-14 flex-shrink-0 text-[10px] text-slate-400 md:block">{r.room}</span>
                  <StatusDot tone={r.tone} />
                </div>
              ))}
            </div>
          </div>

          <div className="mt-3 grid grid-cols-3 gap-2">
            {[
              { room: 'ห้อง 1', state: 'กำลังให้บริการ', tone: ACCENT },
              { room: 'ห้อง 2', state: 'ว่าง', tone: '#94a3b8' },
              { room: 'ห้อง 3', state: 'ว่าง', tone: '#94a3b8' },
            ].map((rm) => (
              <div key={rm.room} className="rounded-xl border border-slate-100 bg-white px-2.5 py-2">
                <div className="flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-full" style={{ background: rm.tone }} />
                  <p className="text-[10px] font-semibold text-slate-700">{rm.room}</p>
                </div>
                <p className="mt-1 text-[9px] text-slate-400">{rm.state}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Frame>
  )
}

function SettingsMockup() {
  const rows = [
    { name: 'ห้องตรวจ 1', meta: 'กายภาพบำบัดคอ · นภดล ว.', on: true },
    { name: 'ห้องตรวจ 2', meta: 'อัลตราซาวด์ · นภดล ว.', on: true },
    { name: 'ห้องตรวจ 3', meta: 'ปรับท่าทาง · สุดา ม.', on: true },
    { name: 'ห้องตรวจ 4', meta: 'ยังไม่เปิดใช้งาน', on: false },
  ]
  const roles = ['เจ้าของคลินิก', 'ผู้จัดการ', 'เจ้าหน้าที่', 'ผู้ทำหัตถการ']

  return (
    <Frame url="clinic-q.app/settings">
      <div className="p-4 sm:p-5">
        <div className="flex items-center justify-between">
          <p className="text-[13px] font-semibold" style={{ color: INK }}>จัดการคลินิก</p>
          <span className="rounded-md px-2 py-0.5 text-[9px] font-medium text-white" style={{ background: ACCENT }}>
            บันทึกแล้ว
          </span>
        </div>

        <div className="mt-3 flex flex-wrap gap-1.5">
          {['ตั้งค่าคลินิก', 'สาขาและหัตถการ', 'ห้องตรวจ', 'จัดการผู้ใช้'].map((t, i) => (
            <span
              key={t}
              className="rounded-lg border px-2.5 py-1 text-[9px]"
              style={
                i === 2
                  ? { borderColor: '#99f6e4', background: '#f0fdfa', color: '#0f766e', fontWeight: 600 }
                  : { borderColor: '#e2e8f0', background: '#fff', color: '#94a3b8' }
              }
            >
              {t}
            </span>
          ))}
        </div>

        <div className="mt-3 rounded-xl border border-slate-100 bg-white">
          <div className="flex items-center justify-between border-b border-slate-100 px-3 py-2">
            <p className="text-[10px] font-semibold text-slate-700">ห้องตรวจและหัตถการ</p>
            <span className="text-[9px] text-slate-400">4 ห้อง</span>
          </div>
          <div className="divide-y divide-slate-50">
            {rows.map((r) => (
              <div key={r.name} className="flex items-center gap-3 px-3 py-2">
                <span
                  className="h-1.5 w-1.5 flex-shrink-0 rounded-full"
                  style={{ background: r.on ? ACCENT : '#cbd5e1' }}
                />
                <span className="w-20 flex-shrink-0 text-[10px] font-medium text-slate-700">{r.name}</span>
                <span className="flex-1 truncate text-[10px] text-slate-400">{r.meta}</span>
                <span
                  className="rounded-md px-1.5 py-0.5 text-[9px]"
                  style={r.on ? { background: '#ccfbf1', color: '#0f766e' } : { background: '#f1f5f9', color: '#94a3b8' }}
                >
                  {r.on ? 'เปิด' : 'ปิด'}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-3 rounded-xl border border-slate-100 bg-white p-3">
          <p className="text-[10px] font-semibold text-slate-700">สิทธิ์การใช้งานตามบทบาท</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {roles.map((r) => (
              <span key={r} className="rounded-lg bg-slate-50 px-2 py-1 text-[9px] text-slate-500">
                {r}
              </span>
            ))}
          </div>
        </div>
      </div>
    </Frame>
  )
}

function PatientPhoneMockup() {
  return (
    <div className="mx-auto w-[248px]">
      <div className="rounded-[28px] border border-slate-200 bg-white p-2 shadow-[0_24px_60px_-24px_rgba(15,23,42,0.25)]">
        <div className="overflow-hidden rounded-[22px] border border-slate-100 bg-slate-50">
          <div className="flex items-center justify-between px-3 py-1.5 text-[8px] text-slate-400">
            <span>09:41</span>
            <span>Clinic-Q</span>
          </div>
          <div className="px-3 pb-4 pt-2">
            <p className="text-[10px] text-slate-400">คิวของคุณ</p>
            <p className="text-[30px] font-bold leading-none" style={{ color: ACCENT }}>A012</p>

            <div className="mt-3 rounded-xl border border-slate-100 bg-white px-3 py-2.5">
              <div className="flex items-center gap-1.5">
                <Bell className="h-3 w-3" style={{ color: ACCENT }} />
                <p className="text-[10px] font-medium text-slate-700">เหลืออีก 2 คิวก่อนถึงคุณ</p>
              </div>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100">
                <div className="h-full w-2/3 rounded-full" style={{ background: ACCENT }} />
              </div>
              <p className="mt-2 text-[9px] text-slate-400">เวลารอโดยประมาณ 15 นาที</p>
            </div>

            <div className="mt-2 space-y-1.5">
              {[
                { k: 'หัตถการ', v: 'กายภาพบำบัดคอ' },
                { k: 'ห้องตรวจ', v: 'ห้อง 1' },
                { k: 'ผู้ให้บริการ', v: 'นภดล ว.' },
              ].map((d) => (
                <div key={d.k} className="flex items-center justify-between rounded-lg border border-slate-100 bg-white px-2.5 py-1.5">
                  <span className="text-[9px] text-slate-400">{d.k}</span>
                  <span className="text-[9px] font-medium text-slate-700">{d.v}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════
   Page
   ═══════════════════════════════════════════════════════════════ */

function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <p className="text-[13px] font-semibold uppercase tracking-[0.14em]" style={{ color: ACCENT }}>
      {children}
    </p>
  )
}

export default function LandingPage() {
  return (
    <div className="relative z-[2] min-h-screen bg-white text-slate-900" style={FONT}>
      {/* ═══════ HEADER ═══════ */}
      <header className="sticky top-0 z-50 border-b border-slate-200/70 bg-white/85 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5 sm:px-8">
          <Link href="/" className="flex items-center gap-2.5">
            <img src="/brand-logo.png" alt="Clinic-Q" className="h-8 w-auto" />
            <span className="text-[17px] font-semibold tracking-tight" style={{ color: INK }}>
              Clinic<span style={{ color: ACCENT }}>Q</span>
            </span>
          </Link>

          <nav className="hidden items-center gap-8 md:flex">
            {NAV.map((n) => (
              <a key={n.href} href={n.href} className="text-[14px] text-slate-500 transition hover:text-slate-900">
                {n.label}
              </a>
            ))}
          </nav>

          <div className="flex items-center gap-2 sm:gap-3">
            <Link
              href="/login"
              className="rounded-lg px-3 py-2 text-[14px] font-medium text-slate-600 transition hover:bg-slate-100 hover:text-slate-900"
            >
              เข้าสู่ระบบ
            </Link>
            <Link
              href="/register"
              className="rounded-lg px-4 py-2 text-[14px] font-medium text-white transition hover:opacity-90"
              style={{ background: ACCENT }}
            >
              เริ่มใช้งานฟรี
            </Link>
          </div>
        </div>
      </header>

      {/* ═══════ HERO ═══════ */}
      <section id="overview" className="px-5 pb-20 pt-20 sm:px-8 sm:pt-28">
        <div className="mx-auto max-w-6xl">
          <div className="mx-auto max-w-3xl text-center">
            <p className="text-[13px] font-medium tracking-wide text-slate-500">
              ระบบจัดการคลินิกครบวงจร
            </p>
            <h1
              className="mt-5 text-[34px] font-semibold leading-[1.15] tracking-tight sm:text-[52px]"
              style={{ color: INK }}
            >
              บริหารคลินิกทั้งระบบ
              <br />
              <span style={{ color: ACCENT }}>ในที่เดียว</span>
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-[16px] leading-relaxed text-slate-500 sm:text-[17px]">
              ClinicQ รวมการจัดคิว นัดหมาย ห้องตรวจ ผู้ให้บริการ และการวิเคราะห์การทำงาน
              ไว้ในระบบเดียว ใช้ได้กับคลินิกทุกประเภท
            </p>

            <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link
                href="/register"
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl px-6 py-3.5 text-[15px] font-medium text-white transition hover:opacity-90 sm:w-auto"
                style={{ background: ACCENT }}
              >
                เริ่มใช้งานฟรี
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="/login"
                className="inline-flex w-full items-center justify-center rounded-xl border border-slate-200 bg-white px-6 py-3.5 text-[15px] font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 sm:w-auto"
              >
                เข้าสู่ระบบ
              </Link>
            </div>

            <p className="mt-4 text-[13px] text-slate-400">
              ทดลองใช้ฟรี 30 วัน · ไม่ต้องใช้บัตรเครดิต · เริ่มได้ทันที
            </p>
          </div>

          <div className="mt-16 sm:mt-20">
            <DashboardMockup />
          </div>
        </div>
      </section>

      {/* ═══════ WHAT IT UNIFIES ═══════ */}
      <section className="border-y border-slate-100 bg-slate-50/60 px-5 py-16 sm:px-8 sm:py-20">
        <div className="mx-auto max-w-6xl">
          <div className="text-center">
            <SectionLabel>ระบบเดียว</SectionLabel>
            <h2 className="mt-3 text-[24px] font-semibold tracking-tight sm:text-[30px]" style={{ color: INK }}>
              ห้าสิ่งที่คลินิกต้องใช้จริง รวมอยู่ในที่เดียว
            </h2>
          </div>
          <div className="mt-12 grid grid-cols-1 gap-x-8 gap-y-8 sm:grid-cols-2 lg:grid-cols-5">
            {pillars.map((p) => (
              <div key={p.label}>
                <p.icon className="h-5 w-5" style={{ color: ACCENT }} />
                <h3 className="mt-3 text-[15px] font-semibold" style={{ color: INK }}>{p.label}</h3>
                <p className="mt-1.5 text-[13px] leading-relaxed text-slate-500">{p.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════ WORKFLOW ═══════ */}
      <section id="workflow" className="px-5 py-20 sm:px-8 sm:py-28">
        <div className="mx-auto max-w-6xl">
          <div className="max-w-2xl">
            <SectionLabel>การทำงาน</SectionLabel>
            <h2 className="mt-3 text-[26px] font-semibold tracking-tight sm:text-[34px]" style={{ color: INK }}>
              ClinicQ ช่วยคลินิกคุณอย่างไร
            </h2>
            <p className="mt-4 text-[15px] leading-relaxed text-slate-500">
              ตั้งแต่ผู้รับบริการเดินเข้าคลินิก จนถึงรายงานที่ผู้บริหารใช้ตัดสินใจ
              ทุกขั้นตอนอยู่ในระบบเดียวกัน ไม่ต้องจดใส่กระดาษหรือสลับหลายโปรแกรม
            </p>
          </div>

          <div className="mt-14 grid grid-cols-1 gap-10 md:grid-cols-3 md:gap-8">
            {workflow.map((w, i) => (
              <div key={w.step} className="relative">
                {i < workflow.length - 1 && (
                  <span className="absolute left-[26px] top-14 hidden h-[calc(100%-2rem)] w-px bg-slate-200 md:block" />
                )}
                <div
                  className="relative flex h-11 w-11 items-center justify-center rounded-xl border border-slate-200 bg-white"
                >
                  <w.icon className="h-5 w-5" style={{ color: ACCENT }} />
                </div>
                <p className="mt-5 text-[12px] font-semibold tracking-[0.16em] text-slate-300">{w.step}</p>
                <h3 className="mt-2 text-[17px] font-semibold" style={{ color: INK }}>{w.title}</h3>
                <p className="mt-2.5 text-[14px] leading-relaxed text-slate-500">{w.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════ PATIENT FLOW ═══════ */}
      <section className="border-y border-slate-100 bg-slate-50/60 px-5 py-20 sm:px-8 sm:py-28">
        <div className="mx-auto grid max-w-6xl grid-cols-1 items-center gap-14 lg:grid-cols-2 lg:gap-20">
          <div>
            <SectionLabel>ผู้รับบริการ</SectionLabel>
            <h2 className="mt-3 text-[26px] font-semibold tracking-tight sm:text-[32px]" style={{ color: INK }}>
              ผู้รับบริการเข้าคิวเองได้
              <br />
              ไม่ต้องรอที่เคาน์เตอร์
            </h2>
            <p className="mt-4 text-[15px] leading-relaxed text-slate-500">
              สแกน QR ที่หน้าคลินิก ลงทะเบียน Walk-in หรือจองคิวออนไลน์ล่วงหน้า
              แล้วติดตามสถานะคิวของตัวเองจากมือถือได้ทันที
            </p>

            <ul className="mt-8 space-y-5">
              {[
                { icon: QrCode, t: 'สแกน QR แล้วเข้าคิวได้ทันที', d: 'ไม่ต้องติดตั้งแอป และไม่ต้องสมัครสมาชิก' },
                { icon: Smartphone, t: 'ติดตามคิวจากมือถือ', d: 'เห็นหมายเลขคิว ตำแหน่งคิว และเวลารอโดยประมาณ' },
                { icon: Bell, t: 'รู้ล่วงหน้าก่อนถึงคิว', d: 'เมื่อถึงคิว ระบบแจ้งสถานะให้ผู้รับบริการทราบ' },
              ].map((f) => (
                <li key={f.t} className="flex gap-4">
                  <f.icon className="mt-0.5 h-5 w-5 flex-shrink-0" style={{ color: ACCENT }} />
                  <div>
                    <p className="text-[15px] font-medium" style={{ color: INK }}>{f.t}</p>
                    <p className="mt-0.5 text-[13px] text-slate-500">{f.d}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>

          <PatientPhoneMockup />
        </div>
      </section>

      {/* ═══════ ANALYTICS ═══════ */}
      <section className="px-5 py-20 sm:px-8 sm:py-28">
        <div className="mx-auto grid max-w-6xl grid-cols-1 items-center gap-14 lg:grid-cols-2 lg:gap-20">
          <div>
            <SectionLabel>การวิเคราะห์</SectionLabel>
            <h2 className="mt-3 text-[26px] font-semibold tracking-tight sm:text-[32px]" style={{ color: INK }}>
              เห็นว่าคลินิกทำงาน
              <br />
              เป็นอย่างไรทุกวัน
            </h2>
            <p className="mt-4 text-[15px] leading-relaxed text-slate-500">
              ไม่ใช่แค่จำนวนคิว แต่เห็นภาพรวมผู้รับบริการ เวลารอ เวลาให้บริการ
              ประสิทธิภาพของห้องตรวจและผู้ให้บริการ เพื่อวางแผนกำลังคนและเวลาทำงานได้จริง
            </p>

            <div className="mt-8 space-y-4 border-l-2 border-slate-200 pl-5">
              {insights.map((t) => (
                <p key={t} className="text-[14px] leading-relaxed text-slate-600">{t}</p>
              ))}
            </div>

            <p className="mt-8 text-[13px] text-slate-400">
              ตัวเลขทั้งหมดมาจากข้อมูลคิวที่ระบบเก็บไว้แล้ว ไม่ต้องกรอกเพิ่ม
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-[0_1px_3px_rgba(15,23,42,0.04)] sm:p-7">
            <div className="flex items-baseline justify-between">
              <div>
                <p className="text-[14px] font-semibold" style={{ color: INK }}>ผู้รับบริการรายสัปดาห์</p>
                <p className="mt-0.5 text-[12px] text-slate-400">จำนวนคิว (คน)</p>
              </div>
              <span className="rounded-full bg-teal-50 px-2.5 py-1 text-[12px] font-medium" style={{ color: '#0f766e' }}>
                +12%
              </span>
            </div>

            <div className="mt-7 flex h-40 items-end justify-between gap-2.5">
              {weeklyBars.map((b) => (
                <div key={b.day} className="flex flex-1 flex-col items-center gap-2">
                  <div className="w-full rounded-t-md" style={{ height: `${b.v}%`, background: '#5eead4' }} />
                  <span className="text-[11px] text-slate-400">{b.day}</span>
                </div>
              ))}
            </div>

            <div className="mt-7 grid grid-cols-3 gap-4 border-t border-slate-100 pt-6">
              {[
                { icon: Timer, label: 'เวลารอเฉลี่ย', value: '18 น.' },
                { icon: Clock, label: 'เวลาให้บริการ', value: '32 น.' },
                { icon: DoorOpen, label: 'ใช้ห้องตรวจ', value: '76%' },
              ].map((s) => (
                <div key={s.label}>
                  <s.icon className="h-4 w-4 text-slate-400" />
                  <p className="mt-2 text-[18px] font-semibold" style={{ color: INK }}>{s.value}</p>
                  <p className="text-[11px] text-slate-400">{s.label}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ═══════ CAPABILITIES ═══════ */}
      <section id="capabilities" className="border-y border-slate-100 bg-slate-50/60 px-5 py-20 sm:px-8 sm:py-28">
        <div className="mx-auto max-w-6xl">
          <div className="max-w-2xl">
            <SectionLabel>ความสามารถ</SectionLabel>
            <h2 className="mt-3 text-[26px] font-semibold tracking-tight sm:text-[34px]" style={{ color: INK }}>
              จัดการคลินิกครบทุกด้าน
            </h2>
            <p className="mt-4 text-[15px] leading-relaxed text-slate-500">
              ทุกฟังก์ชันที่คลินิกต้องใช้จริง ตั้งแต่วันแรกที่ผู้รับบริการเดินเข้า
              ไปจนถึงรายงานภาพรวมของคลินิก
            </p>
          </div>

          <div className="mt-14 grid grid-cols-1 gap-x-10 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
            {capabilities.map((c) => (
              <div key={c.title}>
                <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white">
                  <c.icon className="h-5 w-5" style={{ color: ACCENT }} />
                </div>
                <h3 className="mt-4 text-[16px] font-semibold" style={{ color: INK }}>{c.title}</h3>
                <p className="mt-2 text-[14px] leading-relaxed text-slate-500">{c.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════ CLINIC MANAGEMENT / TRUST ═══════ */}
      <section className="px-5 py-20 sm:px-8 sm:py-28">
        <div className="mx-auto grid max-w-6xl grid-cols-1 items-center gap-14 lg:grid-cols-2 lg:gap-20">
          <SettingsMockup />
          <div>
            <SectionLabel>จัดการคลินิก</SectionLabel>
            <h2 className="mt-3 text-[26px] font-semibold tracking-tight sm:text-[32px]" style={{ color: INK }}>
              ตั้งค่าคลินิกให้ตรง
              <br />
              กับวิธีทำงานจริงของคุณ
            </h2>
            <p className="mt-4 text-[15px] leading-relaxed text-slate-500">
              เพิ่มสาขา ห้องตรวจ ผู้ให้บริการ และรายการหัตถการได้เอง
              พร้อมกำหนดสิทธิ์การใช้งานตามบทบาทของแต่ละคน
            </p>

            <div className="mt-9 space-y-7">
              {[
                { icon: Building2, t: 'หลายสาขา หลายห้องตรวจ', d: 'แยกสาขาและห้องตรวจได้ตามโครงสร้างของคลินิก' },
                { icon: Stethoscope, t: 'ผู้ให้บริการและหัตถการ', d: 'ผูกผู้ให้บริการกับห้องและหัตถการที่ทำได้' },
                { icon: ShieldCheck, t: 'สิทธิ์การใช้งานตามบทบาท', d: 'เจ้าของคลินิก ผู้จัดการ เจ้าหน้าที่ และผู้ทำหัตถการ' },
              ].map((f) => (
                <div key={f.t} className="flex gap-4">
                  <f.icon className="mt-0.5 h-5 w-5 flex-shrink-0" style={{ color: ACCENT }} />
                  <div>
                    <p className="text-[15px] font-medium" style={{ color: INK }}>{f.t}</p>
                    <p className="mt-0.5 text-[13px] leading-relaxed text-slate-500">{f.d}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ═══════ CLINIC TYPES ═══════ */}
      <section id="clinic-types" className="border-y border-slate-100 bg-slate-50/60 px-5 py-20 sm:px-8 sm:py-24">
        <div className="mx-auto max-w-6xl">
          <div className="text-center">
            <SectionLabel>ประเภทคลินิก</SectionLabel>
            <h2 className="mt-3 text-[24px] font-semibold tracking-tight sm:text-[30px]" style={{ color: INK }}>
              ใช้ได้กับคลินิกหลากหลายประเภท
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-[15px] leading-relaxed text-slate-500">
              ตั้งค่าหัตถการ ห้องตรวจ และผู้ให้บริการได้ตามรูปแบบของคลินิกคุณ
            </p>
          </div>

          <div className="mt-12 grid grid-cols-1 gap-px overflow-hidden rounded-2xl border border-slate-200 bg-slate-200 sm:grid-cols-2 lg:grid-cols-3">
            {clinicTypes.map((c) => (
              <div key={c.name} className="bg-white px-6 py-6">
                <p className="text-[15px] font-semibold" style={{ color: INK }}>{c.name}</p>
                <p className="mt-1.5 text-[13px] text-slate-500">{c.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════ FINAL CTA ═══════ */}
      <section className="px-5 py-24 sm:px-8 sm:py-28">
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="text-[26px] font-semibold tracking-tight sm:text-[34px]" style={{ color: INK }}>
            เริ่มจัดการคลินิกให้เป็นระบบขึ้น
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-[15px] leading-relaxed text-slate-500">
            สมัครใช้งานและเริ่มลงคิวแรกได้ภายในไม่กี่นาที ทดลองใช้ฟรี 30 วัน
          </p>
          <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link
              href="/register"
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl px-6 py-3.5 text-[15px] font-medium text-white transition hover:opacity-90 sm:w-auto"
              style={{ background: ACCENT }}
            >
              เริ่มใช้งานฟรี
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="/login"
              className="inline-flex w-full items-center justify-center rounded-xl border border-slate-200 bg-white px-6 py-3.5 text-[15px] font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 sm:w-auto"
            >
              เข้าสู่ระบบ
            </Link>
          </div>
        </div>
      </section>

      {/* ═══════ FOOTER ═══════ */}
      <footer className="border-t border-slate-200 px-5 py-10 sm:px-8">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-6 sm:flex-row">
          <div className="flex items-center gap-2.5">
            <img src="/brand-logo.png" alt="Clinic-Q" className="h-7 w-auto" />
            <span className="text-[15px] font-semibold tracking-tight" style={{ color: INK }}>
              Clinic<span style={{ color: ACCENT }}>Q</span>
            </span>
          </div>

          <nav className="flex flex-wrap items-center justify-center gap-x-7 gap-y-2">
            {NAV.map((n) => (
              <a key={n.href} href={n.href} className="text-[13px] text-slate-500 transition hover:text-slate-900">
                {n.label}
              </a>
            ))}
            <Link href="/terms" className="text-[13px] text-slate-500 transition hover:text-slate-900">
              เงื่อนไขการใช้งาน
            </Link>
            <Link href="/privacy" className="text-[13px] text-slate-500 transition hover:text-slate-900">
              นโยบายความเป็นส่วนตัว
            </Link>
          </nav>

          <a
            href="https://lin.ee/OqlmFFG"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[13px] font-medium transition hover:opacity-80"
            style={{ color: ACCENT }}
          >
            ติดต่อทีมงาน
          </a>
        </div>

        <div className="mx-auto mt-8 max-w-6xl border-t border-slate-100 pt-6">
          <p className="text-center text-[12px] text-slate-400 sm:text-left">
            © 2026 Clinic-Q Platform. สงวนลิขสิทธิ์
          </p>
        </div>
      </footer>
    </div>
  )
}
