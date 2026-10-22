import { Link, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ChevronRightIcon } from '@/components/icons'
import { useProfile } from '@/features/settings/profile'
import { ONBOARDING_STEPS } from './steps'

/** While onboarding is not finished, a pill on the tabs leads back to the step it stopped at. */
export function ContinueOnboarding() {
  const { t } = useTranslation()
  const { data: profile } = useProfile()
  const { pathname } = useLocation()
  const stored = profile?.onboarding_step ?? 0
  if (!profile || profile.onboarded_at || !stored || pathname === '/onboarding') return null
  const step = Math.min(Math.max(stored, 1), ONBOARDING_STEPS)
  return (
    <Link
      to={`/onboarding?step=${step}`}
      className="flex h-11 items-center justify-between gap-2 rounded-full bg-brand-soft px-4 text-sm font-semibold text-brand"
    >
      {t('onboarding.continue', { step, total: ONBOARDING_STEPS })}
      <ChevronRightIcon size={16} />
    </Link>
  )
}
