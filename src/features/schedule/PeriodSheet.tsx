import { useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useTranslation } from 'react-i18next'
import { BottomSheet } from '@/components/BottomSheet'
import { Button } from '@/components/ui/button'
import { ChipGroup, fieldInput, fieldLabel } from '@/features/subjects/fields'
import type { PeriodKind } from '@/lib/schedule'
import { cn } from '@/lib/utils'
import { validationKey } from '@/lib/validation'
import { useDeletePeriod, useSavePeriod } from './api'
import { defaultPeriodTitle } from './format'
import { EXAM_SESSIONS, PERIOD_KINDS, type PeriodRow } from './model'
import { periodFormSchema, type PeriodForm } from './schemas'

interface PeriodSheetProps {
  period?: PeriodRow
  /** Kind preselected for a new period ("+ Dodaj" in a section). */
  kind: PeriodKind
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function PeriodSheet({ period, kind, open, onOpenChange }: PeriodSheetProps) {
  const { t } = useTranslation()
  return (
    <BottomSheet
      open={open}
      onOpenChange={onOpenChange}
      title={t(period ? 'calendar.editTitle' : 'calendar.newTitle')}
    >
      {open && <PeriodFormView period={period} kind={kind} onDone={() => onOpenChange(false)} />}
    </BottomSheet>
  )
}

function PeriodFormView({
  period,
  kind: initialKind,
  onDone,
}: {
  period?: PeriodRow
  kind: PeriodKind
  onDone: () => void
}) {
  const { t } = useTranslation()
  const save = useSavePeriod()
  const remove = useDeletePeriod()
  const [confirmDelete, setConfirmDelete] = useState(false)
  const form = useForm<PeriodForm>({
    resolver: zodResolver(periodFormSchema),
    defaultValues: period
      ? {
          id: period.id,
          kind: period.kind as PeriodKind,
          examSession: (period.exam_session as PeriodForm['examSession']) ?? null,
          title: period.title,
          startsOn: period.starts_on,
          endsOn: period.ends_on,
        }
      : {
          id: crypto.randomUUID(),
          kind: initialKind,
          examSession: initialKind === 'exam' ? 'regular' : null,
          title: defaultPeriodTitle(t, initialKind, 'regular', null),
          startsOn: '',
          endsOn: '',
        },
  })
  const [kind, session, startsOn] = useWatch({
    control: form.control,
    name: ['kind', 'examSession', 'startsOn'],
  })
  const errors = form.formState.errors
  const set = { shouldDirty: true, shouldValidate: form.formState.isSubmitted } as const

  // The title follows the type until the user writes their own.
  const retitle = (next: Pick<PeriodForm, 'kind' | 'examSession' | 'startsOn'>) => {
    const current = form.getValues('title').trim()
    const before = defaultPeriodTitle(t, kind, session, startsOn || null)
    const fallbacks = [before, defaultPeriodTitle(t, kind, session, null)]
    if (!current || fallbacks.includes(current))
      form.setValue(
        'title',
        defaultPeriodTitle(t, next.kind, next.examSession, next.startsOn || null),
        set,
      )
  }

  const pickKind = (k: PeriodKind) => {
    const nextSession = k === 'exam' ? (session ?? 'regular') : null
    retitle({ kind: k, examSession: nextSession, startsOn })
    form.setValue('kind', k, set)
    form.setValue('examSession', nextSession, set)
  }

  const submit = form.handleSubmit((v) => {
    save.mutate({
      id: v.id,
      kind: v.kind,
      exam_session: v.kind === 'exam' ? v.examSession : null,
      title: v.title,
      starts_on: v.startsOn,
      ends_on: v.endsOn,
    })
    onDone()
  })

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <span className={fieldLabel}>{t('calendar.kindLabel')}</span>
        <ChipGroup
          options={PERIOD_KINDS.map((k) => ({ value: k, label: t(`calendar.kind.${k}`) }))}
          value={kind}
          onChange={pickKind}
        />
      </div>

      {kind === 'exam' && (
        <div className="flex flex-col gap-2">
          <span className={fieldLabel}>{t('calendar.sessionLabel')}</span>
          <ChipGroup
            options={EXAM_SESSIONS.map((s) => ({ value: s, label: t(`calendar.session.${s}`) }))}
            value={session}
            onChange={(s) => {
              retitle({ kind, examSession: s, startsOn })
              form.setValue('examSession', s, set)
            }}
          />
        </div>
      )}

      <label className="flex flex-col gap-2">
        <span className={fieldLabel}>{t('calendar.titleLabel')}</span>
        <input
          maxLength={60}
          aria-invalid={Boolean(errors.title)}
          className={fieldInput}
          {...form.register('title')}
        />
        {errors.title && (
          <span role="alert" className="text-sm text-danger">
            {t(validationKey(errors.title.message))}
          </span>
        )}
      </label>

      <div className="grid grid-cols-2 gap-2">
        <label className="flex min-w-0 flex-col gap-2">
          <span className={fieldLabel}>{t('calendar.from')}</span>
          <input
            type="date"
            aria-invalid={Boolean(errors.startsOn)}
            className={cn(fieldInput, 'px-3')}
            {...form.register('startsOn', {
              onChange: (e: { target: { value: string } }) =>
                kind === 'teaching' &&
                retitle({ kind, examSession: session, startsOn: e.target.value }),
            })}
          />
        </label>
        <label className="flex min-w-0 flex-col gap-2">
          <span className={fieldLabel}>{t('calendar.to')}</span>
          <input
            type="date"
            min={startsOn || undefined}
            aria-invalid={Boolean(errors.endsOn)}
            className={cn(fieldInput, 'px-3')}
            {...form.register('endsOn')}
          />
        </label>
      </div>
      {(errors.startsOn || errors.endsOn) && (
        <span role="alert" className="text-sm text-danger">
          {t(validationKey(errors.startsOn?.message ?? errors.endsOn?.message))}
        </span>
      )}
      <span className="text-xs leading-[1.4] text-ink-muted">{t(`calendar.hint.${kind}`)}</span>

      <Button type="submit" size="pill" className="bg-brand text-white hover:bg-brand-strong">
        {t('common.save')}
      </Button>
      {period && (
        <Button
          type="button"
          variant="link"
          className="h-11 text-danger"
          onClick={() => {
            if (!confirmDelete) return setConfirmDelete(true)
            remove.mutate(period.id)
            onDone()
          }}
        >
          {t(confirmDelete ? 'calendar.confirmDelete' : 'calendar.delete')}
        </Button>
      )}
    </form>
  )
}
