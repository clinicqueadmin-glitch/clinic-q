export interface QueueItem {
  id: string
  number: string
  patientName: string
  clinicType: ClinicType
  status: 'waiting' | 'serving' | 'completed'
  time: string
  doctor?: string
  calledAt?: string
}

export type ClinicType = 'medical' | 'aesthetic' | 'thai' | 'chinese' | 'dental' | 'physical'

export const clinicConfig: Record<ClinicType, {
  name: string
  nameEn: string
  color: string
  bg: string
  icon: string
  prefix: string
}> = {
  medical:   { name: 'คลินิกเวชกรรม',       nameEn: 'Medical',       color: '#22C55E', bg: '#F0FDF4', icon: '🏥', prefix: 'A' },
  aesthetic: { name: 'คลินิกเสริมความงาม',   nameEn: 'Aesthetic',     color: '#EC4899', bg: '#FDF2F8', icon: '✨', prefix: 'B' },
  thai:      { name: 'แพทย์แผนไทย',          nameEn: 'Thai Medicine', color: '#EAB308', bg: '#FEFCE8', icon: '🌿', prefix: 'C' },
  chinese:   { name: 'แพทย์แผนจีน',          nameEn: 'Chinese Med.',  color: '#F97316', bg: '#FFF7ED', icon: '🏮', prefix: 'D' },
  dental:    { name: 'คลินิกทันตกรรม',        nameEn: 'Dental',        color: '#A855F7', bg: '#FAF5FF', icon: '🦷', prefix: 'E' },
  physical:  { name: 'คลินิกกายภาพบำบัด',    nameEn: 'Physical Ther.',color: '#3B82F6', bg: '#EFF6FF', icon: '🦴', prefix: 'F' },
}

// Simulated queue data — in production this would come from an API
export const initialQueue: QueueItem[] = [
  { id: '1',  number: 'A024', patientName: 'สมชาย ใจดี',     clinicType: 'medical',   status: 'serving',  time: '09:30', doctor: 'นพ.วิชัย', calledAt: '09:32' },
  { id: '2',  number: 'B018', patientName: 'สมหญิง รักสวย',   clinicType: 'aesthetic', status: 'serving',  time: '09:45', doctor: 'นพ.หญิงพิมพ์ใจ', calledAt: '09:47' },
  { id: '3',  number: 'A025', patientName: 'วิชัย มั่นคง',     clinicType: 'medical',   status: 'waiting',  time: '10:00' },
  { id: '4',  number: 'C012', patientName: 'ธนากร เจริญสุข',  clinicType: 'thai',      status: 'waiting',  time: '10:15' },
  { id: '5',  number: 'D008', patientName: 'พิมพ์ใจ สดใส',     clinicType: 'chinese',   status: 'completed', time: '08:30', doctor: 'อาจารย์หมออู' },
  { id: '6',  number: 'E022', patientName: 'กมล ยิ้มแย้ม',     clinicType: 'dental',    status: 'serving',  time: '10:30', doctor: 'ทพ.สมบูรณ์', calledAt: '10:31' },
  { id: '7',  number: 'F015', patientName: 'ประสงค์ สุขสันต์', clinicType: 'physical',  status: 'waiting',  time: '10:45' },
  { id: '8',  number: 'A026', patientName: 'ประเสริฐ มีสุข',   clinicType: 'medical',   status: 'waiting',  time: '11:00' },
  { id: '9',  number: 'B019', patientName: 'วรรณา เจริญศรี',   clinicType: 'aesthetic', status: 'completed', time: '09:00' },
  { id: '10', number: 'E023', patientName: 'มณี สดชื่น',       clinicType: 'dental',    status: 'waiting',  time: '11:15' },
  { id: '11', number: 'A027', patientName: 'ปิยะ รุ่งเรือง',   clinicType: 'medical',   status: 'waiting',  time: '11:30' },
  { id: '12', number: 'C013', patientName: 'สุภาพร วงศ์สวัสดิ์',clinicType: 'thai',      status: 'waiting',  time: '11:45' },
  { id: '13', number: 'E024', patientName: 'เจริญ จันทร์เจริญ',clinicType: 'dental',    status: 'completed', time: '10:00' },
]
