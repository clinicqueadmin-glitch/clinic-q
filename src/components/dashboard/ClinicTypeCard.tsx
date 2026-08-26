'use client'

import { clsx } from 'clsx'
import { ArrowRight } from 'lucide-react'

interface ClinicTypeCardProps {
  name: string
  icon: React.ComponentType<{ className?: string }>
  color: string
  bg: string
  patients: number
}

export default function ClinicTypeCard({ 
  name, 
  icon: Icon, 
  color, 
  bg, 
  patients 
}: ClinicTypeCardProps) {
  return (
    <div className={clsx(
      'flex items-center justify-between p-3 rounded-lg cursor-pointer transition-colors',
      'hover:bg-gray-50'
    )}>
      <div className="flex items-center gap-3">
        <div className={clsx('w-10 h-10 rounded-lg flex items-center justify-center', bg)}>
          <Icon className={clsx('w-5 h-5', color)} />
        </div>
        <div>
          <p className="font-medium text-gray-900">{name}</p>
          <p className="text-sm text-gray-500">{patients} คิว</p>
        </div>
      </div>
      <ArrowRight className="w-4 h-4 text-gray-400" />
    </div>
  )
}
