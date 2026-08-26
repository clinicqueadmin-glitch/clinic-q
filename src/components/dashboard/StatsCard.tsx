'use client'

import { ArrowUpRight, ArrowDownRight } from 'lucide-react'
import { clsx } from 'clsx'

interface StatsCardProps {
  title: string
  value: string
  change: string
  trend: 'up' | 'down'
  icon: React.ComponentType<{ className?: string }>
  color: string
  bg: string
}

export default function StatsCard({ 
  title, 
  value, 
  change, 
  trend, 
  icon: Icon, 
  color, 
  bg 
}: StatsCardProps) {
  return (
    <div className="stat-card hover-lift">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-gray-500 mb-1">{title}</p>
          <p className="text-2xl md:text-3xl font-bold text-gray-900">{value}</p>
        </div>
        <div className={clsx('w-12 h-12 rounded-xl flex items-center justify-center', bg)}>
          <Icon className={clsx('w-6 h-6', color)} />
        </div>
      </div>
      <div className="mt-4 flex items-center gap-2">
        {trend === 'up' ? (
          <ArrowUpRight className="w-4 h-4 text-green-500" />
        ) : (
          <ArrowDownRight className="w-4 h-4 text-green-500" />
        )}
        <span className={clsx(
          'text-sm font-medium',
          trend === 'up' ? 'text-green-500' : 'text-green-500'
        )}>
          {change}
        </span>
        <span className="text-sm text-gray-500">จากเมื่อวาน</span>
      </div>
    </div>
  )
}
