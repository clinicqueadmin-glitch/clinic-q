'use client'

import { useState, useMemo, useEffect } from 'react'
import {
  MapPin, Search, CheckCircle, XCircle, Phone, User,
  Stethoscope, Sparkles, Heart, Brain, Activity, Bone,
  Clock, AlertTriangle, Navigation,
} from 'lucide-react'
import { clsx } from 'clsx'
import { procedures, findBestRoom, generateQueueNumber, CLINIC_LOCATION, MAX_DISTANCE_METERS, checkDistance } from '@/lib/booking-data'

type BookingStep = 'location' | 'info' | 'procedure' | 'done'
type LocationStatus = 'checking' | 'near' | 'far' | 'error' | 'denied'

const categoryIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  dental: Activity, medical: Stethoscope, aesthetic: Sparkles,
  thai: Heart, chinese: Brain, physical: Bone,
}
const categoryNames: Record<string, string> = {
  dental: 'ทันตกรรม', medical: 'เวชกรรม', aesthetic: 'เสริมความงาม',
  thai: 'แพทย์แผนไทย', chinese: 'แพทย์แผนจีน', physical: 'กายภาพบำบัด',
}

export default function RemoteBooking() {
  const [step, setStep] = useState<BookingStep>('location')
  const [locationStatus, setLocationStatus] = useState<LocationStatus>('checking')
  const [distance, setDistance] = useState<number | null>(null)
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [selectedProcedure, setSelectedProcedure] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [result, setResult] = useState<{ queueNumber: string; room: number; doctor: string; procedure: string } | null>(null)

  // Get max distance from settings
  const maxDistance = useMemo(() => {
    if (typeof window !== 'undefined') {
      return parseInt(localStorage.getItem('clinic-booking-distance') || '500')
    }
    return 500
  }, [])

  // Check geolocation
  useEffect(() => {
    if (!navigator.geolocation) {
      setLocationStatus('error')
      return
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const d = checkDistance(
          pos.coords.latitude, pos.coords.longitude,
          CLINIC_LOCATION.lat, CLINIC_LOCATION.lng
        )
        setDistance(Math.round(d))
        setLocationStatus(d <= maxDistance ? 'near' : 'far')
      },
      () => {
        setLocationStatus('denied')
      },
      { enableHighAccuracy: true, timeout: 10000 }
    )
  }, [maxDistance])

  const groupedProcedures = useMemo(() => {
    const groups: Record<string, typeof procedures> = {}
    procedures.forEach(p => {
      if (!groups[p.category]) groups[p.category] = []
      groups[p.category].push(p)
    })
    return groups
  }, [])

  const filteredBySearch = useMemo(() => {
    if (!searchQuery) return groupedProcedures
    const q = searchQuery.toLowerCase()
    const filtered: Record<string, typeof procedures> = {}
    Object.entries(groupedProcedures).forEach(([cat, procs]) => {
      const match = procs.filter(p => p.name.includes(q))
      if (match.length > 0) filtered[cat] = match
    })
    return filtered
  }, [groupedProcedures, searchQuery])

  const selectedProc = procedures.find(p => p.id === selectedProcedure)

  const handleBook = () => {
    if (!selectedProc) return
    const assignment = findBestRoom(selectedProc.id, [])
    const queueNum = generateQueueNumber('Q', selectedProc.category)
    setResult({
      queueNumber: queueNum,
      room: assignment?.roomId || 1,
      doctor: 'รอจัดสรร',
      procedure: selectedProc.name,
    })
    setStep('done')
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-100">
      <div className="max-w-lg mx-auto px-4 py-6">

        {/* ═══════ LOCATION CHECK ═══════ */}
        {step === 'location' && (
          <div className="text-center space-y-6 pt-12">
            <div className="w-20 h-20 rounded-full bg-blue-100 flex items-center justify-center mx-auto">
              <MapPin className="w-10 h-10 text-blue-500" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">จองคิวออนไลน์</h1>
              <p className="text-gray-500 mt-1">ตรวจสอบตำแหน่งของคุณ...</p>
            </div>

            {locationStatus === 'checking' && (
              <div className="space-y-4">
                <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto" />
                <p className="text-gray-500">กำลังตรวจสอบระยะทาง...</p>
              </div>
            )}

            {locationStatus === 'near' && (
              <div className="space-y-4">
                <CheckCircle className="w-16 h-16 text-green-500 mx-auto" />
                <div>
                  <h2 className="text-xl font-bold text-green-700">อยู่ใกล้คลินิก</h2>
                  <p className="text-gray-600 mt-1">ระยะทาง ~{distance} เมตร</p>
                </div>
                <button onClick={() => setStep('info')} className="w-full py-4 bg-emerald-600 text-white rounded-xl text-lg font-bold hover:bg-emerald-700 shadow-md">
                  จองคิวเลย
                </button>
              </div>
            )}

            {locationStatus === 'far' && (
              <div className="space-y-4">
                <XCircle className="w-16 h-16 text-red-500 mx-auto" />
                <div>
                  <h2 className="text-xl font-bold text-red-700">อยู่ไกลเกินไป</h2>
                  <p className="text-gray-600 mt-1">ระยะทาง ~{distance} เมตร (เกิน {maxDistance} เมตร)</p>
                </div>
                <div className="p-4 bg-red-50 rounded-xl">
                  <p className="text-sm text-red-700">
                    คุณต้องอยู่ใกล้คลินิกไม่เกิน {maxDistance} เมตร เพื่อจองคิวออนไลน์<br />
                    กรุณาเดินทางมาที่คลินิก หรือโทรจองคิวแทน
                  </p>
                </div>
              </div>
            )}

            {(locationStatus === 'error' || locationStatus === 'denied') && (
              <div className="space-y-4">
                <AlertTriangle className="w-16 h-16 text-yellow-500 mx-auto" />
                <div>
                  <h2 className="text-xl font-bold text-yellow-700">เปิดใช้งาน GPS</h2>
                  <p className="text-gray-600 mt-1">กรุณาเปิด GPS บนมือถือของคุณ</p>
                </div>
                <button onClick={() => window.location.reload()} className="w-full py-4 bg-gray-800 text-white rounded-xl text-lg font-bold">
                  ลองใหม่
                </button>
              </div>
            )}
          </div>
        )}

        {/* ═══════ PATIENT INFO ═══════ */}
        {step === 'info' && (
          <div className="space-y-6">
            <div className="text-center mb-6">
              <h2 className="text-2xl font-bold text-gray-900">กรอกข้อมูล</h2>
              <p className="text-gray-500 mt-1">ชื่อและเบอร์โทรศัพท์</p>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">ชื่อ-นามสกุล</label>
                <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="กรอกชื่อ-นามสกุล" className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-blue-400 focus:outline-none" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">เบอร์โทรศัพท์</label>
                <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="0xx-xxx-xxxx" className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-blue-400 focus:outline-none" />
              </div>
            </div>
            <button
              onClick={() => name.trim().length >= 2 && phone.trim().length >= 9 && setStep('procedure')}
              disabled={!(name.trim().length >= 2 && phone.trim().length >= 9)}
              className={clsx(
                'w-full py-4 rounded-xl text-lg font-bold transition-all shadow-sm',
                name.trim().length >= 2 && phone.trim().length >= 9 ? 'bg-blue-600 text-white hover:bg-blue-700' : 'bg-gray-100 text-gray-300 cursor-not-allowed'
              )}
            >
              ถัดไป
            </button>
          </div>
        )}

        {/* ═══════ PROCEDURE SELECTION ═══════ */}
        {step === 'procedure' && (
          <div className="space-y-6">
            <div className="text-center mb-4">
              <h2 className="text-2xl font-bold text-gray-900">เลือกหัตถการ</h2>
            </div>
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="ค้นหา..." className="w-full pl-12 pr-4 py-3 rounded-xl border-2 border-gray-200 focus:border-blue-400 focus:outline-none" />
            </div>
            <div className="space-y-5">
              {Object.entries(filteredBySearch).map(([cat, procs]) => {
                const Icon = categoryIcons[cat] || Stethoscope
                return (
                  <div key={cat}>
                    <div className="flex items-center gap-2 mb-2">
                      <Icon className="w-4 h-4 text-gray-500" />
                      <h3 className="text-sm font-semibold text-gray-600">{categoryNames[cat] || cat}</h3>
                    </div>
                    <div className="space-y-2">
                      {procs.map(proc => (
                        <button key={proc.id} onClick={() => setSelectedProcedure(proc.id)}
                          className={clsx('w-full p-3 rounded-xl border-2 text-left transition-all flex items-center justify-between',
                            selectedProcedure === proc.id ? 'border-blue-500 bg-blue-50' : 'border-gray-100 hover:border-gray-200'
                          )}>
                          <div><p className="font-medium text-gray-900 text-sm">{proc.name}</p><p className="text-xs text-gray-500">~{proc.estimatedDuration} นาที</p></div>
                          {selectedProcedure === proc.id && <CheckCircle className="w-5 h-5 text-blue-500" />}
                        </button>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
            <button onClick={handleBook} disabled={!selectedProcedure}
              className={clsx('w-full py-4 rounded-xl text-lg font-bold shadow-sm',
                selectedProcedure ? 'bg-blue-600 text-white hover:bg-blue-700' : 'bg-gray-100 text-gray-300 cursor-not-allowed'
              )}>
              จองคิว
            </button>
          </div>
        )}

        {/* ═══════ DONE ═══════ */}
        {step === 'done' && result && (
          <div className="text-center space-y-6 pt-8">
            <CheckCircle className="w-20 h-20 text-green-500 mx-auto" />
            <h2 className="text-2xl font-bold text-gray-900">จองคิวสำเร็จ!</h2>
            <div className="bg-white rounded-2xl border-2 border-green-500 p-6">
              <p className="text-sm text-gray-500">หมายเลขคิว</p>
              <p className="text-5xl font-bold text-green-600">{result.queueNumber}</p>
            </div>
            <div className="bg-white rounded-xl border border-gray-100 p-4 space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-gray-500">หัตถการ</span><span className="font-medium">{result.procedure}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">ห้อง</span><span className="font-bold text-blue-600">ห้อง {result.room}</span></div>
            </div>
            <p className="text-xs text-gray-400">กรุณาเดินทางมาที่คลินิกและรอเรียกคิว</p>
          </div>
        )}
      </div>
    </div>
  )
}
