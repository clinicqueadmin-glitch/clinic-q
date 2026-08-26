/**
 * ESC/POS Thermal Printer Integration
 * Supports common POS printers via USB/Bluetooth/Web Serial
 */

import type { ReceiptData } from './receipt-data'

// ESC/POS command constants
const ESC = '\x1B'
const GS = '\x1D'

const COMMANDS = {
  INIT: `${ESC}@`,
  // Text formatting
  BOLD_ON: `${ESC}E\x01`,
  BOLD_OFF: `${ESC}E\x00`,
  UNDERLINE_ON: `${ESC}-\x01`,
  UNDERLINE_OFF: `${ESC}-\x00`,
  DOUBLE_HEIGHT: `${ESC}!\x10`,
  DOUBLE_WIDTH: `${ESC}!\x20`,
  DOUBLE_BOTH: `${ESC}!\x30`,
  NORMAL: `${ESC}!\x00`,
  // Alignment
  ALIGN_LEFT: `${ESC}a\x00`,
  ALIGN_CENTER: `${ESC}a\x01`,
  ALIGN_RIGHT: `${ESC}a\x02`,
  // Feed & cut
  FEED_LINES: (n: number) => `${ESC}d${String.fromCharCode(n)}`,
  CUT_PAPER: `${GS}V\x00`,
  CUT_PAPER_PARTIAL: `${GS}V\x01`,
  // Cash drawer
  OPEN_DRAWER: `${ESC}p\x00\x19\xFA`,
}

function padRight(str: string, len: number): string {
  if (str.length >= len) return str.slice(0, len)
  return str + ' '.repeat(len - str.length)
}

function padLeft(str: string, len: number): string {
  if (str.length >= len) return str.slice(0, len)
  return ' '.repeat(len - str.length) + str
}

function padCenter(str: string, len: number): string {
  if (str.length >= len) return str.slice(0, len)
  const leftPad = Math.floor((len - str.length) / 2)
  return ' '.repeat(leftPad) + str + ' '.repeat(len - str.length - leftPad)
}

