/* ─────────────────────────────────────────────────────
   Clinic-Q Booking System Data
   3 modes: Walk-in, Remote, Appointment
   ───────────────────────────────────────────────────── */

export type BookingMode = 'walkin' | 'remote' | 'appointment'

export interface BookingProcedure {
  id: string
  name: string
  category: string
  /** Which staff roles can perform this procedure */
  compatibleRoles: string[]
  /** Preferred room types (empty = any) */
  preferredRooms?: number[]
  /** Average duration in minutes */
  estimatedDuration: number
}

export interface QueueBooking {
  id: string
  number: string
  patientName: string
  phone: string
  procedure: string
  procedureId: string
  bookingMode: BookingMode
  /** Assigned room (auto or manual) */
  assignedRoom?: number
  /** Assigned doctor/staff */
  assignedDoctor?: string
  assignedDoctorId?: string
  status: 'waiting' | 'serving' | 'completed' | 'cancelled'
  createdAt: string
  /** For appointments */
  appointmentTime?: string
  appointmentDate?: string
  /** For remote bookings */
  distanceFromClinic?: number
  /** For walk-in */
  checkedInAt?: string
}

/* ─────── Procedure Database ─────── */
export const procedures: BookingProcedure[] = [
  // ทันตกรรม (Dental)
  { id: 'dental-clean', name: 'ขูดหินปูน', category: 'dental', compatibleRoles: ['dental-general'], estimatedDuration: 30 },
  { id: 'dental-fill', name: 'อุดฟัน', category: 'dental', compatibleRoles: ['dental-general'], estimatedDuration: 30 },
  { id: 'dental-extract', name: 'ถอนฟัน', category: 'dental', compatibleRoles: ['dental-general', 'dental-surgery'], estimatedDuration: 30 },
  { id: 'dental-brace', name: 'จัดฟัน', category: 'dental', compatibleRoles: ['dental-ortho'], estimatedDuration: 45 },
  { id: 'dental-root', name: 'รักษารากฟัน', category: 'dental', compatibleRoles: ['dental-general', 'dental-ortho'], estimatedDuration: 60 },
  { id: 'dental-crown', name: 'ทำครอบฟัน', category: 'dental', compatibleRoles: ['dental-general'], estimatedDuration: 45 },
  { id: 'dental-whiten', name: 'ฟอกสีฟัน', category: 'dental', compatibleRoles: ['dental-general'], estimatedDuration: 60 },
  { id: 'dental-implant', name: 'ฝังรากฟันเทียม', category: 'dental', compatibleRoles: ['dental-surgery'], estimatedDuration: 60 },

  // เวชกรรม (Medical)
  { id: 'med-general', name: 'ตรวจสุขภาพทั่วไป', category: 'medical', compatibleRoles: ['medical-general'], estimatedDuration: 20 },
  { id: 'med-vaccine', name: 'ฉีดวัคซีน', category: 'medical', compatibleRoles: ['medical-general'], estimatedDuration: 15 },
  { id: 'med-blood', name: 'ตรวจเลือด', category: 'medical', compatibleRoles: ['medical-general', 'medical-lab'], estimatedDuration: 15 },
  { id: 'med-skin', name: 'ตรวจผิวหนัง', category: 'medical', compatibleRoles: ['medical-skin'], estimatedDuration: 20 },

  // เสริมความงาม (Aesthetic)
  { id: 'aes-botox', name: 'ฉีดโบتو็อกซ์', category: 'aesthetic', compatibleRoles: ['aes-inject'], estimatedDuration: 30 },
  { id: 'aes-laser', name: 'เลเซอร์หน้าใส', category: 'aesthetic', compatibleRoles: ['aes-laser'], estimatedDuration: 45 },
  { id: 'aes-filler', name: 'ฉีดฟิลเลอร์', category: 'aesthetic', compatibleRoles: ['aes-inject'], estimatedDuration: 30 },
  { id: 'aes-hifu', name: 'HIFU ยกกระชับ', category: 'aesthetic', compatibleRoles: ['aes-laser'], estimatedDuration: 60 },

  // แพทย์แผนไทย (Thai Medicine)
  { id: 'thai-massage', name: 'นวดแผนไทย', category: 'thai', compatibleRoles: ['thai-massage'], estimatedDuration: 60 },
  { id: 'thai-herb', name: 'อบสมุนไพร', category: 'thai', compatibleRoles: ['thai-herb'], estimatedDuration: 45 },
  { id: 'thai-compress', name: 'ประคบสมุนไพร', category: 'thai', compatibleRoles: ['thai-massage', 'thai-herb'], estimatedDuration: 30 },

  // แพทย์แผนจีน (Chinese Medicine)
  { id: 'cn-acu', name: 'ฝังเข็ม', category: 'chinese', compatibleRoles: ['cn-acu'], estimatedDuration: 45 },
  { id: 'cn-herb', name: 'ยากจีน', category: 'chinese', compatibleRoles: ['cn-herb', 'cn-acu'], estimatedDuration: 20 },
  { id: 'cn-gua', name: 'กัวซา', category: 'chinese', compatibleRoles: ['cn-acu'], estimatedDuration: 30 },

  // กายภาพบำบัด (Physical Therapy)
  { id: 'pt-shoulder', name: 'กายภาพบำบัดไหล่', category: 'physical', compatibleRoles: ['pt-general'], estimatedDuration: 45 },
  { id: 'pt-back', name: 'กายภาพบำบัดหลัง', category: 'physical', compatibleRoles: ['pt-general'], estimatedDuration: 45 },
  { id: 'pt-knee', name: 'กายภาพบำบัดเข่า', category: 'physical', compatibleRoles: ['pt-general'], estimatedDuration: 45 },
  { id: 'pt-exercise', name: 'ออกกำลังกายบำบัด', category: 'physical', compatibleRoles: ['pt-general'], estimatedDuration: 30 },
]

