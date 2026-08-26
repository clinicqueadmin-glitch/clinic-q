import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

export const metadata = {
  title: 'Clinic-Q | นโยบายความเป็นส่วนตัว',
  description: 'นโยบายความเป็นส่วนตัวของ Platform Clinic-Q',
}

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center gap-3">
          <Link href="/" className="w-9 h-9 rounded-xl bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors">
            <ArrowLeft className="w-5 h-5 text-gray-600" />
          </Link>
          <div>
            <h1 className="text-lg font-bold text-gray-900">นโยบายความเป็นส่วนตัว</h1>
            <p className="text-xs text-gray-500">Privacy Policy</p>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-8 space-y-8">
        {/* Last updated */}
        <div className="text-center">
          <p className="text-sm text-gray-500">อัปเดตล่าสุด: 24 สิงหาคม 2569</p>
          <p className="text-xs text-gray-400 mt-1">มีผลบังคับใช้ตั้งแต่วันที่ 24 สิงหาคม 2569 เป็นต้นไป</p>
        </div>

        {/* Content */}
        <div className="bg-white rounded-2xl border border-gray-200 p-6 sm:p-8 space-y-8">
          {/* Section 1 */}
          <section>
            <h2 className="text-lg font-bold text-gray-900 mb-3">1. บทนำ</h2>
            <div className="text-sm text-gray-600 space-y-3">
              <p>
                นโยบายความเป็นส่วนตัวนี้ อธิบายว่า Platform Clinic-Q 
                (&ldquo;ระบบ&rdquo;) เก็บ ใช้ และคุ้มครองข้อมูลส่วนบุคคลอย่างไร
              </p>
              <p>
                โดย บริษัท ByteBoxx Solution จำกัด (&ldquo;ผู้ให้บริการ&rdquo;)
              </p>
            </div>
          </section>

          {/* Section 2 */}
          <section>
            <h2 className="text-lg font-bold text-gray-900 mb-3">2. ข้อมูลที่เก็บรวบรวม</h2>
            <div className="text-sm text-gray-600 space-y-3">
              <p>ระบบเก็บข้อมูลดังต่อไปนี้:</p>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li><strong>ข้อมูลผู้ใช้งาน:</strong> ชื่อ, อีเมล, เบอร์โทรศัพท์, บทบาท</li>
                <li><strong>ข้อมูลคลินิก:</strong> ชื่อคลินิก, ที่อยู่, เบอร์โทร, เวลาเปิดทำการ</li>
                <li><strong>ข้อมูลผู้รับบริการ:</strong> ชื่อ, เบอร์โทรศัพท์ (ใช้สำหรับจัดคิว)</li>
                <li><strong>ข้อมูลคิว:</strong> หมายเลขคิว, หัตถการ, สถานะ, เวลา</li>
                <li><strong>ข้อมูลการใช้งาน:</strong> IP address, browser type, หน้าที่เข้าชม</li>
              </ul>
            </div>
          </section>

          {/* Section 3 */}
          <section>
            <h2 className="text-lg font-bold text-gray-900 mb-3">3. วัตถุประสงค์การใช้ข้อมูล</h2>
            <div className="text-sm text-gray-600 space-y-3">
              <p>ข้อมูลที่เก็บรวบรวมจะใช้เพื่อ:</p>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li>ให้บริการจัดการคิวคลินิก</li>
                <li>ส่งการแจ้งเตือนคิวถึงผู้รับบริการ</li>
                <li>ปรับปรุงและพัฒนาระบบ</li>
                <li>ติดต่อสื่อสารกับผู้ใช้งาน</li>
                <li>ปฏิบัติตามกฎหมายที่เกี่ยวข้อง</li>
              </ul>
            </div>
          </section>

          {/* Section 4 */}
          <section>
            <h2 className="text-lg font-bold text-gray-900 mb-3">4. การเปิดเผยข้อมูล</h2>
            <div className="text-sm text-gray-600 space-y-3">
              <p>เราจะไม่เปิดเผยข้อมูลส่วนบุคคลของท่านแก่บุคคลที่สาม ยกเว้น:</p>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li>ได้รับความยินยอมจากท่าน</li>
                <li>เพื่อปฏิบัติตามกฎหมายหรือคำสั่งศาล</li>
                <li>เพื่อคุ้มครองสิทธิ์และความปลอดภัยของเราและผู้ใช้งาน</li>
                <li>ในกรณีควบรวมกิจการหรือขายกิจการ</li>
              </ul>
            </div>
          </section>

          {/* Section 5 */}
          <section>
            <h2 className="text-lg font-bold text-gray-900 mb-3">5. การรักษาความปลอดภัย</h2>
            <div className="text-sm text-gray-600 space-y-3">
              <p>เราใช้มาตรการรักษาความปลอดภัยดังนี้:</p>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li>เข้ารหัสข้อมูลระหว่างส่ง (SSL/TLS)</li>
                <li>จัดเก็บข้อมูลบน Supabase ที่มีความปลอดภัยระดับ Enterprise</li>
                <li>จำกัดสิทธิ์การเข้าถึงข้อมูลตามบทบาท</li>
                <li>สำรองข้อมูลเป็นประจำ</li>
              </ul>
            </div>
          </section>

          {/* Section 6 */}
          <section>
            <h2 className="text-lg font-bold text-gray-900 mb-3">6. สิทธิของผู้ใช้งาน</h2>
            <div className="text-sm text-gray-600 space-y-3">
              <p>ท่านมีสิทธิดังนี้:</p>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li><strong>สิทธิเข้าถึง:</strong> ขอดูข้อมูลส่วนบุคคลของท่าน</li>
                <li><strong>สิทธิแก้ไข:</strong> แก้ไขข้อมูลที่ไม่ถูกต้อง</li>
                <li><strong>สิทธิลบ:</strong> ลบข้อมูลส่วนบุคคลของท่าน</li>
                <li><strong>สิทธิคัดค้าน:</strong> คัดค้านการประมวลผลข้อมูล</li>
                <li><strong>สิทธิโอนย้าย:</strong> ขอรับข้อมูลในรูปแบบที่ใช้งานได้</li>
              </ul>
            </div>
          </section>

          {/* Section 7 */}
          <section>
            <h2 className="text-lg font-bold text-gray-900 mb-3">7. คุกกี้</h2>
            <div className="text-sm text-gray-600 space-y-3">
              <p>ระบบใช้คุกกี้เพื่อ:</p>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li>จดจำการเข้าสู่ระบบ</li>
                <li>จดจำการตั้งค่าของผู้ใช้งาน</li>
                <li>วิเคราะห์การใช้งานเพื่อปรับปรุงระบบ</li>
              </ul>
            </div>
          </section>

          {/* Section 8 */}
          <section>
            <h2 className="text-lg font-bold text-gray-900 mb-3">8. การเก็บรักษาข้อมูล</h2>
            <div className="text-sm text-gray-600 space-y-3">
              <p>เราจะเก็บรักษาข้อมูลส่วนบุคคลตราบเท่าที่จำเป็นเพื่อวัตถุประสงค์ที่ระบุไว้</p>
              <p>ข้อมูลคิวจะถูกลบอัตโนมัติหลังจาก 90 วัน</p>
              <p>ข้อมูลผู้ใช้งานจะถูกลบภายใน 30 วันหลังจากลบบัญชี</p>
            </div>
          </section>

          {/* Section 9 */}
          <section>
            <h2 className="text-lg font-bold text-gray-900 mb-3">9. การติดต่อ</h2>
            <div className="text-sm text-gray-600 space-y-3">
              <p>หากมีคำถามเกี่ยวกับนโยบายความเป็นส่วนตัว กรุณาติดต่อ:</p>
              <div className="bg-gray-50 rounded-xl p-4 mt-2">
                <p><strong>บริษัท ByteBoxx Solution จำกัด</strong></p>
                <p>LINE OA: <a href="https://lin.ee/OqlmFFG" target="_blank" rel="noopener noreferrer" className="text-green-600 font-bold hover:underline">https://lin.ee/OqlmFFG</a></p>
              </div>
            </div>
          </section>
        </div>

        {/* Back to home */}
        <div className="text-center">
          <Link href="/" className="inline-flex items-center gap-2 text-sm text-teal-600 hover:text-teal-700 font-medium">
            <ArrowLeft className="w-4 h-4" />
            กลับสู่หน้าหลัก
          </Link>
        </div>
      </div>
    </div>
  )
}
