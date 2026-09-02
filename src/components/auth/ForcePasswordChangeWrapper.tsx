'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/lib/auth-context'
import ForcePasswordChange from './ForcePasswordChange'
import SetupGuide from '@/components/guide/SetupGuide'

export default function ForcePasswordChangeWrapper() {
  const { forcePasswordChange, session } = useAuth()
  const [showModal, setShowModal] = useState(false)
  const [showGuide, setShowGuide] = useState(false)

  useEffect(() => {
    if (forcePasswordChange && session?.user) {
      setShowModal(true)
    }
  }, [forcePasswordChange, session])

  const handleComplete = () => {
    setShowModal(false)
    // Show setup guide after password change for owner/manager
    if (session?.user) {
      setShowGuide(true)
    }
  }

  return (
    <>
      <ForcePasswordChange
        isOpen={showModal}
        onComplete={handleComplete}
      />
      <SetupGuide
        open={showGuide}
        onClose={() => setShowGuide(false)}
      />
    </>
  )
}
