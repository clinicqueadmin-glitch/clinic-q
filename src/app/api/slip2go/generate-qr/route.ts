import { NextRequest, NextResponse } from 'next/server'

/**
 * Slip2Go QR Code Generation API
 * POST /api/slip2go/generate-qr
 * 
 * Body: { amount: string, promptPayId?: string, accountName?: string }
 * 
 * Returns: { qrCode: string, accountName: string, amount: string }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { amount, promptPayId, accountName } = body

    if (!amount || parseFloat(amount) <= 0) {
      return NextResponse.json({ error: 'กรุณาระบุจำนวนเงินที่ถูกต้อง' }, { status: 400 })
    }

    const apiSecret = process.env.SLIP2GO_API_SECRET
    const defaultPromptPayId = process.env.SLIP2GO_PROMPTPAY_ID
    const defaultAccountName = process.env.SLIP2GO_PROMPTPAY_NAME

    const payId = promptPayId || defaultPromptPayId
    const payName = accountName || defaultAccountName

    if (!apiSecret || !payId) {
      return NextResponse.json({ 
        error: 'กรุณาตั้งค่า Slip2Go API Secret ใน .env.local',
        details: {
          hasApiSecret: !!apiSecret,
          hasPromptPayId: !!payId
        }
      }, { status: 500 })
    }

    // Determine PromptPay type (phone or citizen_id)
    const promptPayType = payId.length === 10 ? 'phone_number' : 'citizen_id'

    // Call Slip2Go API
    const response = await fetch('https://api.slip2go.com/api/qr-payment/generate-qr-code', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': apiSecret,
      },
      body: JSON.stringify({
        promptPayCode: payId,
        promptPayType,
        accountName: payName || 'Clinic-Q Platform',
        amount: parseFloat(amount).toFixed(2),
      }),
    })

    const data = await response.json()

    if (data.code !== '200') {
      return NextResponse.json({ 
        error: data.message || 'เกิดข้อผิดพลาดในการสร้าง QR Code',
        slip2goCode: data.code 
      }, { status: 400 })
    }

    return NextResponse.json({
      qrCode: data.data.qrCode,
      accountName: data.data.accountName,
      amount: data.data.amount,
    })
  } catch (error) {
    console.error('Slip2Go QR generation error:', error)
    return NextResponse.json({ error: 'เกิดข้อผิดพลาดของระบบ' }, { status: 500 })
  }
}
