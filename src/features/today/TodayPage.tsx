import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { format } from 'date-fns'
import { Mascot } from '@/components/Mascot'
import { PageTitle } from '@/components/PageTitle'
import { Button } from '@/components/ui/button'
import { statusLabel } from '@/features/schedule/format'
import { LecturePrompts } from '@/features/schedule/LecturePrompts'
import { useScheduleData } from '@/features/schedule/useScheduleData'
import { useSubjects } from '@/features/subjects/api'
import { useDayBoundary, useProfile } from '@/features/settings/profile'
import { useLocale } from '@/features/settings/useLocale'
import { localDay } from '@/lib/day'
import { greetingPart } from '@/lib/greeting'
import { calendarStatus } from '@/lib/schedule'
import { dateFnsLocales } from '@/lib/locale'
import { GiveDocumentSheet } from '@/features/owl/GiveDocumentSheet'
import { OwlBar } from '@/features/owl/OwlBar'
import { useActiveSession } from '@/features/session/api'
import { ActiveSessionBar } from '@/features/session/ActiveSessionBar'
import { useSessionUi } from '@/features/session/store'
import { FactCard } from './FactCard'

// Without subjects "Today" is the first-run state (DanasPrazno); the real day plan comes with
// the scheduler (Stage 8), until then a short card links to subjects and the calendar.
// The owl bar is docked at the bottom; on the empty state the big owl and the bar owl go
// together (the one exception in MASCOT.md).
export function TodayPage() {
  const { t } = useTranslation()
  const { locale } = useLocale()
  const { data: profile } = useProfile()
  const [now] = useState(() => new Date())
  const name = profile?.display_name ?? ''
  const boundary = useDayBoundary()
  const { periods } = useScheduleData()
  const status = calendarStatus(localDay(now, boundary), periods)
  const { data: subjects } = useSubjects()
  const hasSubjects = (subjects ?? []).some((x) => !x.archived)
  const { data: activeSession } = useActiveSession()
  const startOpen = useSessionUi((s) => s.startOpen)

  return (
    <div className="flex flex-col pb-28">
      <PageTitle>{t('nav.today')}</PageTitle>
      <div className="mt-1.5 flex min-w-0 flex-col gap-0.5">
        <span className="text-[17px] font-semibold">
          {t(`today.greeting.${greetingPart(now.getHours())}`, { name })}
        </span>
        <span className="text-[13px] text-ink-muted first-letter:uppercase">
          {format(now, 'EEEE, d. MMMM', { locale: dateFnsLocales[locale] })}
          {status && (
            <>
              {' · '}
              <Link to="/settings/calendar" className="underline-offset-2 hover:underline">
                {statusLabel(t, status)}
              </Link>
            </>
          )}
        </span>
      </div>

      <div className="mt-4 flex flex-col gap-2.5 empty:hidden">
        <LecturePrompts />
      </div>

      {hasSubjects ? (
        <section className="mt-6 flex flex-col gap-2.5 rounded-card bg-surface p-4">
          <span className="text-[15px] font-semibold">{t('today.planSoonTitle')}</span>
          <span className="text-sm leading-[1.45] text-ink-muted">{t('today.planSoonBody')}</span>
          <div className="flex flex-wrap gap-2">
            <Link
              to="/subjects"
              className="flex h-10 items-center rounded-full bg-brand-soft px-4 text-sm font-semibold text-brand"
            >
              {t('nav.subjects')}
            </Link>
            <Link
              to="/plan?view=day"
              className="flex h-10 items-center rounded-full bg-brand-soft px-4 text-sm font-semibold text-brand"
            >
              {t('today.todayInCalendar')}
            </Link>
          </div>
        </section>
      ) : (
        <section className="mt-14 flex flex-col items-center gap-3.5 px-3 text-center">
          <div className="flex size-[220px] items-center justify-center rounded-full bg-mascot-halo">
            <Mascot pose="reading" size={190} alt={t('today.firstRunMascotAlt')} />
          </div>
          <h1 className="mt-2 text-[26px] leading-tight font-bold">{t('today.firstRunTitle')}</h1>
          <p className="text-[15px] leading-[1.45] text-ink-muted">{t('today.firstRunBody')}</p>
          <Button asChild size="pill" className="mt-2 px-7">
            <Link to="/subjects">{t('today.addSubject')}</Link>
          </Button>
        </section>
      )}

      <div className="mt-10">
        <FactCard />
      </div>

      {/* A running session takes the owl's place; no owl while "Šta učiš sad?" is open. */}
      {activeSession ? (
        <ActiveSessionBar data={activeSession} />
      ) : (
        !startOpen && <OwlBar empty={!hasSubjects} />
      )}
      <GiveDocumentSheet />
    </div>
  )
}
