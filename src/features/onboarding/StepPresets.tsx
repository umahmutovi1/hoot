import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { RadioCard } from '@/components/RadioCard'
import { presetName, presetSummary, usePresets } from '@/features/session/presets'
import { OffsetChips } from '@/features/notify/OffsetChips'
import { useProfile, useUpdateProfile } from '@/features/settings/profile'
import { StepTitle, type StepProps } from './OnboardingPage'

/**
 * Step 7 "Pauze i podsjetnici": the default session preset (Standardno 50/15 preselected) and the
 * reminder before a block (30 min preselected, several allowed; Podsjetnici.dc.html 2).
 */
export function StepPresets({ setSave }: StepProps) {
  const { t } = useTranslation()
  const { presets, defaultId } = usePresets()
  const update = useUpdateProfile()
  const [picked, setPicked] = useState(defaultId)
  const { data: profile } = useProfile()
  const [offsets, setOffsets] = useState<number[] | null>(null)
  const reminders = offsets ?? profile?.reminder_offsets_min ?? [30]

  useEffect(() => {
    setSave(() => update.mutateAsync({ default_preset: picked, reminder_offsets_min: reminders }))
  }, [picked, reminders]) // eslint-disable-line react-hooks/exhaustive-deps

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
      <div className="mt-1 flex flex-col gap-2">
        <span className="text-sm font-semibold">{t('onboarding.presets.reminders')}</span>
        <OffsetChips value={reminders} onChange={setOffsets} />
        <span className="px-1 text-xs leading-[1.45] text-ink-muted">
          {t('onboarding.presets.remindersHint')}
        </span>
      </div>
    </>
  )
}
