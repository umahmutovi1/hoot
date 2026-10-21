import { useNavigate, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { BackHeader } from '@/components/BackHeader'
import { Switch } from '@/components/Switch'
import { Button } from '@/components/ui/button'
import { useSubjects } from '@/features/subjects/api'
import { assignSubject, toSave, type ExamProposal, type PeriodProposal } from '@/lib/import'
import { existingExams } from './actions'
import { examLines, periodLines, useDateLabel } from './format'
import { StatusChip } from './ImportCard'
import { useSaveImport } from './saveImport'
import { findProposal, useOwlStore } from './store'

const field =
  'h-11 min-w-0 rounded-input bg-canvas px-3 text-[15px] outline-none disabled:opacity-60'

/** Full review of an import: include or leave out items, fix dates, pick a missing subject. */
export function ImportReviewPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { id } = useParams()
  const proposal = useOwlStore((s) => findProposal(s.messages, id))
  const updateProposal = useOwlStore((s) => s.updateProposal)
  const subjects = (useSubjects().data ?? []).filter((s) => !s.archived)
  const day = useDateLabel()
  const save = useSaveImport(t)

  if (!proposal || !id) {
    return (
      <div className="flex flex-col gap-4">
        <BackHeader title={t('owl.reviewPage.title')} fallback="/chat" />
        <p className="text-sm text-ink-muted">{t('owl.reviewPage.missing')}</p>
      </div>
    )
  }

  const saved = proposal.savedCount !== null
  const count =
    toSave(proposal.periods).length + toSave(proposal.exams).filter((e) => e.subjectId).length
  const setPeriod = (key: string, patch: Partial<PeriodProposal>) =>
    updateProposal(id, (p) => ({
      ...p,
      periods: p.periods.map((x) => (x.key === key ? { ...x, ...patch } : x)),
    }))
  const setExam = (key: string, update: (e: ExamProposal) => ExamProposal) =>
    updateProposal(id, (p) => ({
      ...p,
      exams: p.exams.map((x) => (x.key === key ? update(x) : x)),
    }))

  const onSave = () =>
    save.mutate(proposal, {
      onSuccess: (n) => {
        updateProposal(id, (p) => ({ ...p, savedCount: n }))
        navigate('/chat')
      },
    })

  return (
    <div className="flex flex-col gap-4 pb-24">
      <BackHeader title={t('owl.reviewPage.title')} fallback="/chat" />
      <p className="px-1 text-sm text-ink-muted">{proposal.documentTitle}</p>

      {proposal.warnings.length > 0 && (
        <section className="flex flex-col gap-1 rounded-card bg-warning-soft p-4 text-sm text-warning-ink">
          <span className="font-semibold">{t('owl.reviewPage.warnings')}</span>
          {proposal.warnings.map((w) => (
            <span key={w}>{w}</span>
          ))}
        </section>
      )}

      {proposal.periods.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="px-1 text-[13px] font-semibold text-ink-muted uppercase">
            {t('owl.reviewPage.periods')}
          </h2>
          {proposal.periods.map((p) => {
            const lines = periodLines(t, p, day)
            const editable = !saved && p.include && p.status !== 'unchanged'
            return (
              <div key={p.key} className="flex flex-col gap-3 rounded-card glass p-4">
                <ItemHeader
                  title={lines.title}
                  detail={lines.detail}
                  previous={lines.previous}
                  status={p.status}
                  include={p.include}
                  disabled={saved || p.status === 'unchanged'}
                  onInclude={(include) => setPeriod(p.key, { include })}
                />
                {editable && (
                  <div className="grid grid-cols-2 gap-2">
                    <DateField
                      label={t('owl.reviewPage.from')}
                      value={p.starts_on}
                      onChange={(v) => setPeriod(p.key, { starts_on: v })}
                    />
                    <DateField
                      label={t('owl.reviewPage.to')}
                      value={p.ends_on}
                      min={p.starts_on}
                      onChange={(v) => setPeriod(p.key, { ends_on: v })}
                    />
                  </div>
                )}
              </div>
            )
          })}
        </section>
      )}

      {proposal.exams.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="px-1 text-[13px] font-semibold text-ink-muted uppercase">
            {t('owl.reviewPage.exams')}
          </h2>
          {proposal.exams.map((e) => {
            const subject = subjects.find((s) => s.id === e.subjectId)
            const lines = examLines(t, e, subject?.name, day)
            const editable = !saved && e.include && e.status !== 'unchanged'
            return (
              <div key={e.key} className="flex flex-col gap-3 rounded-card glass p-4">
                <ItemHeader
                  title={lines.title}
                  detail={lines.detail}
                  previous={lines.previous}
                  status={e.status}
                  include={e.include}
                  disabled={saved || e.status === 'unchanged' || !e.subjectId}
                  onInclude={(include) => setExam(e.key, (x) => ({ ...x, include }))}
                />
                {e.status === 'skipped' && !saved && (
                  <label className="flex flex-col gap-1.5">
                    <span className="text-xs font-semibold text-ink-muted">
                      {t('owl.reviewPage.pickSubject')} · {e.subject_name}
                    </span>
                    <select
                      className={field}
                      value=""
                      onChange={(ev) =>
                        ev.target.value &&
                        setExam(e.key, (x) =>
                          assignSubject(x, ev.target.value, existingExams(subjects)),
                        )
                      }
                    >
                      <option value="">{t('owl.reviewPage.skipSubject')}</option>
                      {subjects.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
                {editable && e.subjectId && (
                  <div className="grid grid-cols-[1fr_auto] gap-2">
                    <DateField
                      label={t('owl.reviewPage.date')}
                      value={e.date}
                      onChange={(v) => setExam(e.key, (x) => ({ ...x, date: v }))}
                    />
                    <label className="flex flex-col gap-1.5">
                      <span className="text-xs font-semibold text-ink-muted">
                        {t('owl.reviewPage.time')}
                      </span>
                      <input
                        type="time"
                        className={field}
                        value={e.time ?? ''}
                        onChange={(ev) =>
                          setExam(e.key, (x) => ({ ...x, time: ev.target.value || null }))
                        }
                      />
                    </label>
                  </div>
                )}
              </div>
            )
          })}
        </section>
      )}

      {!saved && (
        <div className="fixed inset-x-0 bottom-[calc(16px+env(safe-area-inset-bottom))] z-30 flex justify-center px-5">
          <Button
            type="button"
            size="pill"
            className="w-full max-w-[390px] shadow-[0_6px_24px_rgba(47,35,99,0.2)]"
            disabled={count === 0 || save.isPending}
            onClick={onSave}
          >
            {count === 0 ? t('owl.nothingToSave') : t('owl.saveCount', { count })}
          </Button>
        </div>
      )}
      {save.isError && <p className="text-sm text-danger">{t('owl.error.failed')}</p>}
    </div>
  )
}

function ItemHeader(props: {
  title: string
  detail: string
  previous: string | null
  status: Parameters<typeof StatusChip>[0]['status']
  include: boolean
  disabled: boolean
  onInclude: (include: boolean) => void
}) {
  const { t } = useTranslation()
  return (
    <div className="flex items-start gap-3">
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="text-[15px] font-semibold">{props.title}</span>
        <span className="text-xs text-ink-muted">
          {props.previous && (
            <>
              <s>{props.previous}</s>
              {' → '}
            </>
          )}
          {props.detail}
        </span>
        <span className="self-start">
          <StatusChip status={props.status} />
        </span>
      </div>
      <Switch
        checked={props.include}
        disabled={props.disabled}
        onChange={props.onInclude}
        label={t('owl.reviewPage.include')}
      />
    </div>
  )
}

function DateField(props: {
  label: string
  value: string
  min?: string
  onChange: (value: string) => void
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs font-semibold text-ink-muted">{props.label}</span>
      <input
        type="date"
        className={field}
        value={props.value}
        min={props.min}
        onChange={(e) => e.target.value && props.onChange(e.target.value)}
      />
    </label>
  )
}
