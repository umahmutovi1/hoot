import { useTranslation } from 'react-i18next'
import { ROUGH_SIZES, type RoughSize } from '@/lib/estimates/rough'
import { cn } from '@/lib/utils'

/** "Koliko je gradiva?": a rough size until real content is added (tap again to clear). */
export function RoughSizeField({
  value,
  onChange,
}: {
  value: RoughSize | null
  onChange: (size: RoughSize | null) => void
}) {
  const { t } = useTranslation()
  return (
    <div className="flex flex-col gap-2">
      <span className="text-sm font-semibold">{t('subjects.rough.title')}</span>
      <div role="radiogroup" aria-label={t('subjects.rough.title')} className="flex gap-1.5">
        {ROUGH_SIZES.map((s) => (
          <button
            key={s}
            type="button"
            role="radio"
            aria-checked={value === s}
            onClick={() => onChange(value === s ? null : s)}
            className={cn(
              'h-11 flex-1 rounded-full text-sm font-semibold',
              value === s ? 'bg-ink text-white' : 'bg-white/50 text-ink',
            )}
          >
            {t(`subjects.rough.${s}`)}
          </button>
        ))}
      </div>
      <span className="px-1 text-xs leading-[1.45] text-ink-muted">
        {value ? t(`subjects.rough.hint.${value}`) : t('subjects.rough.none')}
      </span>
    </div>
  )
}
