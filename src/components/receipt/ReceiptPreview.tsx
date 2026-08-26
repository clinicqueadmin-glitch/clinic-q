'use client'

import { useState } from 'react'
import { clsx } from 'clsx'
import {
  X,
  Printer,
  Download,
  CreditCard,
  Banknote,
  Smartphone,
  Building2,
  Check,
  Loader2,
} from 'lucide-react'
import { type ReceiptData, type PaymentMethod, paymentMethods, sampleReceipt, formatCurrency } from '@/lib/receipt-data'
import { printReceipt, printToPOS } from '@/lib/escpos'

interface ReceiptPreviewProps {
  receipt?: ReceiptData
  onClose: () => void
}

export default function ReceiptPreview({ receipt = sampleReceipt, onClose }: ReceiptPreviewProps) {
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(receipt.paymentMethod)
  const [paidAmount, setPaidAmount] = useState(receipt.paidAmount)
  const [printing, setPrinting] = useState(false)
  const [printed, setPrinted] = useState(false)
  const [discount, setDiscount] = useState(receipt.discount)

  const subtotal = receipt.items.reduce((sum, item) => sum + item.totalPrice, 0)
  const vat = (subtotal - discount) * 0.07
  const total = subtotal - discount + vat
  const change = paidAmount - total

  const handlePrint = async (method: 'browser' | 'pos') => {
    setPrinting(true)
    const updatedReceipt: ReceiptData = {
      ...receipt,
      paymentMethod,
      paidAmount,
      change: change > 0 ? change : 0,
      discount,
      subtotal,
      vat,
      total,
    }

    if (method === 'pos') {
      const success = await printToPOS(updatedReceipt)
      if (!success) {
        // Fallback to browser print
        printReceipt(updatedReceipt)
      }
    } else {
      printReceipt(updatedReceipt)
    }

    setTimeout(() => {
      setPrinting(false)
      setPrinted(true)
    }, 1000)
  }

  const handleDownload = () => {
    const html = `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><title>ใบเสร็จ ${receipt.receiptNumber}</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Sarabun:wght@300;400;500;600;700&display=swap');
  *{margin:0;padding:0;box-sizing:border-box}
  @page{size:80mm auto;margin:5mm}
  body{font-family:'Sarabun','Segoe UI',sans-serif;font-size:11pt;color:#000;background:#fff;padding:5mm;line-height:1.5}
  .receipt{max-width:80mm;margin:0 auto}
  .tc{text-align:center}.tr{text-align:right}.bold{font-weight:700}
  .clinic-name{font-size:16pt;font-weight:700;margin-bottom:2mm}
  .info{font-size:9pt;color:#444;line-height:1.4}
  .divider{border:none;border-top:1px dashed #000;margin:3mm 0}
  .divider-t{border:none;border-top:2px solid #000;margin:3mm 0}
  .row{display:flex;justify-content:space-between;font-size:10pt;margin-bottom:1mm}
  table{width:100%;border-collapse:collapse;margin:2mm 0;font-size:10pt}
  th{text-align:left;font-weight:600;border-bottom:1px solid #000;padding:1mm 0}
  th:last-child,td:last-child{text-align:right}
  td{padding:1mm 0}
  .total-row{display:flex;justify-content:space-between;font-size:14pt;font-weight:700;border-top:2px solid #000;padding-top:2mm;margin-top:2mm}
  .footer{margin-top:5mm;text-align:center;font-size:9pt;color:#444}
</style></head><body><div class="receipt">
<div class="tc"><div class="clinic-name">${receipt.clinicName}</div>
<div class="info">${receipt.clinicAddress}<br>โทร: ${receipt.clinicPhone}<br>เลขผู้เสียภาษี: ${receipt.clinicTaxId}</div></div>
<hr class="divider-t">
<div class="row"><span>เลขที่ใบเสร็จ:</span><span class="bold">${receipt.receiptNumber}</span></div>
<div class="row"><span>วันที่:</span><span>${receipt.date} ${receipt.time} น.</span></div>
<div class="row"><span>คิว:</span><span class="bold">${receipt.queueNumber}</span></div>
<hr class="divider">
<div class="bold" style="margin-bottom:2mm">ข้อมูลผู้รับบริการ</div>
<div class="row"><span>ชื่อ:</span><span>${receipt.patientName}</span></div>
<div class="row"><span>โทรศัพท์:</span><span>${receipt.patientPhone}</span></div>
<div class="row"><span>แพทย์ผู้รักษา:</span><span>${receipt.doctor}</span></div>
<hr class="divider">
<table><thead><tr><th>รายการ</th><th class="tr">ราคา</th></tr></thead><tbody>
${receipt.items.map(i => `<tr><td>${i.name}<br><span style="font-size:9pt;color:#666">x${i.quantity} × ฿${i.unitPrice.toLocaleString()}</span></td><td class="tr">฿${i.totalPrice.toLocaleString()}</td></tr>`).join('')}
</tbody></table>
<hr class="divider">
<div class="row"><span>รวม:</span><span>฿${subtotal.toLocaleString()}</span></div>
${discount > 0 ? `<div class="row"><span>ส่วนลด:</span><span>-฿${discount.toLocaleString()}</span></div>` : ''}
<div class="row"><span>ภาษีมูลค่าเพิ่ม 7%:</span><span>฿${vat.toFixed(2)}</span></div>
<div class="total-row"><span>ยอดรวมทั้งหมด:</span><span>฿${total.toFixed(2)}</span></div>
<hr class="divider-t">
<div class="bold" style="margin-bottom:2mm">ชำระเงิน</div>
<div class="row"><span>วิธีชำระ:</span><span>${paymentMethods[paymentMethod].label}</span></div>
<div class="row"><span>จำนวนเงิน:</span><span class="bold">฿${paidAmount.toLocaleString()}</span></div>
${change > 0 ? `<div class="row"><span>เงินทอน:</span><span class="bold">฿${change.toFixed(2)}</span></div>` : ''}
<hr class="divider-t">
<div class="footer">ขอบคุณที่มาใช้บริการ<br>กรุณาเก็บใบเสร็จไว้เป็นหลักฐาน<br><br>${receipt.receiptNumber}</div>
</div></body></html>`

    const blob = new Blob([html], { type: 'text/html' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `receipt-${receipt.receiptNumber}.html`
    a.click()
    URL.revokeObjectURL(url)
  }

  const paymentIcons: Record<PaymentMethod, React.ReactNode> = {
    cash: <Banknote className="w-5 h-5" />,
    card: <CreditCard className="w-5 h-5" />,
    transfer: <Building2 className="w-5 h-5" />,
    promptpay: <Smartphone className="w-5 h-5" />,
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-gray-900">ใบเสร็จรับเงิน</h2>
            <p className="text-sm text-gray-500">{receipt.receiptNumber}</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* Receipt Preview */}
          <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
            {/* Clinic Header */}
            <div className="text-center mb-3">
              <p className="text-lg font-bold text-gray-900">{receipt.clinicName}</p>
              <p className="text-xs text-gray-500 leading-relaxed">
                {receipt.clinicAddress}<br />
                โทร: {receipt.clinicPhone}<br />
                เลขผู้เสียภาษี: {receipt.clinicTaxId}
              </p>
            </div>

            <hr className="border-gray-300 border-dashed my-3" />

            {/* Receipt Info */}
            <div className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">เลขที่:</span>
                <span className="font-mono font-bold">{receipt.receiptNumber}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">วันที่:</span>
                <span>{receipt.date} {receipt.time} น.</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">คิว:</span>
                <span className="font-bold">{receipt.queueNumber}</span>
              </div>
            </div>

            <hr className="border-gray-300 border-dashed my-3" />

            {/* Patient */}
            <div className="text-sm space-y-1 mb-3">
              <p className="font-semibold text-gray-900">ข้อมูลผู้รับบริการ</p>
              <div className="flex justify-between">
                <span className="text-gray-500">ชื่อ:</span>
                <span>{receipt.patientName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">แพทย์:</span>
                <span>{receipt.doctor}</span>
              </div>
            </div>

            <hr className="border-gray-300 border-dashed my-3" />

            {/* Items Table */}
            <table className="w-full text-sm mb-3">
              <thead>
                <tr className="border-b border-gray-300">
                  <th className="text-left py-1 font-semibold">รายการ</th>
                  <th className="text-right py-1 font-semibold">ราคา</th>
                </tr>
              </thead>
              <tbody>
                {receipt.items.map(item => (
                  <tr key={item.id}>
                    <td className="py-1">
                      {item.name}
                      <p className="text-xs text-gray-400">x{item.quantity} × ฿{item.unitPrice.toLocaleString()}</p>
                    </td>
                    <td className="text-right py-1">฿{item.totalPrice.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <hr className="border-gray-300 border-dashed my-3" />

            {/* Totals */}
            <div className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">รวม:</span>
                <span>฿{subtotal.toLocaleString()}</span>
              </div>
              {discount > 0 && (
                <div className="flex justify-between text-red-500">
                  <span>ส่วนลด:</span>
                  <span>-฿{discount.toLocaleString()}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-gray-500">ภาษีมูลค่าเพิ่ม 7%:</span>
                <span>฿{vat.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-lg font-bold border-t-2 border-gray-900 pt-2 mt-2">
                <span>ยอดรวมทั้งหมด:</span>
                <span>฿{total.toFixed(2)}</span>
              </div>
            </div>

            <hr className="border-gray-300 border-dashed my-3" />

            {/* Payment Info */}
            <div className="text-sm space-y-1">
              <p className="font-semibold text-gray-900">ชำระเงิน</p>
              <div className="flex justify-between">
                <span className="text-gray-500">วิธีชำระ:</span>
                <span>{paymentMethods[paymentMethod].label}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">จำนวนเงิน:</span>
                <span className="font-bold">฿{paidAmount.toLocaleString()}</span>
              </div>
              {change > 0 && (
                <div className="flex justify-between text-green-600 font-bold">
                  <span>เงินทอน:</span>
                  <span>฿{change.toFixed(2)}</span>
                </div>
              )}
            </div>
          </div>

          {/* Payment Method */}
          <div>
            <p className="text-sm font-medium text-gray-700 mb-2">วิธีชำระเงิน</p>
            <div className="grid grid-cols-2 gap-2">
              {(Object.entries(paymentMethods) as [PaymentMethod, typeof paymentMethods[PaymentMethod]][]).map(([key, method]) => (
                <button
                  key={key}
                  onClick={() => setPaymentMethod(key)}
                  className={clsx(
                    'flex items-center gap-2 px-4 py-3 rounded-xl border-2 text-sm font-medium transition-all',
                    paymentMethod === key
                      ? 'border-primary-500 bg-primary-50 text-primary-600'
                      : 'border-gray-200 hover:border-gray-300 text-gray-600'
                  )}
                >
                  {paymentIcons[key]}
                  {method.label}
                </button>
              ))}
            </div>
          </div>

          {/* Paid Amount */}
          <div>
            <label className="text-sm font-medium text-gray-700 mb-2 block">จำนวนเงินที่รับ</label>
            <input
              type="number"
              value={paidAmount}
              onChange={(e) => setPaidAmount(Number(e.target.value))}
              className="input-field text-lg font-mono"
              step="0.01"
            />
          </div>

          {/* Discount */}
          <div>
            <label className="text-sm font-medium text-gray-700 mb-2 block">ส่วนลด (บาท)</label>
            <input
              type="number"
              value={discount}
              onChange={(e) => setDiscount(Number(e.target.value))}
              className="input-field"
              min="0"
              step="1"
            />
          </div>
        </div>

        {/* Footer Actions */}
        <div className="px-5 py-4 border-t border-gray-100 bg-gray-50 space-y-3">
          {printed ? (
            <div className="flex items-center justify-center gap-2 py-3 text-green-600">
              <Check className="w-5 h-5" />
              <span className="font-medium">พิมพ์แล้ว!</span>
            </div>
          ) : (
            <div className="flex gap-3">
              <button
                onClick={() => handlePrint('browser')}
                disabled={printing}
                className="flex-1 flex items-center justify-center gap-2 py-3 bg-primary-500 text-white rounded-xl font-medium hover:bg-primary-600 transition-colors disabled:opacity-50"
              >
                {printing ? <Loader2 className="w-5 h-5 animate-spin" /> : <Printer className="w-5 h-5" />}
                พิมพ์ใบเสร็จ
              </button>
              <button
                onClick={() => handlePrint('pos')}
                disabled={printing}
                className="flex-1 flex items-center justify-center gap-2 py-3 bg-gray-900 text-white rounded-xl font-medium hover:bg-gray-800 transition-colors disabled:opacity-50"
              >
                {printing ? <Loader2 className="w-5 h-5 animate-spin" /> : <Printer className="w-5 h-5" />}
                พิมพ์ผ่าน POS
              </button>
            </div>
          )}
          <div className="flex gap-3">
            <button
              onClick={handleDownload}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 border border-gray-300 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-100 transition-colors"
            >
              <Download className="w-4 h-4" />
              ดาวน์โหลด
            </button>
            <button
              onClick={onClose}
              className="flex-1 py-2.5 border border-gray-300 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-100 transition-colors"
            >
              ปิด
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
