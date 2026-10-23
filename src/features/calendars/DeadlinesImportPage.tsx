import { format } from 'date-fns'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ScreenTitle } from '@/components/ScreenTitle'
import { Button } from '@/components/ui/button'
import { useLocale } from '@/features/settings/useLocale'
import { useSubjects } from '@/features/subjects/api'
import type { DeadlineProposal } from '@/lib/import'
import { dateFnsLocales } from '@/lib/locale'
import { cn } from '@/lib/utils'
import { useApplyDeadlines, useDeadlineProposals } from './moodle'

const TAG: Record<'new' | 'changed' | 'skip', string> = {
  new: 'text-success',
  changed: 'text-brand',
  skip: 'text-ink-muted',
}

/** Rokovi iz Moodlea: novo / izmijenjeno / preskačem before anything goes into `deadlines`. */
export function DeadlinesImportPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { locale } = useLocale()
  const proposals = useDeadlineProposals()
  const subjects = (useSubjects().data ?? []).filter((s) => !s.archived)
  const apply = useApplyDeadlines()
  const [skip, setSkip] = useState<Set<string>>(new Set())
  const [subjectOf, setSubjectOf] = useState<Record<string, string | null>>({})
  const when = (iso: string) =>
    format(new Date(iso), 'EEE d. MMM, HH:mm', { locale: dateFnsLocales[locale] })

  const rows: DeadlineProposal[] = proposals.map((p) => ({
    ...p,
    include: !skip.has(p.key),
    subjectId: p.key in subjectOf ? subjectOf[p.key]! : p.subjectId,
  }))
  const count = rows.filter((r) => r.include).length

  return (
    <div className="flex flex-col gap-3.5 pb-6">
      <ScreenTitle title={t('moodle.title')} />
      <span className="text-[13px] text-ink-muted">{t('moodle.lead')}</span>

      {rows.length === 0 ? (
        <p className="rounded-card glass p-4 text-sm text-ink-muted">{t('moodle.none')}</p>
      ) : (
        <div className="flex flex-col rounded-card glass p-1.5">
          {rows.map((r, i) => {
            const state = r.include ? r.status : 'skip'
            return (
              <div
                key={r.key}
                className={cn(
                  'flex flex-col gap-2 px-2.5 py-3',
                  i < rows.length - 1 && 'border-b border-canvas',
                  !r.include && 'opacity-55',
                )}
              >
                <div className="flex items-center gap-2">
                  <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className={cn('text-[10px] font-bold uppercase', TAG[state])}>
                      {t(`moodle.tag.${state}`)}
                    </span>
                    <span className="text-sm leading-[1.3] font-semibold">{r.title}</span>
                    <span className="text-xs text-ink-muted">
                      {r.previousDueAt && (
                        <>
                          <s>{when(r.previousDueAt)}</s>
                          {' → '}
                        </>
                      )}
                      {when(r.dueAt)}
                    </span>
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      setSkip((s) => {
                        const n = new Set(s)
                        if (r.include) n.add(r.key)
                        else n.delete(r.key)
                        return n
                      })
                    }
                    aria-label={t(r.include ? 'moodle.skipAria' : 'moodle.restoreAria', {
                      title: r.title,
                    })}
                    className="h-11 shrink-0 rounded-full bg-white/60 px-3.5 text-[13px] font-semibold text-brand"
                  >
                    {t(r.include ? 'moodle.skip' : 'moodle.restore')}
                  </button>
                </div>
                {r.include && r.status === 'new' && (
                  <select
                    aria-label={t('moodle.subject', { title: r.title })}
                    value={r.subjectId ?? ''}
                    onChange={(e) =>
                      setSubjectOf((x) => ({ ...x, [r.key]: e.target.value || null }))
                    }
                    className="h-11 min-w-0 rounded-input bg-canvas px-3 text-sm outline-none"
                  >
                    <option value="">
                      {t('moodle.noSubject')}
                      {r.category ? ` · ${r.category}` : ''}
                    </option>
                    {subjects.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            )
          })}
        </div>
      )}

      <span className="px-1 text-xs text-ink-muted">{t('moodle.hint')}</span>
      {rows.length > 0 && (
        <Button
          type="button"
          size="pill"
          disabled={apply.isPending}
          className="mt-1 btn-primary"
          onClick={async () => {
            await apply.mutateAsync(rows)
            navigate('/', { replace: true })
          }}
        >
          {count === 0 ? t('moodle.skipAll') : t('moodle.apply', { count })}
        </Button>
      )}
      {apply.isError && <p className="text-sm text-danger">{t('owl.error.failed')}</p>}
    </div>
  )
}
