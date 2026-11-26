import { useEffect } from 'react'
import { useRouteError } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

/**
 * A screen that threw while rendering (or a chunk that is gone after a deploy): a short message
 * and a reload, instead of the router's developer error page.
 */
export function RouteError() {
  const { t } = useTranslation()
  const error = useRouteError()

  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <div
      role="alert"
      className="mx-auto flex min-h-dvh w-full max-w-[430px] flex-col items-center justify-center gap-5 px-5 text-center"
    >
      <p className="text-base text-ink-secondary">{t('app.error')}</p>
      <button
        type="button"
        onClick={() => window.location.reload()}
        className="btn-primary h-12 rounded-full px-6 text-base font-semibold"
      >
        {t('app.reload')}
      </button>
    </div>
  )
}
