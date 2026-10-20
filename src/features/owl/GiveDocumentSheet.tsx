import { useRef, useState, type ChangeEvent, type ComponentType } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { BottomSheet } from '@/components/BottomSheet'
import { CameraIcon, DocIcon, ImageIcon, TextIcon } from '@/components/icons'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { IMPORT_KINDS, MAX_DOCUMENT_CHARS, type ImportKind } from '@shared/schemas.ts'
import type { DocumentInput } from './actions'
import { useOwlStore } from './store'
import { useOwl } from './useOwl'

type Source = 'camera' | 'image' | 'pdf'

const ACCEPT: Record<Source, string> = {
  camera: 'image/*',
  image: 'image/jpeg,image/png,image/webp,image/heic,image/heif',
  pdf: 'application/pdf',
}

/** "Daj sovi dokument" (SovaAgent mockup 3): source and what is inside, then into the chat. */
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
  const owl = useOwl()
  const [kind, setKind] = useState<ImportKind>(initialKind)
  const [pasting, setPasting] = useState(false)
  const [text, setText] = useState('')
  const inputs = useRef<Record<Source, HTMLInputElement | null>>({
    camera: null,
    image: null,
    pdf: null,
  })

  const send = (input: DocumentInput) => {
    closeSheet()
    if (location.pathname !== '/owl') navigate('/owl')
    void owl.giveDocument(input, kind)
  }

  const onFile = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (file) send({ type: 'file', file })
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
      {pasting ? (
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
              onClick={() => setPasting(false)}
            >
              {t('owl.sheet.back')}
            </Button>
            <Button
              type="button"
              size="pill-sm"
              className="flex-1"
              disabled={!text.trim()}
              onClick={() => send({ type: 'text', text })}
            >
              {t('owl.sheet.textSend')}
            </Button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          {options.map(({ source, label, Icon }) => (
            <button
              key={source}
              type="button"
              onClick={() =>
                source === 'text' ? setPasting(true) : inputs.current[source]?.click()
              }
              className="flex items-center gap-3 rounded-[18px] bg-canvas p-3 text-left"
            >
              <span className="flex size-11 shrink-0 items-center justify-center rounded-[14px] bg-surface text-brand">
                <Icon size={20} />
              </span>
              <span className="text-sm font-semibold">{label}</span>
            </button>
          ))}
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
      <p className="text-xs leading-[1.4] text-ink-muted">{t('owl.sheet.privacy')}</p>
    </>
  )
}
