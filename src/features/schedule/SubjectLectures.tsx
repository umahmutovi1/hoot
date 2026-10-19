import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { format } from 'date-fns'
import { CheckIcon, WarningIcon } from '@/components/icons'
import { amountLabel, formatDuration } from '@/features/sources/format'
import { measureOf, type SourceMaterial } from '@/features/sources/model'
import { useLocale } from '@/features/settings/useLocale'
import { useUpdateSubject } from '@/features/subjects/api'
import type { SubjectWithAssessments } from '@/features/subjects/model'
import { toDisplayDate } from '@/lib/day'
import { dateFnsLocales } from '@/lib/locale'
import {
  NEEDS_PLAN,
  paceActions,
  sourcePace,
  subjectBehind,
  type PaceAction,
  type SourcePace,
} from '@/lib/pace'
import { useLectureLogs } from './api'
import { clockRange } from './format'
import { useScheduleData } from './useScheduleData'
import { useWeekdayNames } from './weekdays'
import { LectureSheet } from './LectureSheet'
import { toPaceLog } from './model'

type LecturePace = SourcePace<SourceMaterial['units'][number] & { parentId: string | null }>

const LATER_KEY = 'hoot.pace.later'
const LATER_DAYS = 3

function hiddenUntil(subjectId: string): number {
  try {
    const all = JSON.parse(localStorage.getItem(LATER_KEY) ?? '{}') as Record<string, number>
    return all[subjectId] ?? 0
  } catch {
    return 0
  }
}

function hideFor3Days(subjectId: string) {
  try {
    const all = JSON.parse(localStorage.getItem(LATER_KEY) ?? '{}') as Record<string, number>
    all[subjectId] = Date.now() + LATER_DAYS * 86_400_000
    localStorage.setItem(LATER_KEY, JSON.stringify(all))
  } catch {
    // Storage blocked: the card shows again next time.
  }
}

/** Predavanja on Predmet: where the lectures are, where you are, how far behind. */
export function SubjectLectures({
  subject,
  materials,
}: {
  subject: SubjectWithAssessments
  materials: SourceMaterial[]
}) {
  const { t } = useTranslation()
  const { data: logRows = [] } = useLectureLogs()
  const [sheetOpen, setSheetOpen] = useState(false)
  const logs = logRows.filter((l) => l.subject_id === subject.id).map(toPaceLog)
  const paces = materials
    .map((m) => ({
      material: m,
      pace: sourcePace(
        m.units.map((u) => ({ ...u, parentId: u.parent_id })),
        logs.filter((l) => l.sourceId === m.source.id),
      ),
    }))
    .filter((p): p is { material: SourceMaterial; pace: LecturePace } => p.pace !== null)
  const behind = subjectBehind(paces.map((p) => p.pace))
  // "15 str. (Oppenheim) · 4 pitanja": behind in each source's own measure.
  const behindText = paces
    .filter((p) => p.pace.behindAmount > 0)
    .map(
      (p) =>
        amountLabel(t, measureOf(p.material.source), p.pace.behindAmount) +
        (paces.length > 1 ? ` (${p.material.source.title})` : ''),
    )
    .join(' · ')
  const { classes } = useScheduleData()
  const short = useWeekdayNames('short')
  const own = classes
    .filter((c) => c.subjectId === subject.id)
    .sort((a, b) => a.weekday - b.weekday || a.startMin - b.startMin)

  return (
    <>
      <div className="flex flex-col gap-3 rounded-card bg-surface p-4">
        <div className="flex items-center justify-between">
          <span className="text-base font-semibold">{t('lectures.section')}</span>
          <Link to="/plan/timetable" className="py-2.5 text-[13px] font-medium text-brand">
            {t('lectures.timetableLink')} ›
          </Link>
        </div>
        {own.length > 0 && (
          <Link to="/plan/timetable" className="flex flex-wrap gap-1.5">
            {own.map((c) => (
              <span
                key={c.id}
                className="flex h-7 items-center rounded-full bg-canvas px-2.5 text-xs font-semibold"
              >
                {short[c.weekday]} {clockRange(c.startMin, c.endMin)} ·{' '}
                {t(`timetable.kind.${c.kind}`).toLowerCase()}
              </span>
            ))}
          </Link>
        )}
        {paces.length === 0 ? (
          <span className="text-sm leading-[1.4] text-ink-muted">{t('lectures.empty')}</span>
        ) : (
          paces.map(({ material, pace }) => (
            <PaceRow
              key={material.source.id}
              title={paces.length > 1 ? material.source.title : undefined}
              pace={pace}
            />
          ))
        )}
        {paces.length > 0 && (
          <div className="flex flex-col gap-0.5">
            <span
              className={
                behind.behindMinutes > 0
                  ? 'text-[15px] font-semibold text-warning'
                  : 'text-[15px] font-semibold text-success'
              }
            >
              {behind.behindMinutes > 0
                ? t('lectures.behind', { amount: behindText })
                : t('lectures.upToDate')}
            </span>
            {behind.behindMinutes > 0 && (
              <span className="text-xs text-ink-muted">
                {t('lectures.behindTime', { time: formatDuration(t, behind.behindMinutes) })}
              </span>
            )}
          </div>
        )}
        <button
          type="button"
          onClick={() => setSheetOpen(true)}
          className="flex h-12 items-center justify-center rounded-full border-2 border-brand text-[15px] font-semibold"
        >
          {t('lectures.add')}
        </button>
      </div>
      <PaceWarning subject={subject} behind={behind} behindText={behindText} />
      <LectureSheet
        subjectId={subject.id}
        subjectName={subject.name}
        open={sheetOpen}
        onOpenChange={setSheetOpen}
      />
    </>
  )
}

