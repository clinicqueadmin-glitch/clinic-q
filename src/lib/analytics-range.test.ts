// ═══ Analytics period → queue_date range — regression lock ═══
//
// Why this exists: the KPI cards once read the live "today" queue no matter
// which period was selected, so day/week/month/year showed identical numbers
// while only the date label changed. These tests pin the range math that makes
// each period fetch its own business dates.
//
// Pure logic only — no React, no network, no Supabase.
//
// Run: npm test

import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

// Explicit .ts extension: Node's ESM resolver needs it, and this file is only
// ever run by `node --test` (never bundled by Next).
import { analyticsDateRange, type AnalyticsPeriod } from './analytics-range.ts'

/** ICT calendar date of an instant — the same clock queue_date uses. */
function ictDateOf(date: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Bangkok',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date)
}

/** Today's business date, computed the way the app's getTodayICT() does. */
function todayICT(now: Date = new Date()): string {
  return new Date(now.getTime() + 7 * 60 * 60 * 1000).toISOString().slice(0, 10)
}

/** Monday of the week containing `date` (the screen's selectedWeekStart rule). */
function mondayOf(date: Date): Date {
  const d = new Date(date)
  const day = d.getDay()
  const diff = d.getDate() - day + (day === 0 ? -6 : 1)
  d.setDate(diff)
  d.setHours(0, 0, 0, 0)
  return d
}

/** Whole days between two YYYY-MM-DD dates, inclusive of both ends. */
function daysInclusive(start: string, end: string): number {
  const ms = new Date(`${end}T12:00:00Z`).getTime() - new Date(`${start}T12:00:00Z`).getTime()
  return Math.round(ms / 86_400_000) + 1
}

function select(over: Partial<{ date: Date; weekStart: Date; month: number; year: number }> = {}) {
  return {
    date: new Date('2026-09-14T05:00:00Z'),
    weekStart: mondayOf(new Date('2026-09-14T05:00:00Z')),
    month: 8, // September (0-indexed, as the component stores it)
    year: 2026,
    ...over,
  }
}

function rangeFor(period: AnalyticsPeriod, over: Parameters<typeof select>[0] = {}) {
  return analyticsDateRange(period, select(over))
}

/** The screen treats a period as "live today" only when it resolves to today. */
function isLiveToday(range: { start: string; end: string }, now: Date = new Date()): boolean {
  return range.start === range.end && range.start === todayICT(now)
}

describe('analyticsDateRange — day', () => {
  it('resolves to a single business day (start === end)', () => {
    const r = rangeFor('day', { date: new Date('2026-09-12T04:00:00Z') })
    assert.deepEqual(r, { start: '2026-09-12', end: '2026-09-12' })
  })

  it('uses the ICT date, not the UTC one, just after midnight ICT (00:00 ICT)', () => {
    // 2026-09-13T17:00:00Z === 2026-09-14 00:00 ICT
    const r = rangeFor('day', { date: new Date('2026-09-13T17:00:00Z') })
    assert.equal(r.start, '2026-09-14')
    assert.notEqual(r.start, '2026-09-13', 'must not fall back to the UTC date')
  })

  it('uses the ICT date at 00:30 and at 06:59 ICT (clinic opening hours)', () => {
    assert.equal(rangeFor('day', { date: new Date('2026-09-13T17:30:00Z') }).start, '2026-09-14')
    assert.equal(rangeFor('day', { date: new Date('2026-09-13T23:59:00Z') }).start, '2026-09-14')
  })

  it('uses the ICT date at 23:59 ICT (still the same business day)', () => {
    // 2026-09-14T16:59:00Z === 2026-09-14 23:59 ICT
    const r = rangeFor('day', { date: new Date('2026-09-14T16:59:00Z') })
    assert.equal(r.start, '2026-09-14')
  })

  it('rolls to the next business day after midnight ICT', () => {
    // 2026-09-14T20:00:00Z === 2026-09-15 03:00 ICT
    assert.equal(rangeFor('day', { date: new Date('2026-09-14T20:00:00Z') }).start, '2026-09-15')
  })
})

describe('analyticsDateRange — week', () => {
  it('spans Monday..Sunday of the selected week', () => {
    const r = rangeFor('week', { weekStart: mondayOf(new Date('2026-09-14T05:00:00Z')) })
    assert.deepEqual(r, { start: '2026-09-14', end: '2026-09-20' })
    assert.equal(daysInclusive(r.start, r.end), 7)
  })

  it('starts on Monday even when the selection is a Sunday', () => {
    const sunday = new Date('2026-09-20T05:00:00Z')
    assert.equal(sunday.getDay(), 0, 'fixture must be a Sunday')
    const r = rangeFor('week', { weekStart: mondayOf(sunday) })
    assert.deepEqual(r, { start: '2026-09-14', end: '2026-09-20' })
  })

  it('crosses a month boundary without drifting', () => {
    const r = rangeFor('week', { weekStart: mondayOf(new Date('2026-08-31T05:00:00Z')) })
    assert.deepEqual(r, { start: '2026-08-31', end: '2026-09-06' })
    assert.equal(daysInclusive(r.start, r.end), 7)
  })
})

