'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { sendQueueCalledNotification, sendQueueCompletedNotification, sendQueueCancelledNotification, sendQueueServingNotification } from '@/lib/line-notification'

interface NotificationState {
  permission: NotificationPermission
  isSupported: boolean
  isServiceWorkerReady: boolean
  subscription: PushSubscription | null
}

export function useNotification() {
  const [state, setState] = useState<NotificationState>({
    permission: 'default',
    isSupported: false,
    isServiceWorkerReady: false,
    subscription: null,
  })
  const swRegistration = useRef<ServiceWorkerRegistration | null>(null)

  useEffect(() => {
    if (typeof window === 'undefined') return

    const isSupported = 'Notification' in window && 'serviceWorker' in navigator
    setState(prev => ({ ...prev, isSupported }))

    if (!isSupported) return

    // Register service worker
    navigator.serviceWorker.register('/sw.js')
      .then(reg => {
        swRegistration.current = reg
        setState(prev => ({ ...prev, isServiceWorkerReady: true }))
        // Check existing subscription
        return reg.pushManager.getSubscription()
      })
      .then(sub => {
        setState(prev => ({ ...prev, subscription: sub }))
      })
      .catch(err => {
        console.warn('Service Worker registration failed:', err)
      })

    // Check current permission
    setState(prev => ({ ...prev, permission: Notification.permission }))
  }, [])

  const requestPermission = useCallback(async (): Promise<NotificationPermission> => {
    if (!state.isSupported) return 'denied'
    const permission = await Notification.requestPermission()
    setState(prev => ({ ...prev, permission }))
    return permission
  }, [state.isSupported])

  // Play notification sound
  const playSound = useCallback((type: 'called' | 'completed' | 'cancelled' | 'alert') => {
    try {
      const ctx = new AudioContext()
      const notes: Record<string, number[]> = {
        called:    [523, 659, 784, 1047],  // C5 E5 G5 C6 — happy ascending
        completed:  [784, 659, 523],        // G5 E5 C5 — descending
        cancelled:  [440, 349, 294],        // A4 F4 D4 — descending sad
        alert:      [880, 880, 880],        // A5 × 3 — urgent
      }
      const freqs = notes[type] || notes.called
      freqs.forEach((freq, i) => {
        const osc = ctx.createOscillator()
        const gain = ctx.createGain()
        osc.connect(gain)
        gain.connect(ctx.destination)
        osc.frequency.value = freq
        osc.type = 'sine'
        gain.gain.setValueAtTime(0.3, ctx.currentTime + i * 0.15)
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + i * 0.15 + 0.3)
        osc.start(ctx.currentTime + i * 0.15)
        osc.stop(ctx.currentTime + i * 0.15 + 0.3)
      })
    } catch {
      // Silent fail if audio not available
    }
  }, [])

  const sendNotification = useCallback(async (options: {
    title: string
    body: string
    icon?: string
    tag?: string
    url?: string
    vibrate?: number[]
    sound?: 'called' | 'completed' | 'cancelled' | 'alert'
  }) => {
    // Always play sound locally
    if (options.sound) {
      playSound(options.sound)
    }

    if (state.permission !== 'granted') return false

    // Try using service worker for better notification
    if (swRegistration.current) {
      try {
        await swRegistration.current.showNotification(options.title, {
          body: options.body,
          icon: options.icon || '/icons/icon-192.png',
          badge: '/icons/icon-192.png',
          tag: options.tag || 'clinic-q',
          requireInteraction: true,
          vibrate: options.vibrate || [200, 100, 200],
          data: { url: options.url || '/track' },
          actions: [
            { action: 'open', title: 'เปิดดูคิว' },
            { action: 'dismiss', title: 'ปิด' },
          ],
        } as any)
        return true
      } catch {
        // Fallback to basic notification
      }
    }

    // Fallback: basic Notification API
    try {
      const n = new Notification(options.title, {
        body: options.body,
        icon: options.icon || '/icons/icon-192.png',
        tag: options.tag || 'clinic-q',
      })
      n.onclick = () => {
        window.focus()
        n.close()
      }
      return true
    } catch {
      return false
    }
  }, [state.permission, state.isServiceWorkerReady, playSound])

  // Queue notification — called when status changes to 'serving'
  const notifyQueueCalled = useCallback(async (queueNumber: string, roomNumber: number, patientName: string, phone?: string, practitionerName?: string) => {
    // Send browser notification
    const browserResult = await sendNotification({
      title: `🏥 ถึงคิว ${queueNumber} แล้ว!`,
      body: `กรุณาเข้าห้องตรวจที่ ${roomNumber} — ${patientName}`,
      tag: `queue-called-${queueNumber}`,
      url: `/track`,
      vibrate: [300, 100, 300, 100, 300],
      sound: 'called',
    })

    // Send LINE notification if phone is provided
    if (phone) {
      try {
        await sendQueueCalledNotification(phone, queueNumber, patientName, roomNumber, practitionerName)
      } catch (error) {
        console.error('Failed to send LINE notification:', error)
      }
    }

    return browserResult
  }, [sendNotification])

  // Queue completed notification
  const notifyQueueCompleted = useCallback(async (queueNumber: string, patientName?: string, phone?: string) => {
    // Send browser notification
    const browserResult = await sendNotification({
      title: `✅ คิว ${queueNumber} เสร็จสิ้น`,
      body: 'การให้บริการเสร็จสิ้นแล้ว',
      tag: `queue-done-${queueNumber}`,
      sound: 'completed',
    })

    // Send LINE notification if phone and patientName are provided
    if (phone && patientName) {
      try {
        await sendQueueCompletedNotification(phone, queueNumber, patientName)
      } catch (error) {
        console.error('Failed to send LINE notification:', error)
      }
    }

    return browserResult
  }, [sendNotification])

  // Queue cancelled notification
  const notifyQueueCancelled = useCallback(async (queueNumber: string, patientName?: string, phone?: string, reason?: string) => {
    // Send browser notification
    const browserResult = await sendNotification({
      title: `❌ คิว ${queueNumber} ถูกยกเลิก`,
      body: reason ? `เหตุผล: ${reason}` : 'คิวถูกยกเลิก',
      tag: `queue-cancelled-${queueNumber}`,
      sound: 'cancelled',
    })

    // Send LINE notification if phone and patientName are provided
    if (phone && patientName) {
      try {
        await sendQueueCancelledNotification(phone, queueNumber, patientName)
      } catch (error) {
        console.error('Failed to send LINE notification:', error)
      }
    }

    return browserResult
  }, [sendNotification])

  // Overtime alert
  const notifyOvertime = useCallback(async (queueNumber: string, roomNumber: number, minutes: number) => {
    return sendNotification({
      title: `⚠️ คิว ${queueNumber} ใช้เวลานาน!`,
      body: `ห้อง ${roomNumber} — ทำหัตถการเกิน ${minutes} นาที`,
      tag: `overtime-${queueNumber}`,
      url: '/track',
      vibrate: [500, 200, 500],
      sound: 'alert',
    })
  }, [sendNotification])

  return {
    ...state,
    requestPermission,
    sendNotification,
    playSound,
    notifyQueueCalled,
    notifyQueueCompleted,
    notifyQueueCancelled,
    notifyOvertime,
  }
}
