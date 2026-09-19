// ═══ getQueueWaitInfo — same-branch filtering regression lock ═══
//
// Why this exists: getQueueWaitInfo once counted ALL serving/waiting
// patients across every branch, so a ฝังเข็ม patient in Room 2 inflated
// the wait estimate shown to a กายภาพบำบัด patient in Room 1.
//
// Pure logic only — no React, no network, no Supabase.
//
// Run: npx node --test src/lib/queue-wait-info.test.ts

import { describe, it, beforeEach } from 'node:test'
import assert from 'node:assert/strict'

import {
  getQueueWaitInfo,
  getDefaultBranchData,
  type ClinicBranchData,
} from './branch-data.ts'

// ─── Fixtures ───

/** Two-branch clinic: กายภาพบำบัดฟื้นฟู (physio) and ฝังเข็มบำบัดอาการ (acupuncture) */
function makeData(): ClinicBranchData {
  return {
    branches: [
      {
        id: 'physio',
        name: 'กายภาพบำบัดฟื้นฟู',
        category: 'rehab',
        active: true,
        procedures: [
          { id: 'pt-manual', name: 'กายภาพบำบัดมือ', estimatedDuration: 45, active: true },
          { id: 'pt-exercise', name: 'กายภาพบำบัด excer', estimatedDuration: 30, active: true },
        ],
      },
      {
        id: 'acu',
        name: 'ฝังเข็มบำบัดอาการ',
        category: 'acupuncture',
        active: true,
        procedures: [
          { id: 'acu-therapy', name: 'ฝังเข็มบำบัดอาการ', estimatedDuration: 60, active: true },
        ],
      },
    ],
    practitioners: [],
    rooms: [],
  }
}

type QueueItem = {
  id: string
  procedureId: string
  status: string
  arrived: boolean
  assignedRoom: number
  servingAt?: number
}

function q(overrides: Partial<QueueItem> & { id: string; procedureId: string }): QueueItem {
  return {
    status: 'waiting',
    arrived: true,
    assignedRoom: 0,
    ...overrides,
  }
}

// ─── Tests ───

