import { useTranslation } from 'react-i18next'
import { BottomSheet } from '@/components/BottomSheet'
import { pagesLabel, statusLabel } from '@/features/sources/format'
import { unitTitle, type SessionSource } from './material'
import { UnitOption } from './UnitOption'

/** Any unit of the subject's sources, or none ("Bez jedinice"). */
export function UnitPickerSheet({
  open,
  onOpenChange,
  sources,
  selected,
  onPick,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  sources: SessionSource[]
  selected: string | null
  onPick: (unitId: string | null) => void
}) {
  const { t } = useTranslation()
  return (
    <BottomSheet open={open} onOpenChange={onOpenChange} title={t('session.units.pickTitle')}>
      <div
        role="radiogroup"
        aria-label={t('session.units.pickTitle')}
        className="flex flex-col gap-3"
      >
        <UnitOption
          checked={selected === null}
          title={t('session.units.none')}
          onSelect={() => onPick(null)}
        />
        {sources.map((s) => (
          <div key={s.source.id} className="flex flex-col gap-0.5">
            <span className="px-1 pb-1 text-xs font-semibold text-ink-muted">{s.source.title}</span>
            {s.leaves.map((u) => (
              <UnitOption
                key={u.id}
                checked={u.id === selected}
                title={unitTitle(u)}
                meta={[pagesLabel(t, s.measure, u), statusLabel(t, u.kind, u.level, u)]
                  .filter(Boolean)
                  .join(' · ')}
                onSelect={() => onPick(u.id)}
              />
            ))}
          </div>
        ))}
      </div>
    </BottomSheet>
  )
}
