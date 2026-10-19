import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { BackHeader } from '@/components/BackHeader'
import { useLocale } from '@/features/settings/useLocale'
import { dateFnsLocales } from '@/lib/locale'
import type { PeriodKind } from '@/lib/schedule'
import { usePeriods } from './api'
import { DateTile } from './DateTile'
import { dateRangeLabel, PERIOD_TILE } from './format'
import { PERIOD_KINDS, type PeriodRow } from './model'
import { PeriodSheet } from './PeriodSheet'

/** Akademski kalendar: teaching periods, partial-exam weeks, exam periods and holidays. */
export function AcademicCalendarPage() {
  const { t } = useTranslation()
  const { locale } = useLocale()
  const { data: periods = [] } = usePeriods()
  const [sheet, setSheet] = useState<{ open: boolean; id?: string; kind: PeriodKind }>({
    open: false,
    kind: 'teaching',
  })

  return (
    <div className="flex flex-col gap-3.5">
      <BackHeader title={t('calendar.title')} fallback="/settings" />
      <div className="flex flex-col gap-1">
        <h1 className="text-[26px] leading-tight font-bold">{t('calendar.heading')}</h1>
        <p className="text-sm leading-[1.45] text-ink-muted">{t('calendar.intro')}</p>
      </div>

      {PERIOD_KINDS.map((kind) => {
        const list = periods.filter((p) => p.kind === kind)
        return (
          <section key={kind} className="flex flex-col gap-2">
            <div className="mt-1 flex items-center justify-between">
              <h2 className="text-lg font-semibold">{t(`calendar.section.${kind}`)}</h2>
              <button
                type="button"
                onClick={() => setSheet({ open: true, kind })}
                className="flex h-10 items-center rounded-full bg-surface px-3.5 text-sm font-semibold text-brand"
              >
                {t('calendar.add')}
              </button>
            </div>
            {list.length === 0 ? (
              <p className="rounded-[20px] bg-surface px-4 py-3.5 text-sm text-ink-muted">
                {t(`calendar.empty.${kind}`)}
              </p>
            ) : (
              list.map((p) => (
                <PeriodRowButton
                  key={p.id}
                  period={p}
                  range={dateRangeLabel(p.starts_on, p.ends_on, dateFnsLocales[locale])}
                  onOpen={() => setSheet({ open: true, id: p.id, kind })}
                />
              ))
            )}
          </section>
        )
      })}

      <PeriodSheet
        period={periods.find((p) => p.id === sheet.id)}
        kind={sheet.kind}
        open={sheet.open}
        onOpenChange={(open) => setSheet((s) => ({ ...s, open }))}
      />
    </div>
  )
}

function PeriodRowButton({
  period,
  range,
  onOpen,
}: {
  period: PeriodRow
  range: string
  onOpen: () => void
}) {
  const { t } = useTranslation()
  const tile = PERIOD_TILE[period.kind as PeriodKind]
  const detail = [
    period.exam_session && t(`calendar.session.${period.exam_session as 'regular' | 'makeup'}`),
    range,
  ].filter(Boolean)
  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex items-center gap-3 rounded-[20px] bg-surface px-4 py-3.5 text-left"
    >
      <DateTile
        date={period.starts_on}
        className={tile.bg}
        dayClass={tile.day}
        monthClass={tile.month}
      />
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="text-[15px] font-semibold">{period.title}</span>
        <span className="text-xs text-ink-muted">{detail.join(' · ')}</span>
      </div>
    </button>
  )
}
