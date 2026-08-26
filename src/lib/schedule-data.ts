/* ─────────────────────────────────────────────────────
   Clinic-Q Schedule Data Types & Utilities
   ───────────────────────────────────────────────────── */

export type DayOfWeek = 0 | 1 | 2 | 3 | 4 | 5 | 6 // 0=Sunday

export interface WorkingSchedule {
  days: DayOfWeek[]       // which days the staff works
  startTime: string       // "HH:MM" e.g. "10:00"
  endTime: string         // "HH:MM" e.g. "19:00"
}

export interface StaffScheduleEntry {
  staffId: string
  staffName: string
  role: 'doctor' | 'nurse' | 'staff'
  workingSchedule: WorkingSchedule
  active: boolean
}

export interface TimeSlot {
  id: string
  startTime: string       // "HH:MM"
  endTime: string         // "HH:MM"
  duration: number        // minutes
}

export interface RoomAssignment {
  id: string
  date: string            // "YYYY-MM-DD"
  roomId: number          // 1-5
  slotId: string          // reference to TimeSlot
  staffId: string
  staffName: string
  isManual: boolean       // true = manually assigned, false = auto-generated
  note?: string
}

export interface Room {
  id: number
  name: string
  color: string
}

export const MAX_ROOMS = 5

export const ROOMS: Room[] = [
  { id: 1, name: 'ห้อง 1', color: '#93C5FD' },
  { id: 2, name: 'ห้อง 2', color: '#A7F3D0' },
  { id: 3, name: 'ห้อง 3', color: '#FCD34D' },
  { id: 4, name: 'ห้อง 4', color: '#FDA4AF' },
  { id: 5, name: 'ห้อง 5', color: '#D8B4FE' },
]

export const SLOT_DURATIONS = [10, 15, 30, 45, 60] as const
export type SlotDuration = typeof SLOT_DURATIONS[number]

export const DAY_NAMES_SHORT = ['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส']
export const DAY_NAMES_FULL = ['อาทิตย์', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์']

export const MONTH_NAMES_TH = [
  'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน',
  'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม',
  'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม',
]

/* ─────── Utility Functions ─────── */

/** Generate time slots for a given start/end time and duration */
export function generateTimeSlots(startTime: string, endTime: string, durationMinutes: number): TimeSlot[] {
  const slots: TimeSlot[] = []
  const [startH, startM] = startTime.split(':').map(Number)
  const [endH, endM] = endTime.split(':').map(Number)

  let currentMinutes = startH * 60 + startM
  const endMinutes = endH * 60 + endM

  while (currentMinutes + durationMinutes <= endMinutes) {
    const slotStart = formatMinutes(currentMinutes)
    const slotEnd = formatMinutes(currentMinutes + durationMinutes)
    slots.push({
      id: `slot-${slotStart}-${slotEnd}`,
      startTime: slotStart,
      endTime: slotEnd,
      duration: durationMinutes,
    })
    currentMinutes += durationMinutes
  }

  return slots
}

/** Format minutes since midnight to "HH:MM" */
export function formatMinutes(totalMinutes: number): string {
  const h = Math.floor(totalMinutes / 60)
  const m = totalMinutes % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

/** Get day of week (0=Sunday) for a date string "YYYY-MM-DD" */
export function getDayOfWeek(dateStr: string): DayOfWeek {
  return new Date(dateStr).getDay() as DayOfWeek
}

/** Format date to "YYYY-MM-DD" */
export function formatDateKey(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

/** Get all days in a month */
export function getDaysInMonth(year: number, month: number): Date[] {
  const days: Date[] = []
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  for (let d = 1; d <= daysInMonth; d++) {
    days.push(new Date(year, month, d))
  }
  return days
}

/** Get the first day of week offset for a month (0=Sunday) */
export function getFirstDayOffset(year: number, month: number): number {
  return new Date(year, month, 1).getDay()
}

/** Check if a staff member works on a given day */
export function isWorkingDay(schedule: WorkingSchedule, dateStr: string): boolean {
  const dow = getDayOfWeek(dateStr)
  return schedule.days.includes(dow)
}

/** Generate auto-assigned slots for a staff member for a date range */
export function generateAutoAssignments(
  staff: StaffScheduleEntry,
  dates: string[],
  slotDuration: number,
  existingManual: RoomAssignment[]
): RoomAssignment[] {
  const assignments: RoomAssignment[] = []

  for (const dateStr of dates) {
    // Skip if this date already has a manual assignment for this staff
    const hasManualOnDate = existingManual.some(
      a => a.date === dateStr && a.staffId === staff.staffId
    )
    if (hasManualOnDate) continue

    // Skip if staff doesn't work on this day
    if (!isWorkingDay(staff.workingSchedule, dateStr)) continue

    const slots = generateTimeSlots(
      staff.workingSchedule.startTime,
      staff.workingSchedule.endTime,
      slotDuration
    )

    // Assign to first available room (round-robin)
    for (let i = 0; i < slots.length; i++) {
      const roomId = (i % MAX_ROOMS) + 1
      assignments.push({
        id: `auto-${staff.staffId}-${dateStr}-${slots[i].id}`,
        date: dateStr,
        roomId,
        slotId: slots[i].id,
        staffId: staff.staffId,
        staffName: staff.staffName,
        isManual: false,
      })
    }
  }

  return assignments
}

/** Get Chinese/Buddhist year (Thai calendar) */
export function getThaiYear(date: Date): number {
  return date.getFullYear() + 543
}
