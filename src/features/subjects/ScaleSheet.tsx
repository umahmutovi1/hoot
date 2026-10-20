import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { BottomSheet } from '@/components/BottomSheet'
import { Button } from '@/components/ui/button'
import { useLocale } from '@/features/settings/useLocale'
import { DEFAULT_SCALE, GRADES } from '@/lib/grades'
import { validationKey } from '@/lib/validation'
import { useUpdateSubject } from './api'
import { ChipGroup, fieldLabel, NumberField } from './fields'
import { formatPoints, parseScale } from './grades'
import type { SubjectWithAssessments } from './model'
import { gradeScaleFormSchema } from './schemas'

const NO_TARGET = 'none'

/** "Skala ocjena": points total, thresholds in % for 6–10, target grade (mockup screen 5). */
export function ScaleSheet({
  subject,
  open,
  onOpenChange,
}: {
  subject: SubjectWithAssessments
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const { t } = useTranslation()
  const { locale } = useLocale()
  return (
    <BottomSheet
      open={open}
      onOpenChange={onOpenChange}
      title={t('grades.scale.title')}
      subtitle={t('grades.scale.subtitle', {
        name: subject.name,
        total: formatPoints(subject.points_total, locale),
      })}
    >
      {open && <ScaleForm subject={subject} onDone={() => onOpenChange(false)} />}
    </BottomSheet>
  )
}

function ScaleForm({ subject, onDone }: { subject: SubjectWithAssessments; onDone: () => void }) {
  const { t } = useTranslation()
  const { locale } = useLocale()
  const update = useUpdateSubject()
  const [total, setTotal] = useState<number | null>(subject.points_total)
  const [scale, setScale] = useState<(number | null)[]>(
    () => parseScale(subject.grade_scale) ?? [...DEFAULT_SCALE],
  )
  const [target, setTarget] = useState<number | null>(subject.target_grade)
  // Remount the inputs after "Vrati bosansku skalu".
  const [resetKey, setResetKey] = useState(0)
  const [errors, setErrors] = useState<Record<string, string>>({})

  const save = () => {
    const parsed = gradeScaleFormSchema.safeParse({
      pointsTotal: total,
      scale,
      targetGrade: target,
    })
    if (!parsed.success) {
      setErrors(Object.fromEntries(parsed.error.issues.map((i) => [i.path.join('.'), i.message])))
      return
    }
    const isDefault = parsed.data.scale.every((n, i) => n === DEFAULT_SCALE[i])
    update.mutate({
      id: subject.id,
      patch: {
        points_total: parsed.data.pointsTotal,
        grade_scale: isDefault ? null : parsed.data.scale,
        target_grade: parsed.data.targetGrade,
      },
    })
    onDone()
  }

  const error = (path: string) =>
    errors[path] && (
      <span role="alert" className="text-xs text-danger">
        {t(validationKey(errors[path]))}
      </span>
    )

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <span className={fieldLabel}>{t('grades.scale.total')}</span>
        <NumberField
          label={t('grades.scale.total')}
          value={total}
          invalid={Boolean(errors.pointsTotal)}
          onChange={setTotal}
          className="h-11 w-24 rounded-[14px] text-center"
        />
      </div>
      {error('pointsTotal')}

      <div className="flex flex-col">
        {[...GRADES].reverse().map((grade) => {
          const i = grade - 6
          return (
            <div key={grade} className="flex flex-col border-b border-hairline py-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[15px] font-semibold">
                  {grade}
                  {grade === 6 && (
                    <span className="text-xs font-normal text-ink-muted">
                      {' '}
                      · {t('grades.scale.pass')}
                    </span>
                  )}
                </span>
                <span className="flex items-center gap-2">
                  <span className="text-xs text-ink-muted">{t('grades.scale.from')}</span>
                  <NumberField
                    key={`${resetKey}-${grade}`}
                    label={t('grades.scale.thresholdFor', { grade })}
                    value={scale[i] ?? null}
                    invalid={Boolean(errors[`scale.${i}`])}
                    onChange={(n) => setScale((s) => s.map((v, j) => (j === i ? n : v)))}
                    className="h-10 w-[72px] rounded-[14px] px-2 text-center"
                  />
                  <span className="w-3 text-xs text-ink-muted">%</span>
                </span>
              </div>
              {error(`scale.${i}`)}
            </div>
          )
        })}
        <div className="flex items-center justify-between py-2.5">
          <span className="text-[15px] font-semibold text-ink-muted">5</span>
          <span className="text-xs text-ink-muted">
            {t('grades.scale.below', { pct: formatPoints(scale[0] ?? DEFAULT_SCALE[0]!, locale) })}
          </span>
        </div>
      </div>
      <button
        type="button"
        onClick={() => {
          setScale([...DEFAULT_SCALE])
          setResetKey((k) => k + 1)
          setErrors({})
        }}
        className="-my-2 flex h-11 items-center self-start text-[13px] font-semibold text-brand"
      >
        {t('grades.scale.reset')}
      </button>

      <div className="flex flex-col gap-2">
        <span className={fieldLabel}>{t('grades.scale.target')}</span>
        <ChipGroup
          options={[
            ...GRADES.map((g) => ({ value: String(g), label: String(g) })),
            { value: NO_TARGET, label: t('grades.scale.noTarget') },
          ]}
          value={target === null ? NO_TARGET : String(target)}
          onChange={(v) => setTarget(v === NO_TARGET ? null : Number(v))}
        />
        <span className="text-xs leading-[1.4] text-ink-muted">
          {target === null
            ? t('grades.scale.noTargetHint')
            : t('grades.scale.targetHint', { grade: target })}
        </span>
      </div>

      <Button
        type="button"
        size="pill"
        onClick={save}
        className="bg-brand text-white hover:bg-brand-strong"
      >
        {t('common.save')}
      </Button>
    </div>
  )
}
