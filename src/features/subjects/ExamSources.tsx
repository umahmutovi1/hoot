import { useTranslation } from 'react-i18next'
import { Switch } from '@/components/Switch'
import { CheckIcon, PlusIcon } from '@/components/icons'
import type { SourceMaterial } from '@/features/sources/model'
import { cn } from '@/lib/utils'
import { Segmented, fieldLabel } from './fields'
import { leavesOfPick, sourceLeaves, type SourceChoice, type SourcePick } from './sourceScope'

const CHOICES = ['all', 'part', 'none'] as const satisfies readonly SourceChoice[]

/**
 * Step 2 of ExamSheet, "Šta ulazi": per source the whole of it, nothing, or a part picked here
 * chapter by chapter. Kept by the form and saved with the exam.
 */
export function ExamSources({
  materials,
  picks,
  onPick,
  scopeAll,
  onScopeAll,
  onAddSource,
}: {
  materials: SourceMaterial[]
  picks: Record<string, SourcePick>
  onPick: (sourceId: string, pick: SourcePick) => void
  scopeAll: boolean
  onScopeAll: (value: boolean) => void
  onAddSource: () => void
}) {
  const { t } = useTranslation()

  return (
    <div className="flex flex-col gap-3">
      <Switch checked={scopeAll} label={t('exams.scopeAll')} onChange={onScopeAll} />
      <span className="-mt-2 text-xs leading-[1.4] text-ink-muted">
        {t(scopeAll ? 'exams.sources.scopeAllOn' : 'exams.sources.scopeAllOff')}
      </span>

      <span className={fieldLabel}>{t('exams.sources.label')}</span>
      {materials.length === 0 && (
        <p className="rounded-[16px] bg-canvas px-4 py-3 text-sm text-ink-muted">
          {t('exams.sources.none')}
        </p>
      )}
      {materials.map((m) => (
        <SourceCard
          key={m.source.id}
          material={m}
          pick={picks[m.source.id]!}
          onPick={(p) => onPick(m.source.id, p)}
        />
      ))}
      <button
        type="button"
        onClick={onAddSource}
        className="flex h-11 items-center gap-1.5 self-start rounded-full px-1 text-[13px] font-semibold text-brand"
      >
        <PlusIcon className="size-4" />
        {t('exams.sources.add')}
      </button>
    </div>
  )
}

function SourceCard({
  material,
  pick,
  onPick,
}: {
  material: SourceMaterial
  pick: SourcePick
  onPick: (pick: SourcePick) => void
}) {
  const { t } = useTranslation()
  const leaves = sourceLeaves(material)
  const inScope = leavesOfPick(material, pick)
  const byId = new Map(material.units.map((u) => [u.id, u]))
  const depth = (parentId: string | null): number =>
    parentId ? 1 + depth(byId.get(parentId)?.parent_id ?? null) : 0
  const leavesUnder = (id: string): string[] => {
    const kids = material.units.filter((u) => u.parent_id === id)
    return kids.length === 0 ? [id] : kids.flatMap((k) => leavesUnder(k.id))
  }
  const toggle = (id: string) => {
    const under = leavesUnder(id)
    const next = new Set(inScope)
    const allIn = under.every((l) => next.has(l))
    for (const l of under) {
      if (allIn) next.delete(l)
      else next.add(l)
    }
    onPick({ choice: 'part', leaves: next })
  }

  return (
    <div className="flex flex-col gap-2.5 rounded-[18px] bg-canvas-soft p-3">
      <div className="flex items-baseline justify-between gap-2 px-1">
        <span className="min-w-0 truncate text-sm font-semibold">{material.source.title}</span>
        <span className="shrink-0 text-xs text-ink-muted">
          {t('exams.sources.count', { count: inScope.size, total: leaves.length })}
        </span>
      </div>
      <Segmented
        label={material.source.title}
        options={CHOICES.map((c) => ({ value: c, label: t(`exams.sources.choice.${c}`) }))}
        value={pick.choice}
        onChange={(c) =>
          // "Dio" starts from what is in scope now, so switching to it changes nothing yet.
          onPick({ choice: c, leaves: c === 'part' ? inScope : pick.leaves })
        }
      />
      {pick.choice === 'part' && (
        <ul className="flex flex-col">
          {material.units.map((u) => {
            const under = leavesUnder(u.id)
            const count = under.filter((l) => inScope.has(l)).length
            const state = count === 0 ? 'off' : count === under.length ? 'on' : 'mixed'
            return (
              <li key={u.id}>
                <button
                  type="button"
                  role="checkbox"
                  aria-checked={state === 'mixed' ? 'mixed' : state === 'on'}
                  onClick={() => toggle(u.id)}
                  style={{ paddingLeft: 4 + depth(u.parent_id) * 20 }}
                  className="flex min-h-11 w-full items-center gap-3 pr-1 text-left"
                >
                  <span
                    className={cn(
                      'flex size-[22px] shrink-0 items-center justify-center rounded-[7px] border-2',
                      state === 'off'
                        ? 'border-line bg-surface'
                        : 'border-brand bg-brand text-white',
                    )}
                  >
                    {state === 'on' && <CheckIcon size={14} />}
                    {state === 'mixed' && <span className="h-0.5 w-2.5 rounded-full bg-white" />}
                  </span>
                  <span
                    className={cn(
                      'min-w-0 flex-1 text-sm',
                      u.parent_id === null && 'font-semibold',
                    )}
                  >
                    {u.label && <span className="text-ink-muted">{u.label} </span>}
                    {u.title}
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
