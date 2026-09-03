import { NextRequest, NextResponse } from 'next/server'
import PromptPay from 'promptpay-qr'
import QRCode from 'qrcode'

/**
 * QR Code Generation API (local, no external API needed)
 * POST /api/slip2go/generate-qr
 * 
 * Body: { amount: string, promptPayId?: string, accountName?: string }
 * 
 * Returns: { qrCode: string (base64 PNG), promptPayPayload: string, accountName: string, amount: string }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { amount, promptPayId, accountName } = body

    if (!amount || parseFloat(amount) <= 0) {
      return NextResponse.json({ error: 'กรุณาระบุจำนวนเงินที่ถูกต้อง' }, { status: 400 })
    }

    const defaultPromptPayId = process.env.SLIP2GO_PROMPTPAY_ID || '0923644664'
    const defaultAccountName = process.env.SLIP2GO_PROMPTPAY_NAME || 'ByteBoxx Solution'

    const payId = promptPayId || defaultPromptPayId
    const payName = accountName || defaultAccountName

    // Generate PromptPay payload
    const payload = PromptPay(payId, { amount: parseFloat(amount) })

    // Generate QR Code as base64 PNG
    const qrCodeBase64 = await QRCode.toDataURL(payload, {
      width: 300,
      margin: 2,
      color: {
        dark: '#000000',
        light: '#FFFFFF',
      },
    })

    return NextResponse.json({
      qrCode: qrCodeBase64,
      promptPayPayload: payload,
      accountName: payName,
      amount: parseFloat(amount).toFixed(2),
    })
  } catch (error) {
    console.error('QR generation error:', error)
    return NextResponse.json({ error: 'เกิดข้อผิดพลาดในการสร้าง QR Code' }, { status: 500 })
  }
}
