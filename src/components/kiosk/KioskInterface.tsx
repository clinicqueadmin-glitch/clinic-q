'use client'

import { useState, useMemo } from 'react'
import {
  User, Phone, Search, ChevronRight, CheckCircle, Clock,
  Stethoscope, Sparkles, Heart, Brain, Activity, Bone,
  ArrowLeft, Zap, MapPin, Building2, ChevronLeft,
} from 'lucide-react'
import { clsx } from 'clsx'
import { useClinic } from '@/lib/clinic-context'
import { clinicConfig, type ClinicType } from '@/lib/queue-data'
import {
  getDefaultBranchData,
  findRoomForProcedure,
  getPractitionerName,
  getAllActiveProcedures,
  type Branch,
  type Procedure,
} from '@/lib/branch-data'
import { staffRoles, generateQueueNumber } from '@/lib/booking-data'
import PhoneInput from '@/components/ui/PhoneInput'

type Step = 'info' | 'branch' | 'procedure' | 'confirm' | 'done'

const categoryIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  dental: Activity,
  medical: Stethoscope,
  aesthetic: Sparkles,
  thai: Heart,
  chinese: Brain,
  physical: Bone,
}

const categoryNames: Record<string, string> = {
  dental: 'ทันตกรรม',
  medical: 'เวชกรรม',
  aesthetic: 'เสริมความงาม',
  thai: 'แพทย์แผนไทย',
  chinese: 'แพทย์แผนจีน',
  physical: 'กายภาพบำบัด',
}

