'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import {
  Plus, Edit, Trash2, X, AlertTriangle, Stethoscope,
  ChevronDown, ChevronRight,
} from 'lucide-react'
import { clsx } from 'clsx'
import { useClinic } from '@/lib/clinic-context'
import { useAuth } from '@/lib/auth-context'
import {
  type Branch, type Procedure,
  type ClinicBranchData,
  getDefaultBranchData,
} from '@/lib/branch-data'
import Toast from '@/components/ui/Toast'
import SaveResultModal from '@/components/ui/SaveResultModal'
import { isSupabaseReady, getSupabase } from '@/lib/supabase'
import { getClinicSetting } from '@/lib/clinic-data'

export default function BranchRoomSettings() {
  const { config, currentClinic } = useClinic()
  const { currentClinicId } = useAuth()
  
  // Use clinic-specific storage key
  const storageKey = currentClinicId ? `clinic-branch-data-${currentClinicId}` : 'clinic-branch-data'
  const [data, setData] = useState<ClinicBranchData>(() => getDefaultBranchData(currentClinic || 'dental'))
  // Always-current data for the debounced writer — setData is async, so a
  // closure captured at schedule-time may hold pre-update data.
  const dataRef = useRef(data)
  useEffect(() => { dataRef.current = data }, [data])
  // Becomes true once the initial load (Supabase → localStorage → defaults) finished.
  // Persistence is gated on this so defaults never clobber real DB data on mount.
  const [hydrated, setHydrated] = useState(false)
  const hydratedRef = useRef(false)
  // Save-result popup — shown only after the DB write confirms success/failure
  const [saveResult, setSaveResult] = useState<{ success: boolean; retry?: () => void } | null>(null)

  // Load branch_data with Supabase as the SOURCE OF TRUTH, then localStorage as
  // fallback, and only then defaults (which are display-only and never persisted
  // automatically). Persistence happens exclusively through commitData() after a
  // user action — defaults can never overwrite real DB data on a fresh device.
  useEffect(() => {
    let cancelled = false
    const load = async () => {
      if (cancelled) return
      // 1. Supabase first
      if (currentClinicId && isSupabaseReady()) {
        try {
          const sb = getSupabase()
          if (sb) {
            const { data: row } = await sb
              .from('clinic_settings')
              .select('setting_value')
              .eq('clinic_id', currentClinicId)
              .eq('setting_key', 'branch_data')
              .maybeSingle()
            if (cancelled) return
            // setting_value may come back as a parsed object (jsonb written as an
            // object) OR as a string (legacy rows written with JSON.stringify).
            const raw = row?.setting_value
            let remote: ClinicBranchData | null = null
            if (typeof raw === 'string') {
              try { remote = JSON.parse(raw) } catch {}
            } else if (raw && (raw as any)?.branches?.length) {
              remote = raw as unknown as ClinicBranchData
            }
            if (remote && remote.branches?.length) {
              setData(remote)
              hydratedRef.current = true
              setHydrated(true)
              return
            }
          }
        } catch {}
      }
      if (cancelled) return
      // 2. localStorage fallback
      const saved = localStorage.getItem(storageKey)
      if (saved) {
        try {
          const parsed = JSON.parse(saved)
          if (parsed && parsed.branches && parsed.branches.length > 0) {
            setData(parsed)
            hydratedRef.current = true
            setHydrated(true)
            return
          }
        } catch {}
      }
      // 3. Defaults — display only, never auto-persisted
      if (cancelled) return
      setData(getDefaultBranchData(currentClinic || 'dental'))
      hydratedRef.current = true
      setHydrated(true)
    }
    load()
    return () => { cancelled = true }
  }, [storageKey, currentClinic, currentClinicId, isSupabaseReady])

  // localStorage cache only (fast reads). Supabase persistence happens exclusively
  // through commitData() below, triggered by explicit user actions — so a fresh
  // device can never overwrite the DB with defaults.
  useEffect(() => {
    if (!hydrated) return
    try {
      localStorage.setItem(storageKey, JSON.stringify(data))
    } catch {}
  }, [data, storageKey, hydrated])
  const [expandedBranch, setExpandedBranch] = useState<string | null>(data.branches[0]?.id || null)
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null)

  // Modals
  const [showBranchModal, setShowBranchModal] = useState(false)
  const [editingBranch, setEditingBranch] = useState<Branch | null>(null)
  const [branchForm, setBranchForm] = useState({ name: '' })

  const [showProcedureModal, setShowProcedureModal] = useState(false)
  const [editingProcedure, setEditingProcedure] = useState<{ branchId: string; procedure: Procedure | null }>({ branchId: '', procedure: null })
  const [procForm, setProcForm] = useState({ name: '', estimatedDuration: 30 })

  const [confirmDelete, setConfirmDelete] = useState<{ type: 'branch' | 'procedure'; id: string; branchId?: string } | null>(null)

  const debounceSave = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Atomic upsert to Supabase — resolves true only when the DB write succeeded.
  // This component owns the `branches` field; it MERGES with the current DB
  // row instead of overwriting it so concurrent practitioners/rooms writes
  // (practitioner-context) are never clobbered by a stale local snapshot.
  const commitData = useCallback(async (): Promise<boolean> => {
    const latest = dataRef.current
    let ok = true
    try {
      try {
        localStorage.setItem(storageKey, JSON.stringify(latest))
      } catch {}
      if (currentClinicId && isSupabaseReady()) {
        const sb = getSupabase()
        if (sb) {
          // Read the current row first so we only touch branches/procedures.
          let merged: any = latest
          try {
            const existing = await getClinicSetting(currentClinicId, 'branch_data') as any
            const dbData = (existing && typeof existing === 'object' && Array.isArray(existing.branches))
              ? existing
              : null
            if (dbData) {
              merged = {
                ...dbData,
                branches: latest.branches,
              }
            }
          } catch {
            // Read failed — fall back to writing our full snapshot.
          }
          // Write the object directly so jsonb stores it as JSON (not a
          // double-encoded string like legacy rows). Reads handle both forms.
          const { error } = await sb.from('clinic_settings').upsert(
            { clinic_id: currentClinicId, setting_key: 'branch_data', setting_value: merged },
            { onConflict: 'clinic_id,setting_key' }
          )
          ok = !error
        }
      }
    } catch {
      ok = false
    }
    return ok
  }, [storageKey, currentClinicId, isSupabaseReady])

  // Debounced save after a user action — popup appears only after the DB answers.
  const showSaveResult = useCallback((ok: boolean) => {
    setSaveResult(ok
      ? { success: true }
      : { success: false, retry: () => { void commitData().then(showSaveResult) } })
  }, [commitData])
  const scheduleSave = useCallback(() => {
    if (debounceSave.current) clearTimeout(debounceSave.current)
    debounceSave.current = setTimeout(async () => {
      if (!hydratedRef.current) {
        // Initial load still in flight — retry shortly (avoids writing defaults)
        scheduleSave()
        return
      }
      showSaveResult(await commitData())
    }, 250)
  }, [commitData, showSaveResult])

  const showToast = (msg: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToast({ message: msg, type })
    setTimeout(() => setToast(null), 3000)
  }


  /* ───── Branch CRUD ───── */
  const saveBranch = () => {
    if (!branchForm.name.trim()) { showToast('กรุณากรอกชื่อสาขา', 'error'); return }
    if (editingBranch) {
      setData(prev => ({ ...prev, branches: prev.branches.map(b => b.id === editingBranch.id ? { ...b, name: branchForm.name } : b) }))
    } else {
      const newBranch: Branch = { id: `branch-${Date.now()}`, name: branchForm.name, category: currentClinic || 'dental', procedures: [], active: true }
      setData(prev => ({ ...prev, branches: [...prev.branches, newBranch] }))
    }
    setShowBranchModal(false)
    scheduleSave()
  }

  /* ───── Procedure CRUD ───── */
  const saveProcedure = () => {
    if (!procForm.name.trim()) { showToast('กรุณากรอกชื่อหัตถการ', 'error'); return }
    const { branchId, procedure } = editingProcedure
    if (procedure) {
      setData(prev => ({
        ...prev,
        branches: prev.branches.map(b => b.id === branchId
          ? { ...b, procedures: b.procedures.map(p => p.id === procedure.id ? { ...p, name: procForm.name, estimatedDuration: procForm.estimatedDuration } : p) }
          : b
        ),
      }))

    } else {
      const newProc: Procedure = { id: `proc-${Date.now()}`, name: procForm.name, estimatedDuration: procForm.estimatedDuration, active: true }
      setData(prev => ({
        ...prev,
        branches: prev.branches.map(b => b.id === branchId ? { ...b, procedures: [...b.procedures, newProc] } : b),
      }))

    }
    setShowProcedureModal(false)
    scheduleSave()
  }

  const toggleProcedure = (branchId: string, procId: string) => {
    setData(prev => ({
      ...prev,
      branches: prev.branches.map(b => b.id === branchId
        ? { ...b, procedures: b.procedures.map(p => p.id === procId ? { ...p, active: !p.active } : p) }
        : b
      ),
    }))
    scheduleSave()
  }

  const handleDelete = () => {
    if (!confirmDelete) return
    const { type, id, branchId } = confirmDelete
    if (type === 'branch') {
      setData(prev => ({ ...prev, branches: prev.branches.filter(b => b.id !== id) }))
      showToast('ลบสาขาแล้ว', 'info')
    } else if (type === 'procedure') {
      setData(prev => ({
        ...prev,
        branches: prev.branches.map(b => b.id === branchId ? { ...b, procedures: b.procedures.filter(p => p.id !== id) } : b),
      }))
      showToast('ลบหัตถการแล้ว', 'info')
    }
    setConfirmDelete(null)
    scheduleSave()
  }

  if (!config) return null

  return (
    <div className="space-y-6">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      {saveResult && (
        <SaveResultModal
          success={saveResult.success}
          onClose={() => setSaveResult(null)}
          onRetry={saveResult.retry}
        />
      )}

      {/* ─── Branch Modal ─── */}
      {showBranchModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between p-6 border-b border-gray-100">
              <h2 className="text-xl font-bold">{editingBranch ? 'แก้ไขสาขา' : 'เพิ่มสาขาใหม่'}</h2>
              <button onClick={() => setShowBranchModal(false)} className="p-2 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">ชื่อสาขาและหัตถการ *</label>
                <input type="text" value={branchForm.name} onChange={(e) => setBranchForm({ name: e.target.value })} placeholder="เช่น ทันตกรรมจัดฟัน" className="input-field" />
              </div>
            </div>
            <div className="flex justify-end gap-3 p-6 border-t border-gray-100">
              <button onClick={() => setShowBranchModal(false)} className="btn-secondary">ยกเลิก</button>
              <button onClick={saveBranch} className="btn-primary" style={{ backgroundColor: config.color }}>บันทึก</button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Procedure Modal ─── */}
      {showProcedureModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between p-6 border-b border-gray-100">
              <h2 className="text-xl font-bold">{editingProcedure.procedure ? 'แก้ไขหัตถการ' : 'เพิ่มหัตถการ'}</h2>
              <button onClick={() => setShowProcedureModal(false)} className="p-2 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">ชื่อหัตถการ *</label>
                <input type="text" value={procForm.name} onChange={(e) => setProcForm({ ...procForm, name: e.target.value })} placeholder="เช่น ขูดหินปูน" className="input-field" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">ระยะเวลา (นาที)</label>
                <select value={procForm.estimatedDuration} onChange={(e) => setProcForm({ ...procForm, estimatedDuration: Number(e.target.value) })} className="input-field">
                  {[10, 15, 20, 30, 45, 60, 90].map(d => <option key={d} value={d}>{d} นาที</option>)}
                </select>
              </div>
            </div>
            <div className="flex justify-end gap-3 p-6 border-t border-gray-100">
              <button onClick={() => setShowProcedureModal(false)} className="btn-secondary">ยกเลิก</button>
              <button onClick={saveProcedure} className="btn-primary" style={{ backgroundColor: config.color }}>บันทึก</button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Delete Confirmation ─── */}
      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center"><AlertTriangle className="w-5 h-5 text-red-500" /></div>
              <h3 className="text-lg font-bold">ยืนยันการลบ</h3>
            </div>
            <p className="text-gray-600 mb-6">ต้องการลบรายการนี้ใช่หรือไม่?</p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setConfirmDelete(null)} className="btn-secondary">ยกเลิก</button>
              <button onClick={handleDelete} className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 font-medium">ลบ</button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Branches Section ─── */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">สาขาและหัตถการ</h3>
            <p className="text-sm text-gray-500">จัดการสาขา หัตถการ และผู้ทำหัตถการ (ขณะนี้จัดการผ่าน clinic_settings.branch_data)</p>
          </div>
          <button onClick={() => { setEditingBranch(null); setBranchForm({ name: '' }); setShowBranchModal(true) }} className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white" style={{ backgroundColor: config.color }}>
            <Plus className="w-4 h-4" /> เพิ่มสาขา
          </button>
        </div>

        <div className="space-y-3">
          {data.branches.map((branch) => {
            const isExpanded = expandedBranch === branch.id
            const practitioner = data.practitioners.find(p => p.branchId === branch.id)
            return (
              <div key={branch.id} className="rounded-xl overflow-hidden border-2" style={{ borderColor: isExpanded ? config.color : '#E5E7EB' }}>
                {/* Branch Header */}
                <div className="flex items-center justify-between p-4 cursor-pointer transition-colors" style={{ backgroundColor: isExpanded ? `${config.color}08` : '#FAFAFA' }} onClick={() => setExpandedBranch(isExpanded ? null : branch.id)}>
                  <div className="flex items-center gap-3">
                    {isExpanded ? <ChevronDown className="w-4 h-4" style={{ color: config.color }} /> : <ChevronRight className="w-4 h-4 text-gray-400" />}
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ backgroundColor: config.color }}>
                      <Stethoscope className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <p className="font-bold text-base" style={{ color: config.color }}>{branch.name}</p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        <span className="font-medium text-gray-700">{branch.procedures.filter(p => p.active).length} หัตถการ</span>
                        {practitioner && <><span className="text-gray-300 mx-1">•</span><span>{practitioner.name}</span></>}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                    <button onClick={() => { setEditingBranch(branch); setBranchForm({ name: branch.name }); setShowBranchModal(true) }} className="p-2 hover:bg-gray-100 rounded-lg"><Edit className="w-4 h-4 text-gray-500" /></button>
                    <button onClick={() => setConfirmDelete({ type: 'branch', id: branch.id })} className="p-2 hover:bg-red-50 rounded-lg"><Trash2 className="w-4 h-4 text-gray-400 hover:text-red-500" /></button>
                  </div>
                </div>

                {/* Branch Content */}
                {isExpanded && (
                  <div className="border-t border-dashed p-4 space-y-2" style={{ borderColor: `${config.color}30`, backgroundColor: 'white' }}>
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: config.color }}>🩺 รายการหัตถการของ{branch.name}</p>
                      <button onClick={() => { setEditingProcedure({ branchId: branch.id, procedure: null }); setProcForm({ name: '', estimatedDuration: 30 }); setShowProcedureModal(true) }} className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium text-white" style={{ backgroundColor: config.color }}>
                        <Plus className="w-3 h-3" /> เพิ่มหัตถการ
                      </button>
                    </div>
                    {branch.procedures.length === 0 && <p className="text-sm text-gray-400 text-center py-4">ยังไม่มีหัตถการ</p>}
                    {branch.procedures.map(proc => (
                      <div key={proc.id} className="flex items-center justify-between py-2.5 px-3 rounded-lg hover:bg-gray-50 transition-colors">
                        <div className="flex items-center gap-3">
                          <div className="w-5 h-5 rounded flex items-center justify-center border" style={{ borderColor: proc.active ? config.color : '#D1D5DB', backgroundColor: proc.active ? `${config.color}15` : 'transparent' }}>
                            <div className={clsx('w-2 h-2 rounded-sm', proc.active ? '' : 'bg-gray-300')} style={proc.active ? { backgroundColor: config.color } : {}} />
                          </div>
                          <span className={clsx('text-sm', proc.active ? 'font-medium text-gray-900' : 'text-gray-400 line-through')}>{proc.name}</span>
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-500 font-medium">{proc.estimatedDuration} น.</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => toggleProcedure(branch.id, proc.id)}
                            className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${proc.active ? 'bg-emerald-500' : 'bg-gray-300'}`}
                            title={proc.active ? 'ปิดใช้งานหัตถการ' : 'เปิดใช้งานหัตถการ'}
                          >
                            <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${proc.active ? 'translate-x-4' : 'translate-x-0.5'}`} />
                          </button>
                          <button onClick={() => { setEditingProcedure({ branchId: branch.id, procedure: proc }); setProcForm({ name: proc.name, estimatedDuration: proc.estimatedDuration }); setShowProcedureModal(true) }} className="p-1 hover:bg-gray-200 rounded"><Edit className="w-3 h-3 text-gray-500" /></button>
                          <button onClick={() => setConfirmDelete({ type: 'procedure', id: proc.id, branchId: branch.id })} className="p-1 hover:bg-red-100 rounded"><Trash2 className="w-3 h-3 text-gray-400 hover:text-red-500" /></button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
