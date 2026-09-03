'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { sendQueueCalledNotification, sendQueueCompletedNotification, sendQueueCancelledNotification, sendQueueServingNotification } from '@/lib/line-notification'

interface NotificationState {
  permission: NotificationPermission
  isSupported: boolean
  isServiceWorkerReady: boolean
  subscription: PushSubscription | null
}

// Singleton AudioContext for better browser compatibility
let sharedAudioCtx: AudioContext | null = null
function getAudioCtx(): AudioContext {
  if (!sharedAudioCtx) sharedAudioCtx = new AudioContext()
  if (sharedAudioCtx.state === 'suspended') sharedAudioCtx.resume()
  return sharedAudioCtx
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

    // Preload TTS voices (some browsers need this)
    if ('speechSynthesis' in window) {
      window.speechSynthesis.getVoices()
      window.speechSynthesis.onvoiceschanged = () => window.speechSynthesis.getVoices()
    }

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
      const ctx = getAudioCtx()
      const now = ctx.currentTime
      
      const melodies: Record<string, { freq: number; start: number; dur: number; type?: OscillatorType }[]> = {
        // เรียกคิว: 4 โน้ตสูงขึ้น เสียงดังชัด
        called: [
          { freq: 523, start: 0, dur: 0.18 },     // C5
          { freq: 659, start: 0.15, dur: 0.18 },   // E5
          { freq: 784, start: 0.30, dur: 0.18 },   // G5
          { freq: 1047, start: 0.45, dur: 0.35 },  // C6 (hold longer)
        ],
        // เสร็จสิ้น: 3 โน้ตลง
        completed: [
          { freq: 784, start: 0, dur: 0.15 },
          { freq: 659, start: 0.12, dur: 0.15 },
          { freq: 523, start: 0.24, dur: 0.25 },
        ],
        // ยกเลิก: 3 โน้ตลงเศร้า
        cancelled: [
          { freq: 440, start: 0, dur: 0.15 },
          { freq: 349, start: 0.12, dur: 0.15 },
          { freq: 294, start: 0.24, dur: 0.25 },
        ],
        // เตือน: 3 เสียงสั้น
        alert: [
          { freq: 880, start: 0, dur: 0.1 },
          { freq: 880, start: 0.15, dur: 0.1 },
          { freq: 880, start: 0.30, dur: 0.15 },
        ],
      }
      
      const notes = melodies[type] || melodies.called
      notes.forEach(({ freq, start, dur }) => {
        const osc = ctx.createOscillator()
        const gain = ctx.createGain()
        osc.connect(gain)
        gain.connect(ctx.destination)
        osc.frequency.value = freq
        osc.type = 'sine'
        gain.gain.setValueAtTime(0.5, now + start)
        gain.gain.exponentialRampToValueAtTime(0.01, now + start + dur)
        osc.start(now + start)
        osc.stop(now + start + dur)
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

  // Speak announcement using TTS (Thai)
  const speakAnnouncement = useCallback((text: string) => {
    try {
      if ('speechSynthesis' in window) {
        // Cancel any ongoing speech
        window.speechSynthesis.cancel()
        const utterance = new SpeechSynthesisUtterance(text)
        utterance.lang = 'th-TH'
        utterance.rate = 0.9
        utterance.pitch = 1.0
        utterance.volume = 1.0
        // Try to find a Thai voice
        const voices = window.speechSynthesis.getVoices()
        const thaiVoice = voices.find(v => v.lang.startsWith('th'))
        if (thaiVoice) utterance.voice = thaiVoice
        window.speechSynthesis.speak(utterance)
      }
    } catch {
      // Silent fail if TTS not available
    }
  }, [])

  // Queue notification — called when status changes to 'serving'
  const notifyQueueCalled = useCallback(async (queueNumber: string, roomNumber: number, patientName: string, phone?: string, practitionerName?: string) => {
    // Play melody sound first, then speak announcement
    playSound('called')
    // Wait for melody to finish (~0.8s) then speak
    setTimeout(() => {
      speakAnnouncement(`ขอเชิญคิวที่ ${queueNumber} เข้าห้องตรวจที่ ${roomNumber}`)
    }, 900)

    // Send browser notification
    const browserResult = await sendNotification({
      title: `🏥 ถึงคิว ${queueNumber} แล้ว!`,
      body: `กรุณาเข้าห้องตรวจที่ ${roomNumber} — ${patientName}`,
      tag: `queue-called-${queueNumber}`,
      url: `/track`,
      vibrate: [300, 100, 300, 100, 300],
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
  }, [sendNotification, playSound, speakAnnouncement])

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
