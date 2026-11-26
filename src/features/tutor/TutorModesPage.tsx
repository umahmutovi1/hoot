import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { BookIcon, CheckIcon, ClockIcon, SparkleIcon } from '@/components/icons'
import { ScreenTitle } from '@/components/ScreenTitle'
import { useAiAvailability } from '@/features/owl/api'
import { useSubjects } from '@/features/subjects/api'
import { cn } from '@/lib/utils'
import { useTutor } from './context'
import { useRound } from './useRound'

function Mode({
  to,
  title,
  sub,
  className,
  subClass,
  icon,
  badge,
}: {
  to: string
  title: string
  sub: string
  className: string
  subClass: string
  icon: ReactNode
  badge?: string
}) {
  return (
    <Link
      to={to}
      className={cn(
        'flex min-h-[168px] flex-col justify-between rounded-card p-4 text-ink',
        className,
      )}
    >
      <span className="flex items-center justify-between">
        <span className="flex size-10 items-center justify-center rounded-[13px] bg-raised/65">
          {icon}
        </span>
        {badge && (
          <span className="flex h-6 items-center rounded-lg bg-raised px-2 text-xs font-bold text-brand-strong">
            {badge}
          </span>
        )}
      </span>
      <span className="flex flex-col gap-1">
        <span className="font-display text-[22px] leading-[1.1] font-bold">{title}</span>
        <span className={cn('text-[13px] leading-[1.35] font-semibold', subClass)}>{sub}</span>
      </span>
    </Link>
  )
}

/** "Kako da učimo?" (board "Tutor · izbor načina"): the four ways of studying with the tutor. */
export function TutorModesPage() {
  const ctx = useTutor()
  const { t } = useTranslation()
  const { data: subjects = [] } = useSubjects()
  const { canPrivate, state } = useAiAvailability()
  const { questions } = useRound(ctx)
  const subject = subjects.find((s) => s.id === ctx.subjectId)?.name
  const pages =
    ctx.unit.page_start !== null && ctx.unit.page_end !== null
      ? t('tutor.pages', { from: ctx.unit.page_start, to: ctx.unit.page_end })
      : null
  const info = [
    ctx.source.title,
    pages,
    questions.length > 0 ? t('tutor.questionsCount', { count: questions.length }) : null,
  ]
    .filter(Boolean)
    .join(' · ')

  return (
    <div className="flex flex-col gap-3.5">
      <ScreenTitle
        title={t('tutor.title')}
        sub={[ctx.unit.title, subject].filter(Boolean).join(' · ')}
      />
      <div className="surface flex items-center gap-3 rounded-[20px] px-3.5 py-3">
        <span
          className={cn(
            'flex size-9 shrink-0 items-center justify-center rounded-[13px]',
            ctx.hasText ? 'bg-success-soft text-success-ink' : 'bg-warning-soft text-warning-muted',
          )}
        >
          {ctx.hasText ? <CheckIcon size={18} /> : <BookIcon size={18} />}
        </span>
        <span className="flex min-w-0 flex-1 flex-col gap-px">
          <span className="text-[15px] font-bold">
            {ctx.hasText ? t('tutor.textHere') : t('tutor.noText')}
          </span>
          <span className="text-[13px] text-ink-secondary tabular-nums">
            {ctx.hasText ? info : t('tutor.noTextSub')}
          </span>
        </span>
      </div>
      {state === 'ready' && !canPrivate && (
        <p className="surface rounded-card px-4 py-3.5 text-sm text-ink-secondary">
          {t('owl.error.needs_paid')}
        </p>
      )}
      <h2 className="mt-3 px-1 font-display text-[22px] font-bold">{t('tutor.how')}</h2>
      <div className="grid grid-cols-2 gap-2.5">
        <Mode
          to="explain"
          title={t('tutor.modes.explain')}
          sub={t('tutor.modes.explainSub')}
          className="bg-subject-blue-soft"
          subClass="text-brand-strong"
          icon={<BookIcon size={20} />}
        />
        <Mode
          to="quiz"
          title={t('tutor.modes.quiz')}
          sub={t('tutor.modes.quizSub')}
          className="bg-subject-lavender-soft"
          subClass="text-subject-lavender-ink"
          icon={<CheckIcon size={20} />}
          badge={t('tutor.recommended')}
        />
        <Mode
          to="quiz?oral=1"
          title={t('tutor.modes.oral')}
          sub={t('tutor.modes.oralSub')}
          className="bg-subject-orange-soft"
          subClass="text-subject-orange-ink"
          icon={<SparkleIcon size={20} />}
        />
        <Mode
          to="feynman"
          title={t('tutor.modes.feynman')}
          sub={t('tutor.modes.feynmanSub')}
          className="bg-success-soft"
          subClass="text-success-ink"
          icon={<SparkleIcon size={20} />}
        />
      </div>
      <p className="px-1 text-[13px] leading-[1.4] text-ink-secondary">{t('tutor.ratedHint')}</p>
      <div className="flex items-center gap-2.5 rounded-[20px] bg-raised px-3.5 py-3 shadow-[inset_0_0_0_1.5px_var(--color-hairline)]">
        <ClockIcon size={18} className="shrink-0 text-ink-secondary" />
        <span className="text-sm leading-[1.35] text-ink-secondary">
          {t('tutor.timeHint')} <b className="text-ink">{t('tutor.timeTag')}</b>.
        </span>
      </div>
    </div>
  )
}
