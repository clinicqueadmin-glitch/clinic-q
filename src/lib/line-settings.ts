/**
 * Shape of `clinic_settings(setting_key='line_settings')`.
 *
 * Shared by the browser (clinic settings screen, read-only status) and the
 * server routes (Platform Owner console + the notification sender), so the row
 * is read and written the same way on both sides. Deliberately free of
 * browser-only APIs so a route handler can import it.
 *
 * The Platform Owner owns these values; a clinic only ever reads them.
 */

/** Queue events that can trigger a LINE message to the patient. */
export type LineNotifyEvent = 'called' | 'serving' | 'completed' | 'cancelled'

export interface LineNotificationOptions {
  /** Message when the patient's queue is called. */
  onCalled: boolean
  /** Message when the service starts. */
  onServing: boolean
  /** Message when the queue is completed. */
  onCompleted: boolean
  /** Message when the queue is cancelled. */
  onCancelled: boolean
  /**
   * Notify the patient when this many queues are still ahead of them
   * (1 = แจ้งเมื่อเหลือคิวก่อนหน้า 1 คิว). 0 disables the feature.
   */
  queuesAhead: number
}

export interface LineSettings {
  channelSecret: string
  channelToken: string
  /** Master switch for this clinic's LINE notifications. */
  enabled: boolean
  notifications: LineNotificationOptions
}

/**
 * Defaults applied when a clinic has no line_settings row yet.
 *
 * `onCalled` keeps the behaviour the queue screens already assumed; the rest are
 * opt-in so turning LINE on for a clinic never starts sending messages the
 * clinic did not ask for. `queuesAhead: 0` keeps the "ยังไม่ถึงคิวก่อนหน้า"
 * feature off until the Platform Owner picks a number.
 */
export const DEFAULT_LINE_NOTIFICATIONS: LineNotificationOptions = {
  onCalled: true,
  onServing: false,
  onCompleted: false,
  onCancelled: false,
  queuesAhead: 0,
}

export const DEFAULT_LINE_SETTINGS: LineSettings = {
  channelSecret: '',
  channelToken: '',
  enabled: false,
  notifications: { ...DEFAULT_LINE_NOTIFICATIONS },
}

/** Coerce a stored JSON value into a complete, valid LineSettings object. */
export function normalizeLineSettings(value: unknown): LineSettings {
  const raw = (value && typeof value === 'object' && !Array.isArray(value))
    ? (value as Record<string, unknown>)
    : {}
  const rawNotifications = (raw.notifications && typeof raw.notifications === 'object' && !Array.isArray(raw.notifications))
    ? (raw.notifications as Record<string, unknown>)
    : {}

  const bool = (v: unknown, fallback: boolean) => (typeof v === 'boolean' ? v : fallback)
  const ahead = Number(rawNotifications.queuesAhead)
  const queuesAhead = Number.isFinite(ahead) && ahead > 0 ? Math.min(Math.floor(ahead), 10) : 0

  return {
    channelSecret: typeof raw.channelSecret === 'string' ? raw.channelSecret : '',
    channelToken: typeof raw.channelToken === 'string' ? raw.channelToken : '',
    enabled: bool(raw.enabled, false),
    notifications: {
      onCalled: bool(rawNotifications.onCalled, DEFAULT_LINE_NOTIFICATIONS.onCalled),
      onServing: bool(rawNotifications.onServing, DEFAULT_LINE_NOTIFICATIONS.onServing),
      onCompleted: bool(rawNotifications.onCompleted, DEFAULT_LINE_NOTIFICATIONS.onCompleted),
      onCancelled: bool(rawNotifications.onCancelled, DEFAULT_LINE_NOTIFICATIONS.onCancelled),
      queuesAhead,
    },
  }
}

/** The per-event option that gates a given queue event. */
export function isEventEnabled(settings: LineSettings, event: LineNotifyEvent): boolean {
  switch (event) {
    case 'called': return settings.notifications.onCalled
    case 'serving': return settings.notifications.onServing
    case 'completed': return settings.notifications.onCompleted
    case 'cancelled': return settings.notifications.onCancelled
    default: return false
  }
}

/** A clinic can only actually send when it is enabled and has a token. */
export function canSendLineMessages(settings: LineSettings): boolean {
  return settings.enabled && !!settings.channelToken
}
