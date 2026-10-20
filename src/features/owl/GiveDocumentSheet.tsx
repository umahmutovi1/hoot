import { useEffect, useRef, useState, type ChangeEvent, type ComponentType } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { BottomSheet } from '@/components/BottomSheet'
import { CameraIcon, DocIcon, ImageIcon, TextIcon } from '@/components/icons'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import {
  IMPORT_KINDS,
  MAX_DOCUMENT_CHARS,
  MAX_NOTE_CHARS,
  type ImportKind,
} from '@shared/schemas.ts'
import type { DocumentInput } from './actions'
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
  const { open, kind, nonce } = useOwlStore((s) => s.sheet)
  const closeSheet = useOwlStore((s) => s.closeSheet)
  return (
    <BottomSheet
      open={open}
      onOpenChange={(next) => !next && closeSheet()}
      title={t('owl.sheet.title')}
      subtitle={t('owl.sheet.subtitle')}
    >
      {/* Keyed per opening, so a suggestion's kind and an empty text start fresh. */}
      <SheetBody key={nonce} initialKind={kind} />
    </BottomSheet>
  )
}

function SheetBody({ initialKind }: { initialKind: ImportKind }) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const location = useLocation()
  const closeSheet = useOwlStore((s) => s.closeSheet)
  const newConversation = useOwlStore((s) => s.newConversation)
  const owl = useOwl()
  const [kind, setKind] = useState<ImportKind>(initialKind)
  const [step, setStep] = useState<'choose' | 'paste' | 'confirm'>('choose')
  const [text, setText] = useState('')
  const [picked, setPicked] = useState<DocumentInput | null>(null)
  const [note, setNote] = useState('')
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
  const send = () => {
    if (!picked) return
    closeSheet()
    if (location.pathname !== '/owl') {
      newConversation()
      navigate('/owl')
    }
    void owl.giveDocument(picked, kind, note.trim() || null)
  }

  const onFile = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setPreviewUrl(file.type.startsWith('image/') ? URL.createObjectURL(file) : null)
    setPicked({ type: 'file', file })
    setStep('confirm')
  }

  const options: {
    source: Source | 'text'
    label: string
    Icon: ComponentType<{ size?: number }>
  }[] = [
    { source: 'camera', label: t('owl.sheet.camera'), Icon: CameraIcon },
    { source: 'image', label: t('owl.sheet.image'), Icon: ImageIcon },
    { source: 'pdf', label: t('owl.sheet.pdf'), Icon: DocIcon },
    { source: 'text', label: t('owl.sheet.text'), Icon: TextIcon },
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
                setStep('confirm')
              }}
            >
              {t('owl.sheet.next')}
            </Button>
          </div>
        </div>
      )}

      {step === 'choose' && (
        <div className="grid grid-cols-2 gap-2">
          {options.map(({ source, label, Icon }) => (
            <button
              key={source}
              type="button"
              onClick={() =>
                source === 'text' ? setStep('paste') : inputs.current[source]?.click()
              }
              className="flex items-center gap-3 rounded-[18px] bg-canvas p-3 text-left"
            >
              <span className="flex size-11 shrink-0 items-center justify-center rounded-[14px] bg-surface text-brand">
                <Icon size={20} />
              </span>
              <span className="text-sm font-semibold">{label}</span>
            </button>
          ))}
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
            onChange={() => {
              setPreviewUrl(null)
              setPicked(null)
              setStep(picked.type === 'text' ? 'paste' : 'choose')
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
                kind === k ? 'bg-brand text-white' : 'bg-canvas text-ink',
              )}
            >
              {t(`owl.sheet.kind.${k}`)}
            </button>
          ))}
        </div>
      </div>
      {step === 'confirm' && (
        <Button type="button" size="pill" onClick={send}>
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
  onChange,
}: {
  input: DocumentInput
  preview: string | null
  onChange: () => void
}) {
  const { t } = useTranslation()
  const isImage = input.type === 'file' && input.file.type.startsWith('image/')

  const title =
    input.type === 'file' ? input.file.name : input.text.trim().split('\n')[0]!.slice(0, 60)
  const detail =
    input.type === 'file'
      ? formatSize(input.file.size)
      : t('owl.sheet.chars', { count: input.text.trim().length })
  const Icon = input.type === 'text' ? TextIcon : isImage ? ImageIcon : DocIcon

  return (
    <div className="flex items-center gap-3 rounded-[18px] bg-canvas p-2.5">
      {preview ? (
        <img
          src={preview}
          alt=""
          className="size-14 shrink-0 rounded-[14px] bg-surface object-cover object-top"
        />
      ) : (
        <span className="flex size-14 shrink-0 items-center justify-center rounded-[14px] bg-surface text-brand">
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
