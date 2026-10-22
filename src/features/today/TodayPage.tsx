import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { format } from 'date-fns'
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
import { ExamTiles } from './ExamTiles'
import { FactCard } from './FactCard'
import { NextCard } from './NextCard'

// "Znaš li?" is switched off for now: Today gets crowded once the plan and its cards arrive
// (decision after Stage 7). The card and the facts stay; set to true to bring it back.
const SHOW_FACT_CARD = false

// Without subjects "Today" is the first-run state (DanasPrazno). With subjects the "Sljedeće" card
// leads (a free session until the scheduler in Stage 8b), then lecture prompts and the next exams.
// The assistant lives in the AI tab, so there is no owl bar here any more.
export function TodayPage() {
  const { t } = useTranslation()
  const { locale } = useLocale()
  const { data: profile } = useProfile()
  const [now] = useState(() => new Date())
  const name = profile?.display_name ?? ''
  const boundary = useDayBoundary()
  const { periods } = useScheduleData()
  const status = calendarStatus(localDay(now, boundary), periods)
  const { data: subjects, isPending } = useSubjects()
  const hasSubjects = (subjects ?? []).some((x) => !x.archived)
  // Without a cached copy the first load would flash the first-run state before the subjects come.
  const firstRun = !isPending && !hasSubjects

  return (
    <div className="flex flex-col pb-8">
      <div className="mt-1.5 flex flex-col gap-0.5 px-1">
        <span className="text-[13px] font-semibold tracking-[0.2px] text-ink-secondary">
          <span className="uppercase">
            {format(now, 'EEEE, d. MMMM', { locale: dateFnsLocales[locale] })}
          </span>
          {status && (
            <>
              {' · '}
              <Link to="/settings/calendar" className="text-brand">
                {statusLabel(t, status)}
              </Link>
            </>
          )}
        </span>
        <h1 className="text-[36px] leading-[1.1] font-bold tracking-[-0.9px]">{t('nav.today')}</h1>
        {firstRun && (
          <span className="mt-1 text-[17px] font-semibold">
            {t(`today.greeting.${greetingPart(now.getHours())}`, { name })}
          </span>
        )}
      </div>

      {hasSubjects ? (
        <>
          <div className="mt-4">
            <NextCard />
          </div>
          <div className="mt-3 flex flex-col gap-2.5 empty:hidden">
            <LecturePrompts />
          </div>
          <p className="mt-3 rounded-[20px] bg-white/28 px-3.5 py-3 text-[13px] leading-[1.4] text-ink-secondary">
            {t('today.planSoonBody')}{' '}
            <Link to="/plan?view=day" className="font-semibold text-brand">
              {t('today.todayInCalendar')}
            </Link>
          </p>
          <ExamTiles now={now} />
        </>
      ) : firstRun ? (
        <section className="mt-16 flex flex-col items-center gap-3.5 px-3 text-center">
          <h2 className="text-[26px] leading-tight font-bold">{t('today.firstRunTitle')}</h2>
          <p className="text-[15px] leading-[1.45] text-ink-secondary">{t('today.firstRunBody')}</p>
          <Link
            to="/subjects/new"
            className="btn-primary mt-2 flex h-14 items-center rounded-full px-7 text-base font-semibold"
          >
            {t('today.addSubject')}
          </Link>
        </section>
      ) : null}

      {SHOW_FACT_CARD && (
        <div className="mt-10">
          <FactCard />
        </div>
      )}
    </div>
  )
}
