import { useTranslation } from 'react-i18next'
import { Switch } from '@/components/Switch'
import { useUnitSummary, useUnitsWithText } from '@/features/sources/summaryApi'
import { MakeSummary, SummaryView } from '@/features/sources/SummaryView'
import type { Unit } from '@/features/sources/model'
import { useSessionUi } from './store'

/**
 * "Koristi sažetak" in a running session (Sprint 18): for an unread chapter with source text the
 * session can study its summary instead of the pages. At the end such a unit is "Pročitano
 * (sažetak)" and its summary length teaches the summary pace (`planEnd`).
 */
export function SessionSummary({ sessionId, unit }: { sessionId: string; unit: Unit | null }) {
  const { t } = useTranslation()
  const withText = useUnitsWithText().data
  const summaryUi = useSessionUi((s) => s.summary)
  const setSummary = useSessionUi((s) => s.setSummary)
  const summary = useUnitSummary(unit?.id ?? '', 'unit')
  if (!unit || unit.kind !== 'chapter' || unit.level > 0 || !withText?.has(unit.id)) return null
  const ids = summaryUi?.sessionId === sessionId ? summaryUi.unitIds : []
  const on = ids.includes(unit.id)
  const toggle = (v: boolean) =>
    setSummary({
      sessionId,
      unitIds: v
        ? [...ids.filter((id) => id !== unit.id), unit.id]
        : ids.filter((id) => id !== unit.id),
    })

  return (
    <div className="flex flex-col gap-3">
      <div className="surface flex items-center justify-between gap-3 rounded-[20px] py-2.5 pr-3 pl-4">
        <span className="flex min-w-0 flex-col gap-0.5">
          <span className="text-[15px] font-bold">{t('summary.useSummary')}</span>
          <span className="text-[13px] text-ink-secondary">{t('summary.useSummaryHint')}</span>
        </span>
        <Switch checked={on} onChange={toggle} label={t('summary.useSummary')} hideLabel />
      </div>
      {on &&
        (summary.data ? (
          <SummaryView summary={summary.data} />
        ) : summary.isPending ? null : (
          <MakeSummary unitId={unit.id} scope="unit" />
        ))}
    </div>
  )
}
