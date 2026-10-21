import { useTranslation } from 'react-i18next'

/** Offline message (MASCOT.md: `sleeping` 190 px in a 220 px circle). */
export function OfflineNotice({ body }: { body?: string }) {
  const { t } = useTranslation()
  return (
    <div className="flex flex-col items-center gap-3 py-4 text-center">
      <span className="text-lg font-semibold">{t('offline.title')}</span>
      <span className="max-w-[300px] text-sm leading-[1.45] text-ink-muted">
        {body ?? t('offline.body')}
      </span>
    </div>
  )
}
