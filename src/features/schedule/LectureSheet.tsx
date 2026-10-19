import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { BottomSheet } from '@/components/BottomSheet'
import { CheckIcon } from '@/components/icons'
import { Button } from '@/components/ui/button'
import { useSources } from '@/features/sources/api'
import { materialOf, type SourceMaterial } from '@/features/sources/model'
import { fieldInput, fieldLabel } from '@/features/subjects/fields'
import { useDayBoundary } from '@/features/settings/profile'
import { localDay } from '@/lib/day'
import { latestLog } from '@/lib/pace'
import { CLASS_MARGIN_MIN } from '@/lib/schedule'
import { cn } from '@/lib/utils'
import { useLectureLogs, useSaveLectureLogs } from './api'
import { skipLecture } from './lectureSkips'
import { toPaceLog, type TimetableRow } from './model'

interface LectureSheetProps {
  subjectId: string
  subjectName: string
  /** The class this answers ("Danas" card); undefined = manual entry with a date. */
  entry?: TimetableRow
  /** Local day of the class. */
  date?: string
  /** "Predavanje · danas 09:00–11:00" */
  context?: string
  open: boolean
  onOpenChange: (open: boolean) => void
  onSkip?: () => void
}

/** DokleSmoStigli: tap the last unit covered in class, per source. */
export function LectureSheet(props: LectureSheetProps) {
  const { t } = useTranslation()
  return (
    <BottomSheet
      open={props.open}
      onOpenChange={props.onOpenChange}
      title={t('lectures.title')}
      subtitle={[props.subjectName, props.context].filter(Boolean).join(' · ')}
    >
      {props.open && <LectureForm {...props} onDone={() => props.onOpenChange(false)} />}
    </BottomSheet>
  )
}

function LectureForm({
  subjectId,
  entry,
  date: classDate,
  onDone,
  onSkip,
}: LectureSheetProps & { onDone: () => void }) {
  const { t } = useTranslation()
  const boundary = useDayBoundary()
  const { data: sources = [] } = useSources(subjectId)
  const { data: logs = [] } = useLectureLogs()
  const save = useSaveLectureLogs()
  const materials = useMemo(
    () => sources.map(materialOf).filter((m) => m.units.length > 0),
    [sources],
  )
  const subjectLogs = logs.filter((l) => l.subject_id === subjectId).map(toPaceLog)
  // The boundary that counts: the latest log pointing at a unit that is still active.
  const previous = (sourceId: string) => {
    const active = new Set(materials.find((m) => m.source.id === sourceId)?.units.map((u) => u.id))
    return (
      latestLog(
        subjectLogs.filter((l) => l.sourceId === sourceId && active.has(l.upToUnitId ?? '')),
      )?.upToUnitId ?? null
    )
  }

  const [tab, setTab] = useState(0)
  const [picked, setPicked] = useState<Record<string, string>>({})
  const [note, setNote] = useState('')
  const [today] = useState(() => localDay(new Date(), boundary))
  const [date, setDate] = useState(() => classDate ?? today)
  const material = materials[Math.min(tab, materials.length - 1)]
  const current = material ? (picked[material.source.id] ?? previous(material.source.id)) : null
  const changed = materials.filter(
    (m) => picked[m.source.id] && picked[m.source.id] !== previous(m.source.id),
  )
  const currentUnit = material?.units.find((u) => u.id === current)

  const submit = () => {
    save.mutate({
      logs: changed.map((m) => ({
        id: crypto.randomUUID(),
        subject_id: subjectId,
        timetable_entry_id: entry?.id ?? null,
        on_date: date,
        source_id: m.source.id,
        up_to_unit_id: picked[m.source.id]!,
        note: note.trim() || null,
      })),
    })
    onDone()
  }

  const cancelClass = () => {
    if (!entry) return
    const logId = crypto.randomUUID()
    save.mutate({
      logs: [
        {
          id: logId,
          subject_id: subjectId,
          timetable_entry_id: entry.id,
          on_date: date,
          cancelled: true,
          note: note.trim() || null,
        },
      ],
      freeSlot: {
        id: crypto.randomUUID(),
        on_date: date,
        start_min: Math.max(0, entry.start_min - CLASS_MARGIN_MIN),
        end_min: Math.min(1440, entry.end_min + CLASS_MARGIN_MIN),
        is_busy: false,
        lecture_log_id: logId,
      },
    })
    onDone()
  }

  return (
    <div className="flex flex-col gap-3.5">
      {!entry && (
        <label className="flex flex-col gap-2">
          <span className={fieldLabel}>{t('lectures.date')}</span>
          <input
            type="date"
            value={date}
            max={today}
            onChange={(e) => e.target.value && setDate(e.target.value)}
            className={fieldInput}
          />
        </label>
      )}

      {materials.length === 0 ? (
        <p className="rounded-[18px] bg-canvas p-4 text-sm text-ink-muted">
          {t('lectures.noSources')}
        </p>
      ) : (
        <>
          {materials.length > 1 && (
            <div role="tablist" className="flex rounded-[22px] bg-canvas p-1">
              {materials.map((m, i) => (
                <button
                  key={m.source.id}
                  type="button"
                  role="tab"
                  aria-selected={i === tab}
                  onClick={() => setTab(i)}
                  className={cn(
                    'h-10 min-w-0 flex-1 truncate rounded-[18px] px-2 text-sm font-semibold',
                    i === tab && 'bg-surface',
                  )}
                >
                  {m.source.title}
                </button>
              ))}
            </div>
          )}
          <span className="text-xs text-ink-muted">{t('lectures.hint')}</span>
          {material && (
            <UnitPicker
              material={material}
              selected={current}
              previous={previous(material.source.id)}
              onPick={(id) => setPicked((p) => ({ ...p, [material.source.id]: id }))}
            />
          )}
        </>
      )}

      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-semibold">
          {t('lectures.note')}{' '}
          <span className="font-normal text-ink-muted">{t('timetable.optional')}</span>
        </span>
        <textarea
          rows={2}
          maxLength={300}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder={t('lectures.notePlaceholder')}
          className="resize-none rounded-2xl bg-canvas-soft px-3.5 py-3 text-[15px] outline-none placeholder:text-ink-placeholder"
        />
      </label>

      <Button
        type="button"
        size="pill"
        disabled={changed.length === 0}
        onClick={submit}
        className="bg-brand text-white hover:bg-brand-strong"
      >
        {currentUnit && changed.length > 0
          ? t('lectures.saveUpTo', { label: currentUnit.label ?? currentUnit.title })
          : t('common.save')}
      </Button>
      {entry && (
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={cancelClass}
            className="min-h-11 text-sm font-semibold text-brand"
          >
            {t('lectures.cancelled')}
          </button>
          <button
            type="button"
            onClick={() => {
              skipLecture(`${entry.id}:${date}`)
              onSkip?.()
              onDone()
            }}
            className="min-h-11 text-sm font-medium text-ink-muted"
          >
            {t('lectures.skip')}
          </button>
        </div>
      )}
    </div>
  )
}