function formatCurrency(amount: number): string {
  return amount.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function generateDivider(width: number = 48): string {
  return '─'.repeat(width)
}

/**
 * Generate receipt text for ESC/POS printer
 */
export function generateReceiptText(receipt: ReceiptData, width: number = 48): string {
  const lines: string[] = []

  // Header
  lines.push(COMMANDS.INIT)
  lines.push(COMMANDS.DOUBLE_BOTH)
  lines.push(COMMANDS.ALIGN_CENTER)
  lines.push(receipt.clinicName)
  lines.push(COMMANDS.NORMAL)
  lines.push(receipt.clinicAddress)
  lines.push(`โทร: ${receipt.clinicPhone}`)
  lines.push(`เลขผู้เสียภาษี: ${receipt.clinicTaxId}`)
  lines.push('')
  lines.push(generateDivider(width))
  lines.push('')

  // Receipt info
  lines.push(`${padRight('เลขที่ใบเสร็จ:', 20)}${receipt.receiptNumber}`)
  lines.push(`${padRight('วันที่:', 20)}${receipt.date}`)
  lines.push(`${padRight('เวลา:', 20)}${receipt.time}`)
  lines.push(`${padRight('คิว:', 20)}${receipt.queueNumber}`)
  lines.push('')

  // Patient info
  lines.push(COMMANDS.BOLD_ON)
  lines.push('ข้อมูลผู้รับบริการ')
  lines.push(COMMANDS.BOLD_OFF)
  lines.push(`${padRight('ชื่อ:', 20)}${receipt.patientName}`)
  lines.push(`${padRight('โทรศัพท์:', 20)}${receipt.patientPhone}`)
  lines.push(`${padRight('แพทย์ผู้รักษา:', 20)}${receipt.doctor}`)
  lines.push('')
  lines.push(generateDivider(width))
  lines.push('')

  // Items header
  lines.push(COMMANDS.BOLD_ON)
  lines.push(`${padRight('รายการ', 28)}${padLeft('จำนวน', 6)}${padLeft('ราคา', 14)}`)
  lines.push(COMMANDS.BOLD_OFF)
  lines.push(generateDivider(width))

  // Items
  for (const item of receipt.items) {
    lines.push(padRight(item.name, 28))
    lines.push(
      `${padRight('', 28)}${padLeft(String(item.quantity), 6)}${padLeft(formatCurrency(item.totalPrice), 14)}`
    )
  }

  lines.push(generateDivider(width))
  lines.push('')

  // Totals
  lines.push(`${padRight('รวม:', 34)}${padLeft(formatCurrency(receipt.subtotal), 14)}`)
  if (receipt.discount > 0) {
    lines.push(`${padRight('ส่วนลด:', 34)}${padLeft(`-${formatCurrency(receipt.discount)}`, 14)}`)
  }
  lines.push(`${padRight('ภาษีมูลค่าเพิ่ม 7%:', 34)}${padLeft(formatCurrency(receipt.vat), 14)}`)
  lines.push(generateDivider(width))

  // Total
  lines.push(COMMANDS.DOUBLE_HEIGHT)
  lines.push(`${padRight('ยอดรวมทั้งหมด:', 34)}${padLeft(formatCurrency(receipt.total), 14)}`)
  lines.push(COMMANDS.NORMAL)
  lines.push(generateDivider(width))
  lines.push('')

  // Payment
  lines.push(COMMANDS.BOLD_ON)
  lines.push('ชำระเงิน')
  lines.push(COMMANDS.BOLD_OFF)
  lines.push(`${padRight('วิธีชำระ:', 20)}${receipt.paymentMethod.toUpperCase()}`)
  lines.push(`${padRight('จำนวนเงิน:', 20)}${formatCurrency(receipt.paidAmount)}`)
  if (receipt.change > 0) {
    lines.push(`${padRight('เงินทอน:', 20)}${formatCurrency(receipt.change)}`)
  }
  lines.push('')

  // Footer
  lines.push(generateDivider(width))
  lines.push('')
  lines.push(COMMANDS.ALIGN_CENTER)
  lines.push('ขอบคุณที่มาใช้บริการ')
  lines.push('กรุณาเก็บใบเสร็จไว้เป็นหลักฐาน')
  lines.push('')
  lines.push('')
  lines.push('')
  lines.push(COMMANDS.CUT_PAPER)

  return lines.join('\r\n')
}

/**
 * Generate HTML receipt for print preview
 */
export function generateReceiptHTML(receipt: ReceiptData): string {
  const totalItems = receipt.items.reduce((sum, item) => sum + item.quantity, 0)

  return `<!DOCTYPE html>
<html lang="th">
<head>
  <meta charset="UTF-8">
  <title>ใบเสร็จรับเงิน ${receipt.receiptNumber}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Sarabun:wght@300;400;500;600;700&display=swap');

    * { margin: 0; padding: 0; box-sizing: border-box; }

    @page {
      size: 80mm auto;
      margin: 5mm;
    }

    body {
      font-family: 'Sarabun', 'Segoe UI', sans-serif;
      font-size: 11pt;
      color: #000;
      background: #fff;
      padding: 5mm;
      line-height: 1.5;
    }

    .receipt {
      max-width: 80mm;
      margin: 0 auto;
    }

    .text-center { text-align: center; }
    .text-right { text-align: right; }
    .text-bold { font-weight: 700; }
    .text-sm { font-size: 9pt; }
    .text-lg { font-size: 13pt; }
    .text-xl { font-size: 16pt; font-weight: 700; }

    .clinic-name {
      font-size: 16pt;
      font-weight: 700;
      margin-bottom: 2mm;
    }

    .clinic-info {
      font-size: 9pt;
      color: #444;
      line-height: 1.4;
    }

    .divider {
      border: none;
      border-top: 1px dashed #000;
      margin: 3mm 0;
    }

    .divider-thick {
      border: none;
      border-top: 2px solid #000;
      margin: 3mm 0;
    }

    .info-row {
      display: flex;
      justify-content: space-between;
      font-size: 10pt;
      margin-bottom: 1mm;
    }

    .items-table {
      width: 100%;
      border-collapse: collapse;
      margin: 2mm 0;
      font-size: 10pt;
    }

    .items-table th {
      text-align: left;
      font-weight: 600;
      border-bottom: 1px solid #000;
      padding: 1mm 0;
    }

    .items-table th:last-child,
    .items-table td:last-child {
      text-align: right;
    }

    .items-table td {
      padding: 1mm 0;
      vertical-align: top;
    }

    .totals {
      margin-top: 2mm;
    }

    .totals-row {
      display: flex;
      justify-content: space-between;
      font-size: 10pt;
      margin-bottom: 1mm;
    }

    .totals-row.total {
      font-size: 14pt;
      font-weight: 700;
      border-top: 2px solid #000;
      padding-top: 2mm;
      margin-top: 2mm;
    }

    .payment-info {
      margin-top: 3mm;
    }

    .footer {
      margin-top: 5mm;
      text-align: center;
      font-size: 9pt;
      color: #444;
    }

    .barcode-placeholder {
      margin-top: 4mm;
      text-align: center;
      font-size: 8pt;
      color: #888;
    }

    @media print {
      body { padding: 0; }
      .no-print { display: none !important; }
    }
  </style>
</head>
<body>
  <div class="receipt">
    <!-- Header -->
    <div class="text-center">
      <div class="clinic-name">${receipt.clinicName}</div>
      <div class="clinic-info">
        ${receipt.clinicAddress}<br>
        โทร: ${receipt.clinicPhone}<br>
        เลขผู้เสียภาษี: ${receipt.clinicTaxId}
      </div>
    </div>

    <hr class="divider-thick">

    <!-- Receipt Info -->
    <div class="info-row">
      <span>เลขที่ใบเสร็จ:</span>
      <span class="text-bold">${receipt.receiptNumber}</span>
    </div>
    <div class="info-row">
      <span>วันที่:</span>
      <span>${receipt.date} ${receipt.time} น.</span>
    </div>
    <div class="info-row">
      <span>คิว:</span>
      <span class="text-bold">${receipt.queueNumber}</span>
    </div>

    <hr class="divider">

    <!-- Patient Info -->
    <div class="text-bold" style="margin-bottom:2mm;">ข้อมูลผู้รับบริการ</div>
    <div class="info-row">
      <span>ชื่อ:</span>
      <span>${receipt.patientName}</span>
    </div>
    <div class="info-row">
      <span>โทรศัพท์:</span>
      <span>${receipt.patientPhone}</span>
    </div>
    <div class="info-row">
      <span>แพทย์ผู้รักษา:</span>
      <span>${receipt.doctor}</span>
    </div>

    <hr class="divider">

    <!-- Items -->
    <table class="items-table">
      <thead>
        <tr>
          <th>รายการ</th>
          <th class="text-right">ราคา</th>
        </tr>
      </thead>
      <tbody>
        ${receipt.items.map(item => `
        <tr>
          <td>
            ${item.name}
            <br><span class="text-sm" style="color:#666;">x${item.quantity} × ฿${formatCurrency(item.unitPrice)}</span>
          </td>
          <td class="text-right">฿${formatCurrency(item.totalPrice)}</td>
        </tr>`).join('')}
      </tbody>
    </table>

    <hr class="divider">

    <!-- Totals -->
    <div class="totals">
      <div class="totals-row">
        <span>รวม (${totalItems} รายการ):</span>
        <span>฿${formatCurrency(receipt.subtotal)}</span>
      </div>
      ${receipt.discount > 0 ? `
      <div class="totals-row">
        <span>ส่วนลด:</span>
        <span>-฿${formatCurrency(receipt.discount)}</span>
      </div>` : ''}
      <div class="totals-row">
        <span>ภาษีมูลค่าเพิ่ม 7%:</span>
        <span>฿${formatCurrency(receipt.vat)}</span>
      </div>
      <div class="totals-row total">
        <span>ยอดรวมทั้งหมด:</span>
        <span>฿${formatCurrency(receipt.total)}</span>
      </div>
    </div>

    <hr class="divider-thick">

    <!-- Payment -->
    <div class="payment-info text-bold" style="margin-bottom:2mm;">ชำระเงิน</div>
    <div class="info-row">
      <span>วิธีชำระ:</span>
      <span>${receipt.paymentMethod.toUpperCase()}</span>
    </div>
    <div class="info-row">
      <span>จำนวนเงิน:</span>
      <span class="text-bold">฿${formatCurrency(receipt.paidAmount)}</span>
    </div>
    ${receipt.change > 0 ? `
    <div class="info-row">
      <span>เงินทอน:</span>
      <span class="text-bold">฿${formatCurrency(receipt.change)}</span>
    </div>` : ''}

    <hr class="divider-thick">

    <!-- Footer -->
    <div class="footer">
      ขอบคุณที่มาใช้บริการ<br>
      กรุณาเก็บใบเสร็จไว้เป็นหลักฐาน<br><br>
      ${receipt.receiptNumber}
    </div>
  </div>
</body>
</html>`
}

/**
 * Print receipt using browser print API
 */
export function printReceipt(receipt: ReceiptData): void {
  const html = generateReceiptHTML(receipt)
  const printWindow = window.open('', '_blank', 'width=400,height=600')
  if (printWindow) {
    printWindow.document.write(html)
    printWindow.document.close()
    printWindow.focus()
    setTimeout(() => {
      printWindow.print()
    }, 500)
  }
}

/**
 * Print to POS printer via Web Serial API (if supported)
 */
export async function printToPOS(receipt: ReceiptData, baudRate: number = 9600): Promise<boolean> {
  try {
    // Check if Web Serial API is supported
    if (!('serial' in navigator)) {
      console.warn('Web Serial API not supported in this browser')
      return false
    }

    const port = await (navigator as any).serial.requestPort()
    await port.open({ baudRate })

    const writer = port.writable.getWriter()
    const encoder = new TextEncoder()
    const receiptText = generateReceiptText(receipt)

    await writer.write(encoder.encode(receiptText))
    writer.releaseLock()
    await port.close()

    return true
  } catch (err) {
    console.error('POS print error:', err)
    return false
  }
}

/**
 * Send receipt to a network POS printer via fetch
 */
export async function printToNetworkPOS(
  receipt: ReceiptData,
  printerIP: string,
  printerPort: number = 9100
): Promise<boolean> {
  try {
    const receiptText = generateReceiptText(receipt)
    const response = await fetch(`/api/pos-print`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ip: printerIP,
        port: printerPort,
        data: receiptText,
      }),
    })
    return response.ok
  } catch {
    return false
  }
}