describe('getQueueWaitInfo — same-branch filtering', () => {
  let data: ClinicBranchData

  beforeEach(() => {
    data = makeData()
  })

  it('counts only same-branch serving patients in wait estimate', () => {
    const now = Date.now()
    const queue: QueueItem[] = [
      // Target: physio patient, arrived, waiting
      q({ id: 'P1', procedureId: 'pt-manual', status: 'waiting', arrived: true }),
      // Serving in physio (same branch) — 10 min in → 35 min remaining
      q({ id: 'S1', procedureId: 'pt-manual', status: 'serving', arrived: true, servingAt: now - 10 * 60_000 }),
      // Serving in acupunct (different branch) — should NOT count
      q({ id: 'S2', procedureId: 'acu-therapy', status: 'serving', arrived: true, servingAt: now - 5 * 60_000 }),
    ]

    const result = getQueueWaitInfo(data, queue, 'P1')

    // Position 1 (only same-branch waiting counted)
    assert.equal(result.position, 1)
    assert.equal(result.aheadCount, 0)
    // Wait = remaining time from S1 only (35 min), NOT S2 (55 min)
    assert.equal(result.estimatedWaitMinutes, 35)
  })

  it('counts only same-branch waiting patients ahead', () => {
    const queue: QueueItem[] = [
      // Another physio patient waiting ahead of target
      q({ id: 'P2', procedureId: 'pt-exercise', status: 'waiting', arrived: true }),
      // Target: physio patient (comes after P2)
      q({ id: 'P1', procedureId: 'pt-manual', status: 'waiting', arrived: true }),
      // Acupunct patient waiting — different branch, should not count
      q({ id: 'P3', procedureId: 'acu-therapy', status: 'waiting', arrived: true }),
    ]

    const result = getQueueWaitInfo(data, queue, 'P1')

    // Position 2 (only same-branch patients ahead)
    assert.equal(result.position, 2)
    assert.equal(result.aheadCount, 1)
    // Wait = duration of P2 only (30 min)
    assert.equal(result.estimatedWaitMinutes, 30)
    assert.equal(result.aheadDetails.length, 1)
    assert.equal(result.aheadDetails[0].id, 'P2')
  })

  it('returns 0 wait when no same-branch patients are ahead or serving', () => {
    const now = Date.now()
    const queue: QueueItem[] = [
      // Target: physio patient
      q({ id: 'P1', procedureId: 'pt-manual', status: 'waiting', arrived: true }),
      // Acupunct serving — different branch
      q({ id: 'S1', procedureId: 'acu-therapy', status: 'serving', arrived: true, servingAt: now - 10 * 60_000 }),
      // Acupunct waiting — different branch
      q({ id: 'P2', procedureId: 'acu-therapy', status: 'waiting', arrived: true }),
    ]

    const result = getQueueWaitInfo(data, queue, 'P1')

    assert.equal(result.position, 1)
    assert.equal(result.aheadCount, 0)
    assert.equal(result.estimatedWaitMinutes, 0)
  })

  it('handles mixed multi-branch queue correctly', () => {
    const now = Date.now()
    const queue: QueueItem[] = [
      // Physio ahead: P2 (30 min), P3 (45 min)
      q({ id: 'P2', procedureId: 'pt-exercise', status: 'waiting', arrived: true }),
      q({ id: 'P3', procedureId: 'pt-manual', status: 'waiting', arrived: true }),
      // Acupunct waiting — should NOT count
      q({ id: 'P4', procedureId: 'acu-therapy', status: 'waiting', arrived: true }),
      // Target: physio patient (P1)
      q({ id: 'P1', procedureId: 'pt-manual', status: 'waiting', arrived: true }),
      // Physio serving: 15 min elapsed of 30 min → 15 min remaining
      q({ id: 'S1', procedureId: 'pt-exercise', status: 'serving', arrived: true, servingAt: now - 15 * 60_000 }),
      // Acupunct serving — should NOT count
      q({ id: 'S2', procedureId: 'acu-therapy', status: 'serving', arrived: true, servingAt: now - 10 * 60_000 }),
    ]

    const result = getQueueWaitInfo(data, queue, 'P1')

    assert.equal(result.position, 3) // 2 physio ahead + target at position 3
    assert.equal(result.aheadCount, 2)
    // Wait = P2 (30) + P3 (45) + S1 remaining (15) = 90 min
    assert.equal(result.estimatedWaitMinutes, 90)
    // P4 (acupunct) should NOT be in aheadDetails
    assert.equal(result.aheadDetails.every(d => d.id !== 'P4'), true)
  })

  it('returns position 0 when target is not in same-branch waiting list', () => {
    const queue: QueueItem[] = [
      // Target is serving, not waiting
      q({ id: 'P1', procedureId: 'pt-manual', status: 'serving', arrived: true, servingAt: Date.now() }),
      // Other physio waiting
      q({ id: 'P2', procedureId: 'pt-exercise', status: 'waiting', arrived: true }),
    ]

    const result = getQueueWaitInfo(data, queue, 'P1')

    assert.equal(result.position, 0)
    assert.equal(result.aheadCount, 0)
    assert.equal(result.estimatedWaitMinutes, 0)
  })

  it('excludes non-arrived patients', () => {
    const queue: QueueItem[] = [
      q({ id: 'P1', procedureId: 'pt-manual', status: 'waiting', arrived: true }),
      // Not arrived yet — should not count
      q({ id: 'P2', procedureId: 'pt-exercise', status: 'waiting', arrived: false }),
    ]

    const result = getQueueWaitInfo(data, queue, 'P1')

    assert.equal(result.position, 1)
    assert.equal(result.aheadCount, 0)
    assert.equal(result.estimatedWaitMinutes, 0)
  })
})
