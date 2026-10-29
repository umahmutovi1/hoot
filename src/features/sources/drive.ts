import { env } from '@/lib/env'

/**
 * Google Drive (PRD "Materijali", Stage 10c): Google Picker with the `drive.file` scope, so the
 * app sees only the files the user picks. The token is short-lived and never stored; picked PDFs
 * are downloaded into the browser only to be read, like a PDF from the device.
 */

const SCOPE = 'https://www.googleapis.com/auth/drive.file'

export interface DriveFile {
  id: string
  name: string
  url: string
}

/**
 * Off until the scope question is settled (`drive.file` cannot read a picked folder's files;
 * `drive.readonly` needs Google's security assessment): "Google Drive" is not offered.
 */
const DRIVE_ENABLED = false

export const driveAvailable = () =>
  DRIVE_ENABLED &&
  Boolean(env.VITE_GOOGLE_CLIENT_ID && env.VITE_GOOGLE_PICKER_API_KEY && env.VITE_GOOGLE_APP_ID)

type Google = {
  accounts: {
    oauth2: {
      initTokenClient: (config: {
        client_id: string
        scope: string
        callback: (res: { access_token?: string; error?: string }) => void
        error_callback?: (err: { type: string }) => void
      }) => { requestAccessToken: (opts?: { prompt?: string }) => void }
    }
  }
  picker: {
    DocsView: new (viewId?: string) => {
      setMimeTypes: (m: string) => unknown
      setIncludeFolders: (b: boolean) => unknown
      setSelectFolderEnabled: (b: boolean) => unknown
    }
    ViewId: { DOCS: string }
    Feature: { MULTISELECT_ENABLED: string }
    Action: { PICKED: string; CANCEL: string }
    PickerBuilder: new () => PickerBuilder
  }
}
type PickerBuilder = {
  addView: (v: unknown) => PickerBuilder
  enableFeature: (f: string) => PickerBuilder
  setOAuthToken: (t: string) => PickerBuilder
  setDeveloperKey: (k: string) => PickerBuilder
  setAppId: (id: string) => PickerBuilder
  setLocale: (l: string) => PickerBuilder
  setCallback: (cb: (data: PickerData) => void) => PickerBuilder
  build: () => { setVisible: (v: boolean) => void }
}
type PickerData = {
  action: string
  docs?: { id: string; name: string; url: string; mimeType: string }[]
}
type Gapi = { load: (name: string, cb: () => void) => void }

const win = window as unknown as { google?: Google; gapi?: Gapi }

/** Which Drive step failed, so the message says what to try (sign-in or the file itself). */
export class DriveError extends Error {
  readonly code: 'auth' | 'download'
  constructor(code: 'auth' | 'download', message?: string) {
    super(message ?? code)
    this.code = code
  }
}

const scripts = new Map<string, Promise<void>>()
function loadScript(src: string): Promise<void> {
  let p = scripts.get(src)
  if (!p) {
    p = new Promise<void>((resolve, reject) => {
      const el = document.createElement('script')
      el.src = src
      el.async = true
      el.onload = () => resolve()
      el.onerror = () => reject(new Error('script'))
      document.head.appendChild(el)
    })
    scripts.set(src, p)
  }
  return p
}

async function accessToken(): Promise<string> {
  await loadScript('https://accounts.google.com/gsi/client')
  return new Promise((resolve, reject) => {
    const client = win.google!.accounts.oauth2.initTokenClient({
      client_id: env.VITE_GOOGLE_CLIENT_ID!,
      scope: SCOPE,
      callback: (res) =>
        res.access_token ? resolve(res.access_token) : reject(new DriveError('auth', res.error)),
      error_callback: (err) => reject(new DriveError('auth', err.type)),
    })
    client.requestAccessToken({ prompt: '' })
  })
}

/**
 * Opens the Picker for PDFs (one or several, folders can be browsed). Resolves with the picked
 * files and the token to download them, or null when cancelled.
 */
export async function pickDriveFiles(
  locale: string,
): Promise<{ files: DriveFile[]; token: string } | null> {
  const token = await accessToken()
  try {
    await loadScript('https://apis.google.com/js/api.js')
    await new Promise<void>((resolve) => win.gapi!.load('picker', () => resolve()))
  } catch {
    throw new DriveError('auth', 'picker')
  }
  const picker = win.google!.picker
  return new Promise((resolve) => {
    const view = new picker.DocsView(picker.ViewId.DOCS)
    view.setMimeTypes('application/pdf')
    view.setIncludeFolders(true)
    view.setSelectFolderEnabled(false)
    new picker.PickerBuilder()
      .addView(view)
      .enableFeature(picker.Feature.MULTISELECT_ENABLED)
      .setOAuthToken(token)
      .setDeveloperKey(env.VITE_GOOGLE_PICKER_API_KEY!)
      .setAppId(env.VITE_GOOGLE_APP_ID!)
      .setLocale(locale)
      .setCallback((data) => {
        if (data.action === picker.Action.PICKED)
          resolve({
            files: (data.docs ?? [])
              .filter((d) => d.mimeType === 'application/pdf')
              .map((d) => ({ id: d.id, name: d.name, url: d.url })),
            token,
          })
        else if (data.action === picker.Action.CANCEL) resolve(null)
      })
      .build()
      .setVisible(true)
  })
}

/**
 * Downloads a picked file into the browser (only to read it; nothing is uploaded or kept).
 * `supportsAllDrives`: a file on a shared drive (a faculty's or a group's) is otherwise a 404.
 */
export async function downloadDriveFile(id: string, token: string): Promise<ArrayBuffer> {
  let res: Response
  try {
    res = await fetch(
      `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(id)}?alt=media&supportsAllDrives=true`,
      { headers: { Authorization: `Bearer ${token}` } },
    )
  } catch (err) {
    throw new DriveError('download', String(err))
  }
  if (!res.ok) throw new DriveError('download', `HTTP ${res.status}: ${await res.text()}`)
  return res.arrayBuffer()
}
