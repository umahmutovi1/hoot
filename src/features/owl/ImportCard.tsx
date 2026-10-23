import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { useSubjects } from '@/features/subjects/api'
import type { ProposalStatus } from '@/lib/import'
import { cn } from '@/lib/utils'
import { useWeekdayNames } from '@/features/schedule/weekdays'
import { classLines, examLines, periodLines, useDateLabel } from './format'
import { NoTeachingPeriod, saveCount, useSaveImport } from './saveImport'
import { useOwlStore, type ImportProposal } from './store'

const STATUS_CLASS: Record<ProposalStatus, string> = {
  new: 'bg-success-soft text-subject-green-ink',
  changed: 'bg-warning-soft text-warning-ink',
  unchanged: 'bg-canvas text-ink-muted',
  skipped: 'bg-canvas text-ink-muted',
}

export function StatusChip({ status }: { status: ProposalStatus }) {
  const { t } = useTranslation()
  return (
    <span
      className={cn(
        'inline-flex h-6 shrink-0 items-center rounded-full px-2 text-[11px] font-semibold',
        STATUS_CLASS[status],
      )}
    >
      {t(`owl.status.${status}`)}
    </span>
  )
}

function Row({
  title,
  detail,
  previous,
  status,
}: {
  title: string
  detail: string
  previous: string | null
  status: ProposalStatus
}) {
  return (
    <div className="flex items-center gap-3 p-2.5">
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span
          className={cn(
            'text-sm font-semibold',
            (status === 'skipped' || status === 'unchanged') && 'text-ink-muted',
          )}
        >
          {title}
        </span>
        <span className="text-xs text-ink-muted">
          {previous && (
            <>
              <s>{previous}</s>
              {' → '}
            </>
          )}
          {detail}
        </span>
      </div>
      <StatusChip status={status} />
    </div>
  )
}

/** Import proposal in the conversation (SovaAgent mockup 4). */
export function ImportCard({
  messageId,
  proposal,
}: {
  messageId: string
  proposal: ImportProposal
}) {
  const { t } = useTranslation()
  const day = useDateLabel()
  const subjects = useSubjects().data ?? []
  const updateProposal = useOwlStore((s) => s.updateProposal)
  const save = useSaveImport(t)
  const weekdays = useWeekdayNames('short')
  const count = saveCount(proposal)
  const nameOf = (id: string | null) => subjects.find((s) => s.id === id)?.name

  const rows = [
    ...proposal.periods.map((p) => ({ key: p.key, status: p.status, ...periodLines(t, p, day) })),
    ...proposal.exams.map((e) => ({
      key: e.key,
      status: e.status,
      ...examLines(t, e, nameOf(e.subjectId), day),
    })),
    ...(proposal.classes ?? []).map((c) => ({
      key: c.key,
      status: c.status,
      ...classLines(t, c, nameOf(c.subjectId), (d) => weekdays[d] ?? ''),
    })),
  ]

  const onSave = () =>
    save.mutate(proposal, {
      onSuccess: (saved) => updateProposal(messageId, (p) => ({ ...p, savedCount: saved })),
    })

  return (
    <div className="flex flex-col rounded-card glass p-1.5">
      {rows.map(({ key, ...row }, i) => (
        <div key={key}>
          {i > 0 && <div className="mx-2.5 h-px bg-hairline" />}
          <Row {...row} />
        </div>
      ))}
      {proposal.savedCount !== null ? (
        <p className="px-2.5 pt-1 pb-2 text-sm font-semibold text-success">
          {t('owl.saved', { count: proposal.savedCount })}
        </p>
      ) : (
        <div className="flex gap-2 px-1 pt-2 pb-1">
          <Button
            asChild
            variant="secondary"
            size="pill-sm"
            className="h-12 flex-1 bg-brand-soft text-brand"
          >
            <Link to={`/owl/import/${messageId}`}>{t('owl.review')}</Link>
          </Button>
          <Button
            type="button"
            size="pill-sm"
            className="h-12 flex-1"
            disabled={count === 0 || save.isPending}
            onClick={onSave}
          >
            {count === 0 ? t('owl.nothingToSave') : t('owl.saveCount', { count })}
          </Button>
        </div>
      )}
      {save.isError && (
        <p className="px-2.5 pb-2 text-sm text-danger">
          {t(save.error instanceof NoTeachingPeriod ? 'owl.noTeachingPeriod' : 'owl.error.failed')}
        </p>
      )}
    </div>
  )
}
