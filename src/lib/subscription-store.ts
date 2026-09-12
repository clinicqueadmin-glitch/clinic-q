/**
 * ⚠️ SERVER-ONLY MODULE — never import this file from a client component.
 *
 * Subscription state (30-day trial + package purchases) lives in the existing
 * `clinic_settings` table under `setting_key = 'subscription'`, so the Platform
 * dashboard reads one source of truth from any device instead of the browser
 * localStorage of whoever happened to register.
 *
 * Access uses the service-role key (`SUPABASE_SERVICE_ROLE_KEY`, server env
 * only) through PostgREST. The key is never sent to the browser.
 *
 * No import from `@/lib/supabase-admin` on purpose: this module must stay
 * dependency-free so it can be exercised directly in a runtime test.
 */

export type StoredSubscriptionPlan = 'trial' | 'clinicq' | 'monthly' | 'yearly'
export type StoredSubscriptionStatus = 'active' | 'expired' | 'cancelled' | 'suspended'

export interface StoredSubscription {
  plan: StoredSubscriptionPlan
  status: StoredSubscriptionStatus
  startDate: string
  trialEndDate: string | null
  paidEndDate: string | null
  paymentMethod: 'credit_card' | 'bank_transfer' | 'promptpay' | null
  paymentRef: string
  paymentAmount: number
  transactionId: string
  paymentDate?: string
  /** Anti-replay: slip references already applied to this clinic. */
  processedTransactionIds?: string[]
  createdAt?: string
  updatedAt?: string
}

export interface SubscriptionWriteResult {
  ok: boolean
  created?: boolean
  updated?: boolean
  alreadyProcessed?: boolean
  subscription?: StoredSubscription | null
  error?: string
}

export const SUBSCRIPTION_SETTING_KEY = 'subscription'
export const TRIAL_DAYS = 30

const MAX_TRACKED_TRANSACTIONS = 20

function restConfig(): { url: string; key: string } | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return null
  return { url: url.replace(/\/$/, ''), key }
}

function headers(key: string, extra?: Record<string, string>): Record<string, string> {
  return {
    apikey: key,
    Authorization: `Bearer ${key}`,
    'Content-Type': 'application/json',
    ...extra,
  }
}

function addDays(from: Date, days: number): Date {
  const d = new Date(from.getTime())
  d.setDate(d.getDate() + days)
  return d
}

function subscriptionFilter(clinicId: string): string {
  return `clinic_id=eq.${encodeURIComponent(clinicId)}&setting_key=eq.${SUBSCRIPTION_SETTING_KEY}`
}

/** Read the stored subscription for a clinic (null when none / not configured). */
export async function readSubscription(clinicId: string): Promise<StoredSubscription | null> {
  const cfg = restConfig()
  if (!cfg || !clinicId) return null
  try {
    const res = await fetch(
      `${cfg.url}/rest/v1/clinic_settings?${subscriptionFilter(clinicId)}&select=setting_value&limit=1`,
      { headers: headers(cfg.key), cache: 'no-store' }
    )
    if (!res.ok) return null
    const rows = await res.json()
    const value = Array.isArray(rows) ? rows[0]?.setting_value : null
    return value && typeof value === 'object' ? (value as StoredSubscription) : null
  } catch (error) {
    console.error('[subscription-store] read failed:', error)
    return null
  }
}

/**
 * Create the 30-day trial row for a clinic.
 *
 * Idempotent: the insert is sent with `ignore-duplicates` against the
 * (clinic_id, setting_key) unique constraint, so a repeated registration call
 * reports `created: false` instead of overwriting (and re-alerting on) a trial
 * that already exists.
 */
export async function saveTrialSubscription(clinicId: string): Promise<SubscriptionWriteResult> {
  const cfg = restConfig()
  if (!cfg || !clinicId) return { ok: false, error: 'supabase-not-configured' }

  const now = new Date()
  const subscription: StoredSubscription = {
    plan: 'trial',
    status: 'active',
    startDate: now.toISOString(),
    trialEndDate: addDays(now, TRIAL_DAYS).toISOString(),
    paidEndDate: null,
    paymentMethod: null,
    paymentRef: '',
    paymentAmount: 0,
    transactionId: '',
    processedTransactionIds: [],
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
  }

  try {
    const res = await fetch(`${cfg.url}/rest/v1/clinic_settings?on_conflict=clinic_id,setting_key`, {
      method: 'POST',
      headers: headers(cfg.key, { Prefer: 'resolution=ignore-duplicates,return=representation' }),
      body: JSON.stringify({
        clinic_id: clinicId,
        setting_key: SUBSCRIPTION_SETTING_KEY,
        setting_value: subscription,
        created_at: subscription.createdAt,
        updated_at: subscription.updatedAt,
      }),
    })

    if (!res.ok) {
      let detail = ''
      try {
        detail = (await res.text()).slice(0, 300)
      } catch {}
      console.error(`[subscription-store] trial insert failed (HTTP ${res.status})`, detail)
      return { ok: false, error: `insert-failed-${res.status}` }
    }

    const rows = await res.json()
    const inserted = Array.isArray(rows) && rows.length > 0
    if (!inserted) {
      // Row already existed — trial already recorded, do not overwrite / re-alert.
      const existing = await readSubscription(clinicId)
      return { ok: true, created: false, subscription: existing }
    }

    return { ok: true, created: true, subscription }
  } catch (error) {
    console.error('[subscription-store] trial insert error:', error)
    return { ok: false, error: 'insert-error' }
  }
}

