import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { SparkleIcon } from '@/components/icons'
import { useDayBoundary } from '@/features/settings/profile'
import { localDay } from '@/lib/day'
import { factOfDay } from './facts'

/** "Znaš li?": one researched study fact per day, with its source as a small link. */
export function FactCard() {
  const { t } = useTranslation()
  const boundary = useDayBoundary()
  const [now] = useState(() => new Date())
  // The local day (04:00 boundary), so the fact does not change at midnight.
  const fact = factOfDay(localDay(now, boundary))
  return (
    <aside className="flex flex-col gap-2 rounded-card glass p-4">
      <div className="flex items-center gap-2">
        <span className="flex size-7 items-center justify-center rounded-full bg-brand-soft text-brand">
          <SparkleIcon size={15} />
        </span>
        <span className="text-xs font-semibold tracking-wide text-brand uppercase">
          {t('today.fact.title')}
        </span>
      </div>
      <p className="text-sm leading-[1.45]">{t(`facts.${fact.id}`)}</p>
      <a
        href={fact.url}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={t('today.fact.sourceLabel', { source: fact.source })}
        className="self-start py-1 text-[11px] text-ink-subtle underline decoration-line underline-offset-2"
      >
        {t('today.fact.source', { source: fact.source })} ↗
      </a>
    </aside>
  )
}
