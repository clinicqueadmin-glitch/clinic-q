'use client'

import { useState, useEffect, useCallback } from 'react'
import { X, QrCode, Upload, CheckCircle, Clock, Loader2, Copy, AlertCircle } from 'lucide-react'

interface PaymentModalProps {
  isOpen: boolean
  onClose: () => void
  plan: 'monthly' | 'yearly'
  amount: number
  clinicId: string
  onSuccess: () => void
}

type PaymentStep = 'qr' | 'upload' | 'verifying' | 'success' | 'error'

export default function PaymentModal({ isOpen, onClose, plan, amount, clinicId, onSuccess }: PaymentModalProps) {
  const [step, setStep] = useState<PaymentStep>('qr')
  const [qrData, setQrData] = useState<{ qrCode: string; accountName: string; amount: string } | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [slipFile, setSlipFile] = useState<File | null>(null)
  const [slipPreview, setSlipPreview] = useState<string | null>(null)
  const [verifyResult, setVerifyResult] = useState<{ verified: boolean; data?: Record<string, unknown>; error?: string } | null>(null)
  const [copied, setCopied] = useState(false)

  const generateQR = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/slip2go/generate-qr', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: String(amount) }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'ไม่สามารถสร้าง QR Code ได้')
        return
      }
      setQrData(data)
    } catch {
      setError('เกิดข้อผิดพลาดในการเชื่อมต่อ')
    } finally {
      setLoading(false)
    }
  }, [amount])

  useEffect(() => {
    if (isOpen && step === 'qr' && !qrData) {
      generateQR()
    }
  }, [isOpen, step, qrData, generateQR])

  const handleSlipUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setSlipFile(file)
    const reader = new FileReader()
    reader.onload = (ev) => setSlipPreview(ev.target?.result as string)
    reader.readAsDataURL(file)
  }

  const verifySlip = async () => {
    if (!slipFile) return
    setStep('verifying')
    setLoading(true)
    try {
      const formData = new FormData()
      formData.append('slip', slipFile)
      formData.append('expectedAmount', String(amount))

      // Convert image to base64 for Slip2Go API
      const reader = new FileReader()
      reader.onload = async (e) => {
        const base64 = (e.target?.result as string).split(',')[1]
        try {
          const res = await fetch('/api/slip2go/verify-slip', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ qrCode: base64, expectedAmount: amount }),
          })
          const data = await res.json()
          setVerifyResult(data)
          if (data.verified) {
            // Update subscription
            const subKey = `clinicq-subscription-${clinicId}`
            const subData = {
              plan,
              startDate: new Date().toISOString(),
              paidEndDate: new Date(Date.now() + (plan === 'yearly' ? 365 : 30) * 24 * 60 * 60 * 1000).toISOString(),
              paymentMethod: 'promptpay',
              paymentRef: data.data?.referenceId || '',
              paymentDate: new Date().toISOString(),
              paymentAmount: amount,
              transactionId: data.data?.transRef || '',
            }
            localStorage.setItem(subKey, JSON.stringify(subData))
            setStep('success')
            setTimeout(() => {
              onSuccess()
              onClose()
            }, 3000)
          } else {
            setStep('error')
          }
        } catch {
          setVerifyResult({ verified: false, error: 'เกิดข้อผิดพลาดในการตรวจสอบสลิป' })
          setStep('error')
        } finally {
          setLoading(false)
        }
      }
      reader.readAsDataURL(slipFile)
    } catch {
      setVerifyResult({ verified: false, error: 'เกิดข้อผิดพลาดของระบบ' })
      setStep('error')
      setLoading(false)
    }
  }

  const copyQrCode = () => {
    if (qrData?.qrCode) {
      navigator.clipboard.writeText(qrData.qrCode)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const reset = () => {
    setStep('qr')
    setSlipFile(null)
    setSlipPreview(null)
    setVerifyResult(null)
    setError('')
    setQrData(null)
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-3xl shadow-2xl max-w-md w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-gray-100">
          <div className="flex items-center gap-2">
            {step === 'qr' && <QrCode className="w-5 h-5 text-teal-600" />}
            {step === 'upload' && <Upload className="w-5 h-5 text-blue-600" />}
            {step === 'verifying' && <Loader2 className="w-5 h-5 text-amber-600 animate-spin" />}
            {step === 'success' && <CheckCircle className="w-5 h-5 text-green-600" />}
            {step === 'error' && <AlertCircle className="w-5 h-5 text-red-600" />}
            <h3 className="font-bold text-gray-900">
              {step === 'qr' && 'สแกน QR Code ชำระเงิน'}
              {step === 'upload' && 'แนบสลิปโอนเงิน'}
              {step === 'verifying' && 'กำลังตรวจสอบสลิป...'}
              {step === 'success' && 'ชำระเงินสำเร็จ!'}
              {step === 'error' && 'เกิดข้อผิดพลาด'}
            </h3>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center hover:bg-gray-200 transition-colors">
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>

        <div className="p-5">
          {/* ═══ STEP: QR Code ═══ */}
          {step === 'qr' && (
            <div className="text-center">
              {/* Plan info */}
              <div className="bg-teal-50 rounded-2xl p-4 mb-4">
                <p className="text-sm text-teal-700 font-medium">
                  {plan === 'yearly' ? '📦 แพ็กเกจรายปี' : '📦 แพ็กเกจรายเดือน'}
                </p>
                <p className="text-3xl font-extrabold text-teal-600 mt-1">
                  {amount.toLocaleString()} <span className="text-lg">บาท</span>
                </p>
              </div>

              {loading ? (
                <div className="flex flex-col items-center py-8">
                  <Loader2 className="w-8 h-8 text-teal-600 animate-spin" />
                  <p className="text-sm text-gray-500 mt-3">กำลังสร้าง QR Code...</p>
                </div>
              ) : error ? (
                <div className="py-8">
                  <AlertCircle className="w-12 h-12 text-red-400 mx-auto" />
                  <p className="text-sm text-red-600 mt-3">{error}</p>
                  <button
                    onClick={generateQR}
                    className="mt-4 px-4 py-2 bg-teal-500 text-white rounded-xl text-sm font-bold hover:bg-teal-600"
                  >
                    ลองใหม่
                  </button>
                </div>
              ) : qrData ? (
                <>
                  {/* QR Code display */}
                  <div className="bg-white border-2 border-gray-100 rounded-2xl p-6 mb-4 inline-block">
                    <img
                      src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(qrData.qrCode)}`}
                      alt="QR Code"
                      className="w-48 h-48 mx-auto"
                    />
                  </div>

                  {/* Account info */}
                  <div className="bg-gray-50 rounded-xl p-3 mb-4">
                    <p className="text-xs text-gray-500">บัญชีผู้รับ</p>
                    <p className="text-sm font-bold text-gray-900">{qrData.accountName}</p>
                    <p className="text-xs text-gray-400 mt-1">โรงพยาบาล/คลินิก</p>
                  </div>

                  {/* Copy QR string */}
                  <button
                    onClick={copyQrCode}
                    className="flex items-center gap-2 mx-auto px-3 py-1.5 bg-gray-100 rounded-lg text-xs text-gray-600 hover:bg-gray-200 transition-colors mb-4"
                  >
                    <Copy className="w-3 h-3" />
                    {copied ? 'คัดลอกแล้ว!' : 'คัดลอกโค้ด QR'}
                  </button>

                  {/* Instructions */}
                  <div className="bg-blue-50 rounded-xl p-4 text-left mb-4">
                    <p className="text-xs font-bold text-blue-800 mb-2">วิธีชำระเงิน:</p>
                    <ol className="text-xs text-blue-700 space-y-1 list-decimal list-inside">
                      <li>เปิดแอปธนาคาร (K+, SCB, BBL ฯลฯ)</li>
                      <li>เลือกสแกน QR / PromptPay</li>
                      <li>สแกน QR Code ด้านบน</li>
                      <li>ตรวจสอบจำนวนเงิน <b>{amount.toLocaleString()} บาท</b></li>
                      <li>ยืนยันการโอน</li>
                    </ol>
                  </div>

                  {/* Action buttons */}
                  <div className="flex gap-3">
                    <button
                      onClick={() => setStep('upload')}
                      disabled={!slipFile}
                      className="flex-1 py-3 bg-teal-500 text-white rounded-xl font-bold text-sm hover:bg-teal-600 transition-colors disabled:bg-gray-300 flex items-center justify-center gap-2"
                    >
                      <Upload className="w-4 h-4" />
                      {slipFile ? 'ส่งสลิป' : 'แนบสลิปก่อน'}
                    </button>
                  </div>

                  {/* File upload */}
                  <div className="mt-4">
                    <label className="block w-full border-2 border-dashed border-gray-200 rounded-xl p-4 text-center cursor-pointer hover:border-teal-300 transition-colors">
                      <Upload className="w-6 h-6 text-gray-400 mx-auto mb-2" />
                      <span className="text-xs text-gray-500">
                        {slipFile ? `📄 ${slipFile.name}` : 'คลิกเพื่อแนบสลิปโอนเงิน (JPG, PNG)'}
                      </span>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleSlipUpload}
                        className="hidden"
                      />
                    </label>
                    {slipPreview && (
                      <img src={slipPreview} alt="Slip preview" className="mt-3 rounded-xl max-h-40 mx-auto border" />
                    )}
                  </div>
                </>
              ) : null}
            </div>
          )}

          {/* ═══ STEP: Upload Slip ═══ */}
          {step === 'upload' && (
            <div className="text-center">
              {slipPreview && (
                <img src={slipPreview} alt="Slip" className="rounded-xl max-h-48 mx-auto border mb-4" />
              )}
              <p className="text-sm text-gray-600 mb-4">
                ตรวจสอบสลิปของคุณก่อนส่ง
              </p>
              <div className="bg-amber-50 rounded-xl p-3 mb-4 text-left">
                <p className="text-xs text-amber-700">
                  ⚠️ ตรวจสอบให้แน่ใจว่าโอน <b>{amount.toLocaleString()} บาท</b> ไปยังบัญชีที่ถูกต้อง
                </p>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => setStep('qr')}
                  className="flex-1 py-3 bg-gray-100 text-gray-700 rounded-xl font-bold text-sm hover:bg-gray-200"
                >
                  กลับ
                </button>
                <button
                  onClick={verifySlip}
                  className="flex-1 py-3 bg-teal-500 text-white rounded-xl font-bold text-sm hover:bg-teal-600 flex items-center justify-center gap-2"
                >
                  <CheckCircle className="w-4 h-4" />
                  ยืนยันชำระเงิน
                </button>
              </div>
            </div>
          )}

          {/* ═══ STEP: Verifying ═══ */}
          {step === 'verifying' && (
            <div className="text-center py-8">
              <Loader2 className="w-12 h-12 text-teal-600 animate-spin mx-auto" />
              <p className="text-sm text-gray-600 mt-4">กำลังตรวจสอบสลิปโอนเงิน...</p>
              <p className="text-xs text-gray-400 mt-2">กรุณารอสักครู่</p>
            </div>
          )}

          {/* ═══ STEP: Success ═══ */}
          {step === 'success' && (
            <div className="text-center py-8">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto">
                <CheckCircle className="w-8 h-8 text-green-600" />
              </div>
              <h4 className="text-lg font-bold text-gray-900 mt-4">ชำระเงินสำเร็จ!</h4>
              <p className="text-sm text-gray-600 mt-2">
                แพ็กเกจ{plan === 'yearly' ? 'รายปี' : 'รายเดือน'}ของคุณได้รับการอัปเกรดแล้ว
              </p>
              <div className="bg-green-50 rounded-xl p-3 mt-4 text-left">
                <p className="text-xs text-green-700">
                  ✅ อัปเกรดเป็น <b>{plan === 'yearly' ? 'รายปี' : 'รายเดือน'}</b> เรียบร้อย
                </p>
                {verifyResult?.data && (
                  <p className="text-xs text-green-600 mt-1">
                    Ref: {(verifyResult.data as Record<string, string>).transRef || '-'}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* ═══ STEP: Error ═══ */}
          {step === 'error' && (
            <div className="text-center py-8">
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto">
                <AlertCircle className="w-8 h-8 text-red-600" />
              </div>
              <h4 className="text-lg font-bold text-gray-900 mt-4">ตรวจสอบไม่สำเร็จ</h4>
              <p className="text-sm text-red-600 mt-2">
                {verifyResult?.error || 'สลิปไม่ถูกต้องหรือยอดเงินไม่ตรง'}
              </p>
              <div className="flex gap-3 mt-6">
                <button
                  onClick={reset}
                  className="flex-1 py-3 bg-gray-100 text-gray-700 rounded-xl font-bold text-sm hover:bg-gray-200"
                >
                  ลองใหม่
                </button>
                <button
                  onClick={onClose}
                  className="flex-1 py-3 bg-teal-500 text-white rounded-xl font-bold text-sm hover:bg-teal-600"
                >
                  ปิด
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
