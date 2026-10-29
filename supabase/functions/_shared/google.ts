// Google Calendar API and OAuth for the google-calendar functions (docs/CALENDAR-SYNC.md).
// Tokens never leave the server: errors carry a code, never a token or a response body.

export const GOOGLE_SCOPES = [
  'https://www.googleapis.com/auth/calendar.app.created',
  'https://www.googleapis.com/auth/calendar.calendarlist.readonly',
  'https://www.googleapis.com/auth/calendar.events.owned',
]

const AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth'
const TOKEN_URL = 'https://oauth2.googleapis.com/token'
const REVOKE_URL = 'https://oauth2.googleapis.com/revoke'
const API = 'https://www.googleapis.com/calendar/v3'

export interface GoogleCredentials {
  clientId: string
  clientSecret: string
  /** The function URL Google redirects to (registered on the OAuth client). */
  redirectUri: string
}

/** `invalid_grant` (expired or revoked; in Testing mode after 7 days) = reconnect. */
export class GoogleAuthError extends Error {
  code: 'invalid_grant' | 'token_failed'
  constructor(code: 'invalid_grant' | 'token_failed') {
    super(code)
    this.code = code
  }
}

export class GoogleApiError extends Error {
  status: number
  reason: string
  constructor(status: number, reason: string) {
    super(`google_${status}_${reason}`)
    this.status = status
    this.reason = reason
  }
}

// --- state: the user and the app origin, signed so the callback can trust them ---------------

const encoder = new TextEncoder()

function base64url(bytes: Uint8Array): string {
  let s = ''
  for (const b of bytes) s += String.fromCharCode(b)
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function fromBase64url(text: string): Uint8Array {
  const s = atob(text.replace(/-/g, '+').replace(/_/g, '/'))
  return Uint8Array.from(s, (c) => c.charCodeAt(0))
}

async function hmac(secret: string, data: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  return base64url(new Uint8Array(await crypto.subtle.sign('HMAC', key, encoder.encode(data))))
}

export interface OAuthState {
  userId: string
  origin: string
  /** Expiry, ms since epoch. */
  exp: number
}

export async function signState(state: OAuthState, secret: string): Promise<string> {
  const body = base64url(encoder.encode(JSON.stringify(state)))
  return `${body}.${await hmac(secret, body)}`
}

export async function verifyState(
  text: string,
  secret: string,
  now = Date.now(),
): Promise<OAuthState | null> {
  const [body, sig] = text.split('.')
  if (!body || !sig || (await hmac(secret, body)) !== sig) return null
  try {
    const state = JSON.parse(new TextDecoder().decode(fromBase64url(body))) as OAuthState
    return typeof state.userId === 'string' && typeof state.origin === 'string' && state.exp > now
      ? state
      : null
  } catch {
    return null
  }
}

/** Origins the callback may return to: https, or localhost for development. */
export function allowedOrigin(origin: string): boolean {
  try {
    const u = new URL(origin)
    if (u.origin !== origin) return false
    return u.protocol === 'https:' || u.hostname === 'localhost' || u.hostname === '127.0.0.1'
  } catch {
    return false
  }
}

export function authUrl(creds: GoogleCredentials, state: string): string {
  const params = new URLSearchParams({
    client_id: creds.clientId,
    redirect_uri: creds.redirectUri,
    response_type: 'code',
    scope: GOOGLE_SCOPES.join(' '),
    access_type: 'offline',
    // A refresh token on every connect (reconnect after "Testing" expiry too).
    prompt: 'consent',
    include_granted_scopes: 'true',
    state,
  })
  return `${AUTH_URL}?${params}`
}

// --- tokens -------------------------------------------------------------------------------

export interface TokenResponse {
  accessToken: string
  expiresAt: Date
  refreshToken: string | null
  scope: string
}

async function tokenRequest(body: Record<string, string>): Promise<TokenResponse> {
  let res: Response
  try {
    res = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams(body),
      signal: AbortSignal.timeout(15_000),
    })
  } catch {
    throw new GoogleAuthError('token_failed')
  }
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>
  if (!res.ok) {
    throw new GoogleAuthError(data.error === 'invalid_grant' ? 'invalid_grant' : 'token_failed')
  }
  return {
    accessToken: String(data.access_token),
    expiresAt: new Date(Date.now() + Number(data.expires_in ?? 3600) * 1000),
    refreshToken: typeof data.refresh_token === 'string' ? data.refresh_token : null,
    scope: typeof data.scope === 'string' ? data.scope : '',
  }
}

export function exchangeCode(creds: GoogleCredentials, code: string) {
  return tokenRequest({
    code,
    client_id: creds.clientId,
    client_secret: creds.clientSecret,
    redirect_uri: creds.redirectUri,
    grant_type: 'authorization_code',
  })
}

export function refreshAccess(creds: GoogleCredentials, refreshToken: string) {
  return tokenRequest({
    refresh_token: refreshToken,
    client_id: creds.clientId,
    client_secret: creds.clientSecret,
    grant_type: 'refresh_token',
  })
}

export async function revokeToken(token: string): Promise<void> {
  await fetch(`${REVOKE_URL}?token=${encodeURIComponent(token)}`, {
    method: 'POST',
    signal: AbortSignal.timeout(10_000),
  }).catch(() => undefined)
}

// --- API ----------------------------------------------------------------------------------

