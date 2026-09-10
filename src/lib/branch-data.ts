/* ─────────────────────────────────────────────────────
   Clinic-Q Branch / Room / Practitioner Data Model
   ───────────────────────────────────────────────────── */

export interface Procedure {
  id: string
  name: string
  estimatedDuration: number // minutes
  active: boolean
}

export interface Branch {
  id: string
  name: string               // "ทันตกรรมทั่วไป"
  category: string           // "dental"
  procedures: Procedure[]
  active: boolean
}

export interface Practitioner {
  id: string
  name: string               // "ทพ.สมบูรณ์ สุขใจ"
  branchId: string           // which branch they belong to
  phone: string
  active: boolean
  userId?: string            // Optional: links to users.id for auth (NEW)
  clinicId?: string          // Optional: links to clinics.id (NEW)
}

export interface Room {
  id: number
  name: string               // "ห้อง 1"
  color: string
  image?: string             // base64 data URL (optional room photo)
  branchId: string           // which branch operates here
  practitionerId: string     // who works in this room
  practitionerName?: string  // practitioner display name (stored at creation time)
  slotDuration: number       // minutes per slot (10, 15, 30, 45, 60)
  workingStartTime: string   // "HH:MM" e.g. "09:00"
  workingEndTime: string     // "HH:MM" e.g. "17:00"
  active: boolean
}

/* ─────── Default Data per Clinic Category ─────── */

export interface ClinicBranchData {
  branches: Branch[]
  practitioners: Practitioner[]
  rooms: Room[]
}

export const defaultDentalData: ClinicBranchData = {
  branches: [
    {
      id: 'dental-general', name: 'ทันตกรรมทั่วไป', category: 'dental', active: true,
      procedures: [
        { id: 'dg-clean', name: 'ขูดหินปูน', estimatedDuration: 30, active: true },
        { id: 'dg-fill', name: 'อุดฟัน', estimatedDuration: 30, active: true },
        { id: 'dg-extract', name: 'ถอนฟัน', estimatedDuration: 30, active: true },
        { id: 'dg-crown', name: 'ทำครอบฟัน', estimatedDuration: 45, active: true },
        { id: 'dg-whiten', name: 'ฟอกสีฟัน', estimatedDuration: 60, active: true },
        { id: 'dg-checkup', name: 'ตรวจสุขภาพฟัน', estimatedDuration: 15, active: true },
      ],
    },
    {
      id: 'dental-ortho', name: 'ทันตกรรมจัดฟัน', category: 'dental', active: true,
      procedures: [
        { id: 'do-consult', name: 'ปรึกษาจัดฟัน', estimatedDuration: 30, active: true },
        { id: 'do-install', name: 'ติดเครื่องมือจัดฟัน', estimatedDuration: 60, active: true },
        { id: 'do-adjust', name: 'ปรับเครื่องมือจัดฟัน', estimatedDuration: 30, active: true },
        { id: 'do-remove', name: 'ถอดเครื่องมือจัดฟัน', estimatedDuration: 30, active: true },
        { id: 'do-retainer', name: 'ใส่ retainers', estimatedDuration: 20, active: true },
      ],
    },
    {
      id: 'dental-surgery', name: 'ทันตกรรมผ่าตัด', category: 'dental', active: true,
      procedures: [
        { id: 'ds-impacted', name: 'ผ่าตัดฟันคุด', estimatedDuration: 60, active: true },
        { id: 'ds-implant', name: 'ฝังรากฟันเทียม', estimatedDuration: 60, active: true },
        { id: 'ds-rootcanal', name: 'รักษารากฟัน', estimatedDuration: 60, active: true },
        { id: 'ds-bone', name: 'ผ่าตัดกระดูกขากรรไกร', estimatedDuration: 90, active: true },
      ],
    },
  ],
  practitioners: [
    { id: 'dr-somchai', name: 'ทพ.สมบูรณ์ สุขใจ', branchId: 'dental-general', phone: '081-111-1111', active: true },
    { id: 'dr-wichai', name: 'ทพ.วิชัย มั่นคง', branchId: 'dental-ortho', phone: '082-222-2222', active: true },
    { id: 'dr-sompong', name: 'ทพ.สมพงษ์ กล้าแข็ง', branchId: 'dental-surgery', phone: '083-333-3333', active: true },
    { id: 'dr-pim', name: 'ทพ.หญิงพิมพ์ใจ รักสวย', branchId: 'dental-general', phone: '084-444-4444', active: true },
  ],
  rooms: [
    { id: 1, name: 'ห้อง 1', color: '#93C5FD', branchId: 'dental-general', practitionerId: 'dr-somchai', slotDuration: 30, workingStartTime: '09:00', workingEndTime: '17:00', active: true },
    { id: 2, name: 'ห้อง 2', color: '#A7F3D0', branchId: 'dental-ortho', practitionerId: 'dr-wichai', slotDuration: 10, workingStartTime: '10:00', workingEndTime: '18:00', active: true },
    { id: 3, name: 'ห้อง 3', color: '#FCD34D', branchId: 'dental-surgery', practitionerId: 'dr-sompong', slotDuration: 60, workingStartTime: '09:00', workingEndTime: '16:00', active: true },
    { id: 4, name: 'ห้อง 4', color: '#FDA4AF', branchId: 'dental-general', practitionerId: 'dr-pim', slotDuration: 30, workingStartTime: '13:00', workingEndTime: '20:00', active: true },
    { id: 5, name: 'ห้อง 5', color: '#D8B4FE', branchId: 'dental-general', practitionerId: 'dr-somchai', slotDuration: 15, workingStartTime: '09:00', workingEndTime: '12:00', active: true },
  ],
}

