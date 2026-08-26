'use client'

import { Clock, CheckCircle, Users, MoreVertical } from 'lucide-react'
import { clsx } from 'clsx'

interface QueueItem {
  id: string
  number: string
  patientName: string
  clinicType: string
  status: 'waiting' | 'serving' | 'completed'
  time: string
}

const queueData: QueueItem[] = [
  { id: '1', number: 'A024', patientName: 'สมชาย ใจดี', clinicType: 'คลินิกเวชกรรม', status: 'serving', time: '09:30' },
  { id: '2', number: 'B018', patientName: 'สมหญิง รักสวย', clinicType: 'คลินิกเสริมความงาม', status: 'serving', time: '09:45' },
  { id: '3', number: 'A025', patientName: 'วิชัย มั่นคง', clinicType: 'คลินิกเวชกรรม', status: 'waiting', time: '10:00' },
  { id: '4', number: 'C012', patientName: 'ธนากร เจริญสุข', clinicType: 'แพทย์แผนไทย', status: 'waiting', time: '10:15' },
  { id: '5', number: 'D008', patientName: 'พิมพ์ใจ สดใส', clinicType: 'แพทย์แผนจีน', status: 'completed', time: '08:30' },
  { id: '6', number: 'E022', patientName: 'กมล ยิ้มแย้ม', clinicType: 'คลินิกทันตกรรม', status: 'serving', time: '10:30' },
]

const statusConfig = {
  waiting: { label: 'กำลังรอ', class: 'status-waiting' },
  serving: { label: 'กำลังให้บริการ', class: 'status-serving' },
  completed: { label: 'เสร็จสิ้น', class: 'status-completed' },
}

const clinicColors = {
  'คลินิกเวชกรรม': 'bg-green-100 text-green-700',
  'คลินิกเสริมความงาม': 'bg-pink-100 text-pink-700',
  'แพทย์แผนไทย': 'bg-yellow-100 text-yellow-700',
  'แพทย์แผนจีน': 'bg-orange-100 text-orange-700',
  'คลินิกทันตกรรม': 'bg-purple-100 text-purple-700',
  'คลินิกกายภาพบำบัด': 'bg-blue-100 text-blue-700',
}

export default function QueueOverview() {
  return (
    <div className="card">
      <div className="p-6 border-b border-gray-100">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">คิวปัจจุบัน</h2>
            <p className="text-sm text-gray-500">รายการคิวล่าสุดในระบบ</p>
          </div>
          <button className="p-2 hover:bg-gray-100 rounded-lg">
            <MoreVertical className="w-5 h-5 text-gray-500" />
          </button>
        </div>
      </div>
      
      <div className="divide-y divide-gray-100">
        {queueData.map((item) => (
          <div 
            key={item.id} 
            className="p-4 hover:bg-gray-50 transition-colors cursor-pointer"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className={clsx(
                  'w-14 h-14 rounded-xl flex flex-col items-center justify-center font-bold',
                  item.status === 'serving' ? 'bg-green-500 text-white' :
                  item.status === 'waiting' ? 'bg-primary-100 text-primary-600' :
                  'bg-gray-100 text-gray-500'
                )}>
                  <span className="text-lg leading-none">{item.number.charAt(0)}</span>
                  <span className="text-xs">{item.number.slice(1)}</span>
                </div>
                <div>
                  <p className="font-medium text-gray-900">{item.patientName}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className={clsx(
                      'clinic-type-badge text-xs',
                      clinicColors[item.clinicType as keyof typeof clinicColors]
                    )}>
                      {item.clinicType}
                    </span>
                    <span className="text-xs text-gray-500">{item.time}</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className={clsx(
                  'queue-status',
                  statusConfig[item.status].class
                )}>
                  {statusConfig[item.status].label}
                </span>
                {item.status === 'waiting' && (
                  <button className="btn-primary text-sm py-1 px-3">
                    เรียกคิว
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="p-4 border-t border-gray-100">
        <button className="w-full text-center text-primary-500 hover:text-primary-600 font-medium text-sm">
          ดูคิวทั้งหมด →
        </button>
      </div>
    </div>
  )
}
