import { useEffect, useRef, useState, type ChangeEvent, type ComponentType } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { BottomSheet } from '@/components/BottomSheet'
import { CameraIcon, DocIcon, ImageIcon, LinkIcon, TextIcon } from '@/components/icons'
import { Button } from '@/components/ui/button'
import { normalizeLink } from '@/lib/documents/link'
import { cn } from '@/lib/utils'
import {
  IMPORT_KINDS,
  MAX_DOCUMENT_CHARS,
  MAX_NOTE_CHARS,
  type ImportKind,
} from '@shared/schemas.ts'
import { AiCallError } from './api'
import type { DocumentInput, GiveResult } from './actions'
import { documentFromLink } from './link'
import { useOwlStore } from './store'
import { useOwl } from './useOwl'

type Source = 'camera' | 'image' | 'pdf'

const ACCEPT: Record<Source, string> = {
  camera: 'image/*',
  image: 'image/jpeg,image/png,image/webp,image/heic,image/heif',
  pdf: 'application/pdf',
}

/**
 * "Daj sovi dokument" (SovaAgent mockup 3): pick a source, then confirm the attachment with an
 * optional note and the kind before anything goes to the owl.
 */
export function GiveDocumentSheet() {
  const { t } = useTranslation()
  const { open, kind, nonce, shared, link } = useOwlStore((s) => s.sheet)
  const closeSheet = useOwlStore((s) => s.closeSheet)
  return (
    <BottomSheet
      open={open}
      onOpenChange={(next) => !next && closeSheet()}
      title={t('owl.sheet.title')}
      subtitle={t('owl.sheet.subtitle')}
    >
      {/* Keyed per opening, so a suggestion's kind and an empty text start fresh. */}
      <SheetBody key={nonce} initialKind={kind} shared={shared ?? null} startOnLink={!!link} />
    </BottomSheet>
  )
}

const hostOf = (url: string) => {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return url
  }
}

