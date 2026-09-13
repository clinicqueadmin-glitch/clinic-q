'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { MessageCircle, CheckCircle, XCircle, RefreshCw, Save, AlertTriangle } from 'lucide-react'
import { clsx } from 'clsx'
import { createClient } from '@/utils/supabase/client'
import { DEFAULT_LINE_NOTIFICATIONS, type LineNotificationOptions } from '@/lib/line-settings'

/**
 * LINE Notification settings for every clinic — Platform Owner only.
 *
 * The clinic owner cannot reach these values: they are written through
 * `/api/platform/line-settings`, which re-checks the caller's token against the
 * platform-owner allowlist. Tokens are never returned to the browser, so the
 * fields show whether a value is already stored instead of echoing it.
 */

interface ClinicLineStatus {
  id: string
  name: string
  type: string
  enabled: boolean
  hasSecret: boolean
  hasToken: boolean
  notifications: LineNotificationOptions
  boundUsers: number
  updatedAt: string | null
}

interface FormState {
  enabled: boolean
  notifications: LineNotificationOptions
  channelSecret: string
  channelToken: string
}

const OPTION_LABELS: Array<{ key: keyof Omit<LineNotificationOptions, 'queuesAhead'>; label: string; hint: string }> = [
  { key: 'onCalled', label: 'แจ้งเตือนเมื่อเรียกคิว', hint: 'ส่งเมื่อถึงคิวคนไข้' },
  { key: 'onServing', label: 'แจ้งเตือนเมื่อเริ่มให้บริการ', hint: 'ส่งเมื่อเริ่มทำหัตถการ' },
  { key: 'onCompleted', label: 'แจ้งเตือนเมื่อเสร็จสิ้น', hint: 'ส่งเมื่อปิดคิว' },
  { key: 'onCancelled', label: 'แจ้งเตือนเมื่อยกเลิกคิว', hint: 'ส่งเมื่อคิวถูกยกเลิก' },
]

function emptyForm(): FormState {
  return {
    enabled: false,
    notifications: { ...DEFAULT_LINE_NOTIFICATIONS },
    channelSecret: '',
    channelToken: '',
  }
}

async function authHeaders(): Promise<Record<string, string>> {
  const sb = createClient()
  const token = sb ? (await sb.auth.getSession()).data.session?.access_token : null
  return token ? { Authorization: `Bearer ${token}` } : {}
}

