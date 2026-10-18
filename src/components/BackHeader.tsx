import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ChevronLeftIcon } from './icons'

export function BackHeader({ title, fallback = '/' }: { title: string; fallback?: string }) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const goBack = () => (window.history.length > 1 ? navigate(-1) : navigate(fallback))

  return (
    <div className="flex items-center justify-between">
      <button
        type="button"
        onClick={goBack}
        aria-label={t('app.back')}
        className="flex size-11 items-center justify-center rounded-full bg-surface"
      >
        <ChevronLeftIcon size={20} />
      </button>
      <h1 className="text-base font-semibold">{title}</h1>
      <span className="w-11" />
    </div>
  )
}
