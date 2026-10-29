import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { CalendarIcon, ChevronRightIcon } from '@/components/icons'

/** Danas: "Iz kalendara: 6 predavanja i 2 ispita" → the review (one of the action cards). */
export function CalendarImportCard({ lectures, exams }: { lectures: number; exams: number }) {
  const { t } = useTranslation()
  return (
    <Link to="/today/calendar" className="flex items-center gap-3 rounded-card glass p-4">
      <span
        className="icon-tile flex size-[38px] shrink-0 items-center justify-center rounded-[12px]"
        aria-hidden="true"
      >
        <CalendarIcon size={18} />
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="text-[15px] font-semibold">{t('calendarImport.cardTitle')}</span>
        <span className="text-[13px] text-ink-muted">
          {[
            lectures > 0 && t('calendarImport.cardLectures', { count: lectures }),
            exams > 0 && t('calendarImport.cardExams', { count: exams }),
          ]
            .filter(Boolean)
            .join(' · ')}
        </span>
      </span>
      <ChevronRightIcon size={18} className="text-ink-subtle" />
    </Link>
  )
}