export interface GoogleDateTime {
  dateTime?: string
  date?: string
  timeZone?: string
}

export interface GoogleEvent {
  id: string
  etag?: string
  status?: 'confirmed' | 'tentative' | 'cancelled'
  summary?: string
  description?: string
  location?: string
  start?: GoogleDateTime
  end?: GoogleDateTime
  transparency?: 'opaque' | 'transparent'
  recurringEventId?: string
  extendedProperties?: { private?: Record<string, string> }
}

export interface GoogleEventBody {
  summary: string
  description?: string
  start: GoogleDateTime
  end: GoogleDateTime
  colorId?: string
  source?: { title: string; url: string }
  transparency?: 'opaque' | 'transparent'
  reminders?: { useDefault: boolean; overrides?: { method: string; minutes: number }[] }
  extendedProperties?: { private: Record<string, string> }
}

export interface GoogleCalendarEntry {
  id: string
  summary?: string
  summaryOverride?: string
  primary?: boolean
  accessRole?: string
  backgroundColor?: string
  timeZone?: string
}

/** Calendar API calls with a short-lived access token. */
export class GoogleCalendar {
  private accessToken: () => Promise<string>
  constructor(accessToken: () => Promise<string>) {
    this.accessToken = accessToken
  }

  private async request<T>(
    method: string,
    path: string,
    { query, body }: { query?: Record<string, string>; body?: unknown } = {},
  ): Promise<T> {
    const url = `${API}${path}${query ? `?${new URLSearchParams(query)}` : ''}`
    const res = await fetch(url, {
      method,
      headers: {
        authorization: `Bearer ${await this.accessToken()}`,
        ...(body === undefined ? {} : { 'content-type': 'application/json' }),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(20_000),
    })
    if (res.status === 204) return undefined as T
    const data = (await res.json().catch(() => ({}))) as {
      error?: { errors?: { reason?: string }[]; status?: string }
    }
    if (!res.ok) {
      const reason = data.error?.errors?.[0]?.reason ?? data.error?.status ?? 'error'
      throw new GoogleApiError(res.status, reason)
    }
    return data as T
  }

  async listCalendars(): Promise<GoogleCalendarEntry[]> {
    const all: GoogleCalendarEntry[] = []
    let pageToken: string | undefined
    do {
      const page = await this.request<{ items?: GoogleCalendarEntry[]; nextPageToken?: string }>(
        'GET',
        '/users/me/calendarList',
        { query: { maxResults: '250', ...(pageToken ? { pageToken } : {}) } },
      )
      all.push(...(page.items ?? []))
      pageToken = page.nextPageToken
    } while (pageToken)
    return all
  }

  createCalendar(summary: string, timeZone: string) {
    return this.request<{ id: string }>('POST', '/calendars', { body: { summary, timeZone } })
  }

  async calendarExists(id: string): Promise<boolean> {
    try {
      await this.request('GET', `/calendars/${encodeURIComponent(id)}`)
      return true
    } catch (err) {
      if (err instanceof GoogleApiError && (err.status === 404 || err.status === 410)) return false
      throw err
    }
  }

  deleteCalendar(id: string) {
    return this.request<void>('DELETE', `/calendars/${encodeURIComponent(id)}`)
  }

  /** Events in a window, recurring ones expanded to instances. */
  async listEvents(calendarId: string, timeMin: Date, timeMax: Date): Promise<GoogleEvent[]> {
    const all: GoogleEvent[] = []
    let pageToken: string | undefined
    do {
      const page = await this.request<{ items?: GoogleEvent[]; nextPageToken?: string }>(
        'GET',
        `/calendars/${encodeURIComponent(calendarId)}/events`,
        {
          query: {
            timeMin: timeMin.toISOString(),
            timeMax: timeMax.toISOString(),
            singleEvents: 'true',
            maxResults: '2500',
            ...(pageToken ? { pageToken } : {}),
          },
        },
      )
      all.push(...(page.items ?? []))
      pageToken = page.nextPageToken
    } while (pageToken && all.length < 10_000)
    return all
  }

  insertEvent(calendarId: string, body: GoogleEventBody) {
    return this.request<GoogleEvent>(
      'POST',
      `/calendars/${encodeURIComponent(calendarId)}/events`,
      {
        body,
      },
    )
  }

  patchEvent(calendarId: string, eventId: string, body: GoogleEventBody) {
    return this.request<GoogleEvent>(
      'PATCH',
      `/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`,
      { body },
    )
  }

  async deleteEvent(calendarId: string, eventId: string): Promise<void> {
    try {
      await this.request<void>(
        'DELETE',
        `/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`,
      )
    } catch (err) {
      // Already gone (deleted in Google): nothing to do.
      if (err instanceof GoogleApiError && (err.status === 404 || err.status === 410)) return
      throw err
    }
  }

  watchEvents(
    calendarId: string,
    channel: { id: string; token: string; address: string; expiration: number },
  ) {
    return this.request<{ id: string; resourceId: string; expiration?: string }>(
      'POST',
      `/calendars/${encodeURIComponent(calendarId)}/events/watch`,
      { body: { ...channel, type: 'web_hook', expiration: String(channel.expiration) } },
    )
  }

  async stopChannel(id: string, resourceId: string): Promise<void> {
    try {
      await this.request<void>('POST', '/channels/stop', { body: { id, resourceId } })
    } catch {
      // An expired or unknown channel needs no stop.
    }
  }
}