export default function KioskInterface() {
  const { config, currentClinic } = useClinic()
  const branchData = useMemo(() => getDefaultBranchData(currentClinic || 'dental'), [currentClinic])

  const [step, setStep] = useState<Step>('info')
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [selectedBranchId, setSelectedBranchId] = useState<string | null>(null)
  const [selectedProcedureId, setSelectedProcedureId] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [result, setResult] = useState<{
    queueNumber: string
    room: number
    doctor: string
    procedure: string
    branch: string
    estimatedTime: string
  } | null>(null)

  // Active branches (with at least one active procedure)
  const activeBranches = useMemo(() => {
    return branchData.branches
      .filter(b => b.active && b.procedures.some(p => p.active))
      .map(b => ({
        ...b,
        activeProcedures: b.procedures.filter(p => p.active),
      }))
  }, [branchData])

  // Procedures for selected branch
  const branchProcedures = useMemo(() => {
    if (!selectedBranchId) return []
    const branch = branchData.branches.find(b => b.id === selectedBranchId)
    return branch?.procedures.filter(p => p.active) || []
  }, [branchData, selectedBranchId])

  // Filtered by search
  const filteredProcedures = useMemo(() => {
    if (!searchQuery) return branchProcedures
    const q = searchQuery.toLowerCase()
    return branchProcedures.filter(p => p.name.toLowerCase().includes(q))
  }, [branchProcedures, searchQuery])

  const selectedBranch = branchData.branches.find(b => b.id === selectedBranchId)
  const selectedProcedure = branchProcedures.find(p => p.id === selectedProcedureId)

  // Get room and practitioner for selected procedure
  const assignment = useMemo(() => {
    if (!selectedProcedureId) return null
    const room = findRoomForProcedure(branchData, selectedProcedureId)
    if (!room) return null
    const practitioner = branchData.practitioners.find(p => p.id === room.practitionerId)
    return { room, practitioner }
  }, [branchData, selectedProcedureId])

  const handleConfirm = () => {
    if (!selectedProcedure || !assignment || !config) return

    const queueNum = generateQueueNumber(config.prefix, currentClinic || 'dental')
    const now = new Date()

    setResult({
      queueNumber: queueNum,
      room: assignment.room.id,
      doctor: assignment.practitioner?.name || 'รอจัดสรร',
      procedure: selectedProcedure.name,
      branch: selectedBranch?.name || '',
      estimatedTime: `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`,
    })
    setStep('done')
  }

  const canProceed = name.trim().length >= 2 && phone.length === 10

  const resetAll = () => {
    setStep('info')
    setName('')
    setPhone('')
    setSelectedBranchId(null)
    setSelectedProcedureId(null)
    setSearchQuery('')
    setResult(null)
  }

  if (!config) return null

  // Step labels
  const steps: { key: Step; label: string; num: number }[] = [
    { key: 'info', label: 'ข้อมูล', num: 1 },
    { key: 'branch', label: 'สาขา', num: 2 },
    { key: 'procedure', label: 'หัตถการ', num: 3 },
    { key: 'confirm', label: 'ยืนยัน', num: 4 },
  ]
  const currentStepIndex = steps.findIndex(s => s.key === step)

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-100">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-white/80 backdrop-blur-lg border-b border-gray-100">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {step !== 'info' && step !== 'done' && (
              <button
                onClick={() => {
                  if (step === 'branch') setStep('info')
                  else if (step === 'procedure') setStep('branch')
                  else if (step === 'confirm') setStep('procedure')
                }}
                className="p-2 hover:bg-gray-100 rounded-lg"
              >
                <ArrowLeft className="w-5 h-5 text-gray-600" />
              </button>
            )}
            <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold" style={{ backgroundColor: config.color }}>
              {config.prefix}
            </div>
            <div>
              <h1 className="text-lg font-bold text-gray-900">ลงทะเบียนรับบริการ</h1>
              <p className="text-xs text-gray-500">{config.name}</p>
            </div>
          </div>
          {/* Step indicator */}
          {step !== 'done' && (
            <div className="flex items-center gap-2">
              {steps.map((s, i) => (
                <div key={s.key} className="flex items-center gap-1">
                  <div className={clsx(
                    'w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold',
                    step === s.key ? 'text-white' : i < currentStepIndex ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-400'
                  )} style={step === s.key ? { backgroundColor: config.color } : {}}>
                    {i < currentStepIndex ? '✓' : s.num}
                  </div>
                  {i < steps.length - 1 && <div className="w-4 h-0.5 bg-gray-200" />}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-8">

        {/* ═══════ STEP 1: Patient Info ═══════ */}
        {step === 'info' && (
          <div className="space-y-6">
            <div className="text-center mb-8">
              <div className="w-20 h-20 rounded-2xl flex items-center justify-center mx-auto mb-4" style={{ backgroundColor: config.bg }}>
                <User className="w-10 h-10" style={{ color: config.color }} />
              </div>
              <h2 className="text-2xl font-bold text-gray-900">กรอกข้อมูลผู้รับบริการ</h2>
              <p className="text-gray-500 mt-1">กรอกชื่อและเบอร์โทรศัพท์เพื่อลงทะเบียน</p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">ชื่อ-นามสกุล</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="กรอกชื่อ-นามสกุล"
                  className="w-full px-5 py-4 text-lg rounded-xl border-2 border-gray-200 focus:border-primary-400 focus:outline-none transition-colors"
                  autoFocus
                />
              </div>
              <PhoneInput
                label="เบอร์โทรศัพท์"
                value={phone}
                onChange={setPhone}
                required
                className="px-5 py-4 text-lg rounded-xl border-2"
              />
            </div>

            <button
              onClick={() => canProceed && setStep('branch')}
              disabled={!canProceed}
              className={clsx(
                'w-full py-4 rounded-xl text-lg font-bold transition-all',
                canProceed ? 'text-white shadow-lg hover:shadow-xl hover:-translate-y-0.5' : 'bg-gray-200 text-gray-400 cursor-not-allowed'
              )}
              style={canProceed ? { backgroundColor: config.color } : {}}
            >
              ถัดไป — เลือกสาขา
            </button>
          </div>
        )}

        {/* ═══════ STEP 2: Select Branch ═══════ */}
        {step === 'branch' && (
          <div className="space-y-6">
            <div className="text-center mb-6">
              <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-3" style={{ backgroundColor: config.bg }}>
                <Building2 className="w-8 h-8" style={{ color: config.color }} />
              </div>
              <h2 className="text-2xl font-bold text-gray-900">เลือกสาขา</h2>
              <p className="text-gray-500 mt-1">เลือกสาขาที่ต้องการรับบริการ</p>
              <p className="text-xs text-gray-400 mt-1">ผู้รับบริการ: {name} • {phone}</p>
            </div>

            <div className="space-y-3">
              {activeBranches.map(branch => {
                const Icon = categoryIcons[branch.category] || Stethoscope
                const branchRooms = branchData.rooms.filter(r => r.branchId === branch.id && r.active)
                const branchPractitioners = branchData.practitioners.filter(p => p.branchId === branch.id && p.active)
                const isSelected = selectedBranchId === branch.id

                return (
                  <button
                    key={branch.id}
                    onClick={() => {
                      setSelectedBranchId(branch.id)
                      setSelectedProcedureId(null)
                    }}
                    className={clsx(
                      'w-full p-5 rounded-xl border-2 text-left transition-all',
                      isSelected
                        ? 'border-primary-500 bg-primary-50 shadow-md'
                        : 'border-gray-100 hover:border-gray-200 hover:shadow-sm bg-white'
                    )}
                  >
                    <div className="flex items-start gap-4">
                      <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
                        style={{ backgroundColor: isSelected ? `${config.color}20` : '#F3F4F6' }}>
                        <span className="w-6 h-6 flex items-center justify-center" style={{ color: isSelected ? config.color : '#9CA3AF' }}><Icon className="w-6 h-6" /></span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-gray-900 text-lg">{branch.name}</p>
                        <p className="text-sm text-gray-500 mt-0.5">
                          {branch.activeProcedures.length} หัตถการ
                        </p>
                        <div className="flex flex-wrap gap-1.5 mt-2">
                          {branch.activeProcedures.slice(0, 4).map(proc => (
                            <span key={proc.id} className="text-[11px] px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
                              {proc.name}
                            </span>
                          ))}
                          {branch.activeProcedures.length > 4 && (
                            <span className="text-[11px] px-2 py-0.5 rounded-full bg-gray-100 text-gray-400">
                              +{branch.activeProcedures.length - 4}
                            </span>
                          )}
                        </div>
                        {/* Show practitioners */}
                        {branchPractitioners.length > 0 && (
                          <div className="flex flex-wrap gap-1.5 mt-2">
                            {branchPractitioners.map(p => (
                              <span key={p.id} className="text-[11px] px-2 py-0.5 rounded-full font-medium" style={{ backgroundColor: `${config.color}10`, color: config.color }}>
                                🩺 {p.name.split(' ').slice(0, 2).join(' ')}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                      <div className="flex-shrink-0 mt-1">
                        <ChevronRight className={clsx('w-5 h-5 transition-colors', isSelected ? 'text-primary-500' : 'text-gray-300')} />
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>

            <button
              onClick={() => selectedBranchId && setStep('procedure')}
              disabled={!selectedBranchId}
              className={clsx(
                'w-full py-4 rounded-xl text-lg font-bold transition-all',
                selectedBranchId ? 'text-white shadow-lg hover:shadow-xl' : 'bg-gray-200 text-gray-400 cursor-not-allowed'
              )}
              style={selectedBranchId ? { backgroundColor: config.color } : {}}
            >
              ถัดไป — เลือกหัตถการ
            </button>
          </div>
        )}

        {/* ═══════ STEP 3: Select Procedure ═══════ */}
        {step === 'procedure' && (
          <div className="space-y-6">
            <div className="text-center mb-6">
              <h2 className="text-2xl font-bold text-gray-900">เลือกหัตถการ</h2>
              <p className="text-gray-500 mt-1">{selectedBranch?.name}</p>
              <div className="flex items-center justify-center gap-2 mt-2">
                <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
                  👤 {name}
                </span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
                  📞 {phone}
                </span>
              </div>
            </div>

            {/* Search */}
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="ค้นหาหัตถการ..."
                className="w-full pl-12 pr-4 py-3 rounded-xl border-2 border-gray-200 focus:border-primary-400 focus:outline-none text-lg"
              />
            </div>

            {/* Procedures Grid */}
            <div className="grid grid-cols-2 gap-3">
              {filteredProcedures.map(proc => (
                <button
                  key={proc.id}
                  onClick={() => setSelectedProcedureId(proc.id)}
                  className={clsx(
                    'p-4 rounded-xl border-2 text-left transition-all',
                    selectedProcedureId === proc.id
                      ? 'border-primary-500 bg-primary-50 shadow-md'
                      : 'border-gray-100 hover:border-gray-200 hover:shadow-sm bg-white'
                  )}
                >
                  <p className="font-medium text-gray-900">{proc.name}</p>
                  <p className="text-xs text-gray-500 mt-1">~{proc.estimatedDuration} นาที</p>
                </button>
              ))}
            </div>

            {filteredProcedures.length === 0 && (
              <div className="text-center py-8 text-gray-400">
                <p>ไม่พบหัตถการที่ค้นหา</p>
              </div>
            )}

            <button
              onClick={() => selectedProcedureId && setStep('confirm')}
              disabled={!selectedProcedureId}
              className={clsx(
                'w-full py-4 rounded-xl text-lg font-bold transition-all',
                selectedProcedureId ? 'text-white shadow-lg hover:shadow-xl' : 'bg-gray-200 text-gray-400 cursor-not-allowed'
              )}
              style={selectedProcedureId ? { backgroundColor: config.color } : {}}
            >
              ถัดไป — ยืนยัน
            </button>
          </div>
        )}

        {/* ═══════ STEP 4: Confirm ═══════ */}
        {step === 'confirm' && selectedProcedure && selectedBranch && assignment && (
          <div className="space-y-6">
            <div className="text-center mb-6">
              <h2 className="text-2xl font-bold text-gray-900">ยืนยันข้อมูล</h2>
              <p className="text-gray-500 mt-1">ตรวจสอบข้อมูลก่อนลงทะเบียน</p>
            </div>

            <div className="bg-white rounded-2xl border border-gray-100 p-6 space-y-4">
              <div className="flex items-center gap-3 pb-4 border-b border-gray-100">
                <div className="w-10 h-10 rounded-full flex items-center justify-center bg-blue-50"><User className="w-5 h-5 text-blue-500" /></div>
                <div><p className="text-xs text-gray-500">ผู้รับบริการ</p><p className="font-semibold text-gray-900">{name}</p></div>
              </div>
              <div className="flex items-center gap-3 pb-4 border-b border-gray-100">
                <div className="w-10 h-10 rounded-full flex items-center justify-center bg-green-50"><Phone className="w-5 h-5 text-green-500" /></div>
                <div><p className="text-xs text-gray-500">เบอร์โทรศัพท์</p><p className="font-semibold text-gray-900">{phone}</p></div>
              </div>
              <div className="flex items-center gap-3 pb-4 border-b border-gray-100">
                <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ backgroundColor: `${config.color}15` }}><Building2 className="w-5 h-5" style={{ color: config.color }} /></div>
                <div><p className="text-xs text-gray-500">สาขา</p><p className="font-semibold text-gray-900">{selectedBranch.name}</p></div>
              </div>
              <div className="flex items-center gap-3 pb-4 border-b border-gray-100">
                <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ backgroundColor: `${config.color}15` }}><Zap className="w-5 h-5" style={{ color: config.color }} /></div>
                <div><p className="text-xs text-gray-500">หัตถการ</p><p className="font-semibold text-gray-900">{selectedProcedure.name} (~{selectedProcedure.estimatedDuration} นาที)</p></div>
              </div>
              <div className="flex items-center gap-3 pb-4 border-b border-gray-100">
                <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ backgroundColor: `${assignment.room.color}20` }}>
                  <span className="text-sm font-bold" style={{ color: assignment.room.color }}>{assignment.room.id}</span>
                </div>
                <div><p className="text-xs text-gray-500">ห้องตรวจ</p><p className="font-semibold text-gray-900">{assignment.room.name}</p></div>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full flex items-center justify-center bg-purple-50"><Stethoscope className="w-5 h-5 text-purple-500" /></div>
                <div><p className="text-xs text-gray-500">ผู้ทำหัตถการ</p><p className="font-semibold text-gray-900">{assignment.practitioner?.name || 'รอจัดสรร'}</p></div>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-yellow-50 border border-yellow-200">
              <p className="text-sm text-yellow-800">
                <strong>หมายเหตุ:</strong> ระบบจัดห้องและผู้ทำหัตถการตามสาขาที่เลือกอัตโนมัติ
              </p>
            </div>

            <button
              onClick={handleConfirm}
              className="w-full py-4 rounded-xl text-lg font-bold text-white shadow-lg hover:shadow-xl transition-all"
              style={{ backgroundColor: config.color }}
            >
              ลงทะเบียน — รับคิว
            </button>
          </div>
        )}

        {/* ═══════ DONE: Result ═══════ */}
        {step === 'done' && result && (
          <div className="text-center space-y-6">
            <div className="animate-bounce">
              <CheckCircle className="w-20 h-20 mx-auto" style={{ color: config.color }} />
            </div>
            <div>
              <h2 className="text-3xl font-bold text-gray-900">ลงทะเบียนสำเร็จ!</h2>
              <p className="text-gray-500 mt-1">กรุณารอเรียกคิว</p>
            </div>

            {/* Queue Number */}
            <div className="bg-white rounded-2xl border-2 p-8" style={{ borderColor: config.color }}>
              <p className="text-sm text-gray-500 mb-2">หมายเลขคิวของคุณ</p>
              <p className="text-6xl font-bold" style={{ color: config.color }}>{result.queueNumber}</p>
            </div>

            {/* Details */}
            <div className="bg-white rounded-2xl border border-gray-100 p-6 space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-gray-500">สาขา</span>
                <span className="font-medium text-gray-900">{result.branch}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-500">หัตถการ</span>
                <span className="font-medium text-gray-900">{result.procedure}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-500">ห้องตรวจ</span>
                <span className="font-bold" style={{ color: config.color }}>ห้อง {result.room}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-500">แพทย์/ผู้ทำหัตถการ</span>
                <span className="font-medium text-gray-900">{result.doctor}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-500">เวลาลงทะเบียน</span>
                <span className="font-medium text-gray-900">{result.estimatedTime}</span>
              </div>
            </div>

            <p className="text-sm text-gray-400">กรุณาฟังเสียงเรียกคิว หรือดูจอ TV แสดงคิว</p>

            <button
              onClick={resetAll}
              className="w-full py-4 rounded-xl text-lg font-bold text-white"
              style={{ backgroundColor: config.color }}
            >
              ลงทะเบียนคนไข้ถัดไป
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