/* ─────── Staff Role Definitions ─────── */
export interface StaffRole {
  id: string
  name: string
  category: string
  roomId: number
}

export const staffRoles: StaffRole[] = [
  // Dental
  { id: 'dental-general', name: 'ทพ.ทั่วไป', category: 'dental', roomId: 1 },
  { id: 'dental-ortho', name: 'ทพ.จัดฟัน', category: 'dental', roomId: 2 },
  { id: 'dental-surgery', name: 'ทพ.ผ่าตัด', category: 'dental', roomId: 3 },

  // Medical
  { id: 'medical-general', name: 'นพ.ทั่วไป', category: 'medical', roomId: 1 },
  { id: 'medical-law', name: 'นพ.ห้องปฏิบัติการ', category: 'medical', roomId: 4 },
  { id: 'medical-skin', name: 'นพ.ผิวหนัง', category: 'medical', roomId: 5 },

  // Aesthetic
  { id: 'aes-inject', name: 'นพ.ฉีด', category: 'aesthetic', roomId: 1 },
  { id: 'aes-laser', name: 'นพ.เลเซอร์', category: 'aesthetic', roomId: 2 },

  // Thai
  { id: 'thai-massage', name: 'หมอนวด', category: 'thai', roomId: 1 },
  { id: 'thai-herb', name: 'หมอสมุนไพร', category: 'thai', roomId: 2 },

  // Chinese
  { id: 'cn-acu', name: 'อาจารย์หมอฝังเข็ม', category: 'chinese', roomId: 1 },
  { id: 'cn-herb', name: 'อาจารย์หมอจีน', category: 'chinese', roomId: 2 },

  // Physical
  { id: 'pt-general', name: 'นักกายภาพบำบัด', category: 'physical', roomId: 1 },
]

/* ─────── Auto-Assignment Logic ─────── */
export function findBestRoom(
  procedureId: string,
  existingAssignments: { roomId: number; slotId: string }[]
): { roomId: number; doctorRoleId: string } | null {
  const procedure = procedures.find(p => p.id === procedureId)
  if (!procedure) return null

  const compatibleRoles = staffRoles.filter(r =>
    procedure.compatibleRoles.includes(r.id)
  )
  if (compatibleRoles.length === 0) return null

  // Find the room with fewest assignments
  const roomCounts: Record<number, number> = {}
  compatibleRoles.forEach(r => {
    roomCounts[r.roomId] = (roomCounts[r.roomId] || 0) + 1
  })

  // Pick the least busy compatible room
  let bestRoom = compatibleRoles[0].roomId
  let bestRole = compatibleRoles[0].id
  let minAssignments = Infinity

  compatibleRoles.forEach(role => {
    const count = existingAssignments.filter(a => a.roomId === role.roomId).length
    if (count < minAssignments) {
      minAssignments = count
      bestRoom = role.roomId
      bestRole = role.id
    }
  })

  return { roomId: bestRoom, doctorRoleId: bestRole }
}

/* ─────── Queue Number Generator ─────── */
let queueCounter = 100

export function generateQueueNumber(prefix: string, category: string): string {
  queueCounter++
  return `${prefix}${String(queueCounter).padStart(3, '0')}`
}

/* ─────── Geolocation Helper ─────── */
export function checkDistance(
  lat1: number, lon1: number,
  lat2: number, lon2: number
): number {
  // Haversine formula — returns distance in meters
  const R = 6371e3
  const φ1 = (lat1 * Math.PI) / 180
  const φ2 = (lat2 * Math.PI) / 180
  const Δφ = ((lat2 - lat1) * Math.PI) / 180
  const Δλ = ((lon2 - lon1) * Math.PI) / 180

  const a = Math.sin(Δφ / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))

  return R * c
}

export const CLINIC_LOCATION = { lat: 13.7563, lng: 100.5018 } // Bangkok default
export const MAX_DISTANCE_METERS = 500
