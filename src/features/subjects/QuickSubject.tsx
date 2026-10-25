import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { useAcademicTerm } from '@/features/academic/api'
import { useSaveSubject, useSubjects } from './api'
import { ColorSwatch, fieldInput, fieldLabel } from './fields'
import { DEFAULT_PRIORITY, SUBJECT_COLORS, type SubjectColor } from './model'

/**
 * Short "new subject" form (name and color) inside another sheet, e.g. a new class, so the
 * subject does not have to exist first. Exams are added later on the subject.
 */
export function QuickSubject({
  onCreated,
  onCancel,
  autoFocus = false,
}: {
  onCreated: (id: string) => void
  onCancel: () => void
  /** Only when opened by a tap; a sheet never focuses its first field on open. */
  autoFocus?: boolean
}) {
  const { t } = useTranslation()
  const { data: subjects = [] } = useSubjects()
  const save = useSaveSubject()
  const { defaultTerm } = useAcademicTerm()
  const [name, setName] = useState('')
  const [color, setColor] = useState<SubjectColor>(
    () => SUBJECT_COLORS.find((c) => !subjects.some((s) => s.color === c)) ?? 'pink',
  )
  const [invalid, setInvalid] = useState(false)

  const create = () => {
    const trimmed = name.trim()
    if (!trimmed) return setInvalid(true)
    const id = crypto.randomUUID()
    save.mutate({
      id,
      name: trimmed,
      color,
      priority: DEFAULT_PRIORITY,
      studyMode: 'regular',
      campaignStartOn: null,
      targetGrade: null,
      ...defaultTerm,
      assessments: [],
    })
    onCreated(id)
  }

  return (
    <div className="flex flex-col gap-3 rounded-[18px] bg-canvas-soft p-3">
      <label className="flex flex-col gap-2">
        <span className={fieldLabel}>{t('subjects.quick.title')}</span>
        <input
          maxLength={80}
          autoFocus={autoFocus}
          placeholder={t('subjects.form.namePlaceholder')}
          aria-invalid={invalid}
          value={name}
          onChange={(e) => {
            setName(e.target.value)
            setInvalid(false)
          }}
          onKeyDown={(e) => {
            if (e.key !== 'Enter') return
            e.preventDefault()
            create()
          }}
          className={fieldInput}
        />
        {invalid && (
          <span role="alert" className="text-sm text-danger">
            {t('validation.required')}
          </span>
        )}
      </label>
      <div
        role="radiogroup"
        aria-label={t('subjects.form.color')}
        className="flex flex-wrap gap-2.5"
      >
        {SUBJECT_COLORS.map((c) => (
          <ColorSwatch key={c} color={c} checked={color === c} onSelect={() => setColor(c)} />
        ))}
      </div>
      <span className="text-xs leading-[1.4] text-ink-muted">{t('subjects.quick.hint')}</span>
      <div className="grid grid-cols-2 gap-2">
        <Button type="button" variant="ghost" className="h-11 rounded-full" onClick={onCancel}>
          {t('common.cancel')}
        </Button>
        <Button type="button" className="h-11 rounded-full btn-primary" onClick={create}>
          {t('subjects.quick.create')}
        </Button>
      </div>
    </div>
  )
}
