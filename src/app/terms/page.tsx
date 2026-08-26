import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

export const metadata = {
  title: 'Clinic-Q | เงื่อนไขการใช้งาน',
  description: 'เงื่อนไขและข้อกำหนดในการใช้งาน Platform Clinic-Q',
}

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center gap-3">
          <Link href="/" className="w-9 h-9 rounded-xl bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors">
            <ArrowLeft className="w-5 h-5 text-gray-600" />
          </Link>
          <div>
            <h1 className="text-lg font-bold text-gray-900">เงื่อนไขการใช้งาน</h1>
            <p className="text-xs text-gray-500">Terms of Service</p>
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
                เงื่อนไขและข้อกำหนดนี้ (&ldquo;เงื่อนไข&rdquo;) มีผลบังคับใช้กับการใช้งาน Platform Clinic-Q 
                (&ldquo;ระบบ&rdquo;) ซึ่งให้บริการจัดการคิวคลินิกออนไลน์ โดย บริษัท ByteBoxx Solution จำกัด 
                (&ldquo;ผู้ให้บริการ&rdquo;)
              </p>
              <p>
                การสมัครใช้งานหรือเข้าใช้งานระบบถือว่าท่านได้อ่าน เข้าใจ และยอมรับเงื่อนไขข้อกำหนดนี้ทั้งหมด 
                หากท่านไม่ยอมรับเงื่อนไข กรุณาหยุดใช้งานระบบ
              </p>
            </div>
          </section>

          {/* Section 2 */}
          <section>
            <h2 className="text-lg font-bold text-gray-900 mb-3">2. นิยามคำศัพท์</h2>
            <div className="text-sm text-gray-600 space-y-2">
              <p><strong>&ldquo;ผู้ใช้งาน&rdquo;</strong> หมายถึง บุคคลหรือนิติบุคคลที่สมัครและใช้งานระบบ</p>
              <p><strong>&ldquo;คลินิก&rdquo;</strong> หมายถึง สถานพยาบาลที่สมัครใช้งานระบบ</p>
              <p><strong>&ldquo;ผู้รับบริการ&rdquo;</strong> หมายถึง คนไข้หรือผู้เข้ารับบริการที่คลินิก</p>
              <p><strong>&ldquo;ข้อมูลส่วนบุคคล&rdquo;</strong> หมายถึง ข้อมูลที่สามารถระบุตัวตนของบุคคลได้ เช่น ชื่อ เบอร์โทร</p>
            </div>
          </section>

          {/* Section 3 */}
          <section>
            <h2 className="text-lg font-bold text-gray-900 mb-3">3. การสมัครใช้งาน</h2>
            <div className="text-sm text-gray-600 space-y-3">
              <p>3.1 ผู้ใช้งานต้องกรอกข้อมูลการสมัครให้ถูกต้องและเป็นจริง</p>
              <p>3.2 ผู้ใช้งานรับผิดชอบรักษารหัสผ่านของตนเอง</p>
              <p>3.3 บัญชีทดลองใช้งานฟรี 30 วัน ไม่ต้องบัตรเครดิต</p>
              <p>3.4 หลังหมดอายุทดลอง ต้องสมัครแพ็กเกจเพื่อใช้งานต่อ</p>
            </div>
          </section>

          {/* Section 4 */}
          <section>
            <h2 className="text-lg font-bold text-gray-900 mb-3">4. แพ็กเกจและค่าบริการ</h2>
            <div className="text-sm text-gray-600 space-y-3">
              <p>4.1 แพ็กเกจ Clinic-Q Professional ราคา 599 บาท/เดือน หรือ 5,999 บาท/ปี</p>
              <p>4.2 ราคาพิเศษ Early Bird 3,999 บาท/ปี สำหรับผู้สมัครก่อนหมดอายุทดลอง</p>
              <p>4.3 ค่าบริการไม่สามารถขอคืนเงินได้ ยกเว้นกรณีระบบขัดข้องที่ไม่สามารถใช้งานได้</p>
              <p>4.4 ผู้ให้บริการขอสงวนสิทธิ์ในการเปลี่ยนแปลงราคาโดยแจ้งล่วงหน้า 30 วัน</p>
            </div>
          </section>

          {/* Section 5 */}
          <section>
            <h2 className="text-lg font-bold text-gray-900 mb-3">5. สิทธิ์การใช้งาน</h2>
            <div className="text-sm text-gray-600 space-y-3">
              <p>5.1 ผู้ใช้งานได้รับสิทธิ์ใช้งานระบบตามแพ็กเกจที่เลือก</p>
              <p>5.2 ห้ามคัดลอก ดัดแปลง หรือจำหน่ายต่อระบบโดยไม่ได้รับอนุญาต</p>
              <p>5.3 ผู้ให้บริการอาจระงับการใช้งานหากพบการใช้งานที่ไม่เหมาะสม</p>
            </div>
          </section>

          {/* Section 6 */}
          <section>
            <h2 className="text-lg font-bold text-gray-900 mb-3">6. ข้อมูลส่วนบุคคล</h2>
            <div className="text-sm text-gray-600 space-y-3">
              <p>6.1 ระบบจะเก็บข้อมูลส่วนบุคคลของผู้รับบริการ เช่น ชื่อ เบอร์โทร เพื่อใช้ในการจัดคิว</p>
              <p>6.2 ข้อมูลจะถูกเก็บอย่างปลอดภัยบน Supabase (Cloud Database)</p>
              <p>6.3 ข้อมูลจะไม่ถูกเปิดเผยแก่บุคคลที่สาม ยกเว้นได้รับความยินยอม</p>
              <p>6.4 คลินิกเป็นเจ้าของข้อมูลของตนเอง สามารถลบได้ทุกเมื่อ</p>
            </div>
          </section>

          {/* Section 7 */}
          <section>
            <h2 className="text-lg font-bold text-gray-900 mb-3">7. การแจ้งเตือน</h2>
            <div className="text-sm text-gray-600 space-y-3">
              <p>7.1 ระบบอาจส่งการแจ้งเตือนผ่าน LINE OA หรือ SMS ไปยังผู้รับบริการ</p>
              <p>7.2 การแจ้งเตือนเป็นเพียงเครื่องมือช่วยเหลือ ไม่รับประกันความถูกต้อง 100%</p>
              <p>7.3 ผู้รับบริการสามารถยกเลิกการรับแจ้งเตือนได้</p>
            </div>
          </section>

          {/* Section 8 */}
          <section>
            <h2 className="text-lg font-bold text-gray-900 mb-3">8. ความรับผิดชอบ</h2>
            <div className="text-sm text-gray-600 space-y-3">
              <p>8.1 ผู้ให้บริการไม่รับผิดชอบต่อความเสียหายที่เกิดจากการใช้งานระบบ</p>
              <p>8.2 ผู้ให้บริการไม่รับผิดชอบต่อการสูญหายของข้อมูลอันเนื่องมาจากเหตุสุดวิสัย</p>
              <p>8.3 คลินิกรับผิดชอบดูแลข้อมูลของตนเองและผู้รับบริการ</p>
            </div>
          </section>

          {/* Section 9 */}
          <section>
            <h2 className="text-lg font-bold text-gray-900 mb-3">9. การแก้ไขเงื่อนไข</h2>
            <div className="text-sm text-gray-600 space-y-3">
              <p>9.1 ผู้ให้บริการขอสงวนสิทธิ์ในการแก้ไขเงื่อนไขนี้โดยแจ้งล่วงหน้า</p>
              <p>9.2 การใช้งานระบบต่อหลังการแก้ไขถือว่ายอมรับเงื่อนไขใหม่</p>
            </div>
          </section>

          {/* Section 10 */}
          <section>
            <h2 className="text-lg font-bold text-gray-900 mb-3">10. การติดต่อ</h2>
            <div className="text-sm text-gray-600 space-y-3">
              <p>หากมีคำถามเกี่ยวกับเงื่อนไขการใช้งาน กรุณาติดต่อ:</p>
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