function SheetBody({
  initialKind,
  shared,
  startOnLink,
}: {
  initialKind: ImportKind
  /** Shared from another app: start on the confirm step with it. */
  shared: DocumentInput | null
  startOnLink: boolean
}) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const location = useLocation()
  const closeSheet = useOwlStore((s) => s.closeSheet)
  const newConversation = useOwlStore((s) => s.newConversation)
  const owl = useOwl()
  const [kind, setKind] = useState<ImportKind>(initialKind)
  const [step, setStep] = useState<'choose' | 'paste' | 'link' | 'confirm' | 'working' | 'done'>(
    shared ? 'confirm' : startOnLink ? 'link' : 'choose',
  )
  const [text, setText] = useState('')
  const [url, setUrl] = useState('')
  // A link the server downloaded: the document keeps it as its origin ("Sa interneta").
  const [fromLink, setFromLink] = useState<{ url: string; title: string } | null>(null)
  const [fetching, setFetching] = useState(false)
  const [linkError, setLinkError] = useState<string | null>(null)
  const [picked, setPicked] = useState<DocumentInput | null>(shared)
  const [note, setNote] = useState('')
  // Outside the chat the sheet stays open and shows how it ended, so the page is not left.
  const [result, setResult] = useState<GiveResult | null>(null)
  // Thumbnail of a picked image; made when the file is picked, revoked when it goes away.
  const [preview, setPreview] = useState<string | null>(null)
  const previewRef = useRef<string | null>(null)
  const setPreviewUrl = (url: string | null) => {
    if (previewRef.current) URL.revokeObjectURL(previewRef.current)
    previewRef.current = url
    setPreview(url)
  }
  useEffect(() => () => void (previewRef.current && URL.revokeObjectURL(previewRef.current)), [])
  const inputs = useRef<Record<Source, HTMLInputElement | null>>({
    camera: null,
    image: null,
    pdf: null,
  })

  // Nothing goes to the owl until "Daj sovi" on the confirm step.
  const send = async () => {
    if (!picked) return
    const origin = fromLink ? { url: fromLink.url, academicYear: null } : null
    if (location.pathname === '/chat') {
      closeSheet()
      void owl.giveDocument(picked, kind, note.trim() || null, origin)
      return
    }
    // Elsewhere (onboarding, Dokumenti, Nađeno) the reading happens here; the conversation keeps
    // a record of it, and the review opens from the result and comes back to this page.
    newConversation()
    setStep('working')
    setResult(await owl.giveDocument(picked, kind, note.trim() || null, origin))
    setStep('done')
  }

  const linkUrl = normalizeLink(url)

  const fetchLink = async () => {
    if (!linkUrl || fetching) return
    setFetching(true)
    setLinkError(null)
    try {
      const got = await documentFromLink(linkUrl)
      setPreviewUrl(
        got.input.type === 'file' && got.input.file.type.startsWith('image/')
          ? URL.createObjectURL(got.input.file)
          : null,
      )
      setPicked(got.input)
      setFromLink({ url: linkUrl, title: got.title })
      setStep('confirm')
    } catch (err) {
      setLinkError(
        err instanceof AiCallError && err.code !== 'failed'
          ? t(`owl.error.${err.code}`)
          : t('owl.sheet.linkFailed'),
      )
    } finally {
      setFetching(false)
    }
  }

  const onFile = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setPreviewUrl(file.type.startsWith('image/') ? URL.createObjectURL(file) : null)
    setPicked({ type: 'file', file })
    setFromLink(null)
    setStep('confirm')
  }

  const options: {
    source: Source | 'text' | 'link'
    label: string
    Icon: ComponentType<{ size?: number }>
  }[] = [
    { source: 'camera', label: t('owl.sheet.camera'), Icon: CameraIcon },
    { source: 'image', label: t('owl.sheet.image'), Icon: ImageIcon },
    { source: 'pdf', label: t('owl.sheet.pdf'), Icon: DocIcon },
    { source: 'text', label: t('owl.sheet.text'), Icon: TextIcon },
    { source: 'link', label: t('owl.sheet.link'), Icon: LinkIcon },
  ]

  return (
    <>
      {step === 'paste' && (
        <div className="flex flex-col gap-3">
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-semibold">{t('owl.sheet.textLabel')}</span>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              maxLength={MAX_DOCUMENT_CHARS}
              rows={8}
              placeholder={t('owl.sheet.textPlaceholder')}
              className="min-h-40 rounded-input bg-canvas px-4 py-3 text-[15px] leading-[1.45] outline-none placeholder:text-ink-placeholder"
            />
          </label>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="secondary"
              size="pill-sm"
              className="flex-1 bg-brand-soft text-brand"
              onClick={() => setStep('choose')}
            >
              {t('owl.sheet.back')}
            </Button>
            <Button
              type="button"
              size="pill-sm"
              className="flex-1"
              disabled={!text.trim()}
              onClick={() => {
                setPicked({ type: 'text', text })
                setFromLink(null)
                setStep('confirm')
              }}
            >
              {t('owl.sheet.next')}
            </Button>
          </div>
        </div>
      )}

      {step === 'link' && (
        <form
          className="flex flex-col gap-3"
          onSubmit={(e) => {
            e.preventDefault()
            void fetchLink()
          }}
        >
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-semibold">{t('owl.sheet.linkLabel')}</span>
            <input
              type="url"
              inputMode="url"
              autoComplete="url"
              autoCapitalize="off"
              spellCheck={false}
              value={url}
              onChange={(e) => {
                setUrl(e.target.value)
                setLinkError(null)
              }}
              maxLength={2048}
              placeholder="https://"
              className="h-[54px] rounded-input bg-canvas px-4 text-base outline-none placeholder:text-ink-placeholder"
            />
            <span className="px-1 text-xs leading-[1.4] text-ink-muted">
              {t('owl.sheet.linkHint')}
            </span>
          </label>
          {linkError && (
            <span role="alert" className="text-sm text-danger">
              {linkError}
            </span>
          )}
          <div className="flex gap-2">
            <Button
              type="button"
              variant="secondary"
              size="pill-sm"
              className="flex-1 bg-brand-soft text-brand"
              onClick={() => setStep('choose')}
            >
              {t('owl.sheet.back')}
            </Button>
            <Button type="submit" size="pill-sm" className="flex-1" disabled={!linkUrl || fetching}>
              {fetching ? t('owl.sheet.linkFetching') : t('owl.sheet.next')}
            </Button>
          </div>
        </form>
      )}

      {step === 'choose' && (
        <div className="grid grid-cols-2 gap-2">
          {options.map(({ source, label, Icon }) => (
            <button
              key={source}
              type="button"
              onClick={() =>
                source === 'text' || source === 'link'
                  ? setStep(source === 'text' ? 'paste' : 'link')
                  : inputs.current[source]?.click()
              }
              className="flex items-center gap-3 rounded-[18px] bg-canvas p-3 text-left"
            >
              <span className="flex size-11 shrink-0 items-center justify-center rounded-[14px] glass text-brand">
                <Icon size={20} />
              </span>
              <span className="text-sm font-semibold">{label}</span>
            </button>
          ))}
          <span className="col-span-2 px-1 pt-1 text-xs leading-[1.4] text-ink-muted">
            {t('owl.sheet.shareHint')}
          </span>
        </div>
      )}
      {(['camera', 'image', 'pdf'] as const).map((source) => (
        <input
          key={source}
          ref={(el) => {
            inputs.current[source] = el
          }}
          type="file"
          accept={ACCEPT[source]}
          capture={source === 'camera' ? 'environment' : undefined}
          onChange={onFile}
          className="hidden"
        />
      ))}

      {step === 'confirm' && picked && (
        <div className="flex flex-col gap-3">
          <AttachmentCard
            input={picked}
            preview={preview}
            link={fromLink}
            onChange={() => {
              setPreviewUrl(null)
              setPicked(null)
              setStep(fromLink ? 'link' : picked.type === 'text' ? 'paste' : 'choose')
            }}
          />
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-semibold">
              {t('owl.sheet.noteLabel')}{' '}
              <span className="font-normal text-ink-muted">{t('owl.sheet.noteHint')}</span>
            </span>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={MAX_NOTE_CHARS}
              rows={2}
              placeholder={t('owl.sheet.notePlaceholder')}
              className="rounded-input bg-canvas px-4 py-3 text-[15px] leading-[1.45] outline-none placeholder:text-ink-placeholder"
            />
          </label>
        </div>
      )}

      {step === 'working' && (
        <p className="rounded-[18px] bg-canvas p-4 text-sm leading-[1.4] text-ink-secondary">
          {t('owl.sheet.working')}
        </p>
      )}

      {step === 'done' && result && (
        <div className="flex flex-col gap-3">
          <p
            role={result.ok ? undefined : 'alert'}
            className={cn(
              'rounded-[18px] p-4 text-sm leading-[1.4]',
              result.ok ? 'bg-success-soft text-success-ink' : 'bg-canvas text-danger',
            )}
          >
            {result.ok
              ? result.found > 0
                ? t('owl.sheet.found', { count: result.found, title: result.title })
                : t('owl.sheet.foundNone', { title: result.title })
              : t(`owl.error.${result.code}`)}
          </p>
          {result.ok && result.proposalId ? (
            <Button
              type="button"
              size="pill"
              onClick={() => {
                closeSheet()
                navigate(`/chat/import/${result.proposalId}`)
              }}
            >
              {t('owl.sheet.review')}
            </Button>
          ) : !result.ok ? (
            <Button type="button" size="pill" onClick={() => setStep('confirm')}>
              {t('owl.sheet.back')}
            </Button>
          ) : null}
          <Button
            type="button"
            variant="secondary"
            size="pill"
            className="bg-brand-soft text-brand"
            onClick={closeSheet}
          >
            {t('owl.sheet.close')}
          </Button>
        </div>
      )}

      {step !== 'working' && step !== 'done' && (
        <div className="flex flex-col gap-2">
          <span className="text-sm font-semibold">
            {t('owl.sheet.kindLabel')}{' '}
            <span className="font-normal text-ink-muted">{t('owl.sheet.kindHint')}</span>
          </span>
          <div className="flex flex-wrap gap-1.5" role="radiogroup">
            {IMPORT_KINDS.map((k) => (
              <button
                key={k}
                type="button"
                role="radio"
                aria-checked={kind === k}
                onClick={() => setKind(k)}
                className={cn(
                  'h-[38px] rounded-full px-3 text-xs font-semibold',
                  kind === k ? 'bg-ink text-white' : 'bg-white/50 text-ink',
                )}
              >
                {t(`owl.sheet.kind.${k}`)}
              </button>
            ))}
          </div>
        </div>
      )}
      {step === 'confirm' && (
        <Button type="button" size="pill" onClick={() => void send()}>
          {t('owl.sheet.textSend')}
        </Button>
      )}
      <p className="text-xs leading-[1.4] text-ink-muted">{t('owl.sheet.privacy')}</p>
    </>
  )
}

