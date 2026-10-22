import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { format } from 'date-fns'
import { BottomSheet } from '@/components/BottomSheet'
import { RadioCard } from '@/components/RadioCard'
import { Switch } from '@/components/Switch'
import { useToast } from '@/components/toast-store'
import { formatDuration } from '@/features/sources/format'
import { useLocale } from '@/features/settings/useLocale'
import { useDeadlines, useSubjects } from '@/features/subjects/api'
import { paletteOf } from '@/features/subjects/colors'
import { addDays, diffDays, toDisplayDate, type LocalDate } from '@/lib/day'
import { dateFnsLocales } from '@/lib/locale'
import { leavesOf } from '@/lib/progress'
import { formatClock, parseClock } from '@/lib/schedule'
import { cn } from '@/lib/utils'
import { useDeleteBlock, useSaveBlock, type BlockDraft } from './actions'
import { blockMode, blockTitle, useUnitIndex } from './model'
import { reasonOf } from './save'
import type { PlanBlockRow } from './state'
import { usePlanStore } from './store'

const TYPES = [
  { id: 'reading', kind: 'learn' },
  { id: 'problems', kind: 'learn' },
  { id: 'review', kind: 'review' },
  { id: 'questions', kind: 'questions' },
  { id: 'deadline', kind: 'deadline' },
] as const
type TypeId = (typeof TYPES)[number]['id']

const MIN_MINUTES = 15
const MAX_MINUTES = 240
const SHOWN_UNITS = 8

/**
 * UrediBlok (PRD flow 7): add a block, change one (an AI block becomes manual and the plan stops
 * moving it) or delete it — an AI block asks whether its material moves to other days or leaves
 * the plan for its exam. Every change has an undo toast and replans.
 */
export function BlockSheet({
  open,
  onOpenChange,
  block,
  date,
  today,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** null = new block */
  block: PlanBlockRow | null
  /** Day of a new block. */
  date: LocalDate
  today: LocalDate
}) {
  const { t } = useTranslation()
  const [deleting, setDeleting] = useState(false)
  const close = (o: boolean) => {
    if (!o) setDeleting(false)
    onOpenChange(o)
  }
  return (
    <BottomSheet
      open={open}
      onOpenChange={close}
      title={
        deleting ? t('blockSheet.deleteTitle') : block ? t('blockSheet.edit') : t('blockSheet.new')
      }
    >
      {open && (
        <BlockForm
          key={block?.id ?? 'new'}
          block={block}
          date={date}
          today={today}
          deleting={deleting}
          setDeleting={setDeleting}
          onDone={() => close(false)}
        />
      )}
    </BottomSheet>
  )
}

