/**
 * ⚠️ SERVER-ONLY MODULE — never import this file from a client component.
 *
 * Sends operational alerts (new clinic, package purchase) to the Platform
 * Owner via the LINE Messaging API.
 *
 * Credentials come from server env only and are NEVER hardcoded / exposed:
 *   PLATFORM_LINE_CHANNEL_TOKEN  — channel access token of the platform OA
 *   PLATFORM_LINE_ADMIN_USER_ID  — the Platform Owner's LINE userId (Uxxxx…)
 *
 * Every failure path is swallowed and logged: a missing or broken alert
 * channel must never break the registration / payment flow that triggered it.
 */

const LINE_PUSH_URL = 'https://api.line.me/v2/bot/message/push'
const LINE_TEXT_LIMIT = 5000

export interface PlatformAlert {
  title: string
  lines: string[]
}

/** True when both platform-notify env vars are present. */
export function isPlatformNotifyConfigured(): boolean {
  return !!(process.env.PLATFORM_LINE_CHANNEL_TOKEN && process.env.PLATFORM_LINE_ADMIN_USER_ID)
}

function formatAlert(alert: PlatformAlert): string {
  const text = [alert.title, '', ...alert.lines].join('\n')
  return text.length > LINE_TEXT_LIMIT ? `${text.slice(0, LINE_TEXT_LIMIT - 1)}…` : text
}

/**
 * Push one alert to the Platform Owner's LINE.
 * Resolves `true` only when LINE accepted the message.
 * Never throws — callers can safely ignore the result.
 */
export async function notifyPlatformOwner(alert: PlatformAlert): Promise<boolean> {
  const token = process.env.PLATFORM_LINE_CHANNEL_TOKEN
  const to = process.env.PLATFORM_LINE_ADMIN_USER_ID

  if (!token || !to) {
    console.warn(
      '[platform-notify] skipped — PLATFORM_LINE_CHANNEL_TOKEN and/or PLATFORM_LINE_ADMIN_USER_ID is not set'
    )
    return false
  }

  try {
    const res = await fetch(LINE_PUSH_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        to,
        messages: [{ type: 'text', text: formatAlert(alert) }],
      }),
    })

    if (!res.ok) {
      let detail = ''
      try {
        detail = (await res.text()).slice(0, 300)
      } catch {}
      console.error(`[platform-notify] LINE push failed (HTTP ${res.status})`, detail)
      return false
    }

    return true
  } catch (error) {
    console.error('[platform-notify] LINE push error:', error)
    return false
  }
}
