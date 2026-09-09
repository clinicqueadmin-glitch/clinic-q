'use client'

import { CheckCircle2, XCircle, RotateCcw } from 'lucide-react'
import { clsx } from 'clsx'

interface SaveResultModalProps {
  success: boolean
  onClose: () => void
  onRetry?: () => void
}

/**
 * Save-result popup shown ONLY after the backend/DB has confirmed the outcome.
 * - success → ✅ บันทึกสำเร็จ  [ตกลง]
 * - failure → ❌ บันทึกไม่สำเร็จ  [ลองอีกครั้ง]
 * Responsive: centered card that scales on Desktop / Tablet / Mobile.
 */
export default function SaveResultModal({ success, onClose, onRetry }: SaveResultModalProps) {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
        {/* Icon header */}
        <div className="flex flex-col items-center pt-8 pb-2 px-6">
          <div className={clsx(
            'w-16 h-16 rounded-full flex items-center justify-center mb-4',
            success ? 'bg-green-100' : 'bg-red-100'
          )}>
            {success
              ? <CheckCircle2 className="w-9 h-9 text-green-500" />
              : <XCircle className="w-9 h-9 text-red-500" />}
          </div>
          <h3 className={clsx('text-xl font-bold text-gray-900 text-center', success ? '' : '')}>
            {success ? 'บันทึกสำเร็จ' : 'บันทึกไม่สำเร็จ'}
          </h3>
          <p className="text-sm text-gray-500 mt-2 text-center leading-relaxed">
            {success
              ? 'ข้อมูลถูกบันทึกเรียบร้อยแล้ว'
              : 'ไม่สามารถบันทึกข้อมูลได้ กรุณาลองใหม่อีกครั้ง'}
          </p>
        </div>
        {/* Action */}
        <div className="px-6 pb-7 pt-5">
          {success ? (
            <button
              onClick={onClose}
              autoFocus
              className="w-full px-5 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-sm transition-colors"
            >
              ตกลง
            </button>
          ) : (
            <button
              onClick={() => { onClose(); onRetry?.() }}
              autoFocus
              className="w-full px-5 py-3 rounded-xl bg-red-500 hover:bg-red-600 text-white font-bold text-sm transition-colors flex items-center justify-center gap-2"
            >
              <RotateCcw className="w-4 h-4" />
              ลองอีกครั้ง
            </button>
          )}
        </div>
      </div>
    </div>
  )
}