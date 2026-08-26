import QueueStatusBoard from '@/components/tracking/QueueStatusBoard'

export const metadata = {
  title: 'Clinic-Q | สถานะคิววันนี้',
  description: 'ดูสถานะคิวรวม จำนวนคิวรอ และเวลาคาดการณ์',
}

export default function QueueStatusPage() {
  return <QueueStatusBoard />
}