function UnitPicker({
  material,
  selected,
  previous,
  onPick,
}: {
  material: SourceMaterial
  selected: string | null
  previous: string | null
  onPick: (id: string) => void
}) {
  const { t } = useTranslation()
  const units = material.units
  const byId = new Map(units.map((u) => [u.id, u]))
  const depth = (id: string) => {
    let d = 0
    let p = byId.get(id)?.parent_id
    while (p && byId.has(p)) {
      d++
      p = byId.get(p)!.parent_id
    }
    return d
  }
  // Everything up to the end of the selected unit's subtree counts as covered.
  const selectedUnit = selected ? byId.get(selected) : undefined
  let coveredEnd = -1
  if (selectedUnit) {
    coveredEnd = selectedUnit.position
    for (const u of units) {
      let p: string | null = u.parent_id
      while (p) {
        if (p === selectedUnit.id) coveredEnd = Math.max(coveredEnd, u.position)
        p = byId.get(p)?.parent_id ?? null
      }
    }
  }

  return (
    <div
      role="radiogroup"
      aria-label={t('lectures.coveredUpTo')}
      className="-mx-1 flex max-h-[42dvh] flex-col gap-0.5 overflow-y-auto px-1"
    >
      {units.map((u) => {
        const done = u.position <= coveredEnd
        const d = depth(u.id)
        return (
          <button
            key={u.id}
            type="button"
            role="radio"
            aria-checked={u.id === selected}
            onClick={() => onPick(u.id)}
            className={cn(
              'flex min-h-[46px] items-center gap-2.5 rounded-[14px] py-1.5 pr-2.5 text-left',
              done && 'bg-brand-soft',
            )}
            style={{ paddingLeft: 10 + d * 20 }}
          >
            <span
              className={cn(
                'flex size-[22px] shrink-0 items-center justify-center rounded-full border-2',
                done ? 'border-brand bg-brand text-white' : 'border-radio-ring bg-surface',
              )}
            >
              {done && <CheckIcon size={12} strokeWidth={3.5} />}
            </span>
            {u.label && (
              <span className="w-[30px] shrink-0 text-[13px] font-semibold text-ink-muted">
                {u.label}
              </span>
            )}
            <span className={cn('min-w-0 flex-1 text-sm', d === 0 ? 'font-semibold' : '')}>
              {u.title}
            </span>
            {u.id === previous && u.id !== selected && (
              <span className="rounded-lg bg-warning-soft px-2 py-[3px] text-[11px] font-semibold whitespace-nowrap text-warning-ink">
                {t('lectures.lastTime')}
              </span>
            )}
            {u.id === selected && (
              <span className="rounded-lg bg-brand px-2 py-[3px] text-[11px] font-semibold whitespace-nowrap text-white">
                {t('lectures.upToHere')}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}
