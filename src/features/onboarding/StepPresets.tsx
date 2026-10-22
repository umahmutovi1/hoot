import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { RadioCard } from '@/components/RadioCard'
import { presetName, presetSummary, usePresets } from '@/features/session/presets'
import { useUpdateProfile } from '@/features/settings/profile'
import { StepTitle, type StepProps } from './OnboardingPage'

/** Step 6 "Kako voliš pauze?": the default session preset (Standardno 50/15 preselected). */
export function StepPresets({ setSave }: StepProps) {
  const { t } = useTranslation()
  const { presets, defaultId } = usePresets()
  const update = useUpdateProfile()
  const [picked, setPicked] = useState(defaultId)

  useEffect(() => {
    setSave(() => update.mutateAsync({ default_preset: picked }))
  }, [picked]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <>
      <StepTitle title={t('onboarding.presets.title')} sub={t('onboarding.presets.sub')} />
      <div
        role="radiogroup"
        aria-label={t('onboarding.presets.title')}
        className="flex flex-col gap-2"
      >
        {presets.map((p) => (
          <RadioCard
            key={p.id}
            checked={p.id === picked}
            title={presetName(t, p)}
            subtitle={
              p.id === 'standard'
                ? `${presetSummary(t, p)} · ${t('onboarding.presets.recommended')}`
                : presetSummary(t, p)
            }
            onSelect={() => setPicked(p.id)}
          />
        ))}
      </div>
      <span className="px-1 text-xs leading-[1.45] text-ink-muted">
        {t('onboarding.presets.own')}
      </span>
    </>
  )
}
