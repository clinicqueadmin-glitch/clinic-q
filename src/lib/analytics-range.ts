// ═══ Analytics period → queue_date range ═══
//
// Pure date math, deliberately dependency-free so it can be reasoned about (and
// tested) on its own. Business dates are ICT (Asia/Bangkok) — the same clock
// `queue_date` and getTodayICT() use, never the UTC date.

export type AnalyticsPeriod = 'day' | 'week' | 'month' | 'year'

export interface ICTDateRange {
  /** Inclusive first business date, YYYY-MM-DD */
  start: string
  /** Inclusive last business date, YYYY-MM-DD */
  end: string
}

/** Calendar date (YYYY-MM-DD) of an instant in ICT. */
function ictDateOf(date: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Bangkok',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date)
}

/** YYYY-MM-DD of a Date's UTC components (range boundaries built from parts). */
function isoOf(date: Date): string {
  return date.toISOString().slice(0, 10)
}

/** Shift an ICT business date by whole days without timezone drift. */
function addDays(ymd: string, days: number): string {
  const d = new Date(`${ymd}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return isoOf(d)
}

/**
 * Turn the screen's period + selection into an inclusive queue_date range.
 *
 * - day   → that single business day
 * - week  → Monday..Sunday of the selected week
 * - month → 1st..last day of the selected month (month may overflow past 11,
 *           which Date normalises exactly the way the header label does)
 * - year  → 1 Jan..31 Dec of the selected year
 */
export function analyticsDateRange(
  period: AnalyticsPeriod,
  selection: { date: Date; weekStart: Date; month: number; year: number },
): ICTDateRange {
  if (period === 'day') {
    const day = ictDateOf(selection.date)
    return { start: day, end: day }
  }
  if (period === 'week') {
    const start = ictDateOf(selection.weekStart)
    return { start, end: addDays(start, 6) }
  }
  if (period === 'month') {
    const first = new Date(Date.UTC(selection.year, selection.month, 1))
    const last = new Date(Date.UTC(selection.year, selection.month + 1, 0))
    return { start: isoOf(first), end: isoOf(last) }
  }
  return { start: `${selection.year}-01-01`, end: `${selection.year}-12-31` }
}
