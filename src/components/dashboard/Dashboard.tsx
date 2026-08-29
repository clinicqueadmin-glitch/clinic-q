'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { 
  Users, 
  Clock, 
  CheckCircle, 
  TrendingUp,
  X,
} from 'lucide-react'
import { useClinic } from '@/lib/clinic-context'
import { clinicConfig, type ClinicType, initialQueue } from '@/lib/queue-data'
import Toast from '@/components/ui/Toast'
import PhoneInput from '@/components/ui/PhoneInput'

type CreateClinicType = 'medical' | 'aesthetic' | 'thai' | 'chinese' | 'dental' | 'physical'

export default function Dashboard() {
  const router = useRouter()
  const { currentClinic, config } = useClinic()
  const [showCreateQueue, setShowCreateQueue] = useState(false)
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null)

  // Filter queue data by current clinic
  const clinicQueue = useMemo(() => {
    return initialQueue.filter(q => q.clinicType === currentClinic)
  }, [currentClinic])

  const stats = useMemo(() => {
    const waiting = clinicQueue.filter(q => q.status === 'waiting').length
    const serving = clinicQueue.filter(q => q.status === 'serving').length
    const completed = clinicQueue.filter(q => q.status === 'completed').length
    return { waiting, serving, completed, total: clinicQueue.length }
  }, [clinicQueue])

  // Create queue form
  const [createForm, setCreateForm] = useState({
    patientName: '',
    phone: '',
    service: '',
    doctor: '',
  })

  const showToastMsg = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToast({ message, type })
    setTimeout(() => setToast(null), 3000)
  }

  const handleExportReport = () => {
    if (!config) return
    const csvContent = [
      `รายงานคิว ${config.name} - วันที่ ${new Date().toLocaleDateString('th-TH')}`,
      '',
      'สรุป',
      `คิวที่กำลังรอ,${stats.waiting}`,
      `กำลังให้บริการ,${stats.serving}`,
      `เสร็จสิ้น,${stats.completed}`,
      '',
      'รายการคิว',
      'หมายเลข,ชื่อผู้รับบริการ,สถานะ,เวลา',
      ...clinicQueue.map(q => `${q.number},${q.patientName},${q.status === 'waiting' ? 'กำลังรอ' : q.status === 'serving' ? 'กำลังให้บริการ' : 'เสร็จสิ้น'},${q.time}`),
    ].join('\n')

    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `${config.nameEn}-report-${new Date().toISOString().slice(0, 10)}.csv`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
    showToastMsg('ส่งออกรายงานสำเร็จ!', 'success')
  }

  const handleCreateQueue = () => {
    if (!createForm.patientName || createForm.phone.length !== 10) {
      showToastMsg('กรุณากรอกชื่อและเบอร์โทรศัพท์ 10 หลัก', 'error')
      return
    }
    showToastMsg(`สร้างคิวสำหรับ ${createForm.patientName} สำเร็จ!`, 'success')
    setShowCreateQueue(false)
    setCreateForm({ patientName: '', phone: '', service: '', doctor: '' })
  }

  if (!config) return null

  return (
    <div className="space-y-6">
      {/* Toast */}
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      {/* Create Queue Modal */}
      {showCreateQueue && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg">
            <div className="flex items-center justify-between p-6 border-b border-gray-100">
              <h2 className="text-xl font-bold text-gray-900">สร้างคิวใหม่</h2>
              <button onClick={() => setShowCreateQueue(false)} className="p-2 hover:bg-gray-100 rounded-lg">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">ชื่อผู้รับบริการ *</label>
                <input
                  type="text"
                  value={createForm.patientName}
                  onChange={(e) => setCreateForm({ ...createForm, patientName: e.target.value })}
                  placeholder="กรอกชื่อ-นามสกุล"
                  className="input-field"
                />
              </div>
              <PhoneInput
                label="เบอร์โทรศัพท์"
                value={createForm.phone}
                onChange={(v) => setCreateForm({ ...createForm, phone: v })}
                required
              />
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">บริการที่ต้องการ</label>
                <input
                  type="text"
                  value={createForm.service}
                  onChange={(e) => setCreateForm({ ...createForm, service: e.target.value })}
                  placeholder="เช่น ตรวจสุขภาพ, ฉีดวัคซีน"
                  className="input-field"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">แพทย์</label>
                <input
                  type="text"
                  value={createForm.doctor}
                  onChange={(e) => setCreateForm({ ...createForm, doctor: e.target.value })}
                  placeholder="เช่น นพ.วิชัย"
                  className="input-field"
                />
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-100">
              <button onClick={() => setShowCreateQueue(false)} className="btn-secondary">
                ยกเลิก
              </button>
              <button onClick={handleCreateQueue} className="btn-primary">สร้างคิว</button>
            </div>
          </div>
        </div>
      )}

      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold text-lg"
              style={{ backgroundColor: config.color }}
            >
              {config.prefix}
            </div>
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-gray-900">แดชบอร์ด</h1>
              <p className="text-gray-500">{config.name}</p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={handleExportReport} className="btn-secondary flex items-center gap-2">
            ส่งออกรายงาน
          </button>
          <button onClick={() => setShowCreateQueue(true)} className="btn-primary flex items-center gap-2">
            + สร้างคิวใหม่
          </button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="card p-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-yellow-50">
              <Clock className="w-5 h-5 text-yellow-500" />
            </div>
            <div>
              <p className="text-sm text-gray-500">กำลังรอ</p>
              <p className="text-2xl font-bold text-gray-900">{stats.waiting}</p>
            </div>
          </div>
        </div>
        <div className="card p-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-green-50">
              <Users className="w-5 h-5 text-green-500" />
            </div>
            <div>
              <p className="text-sm text-gray-500">กำลังให้บริการ</p>
              <p className="text-2xl font-bold text-gray-900">{stats.serving}</p>
            </div>
          </div>
        </div>
        <div className="card p-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: config.bg }}>
              <CheckCircle className="w-5 h-5" style={{ color: config.color }} />
            </div>
            <div>
              <p className="text-sm text-gray-500">เสร็จสิ้น</p>
              <p className="text-2xl font-bold text-gray-900">{stats.completed}</p>
            </div>
          </div>
        </div>
        <div className="card p-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-blue-50">
              <TrendingUp className="w-5 h-5 text-blue-500" />
            </div>
            <div>
              <p className="text-sm text-gray-500">เวลาเฉลี่ยรอ</p>
              <p className="text-2xl font-bold text-gray-900">15 นาที</p>
            </div>
          </div>
        </div>
      </div>

      {/* Current Queue */}
      <div className="card">
        <div className="p-6 border-b border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">คิวปัจจุบัน</h2>
              <p className="text-sm text-gray-500">{config.name} • {clinicQueue.length} คิว</p>
            </div>
            <button
              onClick={() => router.push('/queue')}
              className="text-sm font-medium hover:underline"
              style={{ color: config.color }}
            >
              ดูทั้งหมด →
            </button>
          </div>
        </div>
        <div className="divide-y divide-gray-100">
          {clinicQueue.slice(0, 5).map((item) => (
            <div key={item.id} className="p-4 md:px-6 flex items-center justify-between hover:bg-gray-50">
              <div className="flex items-center gap-4">
                <div
                  className="w-14 h-14 rounded-xl flex flex-col items-center justify-center font-bold text-white"
                  style={{
                    backgroundColor: item.status === 'serving' ? config.color :
                      item.status === 'waiting' ? config.bg : '#E2E8F0',
                    color: item.status === 'completed' ? '#64748B' : item.status === 'waiting' ? config.color : '#FFF',
                  }}
                >
                  <span className="text-lg leading-none">{item.number.charAt(0)}</span>
                  <span className="text-xs">{item.number.slice(1)}</span>
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">{item.patientName}</h3>
                  <div className="flex items-center gap-3 mt-1 text-sm text-gray-500">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5" /> {item.time}
                    </span>
                    {item.doctor && <span>{item.doctor}</span>}
                  </div>
                </div>
              </div>
              <span
                className="px-3 py-1 rounded-full text-xs font-medium"
                style={{
                  backgroundColor: item.status === 'serving' ? `${config.color}20` :
                    item.status === 'waiting' ? '#FEF3C7' : '#F1F5F9',
                  color: item.status === 'serving' ? config.color :
                    item.status === 'waiting' ? '#D97706' : '#64748B',
                }}
              >
                {item.status === 'waiting' ? 'กำลังรอ' : item.status === 'serving' ? 'กำลังให้บริการ' : 'เสร็จสิ้น'}
              </span>
            </div>
          ))}
          {clinicQueue.length === 0 && (
            <div className="p-12 text-center">
              <Clock className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500">ยังไม่มีคิวใน {config.name}</p>
              <button
                onClick={() => setShowCreateQueue(true)}
                className="mt-4 btn-primary"
                style={{ backgroundColor: config.color }}
              >
                สร้างคิวแรก
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <button
          onClick={() => setShowCreateQueue(true)}
          className="card p-6 hover-lift cursor-pointer text-left"
        >
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ backgroundColor: config.bg }}>
              <Clock className="w-6 h-6" style={{ color: config.color }} />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">สร้างคิวใหม่</h3>
              <p className="text-sm text-gray-500">เพิ่มคิวใน {config.name}</p>
            </div>
          </div>
        </button>
        <button
          onClick={() => router.push('/patients')}
          className="card p-6 hover-lift cursor-pointer text-left"
        >
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center">
              <Users className="w-6 h-6 text-green-600" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">ผู้รับบริการ</h3>
              <p className="text-sm text-gray-500">จัดการข้อมูลผู้รับบริการ</p>
            </div>
          </div>
        </button>
        <button
          onClick={() => router.push('/analytics')}
          className="card p-6 hover-lift cursor-pointer text-left"
        >
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
              <TrendingUp className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">วิเคราะห์ข้อมูล</h3>
              <p className="text-sm text-gray-500">สถิติและรายงาน</p>
            </div>
          </div>
        </button>
      </div>
    </div>
  )
}
