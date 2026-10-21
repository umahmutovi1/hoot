import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useTranslation } from 'react-i18next'
import { BottomSheet } from '@/components/BottomSheet'
import { Button } from '@/components/ui/button'
import { fieldLabel } from '@/features/subjects/fields'
import { cn } from '@/lib/utils'
import { validationKey } from '@/lib/validation'
import { useCards, useDeleteCard, useSaveCard } from './api'
import type { Card } from './model'
import { cardFormSchema, type CardForm } from './schemas'

const textArea =
  'resize-none rounded-input border-2 border-transparent bg-canvas p-3.5 text-[15px] leading-normal outline-none focus-visible:border-brand-accent aria-invalid:border-danger'

/** Question–answer cards of a unit (used by the recall gate in Stage 8). */
export function CardsSection({ unitId }: { unitId: string }) {
  const { t } = useTranslation()
  const { data: cards = [] } = useCards(unitId)
  const [sheet, setSheet] = useState<{ open: boolean; id?: string }>({ open: false })
  const [flipped, setFlipped] = useState<Set<string>>(new Set())

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold">
          {t('units.cards.title')}
          {cards.length > 0 && (
            <span className="font-normal text-ink-muted"> · {cards.length}</span>
          )}
        </span>
        <button
          type="button"
          onClick={() => setSheet({ open: true })}
          className="flex h-9 items-center rounded-full glass px-3 text-[13px] font-semibold text-brand"
        >
          {t('units.cards.add')}
        </button>
      </div>
      {cards.length === 0 ? (
        <p className="rounded-[20px] glass p-4 text-sm text-ink-muted">{t('units.cards.none')}</p>
      ) : (
        <div className="flex flex-col gap-2">
          {cards.map((c) => {
            const back = flipped.has(c.id)
            return (
              <div key={c.id} className="flex items-stretch gap-1 rounded-[20px] glass">
                <button
                  type="button"
                  onClick={() =>
                    setFlipped((s) => {
                      const next = new Set(s)
                      if (back) next.delete(c.id)
                      else next.add(c.id)
                      return next
                    })
                  }
                  aria-label={t(back ? 'units.cards.showFront' : 'units.cards.showBack')}
                  className="flex min-h-11 flex-1 flex-col gap-1 p-4 text-left"
                >
                  <span className="text-[11px] font-semibold text-ink-muted uppercase">
                    {t(back ? 'units.cards.back' : 'units.cards.front')}
                  </span>
                  <span className={cn('text-sm whitespace-pre-wrap', back && 'text-brand-strong')}>
                    {back ? c.back : c.front}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setSheet({ open: true, id: c.id })}
                  className="w-16 shrink-0 text-[13px] font-semibold text-brand"
                >
                  {t('units.cards.edit')}
                </button>
              </div>
            )
          })}
          <span className="px-1 text-xs text-ink-muted">{t('units.cards.flipHint')}</span>
        </div>
      )}
      <CardSheet
        unitId={unitId}
        card={cards.find((c) => c.id === sheet.id)}
        open={sheet.open}
        onOpenChange={(open) => setSheet((s) => ({ ...s, open }))}
      />
    </div>
  )
}

function CardSheet({
  unitId,
  card,
  open,
  onOpenChange,
}: {
  unitId: string
  card?: Card
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const { t } = useTranslation()
  return (
    <BottomSheet
      open={open}
      onOpenChange={onOpenChange}
      title={t(card ? 'units.cards.editTitle' : 'units.cards.newTitle')}
    >
      {open && <CardFormFields unitId={unitId} card={card} onDone={() => onOpenChange(false)} />}
    </BottomSheet>
  )
}

function CardFormFields({
  unitId,
  card,
  onDone,
}: {
  unitId: string
  card?: Card
  onDone: () => void
}) {
  const { t } = useTranslation()
  const save = useSaveCard()
  const remove = useDeleteCard()
  const [confirm, setConfirm] = useState(false)
  const form = useForm<CardForm>({
    resolver: zodResolver(cardFormSchema),
    defaultValues: card
      ? { id: card.id, unitId, front: card.front, back: card.back }
      : { id: crypto.randomUUID(), unitId, front: '', back: '' },
  })
  const errors = form.formState.errors

  return (
    <form
      noValidate
      onSubmit={form.handleSubmit((values) => {
        save.mutate(values)
        onDone()
      })}
      className="flex flex-col gap-4"
    >
      <label className="flex flex-col gap-2">
        <span className={fieldLabel}>{t('units.cards.front')}</span>
        <textarea
          rows={3}
          maxLength={500}
          placeholder={t('units.cards.frontPlaceholder')}
          aria-invalid={Boolean(errors.front)}
          className={textArea}
          {...form.register('front')}
        />
      </label>
      <label className="flex flex-col gap-2">
        <span className={fieldLabel}>{t('units.cards.back')}</span>
        <textarea
          rows={4}
          maxLength={2000}
          aria-invalid={Boolean(errors.back)}
          className={textArea}
          {...form.register('back')}
        />
      </label>
      {(errors.front || errors.back) && (
        <span role="alert" className="text-sm text-danger">
          {t(validationKey(errors.front?.message ?? errors.back?.message))}
        </span>
      )}
      <Button type="submit" size="pill" className="btn-primary">
        {t('common.save')}
      </Button>
      {card && (
        <Button
          type="button"
          variant="link"
          className="h-11 text-danger"
          onClick={() => {
            if (!confirm) return setConfirm(true)
            remove.mutate({ id: card.id, unitId })
            onDone()
          }}
        >
          {t(confirm ? 'units.cards.confirmDelete' : 'units.cards.delete')}
        </Button>
      )}
    </form>
  )
}
