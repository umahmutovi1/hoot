import { useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { goBack } from '@/app/navigation'
import { ChevronLeftIcon } from '@/components/icons'
import { SplashScreen } from '@/components/SplashScreen'
import { useToast } from '@/components/toast-store'
import { useAllSources, useQuestionLinks, useTopicLinks } from '@/features/plan/api'
import { useSubjects } from '@/features/subjects/api'
import type { DirectLink } from '@/lib/questions/links'
import type { Op } from '@/lib/sync'
import { useCardsOf, useReviewWriter } from './api'
import type { CardReview, UnitReview } from './apply'
import {
  answered,
  EMPTY_ANSWERS,
  gateReviews,
  gateTargets,
  linkedQuestions,
  type GateAnswers,
} from './gate'
import { GateTest } from './GateTest'

/**
 * RecallGate (PRD "Recall gate"): `?units=` are the units just read (or one chapter tested from
 * Jedinica), `?session=` the session they were read in, `?to=` where to go after. Each chapter is
 * one test; "Spasi" writes every rating, "Preskoči" keeps what was rated and records the rest as
 * skipped (their check of what was read stays in 2 days).
 */
export function RecallGatePage() {
  const [params] = useSearchParams()
  const ids = useMemo(() => (params.get('units') ?? '').split(',').filter(Boolean), [params])
  const { data: sources } = useAllSources()
  const { data: links } = useTopicLinks()
  const { data: direct } = useQuestionLinks()
  const { data: cards, isPending: cardsPending } = useCardsOf(ids)
  if (!sources || !links || !direct || (ids.length > 0 && cardsPending)) return <SplashScreen />
  return (
    <Gate
      ids={ids}
      sessionId={params.get('session')}
      to={params.get('to') ?? '/'}
      sources={sources}
      links={links}
      direct={direct}
      cards={cards ?? []}
    />
  )
}

function Gate({
  ids,
  sessionId,
  to,
  sources,
  links,
  direct,
  cards,
}: {
  ids: string[]
  sessionId: string | null
  to: string
  sources: NonNullable<ReturnType<typeof useAllSources>['data']>
  links: { unit_id: string; topic_id: string }[]
  direct: DirectLink[]
  cards: NonNullable<ReturnType<typeof useCardsOf>['data']>
}) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const toast = useToast((s) => s.show)
  const writer = useReviewWriter()
  const { data: subjects } = useSubjects()
  const [at, setAt] = useState(0)
  const [answers, setAnswers] = useState<Record<string, GateAnswers>>({})
  const [busy, setBusy] = useState(false)

  const all = sources.flatMap((s) => s.units)
  const source = sources.find((s) => s.units.some((u) => u.id === ids[0]))
  const subjectUnits = sources
    .filter((s) => s.subject_id === source?.subject_id)
    .flatMap((s) => s.units)
  const read = ids.map((id) => all.find((u) => u.id === id)).filter((u) => u !== undefined)
  const targets = gateTargets(read, all)
  const target = targets[at]

  if (!source || !target)
    return (
      <div className="flex flex-col items-center gap-4 pt-16 text-center">
        <p className="text-ink-secondary">{t('recall.nothing')}</p>
        <button
          type="button"
          onClick={() => navigate(to, { replace: true })}
          className="h-12 rounded-full btn-primary px-6 font-semibold"
        >
          {t('review.toToday')}
        </button>
      </div>
    )

  const questionsOf = (x: (typeof targets)[number]) =>
    linkedQuestions(x, links, subjectUnits, direct)
  const subjectName = subjects?.find((x) => x.id === source.subject_id)?.name ?? source.title
  const leafLabel = target.label ? `${subjectName} · ${target.label}` : subjectName

  const finish = async () => {
    if (busy) return
    setBusy(true)
    const units: UnitReview[] = []
    const cardReviews: CardReview[] = []
    const skipped: string[] = []
    for (const x of targets) {
      const a = answers[x.key] ?? EMPTY_ANSWERS
      if (!answered(x, a)) {
        skipped.push(...x.leaves.map((l) => l.id))
        continue
      }
      const r = gateReviews(x, a, questionsOf(x), cards)
      units.push(...r.units)
      cardReviews.push(...r.cards)
    }
    await writer.save(units, cardReviews)
    if (sessionId && skipped.length > 0)
      await writer.write(
        skipped.map((unitId): Op => ({
          kind: 'update',
          table: 'session_units',
          match: { session_id: sessionId, unit_id: unitId },
          patch: { recall_skipped: true },
        })),
      )
    toast(t(units.length === 0 && skipped.length > 0 ? 'recall.skipped' : 'recall.saved'))
    navigate(to, { replace: true })
  }

  const last = at === targets.length - 1
  return (
    <div className="flex min-h-[calc(100dvh-48px)] flex-col gap-4 pt-[env(safe-area-inset-top)]">
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => (at > 0 ? setAt(at - 1) : goBack(navigate, to))}
          aria-label={t('recall.back')}
          className="flex size-11 items-center justify-center rounded-full glass"
        >
          <ChevronLeftIcon size={20} />
        </button>
        <span className="text-base font-semibold">{t('recall.title')}</span>
        <button
          type="button"
          disabled={busy}
          onClick={() => void finish()}
          className="h-11 px-1 text-sm font-medium text-brand"
        >
          {t('recall.skip')}
        </button>
      </div>

      <div className="flex flex-col gap-1">
        <span className="text-[13px] text-brand-muted">
          {targets.length > 1
            ? `${leafLabel} · ${t('recall.progress', { n: at + 1, total: targets.length })}`
            : leafLabel}
        </span>
        <h1 className="text-[26px] leading-[1.15] font-bold">{target.title}</h1>
      </div>

      <GateTest
        key={target.key}
        target={target}
        subjectId={source.subject_id}
        questions={questionsOf(target)}
        cards={cards}
        answers={answers[target.key] ?? EMPTY_ANSWERS}
        onChange={(a) => setAnswers((x) => ({ ...x, [target.key]: a }))}
        footer={{
          label: last ? t('recall.finish') : t('recall.nextTest'),
          run: last ? () => void finish() : () => setAt(at + 1),
          busy,
        }}
      />
    </div>
  )
}
