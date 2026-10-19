import { Navigate, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { SplashScreen } from '@/components/SplashScreen'
import { DisplayNameForm } from '@/features/settings/DisplayNameForm'
import { useProfile } from '@/features/settings/profile'

/** First run: "What should I call you?" The email prefix is only a suggestion. */
export function WelcomePage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { data: profile, isPending } = useProfile()

  if (isPending) return <SplashScreen />
  if (profile?.name_confirmed_at) return <Navigate to="/" replace />

  return (
    <div className="flex min-h-[calc(100dvh-48px)] flex-col justify-center gap-3.5">
      <h1 className="text-[30px] leading-[1.15] font-bold">{t('profile.welcomeTitle')}</h1>
      <p className="text-[15px] leading-snug text-ink-muted">{t('profile.welcomeBody')}</p>
      <DisplayNameForm
        initialName={profile?.display_name ?? ''}
        submitLabel={t('profile.continue')}
        onSaved={() => navigate('/', { replace: true })}
      />
    </div>
  )
}
