'use client'

import { createContext, useContext, useState, useCallback, type ReactNode } from 'react'
import { type RoomAssignment, type DayOfWeek } from './schedule-data'

export interface StaffInfo {
  id: string
  name: string
  role: 'doctor' | 'nurse' | 'staff'
  regularDays: DayOfWeek[]
  branchId: string
  slotDuration: number
  startTime: string
  endTime: string
  active: boolean
}

export interface LeaveRequest {
  id: string
  staffId: string
  staffName: string
  dates: string[]
  reason: string
  status: 'pending' | 'approved' | 'rejected'
  requestedAt: string
}

interface ScheduleContextType {
  assignments: RoomAssignment[]
  setAssignments: React.Dispatch<React.SetStateAction<RoomAssignment[]>>
  staff: StaffInfo[]
  setStaff: React.Dispatch<React.SetStateAction<StaffInfo[]>>
  leaves: LeaveRequest[]
  setLeaves: React.Dispatch<React.SetStateAction<LeaveRequest[]>>
}

const ScheduleContext = createContext<ScheduleContextType | null>(null)

export function useSchedule() {
  const ctx = useContext(ScheduleContext)
  if (!ctx) throw new Error('useSchedule must be used within ScheduleProvider')
  return ctx
}

// No demo data - schedule starts empty
function generateDemoAssignments(): RoomAssignment[] {
  return []
}

export function ScheduleProvider({ children }: { children: ReactNode }) {
  const [assignments, setAssignments] = useState<RoomAssignment[]>(generateDemoAssignments)
  const [staff, setStaff] = useState<StaffInfo[]>([])
  const [leaves, setLeaves] = useState<LeaveRequest[]>([])

  return (
    <ScheduleContext.Provider value={{ assignments, setAssignments, staff, setStaff, leaves, setLeaves }}>
      {children}
    </ScheduleContext.Provider>
  )
}
