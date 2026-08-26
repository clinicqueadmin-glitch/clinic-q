export interface ReceiptItem {
  id: string
  name: string
  quantity: number
  unitPrice: number
  totalPrice: number
}

export interface ReceiptData {
  receiptNumber: string
  date: string
  time: string
  clinicName: string
  clinicAddress: string
  clinicPhone: string
  clinicTaxId: string
  patientName: string
  patientPhone: string
  queueNumber: string
  doctor: string
  clinicType: string
  items: ReceiptItem[]
  subtotal: number
  discount: number
  vat: number
  total: number
  paymentMethod: 'cash' | 'card' | 'transfer' | 'promptpay'
  paidAmount: number
  change: number
  note?: string
}

export const sampleReceipt: ReceiptData = {
  receiptNumber: 'R20260819-001',
  date: '19 สิงหาคม 2569',
  time: '14:30',
  clinicName: 'คลินิกเวชกรรม ดร.สมชาย',
  clinicAddress: '123 ถนนสุขุมวิท แขวงคลองเตย เขตคลองเตย กรุงเทพฯ 10110',
  clinicPhone: '02-123-4567',
  clinicTaxId: '0-1055-67890-12-3',
  patientName: 'สมชาย ใจดี',
  patientPhone: '081-234-5678',
  queueNumber: 'A024',
  doctor: 'นพ.วิชัย รักษาดี',
  clinicType: 'คลินิกเวชกรรม',
  items: [
    { id: '1', name: 'ค่าตรวจสุขภาพทั่วไป', quantity: 1, unitPrice: 500, totalPrice: 500 },
    { id: '2', name: 'ค่าตรวจเลือด CBC', quantity: 1, unitPrice: 350, totalPrice: 350 },
    { id: '3', name: 'ค่ายาแก้ปวด Paracetamol', quantity: 1, unitPrice: 60, totalPrice: 60 },
    { id: '4', name: 'ค่าปรึกษาแพทย์', quantity: 1, unitPrice: 200, totalPrice: 200 },
  ],
  subtotal: 1110,
  discount: 0,
  vat: 77.7,
  total: 1187.7,
  paymentMethod: 'cash',
  paidAmount: 1200,
  change: 12.3,
}

export const paymentMethods = {
  cash: { label: 'เงินสด', icon: '💵', short: 'CASH' },
  card: { label: 'บัตรเครดิต/เดบิต', icon: '💳', short: 'CARD' },
  transfer: { label: 'โอนเงิน', icon: '🏦', short: 'TRANSFER' },
  promptpay: { label: 'PromptPay', icon: '📱', short: 'PROMPTPAY' },
}

export type PaymentMethod = keyof typeof paymentMethods

export function formatCurrency(amount: number): string {
  return amount.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}