function formatSize(bytes: number) {
  return bytes < 1024 * 1024
    ? `${Math.max(1, Math.round(bytes / 1024))} KB`
    : `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

/** The picked file or pasted text, with "Promijeni" to pick again. */
function AttachmentCard({
  input,
  preview,
  link,
  onChange,
}: {
  input: DocumentInput
  preview: string | null
  /** Downloaded from a link: its title and host instead of the file name. */
  link: { url: string; title: string } | null
  onChange: () => void
}) {
  const { t } = useTranslation()
  const isImage = input.type === 'file' && input.file.type.startsWith('image/')

  const title = link
    ? link.title
    : input.type === 'file'
      ? input.file.name
      : input.text.trim().split('\n')[0]!.slice(0, 60)
  const size =
    input.type === 'file'
      ? formatSize(input.file.size)
      : t('owl.sheet.chars', { count: input.text.trim().length })
  const detail = link ? `${hostOf(link.url)} · ${size}` : size
  const Icon =
    link && input.type === 'text'
      ? LinkIcon
      : input.type === 'text'
        ? TextIcon
        : isImage
          ? ImageIcon
          : DocIcon

  return (
    <div className="flex items-center gap-3 rounded-[18px] bg-canvas p-2.5">
      {preview ? (
        <img
          src={preview}
          alt=""
          className="size-14 shrink-0 rounded-[14px] glass object-cover object-top"
        />
      ) : (
        <span className="flex size-14 shrink-0 items-center justify-center rounded-[14px] glass text-brand">
          <Icon size={22} />
        </span>
      )}
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="truncate text-sm font-semibold">{title}</span>
        <span className="text-xs text-ink-muted">{detail}</span>
      </span>
      <button
        type="button"
        onClick={onChange}
        className="h-11 shrink-0 rounded-full px-3 text-sm font-semibold text-brand"
      >
        {t('owl.sheet.change')}
      </button>
    </div>
  )
}
