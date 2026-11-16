import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { AiSparkIcon, ChevronRightIcon } from '@/components/icons'
import { summaryOf } from './suggestions'
import { useProposals } from './useProposals'

/** Napredak's way into Prijedlozi (board NapredakA): how many suggestions wait for a decision. */
export function ProposalsEntry() {
  const { t } = useTranslation()
  const proposals = useProposals()
  if (!proposals.ready) return null
  const { pending } = summaryOf(proposals.list)
  return (
    <Link
      to="/progress/suggestions"
      className="flex items-center gap-3.5 rounded-[28px] bg-brand-strong py-[18px] pr-4 pl-[18px] text-ground"
    >
      <span className="flex min-w-0 flex-1 flex-col gap-1.5">
        <span aria-hidden="true" className="flex items-center gap-2 text-[13px] font-bold text-ai">
          <AiSparkIcon size={16} />
          AI
        </span>
        <span className="font-display text-[22px] leading-[1.15] font-bold">
          {pending ? t('proposals.entry', { count: pending }) : t('proposals.entryNone')}
        </span>
        <span className="text-sm text-ground/80">
          {t(pending ? 'proposals.entrySub' : 'proposals.entryNoneSub')}
        </span>
      </span>
      <ChevronRightIcon size={22} className="shrink-0" />
    </Link>
  )
}
