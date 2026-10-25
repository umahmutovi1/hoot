import { useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { differenceInCalendarDays } from 'date-fns'
import { EmptyCard } from '@/components/EmptyCard'
import { ArchiveIcon, CalendarIcon, ChevronRightIcon, PlusIcon } from '@/components/icons'
import { SwipeRow } from '@/components/SwipeRow'
import { useToast } from '@/components/toast-store'
import { PageTitle } from '@/components/PageTitle'
import { subjectTerm, useAcademicTerm, useAddAcademicYear } from '@/features/academic/api'
import { usePlanUi } from '@/features/plan/ui'
import { useProfile } from '@/features/settings/profile'
import { useLocale } from '@/features/settings/useLocale'
import { groupSubjects, isWinter, newYearOffer, type SubjectGroup } from '@/lib/academic'
import { addDays } from '@/lib/day'
import { dateFnsLocales } from '@/lib/locale'
import { cn } from '@/lib/utils'
import { useArchiveSubject, useSubjects } from './api'
import { paletteOf } from './colors'
import { examDateLabel, relativeDays } from './format'
import { nextAssessment, type SubjectWithAssessments } from './model'

/**
 * Predmeti: active subjects by academic year and semester (Stage 10c, AkademskaGodina.dc.html):
 * the current semester open, an unpassed older subject in it as "prenesen", other semesters
 * folded; archived ones behind a toggle. Swipe left archives a subject (Stage 10b), with undo.
 */
export function SubjectsPage() {
  const { t } = useTranslation()
  const { data: subjects = [], isPending } = useSubjects()
  const [showArchived, setShowArchived] = useState(false)
  const [now] = useState(() => new Date())
  const term = useAcademicTerm()
  const active = subjects.filter((s) => !s.archived)
  const archived = subjects.filter((s) => s.archived)
  const grouped = groupSubjects(
    active.map((s) => ({ ...subjectTerm(s, term.today), subject: s })),
    term.years,
    term.current ? { yearId: term.current.year.id, semester: term.current.semester } : null,
  )
  const card = (s: SubjectWithAssessments, carried = false) => (
    <ArchivableCard key={s.id} subject={s} now={now} carried={carried} />
  )
  const activeLabel = t('subjects.activeCount', { count: active.length })

  return (
    <div className="flex flex-col">
      <PageTitle
        actions={
          <Link
            to="/subjects/new"
            className="btn-primary flex h-11 items-center gap-1.5 rounded-full px-4 text-sm font-semibold"
          >
            <PlusIcon size={16} />
            {t('subjects.new')}
          </Link>
        }
      >
        {t('subjects.title')}
      </PageTitle>
      <p className="mt-1.5 mb-4 text-sm text-ink-secondary">
        {!isPending &&
          (term.current
            ? t('academic.subtitle', {
                active: activeLabel,
                n: term.current.semester,
                year: term.current.year.label,
              })
            : activeLabel)}
      </p>

      <div className="flex flex-col gap-3">
        <NewYearCard />
        {!isPending && active.length === 0 && <EmptyCard>{t('subjects.empty')}</EmptyCard>}
        {term.years.length > 0 ? (
          <>
            {grouped.current && (
              <h2 className="px-1 pt-1 text-[13px] font-semibold text-ink-muted uppercase">
                {t('academic.group.current', {
                  n: grouped.current.semester,
                  season: t(
                    isWinter(grouped.current.semester ?? 1)
                      ? 'academic.season.winter'
                      : 'academic.season.summer',
                  ),
                  year: grouped.current.year.label,
                })}
              </h2>
            )}
            {grouped.current?.items.map((i) => card(i.subject.subject, i.carried))}
            {grouped.later.length > 0 && <SectionLabel>{t('academic.group.later')}</SectionLabel>}
            {grouped.later.map((g) => (
              <FoldedGroup key={g.key} group={g} render={card} />
            ))}
            {(grouped.earlier.length > 0 || grouped.none.length > 0) && (
              <SectionLabel>{t('academic.group.earlier')}</SectionLabel>
            )}
            {grouped.earlier.map((g) => (
              <FoldedGroup key={g.key} group={g} render={card} />
            ))}
            {grouped.none.length > 0 && (
              <Folded
                title={t('academic.group.none')}
                sub={t('academic.group.noneSub', { count: grouped.none.length })}
              >
                {grouped.none.map((s) => card(s.subject))}
              </Folded>
            )}
          </>
        ) : (
          // Without academic years the list stays flat.
          grouped.none.map((s) => card(s.subject))
        )}
        {archived.length > 0 && (
          <button
            type="button"
            onClick={() => setShowArchived((v) => !v)}
            aria-expanded={showArchived}
            className="h-[52px] rounded-full border border-dashed border-line text-sm font-medium text-ink-muted"
          >
            {t('subjects.archived', { count: archived.length })}
          </button>
        )}
        {showArchived && archived.map((s) => <SubjectCard key={s.id} subject={s} now={now} />)}
      </div>
    </div>
  )
}

function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <h2 className="px-1 pt-2 text-[13px] font-semibold text-ink-muted uppercase">{children}</h2>
  )
}

function FoldedGroup<S extends { subject: SubjectWithAssessments }>({
  group,
  render,
}: {
  group: SubjectGroup<S>
  render: (s: SubjectWithAssessments) => ReactNode
}) {
  const { t } = useTranslation()
  return (
    <Folded
      title={
        group.semester
          ? t('academic.group.row', { n: group.semester })
          : t('academic.group.rowNoSemester')
      }
      sub={t('academic.group.rowSub', { year: group.year.label, count: group.items.length })}
    >
      {group.items.map((i) => render(i.subject.subject))}
    </Folded>
  )
}

