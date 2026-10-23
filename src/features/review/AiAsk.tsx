import { useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { MAX_PAGE_PHOTOS } from '@shared/schemas.ts'
import { CameraIcon, ImageIcon, SparkleIcon } from '@/components/icons'
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
  onPlain,
}: {
  source: AiSource
  count: number
  busy: boolean
  error: string | null
  onAsk: () => void
  onPhotos: (files: File[]) => void
  /** Notes only: rate yourself against the notes without AI. */
  onPlain?: () => void
}) {
  const { t } = useTranslation()
  const camera = useRef<HTMLInputElement>(null)
  const gallery = useRef<HTMLInputElement>(null)
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
              className="flex h-12 items-center justify-center gap-2 rounded-full border-2 border-brand glass text-sm font-semibold text-brand disabled:opacity-50"
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
          className="flex h-12 items-center justify-center gap-2 rounded-full border-2 border-brand glass text-[15px] font-semibold text-brand disabled:opacity-50"
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
