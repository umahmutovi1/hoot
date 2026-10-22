import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { LocaleToggle } from '@/components/LocaleToggle'
import { useProfile, useUpdateDisplayName, useUpdateProfile } from '@/features/settings/profile'
import { useLocale } from '@/features/settings/useLocale'
import { StepTitle, type StepProps } from './OnboardingPage'
import { browserTimeZone } from './steps'

/** Step 1: name, language and the time zone from the browser. */
export function StepName({ setSave, setReady }: StepProps) {
  const { t } = useTranslation()
  const { data: profile } = useProfile()
  const { locale, setLocale } = useLocale()
  const updateName = useUpdateDisplayName()
  const update = useUpdateProfile()
  const [name, setName] = useState(profile?.display_name ?? '')
  const zone = browserTimeZone()
  const valid = name.trim().length > 0 && name.trim().length <= 40

  useEffect(() => {
    setReady(valid)
    setSave(async () => {
      await updateName.mutateAsync(name.trim())
      if (zone && zone !== profile?.timezone) update.mutate({ timezone: zone })
    })
    // The save closes over the latest name.
  }, [name, valid, zone, profile?.timezone]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <>
      <StepTitle title={t('onboarding.name.title')} sub={t('onboarding.name.sub')} />
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        maxLength={40}
        autoComplete="given-name"
        aria-label={t('profile.nameLabel')}
        placeholder={t('profile.nameLabel')}
        className="h-[54px] rounded-input glass px-4 text-[17px] outline-none focus:ring-2 focus:ring-brand-accent"
      />
      <div className="flex flex-col gap-1.5">
        <span className="px-1 text-xs font-semibold text-ink-muted uppercase">
          {t('settings.language')}
        </span>
        <LocaleToggle value={locale} onChange={setLocale} className="self-start bg-brand-soft" />
      </div>
      <span className="px-1 text-xs text-ink-muted">{t('onboarding.name.zone', { zone })}</span>
    </>
  )
}