function BlockForm({
  block,
  date,
  today,
  deleting,
  setDeleting,
  onDone,
}: {
  block: PlanBlockRow | null
  date: LocalDate
  today: LocalDate
  deleting: boolean
  setDeleting: (d: boolean) => void
  onDone: () => void
}) {
  const { t } = useTranslation()
  const { locale } = useLocale()
  const { data: subjects = [] } = useSubjects()
  const { data: deadlines = [] } = useDeadlines()
  const units = useUnitIndex()
  const model = usePlanStore((s) => s.model)
  const save = useSaveBlock()
  const remove = useDeleteBlock()
  const show = useToast((s) => s.show)
  const active = subjects.filter((s) => !s.archived)

  const initialType: TypeId = block
    ? block.kind === 'learn'
      ? blockMode(block, units) === 'problems'
        ? 'problems'
        : 'reading'
      : block.kind === 'recap'
        ? 'review'
        : block.kind
    : 'reading'
  const [subjectId, setSubjectId] = useState(block?.subject_id ?? active[0]?.id ?? '')
  const [type, setType] = useState<TypeId>(initialType)
  const [unitIds, setUnitIds] = useState<string[]>(
    block?.plan_block_units.map((u) => u.unit_id) ?? [],
  )
  const [day, setDay] = useState<LocalDate>(block?.on_date ?? date)
  const [minutes, setMinutes] = useState(block?.planned_minutes ?? 45)
  const [timeOn, setTimeOn] = useState(block?.start_min !== null && block?.start_min !== undefined)
  const [time, setTime] = useState(formatClock(block?.start_min ?? 9 * 60))
  const [drop, setDrop] = useState(false)
  const [showAll, setShowAll] = useState(false)

  const subjectUnits = useMemo(() => {
    const list = [...units.values()].filter(
      (i) => i.source.subject_id === subjectId && i.unit.archived_at === null,
    )
    const leafIds = new Set(
      leavesOf(
        list.map((i) => ({
          id: i.unit.id,
          parentId: i.unit.parent_id,
          level: i.unit.level,
          minutes: 0,
        })),
      ).map((l) => l.id),
    )
    return list
      .filter((i) => leafIds.has(i.unit.id))
      .sort(
        (a, b) =>
          a.source.created_at.localeCompare(b.source.created_at) ||
          a.unit.position - b.unit.position,
      )
  }, [units, subjectId])
  const open = subjectUnits.filter((i) => i.unit.level < 2 || unitIds.includes(i.unit.id))
  const firstOpen = Math.max(
    0,
    open.findIndex((i) => i.unit.level === 0),
  )
  const shown = showAll ? open : open.slice(firstOpen, firstOpen + SHOWN_UNITS)
  const unitLabel = (i: (typeof open)[number]) =>
    i.unit.label && !i.unit.label.startsWith('~') ? i.unit.label : i.unit.title

  const days = Array.from({ length: 7 }, (_, i) => addDays(today, i))
  if (!days.includes(day)) days.push(day)
  const dayTop = (d: LocalDate) => {
    const n = diffDays(today, d)
    if (n === 0) return t('blockSheet.today')
    if (n === 1) return t('blockSheet.tomorrow')
    return format(toDisplayDate(d), 'EEE', { locale: dateFnsLocales[locale] })
  }

  const wasAi = block?.origin === 'ai'
  const edited = wasAi || (block ? reasonOf(block)?.edited === true : false)
  const subjectName = active.find((s) => s.id === subjectId)?.name ?? ''

  const submit = async () => {
    if (!subjectId) return
    const kind = TYPES.find((x) => x.id === type)!.kind
    const goals = model?.built.state.goals ?? []
    const covering = goals.find(
      (g) =>
        g.kind === 'exam' &&
        g.subjectId === subjectId &&
        unitIds.some((u) => g.unitIds.includes(u)),
    )
    const nextExam = goals.find((g) => g.kind === 'exam' && g.subjectId === subjectId)
    const deadline = deadlines
      .filter((d) => d.subject_id === subjectId && !d.done)
      .sort((a, b) => a.due_at.localeCompare(b.due_at))[0]
    const draft: BlockDraft = {
      id: block?.id ?? crypto.randomUUID(),
      subjectId,
      assessmentId:
        kind === 'deadline' ? null : ((covering ?? nextExam)?.id ?? block?.assessment_id ?? null),
      deadlineId: kind === 'deadline' ? (deadline?.id ?? block?.deadline_id ?? null) : null,
      onDate: day,
      startMin: timeOn ? (parseClock(time) ?? null) : null,
      minutes,
      kind,
      mode: type,
      unitIds: kind === 'deadline' ? [] : unitIds,
      title: block?.title ?? null,
      edited,
    }
    const undo = await save(draft)
    show(wasAi ? t('blockSheet.lockedToast') : t('blockSheet.savedToast'), {
      label: t('today.cant.undo'),
      run: () => void undo(),
    })
    onDone()
  }

  const confirmDelete = async () => {
    if (!block) return
    const undo = await remove(block, drop)
    show(t('blockSheet.deletedToast'), { label: t('today.cant.undo'), run: () => void undo() })
    onDone()
  }

  if (deleting && block) {
    const title = blockTitle(t, block, units)
    const canDrop = wasAi && block.assessment_id && block.plan_block_units.length > 0
    const exam = model?.built.state.goals.find((g) => g.id === block.assessment_id)
    const examTitle =
      subjects.flatMap((s) => s.assessments).find((a) => a.id === exam?.id)?.title ?? ''
    return (
      <div className="flex flex-col gap-3.5">
        <p className="-mt-2 text-sm text-ink-muted">
          {[
            `${subjectName.split(' ')[0]} — ${title}`,
            format(toDisplayDate(block.on_date), 'EEE, d. MMM', { locale: dateFnsLocales[locale] }),
            formatDuration(t, block.planned_minutes),
          ].join(' · ')}
        </p>
        {canDrop && (
          <div
            role="radiogroup"
            aria-label={t('blockSheet.deleteTitle')}
            className="flex flex-col gap-2"
          >
            <RadioCard
              checked={!drop}
              onSelect={() => setDrop(false)}
              title={t('blockSheet.move')}
              subtitle={t('blockSheet.moveSub')}
            />
            <RadioCard
              checked={drop}
              onSelect={() => setDrop(true)}
              title={t('blockSheet.drop')}
              subtitle={t('blockSheet.dropSub', { title, exam: examTitle })}
            />
          </div>
        )}
        <button
          type="button"
          onClick={() => void confirmDelete()}
          className="flex h-14 items-center justify-center rounded-full bg-danger text-base font-semibold text-white"
        >
          {t('blockSheet.delete')}
        </button>
        <button
          type="button"
          onClick={() => setDeleting(false)}
          className="flex h-12 items-center justify-center rounded-full text-[15px] font-semibold text-brand"
        >
          {t('blockSheet.cancel')}
        </button>
      </div>
    )
  }

  const label = 'text-[13px] font-semibold tracking-[0.3px] text-ink-secondary uppercase'
  return (
    <div className="flex flex-col gap-4">
      {block && (
        <p className="-mt-2 text-sm text-ink-muted">
          {[
            subjectName,
            format(toDisplayDate(block.on_date), 'EEE, d. MMM', { locale: dateFnsLocales[locale] }),
            block.origin === 'user' ? t('blockSheet.manualEdited') : null,
          ]
            .filter(Boolean)
            .join(' · ')}
        </p>
      )}
      <div className="flex flex-col gap-2">
        <span className={label}>{t('blockSheet.subject')}</span>
        <div
          role="radiogroup"
          aria-label={t('blockSheet.subject')}
          className="flex flex-wrap gap-2"
        >
          {active.map((s) => {
            const on = s.id === subjectId
            const palette = paletteOf(s.color)
            return (
              <button
                key={s.id}
                type="button"
                role="radio"
                aria-checked={on}
                onClick={() => {
                  setSubjectId(s.id)
                  setUnitIds([])
                  setShowAll(false)
                }}
                className={cn(
                  'flex h-11 items-center gap-2 rounded-full border-2 px-3.5 text-sm font-semibold',
                  on ? cn(palette.border, palette.soft) : 'border-hairline bg-white/55',
                )}
              >
                <span className={cn('size-2.5 rounded-full', palette.bar)} />
                {s.name.split(' ')[0]}
              </button>
            )
          })}
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <span className={label}>{t('blockSheet.type')}</span>
        <div role="radiogroup" aria-label={t('blockSheet.type')} className="flex flex-wrap gap-1.5">
          {TYPES.map((x) => (
            <button
              key={x.id}
              type="button"
              role="radio"
              aria-checked={type === x.id}
              onClick={() => setType(x.id)}
              className={cn(
                'flex h-10 items-center rounded-full px-3.5 text-[13px] font-semibold',
                type === x.id ? 'bg-brand text-white' : 'bg-canvas text-ink',
              )}
            >
              {t(`planBlocks.mode.${x.id === 'reading' ? 'reading' : x.id}`)}
            </button>
          ))}
        </div>
      </div>

      {type !== 'deadline' && shown.length > 0 && (
        <div className="flex flex-col gap-2">
          <span className={label}>
            {t('blockSheet.units')}{' '}
            <span className="font-normal tracking-normal normal-case">
              {t('blockSheet.optional')}
            </span>
          </span>
          <div role="group" aria-label={t('blockSheet.units')} className="flex flex-wrap gap-1.5">
            {shown.map((i) => {
              const on = unitIds.includes(i.unit.id)
              return (
                <button
                  key={i.unit.id}
                  type="button"
                  role="checkbox"
                  aria-checked={on}
                  onClick={() =>
                    setUnitIds(
                      on ? unitIds.filter((x) => x !== i.unit.id) : [...unitIds, i.unit.id],
                    )
                  }
                  className={cn(
                    'flex h-10 max-w-full items-center truncate rounded-full border px-3.5 text-[13px] font-semibold',
                    on ? 'border-brand bg-brand-hero text-brand-strong' : 'border-line bg-white/55',
                  )}
                >
                  {unitLabel(i)}
                </button>
              )
            })}
            {!showAll && open.length > shown.length && (
              <button
                type="button"
                onClick={() => setShowAll(true)}
                className="h-10 px-2 text-[13px] font-semibold text-brand"
              >
                {t('blockSheet.allUnits', { count: open.length })}
              </button>
            )}
          </div>
        </div>
      )}

      <div className="flex flex-col gap-2">
        <span className={label}>{t('blockSheet.day')}</span>
        <div
          role="radiogroup"
          aria-label={t('blockSheet.day')}
          className="flex gap-1.5 overflow-x-auto"
        >
          {days.map((d) => (
            <button
              key={d}
              type="button"
              role="radio"
              aria-checked={d === day}
              onClick={() => setDay(d)}
              className={cn(
                'flex h-14 min-w-[52px] flex-1 shrink-0 flex-col items-center justify-center rounded-[18px] text-[13px] font-semibold',
                d === day ? 'bg-ink text-white' : 'bg-canvas text-ink',
              )}
            >
              <span className="first-letter:uppercase">{dayTop(d)}</span>
              <span className="text-xs font-normal opacity-80">
                {format(toDisplayDate(d), 'd.')}
              </span>
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-center justify-between gap-3">
        <span className="flex flex-col gap-0.5">
          <span className="text-[15px] font-semibold">{t('blockSheet.duration')}</span>
          <span className="text-xs text-ink-muted">{t('blockSheet.durationMin')}</span>
        </span>
        <span className="flex items-center gap-2">
          <button
            type="button"
            aria-label={t('blockSheet.shorter')}
            onClick={() => setMinutes(Math.max(MIN_MINUTES, minutes - 5))}
            className="flex size-11 items-center justify-center rounded-full bg-canvas text-xl font-semibold"
          >
            −
          </button>
          <span className="w-16 text-center text-[15px] font-semibold tabular-nums">
            {t('time.minutes', { m: minutes })}
          </span>
          <button
            type="button"
            aria-label={t('blockSheet.longer')}
            onClick={() => setMinutes(Math.min(MAX_MINUTES, minutes + 5))}
            className="flex size-11 items-center justify-center rounded-full bg-canvas text-xl font-semibold"
          >
            +
          </button>
        </span>
      </div>

      <div className="flex items-center justify-between gap-3">
        <span className="flex flex-col gap-0.5">
          <span className="text-[15px] font-semibold">
            {t('blockSheet.time')}{' '}
            <span className="text-xs font-normal text-ink-muted">{t('blockSheet.optional')}</span>
          </span>
          <span className="text-xs text-ink-muted">
            {timeOn ? t('blockSheet.timeFixed') : t('blockSheet.timeFree')}
          </span>
        </span>
        <span className="flex items-center gap-2">
          {timeOn && (
            <input
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              aria-label={t('blockSheet.time')}
              className="h-11 rounded-input bg-canvas px-3 text-[15px] font-semibold"
            />
          )}
          <Switch checked={timeOn} onChange={setTimeOn} label={t('blockSheet.setTime')} hideLabel />
        </span>
      </div>

      {wasAi && (
        <p className="rounded-[18px] bg-canvas px-3.5 py-3 text-[13px] text-ink-secondary">
          {t('blockSheet.lockNote')}
        </p>
      )}

      <button
        type="button"
        onClick={() => void submit()}
        disabled={!subjectId}
        className="btn-primary flex h-14 items-center justify-center rounded-full text-base font-semibold"
      >
        {t('blockSheet.save')}
      </button>
      {block && (
        <button
          type="button"
          onClick={() => setDeleting(true)}
          className="flex h-12 items-center justify-center rounded-full text-[15px] font-semibold text-danger"
        >
          {t('blockSheet.deleteBlock')}
        </button>
      )}
    </div>
  )
}
