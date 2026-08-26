'use client'

import { useState } from 'react'
import { clsx } from 'clsx'
import {
  Printer,
  Wifi,
  Usb,
  Bluetooth,
  Settings,
  TestTube,
  Check,
  AlertCircle,
  Save,
  Monitor,
} from 'lucide-react'

interface PrinterConfig {
  name: string
  type: 'network' | 'usb' | 'bluetooth'
  ip: string
  port: number
  paperWidth: 58 | 80
  baudRate: number
  connected: boolean
  isDefault: boolean
}

const defaultPrinters: PrinterConfig[] = [
  {
    name: 'POS Printer หน้าร้าน',
    type: 'network',
    ip: '192.168.1.100',
    port: 9100,
    paperWidth: 80,
    baudRate: 9600,
    connected: true,
    isDefault: true,
  },
  {
    name: 'POS Printer ห้องตรวจ',
    type: 'bluetooth',
    ip: '',
    port: 9100,
    paperWidth: 58,
    baudRate: 9600,
    connected: false,
    isDefault: false,
  },
]

export default function PrintSettingsManager() {
  const [printers, setPrinters] = useState<PrinterConfig[]>(defaultPrinters)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [autoPrint, setAutoPrint] = useState(true)
  const [printPreview, setPrintPreview] = useState(true)
  const [openDrawer, setOpenDrawer] = useState(false)
  const [testPrintDone, setTestPrintDone] = useState(false)

  const typeIcons = {
    network: Wifi,
    usb: Usb,
    bluetooth: Bluetooth,
  }

  const typeLabels = {
    network: 'Network (LAN)',
    usb: 'USB',
    bluetooth: 'Bluetooth',
  }

  const handleTestPrint = (printerName: string) => {
    setTestPrintDone(true)
    setTimeout(() => setTestPrintDone(false), 3000)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl md:text-3xl font-bold text-gray-900">ตั้งค่าเครื่องพิมพ์</h1>
        <p className="text-gray-500 mt-1">จัดการเครื่องพิมพ์ POS และตั้งค่าใบเสร็จ</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Settings */}
        <div className="lg:col-span-2 space-y-6">
          {/* Printer List */}
          <div className="card">
            <div className="p-6 border-b border-gray-100">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-gray-900">เครื่องพิมพ์ที่เชื่อมต่อ</h2>
                <button className="btn-primary text-sm">
                  + เพิ่มเครื่องพิมพ์
                </button>
              </div>
            </div>

            <div className="divide-y divide-gray-100">
              {printers.map((printer, index) => {
                const TypeIcon = typeIcons[printer.type]
                return (
                  <div key={index} className="p-5 hover:bg-gray-50 transition-colors">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-start gap-4">
                        <div className={clsx(
                          'w-12 h-12 rounded-xl flex items-center justify-center',
                          printer.connected ? 'bg-green-100' : 'bg-gray-100'
                        )}>
                          <Printer className={clsx(
                            'w-6 h-6',
                            printer.connected ? 'text-green-600' : 'text-gray-400'
                          )} />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="font-semibold text-gray-900">{printer.name}</h3>
                            {printer.isDefault && (
                              <span className="px-2 py-0.5 bg-primary-100 text-primary-600 text-xs font-medium rounded-full">
                                ค่าเริ่มต้น
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-3 mt-1 text-sm text-gray-500">
                            <span className="flex items-center gap-1">
                              <TypeIcon className="w-3.5 h-3.5" />
                              {typeLabels[printer.type]}
                            </span>
                            {printer.type === 'network' && (
                              <span>{printer.ip}:{printer.port}</span>
                            )}
                            <span>กระดาษ {printer.paperWidth}mm</span>
                          </div>
                          <div className="flex items-center gap-1 mt-2">
                            <div className={clsx(
                              'w-2 h-2 rounded-full',
                              printer.connected ? 'bg-green-500' : 'bg-red-500'
                            )} />
                            <span className={clsx(
                              'text-xs font-medium',
                              printer.connected ? 'text-green-600' : 'text-red-500'
                            )}>
                              {printer.connected ? 'เชื่อมต่อแล้ว' : 'ไม่ได้เชื่อมต่อ'}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleTestPrint(printer.name)}
                          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                          title="ทดสอบพิมพ์"
                        >
                          <TestTube className="w-4 h-4 text-gray-500" />
                        </button>
                        <button
                          onClick={() => setEditingId(editingId === index ? null : index)}
                          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                          title="ตั้งค่า"
                        >
                          <Settings className="w-4 h-4 text-gray-500" />
                        </button>
                      </div>
                    </div>

                    {/* Edit Panel */}
                    {editingId === index && (
                      <div className="mt-4 p-4 bg-gray-50 rounded-xl space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="text-sm font-medium text-gray-700 mb-1 block">ชื่อเครื่องพิมพ์</label>
                            <input
                              type="text"
                              defaultValue={printer.name}
                              className="input-field text-sm"
                            />
                          </div>
                          <div>
                            <label className="text-sm font-medium text-gray-700 mb-1 block">ประเภท</label>
                            <select defaultValue={printer.type} className="input-field text-sm">
                              <option value="network">Network (LAN)</option>
                              <option value="usb">USB</option>
                              <option value="bluetooth">Bluetooth</option>
                            </select>
                          </div>
                          {printer.type === 'network' && (
                            <>
                              <div>
                                <label className="text-sm font-medium text-gray-700 mb-1 block">IP Address</label>
                                <input
                                  type="text"
                                  defaultValue={printer.ip}
                                  className="input-field text-sm font-mono"
                                />
                              </div>
                              <div>
                                <label className="text-sm font-medium text-gray-700 mb-1 block">Port</label>
                                <input
                                  type="number"
                                  defaultValue={printer.port}
                                  className="input-field text-sm font-mono"
                                />
                              </div>
                            </>
                          )}
                          <div>
                            <label className="text-sm font-medium text-gray-700 mb-1 block">ความกว้างกระดาษ</label>
                            <select defaultValue={printer.paperWidth} className="input-field text-sm">
                              <option value={58}>58mm</option>
                              <option value={80}>80mm</option>
                            </select>
                          </div>
                          <div>
                            <label className="text-sm font-medium text-gray-700 mb-1 block">Baud Rate</label>
                            <select defaultValue={printer.baudRate} className="input-field text-sm">
                              <option value={9600}>9600</option>
                              <option value={19200}>19200</option>
                              <option value={38400}>38400</option>
                              <option value={115200}>115200</option>
                            </select>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <button className="btn-primary text-sm flex items-center gap-1">
                            <Save className="w-3.5 h-3.5" />
                            บันทึก
                          </button>
                          <button
                            onClick={() => setEditingId(null)}
                            className="btn-secondary text-sm"
                          >
                            ยกเลิก
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}

              {printers.length === 0 && (
                <div className="p-12 text-center">
                  <Printer className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-500">ยังไม่มีเครื่องพิมพ์ที่เชื่อมต่อ</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Sidebar Settings */}
        <div className="space-y-6">
          {/* Quick Settings */}
          <div className="card p-6">
            <h3 className="font-semibold text-gray-900 mb-4">ตั้งค่าพิมพ์</h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-700">พิมพ์อัตโนมัติ</p>
                  <p className="text-xs text-gray-500">พิมพ์ทันทีเมื่อจบคิว</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={autoPrint}
                    onChange={(e) => setAutoPrint(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:ring-4 peer-focus:ring-primary-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-500"></div>
                </label>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-700">แสดงตัวอย่างก่อนพิมพ์</p>
                  <p className="text-xs text-gray-500">เปิดหน้าต่าง preview ทุกครั้ง</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={printPreview}
                    onChange={(e) => setPrintPreview(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:ring-4 peer-focus:ring-primary-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-500"></div>
                </label>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-700">เปิดลิ้นชักเก็บเงิน</p>
                  <p className="text-xs text-gray-500">สั่งเปิดลิ้นชักอัตโนมัติ</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={openDrawer}
                    onChange={(e) => setOpenDrawer(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:ring-4 peer-focus:ring-primary-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-500"></div>
                </label>
              </div>
            </div>
          </div>

          {/* Test Print Result */}
          {testPrintDone && (
            <div className="card p-4 bg-green-50 border-green-200">
              <div className="flex items-center gap-3">
                <Check className="w-5 h-5 text-green-600" />
                <div>
                  <p className="text-sm font-medium text-green-800">พิมพ์ทดสอบสำเร็จ</p>
                  <p className="text-xs text-green-600">ตรวจสอบกระดาษจากเครื่องพิมพ์</p>
                </div>
              </div>
            </div>
          )}

          {/* Printer Status */}
          <div className="card p-6">
            <h3 className="font-semibold text-gray-900 mb-4">สถานะระบบ</h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-500">เครื่องพิมพ์ที่เชื่อมต่อ</span>
                <span className="font-medium text-green-600">
                  {printers.filter(p => p.connected).length}/{printers.length}
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-500">กระดาษคงเหลือ</span>
                <span className="font-medium text-gray-900">ปกติ</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-500">หมึก/ ribbon</span>
                <span className="font-medium text-gray-900">ปกติ</span>
              </div>
            </div>
          </div>

          {/* Supported Printers */}
          <div className="card p-6">
            <h3 className="font-semibold text-gray-900 mb-3">เครื่องพิมพ์ที่รองรับ</h3>
            <div className="space-y-2 text-sm text-gray-600">
              <p>• Epson TM-T88 series</p>
              <p>• Epson TM-T20 series</p>
              <p>• Star TSP series</p>
              <p>• Bixolon SRP series</p>
              <p>• Citizen CT-S series</p>
              <p>• Xprinter XP series</p>
              <p className="text-xs text-gray-400 mt-3">
                รองรับ ESC/POS command set ทั้งหมด
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
