import { useTranslation } from 'react-i18next'
import { format } from 'date-fns'
import { LazyMarkdown } from '@/components/LazyMarkdown'
import { ClockIcon, SparkleIcon } from '@/components/icons'
import { AiCallError, useAiAvailability } from '@/features/owl/api'
import { useLocale } from '@/features/settings/useLocale'
import { dateFnsLocales } from '@/lib/locale'
import { formatDuration } from './format'
import { useMakeSummary, type UnitSummary } from './summaryApi'
import type { SummaryScope } from '@shared/schemas.ts'

/** "str. 114" chip of a point that cites its page. */
export function PageChip({ page }: { page: number | null }) {
  const { t } = useTranslation()
  if (page === null) return null
  return (
    <span className="flex h-6 shrink-0 items-center rounded-lg bg-subject-blue-soft px-2 text-xs font-bold text-brand-strong tabular-nums">
      {t('summary.page', { page })}
    </span>
  )
}

/**
 * A unit's summary (board "Jedinica · sažetak"): the first idea as the headline, the rest as
 * points with their page, the formula to know and when it was made. Shared by the Sažetak screen
 * and a session that studies through the summary.
 */
export function SummaryView({
  summary,
  minutes,
  readingMinutes,
}: {
  summary: UnitSummary
  /** Its study time and the reading estimate ("2 min umjesto 55"); hidden when unknown. */
  minutes?: number
  readingMinutes?: number
}) {
  const { t } = useTranslation()
  const { locale } = useLocale()
  const [head, ...rest] = summary.content.points
  const formula = summary.content.formula
  return (
    <div className="flex flex-col gap-3">
      <section className="flex flex-col gap-3.5 rounded-card bg-subject-lavender-soft p-5 text-subject-lavender-ink">
        <div className="flex items-center justify-between gap-2">
          <span className="flex h-6 items-center gap-1.5 rounded-lg bg-raised/60 px-2 text-xs font-bold">
            <SparkleIcon size={14} />
            {t('summary.aiTag')}
          </span>
          {minutes !== undefined && readingMinutes !== undefined && minutes < readingMinutes && (
            <span className="text-[13px] font-bold tabular-nums">
              {t('summary.instead.short', {
                time: formatDuration(t, minutes),
                reading: formatDuration(t, readingMinutes),
              })}
            </span>
          )}
        </div>
        {head && (
          <div className="flex items-start gap-2.5">
            <div className="min-w-0 flex-1 [&_.markdown]:font-display [&_.markdown]:text-[22px] [&_.markdown]:leading-[1.2] [&_.markdown]:font-bold">
              <LazyMarkdown>{head.text}</LazyMarkdown>
            </div>
            <PageChip page={head.page} />
          </div>
        )}
        {rest.length > 0 && (
          <ul className="flex flex-col gap-3 text-ink">
            {rest.map((p, i) => (
              <li key={i} className="flex items-start gap-2.5">
                <span aria-hidden="true" className="mt-2 size-2.5 shrink-0 rounded-full bg-brand" />
                <div className="min-w-0 flex-1 [&_.markdown]:text-base [&_.markdown]:leading-[23px]">
                  <LazyMarkdown>{p.text}</LazyMarkdown>
                </div>
                <PageChip page={p.page} />
              </li>
            ))}
          </ul>
        )}
      </section>
      {formula && (
        <section className="surface flex flex-col gap-1.5 rounded-card px-[18px] py-4">
          <span className="text-[13px] font-bold text-ink-secondary">{t('summary.formula')}</span>
          <div className="overflow-x-auto [&_.markdown]:text-lg">
            <LazyMarkdown>{`$$${formula.tex}$$`}</LazyMarkdown>
          </div>
          <span className="self-start">
            <PageChip page={formula.page} />
          </span>
        </section>
      )}
      <div className="flex items-center gap-2.5 px-1 text-[13px] leading-[1.4] text-ink-secondary">
        <ClockIcon size={16} className="shrink-0" />
        <span>
          {t('summary.made', {
            when: format(new Date(summary.createdAt), 'd. MMM, HH:mm', {
              locale: dateFnsLocales[locale],
            }),
          })}
        </span>
      </div>
    </div>
  )
}

/**
 * No summary yet: "Napravi sažetak" (one AI call). Without the paid model it says so instead of
 * offering a button that would fail.
 */
export function MakeSummary({ unitId, scope }: { unitId: string; scope: SummaryScope }) {
  const { t } = useTranslation()
  const { state, canPrivate } = useAiAvailability()
  const make = useMakeSummary()
  const error = make.error ? (make.error instanceof AiCallError ? make.error.code : 'failed') : null
  if (state === 'offline' || state === 'disabled')
    return (
      <p className="px-1 text-sm text-ink-muted">
        {t(`owl.error.${state === 'offline' ? 'offline' : 'no_key'}`)}
      </p>
    )
  if (!canPrivate)
    return (
      <p className="surface rounded-card px-4 py-3.5 text-sm text-ink-secondary">
        {t('owl.error.needs_paid')}
      </p>
    )
  return (
    <div className="flex flex-col gap-2">
      <section className="surface flex flex-col gap-2 rounded-card px-[18px] py-4">
        <span className="text-[15px] font-bold">{t('summary.emptyTitle')}</span>
        <span className="text-[15px] leading-[22px] text-ink-secondary">
          {t('summary.emptyBody')}
        </span>
      </section>
      <button
        type="button"
        disabled={make.isPending || state !== 'ready'}
        onClick={() => make.mutate({ unitId, scope })}
        className="btn-primary flex h-14 items-center justify-center gap-2.5 rounded-[16px] text-[17px] font-bold disabled:opacity-60"
      >
        <SparkleIcon size={18} />
        {make.isPending ? t('summary.making') : t('summary.make')}
      </button>
      {error && (
        <span role="alert" className="px-1 text-sm text-danger">
          {t(`owl.error.${error as 'failed'}`)}
        </span>
      )}
    </div>
  )
}
