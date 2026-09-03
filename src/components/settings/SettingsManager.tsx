'use client'

import { useState, useCallback, useMemo, useEffect } from 'react'
import {
  Save, RotateCcw, Building, Users, QrCode, Monitor,
  Plus, Edit, Trash2, X, Phone, MapPin, Clock,
  Copy, Check, Volume2, VolumeX, Palette,
  AlertTriangle, ExternalLink, Eye, Stethoscope, Film, DoorOpen, CreditCard, MessageCircle,
} from 'lucide-react'
import { clsx } from 'clsx'
import { QRCodeSVG } from 'qrcode.react'
import { useClinic } from '@/lib/clinic-context'
import { useAuth } from '@/lib/auth-context'
import { getSupabase, isSupabaseReady } from '@/lib/supabase'
import UserManagement from '@/components/auth/UserManagement'
import Toast from '@/components/ui/Toast'
import PhoneInput from '@/components/ui/PhoneInput'
import BranchRoomSettings from './BranchRoomSettings'
import RoomSettings from './RoomSettings'
import LineUserManager from '@/components/line/LineUserManager'


type SettingsTab = 'clinic' | 'branch' | 'rooms' | 'users' | 'qr' | 'tv' | 'line'

const tabs: { id: SettingsTab; name: string; icon: React.ComponentType<{ className?: string }>; description: string }[] = [
  { id: 'clinic', name: 'ตั้งค่าคลินิก', icon: Building, description: 'ข้อมูลพื้นฐานของคลินิก' },
  { id: 'branch', name: 'สาขาและหัตถการ', icon: Stethoscope, description: 'จัดการสาขา หัตถการ และผู้ทำหัตถการ' },
  { id: 'rooms', name: 'ห้องตรวจ', icon: DoorOpen, description: 'ห้องตรวจ รูปภาพ และสีประจำห้อง' },
  { id: 'users', name: 'จัดการผู้ใช้ในคลินิก', icon: Users, description: 'แพทย์ เจ้าหน้าที่ และสิทธิ์การใช้งาน' },
  { id: 'qr', name: 'QR Code & Link', icon: QrCode, description: 'ลิงก์และ QR สำหรับผู้รับบริการ' },
  { id: 'tv', name: 'ตั้งค่าจอแสดงคิว', icon: Monitor, description: 'ตั้งค่าจอ TV และข้อความโฆษณา' },
  { id: 'line', name: 'LINE OA', icon: MessageCircle, description: 'ตั้งค่าการแจ้งเตือนผ่าน LINE' },
]

/* ─────────────── Staff Types ─────────────── */
interface StaffMember {
  id: string
  name: string
  role: 'doctor' | 'nurse' | 'staff'
  specialty?: string
  phone: string
  active: boolean
}

interface TVAd {
  id: string
  type: 'text'
  url: string
  text: string
  duration: number
  active: boolean
}

const initialStaff: StaffMember[] = [
  { id: '1', name: 'นพ.วิชัย มั่นคง', role: 'doctor', specialty: 'เวชกรรมทั่วไป', phone: '081-111-1111', active: true },
  { id: '2', name: 'ทพ.สมบูรณ์ สุขใจ', role: 'doctor', specialty: 'ทันตกรรม', phone: '082-222-2222', active: true },
  { id: '3', name: 'พญ.พิมพ์ใจ รักสุข', role: 'doctor', specialty: 'เสริมความงาม', phone: '083-333-3333', active: true },
  { id: '4', name: 'สุภาพร วงศ์สวัสดิ์', role: 'nurse', phone: '084-444-4444', active: true },
  { id: '5', name: 'เจ้าหน้าที่สมชาย', role: 'staff', phone: '085-555-5555', active: true },
]

const roleLabels = { doctor: 'แพทย์', nurse: 'พยาบาล', staff: 'เจ้าหน้าที่' }
const roleColors = { doctor: 'bg-blue-50 text-blue-600', nurse: 'bg-green-50 text-green-600', staff: 'bg-gray-100 text-gray-600' }

