import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { format } from 'date-fns'
import { BottomSheet } from '@/components/BottomSheet'
import { LockIcon } from '@/components/icons'
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
import {
  useAddExtraTime,
  useDeleteBlock,
  useSaveBlock,
  useSkipBlock,
  useStartBlock,
  type BlockDraft,
} from './actions'
import { blockMode, blockTitle, useUnitIndex } from './model'
import { reasonOf } from './save'
import type { PlanBlockRow } from './state'
import { usePlanStore } from './store'
import { fillPick, pickFor, pickTitle } from '@/features/today/pick'
import { usePlanToday } from '@/features/today/usePlanToday'

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
  startDeleting = false,
  initialMinutes,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** null = new block */
  block: PlanBlockRow | null
  /** Day of a new block. */
  date: LocalDate
  today: LocalDate
  /**
   * Open straight on the delete question ("Izbaci iz plana" on Danas); Odustani then closes the
   * sheet instead of going back to the form. Remount (key) to switch.
   */
  startDeleting?: boolean
  /** A new block's length to start from ("Imaš X min više danas"). */
  initialMinutes?: number
}) {
  const { t } = useTranslation()
  const [deleting, setDeleting] = useState(startDeleting)
  const close = (o: boolean) => {
    if (!o) setDeleting(startDeleting)
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
          setDeleting={startDeleting ? () => close(false) : setDeleting}
          initialMinutes={initialMinutes}
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
  initialMinutes,
}: {
  block: PlanBlockRow | null
  date: LocalDate
  today: LocalDate
  deleting: boolean
  setDeleting: (d: boolean) => void
  onDone: () => void
  initialMinutes?: number
}) {
  const { t } = useTranslation()
  const { locale } = useLocale()
  const { data: subjects = [] } = useSubjects()
  const { data: deadlines = [] } = useDeadlines()
  const units = useUnitIndex()
  const model = usePlanStore((s) => s.model)
  const save = useSaveBlock()
  const remove = useDeleteBlock()
  const skip = useSkipBlock()
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
  const [minutes, setMinutes] = useState(block?.planned_minutes ?? initialMinutes ?? 45)
  // A new block starts as the plan's suggestion (decision after 10b): only day, length and time
  // are chosen; "Ručno" shows subject, type and units.
  const [suggesting, setSuggesting] = useState(!block)
  // After adding a block for today: "Započeti odmah?"
  const [added, setAdded] = useState<PlanBlockRow | null>(null)
  const addExtra = useAddExtraTime()
  const start = useStartBlock()
  const [timeOn, setTimeOn] = useState(block?.start_min !== null && block?.start_min !== undefined)
  // Block mode (decision, October 2026): Automatski (the plan arranges it) or Fiksno (locked: the
  // replan never moves it). Null until the user picks one; a moved AI block defaults to Fiksno.
  const [pickedMode, setPickedMode] = useState<'auto' | 'fixed' | null>(null)
  const [time, setTime] = useState(formatClock(block?.start_min ?? 9 * 60))
  // Delete question: move the material, drop it from the exam, or give the slot to another subject.
  const [choice, setChoice] = useState<'move' | 'drop' | 'other'>('move')
  const [otherId, setOtherId] = useState<string | null>(null)
  const planToday = usePlanToday()
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
  // The chips start at the block's own units, else at the first unit not read yet.
  const firstSelected = open.findIndex((i) =>
    block?.plan_block_units.some((u) => u.unit_id === i.unit.id),
  )
  const firstOpen = Math.max(
    0,
    firstSelected >= 0 ? firstSelected : open.findIndex((i) => i.unit.level === 0),
  )
  const shown = showAll ? open : open.slice(firstOpen, firstOpen + SHOWN_UNITS)
  const unitLabel = (i: (typeof open)[number]) =>
    i.unit.label && !i.unit.label.startsWith('~') ? i.unit.label : i.unit.title

  const days = Array.from({ length: 7 }, (_, i) => addDays(today, i))
  if (!days.includes(day)) days.push(day)
  const dayTop = (d: LocalDate) => {
    const n = diffDays(today, d)
    // "Sutra" did not fit the chip; tomorrow is named by its weekday like the other days.
    if (n === 0) return t('blockSheet.today')
    return format(toDisplayDate(d), 'EEE', { locale: dateFnsLocales[locale] })
  }

  const wasAi = block?.origin === 'ai'
  const edited = wasAi || (block ? reasonOf(block)?.edited === true : false)
  const subjectName = active.find((s) => s.id === subjectId)?.name ?? ''
  const startMin = timeOn ? (parseClock(time) ?? null) : null
  // An AI block whose day or time changed asks whether to keep that time.
  const moved = Boolean(block && wasAi && (day !== block.on_date || startMin !== block.start_min))
  const mode = pickedMode ?? (block?.origin === 'user' || moved || !block ? 'fixed' : 'auto')
  const asAi = wasAi && mode === 'auto'
  // A fixed block set to Automatski goes back to the plan (any fixed block, not only edited ones).
  const toAuto = block?.origin === 'user' && mode === 'auto'

  const submit = async () => {
    if (!subjectId) return
    if (toAuto) return backToPlan()
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
      startMin,
      minutes,
      kind,
      mode: type,
      unitIds: kind === 'deadline' ? [] : unitIds,
      title: block?.title ?? null,
      edited,
      ...(asAi && block
        ? {
            asAi: {
              planRunId: block.plan_run_id,
              reason: block.reason,
              units: sameUnits(block, unitIds)
                ? block.plan_block_units.map(({ user_id: _u, ...u }) => u)
                : null,
            },
          }
        : {}),
    }
    const undo = await save(draft)
    show(
      asAi
        ? moved
          ? t('blockSheet.movedAiToast')
          : t('blockSheet.savedToast')
        : wasAi
          ? t('blockSheet.lockedToast')
          : t('blockSheet.savedToast'),
      {
        label: t('today.cant.undo'),
        run: () => void undo(),
      },
    )
    onDone()
  }

  const backToPlan = async () => {
    if (!block) return
    const undo = await remove(block, false)
    show(t('blockSheet.backToPlanToast'), { label: t('today.cant.undo'), run: () => void undo() })
    onDone()
  }

  const confirmDelete = async () => {
    if (!block) return
    const undo = await remove(block, choice === 'drop')
    show(t('blockSheet.deletedToast'), { label: t('today.cant.undo'), run: () => void undo() })
    onDone()
  }

  /**
   * "Drugi predmet u ovo vrijeme" (decision, Stage 10b): the slot becomes a manual block of the
   * other subject, same day, time and length, with the material `pickForTime()` picks for it; the
   * deleted block's material goes back to the plan from tomorrow.
   */
  const giveSlot = async (other: string) => {
    if (!block) return
    const pick = pickFor(planToday, block.planned_minutes, other)
    const kind = pick?.kind === 'review' || pick?.kind === 'questions' ? pick.kind : 'learn'
    const unitIds = pick?.units.map((u) => u.unitId) ?? []
    const goals = model?.built.state.goals ?? []
    const exam =
      goals.find(
        (g) =>
          g.kind === 'exam' && g.subjectId === other && unitIds.some((u) => g.unitIds.includes(u)),
      ) ?? goals.find((g) => g.kind === 'exam' && g.subjectId === other)
    const undoDelete = await remove(block, false, true)
    const undoSave = await save({
      id: crypto.randomUUID(),
      subjectId: other,
      assessmentId: exam?.id ?? null,
      deadlineId: null,
      onDate: block.on_date,
      startMin: block.start_min,
      minutes: block.planned_minutes,
      kind,
      mode: kind === 'learn' ? 'reading' : kind,
      unitIds,
      title: null,
      edited: false,
    })
    show(t('blockSheet.otherToast', { subject: active.find((x) => x.id === other)?.name ?? '' }), {
      label: t('today.cant.undo'),
      run: () => void undoSave().then(() => undoDelete()),
    })
    onDone()
  }

  if (deleting && block) {
    const title = blockTitle(t, block, units)
    const canDrop = wasAi && block.assessment_id && block.plan_block_units.length > 0
    const exam = model?.built.state.goals.find((g) => g.id === block.assessment_id)
    const examTitle =
      subjects.flatMap((s) => s.assessments).find((a) => a.id === exam?.id)?.title ?? ''
    const others = active.filter((s) => s.id !== block.subject_id)
    const pickedOther = otherId ?? others[0]?.id ?? null
    return (
      <div className="flex flex-col gap-3.5">
        <p className="-mt-2 text-sm text-ink-muted">
          {[
            `${subjectName.split(' ')[0]} — ${title}`,
            format(toDisplayDate(block.on_date), 'EEE, d. MMM', { locale: dateFnsLocales[locale] }),
            formatDuration(t, block.planned_minutes),
          ].join(' · ')}
        </p>
        <div
          role="radiogroup"
          aria-label={t('blockSheet.deleteTitle')}
          className="flex flex-col gap-2"
        >
          <RadioCard
            checked={choice === 'move'}
            onSelect={() => setChoice('move')}
            title={t('blockSheet.move')}
            subtitle={t('blockSheet.moveSub')}
          />
          {canDrop && (
            <RadioCard
              checked={choice === 'drop'}
              onSelect={() => setChoice('drop')}
              title={t('blockSheet.drop')}
              subtitle={t('blockSheet.dropSub', { title, exam: examTitle })}
            />
          )}
          {others.length > 0 && (
            <RadioCard
              checked={choice === 'other'}
              onSelect={() => setChoice('other')}
              title={t('blockSheet.other')}
              subtitle={t('blockSheet.otherSub')}
            />
          )}
        </div>
        {choice === 'other' && (
          <div
            role="radiogroup"
            aria-label={t('blockSheet.subject')}
            className="flex flex-wrap gap-2"
          >
            {others.map((s) => {
              const on = s.id === pickedOther
              return (
                <button
                  key={s.id}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  onClick={() => setOtherId(s.id)}
                  className={cn(
                    'flex h-11 items-center gap-2 rounded-full px-4 text-[15px] font-semibold',
                    on ? 'bg-ink text-white' : 'glass',
                  )}
                >
                  <span className={cn('size-2 rounded-full', paletteOf(s.color).bar)} />
                  {s.name.split(' ')[0]}
                </button>
              )
            })}
          </div>
        )}
        {choice === 'other' ? (
          <button
            type="button"
            disabled={!pickedOther}
            onClick={() => pickedOther && void giveSlot(pickedOther)}
            className="btn-primary flex h-14 items-center justify-center rounded-full text-base font-semibold"
          >
            {t('blockSheet.save')}
          </button>
        ) : (
          <button
            type="button"
            onClick={() => void confirmDelete()}
            className="flex h-14 items-center justify-center rounded-full bg-danger text-base font-semibold text-white"
          >
            {t('blockSheet.delete')}
          </button>
        )}
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

  // The plan's suggestion for the chosen length (`pickForTime()`, filled up like "Imam još
  // vremena"); the block takes its goal from the block the material comes from.
  const firstPick = suggesting ? pickFor(planToday, minutes) : null
  const pick = firstPick ? fillPick(planToday, firstPick, minutes) : null
  const pickSubject = active.find((s) => s.id === pick?.subjectId)

  const addSuggested = async () => {
    if (!pick) return
    const source = planToday.blocks.find((b) =>
      b.plan_block_units.some((u) => u.unit_id === pick.units[0]?.unitId),
    )
    const kind = pick.kind
    const mode =
      kind === 'review' || kind === 'recap'
        ? 'review'
        : kind === 'questions'
          ? 'questions'
          : 'reading'
    const unitIds = pick.units.map((u) => u.unitId)
    // Today without a time: from now, as "Imam još vremena" (free time for that slot, may pass the
    // day's maximum). Otherwise a manual block on the chosen day and time.
    const { id, undo } =
      day === today && !timeOn
        ? await addExtra({
            subjectId: pick.subjectId,
            kind,
            minutes: pick.minutes,
            unitIds,
            assessmentId: source?.assessment_id ?? null,
            deadlineId: source?.deadline_id ?? null,
            mode,
          }).then((r) => ({ id: r.draft.id, undo: r.undo }))
        : await (async () => {
            const blockId = crypto.randomUUID()
            const undoSave = await save({
              id: blockId,
              subjectId: pick.subjectId,
              assessmentId: source?.assessment_id ?? null,
              deadlineId: source?.deadline_id ?? null,
              onDate: day,
              startMin,
              minutes: pick.minutes,
              kind,
              mode,
              unitIds,
              title: null,
              edited: false,
            })
            return { id: blockId, undo: undoSave }
          })()
    show(t('blockSheet.addedToast'), { label: t('today.cant.undo'), run: () => void undo() })
    if (day !== today) {
      onDone()
      return
    }
    setAdded({
      id,
      subject_id: pick.subjectId,
      kind,
      planned_minutes: pick.minutes,
      plan_block_units: pick.units.map((u) => ({
        block_id: id,
        unit_id: u.unitId,
        page_from: null,
        page_to: null,
        planned_minutes: u.minutes,
        user_id: '',
      })),
    } as PlanBlockRow)
  }

  if (added)
    return (
      <div className="flex flex-col gap-3.5">
        <p className="-mt-1 text-[15px] leading-[1.45] text-ink-secondary">
          {t('blockSheet.startNow', {
            title: pick ? pickTitle(t, pick, units, pickSubject?.name.split(' ')[0] ?? '') : '',
          })}
        </p>
        <button
          type="button"
          onClick={() => {
            onDone()
            void start(added, units)
          }}
          className="btn-primary flex h-14 items-center justify-center rounded-full text-base font-semibold"
        >
          {t('today.start.begin')}
        </button>
        <button
          type="button"
          onClick={onDone}
          className="flex h-12 items-center justify-center rounded-full text-[15px] font-semibold text-brand"
        >
          {t('blockSheet.later')}
        </button>
      </div>
    )

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
      {!block && (
        <div
          role="tablist"
          aria-label={t('blockSheet.mode')}
          className="flex rounded-full bg-canvas p-1"
        >
          {([true, false] as const).map((on) => (
            <button
              key={String(on)}
              type="button"
              role="tab"
              aria-selected={suggesting === on}
              onClick={() => setSuggesting(on)}
              className={cn(
                'h-9 flex-1 rounded-full text-[13px] font-semibold',
                suggesting === on ? 'bg-white/80 text-ink shadow-sm' : 'text-ink-secondary',
              )}
            >
              {on ? t('blockSheet.suggested') : t('blockSheet.manual')}
            </button>
          ))}
        </div>
      )}
      {!suggesting && (
        <>
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
            <div
              role="radiogroup"
              aria-label={t('blockSheet.type')}
              className="flex flex-wrap gap-1.5"
            >
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
              <div
                role="group"
                aria-label={t('blockSheet.units')}
                className="flex flex-wrap gap-1.5"
              >
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
                        on
                          ? 'border-brand bg-brand-hero text-brand-strong'
                          : 'border-line bg-white/55',
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
        </>
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

      {suggesting && (
        <div className="glass flex flex-col gap-1 rounded-[20px] px-4 py-3.5">
          <span className="text-xs font-semibold tracking-[0.4px] text-ink-secondary uppercase">
            {t('blockSheet.suggestion')}
          </span>
          {pick ? (
            <>
              <span className="flex items-center gap-2 text-[15px] font-semibold">
                <span
                  className={cn(
                    'size-2.5 shrink-0 rounded-full',
                    paletteOf(pickSubject?.color ?? null).bar,
                  )}
                />
                <span className="truncate">
                  {pickTitle(t, pick, units, pickSubject?.name.split(' ')[0] ?? '')}
                </span>
              </span>
              <span className="text-[13px] text-ink-muted">
                {t(`planBlocks.mode.${pick.kind === 'learn' ? 'reading' : pick.kind}`)} ·{' '}
                {t('time.minutes', { m: pick.minutes })}
              </span>
            </>
          ) : (
            <span className="text-[13px] text-ink-muted">{t('blockSheet.noSuggestion')}</span>
          )}
        </div>
      )}

      {block && !suggesting && (
        <div className="glass flex flex-col gap-2 rounded-[20px] px-3.5 py-3">
          <span className="text-[15px] font-semibold">{t('blockSheet.modeTitle')}</span>
          <div role="radiogroup" aria-label={t('blockSheet.modeTitle')} className="flex gap-1.5">
            {(['auto', 'fixed'] as const).map((m) => (
              <button
                key={m}
                type="button"
                role="radio"
                aria-checked={mode === m}
                onClick={() => setPickedMode(m)}
                className={cn(
                  'flex h-11 flex-1 items-center justify-center gap-1.5 rounded-full text-[13px] font-semibold',
                  mode === m ? 'bg-ink text-white' : 'bg-white/50 text-ink',
                )}
              >
                {m === 'fixed' && <LockIcon size={14} />}
                {t(`blockSheet.mode${m === 'auto' ? 'Auto' : 'Fixed'}`)}
              </button>
            ))}
          </div>
          <span className="text-xs leading-[1.35] text-ink-muted">
            {t(`blockSheet.mode${mode === 'auto' ? 'Auto' : 'Fixed'}Sub`)}
          </span>
        </div>
      )}

      <button
        type="button"
        onClick={() => void (suggesting ? addSuggested() : submit())}
        disabled={suggesting ? !pick : !subjectId}
        className="btn-primary flex h-14 items-center justify-center rounded-full text-base font-semibold"
      >
        {suggesting ? t('blockSheet.addOne') : t('blockSheet.save')}
      </button>
      {block && block.on_date === today && block.status === 'planned' && (
        <button
          type="button"
          onClick={() => {
            onDone()
            void skip(block, units, false)
          }}
          className="flex h-12 items-center justify-center rounded-full glass text-[15px] font-semibold"
        >
          {t('today.skip.button')}
        </button>
      )}
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

/** The sheet left the block's units as they were (keep their page ranges and minutes). */
function sameUnits(block: PlanBlockRow, unitIds: string[]) {
  const before = block.plan_block_units.map((u) => u.unit_id).sort()
  const after = [...unitIds].sort()
  return before.length === after.length && before.every((id, i) => id === after[i])
}
