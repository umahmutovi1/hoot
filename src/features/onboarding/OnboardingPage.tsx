import { useState, type ReactNode } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { goBack } from '@/app/navigation'
import { ChevronLeftIcon } from '@/components/icons'
import { useSessionUi } from '@/features/session/store'
import { useProfile, useUpdateProfile } from '@/features/settings/profile'
import { cn } from '@/lib/utils'
import { ONBOARDING_STEPS } from './steps'
import { StepDays } from './StepDays'
import { StepImport } from './StepImport'
import { StepMax } from './StepMax'
import { StepName } from './StepName'
import { StepPresets } from './StepPresets'
import { StepRhythm } from './StepRhythm'
import { StepSubject } from './StepSubject'
import { StepWeek } from './StepWeek'

/** What a step hands to the shell: its body and what "Dalje" does before moving on. */
export interface StepProps {
  /** Registers the step's save; it runs on "Dalje" (not on "Preskoči"). */
  setSave: (save: (() => Promise<void> | void) | null) => void
  /** Can "Dalje" be tapped (e.g. a name is typed)? */
  setReady: (ready: boolean) => void
}

/**
 * Onboarding (PRD "Onboarding", Onboarding*.dc.html): 8 steps as states of one screen. Every
 * step can be skipped; progress is kept in `profiles.onboarding_step`, so it continues later.
 * "Završi kasnije" ends it (`onboarded_at`); what is missing stays as a checklist on Today.
 */
export function OnboardingPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const { data: profile } = useProfile()
  const update = useUpdateProfile()
  const stored = Math.min(Math.max(profile?.onboarding_step ?? 1, 1), ONBOARDING_STEPS)
  const step = Math.min(Math.max(Number(params.get('step')) || stored, 1), ONBOARDING_STEPS)
  const [save, setSaveState] = useState<{ fn: (() => Promise<void> | void) | null }>({ fn: null })
  const [ready, setReady] = useState(true)
  const [busy, setBusy] = useState(false)
  const setSave: StepProps['setSave'] = (fn) => setSaveState({ fn })

  const go = (next: number) => {
    setReady(true)
    setSaveState({ fn: null })
    setParams({ step: String(next) }, { replace: true })
    if (next > (profile?.onboarding_step ?? 0)) update.mutate({ onboarding_step: next })
    window.scrollTo({ top: 0 })
  }
  const finish = (to?: string) => {
    update.mutate({ onboarded_at: new Date().toISOString(), onboarding_step: ONBOARDING_STEPS })
    if (to) navigate(to, { replace: true })
  }
  const next = async () => {
    if (busy || !ready) return
    setBusy(true)
    try {
      await save.fn?.()
    } finally {
      setBusy(false)
    }
    if (step < ONBOARDING_STEPS) go(step + 1)
  }

  const props: StepProps = { setSave, setReady }
  const body: Record<number, ReactNode> = {
    1: <StepName {...props} />,
    2: <StepImport {...props} />,
    3: <StepRhythm {...props} />,
    4: <StepDays {...props} />,
    5: <StepMax {...props} />,
    6: <StepPresets {...props} />,
    7: <StepSubject {...props} />,
    8: (
      <StepWeek
        onStart={() => {
          useSessionUi.getState().openStart()
          finish('/')
        }}
        onToday={() => finish('/')}
        onBlockStart={() => finish()}
      />
    ),
  }

  return (
    <div className="flex min-h-[calc(100dvh-24px)] flex-col gap-4">
      <div className="sticky top-0 z-10 -mx-5 -mt-6 flex items-center justify-between glass-bar px-5 pt-[calc(24px+env(safe-area-inset-top))] pb-2">
        {step > 1 ? (
          <button
            type="button"
            onClick={() => go(step - 1)}
            aria-label={t('app.back')}
            className="flex size-11 items-center justify-center rounded-full glass"
          >
            <ChevronLeftIcon size={20} />
          </button>
        ) : (
          <button
            type="button"
            onClick={() => goBack(navigate, '/')}
            aria-label={t('app.back')}
            className="flex size-11 items-center justify-center rounded-full glass"
          >
            <ChevronLeftIcon size={20} />
          </button>
        )}
        {step < ONBOARDING_STEPS && (
          <button
            type="button"
            onClick={() => go(step + 1)}
            className="h-11 rounded-full px-3 text-[15px] font-semibold text-ink-secondary"
          >
            {t('onboarding.skip')}
          </button>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <span className="text-xs font-semibold text-ink-muted">
          {t('onboarding.stepOf', { step, total: ONBOARDING_STEPS })}
        </span>
        <div className="flex gap-1" aria-hidden="true">
          {Array.from({ length: ONBOARDING_STEPS }, (_, i) => (
            <span
              key={i}
              className={cn(
                'h-1 flex-1 rounded-full',
                i < step ? 'bg-brand-accent' : 'bg-brand-soft',
              )}
            />
          ))}
        </div>
      </div>

      <div key={step} className="flex flex-1 flex-col gap-4">
        {body[step]}
      </div>

      {step < ONBOARDING_STEPS && (
        <div className="sticky bottom-[calc(12px+env(safe-area-inset-bottom)+var(--vv-bottom,0px))] flex flex-col items-center gap-1 pt-2">
          <button
            type="button"
            onClick={next}
            disabled={!ready || busy}
            className="btn-primary h-14 w-full rounded-full text-base font-semibold"
          >
            {t('onboarding.next')}
          </button>
          <button
            type="button"
            onClick={() => finish('/')}
            className="h-11 px-3 text-sm font-semibold text-brand"
          >
            {t('onboarding.later')}
          </button>
        </div>
      )}
    </div>
  )
}

/** Step heading as in the mockups (28 px title, one line under it). */
export function StepTitle({ title, sub }: { title: string; sub?: string }) {
  return (
    <div className="flex flex-col gap-1">
      <h1 className="text-[28px] leading-[1.15] font-bold tracking-[-0.6px]">{title}</h1>
      {sub && <p className="text-[15px] leading-[1.4] text-ink-secondary">{sub}</p>}
    </div>
  )
}