export default function SettingsManager() {
  const { config, currentClinic } = useClinic()
  const { currentRole, currentClinicId } = useAuth()
  const isOwner = currentRole === 'owner' || currentRole === 'platform_owner'
  const [activeTab, setActiveTab] = useState<SettingsTab>('clinic')
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null)

  /* ───── Clinic Settings State ───── */
  const { settings, updateSettings } = useClinic()
  const [clinicName, setClinicName] = useState(config?.name || 'คลินิกเวชกรรม')
  const [clinicPhone, setClinicPhone] = useState('02-123-4567')
  const [clinicAddress, setClinicAddress] = useState('123 ถนนสุขุมวิท แขวงคลองเตย เขตคลองเตย กรุงเทพมหานคร 10110')
  const [openTime, setOpenTime] = useState('08:00')
  const [closeTime, setCloseTime] = useState('20:00')
  const [clinicLogo, setClinicLogo] = useState('')
  const [operatingDays, setOperatingDays] = useState<string[]>(['mon', 'tue', 'wed', 'thu', 'fri'])

  // Clinic-specific settings key
  const settingsKey = currentClinicId ? `clinic-q-settings-${currentClinicId}` : 'clinic-q-settings'
  const lineSettingsKey = currentClinicId ? `clinic-q-line-settings-${currentClinicId}` : 'clinic-q-line-settings'

  // Fetch clinic name from Supabase on mount and reset to defaults
  useEffect(() => {
    const fetchClinicData = async () => {
      // First, try to load from localStorage settings (clinic-specific)
      const saved = localStorage.getItem(settingsKey) || localStorage.getItem('clinic-q-settings')
      if (saved) {
        try {
          const parsed = JSON.parse(saved)
          if (parsed.clinicName) setClinicName(parsed.clinicName)
          if (parsed.openTime) setOpenTime(parsed.openTime)
          if (parsed.closeTime) setCloseTime(parsed.closeTime)
          if (parsed.logo) setClinicLogo(parsed.logo)
          if (parsed.operatingDays) setOperatingDays(parsed.operatingDays)
        } catch {}
      }
      
      // Then, fetch from Supabase to get the latest clinic name
      if (isSupabaseReady()) {
        const sb = getSupabase()
        if (sb) {
          const { data: { user } } = await sb.auth.getUser()
          if (user) {
            // Get clinic from memberships
            const { data: memberships } = await sb.from('clinic_memberships')
              .select('clinic_id')
              .eq('user_id', user.id)
              .eq('is_active', true)
              .limit(1)
            
            if (memberships && memberships.length > 0) {
              const { data: clinic } = await sb.from('clinics')
                .select('name, type')
                .eq('id', memberships[0].clinic_id)
                .single()
              
              if (clinic?.name) {
                setClinicName(clinic.name)
              }
            }
          }
        }
      }
    }
    fetchClinicData()
  }, [])

  /* ───── Staff State ───── */
  const [staff, setStaff] = useState<StaffMember[]>(initialStaff)
  const [showStaffModal, setShowStaffModal] = useState(false)
  const [editingStaff, setEditingStaff] = useState<StaffMember | null>(null)
  const [confirmDeleteStaff, setConfirmDeleteStaff] = useState<string | null>(null)
  const [staffForm, setStaffForm] = useState({ name: '', role: 'doctor' as StaffMember['role'], specialty: '', phone: '' })

  /* ───── QR State ───── */
  const [copied, setCopied] = useState(false)
  const [qrCustomUrl, setQrCustomUrl] = useState('')

  /* ───── TV Settings State ───── */
  const [tvTheme, setTvTheme] = useState<'dark' | 'light'>('dark')
  const [tvSound, setTvSound] = useState(true)
  const [tvAutoCall, setTvAutoCall] = useState(false)
  const [tvShowWaiting, setTvShowWaiting] = useState(true)
  const [tvShowServing, setTvShowServing] = useState(true)
  const [tvShowCompleted, setTvShowCompleted] = useState(false)
  const [tvMaxQueue, setTvMaxQueue] = useState(10)
  const [tvFontSize, setTvFontSize] = useState<'normal' | 'large' | 'xlarge'>('large')

  /* ───── TV Ads State ───── */
  const [tvAds, setTvAds] = useState<TVAd[]>([
    { id: '1', type: 'text', url: '', text: '🦷 โปรโมชั่น ขูดหินปูน + ตรวจสุขภาพฟัน 仅 599 บาท (ถึง 30 ก.ย. 69)', duration: 15, active: true },
  ])
  const [showAdModal, setShowAdModal] = useState(false)
  const [editingAd, setEditingAd] = useState<TVAd | null>(null)
  const [adForm, setAdForm] = useState<{ type: 'text'; url: string; text: string; duration: number }>({ type: 'text', url: '', text: '', duration: 10 })

  /* ───── LINE OA Settings State ───── */
  const [lineChannelSecret, setLineChannelSecret] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem(lineSettingsKey) || localStorage.getItem('clinic-q-line-settings')
      if (saved) {
        try {
          const parsed = JSON.parse(saved)
          return parsed.channelSecret || ''
        } catch {}
      }
    }
    return ''
  })
  const [lineChannelToken, setLineChannelToken] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem(lineSettingsKey) || localStorage.getItem('clinic-q-line-settings')
      if (saved) {
        try {
          const parsed = JSON.parse(saved)
          return parsed.channelToken || ''
        } catch {}
      }
    }
    return ''
  })
  const [lineEnabled, setLineEnabled] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem(lineSettingsKey) || localStorage.getItem('clinic-q-line-settings')
      if (saved) {
        try {
          const parsed = JSON.parse(saved)
          return parsed.enabled || false
        } catch {}
      }
    }
    return false
  })
  const [testLineStatus, setTestLineStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [copiedWebhook, setCopiedWebhook] = useState(false)

  const showToastMsg = useCallback((message: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToast({ message, type })
    setTimeout(() => setToast(null), 3000)
  }, [])

  const trackingUrl = useMemo(() => {
    const base = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000'
    return `${base}/book?clinic=${currentClinic || 'medical'}`
  }, [currentClinic])

  // URL สำหรับ LINE OA — ใช้ตรวจสอบคิวด้วยเบอร์โทร
  const lineTrackingUrl = useMemo(() => {
    const base = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000'
    return `${base}/track?phone=`
  }, [])

  // Webhook URL สำหรับ LINE OA
  const lineWebhookUrl = useMemo(() => {
    const base = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000'
    return `${base}/api/line/webhook`
  }, [])

  /* ───── LINE OA Save ───── */
  const handleSaveLineSettings = () => {
    const settings = {
      channelSecret: lineChannelSecret,
      channelToken: lineChannelToken,
      enabled: lineEnabled,
    }
    localStorage.setItem(lineSettingsKey, JSON.stringify(settings))
    showToastMsg('บันทึกการตั้งค่า LINE OA สำเร็จ!', 'success')
  }

  const handleTestLineConnection = async () => {
    setTestLineStatus('loading')
    // Simulate testing connection
    await new Promise(resolve => setTimeout(resolve, 2000))
    if (lineChannelToken && lineChannelSecret) {
      setTestLineStatus('success')
      showToastMsg('เชื่อมต่อ LINE OA สำเร็จ!', 'success')
    } else {
      setTestLineStatus('error')
      showToastMsg('กรุณากรอก Channel Token และ Secret ให้ครบถ้วน', 'error')
    }
    setTimeout(() => setTestLineStatus('idle'), 3000)
  }

  const handleCopyWebhook = () => {
    navigator.clipboard.writeText(lineWebhookUrl).catch(() => {})
    setCopiedWebhook(true)
    showToastMsg('คัดลอก Webhook URL แล้ว!', 'success')
    setTimeout(() => setCopiedWebhook(false), 2000)
  }

  /* ───── Clinic Save ───── */
  const handleSaveClinic = () => {
    updateSettings({ clinicName, logo: clinicLogo, operatingDays, openTime, closeTime })
    showToastMsg('บันทึกข้อมูลคลินิกสำเร็จ!', 'success')
  }

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) {
      showToastMsg('กรุณาเลือกไฟล์รูปภาพ', 'error')
      return
    }
    if (file.size > 2 * 1024 * 1024) {
      showToastMsg('ขนาดไฟล์ต้องไม่เกิน 2 MB', 'error')
      return
    }
    const reader = new FileReader()
    reader.onload = (ev) => {
      setClinicLogo(ev.target?.result as string)
    }
    reader.readAsDataURL(file)
  }

  const toggleOperatingDay = (day: string) => {
    setOperatingDays(prev =>
      prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day]
    )
  }

  /* ───── Staff CRUD ───── */
  const openAddStaff = () => {
    setEditingStaff(null)
    setStaffForm({ name: '', role: 'doctor', specialty: '', phone: '' })
    setShowStaffModal(true)
  }
  const openEditStaff = (s: StaffMember) => {
    setEditingStaff(s)
    setStaffForm({ name: s.name, role: s.role, specialty: s.specialty || '', phone: s.phone })
    setShowStaffModal(true)
  }
  const saveStaff = () => {
    if (!staffForm.name || staffForm.phone.length !== 10) {
      showToastMsg('กรุณากรอกชื่อและเบอร์โทร 10 หลัก', 'error')
      return
    }
    if (editingStaff) {
      setStaff(prev => prev.map(s => s.id === editingStaff.id ? { ...s, ...staffForm } : s))
      showToastMsg('แก้ไขข้อมูลสำเร็จ!', 'success')
    } else {
      const newStaff: StaffMember = { id: String(Date.now()), ...staffForm, active: true }
      setStaff(prev => [...prev, newStaff])
      showToastMsg('เพิ่มเจ้าหน้าที่สำเร็จ!', 'success')
    }
    setShowStaffModal(false)
  }
  const deleteStaff = (id: string) => {
    setStaff(prev => prev.filter(s => s.id !== id))
    setConfirmDeleteStaff(null)
    showToastMsg('ลบเจ้าหน้าที่แล้ว', 'info')
  }
  const toggleStaffActive = (id: string) => {
    setStaff(prev => prev.map(s => s.id === id ? { ...s, active: !s.active } : s))
  }



  /* ───── QR Copy ───── */
  const copyLink = () => {
    navigator.clipboard.writeText(trackingUrl).catch(() => {})
    setCopied(true)
    showToastMsg('คัดลอกลิงก์แล้ว!', 'success')
    setTimeout(() => setCopied(false), 2000)
  }

  if (!config) return null

  return (
    <div className="space-y-6">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      {/* Staff Modal */}
      {showStaffModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg">
            <div className="flex items-center justify-between p-6 border-b border-gray-100">
              <h2 className="text-xl font-bold text-gray-900">{editingStaff ? 'แก้ไขเจ้าหน้าที่' : 'เพิ่มเจ้าหน้าที่ใหม่'}</h2>
              <button onClick={() => setShowStaffModal(false)} className="p-2 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5 text-gray-500" /></button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">ชื่อ-นามสกุล *</label>
                <input type="text" value={staffForm.name} onChange={(e) => setStaffForm({ ...staffForm, name: e.target.value })} placeholder="กรอกชื่อ-นามสกุล" className="input-field" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">ตำแหน่ง *</label>
                  <select value={staffForm.role} onChange={(e) => setStaffForm({ ...staffForm, role: e.target.value as StaffMember['role'] })} className="input-field">
                    <option value="doctor">แพทย์</option>
                    <option value="nurse">พยาบาล</option>
                    <option value="staff">เจ้าหน้าที่</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">สาขา</label>
                  <input type="text" value={staffForm.specialty} onChange={(e) => setStaffForm({ ...staffForm, specialty: e.target.value })} placeholder="เช่น ทันตกรรมทั่วไป" className="input-field" />
                </div>
              </div>
              <PhoneInput
                label="เบอร์โทรศัพท์"
                value={staffForm.phone}
                onChange={(v) => setStaffForm({ ...staffForm, phone: v })}
                required
              />
            </div>
            <div className="flex justify-end gap-3 p-6 border-t border-gray-100">
              <button onClick={() => setShowStaffModal(false)} className="btn-secondary">ยกเลิก</button>
              <button onClick={saveStaff} className="btn-primary" style={{ backgroundColor: config.color }}>
                {editingStaff ? 'บันทึก' : 'เพิ่มเจ้าหน้าที่'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Staff Confirmation */}
      {confirmDeleteStaff && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center"><AlertTriangle className="w-5 h-5 text-red-500" /></div>
              <h3 className="text-lg font-bold text-gray-900">ยืนยันการลบ</h3>
            </div>
            <p className="text-gray-600 mb-6">ต้องการลบเจ้าหน้าที่คนนี้ใช่หรือไม่?</p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setConfirmDeleteStaff(null)} className="btn-secondary">ยกเลิก</button>
              <button onClick={() => deleteStaff(confirmDeleteStaff)} className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 font-medium">ลบ</button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Ad Modal ─── */}
      {showAdModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg">
            <div className="flex items-center justify-between p-6 border-b border-gray-100">
              <h2 className="text-xl font-bold text-gray-900">{editingAd ? 'แก้ไขโฆษณา' : 'เพิ่มโฆษณาใหม่'}</h2>
              <button onClick={() => { setShowAdModal(false); setEditingAd(null) }} className="p-2 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5 text-gray-500" /></button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">ประเภทโฆษณา</label>
                <div className="flex items-center gap-3 p-3 border-2 border-blue-500 bg-blue-50 rounded-xl">
                  <span className="text-lg">📝</span>
                  <div>
                    <p className="text-sm font-medium text-gray-900">ข้อความวิ่ง</p>
                    <p className="text-[10px] text-gray-500">Marquee วิ่งจากขวาไปซ้าย</p>
                  </div>
                </div>
              </div>

              {adForm.type === 'text' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">ข้อความวิ่ง *</label>
                  <textarea
                    rows={2}
                    value={adForm.text}
                    onChange={(e) => setAdForm(p => ({ ...p, text: e.target.value }))}
                    placeholder="เช่น 🦷 โปรโมชั่นพิเศษ ขูดหินปูน 仅 599 บาท"
                    className="input-field"
                  />
                </div>
              )}





              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">ระยะเวลาแสดง (วินาที)</label>
                <select value={adForm.duration} onChange={(e) => setAdForm(p => ({ ...p, duration: Number(e.target.value) }))} className="input-field">
                  {[5, 8, 10, 12, 15, 20, 30].map(d => <option key={d} value={d}>{d} วินาที</option>)}
                </select>
              </div>

              {/* Preview */}
              <div className="p-4 bg-gray-50 rounded-xl border border-gray-100">
                <p className="text-xs font-medium text-gray-600 mb-2">ตัวอย่าง:</p>
                <div className="h-24 rounded-lg overflow-hidden bg-gray-100">
                  {adForm.type === 'text' && adForm.text && (
                    <div className="relative w-full h-full overflow-hidden flex items-center">
                      <span className="animate-marquee whitespace-nowrap text-sm font-bold text-gray-700 px-4">
                        {adForm.text}  •  {adForm.text}  •  {adForm.text}
                      </span>
                    </div>
                  )}

                  {adForm.type === 'text' && !adForm.text && (
                    <div className="flex items-center justify-center h-full text-xs text-gray-400">กรอกข้อมูลเพื่อดูตัวอย่าง</div>
                  )}
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-3 p-6 border-t border-gray-100">
              <button onClick={() => { setShowAdModal(false); setEditingAd(null) }} className="btn-secondary">ยกเลิก</button>
              <button onClick={() => {
                if (adForm.type === 'text' && !adForm.text.trim()) { showToastMsg('กรุณากรอกข้อความ', 'error'); return }
                if (editingAd) {
                  setTvAds(prev => prev.map(a => a.id === editingAd.id ? { ...a, ...adForm } : a))
                  showToastMsg('แก้ไขโฆษณาสำเร็จ!')
                } else {
                  const newAd: TVAd = { id: String(Date.now()), ...adForm, active: true }
                  setTvAds(prev => [...prev, newAd])
                  showToastMsg('เพิ่มโฆษณาสำเร็จ!')
                }
                setShowAdModal(false); setEditingAd(null)
              }} className="px-5 py-2.5 rounded-lg text-white font-medium text-sm" style={{ backgroundColor: config.color }}>
                {editingAd ? 'บันทึก' : 'เพิ่มโฆษณา'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Page Header */}
      <div>
        <div className="flex items-center gap-3 mb-1">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white font-bold text-sm" style={{ backgroundColor: config.color }}>{config.prefix}</div>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900">ตั้งค่า</h1>
        </div>
        <p className="text-gray-500 mt-1">{config.name}</p>
      </div>

      <div className="flex flex-col lg:flex-row gap-6">
        {/* Tabs */}
        <div className="lg:w-72 flex-shrink-0">
          <div className="card p-2">
            <nav className="space-y-1">
              {tabs.filter(tab => {
                // LINE OA tab only visible to owner
                if (tab.id === 'line' && !isOwner) return false
                return true
              }).map((tab) => {
                const Icon = tab.icon
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={clsx(
                      'w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-colors text-left',
                      activeTab === tab.id ? 'text-white' : 'text-gray-600 hover:bg-gray-50'
                    )}
                    style={activeTab === tab.id ? { backgroundColor: config.color } : {}}
                  >
                    <Icon className="w-5 h-5 flex-shrink-0" />
                    <div>
                      <p className="text-sm font-medium">{tab.name}</p>
                      <p className={clsx('text-xs', activeTab === tab.id ? 'text-white/70' : 'text-gray-400')}>{tab.description}</p>
                    </div>
                  </button>
                )
              })}
            </nav>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1">
          {/* Subscription Info — Owner only */}
          {isOwner && (
            <div className="mb-4 p-4 bg-gradient-to-r from-teal-50 to-emerald-50 border border-teal-200 rounded-2xl">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-teal-100 flex items-center justify-center">
                    <CreditCard className="w-5 h-5 text-teal-600" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-teal-800">📦 แพ็กเกจ Clinic-Q Professional</p>
                    <p className="text-xs text-teal-600">สมัครเมื่อ: 1 สิงหาคม 2569 · หมดอายุ: 1 สิงหาคม 2570</p>
                  </div>
                </div>
                <a href="/pricing" className="px-3 py-1.5 bg-teal-500 text-white text-xs font-bold rounded-lg hover:bg-teal-600 transition-colors">
                  จัดการแพ็กเกจ
                </a>
              </div>
            </div>
          )}

          <div className="card p-6">

            {/* ═══════ TAB: สาขา ═══════ */}
            {activeTab === 'branch' && <BranchRoomSettings />}

            {/* ═══════ TAB: ห้องตรวจ ═══════ */}
            {activeTab === 'rooms' && <RoomSettings />}

            {/* ═══════ TAB: ตั้งค่าคลินิก ═══════ */}
            {activeTab === 'clinic' && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-lg font-semibold text-gray-900 mb-1">ข้อมูลคลินิก</h2>
                  <p className="text-sm text-gray-500">แก้ไขข้อมูลพื้นฐานของคลินิก</p>
                </div>
                <div className="space-y-4">
                  {/* Logo */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Logo คลินิก</label>
                    <div className="flex items-center gap-4">
                      {clinicLogo ? (
                        <div className="relative">
                          <img src={clinicLogo} alt="Logo" className="w-20 h-20 rounded-xl object-cover border-2 border-gray-200" />
                          <button onClick={() => setClinicLogo('')} className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center text-xs hover:bg-red-600">×</button>
                        </div>
                      ) : (
                        <label className="w-20 h-20 rounded-xl border-2 border-dashed border-gray-300 flex flex-col items-center justify-center cursor-pointer hover:border-primary-400 hover:bg-gray-50 transition-colors">
                          <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                          <span className="text-[9px] text-gray-400 mt-1">เลือกรูป</span>
                          <input type="file" accept="image/png,image/jpeg" className="hidden" onChange={handleLogoUpload} />
                        </label>
                      )}
                      <div className="flex-1 text-xs text-gray-500">
                        <p>รองรับ PNG หรือ JPEG</p>
                        <p>ขนาดไม่เกิน 2 MB</p>
                        <p className="text-gray-400 mt-1">แสดงใน Sidebar และหน้าจอ TV</p>
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">ชื่อคลินิก</label>
                    <input type="text" value={clinicName} onChange={(e) => setClinicName(e.target.value)} className="input-field" />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <PhoneInput
                      label="เบอร์โทรศัพท์"
                      value={clinicPhone}
                      onChange={setClinicPhone}
                      showIcon
                    />
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1"><Clock className="w-4 h-4 inline mr-1" />เวลาเปิดทำการ</label>
                      <div className="grid grid-cols-2 gap-2">
                        <input type="time" value={openTime} onChange={(e) => setOpenTime(e.target.value)} className="input-field" />
                        <input type="time" value={closeTime} onChange={(e) => setCloseTime(e.target.value)} className="input-field" />
                      </div>
                    </div>
                  </div>
                  {/* Operating Days */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">วันเปิดทำการ</label>
                    <div className="flex flex-wrap gap-2">
                      {([
                        { key: 'sun', label: 'อา', full: 'อาทิตย์' },
                        { key: 'mon', label: 'จ', full: 'จันทร์' },
                        { key: 'tue', label: 'อ', full: 'อังคาร' },
                        { key: 'wed', label: 'พ', full: 'พุธ' },
                        { key: 'thu', label: 'พฤ', full: 'พฤหัสบดี' },
                        { key: 'fri', label: 'ศ', full: 'ศุกร์' },
                        { key: 'sat', label: 'ส', full: 'เสาร์' },
                      ]).map((day) => {
                        const isActive = operatingDays.includes(day.key)
                        return (
                          <button key={day.key} onClick={() => toggleOperatingDay(day.key)} type="button"
                            className={clsx(
                              'w-12 h-12 rounded-xl flex flex-col items-center justify-center text-sm font-bold transition-all border-2',
                              isActive
                                ? 'text-white shadow-md'
                                : 'bg-gray-50 text-gray-400 border-gray-200 hover:border-gray-300'
                            )}
                            style={isActive ? { backgroundColor: config.color, borderColor: config.color } : {}}>
                            <span className="text-sm leading-none">{day.label}</span>
                            <span className="text-[8px] mt-0.5 opacity-80">{day.full}</span>
                          </button>
                        )
                      })}
                    </div>
                    <p className="text-[10px] text-gray-400 mt-1.5">กดเลือกวันที่ต้องการเปิดทำการ</p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1"><MapPin className="w-4 h-4 inline mr-1" />ที่อยู่</label>
                    <textarea rows={2} value={clinicAddress} onChange={(e) => setClinicAddress(e.target.value)} className="input-field" />
                  </div>

                </div>
              </div>
            )}

            {/* ═══════ TAB: ผู้ใช้งานในคลินิก ═══════ */}
            {activeTab === 'users' && (
              <div className="space-y-6">
                <UserManagement isOwner={isOwner} />
              </div>
            )}

            {/* ═══════ TAB: QR Code & Link ═══════ */}
            {activeTab === 'qr' && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-lg font-semibold text-gray-900 mb-1">📱 QR Code & Link</h2>
                  <p className="text-sm text-gray-500">QR Code อันเดียว ใช้ได้ทั้งสแกนที่หน้าคลินิก (Walk-in) และจองออนไลน์ (LINE OA / Facebook / Website)</p>
                </div>

                {/* ═══ SECTION 1: QR Code for Booking ═══ */}
                <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
                  <div className="px-5 py-4 border-b border-gray-100">
                    <h3 className="font-bold text-gray-900">🎫 QR Code จองคิว & ลงทะเบียน Walk-in</h3>
                    <p className="text-xs text-gray-500 mt-1">สำหรับวางที่เคาน์เตอร์หรือฝังใน LINE OA / Facebook / Website</p>
                  </div>
                  <div className="p-5">
                    {/* QR Preview Card */}
                    <div className="bg-gray-50 rounded-xl p-4 mb-4">
                      <div className="bg-white rounded-xl shadow-sm max-w-sm mx-auto overflow-hidden border border-gray-100">
                        <div className="text-center py-4 px-4" style={{ backgroundColor: config.color }}>
                          <div className="text-white text-sm font-medium opacity-90">🏥 {config.name}</div>
                          <div className="text-white text-2xl font-black mt-1">จองคิว / Walk-in</div>
                          <div className="text-white/70 text-xs mt-1">สแกน QR Code ด้วยมือถือ</div>
                        </div>
                        <div className="flex flex-col items-center py-6 px-4 bg-white">
                          <div className="bg-white p-4 rounded-xl border border-gray-100 mb-4">
                            <QRCodeSVG value={trackingUrl} size={160} level="H" includeMargin />
                          </div>
                          <div className="space-y-1.5 text-xs text-gray-600">
                            <div className="flex items-center gap-2"><span className="w-4 h-4 rounded-full text-white text-[9px] font-bold flex items-center justify-center" style={{ backgroundColor: config.color }}>1</span> สแกน QR Code ด้วยกล้องมือถือ</div>
                            <div className="flex items-center gap-2"><span className="w-4 h-4 rounded-full text-white text-[9px] font-bold flex items-center justify-center" style={{ backgroundColor: config.color }}>2</span> กรอกข้อมูล เลือกหัตถการ</div>
                            <div className="flex items-center gap-2"><span className="w-4 h-4 rounded-full text-white text-[9px] font-bold flex items-center justify-center" style={{ backgroundColor: config.color }}>3</span> อยู่ใกล้ → Walk-in | อยู่ไกล → จองออนไลน์</div>
                          </div>
                        </div>
                      </div>
                    </div>
                    {/* Actions */}
                    <div className="flex flex-wrap gap-2">
                      <button onClick={() => window.print()} className="px-4 py-2 rounded-lg text-white font-medium text-sm flex items-center gap-2" style={{ backgroundColor: config.color }}>
                        🖨️ พิมพ์ QR Code
                      </button>
                      <button onClick={copyLink} className="px-4 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium text-sm flex items-center gap-2">
                        {copied ? <><Check className="w-4 h-4 text-green-500" /> คัดลอกลิงก์แล้ว</> : <><Copy className="w-4 h-4" /> คัดลอกลิงก์</>}
                      </button>
                      <a href={trackingUrl} target="_blank" rel="noopener noreferrer" className="px-4 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium text-sm flex items-center gap-2">
                        <ExternalLink className="w-4 h-4" /> เปิดลิงก์
                      </a>
                    </div>
                  </div>
                </div>

                {/* ═══ SECTION 2: LINE OA Queue Tracking ═══ */}
                <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
                  <div className="px-5 py-4 border-b border-gray-100 bg-green-50/50">
                    <h3 className="font-bold text-gray-900">🔍 ลิงก์ตรวจสอบคิว (LINE OA)</h3>
                    <p className="text-xs text-gray-500 mt-1">ฝังลิงก์นี้ใน LINE OA เพื่อให้คนไข้ตรวจสอบสถานะคิวของตนเอง</p>
                  </div>
                  <div className="p-5">
                    <div className="flex gap-2 mb-3">
                      <input type="text" value={lineTrackingUrl} readOnly className="flex-1 px-3 py-2 rounded-lg bg-gray-50 border border-gray-200 text-sm text-gray-700" />
                      <button onClick={() => { navigator.clipboard.writeText(lineTrackingUrl); setCopied(true); setTimeout(() => setCopied(false), 2000) }} className="px-4 py-2 rounded-lg bg-green-600 hover:bg-green-700 text-white text-sm font-medium flex items-center gap-1">
                        {copied ? <><Check className="w-4 h-4" /> คัดลอกแล้ว</> : <><Copy className="w-4 h-4" /> คัดลอก</>}
                      </button>
                    </div>
                    <div className="p-3 bg-green-50 rounded-lg border border-green-100">
                      <p className="text-xs font-bold text-green-800 mb-2">💡 วิธีตั้งค่าใน LINE OA:</p>
                      <ol className="text-xs text-green-700 space-y-1 list-decimal list-inside">
                        <li>คัดลอกลิงก์ด้านบน</li>
                        <li>เปิด LINE Official Account Manager → แก้ไข Rich Menu</li>
                        <li>เพิ่มปุ่ม "ตรวจสอบคิว" → วางลิงก์</li>
                        <li>คนไข้กดปุ่ม → กรอกเบอร์โทร → เห็นสถานะคิวทันที</li>
                      </ol>
                    </div>
                  </div>
                </div>

                {/* ═══ SECTION 3: Queue Status QR Code ═══ */}
                <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
                  <div className="px-5 py-4 border-b border-gray-100 bg-amber-50/50">
                    <h3 className="font-bold text-gray-900">📊 QR Code สถานะคิววันนี้</h3>
                    <p className="text-xs text-gray-500 mt-1">สำหรับวางที่หน้าจอทีวีหรือฝังใน LINE OA เพื่อให้คนไข้ดูสถานะคิวรวม</p>
                  </div>
                  <div className="p-5">
                    <div className="flex gap-4 items-start">
                      <div className="bg-white p-3 rounded-xl border border-gray-100 shadow-sm flex-shrink-0">
                        <QRCodeSVG
                          value={`${typeof window !== 'undefined' ? window.location.origin : ''}/queue-status?clinic=${currentClinic || 'dental'}`}
                          size={120}
                          level="M"
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-gray-900 mb-1">สถานะคิวแยกตามสาขา</p>
                        <p className="text-xs text-gray-500 mb-3">แสดงจำนวนคิวรอ + เวลาคาดการณ์ แยกตามสาขา พร้อม auto-refresh ทุก 30 วินาที</p>
                        <div className="flex flex-wrap gap-2">
                          <button
                            onClick={() => {
                              const url = `${window.location.origin}/queue-status?clinic=${currentClinic || 'dental'}`
                              navigator.clipboard.writeText(url)
                              setCopied(true)
                              setTimeout(() => setCopied(false), 2000)
                            }}
                            className="px-3 py-1.5 rounded-lg bg-amber-100 hover:bg-amber-200 text-amber-700 text-xs font-medium flex items-center gap-1"
                          >
                            {copied ? <><Check className="w-3 h-3" /> คัดลอกแล้ว</> : <><Copy className="w-3 h-3" /> คัดลอกลิงก์</>}
                          </button>
                          <a
                            href={`/queue-status?clinic=${currentClinic || 'dental'}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-3 py-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-medium flex items-center gap-1"
                          >
                            <ExternalLink className="w-3 h-3" /> เปิดดู
                          </a>
                          <button
                            onClick={() => window.print()}
                            className="px-3 py-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-medium flex items-center gap-1"
                          >
                            🖨️ พิมพ์
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* ═══ SECTION 4: How to Use ═══ */}
                <div className="bg-blue-50 border border-blue-100 rounded-2xl p-5">
                  <h4 className="font-bold text-blue-900 mb-3">📖 วิธีใช้งาน</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="bg-white rounded-xl p-3 border border-blue-100">
                      <p className="text-xs font-bold text-blue-800 mb-2">🎫 สำหรับ QR Code จองคิว</p>
                      <ol className="text-xs text-blue-700 space-y-1 list-decimal list-inside">
                        <li>พิมพ์ QR Code ลงกระดาษ A5/A4</li>
                        <li>วางไว้ที่เคาน์เตอร์ต้อนรับ</li>
                        <li>หรือฝังใน LINE OA / Facebook / Website</li>
                        <li>คนไข้สแกน → ลงทะเบียน Walk-in หรือจองออนไลน์</li>
                      </ol>
                    </div>
                    <div className="bg-white rounded-xl p-3 border border-blue-100">
                      <p className="text-xs font-bold text-blue-800 mb-2">🔍 สำหรับลิงก์ตรวจสอบคิว</p>
                      <ol className="text-xs text-blue-700 space-y-1 list-decimal list-inside">
                        <li>คัดลอกลิงก์ไปวางใน LINE OA</li>
                        <li>สร้างปุ่ม "ตรวจสอบคิว" ใน Rich Menu</li>
                        <li>คนไข้กดปุ่ม → กรอกเบอร์โทร</li>
                        <li>เห็นสถานะคิวของตนเองทันที</li>
                      </ol>
                    </div>
                  </div>
                </div>

              </div>
            )}

            {/* ═══════ TAB: ตั้งค่าจอ TV ═══════ */}
            {activeTab === 'tv' && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-lg font-semibold text-gray-900 mb-1">🖥️ ตั้งค่าจอแสดงคิว TV</h2>
                  <p className="text-sm text-gray-500">ปรับแต่งหน้าจอที่แสดงคิวในคลินิก — ตัวอย่างด้านล่างตรงกับจอจริง</p>
                </div>

                {/* Full TV Preview */}
                <div className={clsx(
                  'rounded-2xl overflow-hidden border-2',
                  tvTheme === 'dark' ? 'bg-gray-900 border-gray-700' : 'bg-gray-50 border-gray-200'
                )}>
                  {/* Header */}
                  <div className={clsx('flex items-center justify-between px-4 py-2 border-b', tvTheme === 'dark' ? 'bg-black/30 border-white/10' : 'bg-white border-gray-200')}>
                    <div className="flex items-center gap-2">
                      <div className={clsx('w-6 h-6 rounded-lg flex items-center justify-center text-white text-[10px] font-bold', tvTheme === 'dark' ? 'bg-gray-700' : 'bg-primary-500')}>
                        {config.prefix}
                      </div>
                      <span className={clsx('text-xs font-bold', tvTheme === 'dark' ? 'text-white' : 'text-gray-900')}>{config?.name || 'คลินิก'}</span>
                    </div>
                    <span className={clsx('text-[10px] font-mono', tvTheme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>10:30:00</span>
                  </div>

                  {/* Body */}
                  <div className="flex">
                    {/* Room Status Area */}
                    <div className="flex-1 p-3">
                      <div className="flex items-center gap-1.5 mb-2">
                        <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
                        <span className={clsx('text-[10px] font-bold uppercase', tvTheme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>🖥️ สถานะห้องตรวจ</span>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        {[1, 2, 3, 4, 5].map(room => {
                          const isActive = room <= 2
                          const isOvertime = room === 2
                          const roomColors = ['#93C5FD', '#A7F3D0', '#FCD34D', '#FDA4AF', '#D8B4FE']
                          return (
                            <div key={room} className={clsx('rounded-lg border p-2 text-center', 
                              tvTheme === 'dark' ? 'border-white/10 bg-white/5' : 'border-gray-200 bg-white'
                            )}>
                              <div className={clsx('w-6 h-6 rounded-lg mx-auto mb-1 flex items-center justify-center text-white text-[10px] font-bold')} style={{ backgroundColor: roomColors[room-1] }}>{room}</div>
                              <p className={clsx('text-[10px] font-bold', tvTheme === 'dark' ? 'text-white' : 'text-gray-800')}>ห้อง {room}</p>
                              {isActive ? (
                                <div className="mt-1">
                                  {isOvertime ? (
                                    <span className="text-[8px] px-1.5 py-0.5 rounded-full bg-amber-500/20 text-amber-400 font-bold">⚠ เลยเวลา</span>
                                  ) : (
                                    <span className="text-[8px] px-1.5 py-0.5 rounded-full bg-green-500/20 text-green-400 font-bold">🔄 กำลังทำ</span>
                                  )}
                                </div>
                              ) : (
                                <span className="text-[8px] px-1.5 py-0.5 rounded-full bg-white/5 text-gray-500">✅ ว่าง</span>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    </div>

                    {/* Queue Panel */}
                    <div className={clsx('w-32 border-l p-2', tvTheme === 'dark' ? 'border-white/10 bg-black/20' : 'border-gray-200 bg-white')}>
                      <div className="mb-2">
                        <p className={clsx('text-[8px] font-medium', tvTheme === 'dark' ? 'text-green-400' : 'text-green-600')}>⏭ คิวถัดไป</p>
                        <p className={clsx('text-xl font-black font-mono', tvTheme === 'dark' ? 'text-green-400' : 'text-green-600')}>{config.prefix}030</p>
                      </div>
                      <p className={clsx('text-[10px] font-bold mb-1', tvTheme === 'dark' ? 'text-gray-300' : 'text-gray-700')}>คิวรอ</p>
                      <div className="space-y-1">
                        {[1, 2].map(i => (
                          <div key={i} className={clsx('flex items-center gap-1 px-1.5 py-1 rounded', tvTheme === 'dark' ? 'bg-white/5' : 'bg-gray-100')}>
                            <span className={clsx('text-[10px] font-bold font-mono', tvTheme === 'dark' ? 'text-white' : 'text-gray-900')}>{config.prefix}03{i}</span>
                            <span className="text-[8px]">🔄</span>
                          </div>
                        ))}
                      </div>
                      <div className={clsx('mt-2 grid grid-cols-3 gap-1 text-center', tvTheme === 'dark' ? 'text-white' : 'text-gray-900')}>
                        <div><p className="text-xs font-bold text-green-500">2</p><p className="text-[7px] text-gray-500">กำลังทำ</p></div>
                        <div><p className="text-xs font-bold text-yellow-500">5</p><p className="text-[7px] text-gray-500">รอเรียก</p></div>
                        <div><p className="text-xs font-bold text-gray-400">1</p><p className="text-[7px] text-gray-500">เสร็จ</p></div>
                      </div>
                    </div>
                  </div>

                  {/* Marquee Area */}
                  <div className={clsx('h-8 border-t flex items-center overflow-hidden', tvTheme === 'dark' ? 'border-white/10 bg-emerald-900/30' : 'border-gray-200 bg-emerald-50')}>
                    <p className={clsx('text-[10px] font-medium whitespace-nowrap animate-marquee', tvTheme === 'dark' ? 'text-emerald-300' : 'text-emerald-700')}>
                      🦷 โปรโมชั่นพิเศษ! ขูดหินปูน + ตรวจสุขภาพฟัน เพียง 599 บาท &nbsp;&nbsp;&nbsp; ✨ ฟอกสีฟัน เทคโนโลยีใหม่ล่าสุด &nbsp;&nbsp;&nbsp; 📱 02-123-4567
                    </p>
                  </div>
                </div>

                <p className="text-xs text-gray-400 text-center">⬆ ตัวอย่างจอ TV (ไม่ใช่จอจริง — ใช้สำหรับตั้งค่าเท่านั้น)</p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Theme */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2"><Palette className="w-4 h-4 inline mr-1" />ธีมจอ</label>
                    <div className="grid grid-cols-2 gap-3">
                      <button onClick={() => setTvTheme('dark')} className={clsx('p-4 rounded-xl border-2 text-center', tvTheme === 'dark' ? 'border-white bg-gray-800' : 'border-gray-200 hover:border-gray-300')}>
                        <div className="w-full h-8 bg-gray-900 rounded-lg mb-2" />
                        <p className="text-sm font-medium text-gray-700">ดาร์ก</p>
                      </button>
                      <button onClick={() => setTvTheme('light')} className={clsx('p-4 rounded-xl border-2 text-center', tvTheme === 'light' ? 'border-primary-500 bg-primary-50' : 'border-gray-200 hover:border-gray-300')}>
                        <div className="w-full h-8 bg-white border rounded-lg mb-2" />
                        <p className="text-sm font-medium text-gray-700">สว่าง</p>
                      </button>
                    </div>
                  </div>

                  {/* Font Size */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">ขนาดตัวอักษร</label>
                    <div className="grid grid-cols-3 gap-2">
                      {(['normal', 'large', 'xlarge'] as const).map((size) => (
                        <button key={size} onClick={() => setTvFontSize(size)} className={clsx(
                          'p-3 rounded-xl border-2 text-center',
                          tvFontSize === size ? 'border-primary-500 bg-primary-50' : 'border-gray-200 hover:border-gray-300'
                        )}>
                          <span className={clsx('font-bold', size === 'normal' ? 'text-sm' : size === 'large' ? 'text-lg' : 'text-2xl')}>ก</span>
                          <p className="text-xs text-gray-500 mt-1">{size === 'normal' ? 'ปกติ' : size === 'large' ? 'ใหญ่' : 'ใหญ่มาก'}</p>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Toggle Options */}
                <div className="space-y-3">
                  <label className="block text-sm font-medium text-gray-700">ตัวเลือก</label>
                  {[
                    { label: 'เปิดเสียงแจ้งเตือน', desc: 'เสียง 3 โน้ต เมื่อเรียกคิว', value: tvSound, onChange: setTvSound, icon: tvSound ? Volume2 : VolumeX },
                    { label: 'แสดงคิวที่กำลังรอ', desc: 'แสดงรายการคิวรอในจอ', value: tvShowWaiting, onChange: setTvShowWaiting, icon: Eye },
                    { label: 'แสดงคิวที่กำลังให้บริการ', desc: 'แสดงคิวที่กำลังรับบริการ', value: tvShowServing, onChange: setTvShowServing, icon: Eye },
                    { label: 'แสดงคิวที่เสร็จแล้ว', desc: 'แสดงคิวที่ให้บริการเสร็จแล้ว', value: tvShowCompleted, onChange: setTvShowCompleted, icon: Eye },
                  ].map((opt) => (
                    <div key={opt.label} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                      <div className="flex items-center gap-3">
                        <opt.icon className="w-4 h-4 text-gray-400" />
                        <div>
                          <p className="text-sm font-medium text-gray-900">{opt.label}</p>
                          <p className="text-xs text-gray-500">{opt.desc}</p>
                        </div>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input type="checkbox" checked={opt.value} onChange={(e) => opt.onChange(e.target.checked)} className="sr-only peer" />
                        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-500"></div>
                      </label>
                    </div>
                  ))}
                </div>

                {/* Max Queue Display */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">จำนวนคิวสูงสุดที่แสดง</label>
                  <input type="number" min={1} max={50} value={tvMaxQueue} onChange={(e) => setTvMaxQueue(Number(e.target.value))} className="input-field w-32" />
                </div>

                {/* ═══════ ข้อความโฆษณาบนจอ ═══════ */}
                <div className="border-t-2 border-gray-100 pt-6">
                  <h3 className="text-lg font-bold text-gray-900 mb-1">📝 ข้อความโฆษณาบนจอ</h3>
                  <p className="text-sm text-gray-500 mb-4">เพิ่มข้อความวิ่งที่ต้องการแสดงบนจอ TV</p>

                  {/* ═══ Add Ad Button (Text Only) ═══ */}
                  <div className="flex justify-start mb-4">
                    <button onClick={() => { setEditingAd(null); setAdForm({ type: 'text', url: '', text: '', duration: 10 }); setShowAdModal(true) }}
                      className="flex flex-col items-center gap-2 px-6 py-5 border-2 border-dashed border-blue-300 rounded-xl text-blue-600 hover:bg-blue-50 transition-colors">
                      <Plus className="w-6 h-6" />
                      <span className="text-sm font-bold">ข้อความวิ่ง</span>
                    </button>
                  </div>

                  {/* ═══ Ad List (Text Only) ═══ */}
                  <div className="space-y-2">
                    {tvAds.filter(ad => ad.type === 'text').map((ad) => (
                      <div key={ad.id} className={clsx('flex items-center gap-3 p-3 rounded-xl border transition-colors',
                        ad.active ? 'bg-white border-gray-200 hover:bg-gray-50' : 'bg-gray-50 border-gray-100 opacity-60'
                      )}>
                        <div className="w-10 h-10 rounded-lg flex items-center justify-center text-lg flex-shrink-0 bg-blue-100">
📝
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">{ad.text}</p>
                          <p className="text-xs text-gray-500">แสดง {ad.duration} วินาที</p>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <button onClick={() => setTvAds(prev => prev.map(a => a.id === ad.id ? { ...a, active: !a.active } : a))}
                            className={clsx('px-3 py-1.5 rounded-lg text-xs font-medium', ad.active ? 'bg-yellow-50 text-yellow-600' : 'bg-green-50 text-green-600')}>
                            {ad.active ? '⏸ ปิด' : '▶ เปิด'}
                          </button>
                          <button onClick={() => { setEditingAd(ad); setAdForm({ type: ad.type, url: ad.url, text: ad.text, duration: ad.duration }); setShowAdModal(true) }}
                            className="p-1.5 hover:bg-gray-100 rounded-lg"><Edit className="w-4 h-4 text-gray-500" /></button>
                          <button onClick={() => { setTvAds(prev => prev.filter(a => a.id !== ad.id)); showToastMsg('ลบโฆษณาแล้ว', 'info') }}
                            className="p-1.5 hover:bg-red-50 rounded-lg"><Trash2 className="w-4 h-4 text-gray-400 hover:text-red-500" /></button>
                        </div>
                      </div>
                    ))}
                    {tvAds.length === 0 && (
                      <div className="text-center py-6 text-gray-400 border-2 border-dashed border-gray-200 rounded-xl">
                        <Film className="w-6 h-6 mx-auto mb-2 opacity-30" />
                        <p className="text-sm">ยังไม่มีโฆษณา — กดปุ่มด้านบนเพื่อเพิ่ม</p>
                      </div>
                    )}
                  </div>

                  {/* ═══ Info ═══ */}
                  <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 mt-4">
                    <h4 className="text-sm font-medium text-gray-900 mb-2">📖 วิธีใช้งาน</h4>
                    <div className="text-xs text-gray-600">
                      <div className="bg-white rounded-lg p-3 border border-gray-100">
                        <p className="font-bold text-blue-700 mb-1">📝 ข้อความวิ่ง</p>
                        <p>พิมพ์ข้อความที่ต้องการแสดง ระบบจะแสดงข้อความวิ่งจากขวาไปซ้ายที่แถบล่างจอ TV</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ═══════ TAB: LINE OA ═══════ */}
            {activeTab === 'line' && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-lg font-semibold text-gray-900 mb-1">💬 LINE Official Account</h2>
                  <p className="text-sm text-gray-500">ตั้งค่าการแจ้งเตือนสถานะคิวผ่าน LINE OA ให้ลูกค้า</p>
                </div>

                {/* LINE Enable Toggle */}
                <div className="bg-white border border-gray-200 rounded-2xl p-5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-green-100 flex items-center justify-center">
                        <MessageCircle className="w-5 h-5 text-green-600" />
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">เปิดใช้งาน LINE Notification</p>
                        <p className="text-sm text-gray-500">แจ้งเตือนลูกค้าเมื่อถึงคิว ผ่าน LINE</p>
                      </div>
                    </div>
                    <button
                      onClick={() => setLineEnabled(!lineEnabled)}
                      className={clsx(
                        'relative inline-flex h-6 w-11 items-center rounded-full transition-colors',
                        lineEnabled ? 'bg-green-500' : 'bg-gray-300'
                      )}
                    >
                      <span className={clsx(
                        'inline-block h-4 w-4 transform rounded-full bg-white transition-transform',
                        lineEnabled ? 'translate-x-6' : 'translate-x-1'
                      )} />
                    </button>
                  </div>
                </div>

                {/* LINE API Credentials */}
                <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
                  <div className="px-5 py-4 border-b border-gray-100 bg-green-50/50">
                    <h3 className="font-bold text-gray-900">🔑 LINE API Credentials</h3>
                    <p className="text-sm text-gray-500 mt-1">ข้อมูลสำหรับเชื่อมต่อ LINE Messaging API</p>
                  </div>
                  <div className="p-5 space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Channel Secret *</label>
                      <input
                        type="password"
                        value={lineChannelSecret}
                        onChange={(e) => setLineChannelSecret(e.target.value)}
                        placeholder="กรอก Channel Secret จาก LINE Developers Console"
                        className="input-field"
                      />
                      <p className="text-xs text-gray-400 mt-1">หาได้จาก Basic settings ใน LINE Developers Console</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Channel Access Token (Long-lived) *</label>
                      <input
                        type="password"
                        value={lineChannelToken}
                        onChange={(e) => setLineChannelToken(e.target.value)}
                        placeholder="กรอก Channel Access Token จาก LINE Developers Console"
                        className="input-field"
                      />
                      <p className="text-xs text-gray-400 mt-1">สร้าง Token แบบ Long-lived ใน Channel access tokens</p>
                    </div>
                    <div className="flex gap-3">
                      <button
                        onClick={handleTestLineConnection}
                        disabled={testLineStatus === 'loading'}
                        className={clsx(
                          'flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm transition-all',
                          testLineStatus === 'loading' ? 'bg-gray-100 text-gray-500 cursor-not-allowed' :
                          testLineStatus === 'success' ? 'bg-green-100 text-green-700' :
                          testLineStatus === 'error' ? 'bg-red-100 text-red-700' :
                          'bg-blue-100 text-blue-700 hover:bg-blue-200'
                        )}
                      >
                        {testLineStatus === 'loading' ? '⏳ กำลังตรวจสอบ...' :
                         testLineStatus === 'success' ? '✅ เชื่อมต่อสำเร็จ' :
                         testLineStatus === 'error' ? '❌ เชื่อมต่อไม่ได้' :
                         '🔍 ทดสอบการเชื่อมต่อ'}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Webhook URL */}
                <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
                  <div className="px-5 py-4 border-b border-gray-100 bg-green-50/50">
                    <h3 className="font-bold text-gray-900">🔗 Webhook URL</h3>
                    <p className="text-sm text-gray-500 mt-1">นำ URL นี้ไปตั้งค่าใน LINE Official Account Manager</p>
                  </div>
                  <div className="p-5">
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={lineWebhookUrl}
                        readOnly
                        className="flex-1 px-3 py-2 rounded-lg bg-gray-50 border border-gray-200 text-sm text-gray-700 font-mono"
                      />
                      <button
                        onClick={handleCopyWebhook}
                        className={clsx(
                          'px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-1 transition-all',
                          copiedWebhook
                            ? 'bg-green-100 text-green-700'
                            : 'bg-green-600 hover:bg-green-700 text-white'
                        )}
                      >
                        {copiedWebhook ? <><Check className="w-4 h-4" /> คัดลอกแล้ว</> : <><Copy className="w-4 h-4" /> คัดลอก</>}
                      </button>
                    </div>
                    <div className="mt-4 p-3 bg-gray-50 rounded-lg border border-gray-100">
                      <p className="text-xs font-bold text-gray-800 mb-2">📖 วิธีตั้งค่า Webhook ใน LINE Official Account Manager:</p>
                      <ol className="text-xs text-gray-600 space-y-1 list-decimal list-inside">
                        <li>เข้า <a href="https://manager.line.biz/" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">LINE Official Account Manager</a></li>
                        <li>เลือก LINE Official Account ของคุณ</li>
                        <li>ไปที่ เพิ่มเติม → การตั้งค่า API</li>
                        <li>เปิด Channel access token (long-lived)</li>
                        <li>คัดลอก URL ด้านบนไปวางในช่อง Webhook URL</li>
                        <li>กด Verify เพื่อทดสอบการเชื่อมต่อ</li>
                        <li>เปิด "Use webhook" เป็น ON</li>
                      </ol>
                    </div>
                  </div>
                </div>

                {/* LINE Bind URL for Rich Menu */}
                <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
                  <div className="px-5 py-4 border-b border-gray-100 bg-green-50/50">
                    <h3 className="font-bold text-gray-900">📱 LINE Binding URL</h3>
                    <p className="text-sm text-gray-500 mt-1">ลิงก์สำหรับให้คนไข้เชื่อมต่อบัญชี LINE กับเบอร์โทร</p>
                  </div>
                  <div className="p-5">
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={`${typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000'}/line-bind?clinic=${currentClinic || 'dental'}`}
                        readOnly
                        className="flex-1 px-3 py-2 rounded-lg bg-gray-50 border border-gray-200 text-sm text-gray-700 font-mono"
                      />
                      <button
                        onClick={() => {
                          const url = `${window.location.origin}/line-bind?clinic=${currentClinic || 'dental'}`
                          navigator.clipboard.writeText(url).catch(() => {})
                          showToastMsg('คัดลอก URL แล้ว!', 'success')
                        }}
                        className="px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-1 bg-green-600 hover:bg-green-700 text-white transition-all"
                      >
                        <Copy className="w-4 h-4" /> คัดลอก
                      </button>
                    </div>
                    <div className="mt-4 p-3 bg-gray-50 rounded-lg border border-gray-100">
                      <p className="text-xs font-bold text-gray-800 mb-2">📖 วิธีใช้ URL นี้ใน LINE OA:</p>
                      <ol className="text-xs text-gray-600 space-y-1 list-decimal list-inside">
                        <li>คัดลอก URL ด้านบน</li>
                        <li>ไปที่ LINE Official Account Manager → Rich Menu</li>
                        <li>สร้างปุ่ม "เชื่อมต่อบัญชี" แล้ววาง URL</li>
                        <li>คนไข้กดปุ่มใน LINE → กรอกเบอร์โทร → เชื่อมต่อสำเร็จ</li>
                      </ol>
                    </div>
                  </div>
                </div>

                {/* How LINE Notifications Work */}
                <div className="bg-green-50 border border-green-100 rounded-2xl p-5">
                  <h4 className="font-bold text-green-900 mb-3">📱 วิธีการแจ้งเตือน LINE</h4>
                  <div className="text-sm text-green-800 space-y-2">
                    <div className="flex items-start gap-2">
                      <span className="font-bold">1.</span>
                      <span>ลูกค้าสแกน QR Code LINE OA ของคลินิก</span>
                    </div>
                    <div className="flex items-start gap-2">
                      <span className="font-bold">2.</span>
                      <span>ลูกค้ากดปุ่ม "เชื่อมต่อบัญชี" ใน Rich Menu แล้วกรอกเบอร์โทร</span>
                    </div>
                    <div className="flex items-start gap-2">
                      <span className="font-bold">3.</span>
                      <span>ระบบเชื่อม LINE User ID กับเบอร์โทรของลูกค้า</span>
                    </div>
                    <div className="flex items-start gap-2">
                      <span className="font-bold">4.</span>
                      <span>เมื่อถึงคิว ระบบส่งข้อความแจ้งเตือนไปที่ LINE ของลูกค้า</span>
                    </div>
                  </div>
                </div>

                {/* LINE Users */}
                <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
                  <div className="px-5 py-4 border-b border-gray-100">
                    <h3 className="font-bold text-gray-900">👥 จัดการ LINE Users</h3>
                    <p className="text-sm text-gray-500 mt-1">รายชื่อผู้ใช้ LINE ที่เชื่อมต่อกับ LINE OA ของคลินิก</p>
                  </div>
                  <div className="p-5">
                    <LineUserManager />
                  </div>
                </div>

                {/* LINE Message Preview */}
                <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
                  <div className="px-5 py-4 border-b border-gray-100">
                    <h3 className="font-bold text-gray-900">📝 ตัวอย่างข้อความแจ้งเตือน</h3>
                  </div>
                  <div className="p-5">
                    <div className="bg-[#06c755] rounded-2xl p-4 max-w-sm">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="w-8 h-8 bg-white rounded-full flex items-center justify-center">
                          <span className="text-[#06c755] font-bold text-xs">Q+</span>
                        </div>
                        <span className="text-white font-bold text-sm">Clinic-Q</span>
                      </div>
                      <div className="bg-white rounded-xl p-3">
                        <p className="text-sm font-bold text-gray-900 mb-2">🔔 แจ้งเตือนคิว</p>
                        <p className="text-sm text-gray-700">สวัสดีค่ะ <strong>คุณสมหญิง</strong></p>
                        <p className="text-sm text-gray-700 mt-1">ถึงคิวของคุณแล้วค่ะ!</p>
                        <div className="bg-gray-100 rounded-lg p-2 mt-2">
                          <p className="text-sm"><strong>คิว:</strong> A024</p>
                          <p className="text-sm"><strong>ห้อง:</strong> 3</p>
                          <p className="text-sm"><strong>ผู้ทำหัตถการ:</strong> ทพ.สมชาย</p>
                        </div>
                        <p className="text-xs text-gray-500 mt-2">กรุณาเข้าห้องตรวจภายใน 5 นาที</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="mt-6 pt-6 border-t border-gray-100 flex items-center gap-3">
              <button
                onClick={() => {
                  if (activeTab === 'clinic') handleSaveClinic()
                  else if (activeTab === 'users') showToastMsg('บันทึกข้อมูลผู้ใช้สำเร็จ!', 'success')
                  else if (activeTab === 'qr') showToastMsg('บันทึกการตั้งค่า QR สำเร็จ!', 'success')
                  else if (activeTab === 'tv') showToastMsg('บันทึกการตั้งค่าจอ TV สำเร็จ!', 'success')
                  else if (activeTab === 'line') handleSaveLineSettings()
                }}
                className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-red-500 to-pink-500 hover:from-red-600 hover:to-pink-600 text-white font-bold rounded-xl shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-105"
              >
                <Save className="w-5 h-5" /> บันทึกการตั้งค่า
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
