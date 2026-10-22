import type { ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { CalendarIcon, CapIcon, ChevronRightIcon } from '@/components/icons'
import { useCalendarFeeds } from '@/features/calendars/api'
import { GiveDocumentSheet } from '@/features/owl/GiveDocumentSheet'
import { useOwlStore } from '@/features/owl/store'
import { useScheduleData } from '@/features/schedule/useScheduleData'
import { StepTitle, type StepProps } from './OnboardingPage'

/**
 * Step 2 "Šta već imaš?": import first, so classes and other commitments are taken before the
 * free periods are picked. Each card opens the existing flow (the academic calendar through
 * `parse-document`); coming back returns to this step.
 */
export function StepImport(_props: StepProps) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const openSheet = useOwlStore((s) => s.openSheet)
  const { periodRows, timetableRows } = useScheduleData()
  const feeds = useCalendarFeeds().data ?? []

  return (
    <>
      <StepTitle title={t('onboarding.import.title')} sub={t('onboarding.import.sub')} />
      <div className="flex flex-col gap-2">
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
          sub={t('onboarding.import.timetableSub')}
          done={timetableRows.length > 0}
          onClick={() => navigate('/plan/timetable')}
        />
        <ImportCard
          icon={
            <svg
              width="22"
              height="22"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1" />
              <path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" />
            </svg>
          }
          title={t('onboarding.import.feed')}
          sub={t('onboarding.import.feedSub')}
          done={feeds.length > 0}
          onClick={() => navigate('/settings/feeds')}
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
}: {
  icon: ReactNode
  title: string
  sub: string
  done: boolean
  onClick: () => void
}) {
  const { t } = useTranslation()
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-3 rounded-[22px] glass p-3.5 text-left"
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
