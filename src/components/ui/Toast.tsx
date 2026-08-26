'use client'

import { useEffect } from 'react'
import { CheckCircle, XCircle, Info, X } from 'lucide-react'
import { clsx } from 'clsx'

interface ToastProps {
  message: string
  type?: 'success' | 'error' | 'info'
  onClose: () => void
}

const icons = {
  success: CheckCircle,
  error: XCircle,
  info: Info,
}

const styles = {
  success: 'bg-green-50 border-green-200 text-green-800',
  error: 'bg-red-50 border-red-200 text-red-800',
  info: 'bg-blue-50 border-blue-200 text-blue-800',
}

const iconColors = {
  success: 'text-green-500',
  error: 'text-red-500',
  info: 'text-blue-500',
}

export default function Toast({ message, type = 'success', onClose }: ToastProps) {
  const Icon = icons[type]

  useEffect(() => {
    const timer = setTimeout(onClose, 3000)
    return () => clearTimeout(timer)
  }, [onClose])

  return (
    <div className="fixed top-4 right-4 z-[100] animate-slide-in-right">
      <div className={clsx(
        'flex items-center gap-3 px-4 py-3 rounded-xl border shadow-lg min-w-[280px]',
        styles[type]
      )}>
        <Icon className={clsx('w-5 h-5 flex-shrink-0', iconColors[type])} />
        <p className="text-sm font-medium flex-1">{message}</p>
        <button onClick={onClose} className="p-1 hover:bg-black/5 rounded-lg">
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}
