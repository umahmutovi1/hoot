import { useEffect, useState, type ReactNode } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { CalendarIcon, CapIcon, ChevronRightIcon, DocIcon, LinkIcon } from '@/components/icons'
import { useCalendarFeeds } from '@/features/calendars/api'
import { connectGoogle, useGoogleAccount } from '@/features/calendars/google'
import { useCalendarProposals } from '@/features/calendars/matches'
import { useToast } from '@/components/toast-store'
import { GiveDocumentSheet } from '@/features/owl/GiveDocumentSheet'
import { useOwlStore } from '@/features/owl/store'
import { useScheduleData } from '@/features/schedule/useScheduleData'
import { useAcademicSearch } from '@/features/academic/search'
import { StepTitle, type StepProps } from './OnboardingPage'

/**
 * Step 2 "Šta već imaš?": import first, so classes and other commitments are taken before the
 * free periods are picked. Each card opens the existing flow (the academic calendar through
 * `parse-document`); coming back returns to this step. Google comes first: lectures and exams
 * already in the calendar are reviewed once ("Iz kalendara") instead of being entered again.
 */
export function StepImport(_props: StepProps) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const openSheet = useOwlStore((s) => s.openSheet)
  const { periodRows, timetableRows } = useScheduleData()
  const feeds = (useCalendarFeeds().data ?? []).filter((f) => f.source === 'ics')
  const found = useAcademicSearch()
  const { data: google } = useGoogleAccount()
  const fromCalendar = useCalendarProposals()
  const show = useToast((s) => s.show)
  const [params, setParams] = useSearchParams()
  const [connecting, setConnecting] = useState(false)
  // Lectures and exams already in Google: one review instead of entering them again.
  const review = () => navigate('/today/calendar', { state: { back: '/onboarding' } })
  const lectures = fromCalendar.lectures.length
  const exams = fromCalendar.exams.length

  // Back from Google's consent screen.
  const result = params.get('google')
  useEffect(() => {
    if (!result) return
    show(t(`googleCalendar.result.${result === 'connected' ? 'connected' : 'error'}`))
    setParams({}, { replace: true })
  }, [result, setParams, show, t])

  return (
    <>
      <StepTitle title={t('onboarding.import.title')} sub={t('onboarding.import.sub')} />
      {found && found.documents.length > 0 && (
        // What step 1b found on the web (AkademskaGodina.dc.html 5); reviewed before saving.
        <button
          type="button"
          onClick={() => navigate('/settings/academic/found')}
          className="glass-tint flex flex-col gap-2 rounded-card p-4 text-left"
        >
          <span className="text-xs font-semibold tracking-[0.6px] text-white/88 uppercase">
            {t('academic.found.title')}
          </span>
          <span className="text-[17px] leading-snug font-semibold">
            {t('academic.found.cardTitle', { count: found.documents.length })}
          </span>
          <span className="text-[13px] text-white/85">{t('academic.found.cardSub')}</span>
        </button>
      )}
      <div className="flex flex-col gap-2">
        {/* Google first (Stage 10d): what is already in the calendar is not entered again. */}
        <ImportCard
          icon={<CalendarIcon size={22} />}
          title={t('onboarding.import.google')}
          sub={
            !google
              ? t('onboarding.import.googleSub')
              : lectures + exams > 0
                ? t('onboarding.import.googleFound', {
                    found: [
                      lectures > 0 && t('calendarImport.cardLectures', { count: lectures }),
                      exams > 0 && t('calendarImport.cardExams', { count: exams }),
                    ]
                      .filter(Boolean)
                      .join(' · '),
                  })
                : (google.email ?? t('googleCalendar.connectedTitle'))
          }
          done={Boolean(google) && lectures + exams === 0}
          onClick={() => {
            if (google) return lectures + exams > 0 ? review() : navigate('/settings/feeds')
            setConnecting(true)
            connectGoogle('/onboarding').catch(() => {
              setConnecting(false)
              show(t('googleCalendar.result.error'))
            })
          }}
          busy={connecting}
        />
        <ImportCard
          icon={<CalendarIcon size={22} />}
          title={t('onboarding.import.calendar')}
          sub={t('onboarding.import.calendarSub')}
          done={periodRows.length > 0}
          onClick={() =>
            periodRows.length > 0 ? navigate('/settings/calendar') : openSheet('academic_calendar')
          }
        />
        <ImportCard
          icon={<CapIcon size={22} />}
          title={t('onboarding.import.timetable')}
          sub={
            timetableRows.length === 0 && lectures > 0
              ? t('onboarding.import.timetableInGoogle', { count: lectures })
              : t('onboarding.import.timetableSub')
          }
          done={timetableRows.length > 0}
          onClick={() =>
            timetableRows.length === 0 && lectures > 0 ? review() : navigate('/plan/timetable')
          }
        />
        <ImportCard
          icon={<LinkIcon size={22} />}
          title={t('onboarding.import.feed')}
          sub={t('onboarding.import.feedSub')}
          done={feeds.length > 0}
          onClick={() => navigate('/settings/feeds')}
        />
        <ImportCard
          icon={<DocIcon size={22} />}
          title={t('onboarding.import.link')}
          sub={t('onboarding.import.linkSub')}
          done={false}
          onClick={() => openSheet('auto', { link: true })}
        />
      </div>
      <span className="px-1 text-xs leading-[1.45] text-ink-muted">
        {t('onboarding.import.none')}
      </span>
      <GiveDocumentSheet />
    </>
  )
}

function ImportCard({
  icon,
  title,
  sub,
  done,
  onClick,
  busy = false,
}: {
  icon: ReactNode
  title: string
  sub: string
  done: boolean
  onClick: () => void
  busy?: boolean
}) {
  const { t } = useTranslation()
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      className="flex items-center gap-3 rounded-[22px] glass p-3.5 text-left disabled:opacity-60"
    >
      <span className="flex size-11 shrink-0 items-center justify-center rounded-[14px] bg-brand-soft text-brand">
        {icon}
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="text-[15px] font-semibold">{title}</span>
        <span className="text-xs text-ink-muted">{sub}</span>
      </span>
      {done ? (
        <span className="rounded-lg bg-success-soft px-2 py-1 text-[11px] font-semibold text-success-ink">
          {t('onboarding.import.added')}
        </span>
      ) : (
        <ChevronRightIcon size={16} className="text-ink-muted" />
      )}
    </button>
  )
}
