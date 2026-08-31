'use client'

import { useEffect, useState } from 'react'
import { clsx } from 'clsx'
import { X } from 'lucide-react'
import type { QueueItem } from '@/lib/queue-context'

interface TVCalledAlertProps {
  queue: QueueItem
  clinic: {
    name: string
    nameEn: string
    color: string
    bg: string
    icon: string
    prefix: string
  }
  onDismiss: () => void
}

export default function TVCalledAlert({ queue, clinic, onDismiss }: TVCalledAlertProps) {
  const [phase, setPhase] = useState<'entering' | 'visible' | 'exiting'>('entering')

  useEffect(() => {
    // Enter animation
    const enterTimer = setTimeout(() => setPhase('visible'), 50)
    // Start exit after 7 seconds
    const exitTimer = setTimeout(() => setPhase('exiting'), 7000)
    // Remove after exit animation
    const removeTimer = setTimeout(() => onDismiss(), 7500)

    return () => {
      clearTimeout(enterTimer)
      clearTimeout(exitTimer)
      clearTimeout(removeTimer)
    }
  }, [onDismiss])

  return (
    <div
      className={clsx(
        'fixed inset-0 z-50 flex items-center justify-center transition-all duration-500',
        phase === 'entering' && 'opacity-0 scale-95',
        phase === 'visible' && 'opacity-100 scale-100',
        phase === 'exiting' && 'opacity-0 scale-105',
      )}
      onClick={onDismiss}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/80 backdrop-blur-md" />

      {/* Content */}
      <div className="relative z-10 text-center animate-fade-in">
        {/* Close button */}
        <button
          onClick={(e) => { e.stopPropagation(); onDismiss() }}
          className="absolute -top-12 right-0 p-2 bg-white/10 hover:bg-white/20 rounded-full transition-colors"
        >
          <X className="w-5 h-5 text-white/70" />
        </button>

        {/* Main alert */}
        <div className="mb-6">
          <p className="text-xl text-gray-400 uppercase tracking-[0.3em] mb-4 font-medium">
            🔔 เรียกคิว
          </p>
        </div>

        {/* Queue Number — BIG */}
        <div
          className="inline-flex flex-col items-center justify-center rounded-3xl px-12 py-8 mb-6 border-4"
          style={{
            backgroundColor: clinic.color + '30',
            borderColor: clinic.color,
            boxShadow: `0 0 80px ${clinic.color}40, 0 0 160px ${clinic.color}20`,
          }}
        >
          <span
            className="text-8xl md:text-9xl font-mono font-black tabular-nums leading-none"
            style={{ color: clinic.color }}
          >
            {queue.number}
          </span>
        </div>

        {/* Procedure — NOT patient name */}
        <h2 className="text-2xl md:text-3xl font-bold text-white mb-3">
          📋 {queue.procedure || 'หัตถการ'}
        </h2>

        {/* Clinic Info */}
        <div
          className="inline-flex items-center gap-2 px-5 py-2 rounded-full text-lg font-medium"
          style={{ backgroundColor: clinic.bg, color: clinic.color }}
        >
          <span className="text-xl">{clinic.icon}</span>
          <span>{clinic.name}</span>
        </div>

        {/* Doctor */}
        {'assignedDoctor' in queue && (queue as any).assignedDoctor && (
          <p className="mt-4 text-gray-400 text-lg">
            {(queue as any).assignedDoctor}
          </p>
        )}

        {/* Instruction */}
        <p className="mt-8 text-sm text-gray-500">
          กดปุ่ม Space หรือคลิกเพื่อเรียกคิวถัดไป
        </p>
      </div>

      {/* Decorative pulse rings */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="absolute rounded-full border-2"
            style={{
              borderColor: clinic.color + '30',
              width: `${200 + i * 120}px`,
              height: `${200 + i * 120}px`,
              animation: `ping 2s cubic-bezier(0, 0, 0.2, 1) ${i * 0.5}s infinite`,
            }}
          />
        ))}
      </div>

      <style jsx>{`
        @keyframes ping {
          75%, 100% {
            transform: scale(2);
            opacity: 0;
          }
        }
        @keyframes fade-in {
          from {
            opacity: 0;
            transform: scale(0.9);
          }
          to {
            opacity: 1;
            transform: scale(1);
          }
        }
        .animate-fade-in {
          animation: fade-in 0.5s ease-out forwards;
        }
      `}</style>
    </div>
  )
}
