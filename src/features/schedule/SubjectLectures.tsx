import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { format } from 'date-fns'
import { amountLabel, formatDuration } from '@/features/sources/format'
import { measureOf, type SourceMaterial } from '@/features/sources/model'
import { useLocale } from '@/features/settings/useLocale'
import type { SubjectWithAssessments } from '@/features/subjects/model'
import { toDisplayDate } from '@/lib/day'
import { dateFnsLocales } from '@/lib/locale'
import { sourcePace, subjectBehind, type SourcePace } from '@/lib/pace'
import { useLectureLogs } from './api'
import { clockRange } from './format'
import { useScheduleData } from './useScheduleData'
import { useWeekdayNames } from './weekdays'
import { LectureSheet } from './LectureSheet'
import { toPaceLog } from './model'

type LecturePace = SourcePace<SourceMaterial['units'][number] & { parentId: string | null }>

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
      <div className="flex flex-col gap-3 rounded-card glass p-4">
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
