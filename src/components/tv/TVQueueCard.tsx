'use client'

import { clsx } from 'clsx'
import type { QueueItem } from '@/lib/queue-data'

interface TVQueueCardProps {
  item: QueueItem
  clinic: {
    name: string
    nameEn: string
    color: string
    bg: string
    icon: string
    prefix: string
  }
  variant: 'serving' | 'waiting'
  size: 'large' | 'small'
}

export default function TVQueueCard({ item, clinic, variant, size }: TVQueueCardProps) {
  const isLarge = size === 'large'

  return (
    <div
      className={clsx(
        'rounded-xl border-2 transition-all duration-300',
        variant === 'serving'
          ? 'bg-gradient-to-br from-white/10 to-white/5 border-green-500/50 shadow-lg shadow-green-500/10'
          : 'bg-white/5 border-white/10 hover:border-white/20'
      )}
    >
      {isLarge ? (
        /* Large Card — for "Now Serving" panel */
        <div className="p-5">
          <div className="flex items-start justify-between mb-4">
            {/* Queue Number */}
            <div
              className="flex flex-col items-center justify-center rounded-xl px-5 py-3 font-bold"
              style={{ backgroundColor: clinic.color + '20', color: clinic.color }}
            >
              <span className="text-3xl leading-none font-mono">{item.number}</span>
            </div>
            
            {/* Clinic Badge */}
            <div
              className="flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium"
              style={{ backgroundColor: clinic.bg, color: clinic.color }}
            >
              <span>{clinic.icon}</span>
              <span>{clinic.nameEn}</span>
            </div>
          </div>

          {/* Patient Name */}
          <p className="text-xl font-semibold text-white mb-2 truncate">{item.patientName}</p>

          {/* Info Row */}
          <div className="flex items-center gap-3 text-sm text-gray-400">
            {item.doctor && (
              <span className="truncate">{item.doctor}</span>
            )}
            {item.calledAt && (
              <span className="ml-auto tabular-nums text-green-400 text-xs">
                เรียก {item.calledAt}
              </span>
            )}
          </div>

          {/* Pulse indicator */}
          {variant === 'serving' && (
            <div className="mt-4 flex items-center gap-2">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
              <span className="text-xs text-green-400 font-medium">กำลังให้บริการ</span>
            </div>
          )}
        </div>
      ) : (
        /* Small Card — for waiting list */
        <div className="flex items-center gap-3 px-3 py-2.5">
          {/* Queue Number */}
          <div
            className="w-10 h-10 rounded-lg flex items-center justify-center font-bold text-sm flex-shrink-0"
            style={{ backgroundColor: clinic.color + '20', color: clinic.color }}
          >
            {item.number}
          </div>

          {/* Patient Info */}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-white truncate">{item.patientName}</p>
            <p className="text-xs text-gray-500">{item.time}</p>
          </div>

          {/* Waiting indicator */}
          <div className="flex-shrink-0">
            <div className="w-2 h-2 bg-yellow-500 rounded-full animate-pulse" />
          </div>
        </div>
      )}
    </div>
  )
}
