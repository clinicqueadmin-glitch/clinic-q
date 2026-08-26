'use client'

import { QRCodeSVG } from 'qrcode.react'
import { X, Copy, Check, ExternalLink } from 'lucide-react'
import { useState } from 'react'
import { clsx } from 'clsx'
import type { QueueItem, ClinicType } from '@/lib/queue-data'
import { clinicConfig } from '@/lib/queue-data'

interface QRCodeCardProps {
  queue: QueueItem
  onClose: () => void
}

export default function QRCodeCard({ queue, onClose }: QRCodeCardProps) {
  const [copied, setCopied] = useState(false)
  const clinic = clinicConfig[queue.clinicType]
  
  const trackUrl = typeof window !== 'undefined' 
    ? `${window.location.origin}/track?id=${queue.id}` 
    : `/track?id=${queue.id}`

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(trackUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Fallback
      const input = document.createElement('input')
      input.value = trackUrl
      document.body.appendChild(input)
      input.select()
      document.execCommand('copy')
      document.body.removeChild(input)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const handleOpenLink = () => {
    window.open(trackUrl, '_blank')
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div
        className="bg-white rounded-2xl shadow-2xl max-w-sm w-full overflow-hidden animate-in"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className="px-5 py-4 flex items-center justify-between"
          style={{ backgroundColor: clinic.bg }}
        >
          <div className="flex items-center gap-2">
            <span className="text-xl">{clinic.icon}</span>
            <div>
              <p className="font-bold" style={{ color: clinic.color }}>
                คิว {queue.number}
              </p>
              <p className="text-xs text-gray-500">{queue.patientName}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-white/60 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* QR Code */}
        <div className="p-6 flex flex-col items-center">
          <div className="bg-white p-3 rounded-xl border-2 border-gray-100 shadow-inner mb-4">
            <QRCodeSVG
              value={trackUrl}
              size={180}
              bgColor="#ffffff"
              fgColor={clinic.color}
              level="M"
              includeMargin={false}
              imageSettings={{
                src: '',
                height: 24,
                width: 24,
                excavate: true,
              }}
            />
          </div>
          
          <p className="text-sm text-gray-500 text-center mb-1">
            สแกน QR Code ด้วยมือถือ
          </p>
          <p className="text-xs text-gray-400 text-center">
            เพื่อตรวจสอบสถานะคิวแบบ real-time
          </p>
        </div>

        {/* Queue Info */}
        <div className="px-6 pb-4">
          <div className="bg-gray-50 rounded-xl p-3 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">หมายเลขคิว</span>
              <span className="font-mono font-bold text-gray-900">{queue.number}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">ประเภทคลินิก</span>
              <span className="text-gray-700">{clinic.name}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">เวลานัด</span>
              <span className="text-gray-700">{queue.time}</span>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="px-6 pb-5 flex gap-3">
          <button
            onClick={handleCopyLink}
            className={clsx(
              'flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-medium text-sm transition-all',
              copied
                ? 'bg-green-100 text-green-700'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            )}
          >
            {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            {copied ? 'คัดลอกแล้ว!' : 'คัดลอกลิงก์'}
          </button>
          <button
            onClick={handleOpenLink}
            className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-medium text-sm bg-primary-500 text-white hover:bg-primary-600 transition-all"
          >
            <ExternalLink className="w-4 h-4" />
            เปิดลิงก์
          </button>
        </div>
      </div>

      <style jsx>{`
        .animate-in {
          animation: slideUp 0.3s ease-out forwards;
        }
        @keyframes slideUp {
          from {
            opacity: 0;
            transform: translateY(20px) scale(0.95);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }
      `}</style>
    </div>
  )
}
