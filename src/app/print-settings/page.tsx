import PrintSettingsManager from '@/components/print-settings/PrintSettingsManager'

export const metadata = {
  title: 'Clinic-Q | ตั้งค่าเครื่องพิมพ์',
  description: 'ตั้งค่าเครื่องพิมพ์ POS และใบเสร็จ',
}

export default function PrintSettingsPage() {
  return <PrintSettingsManager />
}