export const defaultMedicalData: ClinicBranchData = {
  branches: [
    {
      id: 'med-general', name: 'เวชกรรมทั่วไป', category: 'medical', active: true,
      procedures: [
        { id: 'mg-checkup', name: 'ตรวจสุขภาพทั่วไป', estimatedDuration: 20, active: true },
        { id: 'mg-vaccine', name: 'ฉีดวัคซีน', estimatedDuration: 15, active: true },
        { id: 'mg-blood', name: 'ตรวจเลือด', estimatedDuration: 15, active: true },
        { id: 'mg-sick', name: 'ตรวจรักษาทั่วไป', estimatedDuration: 20, active: true },
      ],
    },
    {
      id: 'med-skin', name: 'ผิวหนังและความงาม', category: 'medical', active: true,
      procedures: [
        { id: 'ms-acne', name: 'รักษาสิว', estimatedDuration: 20, active: true },
        { id: 'ms-allergy', name: 'รักษาภูมิแพ้ผิวหนัง', estimatedDuration: 20, active: true },
        { id: 'ms-laser', name: 'เลเซอร์ผิวหนัง', estimatedDuration: 45, active: true },
      ],
    },
  ],
  practitioners: [
    { id: 'dr-narin', name: 'นพ.นรินทร์ สุขสมบูรณ์', branchId: 'med-general', phone: '081-555-5555', active: true },
    { id: 'dr-siriporn', name: 'พญ.สิริพร ผิวงาม', branchId: 'med-skin', phone: '082-666-6666', active: true },
  ],
  rooms: [
    { id: 1, name: 'ห้อง 1', color: '#FECACA', branchId: 'med-general', practitionerId: 'dr-narin', slotDuration: 20, workingStartTime: '08:00', workingEndTime: '17:00', active: true },
    { id: 2, name: 'ห้อง 2', color: '#C4B5FD', branchId: 'med-skin', practitionerId: 'dr-siriporn', slotDuration: 30, workingStartTime: '10:00', workingEndTime: '18:00', active: true },
  ],
}

export const defaultAestheticData: ClinicBranchData = {
  branches: [
    {
      id: 'aes-inject', name: 'ฉีดเสริมความงาม', category: 'aesthetic', active: true,
      procedures: [
        { id: 'ai-botox', name: 'ฉีดโบتو็อกซ์', estimatedDuration: 30, active: true },
        { id: 'ai-filler', name: 'ฉีดฟิลเลอร์', estimatedDuration: 30, active: true },
        { id: 'ai-meso', name: 'เมโสเธอราพี', estimatedDuration: 30, active: true },
      ],
    },
    {
      id: 'aes-laser', name: 'เลเซอร์และเครื่องมือ', category: 'aesthetic', active: true,
      procedures: [
        { id: 'al-laser', name: 'เลเซอร์หน้าใส', estimatedDuration: 45, active: true },
        { id: 'al-hifu', name: 'HIFU ยกกระชับ', estimatedDuration: 60, active: true },
        { id: 'al-ipl', name: 'IPL กำจัดขน', estimatedDuration: 45, active: true },
      ],
    },
  ],
  practitioners: [
    { id: 'dr-ariya', name: 'นพ.อริยะ หน้าใส', branchId: 'aes-inject', phone: '081-777-7777', active: true },
    { id: 'dr-natcha', name: 'นพ.ณัชชา เลเซอร์', branchId: 'aes-laser', phone: '082-888-8888', active: true },
  ],
  rooms: [
    { id: 1, name: 'ห้อง 1', color: '#DDD6FE', branchId: 'aes-inject', practitionerId: 'dr-ariya', slotDuration: 30, workingStartTime: '10:00', workingEndTime: '19:00', active: true },
    { id: 2, name: 'ห้อง 2', color: '#FBCFE8', branchId: 'aes-laser', practitionerId: 'dr-natcha', slotDuration: 45, workingStartTime: '10:00', workingEndTime: '18:00', active: true },
  ],
}

