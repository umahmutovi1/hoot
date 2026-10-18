import { useTranslation } from 'react-i18next'

export function SplashScreen() {
  const { t } = useTranslation()
  return (
    <div className="flex min-h-dvh items-center justify-center" role="status">
      <img src="/favicon.svg" alt="" className="size-16 animate-pulse rounded-2xl" />
      <span className="sr-only">{t('app.loading')}</span>
    </div>
  )
}
