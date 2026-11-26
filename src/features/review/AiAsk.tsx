import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { MAX_PAGE_PHOTOS, MAX_PASTED_CHARS } from '@shared/schemas.ts'
import { CameraIcon, ImageIcon, SparkleIcon, TextIcon } from '@/components/icons'
import type { AiSource } from './gate'

/**
 * Before AI questions exist for a source: what they are made from and one button (a photo picker
 * for a page). Nothing is sent until the user asks; the questions then replace this panel.
 */
export function AiAsk({
  source,
  count,
  busy,
  error,
  onAsk,
  onPhotos,
  onText,
  onPlain,
}: {
  source: AiSource
  count: number
  busy: boolean
  error: string | null
  onAsk: () => void
  onPhotos: (files: File[]) => void
  /** Page source: text pasted from the book instead of a photo. */
  onText?: (text: string) => void
  /** Notes only: rate yourself against the notes without AI. */
  onPlain?: () => void
}) {
  const { t } = useTranslation()
  const camera = useRef<HTMLInputElement>(null)
  const gallery = useRef<HTMLInputElement>(null)
  const [pasting, setPasting] = useState(false)
  const [text, setText] = useState('')
  const pick = (list: FileList | null) => {
    const files = Array.from(list ?? []).slice(0, MAX_PAGE_PHOTOS)
    if (files.length > 0) onPhotos(files)
  }
  return (
    <div className="flex flex-col gap-2.5">
      <span className="text-xs font-semibold text-brand-muted">
        {t(`recall.ai.${source}.label`)}
      </span>
      <span className="text-sm leading-[1.4] text-ink-secondary">
        {t(`recall.ai.${source}.hint`, { count })}
      </span>
      {source === 'page_photo' ? (
        <div className="grid grid-cols-2 gap-2">
          {[
            { ref: camera, Icon: CameraIcon, label: t('recall.ai.camera') },
            { ref: gallery, Icon: ImageIcon, label: t('recall.ai.gallery') },
          ].map(({ ref, Icon, label }) => (
            <button
              key={label}
              type="button"
              disabled={busy}
              onClick={() => ref.current?.click()}
              className="flex h-12 items-center justify-center gap-2 rounded-full border-2 border-brand surface text-sm font-semibold text-brand disabled:opacity-50"
            >
              <Icon size={18} />
              {label}
            </button>
          ))}
          <input
            ref={camera}
            type="file"
            accept="image/*"
            capture="environment"
            hidden
            onChange={(e) => {
              pick(e.target.files)
              e.target.value = ''
            }}
          />
          {onText && !pasting && (
            <button
              type="button"
              disabled={busy}
              onClick={() => setPasting(true)}
              className="col-span-2 flex h-11 items-center justify-center gap-2 rounded-full text-sm font-semibold text-brand disabled:opacity-50"
            >
              <TextIcon size={18} />
              {t('recall.ai.paste')}
            </button>
          )}
          {onText && pasting && (
            <div className="col-span-2 flex flex-col gap-2">
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                maxLength={MAX_PASTED_CHARS}
                rows={6}
                placeholder={t('recall.ai.pastePlaceholder')}
                aria-label={t('recall.ai.paste')}
                className="rounded-[18px] bg-white/70 p-3.5 text-[15px] leading-snug outline-none focus-visible:ring-2 focus-visible:ring-brand-accent"
              />
              <button
                type="button"
                disabled={busy || !text.trim()}
                onClick={() => onText(text.trim())}
                className="flex h-12 items-center justify-center gap-2 rounded-full border-2 border-brand surface text-[15px] font-semibold text-brand disabled:opacity-50"
              >
                <SparkleIcon size={18} />
                {busy ? t('recall.ai.making') : t('recall.ai.make', { count })}
              </button>
            </div>
          )}
          <input
            ref={gallery}
            type="file"
            accept="image/*"
            multiple
            hidden
            onChange={(e) => {
              pick(e.target.files)
              e.target.value = ''
            }}
          />
        </div>
      ) : (
        <button
          type="button"
          disabled={busy}
          onClick={onAsk}
          className="flex h-12 items-center justify-center gap-2 rounded-full border-2 border-brand surface text-[15px] font-semibold text-brand disabled:opacity-50"
        >
          <SparkleIcon size={18} />
          {busy ? t('recall.ai.making') : t('recall.ai.make', { count })}
        </button>
      )}
      {busy && source === 'page_photo' && (
        <span className="text-sm text-ink-muted">{t('recall.ai.making')}</span>
      )}
      {error && (
        <span role="alert" className="text-sm text-danger">
          {t(`owl.error.${error as 'failed'}`)}
        </span>
      )}
      {onPlain && (
        <button
          type="button"
          onClick={onPlain}
          className="h-11 self-start text-sm font-medium text-brand"
        >
          {t('recall.ai.plain')}
        </button>
      )}
    </div>
  )
}
