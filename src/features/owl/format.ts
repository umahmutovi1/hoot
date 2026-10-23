import { format } from 'date-fns'
import type { TFunction } from 'i18next'
import { useLocale } from '@/features/settings/useLocale'
import { toDisplayDate } from '@/lib/day'
import type { ClassProposal, ExamProposal, PeriodProposal } from '@/lib/import'
import { dateFnsLocales } from '@/lib/locale'
import { examTitle } from './saveImport'

// Labels for proposal rows, shared by the chat card and the full review.

export function useDateLabel() {
  const { locale } = useLocale()
  return (date: string) => format(toDisplayDate(date), 'd. MMM', { locale: dateFnsLocales[locale] })
}

export function periodLines(t: TFunction, p: PeriodProposal, day: (d: string) => string) {
  const kind =
    p.kind === 'exam'
      ? t(`calendar.session.${p.exam_session ?? 'regular'}`)
      : t(`calendar.kind.${p.kind}`)
  const range = (from: string, to: string) =>
    from === to ? day(from) : `${day(from)} – ${day(to)}`
  return {
    title: p.title,
    detail: `${kind} · ${range(p.starts_on, p.ends_on)}`,
    previous: p.previous ? range(p.previous.starts_on, p.previous.ends_on) : null,
  }
}

export function examLines(
  t: TFunction,
  e: ExamProposal,
  subjectName: string | undefined,
  day: (d: string) => string,
) {
  const when = `${day(e.date)}${e.time ? `, ${e.time}` : ''}`
  return {
    title: `${subjectName ?? e.subject_name} · ${e.existingTitle ?? examTitle(t, e)}`,
    detail: e.status === 'skipped' ? t('owl.noSubject') : when,
    previous: e.previous
      ? `${e.previous.tentative ? '~' : ''}${day(e.previous.date)}${e.previous.tentative ? ` (${t('owl.tentative')})` : ''}`
      : null,
  }
}

export function classLines(
  t: TFunction,
  c: ClassProposal,
  subjectName: string | undefined,
  weekday: (d: number) => string,
) {
  const room = c.location ? ` · ${c.location}` : ''
  const parity = c.week_parity ? ` · ${t(`timetable.parity.${c.week_parity}`)}` : ''
  return {
    title: `${subjectName ?? c.subject_name} · ${t(`timetable.kind.${c.kind}`)}`,
    detail:
      c.status === 'skipped'
        ? t('owl.noSubject')
        : `${weekday(c.weekday)} ${c.start}–${c.end}${room}${parity}`,
    previous: c.previous
      ? `${c.previous.start}–${c.previous.end}${c.previous.location ? ` · ${c.previous.location}` : ''}`
      : null,
  }
}