export const defaultThaiData: ClinicBranchData = {
  branches: [
    {
      id: 'thai-massage', name: 'นวดแผนไทย', category: 'thai', active: true,
      procedures: [
        { id: 'tm-full', name: 'นวดแผนไทยเต็มตัว', estimatedDuration: 60, active: true },
        { id: 'tm-foot', name: 'นวดฝ่าเท้า', estimatedDuration: 30, active: true },
        { id: 'tm-neck', name: 'นวดคอ บ่า ไหล่', estimatedDuration: 30, active: true },
      ],
    },
    {
      id: 'thai-herb', name: 'สมุนไพรไทย', category: 'thai', active: true,
      procedures: [
        { id: 'th-steam', name: 'อบสมุนไพร', estimatedDuration: 45, active: true },
        { id: 'th-compress', name: 'ประคบสมุนไพร', estimatedDuration: 30, active: true },
        { id: 'th-oil', name: 'นวดน้ำมันสมุนไพร', estimatedDuration: 60, active: true },
      ],
    },
  ],
  practitioners: [
    { id: 'mr-somkid', name: 'นายสมศักดิ์ นวดเก่ง', branchId: 'thai-massage', phone: '081-999-9999', active: true },
    { id: 'mrs-ploy', name: 'นางสาวพลอย สมุนไพร', branchId: 'thai-herb', phone: '082-000-0000', active: true },
  ],
  rooms: [
    { id: 1, name: 'ห้อง 1', color: '#BBF7D0', branchId: 'thai-massage', practitionerId: 'mr-somkid', slotDuration: 60, workingStartTime: '09:00', workingEndTime: '18:00', active: true },
    { id: 2, name: 'ห้อง 2', color: '#D1FAE5', branchId: 'thai-herb', practitionerId: 'mrs-ploy', slotDuration: 45, workingStartTime: '09:00', workingEndTime: '17:00', active: true },
  ],
}

export const defaultChineseData: ClinicBranchData = {
  branches: [
    {
      id: 'cn-acu', name: 'ฝังเข็ม', category: 'chinese', active: true,
      procedures: [
        { id: 'ca-general', name: 'ฝังเข็มทั่วไป', estimatedDuration: 45, active: true },
        { id: 'ca-pain', name: 'ฝังเข็มบำบัดปวด', estimatedDuration: 45, active: true },
        { id: 'ca-gua', name: 'กัวซา', estimatedDuration: 30, active: true },
      ],
    },
    {
      id: 'cn-herb', name: 'ยาจีน', category: 'chinese', active: true,
      procedures: [
        { id: 'ch-consult', name: 'ปรึกษาแพทย์จีน', estimatedDuration: 20, active: true },
        { id: 'ch-herb', name: 'จ่ายยาจีน', estimatedDuration: 15, active: true },
      ],
    },
  ],
  practitioners: [
    { id: 'master-ou', name: 'อาจารย์หมออู จีนเทวะ', branchId: 'cn-acu', phone: '081-111-0000', active: true },
    { id: 'dr-li', name: 'นพ.หลี่ จีนแพทย์', branchId: 'cn-herb', phone: '082-222-0000', active: true },
  ],
  rooms: [
    { id: 1, name: 'ห้อง 1', color: '#FDE68A', branchId: 'cn-acu', practitionerId: 'master-ou', slotDuration: 45, workingStartTime: '09:00', workingEndTime: '17:00', active: true },
    { id: 2, name: 'ห้อง 2', color: '#FEF3C7', branchId: 'cn-herb', practitionerId: 'dr-li', slotDuration: 20, workingStartTime: '09:00', workingEndTime: '16:00', active: true },
  ],
}

