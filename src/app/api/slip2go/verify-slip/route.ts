import { NextRequest, NextResponse } from 'next/server'

/**
 * Slip2Go Slip Verification API
 * POST /api/slip2go/verify-slip
 * 
 * Body: { qrCode: string, checkDuplicate?: boolean }
 * 
 * Returns: { verified: boolean, data?: SlipData, error?: string }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { qrCode, checkDuplicate = false } = body

    if (!qrCode) {
      return NextResponse.json({ error: 'กรุณาแนบรหัส QR Code หรือสลิป' }, { status: 400 })
    }

    const apiSecret = process.env.SLIP2GO_API_SECRET
    const expectedAmount = body.expectedAmount

    if (!apiSecret) {
      return NextResponse.json({ 
        error: 'กรุณาตั้งค่า Slip2Go API Secret ใน .env.local' 
      }, { status: 500 })
    }

    // Build check conditions
    const checkCondition: Record<string, unknown> = {}

    if (checkDuplicate) {
      checkCondition.checkDuplicate = true
    }

    if (expectedAmount) {
      checkCondition.checkAmount = {
        type: 'eq',
        amount: String(expectedAmount),
      }
    }

    // Call Slip2Go API
    const response = await fetch('https://api.slip2go.com/api/verify-slip/qr-code/info', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': apiSecret,
      },
      body: JSON.stringify({
        payload: {
          qrCode,
          ...(Object.keys(checkCondition).length > 0 ? { checkCondition } : {}),
        },
      }),
    })

    const data = await response.json()

    if (data.code !== '200000') {
      return NextResponse.json({
        verified: false,
        error: data.message || 'ไม่พบสลิปโอนเงิน',
        slip2goCode: data.code,
      })
    }

    const slip = data.data

    return NextResponse.json({
      verified: true,
      data: {
        referenceId: slip.referenceId,
        transRef: slip.transRef,
        dateTime: slip.dateTime,
        amount: slip.amount,
        senderName: slip.sender?.account?.name || '',
        senderBank: slip.sender?.bank?.name || '',
        receiverName: slip.receiver?.account?.name || '',
        receiverBank: slip.receiver?.bank?.name || '',
      },
    })
  } catch (error) {
    console.error('Slip2Go verification error:', error)
    return NextResponse.json({ verified: false, error: 'เกิดข้อผิดพลาดของระบบ' }, { status: 500 })
  }
}
