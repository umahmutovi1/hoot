import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { validationKey } from '@/lib/validation'
import { displayNameSchema, useUpdateDisplayName } from './profile'

interface DisplayNameFormProps {
  initialName: string
  submitLabel: string
  onSaved?: () => void
  onCancel?: () => void
  inputClassName?: string
}

export function DisplayNameForm({
  initialName,
  submitLabel,
  onSaved,
  onCancel,
  inputClassName,
}: DisplayNameFormProps) {
  const { t } = useTranslation()
  const update = useUpdateDisplayName()
  const form = useForm({
    resolver: zodResolver(displayNameSchema),
    defaultValues: { displayName: initialName },
  })
  const error = form.formState.errors.displayName?.message

  const submit = form.handleSubmit(({ displayName }) => {
    update.mutate(displayName, { onSuccess: onSaved })
  })

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-3">
      <label className="flex flex-col gap-1.5">
        <span className="text-[13px] font-semibold">{t('profile.nameLabel')}</span>
        <input
          autoComplete="given-name"
          autoFocus
          maxLength={40}
          placeholder={t('profile.namePlaceholder')}
          aria-invalid={Boolean(error)}
          className={cn(
            'h-[54px] rounded-input border-none bg-surface px-4 text-base text-ink outline-none focus-visible:ring-2 focus-visible:ring-brand-accent',
            inputClassName,
          )}
          {...form.register('displayName')}
        />
      </label>
      {(error || update.isError) && (
        <p role="alert" className="text-sm text-danger">
          {error ? t(validationKey(error)) : t('profile.saveFailed')}
        </p>
      )}
      <div className="flex gap-2.5">
        {onCancel && (
          <Button
            type="button"
            variant="surface"
            size="pill-sm"
            className="flex-1 bg-canvas"
            onClick={onCancel}
          >
            {t('common.cancel')}
          </Button>
        )}
        <Button
          type="submit"
          variant="ink"
          size={onCancel ? 'pill-sm' : 'pill'}
          className="flex-1"
          disabled={update.isPending}
        >
          {submitLabel}
        </Button>
      </div>
    </form>
  )
}