export const defaultPhysicalData: ClinicBranchData = {
  branches: [
    {
      id: 'pt-general', name: 'กายภาพบำบัดทั่วไป', category: 'physical', active: true,
      procedures: [
        { id: 'pg-shoulder', name: 'กายภาพบำบัดไหล่', estimatedDuration: 45, active: true },
        { id: 'pg-back', name: 'กายภาพบำบัดหลัง', estimatedDuration: 45, active: true },
        { id: 'pg-knee', name: 'กายภาพบำบัดเข่า', estimatedDuration: 45, active: true },
        { id: 'pg-neck', name: 'กายภาพบำบัดคอ', estimatedDuration: 30, active: true },
      ],
    },
    {
      id: 'pt-exercise', name: 'ออกกำลังกายบำบัด', category: 'physical', active: true,
      procedures: [
        { id: 'pe-rehab', name: 'ฟื้นฟูสมรรถภาพ', estimatedDuration: 60, active: true },
        { id: 'pe-exercise', name: 'โปรแกรมออกกำลังกาย', estimatedDuration: 45, active: true },
      ],
    },
  ],
  practitioners: [
    { id: 'pt-somjai', name: 'นายสมใจ กายภาพ', branchId: 'pt-general', phone: '081-333-0000', active: true },
    { id: 'pt-natee', name: 'นางสาวนาติ ออกกำลัง', branchId: 'pt-exercise', phone: '082-444-0000', active: true },
  ],
  rooms: [
    { id: 1, name: 'ห้อง 1', color: '#C7D2FE', branchId: 'pt-general', practitionerId: 'pt-somjai', slotDuration: 45, workingStartTime: '08:00', workingEndTime: '17:00', active: true },
    { id: 2, name: 'ห้อง 2', color: '#E0E7FF', branchId: 'pt-exercise', practitionerId: 'pt-natee', slotDuration: 60, workingStartTime: '09:00', workingEndTime: '16:00', active: true },
  ],
}

/* ─────── Get data by clinic type ─────── */
import { type ClinicType } from './queue-data'

export function getDefaultBranchData(clinicType: ClinicType): ClinicBranchData {
  switch (clinicType) {
    case 'dental': return defaultDentalData
    case 'medical': return defaultMedicalData
    case 'aesthetic': return defaultAestheticData
    case 'thai': return defaultThaiData
    case 'chinese': return defaultChineseData
    case 'physical': return defaultPhysicalData
    default: return defaultDentalData
  }
}

/* ─────── Helper Functions ─────── */
export function getBranchProcedures(data: ClinicBranchData, branchId: string): Procedure[] {
  const branch = data.branches.find(b => b.id === branchId)
  return branch?.procedures.filter(p => p.active) || []
}

export function getAllActiveProcedures(data: ClinicBranchData): { branch: Branch; procedures: Procedure[] }[] {
  return data.branches
    .filter(b => b.active)
    .map(b => ({ branch: b, procedures: b.procedures.filter(p => p.active) }))
}

export function findRoomForProcedure(data: ClinicBranchData, procedureId: string): Room | null {
  for (const branch of data.branches) {
    if (branch.procedures.some(p => p.id === procedureId)) {
      return data.rooms.find(r => r.branchId === branch.id && r.active) || null
    }
  }
  return null
}

export function findBranchForProcedure(data: ClinicBranchData, procedureId: string): Branch | null {
  return data.branches.find(b => b.procedures.some(p => p.id === procedureId)) || null
}

export function getPractitionerName(data: ClinicBranchData, practitionerId: string): string {
  return data.practitioners.find(p => p.id === practitionerId)?.name || 'ไม่ระบุ'
}

// ═══ Get estimated duration for a procedure ═══
export function getEstimatedDuration(data: ClinicBranchData, procedureId: string): number {
  for (const branch of data.branches) {
    const proc = branch.procedures.find(p => p.id === procedureId)
    if (proc) return proc.estimatedDuration
  }
  return 30 // default 30 min if not found
}

// ═══ Calculate expected duration for a queue item (based on its procedure) ═══
export function getExpectedMinutes(data: ClinicBranchData, procedureId: string): number {
  return getEstimatedDuration(data, procedureId)
}

