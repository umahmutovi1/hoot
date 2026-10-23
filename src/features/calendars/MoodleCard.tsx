import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { CalendarIcon, ChevronRightIcon } from '@/components/icons'
import type { DeadlineProposal } from '@/lib/import'

/** Danas: "3 nova roka iz Moodlea" → the review. One of the action cards (one shown at a time). */
export function MoodleCard({ proposals }: { proposals: DeadlineProposal[] }) {
  const { t } = useTranslation()
  const changed = proposals.filter((p) => p.status === 'changed').length
  return (
    <Link to="/today/moodle" className="flex items-center gap-3 rounded-card glass p-4">
      <span
        className="icon-tile flex size-[38px] shrink-0 items-center justify-center rounded-[12px]"
        aria-hidden="true"
      >
        <CalendarIcon size={18} />
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="text-[15px] font-semibold">
          {t('moodle.card', { count: proposals.length })}
        </span>
        <span className="text-[13px] text-ink-muted">
          {changed > 0 ? t('moodle.cardChanged', { count: changed }) : t('moodle.cardSub')}
        </span>
      </span>
      <ChevronRightIcon size={18} className="text-ink-subtle" />
    </Link>
  )
}
