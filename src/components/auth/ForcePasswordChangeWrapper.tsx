'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/lib/auth-context'
import ForcePasswordChange from './ForcePasswordChange'

export default function ForcePasswordChangeWrapper() {
  const { forcePasswordChange, session } = useAuth()
  const [showModal, setShowModal] = useState(false)

  useEffect(() => {
    if (forcePasswordChange && session?.user) {
      setShowModal(true)
    }
  }, [forcePasswordChange, session])

  const handleComplete = () => {
    setShowModal(false)
  }

  return (
    <ForcePasswordChange
      isOpen={showModal}
      onComplete={handleComplete}
    />
  )
}