export interface PaymentInput {
  clinicId: string
  /** 'monthly' | 'yearly' (or a legacy plan id) — decides how many days are added. */
  plan: string
  amount: number
  paymentRef?: string
  transactionId?: string
  paidAt?: string
}

function planDays(plan: string): number {
  return plan === 'yearly' ? 365 : 30
}

function asPlan(plan: string): StoredSubscriptionPlan {
  if (plan === 'yearly' || plan === 'monthly' || plan === 'clinicq') return plan
  return 'clinicq'
}

/**
 * Record a verified package payment and extend the paid period.
 *
 * Idempotent: if the slip reference (or reference id) was already applied to
 * this clinic, nothing is written and `alreadyProcessed: true` is returned so
 * the caller can skip the purchase notification.
 */
export async function applySubscriptionPayment(input: PaymentInput): Promise<SubscriptionWriteResult> {
  const cfg = restConfig()
  if (!cfg || !input.clinicId) return { ok: false, error: 'supabase-not-configured' }

  const ref = String(input.transactionId || input.paymentRef || '').trim()
  const existing = await readSubscription(input.clinicId)
  const seen = new Set<string>(
    [
      existing?.transactionId || '',
      existing?.paymentRef || '',
      ...(existing?.processedTransactionIds || []),
    ].filter(Boolean)
  )

  if (ref && seen.has(ref)) {
    return { ok: true, updated: false, alreadyProcessed: true, subscription: existing }
  }

  const paidAt = input.paidAt ? new Date(input.paidAt) : new Date()
  const base = paidAt.getTime && !isNaN(paidAt.getTime()) ? paidAt : new Date()
  const paidEndDate = addDays(base, planDays(input.plan))

  const next: StoredSubscription = {
    plan: asPlan(input.plan),
    status: 'active',
    startDate: existing?.startDate || base.toISOString(),
    trialEndDate: existing?.trialEndDate || null,
    paidEndDate: paidEndDate.toISOString(),
    paymentMethod: 'promptpay',
    paymentRef: String(input.paymentRef || ''),
    paymentAmount: Number(input.amount) || 0,
    transactionId: ref,
    paymentDate: base.toISOString(),
    processedTransactionIds: ref
      ? [ref, ...(existing?.processedTransactionIds || [])].slice(0, MAX_TRACKED_TRANSACTIONS)
      : existing?.processedTransactionIds || [],
    createdAt: existing?.createdAt || base.toISOString(),
    updatedAt: new Date().toISOString(),
  }

  const where = subscriptionFilter(input.clinicId)

  try {
    if (existing) {
      const res = await fetch(`${cfg.url}/rest/v1/clinic_settings?${where}`, {
        method: 'PATCH',
        headers: headers(cfg.key, { Prefer: 'return=representation' }),
        body: JSON.stringify({ setting_value: next, updated_at: next.updatedAt }),
      })
      if (!res.ok) {
        let detail = ''
        try {
          detail = (await res.text()).slice(0, 300)
        } catch {}
        console.error(`[subscription-store] subscription update failed (HTTP ${res.status})`, detail)
        return { ok: false, error: `update-failed-${res.status}` }
      }
      return { ok: true, updated: true, subscription: next }
    }

    // No row yet (e.g. a clinic registered before this feature) — create it.
    const res = await fetch(`${cfg.url}/rest/v1/clinic_settings?on_conflict=clinic_id,setting_key`, {
      method: 'POST',
      headers: headers(cfg.key, { Prefer: 'resolution=ignore-duplicates,return=representation' }),
      body: JSON.stringify({
        clinic_id: input.clinicId,
        setting_key: SUBSCRIPTION_SETTING_KEY,
        setting_value: next,
        created_at: next.createdAt,
        updated_at: next.updatedAt,
      }),
    })
    if (!res.ok) {
      let detail = ''
      try {
        detail = (await res.text()).slice(0, 300)
      } catch {}
      console.error(`[subscription-store] subscription insert failed (HTTP ${res.status})`, detail)
      return { ok: false, error: `insert-failed-${res.status}` }
    }
    const rows = await res.json()
    const inserted = Array.isArray(rows) && rows.length > 0
    if (!inserted) {
      // Lost a race with another writer — treat as already processed.
      return { ok: true, updated: false, alreadyProcessed: true, subscription: await readSubscription(input.clinicId) }
    }
    return { ok: true, updated: true, subscription: next }
  } catch (error) {
    console.error('[subscription-store] subscription write error:', error)
    return { ok: false, error: 'write-error' }
  }
}
