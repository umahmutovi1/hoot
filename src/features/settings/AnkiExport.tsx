import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useToast } from '@/components/toast-store'
import { cardsCsv, cardsQuizlet, useCardCount } from './ankiApi'

/**
 * Postavke → Podaci: "Izvoz kartica za Anki" as a CSV download, and the same cards copied as
 * Quizlet import text.
 */
export function AnkiExport({ className }: { className: string }) {
  const { t } = useTranslation()
  const toast = useToast((s) => s.show)
  const { data: count = 0 } = useCardCount()
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState(false)

  const download = async () => {
    setBusy(true)
    setFailed(false)
    try {
      const csv = await cardsCsv()
      const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
      const a = document.createElement('a')
      a.href = url
      a.download = 'hoot-kartice.csv'
      a.click()
      setTimeout(() => URL.revokeObjectURL(url), 10_000)
    } catch {
      setFailed(true)
    } finally {
      setBusy(false)
    }
  }

  const copyQuizlet = async () => {
    setBusy(true)
    setFailed(false)
    try {
      await navigator.clipboard.writeText(await cardsQuizlet())
      toast(t('settings.anki.copied'))
    } catch {
      setFailed(true)
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <button
        type="button"
        disabled={busy || count === 0}
        onClick={() => void download()}
        className={className}
      >
        <span className="flex flex-col items-start gap-0.5 text-left">
          <span className="text-[15px]">{t('settings.anki.title')}</span>
          <span className="text-xs text-ink-muted">
            {failed ? t('settings.anki.failed') : t('settings.anki.count', { count })}
          </span>
        </span>
        <span className="text-sm font-semibold text-brand">{t('settings.anki.format')}</span>
      </button>
      <button
        type="button"
        disabled={busy || count === 0}
        onClick={() => void copyQuizlet()}
        className={className}
      >
        <span className="flex flex-col items-start gap-0.5 text-left">
          <span className="text-[15px]">{t('settings.anki.quizlet')}</span>
          <span className="text-xs text-ink-muted">{t('settings.anki.quizletHint')}</span>
        </span>
        <span className="text-sm font-semibold text-brand">{t('settings.anki.copy')}</span>
      </button>
    </>
  )
}
