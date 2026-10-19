import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useTranslation } from 'react-i18next'
import { BottomSheet } from '@/components/BottomSheet'
import { Button } from '@/components/ui/button'
import { fieldInput, fieldLabel } from '@/features/subjects/fields'
import type { Measure } from '@/lib/outline/parse'
import { cn } from '@/lib/utils'
import { validationKey } from '@/lib/validation'
import { unitFormSchema, type UnitForm } from './schemas'

interface UnitSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  measure: Measure
  /** Values to edit; a new unit starts with just a suggested label. */
  initial: UnitForm
  isNew: boolean
  /** Labels already taken by other units. */
  takenLabels: Set<string>
  onSubmit: (values: UnitForm) => void
}

/** Add or edit one unit: label, title and (for pages / slides) the range. */
export function UnitSheet({ open, onOpenChange, ...props }: UnitSheetProps) {
  const { t } = useTranslation()
  return (
    <BottomSheet
      open={open}
      onOpenChange={onOpenChange}
      title={t(props.isNew ? 'units.sheet.newTitle' : 'units.sheet.editTitle')}
    >
      {open && <UnitFormFields {...props} onDone={() => onOpenChange(false)} />}
    </BottomSheet>
  )
}

function UnitFormFields({
  measure,
  initial,
  takenLabels,
  onSubmit,
  onDone,
}: Omit<UnitSheetProps, 'open' | 'onOpenChange' | 'isNew'> & { onDone: () => void }) {
  const { t } = useTranslation()
  const form = useForm<UnitForm>({ resolver: zodResolver(unitFormSchema), defaultValues: initial })
  const errors = form.formState.errors
  const hasRange = measure === 'pages' || measure === 'slides'
  const asNumber = (v: string) => (v === '' ? null : Number(v))

  const submit = form.handleSubmit((values) => {
    if (takenLabels.has(values.label)) {
      form.setError('label', { message: 'validation.labelTaken' })
      return
    }
    onSubmit(values)
    onDone()
  })

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-4">
      <div className="grid grid-cols-[96px_1fr] gap-2">
        <label className="flex min-w-0 flex-col gap-2">
          <span className={fieldLabel}>{t('units.sheet.label')}</span>
          <input
            maxLength={20}
            aria-invalid={Boolean(errors.label)}
            className={cn(fieldInput, 'px-3')}
            {...form.register('label')}
          />
        </label>
        <label className="flex min-w-0 flex-col gap-2">
          <span className={fieldLabel}>{t('units.sheet.title')}</span>
          <input
            maxLength={300}
            aria-invalid={Boolean(errors.title)}
            className={fieldInput}
            {...form.register('title')}
          />
        </label>
      </div>
      {(errors.label || errors.title) && (
        <span role="alert" className="text-sm text-danger">
          {t(validationKey(errors.label?.message ?? errors.title?.message))}
        </span>
      )}

      {hasRange && (
        <div className="flex flex-col gap-2">
          <div className="grid grid-cols-2 gap-2">
            <label className="flex min-w-0 flex-col gap-2">
              <span className={fieldLabel}>
                {t(measure === 'slides' ? 'units.sheet.slideFrom' : 'units.sheet.pageFrom')}
              </span>
              <input
                type="number"
                inputMode="numeric"
                min={0}
                className={fieldInput}
                {...form.register('pageStart', { setValueAs: asNumber })}
              />
            </label>
            <label className="flex min-w-0 flex-col gap-2">
              <span className={fieldLabel}>
                {t(measure === 'slides' ? 'units.sheet.slideTo' : 'units.sheet.pageTo')}
              </span>
              <input
                type="number"
                inputMode="numeric"
                min={0}
                aria-invalid={Boolean(errors.pageEnd)}
                className={fieldInput}
                {...form.register('pageEnd', { setValueAs: asNumber })}
              />
            </label>
          </div>
          <span className="text-xs text-ink-muted">{t('units.sheet.rangeHint')}</span>
          {errors.pageEnd && (
            <span role="alert" className="text-sm text-danger">
              {t(validationKey(errors.pageEnd.message))}
            </span>
          )}
        </div>
      )}

      <Button type="submit" size="pill" className="bg-brand text-white hover:bg-brand-strong">
        {t('common.save')}
      </Button>
    </form>
  )
}