// ═══ Get overtime status ═══
// ═══ Calculate queue position and estimated wait time ═══
// Now accounts for time already spent by currently serving patients
export function getQueueWaitInfo(
  data: ClinicBranchData,
  queue: { id: string; procedureId: string; status: string; arrived: boolean; assignedRoom: number; servingAt?: number }[],
  targetId: string
): { position: number; aheadCount: number; estimatedWaitMinutes: number; aheadDetails: { id: string; procedureId: string; duration: number }[] } {
  // Get all arrived waiting items, ordered by created_at (queue order)
  const waitingItems = queue.filter(q => q.status === 'waiting' && q.arrived)
  
  const targetIndex = waitingItems.findIndex(q => q.id === targetId)
  if (targetIndex === -1) {
    return { position: 0, aheadCount: 0, estimatedWaitMinutes: 0, aheadDetails: [] }
  }

  const aheadItems = waitingItems.slice(0, targetIndex)
  const aheadDetails = aheadItems.map(item => ({
    id: item.id,
    procedureId: item.procedureId,
    duration: getEstimatedDuration(data, item.procedureId),
  }))

  let estimatedWaitMinutes = aheadDetails.reduce((sum, d) => sum + d.duration, 0)

  // ═══ Add remaining time from currently serving patients ═══
  // For each room that has a serving patient, calculate remaining time
  const servingItems = queue.filter(q => q.status === 'serving' && q.servingAt)
  const now = Date.now()
  servingItems.forEach(serving => {
    const totalDuration = getEstimatedDuration(data, serving.procedureId)
    const elapsedMinutes = Math.round((now - (serving.servingAt || now)) / 60000)
    const remainingMinutes = Math.max(0, totalDuration - elapsedMinutes)
    // Add remaining time only if this serving patient is ahead in the same room
    // (simplified: add remaining time from all serving rooms)
    estimatedWaitMinutes += remainingMinutes
  })

  return {
    position: targetIndex + 1,
    aheadCount: aheadItems.length,
    estimatedWaitMinutes,
    aheadDetails,
  }
}

// ═══ HH:MM helpers ═══
function hhmmToMinutes(t: string): number {
  if (!t || !/^\d{1,2}:\d{2}$/.test(t)) return 0
  const [hh, mm] = t.split(':').map(Number)
  return (hh % 24) * 60 + mm
}

function minutesToHHMM(m: number): string {
  const total = ((Math.round(m) % 1440) + 1440) % 1440
  const hh = Math.floor(total / 60)
  const mm = total % 60
  return `${hh.toString().padStart(2, '0')}:${mm.toString().padStart(2, '0')}`
}

/**
 * Minimum fields the appointment estimator needs from a queue item.
 */
export interface AppointmentQueueItem {
  id?: string
  status: string
  branchId?: string
  procedureId?: string
  queueDate?: string
  bookedAt?: string
  servingAt?: number
}

export interface AppointmentEstimateOptions {
  /** Branch the patient chose (queue filter — other branches are never mixed in) */
  branchId: string
  /** Procedure the patient chose (used for its duration where relevant) */
  procedureId: string
  /** Service date "YYYY-MM-DD" (ICT) the patient is booking for */
  queueDate: string
  /** Clinic opening time "HH:MM" — the base for a future date with no queue */
  preferredTimeHHMM?: string
  /** Override "now" (ms) — mainly for tests */
  now?: number
}

/** Standard online-booking buffer added after the last relevant patient finishes. */
const ONLINE_BOOKING_BUFFER_MINUTES = 30

/** Queue statuses that still affect future wait time. completed/cancelled/no_show never do. */
const ACTIVE_QUEUE_STATUSES = new Set(['waiting', 'called', 'serving'])

/** Today's date in ICT (Asia/Bangkok = UTC+7) as YYYY-MM-DD */
function getTodayICTString(nowMs: number = Date.now()): string {
  return new Date(nowMs + 7 * 60 * 60 * 1000).toISOString().split('T')[0]
}

/** Current wall-clock minutes-of-day in ICT */
function getNowICTMinutes(nowMs: number = Date.now()): number {
  const ict = new Date(nowMs + 7 * 60 * 60 * 1000)
  return ict.getUTCHours() * 60 + ict.getUTCMinutes()
}

