import { NextRequest, NextResponse } from 'next/server'
import { getAdminClient } from '@/lib/supabase-admin'
import { applySubscriptionPayment } from '@/lib/subscription-store'
import { notifyPlatformOwner } from '@/lib/platform-notify'

/**
 * Slip2Go Slip Verification API
 * POST /api/slip2go/verify-slip
 *
 * Body: { qrCode: string, expectedAmount?: number, checkDuplicate?: boolean,
 *         clinicId?: string, plan?: 'monthly' | 'yearly' }
 *
 * Returns: { verified: boolean, data?: SlipData, subscription?, error?: string }
 *
 * When `clinicId` + `plan` are supplied and the slip verifies, the package is
 * recorded in `clinic_settings('subscription')` (service role, server-side) and
 * the Platform Owner is alerted. Both steps are idempotent and strictly
 * best-effort: a failure there never changes the verification outcome.
 */

function formatThaiDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('th-TH', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      timeZone: 'Asia/Bangkok',
    })
  } catch {
    return iso
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { qrCode, checkDuplicate = false } = body
    const clinicId = typeof body?.clinicId === 'string' ? body.clinicId.trim() : ''
    const plan = typeof body?.plan === 'string' && body.plan ? body.plan : ''

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

    // ── Record the package purchase (idempotent, best effort) ──────
    // A failure here must never turn a verified payment into an error, so the
    // whole block is swallowed and only the verification result is trusted.
    let subscription: Awaited<ReturnType<typeof applySubscriptionPayment>> | null = null
    if (clinicId && plan) {
      try {
        subscription = await applySubscriptionPayment({
          clinicId,
          plan,
          amount: Number(slip.amount ?? expectedAmount) || 0,
          paymentRef: slip.referenceId || '',
          transactionId: slip.transRef || '',
          paidAt: slip.dateTime || undefined,
        })
      } catch (error) {
        console.error('[verify-slip] subscription persist failed:', error)
      }

      // Only alert when this call actually recorded a new payment.
      if (subscription?.ok && subscription.updated && !subscription.alreadyProcessed) {
        try {
          const admin = getAdminClient()
          let clinicName = clinicId
          if (admin) {
            const { data: clinicRow } = await admin
              .from('clinics')
              .select('name')
              .eq('id', clinicId)
              .limit(1)
              .maybeSingle()
            const clinicData = clinicRow as { name?: string } | null
            if (clinicData?.name) clinicName = clinicData.name
          }
          await notifyPlatformOwner({
            title: '💳 มีคลินิกซื้อ Package สำเร็จ',
            lines: [
              `คลินิก: ${clinicName}`,
              `Package: ${plan === 'yearly' ? 'รายปี' : 'รายเดือน'}`,
              `จำนวนเงิน: ฿${Number(slip.amount ?? expectedAmount) || 0}`,
              `วันที่ชำระ: ${formatThaiDate(slip.dateTime || new Date().toISOString())}`,
              subscription.subscription?.paidEndDate
                ? `ใช้ได้ถึง: ${formatThaiDate(subscription.subscription.paidEndDate)}`
                : 'ใช้ได้ถึง: -',
              `Ref: ${slip.referenceId || '-'}`,
              `Trans: ${slip.transRef || '-'}`,
            ],
          })
        } catch (error) {
          // Alert failure only — the payment is already recorded above.
          console.error('[verify-slip] platform notify failed:', error)
        }
      }
    }

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
      subscription: subscription
        ? {
            recorded: !!subscription.updated,
            alreadyProcessed: !!subscription.alreadyProcessed,
            paidEndDate: subscription.subscription?.paidEndDate || null,
          }
        : null,
    })
  } catch (error) {
    console.error('Slip2Go verification error:', error)
    return NextResponse.json({ verified: false, error: 'เกิดข้อผิดพลาดของระบบ' }, { status: 500 })
  }
}