export default function PlatformLineSettings() {
  const [clinics, setClinics] = useState<ClinicLineStatus[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [selectedId, setSelectedId] = useState('')
  const [form, setForm] = useState<FormState>(emptyForm)
  const [isSaving, setIsSaving] = useState(false)
  const [saveResult, setSaveResult] = useState<{ ok: boolean; message: string } | null>(null)

  const selected = useMemo(() => clinics.find(c => c.id === selectedId) || null, [clinics, selectedId])

  const load = useCallback(async () => {
    setIsLoading(true)
    setLoadError('')
    try {
      const res = await fetch('/api/platform/line-settings', { headers: await authHeaders() })
      const body = await res.json().catch(() => ({}))
      if (!res.ok || body?.ok === false) {
        setLoadError(body?.error === 'forbidden' ? 'ไม่มีสิทธิ์เข้าถึง' : 'โหลดข้อมูลไม่สำเร็จ')
        setClinics([])
        return
      }
      const list: ClinicLineStatus[] = body.clinics || []
      setClinics(list)
      setSelectedId(prev => prev || list[0]?.id || '')
    } catch {
      setLoadError('เชื่อมต่อเซิร์ฟเวอร์ไม่สำเร็จ')
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => { void load() }, [load])

  // Load the selected clinic's values into the form (secrets stay blank).
  useEffect(() => {
    if (!selected) return
    setForm({
      enabled: selected.enabled,
      notifications: { ...selected.notifications },
      channelSecret: '',
      channelToken: '',
    })
    setSaveResult(null)
  }, [selected])

  const save = async () => {
    if (!selected) return
    setIsSaving(true)
    setSaveResult(null)
    try {
      const payload: Record<string, unknown> = {
        clinicId: selected.id,
        enabled: form.enabled,
        notifications: form.notifications,
      }
      // Only send a credential when a new one was typed, so saving the switches
      // never wipes a token the platform owner did not touch.
      if (form.channelSecret.trim()) payload.channelSecret = form.channelSecret.trim()
      if (form.channelToken.trim()) payload.channelToken = form.channelToken.trim()

      const res = await fetch('/api/platform/line-settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...(await authHeaders()) },
        body: JSON.stringify(payload),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok || body?.ok === false) {
        setSaveResult({ ok: false, message: body?.error === 'forbidden' ? 'ไม่มีสิทธิ์บันทึก' : 'บันทึกไม่สำเร็จ' })
        return
      }

      // Reflect the saved values in the list without a second round-trip.
      setClinics(prev => prev.map(c => c.id === selected.id
        ? {
            ...c,
            enabled: !!body.clinic?.enabled,
            hasSecret: !!body.clinic?.hasSecret,
            hasToken: !!body.clinic?.hasToken,
            notifications: body.clinic?.notifications || c.notifications,
            updatedAt: body.clinic?.updatedAt || c.updatedAt,
          }
        : c))
      setForm(prev => ({ ...prev, channelSecret: '', channelToken: '' }))
      setSaveResult({ ok: true, message: 'บันทึกการตั้งค่า LINE เรียบร้อย' })
    } catch {
      setSaveResult({ ok: false, message: 'เชื่อมต่อเซิร์ฟเวอร์ไม่สำเร็จ' })
    } finally {
      setIsSaving(false)
    }
  }

  const enabledCount = clinics.filter(c => c.enabled).length

  return (
    <div id="line" className="bg-white rounded-3xl shadow-sm border border-gray-100 p-6 mb-8 scroll-mt-20">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-[#06c755] to-emerald-600 flex items-center justify-center shadow-md shadow-emerald-100">
            <MessageCircle className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="text-lg font-extrabold text-gray-900">💬 LINE Notification</h2>
            <p className="text-xs text-gray-500">
              จัดการการแจ้งเตือนผ่าน LINE ของทุกคลินิก · เปิดใช้งาน {enabledCount}/{clinics.length} คลินิก
            </p>
          </div>
        </div>
        <button
          onClick={() => void load()}
          disabled={isLoading}
          className="flex items-center gap-2 px-3 py-2 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors disabled:opacity-50"
        >
          <RefreshCw className={clsx('w-4 h-4', isLoading && 'animate-spin')} />
          รีเฟรช
        </button>
      </div>

      {loadError && (
        <div className="flex items-center gap-2 p-3 mb-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          {loadError}
        </div>
      )}

      {isLoading ? (
        <div className="py-10 text-center text-sm text-gray-400">กำลังโหลดข้อมูล LINE…</div>
      ) : clinics.length === 0 ? (
        <div className="py-10 text-center text-sm text-gray-400">ยังไม่มีคลินิกในระบบ</div>
      ) : (
        <>
          {/* ── Clinic picker ── */}
          <div className="mb-5">
            <label className="block text-sm font-medium text-gray-700 mb-2">เลือกคลินิก</label>
            <select
              value={selectedId}
              onChange={(e) => setSelectedId(e.target.value)}
              className="w-full md:w-96 px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
            >
              {clinics.map(c => (
                <option key={c.id} value={c.id}>
                  {c.enabled ? '🟢' : '⚪'} {c.name} — {c.enabled ? 'เปิดใช้งาน' : 'ปิดใช้งาน'}
                </option>
              ))}
            </select>
          </div>

          {selected && (
            <div className="rounded-2xl border border-gray-100 bg-gray-50/60 p-5 mb-6">
              {/* ── Master switch ── */}
              <div className="flex flex-wrap items-center justify-between gap-3 pb-4 mb-4 border-b border-gray-200">
                <div>
                  <p className="font-bold text-gray-900">{selected.name}</p>
                  <p className="text-xs text-gray-500">
                    {selected.hasToken ? 'ตั้งค่า Channel Token แล้ว' : 'ยังไม่ได้ตั้งค่า Channel Token'}
                    {' · '}
                    ผู้ผูก LINE {selected.boundUsers} คน
                  </p>
                </div>
                <button
                  onClick={() => setForm(prev => ({ ...prev, enabled: !prev.enabled }))}
                  className={clsx(
                    'flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all',
                    form.enabled ? 'bg-emerald-500 text-white hover:bg-emerald-600' : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
                  )}
                >
                  {form.enabled ? <CheckCircle className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
                  {form.enabled ? 'เปิดใช้งาน' : 'ปิดใช้งาน'}
                </button>
              </div>

              {/* ── Credentials ── */}
              <div className="grid md:grid-cols-2 gap-4 mb-5">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Channel Secret</label>
                  <input
                    type="password"
                    value={form.channelSecret}
                    onChange={(e) => setForm(prev => ({ ...prev, channelSecret: e.target.value }))}
                    placeholder={selected.hasSecret ? '•••••••• (ตั้งค่าแล้ว — เว้นว่างเพื่อใช้ค่าเดิม)' : 'วาง Channel Secret ของ LINE OA คลินิกนี้'}
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Channel Access Token</label>
                  <input
                    type="password"
                    value={form.channelToken}
                    onChange={(e) => setForm(prev => ({ ...prev, channelToken: e.target.value }))}
                    placeholder={selected.hasToken ? '•••••••• (ตั้งค่าแล้ว — เว้นว่างเพื่อใช้ค่าเดิม)' : 'วาง Channel Access Token ของ LINE OA คลินิกนี้'}
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
                  />
                </div>
              </div>

              {/* ── Notification options ── */}
              <p className="text-sm font-medium text-gray-700 mb-2">ตั้งค่าการแจ้งเตือน</p>
              <div className="grid md:grid-cols-2 gap-2 mb-5">
                {OPTION_LABELS.map(opt => (
                  <label
                    key={opt.key}
                    className="flex items-start gap-3 p-3 rounded-xl bg-white border border-gray-100 cursor-pointer hover:border-emerald-200"
                  >
                    <input
                      type="checkbox"
                      checked={form.notifications[opt.key]}
                      onChange={(e) => setForm(prev => ({
                        ...prev,
                        notifications: { ...prev.notifications, [opt.key]: e.target.checked },
                      }))}
                      className="mt-0.5 w-4 h-4 accent-emerald-600"
                    />
                    <span>
                      <span className="block text-sm font-medium text-gray-800">{opt.label}</span>
                      <span className="block text-xs text-gray-400">{opt.hint}</span>
                    </span>
                  </label>
                ))}
              </div>

              {/* ── Queues ahead ── */}
              <div className="p-4 rounded-xl bg-white border border-amber-100 mb-5">
                <label className="block text-sm font-medium text-gray-800 mb-1">
                  แจ้งเตือนก่อนถึงคิว เมื่อเหลือคิวก่อนหน้า
                </label>
                <p className="text-xs text-gray-400 mb-3">
                  ระบบจะแจ้งคนไข้ที่เหลือคิวข้างหน้าเท่านี้ · ใส่ 0 เพื่อปิดการแจ้งเตือนล่วงหน้า
                </p>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min={0}
                    max={10}
                    value={form.notifications.queuesAhead}
                    onChange={(e) => {
                      const n = Math.max(0, Math.min(10, Math.floor(Number(e.target.value) || 0)))
                      setForm(prev => ({ ...prev, notifications: { ...prev.notifications, queuesAhead: n } }))
                    }}
                    className="w-24 px-3 py-2 rounded-xl border border-gray-200 text-sm text-center focus:outline-none focus:ring-2 focus:ring-amber-400"
                  />
                  <span className="text-sm text-gray-600">คิว</span>
                  <button
                    onClick={() => setForm(prev => ({ ...prev, notifications: { ...prev.notifications, queuesAhead: 1 } }))}
                    className="ml-2 px-3 py-2 rounded-xl border border-amber-200 bg-amber-50 text-xs font-bold text-amber-700 hover:bg-amber-100"
                  >
                    ใช้ 1 คิว (แนะนำ)
                  </button>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <button
                  onClick={() => void save()}
                  disabled={isSaving}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-br from-[#06c755] to-emerald-600 text-white text-sm font-bold shadow-md shadow-emerald-100 hover:opacity-95 disabled:opacity-60"
                >
                  {isSaving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  {isSaving ? 'กำลังบันทึก…' : 'บันทึกการตั้งค่า'}
                </button>
                {saveResult && (
                  <span className={clsx('text-sm font-medium', saveResult.ok ? 'text-emerald-600' : 'text-red-600')}>
                    {saveResult.ok ? '✅ ' : '⚠️ '}{saveResult.message}
                  </span>
                )}
              </div>
            </div>
          )}

          {/* ── Status of every clinic ── */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-gray-500 border-b border-gray-100">
                  <th className="py-2 pr-4">ชื่อคลินิก</th>
                  <th className="py-2 pr-4">LINE Notification</th>
                  <th className="py-2 pr-4">Channel Token</th>
                  <th className="py-2 pr-4">ก่อนถึงคิว</th>
                  <th className="py-2 pr-4">ผู้ผูก LINE</th>
                  <th className="py-2">อัปเดตล่าสุด</th>
                </tr>
              </thead>
              <tbody>
                {clinics.map(c => (
                  <tr
                    key={c.id}
                    onClick={() => setSelectedId(c.id)}
                    className={clsx(
                      'border-b border-gray-50 cursor-pointer hover:bg-gray-50/70',
                      c.id === selectedId && 'bg-emerald-50/50'
                    )}
                  >
                    <td className="py-2.5 pr-4 font-medium text-gray-800">{c.name || c.id}</td>
                    <td className="py-2.5 pr-4">
                      <span className={clsx(
                        'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold',
                        c.enabled ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-500'
                      )}>
                        {c.enabled ? '🟢 เปิดใช้งาน' : '⚪ ปิดใช้งาน'}
                      </span>
                    </td>
                    <td className="py-2.5 pr-4 text-xs text-gray-500">{c.hasToken ? 'ตั้งค่าแล้ว' : '—'}</td>
                    <td className="py-2.5 pr-4 text-xs text-gray-600">
                      {c.notifications.queuesAhead > 0 ? `${c.notifications.queuesAhead} คิว` : 'ปิด'}
                    </td>
                    <td className="py-2.5 pr-4 text-xs text-gray-600">{c.boundUsers}</td>
                    <td className="py-2.5 text-xs text-gray-400">
                      {c.updatedAt ? new Date(c.updatedAt).toLocaleString('th-TH', { timeZone: 'Asia/Bangkok' }) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p className="mt-4 text-xs text-gray-400">
            คลินิกไม่สามารถแก้ไขการตั้งค่าเหล่านี้ได้เอง — จัดการโดยเจ้าของระบบเท่านั้น
          </p>
        </>
      )}
    </div>
  )
}
