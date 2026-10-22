import { useTranslation } from 'react-i18next'
import type { Recall } from '@/lib/srs'
import { cn } from '@/lib/utils'

/** "Koliko si se sjetila?" 0–2, after the answer is shown (feedback first, then the rating). */
export function RateButtons({
  value,
  onPick,
  disabled,
  labels = 'recall',
}: {
  value: Recall | null
  onPick: (r: Recall) => void
  disabled?: boolean
  /** Gate ("Ne") or check ("Ne sjećam se") wording. */
  labels?: 'recall' | 'review'
}) {
  const { t } = useTranslation()
  return (
    <div className="flex flex-col gap-2.5">
      <span className="text-[15px] font-semibold">{t('recall.howMuch')}</span>
      <div role="group" aria-label={t('recall.howMuch')} className="flex gap-2">
        {([0, 1, 2] as const).map((r) => (
          <button
            key={r}
            type="button"
            disabled={disabled}
            aria-pressed={value === r}
            onClick={() => onPick(r)}
            className={cn(
              'h-[52px] flex-1 rounded-[18px] px-1 text-sm font-semibold disabled:opacity-50',
              value === r ? 'bg-brand text-white' : 'bg-white/55 text-ink',
            )}
          >
            {labels === 'recall' ? t(`recall.recall.${r}`) : t(`review.rate.${r}`)}
          </button>
        ))}
      </div>
      {disabled && <span className="text-xs text-ink-muted">{t('recall.revealFirst')}</span>}
    </div>
  )
}
