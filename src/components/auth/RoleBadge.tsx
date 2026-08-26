'use client'

import { type ClinicRole, roleConfig } from '@/lib/auth-types'

export default function RoleBadge({ role, size = 'sm' }: { role: ClinicRole; size?: 'sm' | 'md' | 'lg' }) {
  const config = roleConfig[role]
  if (!config) return null

  const sizeClasses = {
    sm: 'text-[10px] px-2 py-0.5',
    md: 'text-xs px-2.5 py-1',
    lg: 'text-sm px-3 py-1.5',
  }

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full font-medium ${sizeClasses[size]}`}
      style={{ backgroundColor: config.bgColor, color: config.color }}
    >
      <span>{config.icon}</span>
      <span>{config.label}</span>
    </span>
  )
}
