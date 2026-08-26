'use client'

import { createContext, useContext, useState, useCallback, type ReactNode } from 'react'
import { type RoomAssignment, type DayOfWeek } from './schedule-data'
import { getDefaultBranchData } from './branch-data'

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

// Generate demo assignments based on room configurations from branch-data
function generateDemoAssignments(): RoomAssignment[] {
  const assignments: RoomAssignment[] = []
  const today = new Date()
  const dayOfWeek = today.getDay()
  
  // Get room configurations from branch-data
  const branchData = getDefaultBranchData('dental')
  const { rooms, practitioners } = branchData

  // Map practitioners to their regular days
  const practitionerSchedule: Record<string, { regularDays: DayOfWeek[]; startTime: string; endTime: string; slotDuration: number }> = {
    'dr-somchai': { regularDays: [1, 2, 3, 4, 5], startTime: '09:00', endTime: '17:00', slotDuration: 30 },
    'dr-wichai': { regularDays: [1, 3, 5], startTime: '10:00', endTime: '18:00', slotDuration: 10 },
    'dr-sompong': { regularDays: [1, 2, 4], startTime: '09:00', endTime: '16:00', slotDuration: 60 },
    'dr-pim': { regularDays: [2, 3, 4, 5], startTime: '13:00', endTime: '20:00', slotDuration: 30 },
  }

  // Generate for this week (Mon-Fri)
  for (let offset = -dayOfWeek + 1; offset <= 5 - dayOfWeek; offset++) {
    const date = new Date(today)
    date.setDate(today.getDate() + offset)
    const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
    const dow = date.getDay() as DayOfWeek

    // For each room, generate slots based on the practitioner's schedule
    rooms.forEach(room => {
      const practitioner = practitioners.find(p => p.id === room.practitionerId)
      if (!practitioner) return

      const schedule = practitionerSchedule[room.practitionerId]
      if (!schedule) return

      // Check if practitioner works on this day
      if (!schedule.regularDays.includes(dow)) return

      // Use room's working hours and slot duration
      const [startH, startM] = room.workingStartTime.split(':').map(Number)
      const [endH, endM] = room.workingEndTime.split(':').map(Number)
      let current = startH * 60 + startM
      const end = endH * 60 + endM

      while (current + room.slotDuration <= end) {
        const slotId = `slot-${String(Math.floor(current / 60)).padStart(2, '0')}:${String(current % 60).padStart(2, '0')}-${String(Math.floor((current + room.slotDuration) / 60)).padStart(2, '0')}:${String((current + room.slotDuration) % 60).padStart(2, '0')}`

        assignments.push({
          id: `demo-${room.id}-${dateStr}-${slotId}`,
          date: dateStr,
          roomId: room.id,
          slotId,
          staffId: room.practitionerId,
          staffName: practitioner.name,
          isManual: false,
        })

        current += room.slotDuration
      }
    })
  }

  return assignments
}

export function ScheduleProvider({ children }: { children: ReactNode }) {
  const [assignments, setAssignments] = useState<RoomAssignment[]>(generateDemoAssignments)
  const [staff, setStaff] = useState<StaffInfo[]>([
    { id: 'dr-somchai', name: 'ทพ.สมบูรณ์ สุขใจ', role: 'doctor', regularDays: [1, 2, 3, 4, 5], branchId: 'dental-general', slotDuration: 30, startTime: '09:00', endTime: '17:00', active: true },
    { id: 'dr-wichai', name: 'ทพ.วิชัย มั่นคง', role: 'doctor', regularDays: [1, 3, 5], branchId: 'dental-ortho', slotDuration: 10, startTime: '10:00', endTime: '18:00', active: true },
    { id: 'dr-sompong', name: 'ทพ.สมพงษ์ กล้าแข็ง', role: 'doctor', regularDays: [1, 2, 4], branchId: 'dental-surgery', slotDuration: 60, startTime: '09:00', endTime: '16:00', active: true },
    { id: 'dr-pim', name: 'ทพ.หญิงพิมพ์ใจ รักสวย', role: 'doctor', regularDays: [2, 3, 4, 5], branchId: 'dental-general', slotDuration: 30, startTime: '13:00', endTime: '20:00', active: true },
    { id: 'nurse-ploy', name: 'สุภาพร พยาบาล', role: 'nurse', regularDays: [1, 2, 3, 4, 5], branchId: 'dental-general', slotDuration: 15, startTime: '08:00', endTime: '17:00', active: true },
  ])
  const [leaves, setLeaves] = useState<LeaveRequest[]>([])

  return (
    <ScheduleContext.Provider value={{ assignments, setAssignments, staff, setStaff, leaves, setLeaves }}>
      {children}
    </ScheduleContext.Provider>
  )
}