/** A folded semester: one row, tap opens its subjects in place. */
function Folded({ title, sub, children }: { title: string; sub: string; children: ReactNode }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex min-h-[52px] items-center justify-between gap-3 rounded-card-lg glass px-[18px] text-left text-[15px]"
      >
        <span>
          {title} <span className="text-[13px] text-ink-muted">· {sub}</span>
        </span>
        <ChevronRightIcon
          size={16}
          className={cn('shrink-0 text-ink-muted transition-transform', open && 'rotate-90')}
        />
      </button>
      {open && children}
    </>
  )
}

/** "Nova akademska godina — dodati 2027/28?": one tap adds it; "Kasnije" hides it for a week. */
function NewYearCard() {
  const { t } = useTranslation()
  const term = useAcademicTerm()
  const add = useAddAcademicYear()
  const { snoozed, snooze } = usePlanUi()
  const show = useToast((s) => s.show)
  const institution = useProfile().data?.institution
  const offer = newYearOffer(term.years, term.today)
  if (!offer) return null
  const key = `new-year:${offer.label}`
  if ((snoozed[key] ?? '') >= term.today) return null
  const previous = [...term.years].sort((a, b) => (a.startsOn < b.startsOn ? 1 : -1))[0]
  return (
    <div className="flex flex-col gap-3 rounded-card glass p-4">
      <div className="flex items-start gap-3">
        <span
          className="icon-tile flex size-[38px] shrink-0 items-center justify-center rounded-[12px]"
          aria-hidden="true"
        >
          <CalendarIcon size={18} />
        </span>
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="text-[15px] font-semibold">
            {t('academic.newYear.title', { label: offer.label })}
          </span>
          <span className="text-[13px] leading-[1.35] text-ink-muted">
            {t('academic.newYear.sub', { previous: previous?.label ?? '' })}
          </span>
        </span>
      </div>
      <div className="flex gap-2">
        <button
          type="button"
          className="btn-primary flex min-h-11 flex-1 items-center justify-center rounded-full px-4 text-sm font-semibold"
          onClick={() => {
            add.mutate({
              year: { id: crypto.randomUUID(), ...offer },
              first: false,
              semesterNo: null,
            })
            show(t('academic.newYear.added', { label: offer.label }))
          }}
        >
          {t('academic.newYear.add', { label: offer.label })}
        </button>
        <button
          type="button"
          className="flex min-h-11 items-center rounded-full bg-canvas px-4 text-sm font-semibold text-brand"
          onClick={() => snooze(key, addDays(term.today, 6))}
        >
          {t('suggestions.later')}
        </button>
      </div>
      {institution && offer.yearOfStudy && (
        <Link
          to="/settings/academic/found?search=1"
          className="text-[13px] font-semibold text-brand"
        >
          {t('academic.newYear.search', { year: offer.yearOfStudy })}
        </Link>
      )}
    </div>
  )
}

function ArchivableCard({
  subject,
  now,
  carried,
}: {
  subject: SubjectWithAssessments
  now: Date
  carried: boolean
}) {
  const { t } = useTranslation()
  const archive = useArchiveSubject()
  const show = useToast((s) => s.show)
  return (
    <SwipeRow
      className="rounded-card-lg"
      actions={[
        {
          id: 'archive',
          label: t('swipe.archive'),
          tone: 'archive',
          icon: <ArchiveIcon size={18} />,
          run: () => {
            archive.mutate({ id: subject.id, archived: true })
            show(t('swipe.subjectArchived'), {
              label: t('today.cant.undo'),
              run: () => archive.mutate({ id: subject.id, archived: false }),
            })
          },
        },
      ]}
    >
      <SubjectCard subject={subject} now={now} carried={carried} />
    </SwipeRow>
  )
}

function SubjectCard({
  subject,
  now,
  carried = false,
}: {
  subject: SubjectWithAssessments
  now: Date
  carried?: boolean
}) {
  const { t } = useTranslation()
  const { locale } = useLocale()
  const palette = paletteOf(subject.color)
  const next = nextAssessment(subject.assessments, now)

  return (
    <Link
      to={`/subjects/${subject.id}`}
      className={cn(
        'flex flex-col gap-3.5 rounded-card-lg glass p-[18px]',
        subject.archived && 'opacity-70',
      )}
    >
      <div className="flex items-center gap-3">
        <div
          aria-hidden="true"
          className={cn(
            'flex size-12 shrink-0 items-center justify-center rounded-[16px] text-lg font-bold',
            palette.soft,
            palette.deepText,
          )}
        >
          {subject.name.trim().charAt(0).toUpperCase()}
        </div>
        <span className="flex-1 text-[17px] font-semibold">{subject.name}</span>
        {carried && (
          <span className="flex h-6 shrink-0 items-center rounded-full bg-warning-soft px-2.5 text-xs font-semibold text-warning-ink">
            {t('academic.group.carried')}
          </span>
        )}
      </div>
      <div className="flex justify-between gap-3 text-[13px]">
        <span className="text-ink-muted">
          {next
            ? `${next.title} · ${examDateLabel(next, dateFnsLocales[locale])}`
            : t('subjects.noUpcomingExam')}
        </span>
        {next && (
          <span className={cn('font-semibold', palette.deepText)}>
            {relativeDays(t, differenceInCalendarDays(new Date(next.at), now))}
          </span>
        )}
      </div>
    </Link>
  )
}
