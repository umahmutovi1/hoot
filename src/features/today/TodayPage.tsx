import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { format } from 'date-fns'
import { Mascot } from '@/components/Mascot'
import { Button } from '@/components/ui/button'
import { LecturePrompts } from '@/features/schedule/LecturePrompts'
import { useScheduleData } from '@/features/schedule/useScheduleData'
import { useDayBoundary, useProfile } from '@/features/settings/profile'
import { useLocale } from '@/features/settings/useLocale'
import { localDay } from '@/lib/day'
import { greetingPart } from '@/lib/greeting'
import { calendarStatus } from '@/lib/schedule'
import { dateFnsLocales } from '@/lib/locale'
import { FactCard } from './FactCard'

// Stage 1 has no subjects yet, so "Today" always shows the first-run state (DanasPrazno).
export function TodayPage() {
  const { t } = useTranslation()
  const { locale } = useLocale()
  const { data: profile } = useProfile()
  const [now] = useState(() => new Date())
  const name = profile?.display_name ?? ''
  const boundary = useDayBoundary()
  const { periods } = useScheduleData()
  const status = calendarStatus(localDay(now, boundary), periods)

  return (
    <div className="flex flex-col">
      <header className="flex flex-col gap-0.5">
        <span className="text-[13px] text-ink-muted first-letter:uppercase">
          {format(now, 'EEEE, d. MMMM', { locale: dateFnsLocales[locale] })}
          {status && ` · ${t(`today.week.${status.kind}`, status)}`}
        </span>
        <span className="text-[17px] font-semibold">
          {t(`today.greeting.${greetingPart(now.getHours())}`, { name })}
        </span>
      </header>

      <div className="mt-4 flex flex-col gap-2.5 empty:hidden">
        <LecturePrompts />
      </div>

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

      <div className="mt-10">
        <FactCard />
      </div>
    </div>
  )
}
