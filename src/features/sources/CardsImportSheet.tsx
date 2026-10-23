import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { BottomSheet } from '@/components/BottomSheet'
import { useToast } from '@/components/toast-store'
import { Button } from '@/components/ui/button'
import { parseCardLines } from '@/lib/cards/anki'
import { useImportCards } from './api'

const MAX_CHARS = 50_000

/** Uvoz kartica: "pojam ⇥ definicija" per line (Quizlet export, a spreadsheet, typed text). */
export function CardsImportSheet({
  unitId,
  open,
  onOpenChange,
}: {
  unitId: string
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const { t } = useTranslation()
  return (
    <BottomSheet open={open} onOpenChange={onOpenChange} title={t('units.cards.importTitle')}>
      {open && <Body unitId={unitId} onDone={() => onOpenChange(false)} />}
    </BottomSheet>
  )
}

function Body({ unitId, onDone }: { unitId: string; onDone: () => void }) {
  const { t } = useTranslation()
  const [text, setText] = useState('')
  const importCards = useImportCards()
  const toast = useToast((s) => s.show)
  const parsed = parseCardLines(text)
  const count = parsed.cards.length
  return (
    <div className="flex flex-col gap-3">
      <textarea
        rows={8}
        value={text}
        maxLength={MAX_CHARS}
        onChange={(e) => setText(e.target.value)}
        aria-label={t('units.cards.importTitle')}
        placeholder={t('units.cards.importPlaceholder')}
        spellCheck={false}
        className="w-full resize-none rounded-input bg-canvas p-3.5 text-[15px] leading-normal outline-none placeholder:text-ink-placeholder"
      />
      <span className="text-xs leading-[1.4] text-ink-muted">{t('units.cards.importHint')}</span>
      {parsed.skipped.length > 0 && (
        <span className="text-xs text-warning-ink">
          {t('units.cards.importSkipped', { lines: parsed.skipped.slice(0, 8).join(', ') })}
        </span>
      )}
      <Button
        type="button"
        size="pill"
        disabled={count === 0 || importCards.isPending}
        className="btn-primary"
        onClick={async () => {
          const n = await importCards.mutateAsync({ unitId, cards: parsed.cards })
          toast(t('units.cards.imported', { count: n }))
          onDone()
        }}
      >
        {count === 0 ? t('units.cards.importNone') : t('units.cards.importSave', { count })}
      </Button>
      {importCards.isError && <p className="text-sm text-danger">{t('owl.error.failed')}</p>}
    </div>
  )
}