function PaceRow({ title, pace }: { title?: string; pace: LecturePace }) {
  const { t } = useTranslation()
  const { locale } = useLocale()
  const name = (u: { label: string | null; title: string } | null) =>
    u ? (u.label ? t('lectures.chapter', { label: u.label }) : u.title) : t('lectures.notYet')
  const youPct = (100 * pace.youIndex) / pace.topCount
  const lecturePct = (100 * pace.lectureIndex) / pace.topCount
  const gap = Math.max(0, lecturePct - youPct)

  return (
    <div className="flex flex-col gap-1">
      {title && <span className="text-xs font-semibold text-ink-muted">{title}</span>}
      <span className="text-sm leading-[1.4]">
        {t('lectures.atLecture')} <b>{name(pace.lectureAt)}</b> (
        {format(toDisplayDate(pace.latest.onDate), 'd. MMM', { locale: dateFnsLocales[locale] })}) ·{' '}
        {t('lectures.you')} <b>{name(pace.youAt)}</b>
      </span>
      <div
        role="img"
        aria-label={t('lectures.barLabel', {
          you: pace.youIndex,
          lecture: pace.lectureIndex,
          total: pace.topCount,
        })}
        className="relative mt-1 h-3.5 rounded-full bg-canvas"
      >
        <div
          className="absolute top-0 left-0 h-3.5 rounded-l-full bg-brand-accent"
          style={{ width: `${youPct}%` }}
        />
        {gap > 0 && (
          <div
            className="absolute top-0 h-3.5 bg-[repeating-linear-gradient(135deg,var(--color-behind)_0_6px,var(--color-behind-soft)_6px_12px)]"
            style={{ left: `${youPct}%`, width: `${gap}%` }}
          />
        )}
        <div
          className="absolute -top-[5px] h-6 w-1 rounded-sm bg-warning"
          style={{ left: `calc(${lecturePct}% - 2px)` }}
        />
      </div>
      <div className="relative h-4 text-[11px] text-ink-muted">
        <span className="absolute left-0">{t('lectures.youShort', { n: pace.youIndex })}</span>
        <span
          className="absolute -translate-x-1/2 font-semibold whitespace-nowrap text-warning-muted"
          style={{ left: `${Math.min(80, Math.max(20, lecturePct))}%` }}
        >
          {t('lectures.lectureShort', { n: pace.lectureIndex })}
        </span>
        <span className="absolute right-0">{pace.topCount}</span>
      </div>
    </div>
  )
}

/** "Zaostaješ 3 predavanja" with the actions that work before the scheduler exists. */
function PaceWarning({
  subject,
  behind,
  behindText,
}: {
  subject: SubjectWithAssessments
  behind: ReturnType<typeof subjectBehind>
  behindText: string
}) {
  const { t } = useTranslation()
  const update = useUpdateSubject()
  const [hidden, setHidden] = useState(() => hiddenUntil(subject.id) > Date.now())
  const [done, setDone] = useState<string | null>(null)
  const actions = paceActions(behind, {
    priority: subject.priority,
    studyMode: subject.study_mode === 'campaign' ? 'campaign' : 'regular',
  }).filter((a) => !NEEDS_PLAN.has(a))

  if (done)
    return (
      <div className="flex items-center gap-2.5 rounded-[20px] bg-success-soft px-4 py-3.5">
        <CheckIcon size={20} strokeWidth={2.2} className="text-success" />
        <span className="text-sm text-subject-green-ink">{done}</span>
      </div>
    )
  if (hidden || actions.length === 0) return null

  const apply = (a: PaceAction) => {
    if (a === 'raise_priority') {
      const priority = Math.min(5, subject.priority + 1)
      update.mutate({ id: subject.id, patch: { priority } })
      setDone(t('lectures.done.raise_priority', { n: priority }))
    } else if (a === 'switch_to_regular') {
      update.mutate({ id: subject.id, patch: { study_mode: 'regular', campaign_start_on: null } })
      setDone(t('lectures.done.switch_to_regular'))
    }
  }

  return (
    <div className="flex flex-col gap-3 rounded-card bg-warning-soft p-4">
      <div className="flex items-start gap-3">
        <WarningIcon size={22} className="mt-px shrink-0 text-warning" />
        <div className="flex flex-col gap-0.5">
          <span className="text-[15px] font-semibold text-warning-ink">
            {behind.behindLectures > 0
              ? t('lectures.warnLectures', { count: behind.behindLectures })
              : t('lectures.behind', { amount: behindText })}
          </span>
          <span className="text-[13px] leading-[1.4] text-warning-muted">
            {t('lectures.warnBody', {
              amount: behindText,
              time: formatDuration(t, behind.behindMinutes),
            })}
          </span>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        {actions.map((a, i) => (
          <button
            key={a}
            type="button"
            onClick={() => apply(a)}
            className={
              i === 0
                ? 'h-10 rounded-full bg-warning-ink px-3.5 text-[13px] font-semibold text-white'
                : 'h-10 rounded-full bg-surface px-3.5 text-[13px] font-semibold text-warning-ink'
            }
          >
            {t(`lectures.action.${a}`, { n: Math.min(5, subject.priority + 1) })}
          </button>
        ))}
        <button
          type="button"
          onClick={() => {
            hideFor3Days(subject.id)
            setHidden(true)
          }}
          className="h-10 rounded-full px-3.5 text-[13px] font-semibold text-warning-ink"
        >
          {t('lectures.later')}
        </button>
      </div>
    </div>
  )
}
