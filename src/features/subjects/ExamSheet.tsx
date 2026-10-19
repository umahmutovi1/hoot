import { useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useTranslation } from 'react-i18next'
import { BottomSheet } from '@/components/BottomSheet'
import { Switch } from '@/components/Switch'
import { Button } from '@/components/ui/button'
import { validationKey } from '@/lib/validation'
import { useDeleteAssessment, useSaveAssessment } from './api'
import { ChipGroup, fieldInput, fieldLabel } from './fields'
import { assessmentToForm } from './mappers'
import { ASSESSMENT_KINDS, EXAM_FORMATS, type Assessment } from './model'
import { assessmentFormSchema, type AssessmentForm } from './schemas'

interface ExamSheetProps {
  subjectId: string
  /** Exam to edit; undefined = new exam. */
  exam?: Assessment
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function ExamSheet({ subjectId, exam, open, onOpenChange }: ExamSheetProps) {
  const { t } = useTranslation()
  return (
    <BottomSheet
      open={open}
      onOpenChange={onOpenChange}
      title={t(exam ? 'exams.editTitle' : 'exams.newTitle')}
    >
      {open && <ExamForm subjectId={subjectId} exam={exam} onDone={() => onOpenChange(false)} />}
    </BottomSheet>
  )
}

function ExamForm({
  subjectId,
  exam,
  onDone,
}: {
  subjectId: string
  exam?: Assessment
  onDone: () => void
}) {
  const { t } = useTranslation()
  const save = useSaveAssessment()
  const remove = useDeleteAssessment()
  const [confirmDelete, setConfirmDelete] = useState(false)
  const form = useForm<AssessmentForm>({
    resolver: zodResolver(assessmentFormSchema),
    defaultValues: exam
      ? assessmentToForm(exam)
      : {
          id: crypto.randomUUID(),
          kind: 'final',
          title: '',
          date: '',
          format: 'written',
          scopeAll: true,
          contingent: false,
          dateTentative: false,
        },
  })
  const [kind, examFormat, scopeAll, contingent, dateTentative] = useWatch({
    control: form.control,
    name: ['kind', 'format', 'scopeAll', 'contingent', 'dateTentative'],
  })
  const errors = form.formState.errors
  const set = { shouldDirty: true, shouldValidate: form.formState.isSubmitted } as const

  const submit = form.handleSubmit((values) => {
    save.mutate({ subjectId, form: values })
    onDone()
  })

  const pickKind = (k: AssessmentForm['kind']) => {
    form.setValue('kind', k, set)
    // Integral and makeup exams usually cover everything and are only taken if needed.
    if (k === 'integral' || k === 'makeup') {
      form.setValue('scopeAll', true, set)
      form.setValue('contingent', true, set)
    }
    if (!form.getValues('title')) form.setValue('title', t(`exams.kind.${k}`), set)
  }

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <span className={fieldLabel}>{t('exams.kindLabel')}</span>
        <ChipGroup
          options={ASSESSMENT_KINDS.map((k) => ({ value: k, label: t(`exams.kind.${k}`) }))}
          value={kind}
          onChange={pickKind}
        />
      </div>

      <label className="flex flex-col gap-2">
        <span className={fieldLabel}>{t('subjects.form.examTitle')}</span>
        <input
          maxLength={60}
          placeholder={t('subjects.form.examTitlePlaceholder')}
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

      <label className="flex flex-col gap-2">
        <span className={fieldLabel}>{t('subjects.form.examDate')}</span>
        <input
          type="date"
          aria-invalid={Boolean(errors.date)}
          className={fieldInput}
          {...form.register('date')}
        />
        {errors.date && (
          <span role="alert" className="text-sm text-danger">
            {t(validationKey(errors.date.message))}
          </span>
        )}
      </label>

      <div className="flex flex-col gap-2">
        <span className={fieldLabel}>{t('subjects.form.examFormat')}</span>
        <ChipGroup
          options={EXAM_FORMATS.map((f) => ({ value: f, label: t(`subjects.format.${f}`) }))}
          value={examFormat}
          onChange={(f) => form.setValue('format', f, set)}
        />
      </div>

      <div className="flex flex-col">
        <Switch
          checked={scopeAll}
          label={t('exams.scopeAll')}
          onChange={(v) => form.setValue('scopeAll', v, set)}
        />
        <Switch
          checked={contingent}
          label={t('subjects.form.contingent')}
          onChange={(v) => form.setValue('contingent', v, set)}
        />
        <Switch
          checked={dateTentative}
          label={t('subjects.form.dateTentative')}
          onChange={(v) => form.setValue('dateTentative', v, set)}
        />
      </div>

      <Button type="submit" size="pill" className="bg-brand text-white hover:bg-brand-strong">
        {t('common.save')}
      </Button>
      {exam && (
        <Button
          type="button"
          variant="link"
          className="h-11 text-danger"
          onClick={() => {
            if (!confirmDelete) return setConfirmDelete(true)
            remove.mutate(exam.id)
            onDone()
          }}
        >
          {t(confirmDelete ? 'exams.confirmDelete' : 'exams.delete')}
        </Button>
      )}
    </form>
  )
}
