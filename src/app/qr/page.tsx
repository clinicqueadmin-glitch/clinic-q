import PatientMenu from '@/components/qr/PatientMenu'

export const metadata = {
  title: 'Clinic-Q | เมนูผู้ป่วย',
  description: 'จองคิว ตรวจสอบคิว และดูสถานะคิววันนี้',
}

export default function QrPage() {
  return <PatientMenu />
}