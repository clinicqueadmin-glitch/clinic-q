// ═══ ICT (Asia/Bangkok, UTC+7) business date ═══
//
// This is the ONE canonical implementation of "today" for clinic business data.
//
// IMPORTANT: this module must NOT carry the 'use client' directive. Route
// handlers (e.g. /api/queues) need to call getTodayICT() on the server, and a
// 'use client' module's exports are compiled into client references there —
// calling one throws "getTodayICT is not a function". Keep it dependency-free
// so both server and client code can import it.
//
// Why ICT and not UTC: `toISOString()` returns the UTC date, which is still
// "yesterday" during 00:00–07:00 ICT. That caused off-by-one mismatches
// against queue_date / daily_rooms.room_date and signed staff out at 07:00,
// which is when clinics open.

/** Today's date in ICT (Asia/Bangkok = UTC+7) as YYYY-MM-DD */
export function getTodayICT(): string {
  return new Date(Date.now() + 7 * 60 * 60 * 1000).toISOString().split('T')[0]
}