/**
 * Queue-aware estimated appointment time for online booking.
 *
 * Rules (per product spec):
 * - Only queues of the SAME branch on the SAME service date are considered.
 *   In the current data model procedures belong to a branch, and the branch's
 *   rooms/practitioners are its shared resource pool (queues only get an
 *   assigned room/doctor when a patient is called), so branch-level filtering
 *   is the real relationship. Queues from other branches are never mixed in.
 * - Only still-active statuses count (waiting / called / serving);
 *   completed / cancelled / no_show never push the appointment later.
 * - No relevant queue → base (press time today, or clinic opening time for a
 *   future date) + 30 minutes.
 * - With relevant queues → the new appointment continues from when the last
 *   relevant patient is expected to finish (serving patients finish at
 *   servingAt + duration and run in parallel per room; waiting/called patients
 *   chain their full durations in queue order), then + 30 minutes buffer.
 *
 * @param data - Clinic branch data (contains procedure durations)
 * @param queue - Queue items for the clinic (usually already filtered by date)
 * @param opts - Branch / procedure / date context for the booking
 * @returns Estimated appointment time as "HH:MM"
 */
export function estimateNextServiceTime(
  data: ClinicBranchData,
  queue: AppointmentQueueItem[],
  opts: AppointmentEstimateOptions
): string {
  const nowMs = opts.now ?? Date.now()
  const today = getTodayICTString(nowMs)
  const isToday = opts.queueDate === today

  // Base: press time for same-day bookings, otherwise clinic opening time.
  // Never schedule before the clinic opens.
  const openingMinutes = hhmmToMinutes(opts.preferredTimeHHMM || '09:00')
  const pressMinutes = getNowICTMinutes(nowMs)
  const baseMinutes = Math.max(isToday ? pressMinutes : openingMinutes, openingMinutes)

  // 1. Relevant queues: same branch + same service date + still active,
  //    ordered by queue order (booked_at / created_at).
  const relevant = queue
    .filter(q =>
      q.branchId === opts.branchId &&
      (!q.queueDate || q.queueDate === opts.queueDate) &&
      ACTIVE_QUEUE_STATUSES.has(q.status)
    )
    .sort(
      (a, b) =>
        (a.bookedAt || '').localeCompare(b.bookedAt || '') ||
        (a.id || '').localeCompare(b.id || '')
    )

  // 2. Serving patients run in parallel (one per room) → the appointment
  //    continues from the LATEST expected finish among them.
  let cursorMinutes = baseMinutes
  for (const s of relevant) {
    if (s.status === 'serving' && s.servingAt && s.servingAt > 0) {
      const elapsedMinutes = Math.max(0, Math.floor((nowMs - s.servingAt) / 60000))
      const duration = getEstimatedDuration(data, s.procedureId || '')
      const remainingMinutes = Math.max(0, duration - elapsedMinutes)
      const finishMinutes = getNowICTMinutes(s.servingAt) + remainingMinutes
      cursorMinutes = Math.max(cursorMinutes, finishMinutes)
    }
  }

  // 3. Waiting / called patients chain their full durations in queue order
  //    after the latest serving finish (a serving item without a start
  //    timestamp is treated as pending with its full duration).
  for (const w of relevant) {
    if (w.status === 'serving' && w.servingAt && w.servingAt > 0) continue
    cursorMinutes += getEstimatedDuration(data, w.procedureId || '')
  }

  // 4. The new booking starts after the last relevant patient is expected to
  //    finish, plus the standard online-booking buffer.
  const resultMinutes = cursorMinutes + ONLINE_BOOKING_BUFFER_MINUTES
  return minutesToHHMM(resultMinutes)
}

export function getOvertimeStatus(
  data: ClinicBranchData,
  procedureId: string,
  servingAt: number,
  now: number
): { elapsed: number; expected: number; isOvertime: boolean; overtimeBy: number; severity: 'normal' | 'warning' | 'critical' } {
  const expected = getExpectedMinutes(data, procedureId)
  const elapsed = Math.max(0, Math.floor((now - servingAt) / 60000))
  const overtimeBy = Math.max(0, elapsed - expected)
  const isOvertime = elapsed > expected
  const severity = overtimeBy > 15 ? 'critical' : overtimeBy > 0 ? 'warning' : 'normal'
  return { elapsed, expected, isOvertime, overtimeBy, severity }
}
