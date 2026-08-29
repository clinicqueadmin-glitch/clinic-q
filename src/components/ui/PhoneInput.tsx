'use client'

import { useState } from 'react'
import { Phone, AlertCircle } from 'lucide-react'

interface PhoneInputProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  className?: string
  label?: string
  required?: boolean
  disabled?: boolean
  id?: string
  showIcon?: boolean
}

export default function PhoneInput({
  value,
  onChange,
  placeholder = '0xx-xxx-xxxx',
  className = '',
  label,
  required = false,
  disabled = false,
  id,
  showIcon = false,
}: PhoneInputProps) {
  const [touched, setTouched] = useState(false)

  // Strip non-digits
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/\D/g, '')
    // Max 10 digits
    if (raw.length <= 10) {
      onChange(raw)
    }
  }

  // Format as 0xx-xxx-xxxx for display
  const formatDisplay = (digits: string) => {
    if (!digits) return ''
    if (digits.length <= 3) return digits
    if (digits.length <= 6) return `${digits.slice(0, 3)}-${digits.slice(3)}`
    return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6, 10)}`
  }

  const isValid = value.length === 0 || value.length === 10
  const showError = touched && value.length > 0 && value.length !== 10

  return (
    <div>
      {label && (
        <label className="block text-sm font-medium text-gray-700 mb-1">
          {showIcon && <Phone className="w-4 h-4 inline mr-1" />}
          {label}
          {required && ' *'}
        </label>
      )}
      <input
        id={id}
        type="tel"
        inputMode="numeric"
        pattern="[0-9]*"
        maxLength={13}
        value={formatDisplay(value)}
        onChange={handleChange}
        onBlur={() => setTouched(true)}
        placeholder={placeholder}
        disabled={disabled}
        className={`w-full px-3 py-2 rounded-xl border text-sm focus:outline-none focus:ring-2 transition-colors ${
          showError
            ? 'border-red-300 focus:ring-red-200 focus:border-red-400 bg-red-50/50'
            : 'border-gray-200 focus:ring-indigo-200 focus:border-indigo-400'
        } ${className}`}
      />
      {showError && (
        <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
          <AlertCircle className="w-3 h-3" />
          กรุณากรอกเบอร์โทรศัพท์ 10 หลัก
        </p>
      )}
      {!showError && value.length > 0 && value.length < 10 && (
        <p className="text-xs text-gray-400 mt-1">
          {value.length}/10 หลัก
        </p>
      )}
    </div>
  )
}