describe('analyticsDateRange — month', () => {
  it('spans the 1st to the last day of the selected month', () => {
    assert.deepEqual(rangeFor('month', { month: 8, year: 2026 }), { start: '2026-09-01', end: '2026-09-30' })
  })

  it('handles a 28-day February and a 29-day leap February', () => {
    assert.deepEqual(rangeFor('month', { month: 1, year: 2026 }), { start: '2026-02-01', end: '2026-02-28' })
    assert.deepEqual(rangeFor('month', { month: 1, year: 2024 }), { start: '2024-02-01', end: '2024-02-29' })
  })

  it('normalises month overflow exactly like the header label does', () => {
    assert.deepEqual(rangeFor('month', { month: 12, year: 2026 }), { start: '2027-01-01', end: '2027-01-31' })
    assert.deepEqual(rangeFor('month', { month: -1, year: 2026 }), { start: '2025-12-01', end: '2025-12-31' })
  })
})

describe('analyticsDateRange — year', () => {
  it('spans 1 Jan to 31 Dec of the selected year', () => {
    assert.deepEqual(rangeFor('year', { year: 2026 }), { start: '2026-01-01', end: '2026-12-31' })
    assert.equal(daysInclusive('2026-01-01', '2026-12-31'), 365)
  })
})

describe('changing the period or the selected date changes the range', () => {
  it('produces four different ranges for the same selection', () => {
    const day = rangeFor('day')
    const week = rangeFor('week')
    const month = rangeFor('month')
    const year = rangeFor('year')
    const serialised = [day, week, month, year].map(r => `${r.start}..${r.end}`)
    assert.equal(new Set(serialised).size, 4, `ranges must differ, got ${serialised.join(' | ')}`)
  })

  it('moves the range when the day moves back', () => {
    const today = rangeFor('day', { date: new Date('2026-09-14T05:00:00Z') })
    const yesterday = rangeFor('day', { date: new Date('2026-09-13T05:00:00Z') })
    const twoDaysAgo = rangeFor('day', { date: new Date('2026-09-12T05:00:00Z') })
    assert.deepEqual([today.start, yesterday.start, twoDaysAgo.start], ['2026-09-14', '2026-09-13', '2026-09-12'])
  })

  it('moves the range when the week / month / year moves', () => {
    const weekA = rangeFor('week', { weekStart: mondayOf(new Date('2026-09-14T05:00:00Z')) })
    const weekB = rangeFor('week', { weekStart: mondayOf(new Date('2026-09-07T05:00:00Z')) })
    assert.notDeepEqual(weekA, weekB)

    assert.notDeepEqual(rangeFor('month', { month: 8, year: 2026 }), rangeFor('month', { month: 7, year: 2026 }))
    assert.notDeepEqual(rangeFor('year', { year: 2026 }), rangeFor('year', { year: 2025 }))
  })

  it('always returns an inclusive, ordered range', () => {
    const dates = ['2026-01-01T05:00:00Z', '2026-02-28T20:00:00Z', '2026-12-31T23:30:00Z']
    for (const iso of dates) {
      for (const period of ['day', 'week', 'month', 'year'] as AnalyticsPeriod[]) {
        const r = rangeFor(period, { date: new Date(iso), weekStart: mondayOf(new Date(iso)) })
        assert.match(r.start, /^\d{4}-\d{2}-\d{2}$/)
        assert.match(r.end, /^\d{4}-\d{2}-\d{2}$/)
        assert.ok(r.start <= r.end, `${period} @${iso}: start ${r.start} must not exceed end ${r.end}`)
      }
    }
  })
})

describe('past periods never resolve to today (so they cannot reuse today\u2019s live queue)', () => {
  it('a past day is not the live-today period', () => {
    const now = new Date()
    const pastICT = new Date(now.getTime() - 3 * 86_400_000)
    const r = analyticsDateRange('day', select({ date: pastICT }))
    assert.equal(isLiveToday(r, now), false)
    assert.notEqual(`${r.start}..${r.end}`, `${todayICT(now)}..${todayICT(now)}`)
  })

  it('today itself still resolves to the live-today period', () => {
    const now = new Date()
    const r = analyticsDateRange('day', select({ date: now }))
    assert.equal(r.start, todayICT(now))
    assert.equal(isLiveToday(r, now), true)
  })

  it('week / month / year are never treated as the live-today period', () => {
    const now = new Date()
    for (const period of ['week', 'month', 'year'] as AnalyticsPeriod[]) {
      const r = analyticsDateRange(period, select({ date: now, weekStart: mondayOf(now), month: now.getMonth(), year: now.getFullYear() }))
      assert.equal(isLiveToday(r, now), false, `${period} must read the range, not the live queue`)
      assert.equal(ictDateOf(now) >= r.start && ictDateOf(now) <= r.end, true, 'today should still fall inside the period')
    }
  })

  it('an ICT boundary instant on a date without data still maps to the ICT day', () => {
    // 2026-09-11 data exists; asking for the 12th must not return the 11th.
    const r = analyticsDateRange('day', select({ date: new Date('2026-09-12T00:30:00+07:00') }))
    assert.deepEqual(r, { start: '2026-09-12', end: '2026-09-12' })
  })
})
