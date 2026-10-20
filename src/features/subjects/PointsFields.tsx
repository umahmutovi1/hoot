import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useLocale } from '@/features/settings/useLocale'
import type { ValidationKey } from '@/lib/validation'
import { fieldLabel, NumberField, Segmented } from './fields'
import { formatPoints } from './grades'
import type { PointsUnit } from './model'

export interface PointsValue {
  pointsMax: number | null
  pointsUnit: PointsUnit
  passMinPct: number | null
}

type CarryChoice = PointsUnit | 'none'
type ThresholdUnit = 'points' | 'percent' | 'none'

interface PointsFieldsProps {
  value: PointsValue
  onChange: (patch: Partial<PointsValue>) => void
  /** Total points of the subject (base for "% ocjene"). */
  pointsTotal: number
  /** Points fixed by another exam (makeup → its exam, integral → the partials). */
  inherited?: { points: number; hint: string }
  /** Hint under the threshold ("Ispod praga ispit nije položen …"). */
  thresholdHint: string
  errors?: { pointsMax?: ValidationKey; passMinPct?: ValidationKey }
}

/**
 * "Bodovi" in the exam and deadline sheets: what the item carries (points, % of the grade, or
 * nothing yet) and an optional pass threshold (points, % or none; stored in %).
 */
export function PointsFields({
  value,
  onChange,
  pointsTotal,
  inherited,
  thresholdHint,
  errors,
}: PointsFieldsProps) {
  const { t } = useTranslation()
  const { locale } = useLocale()
  const carry: CarryChoice = value.pointsMax === null && !inherited ? 'none' : value.pointsUnit
  // Remember the last numbers so switching to "bez" and back does not lose them.
  const [lastPoints, setLastPoints] = useState(value.pointsMax)
  const worth =
    inherited?.points ??
    (value.pointsMax === null
      ? null
      : value.pointsUnit === 'percent'
        ? (value.pointsMax * pointsTotal) / 100
        : value.pointsMax)
  const [thresholdUnit, setThresholdUnit] = useState<ThresholdUnit>(
    value.passMinPct === null ? 'none' : 'points',
  )
  const shownThresholdUnit: ThresholdUnit =
    thresholdUnit === 'points' && worth === null ? 'percent' : thresholdUnit

  const pickCarry = (c: CarryChoice) => {
    if (c === 'none') {
      setLastPoints(value.pointsMax)
      onChange({ pointsMax: null, pointsUnit: 'points', passMinPct: null })
      setThresholdUnit('none')
    } else {
      onChange({ pointsUnit: c, pointsMax: value.pointsMax ?? lastPoints })
    }
  }

  const pickThreshold = (u: ThresholdUnit) => {
    setThresholdUnit(u)
    if (u === 'none') onChange({ passMinPct: null })
    else if (value.passMinPct === null) onChange({ passMinPct: 50 })
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="h-px bg-hairline" />
      <span className="text-base font-bold">{t('grades.fields.heading')}</span>

      <div className="flex flex-col gap-2">
        <span className={fieldLabel}>{t('grades.fields.carries')}</span>
        {inherited ? (
          <>
            <NumberField
              label={t('grades.fields.carries')}
              value={inherited.points}
              onChange={() => {}}
              disabled
            />
            <span className="text-xs leading-[1.4] text-ink-muted">{inherited.hint}</span>
          </>
        ) : (
          <>
            <Segmented
              label={t('grades.fields.carries')}
              options={[
                { value: 'points' as const, label: t('grades.unit.points') },
                { value: 'percent' as const, label: t('grades.unit.ofGrade') },
                { value: 'none' as const, label: t('grades.fields.noPoints') },
              ]}
              value={carry}
              onChange={pickCarry}
            />
            {carry === 'none' ? (
              <span className="text-xs leading-[1.4] text-ink-muted">
                {t('grades.fields.noPointsHint')}
              </span>
            ) : (
              <>
                <NumberField
                  key={carry}
                  label={t('grades.fields.carries')}
                  placeholder={carry === 'percent' ? '20' : '40'}
                  value={value.pointsMax}
                  invalid={Boolean(errors?.pointsMax)}
                  onChange={(n) => onChange({ pointsMax: n })}
                />
                {carry === 'percent' && worth !== null && (
                  <span className="text-xs text-ink-muted">
                    {t('grades.fields.percentIs', {
                      points: formatPoints(worth, locale),
                      total: formatPoints(pointsTotal, locale),
                    })}
                  </span>
                )}
              </>
            )}
            {errors?.pointsMax && (
              <span role="alert" className="text-sm text-danger">
                {t(errors.pointsMax)}
              </span>
            )}
          </>
        )}
      </div>

      {worth !== null && (
        <div className="flex flex-col gap-2">
          <span className={fieldLabel}>
            {t('grades.fields.threshold')}{' '}
            <span className="font-normal text-ink-muted">{t('deadlines.optional')}</span>
          </span>
          <Segmented
            label={t('grades.fields.threshold')}
            options={[
              { value: 'points' as const, label: t('grades.unit.points') },
              { value: 'percent' as const, label: '%' },
              { value: 'none' as const, label: t('grades.fields.noThreshold') },
            ]}
            value={shownThresholdUnit}
            onChange={pickThreshold}
          />
          {shownThresholdUnit !== 'none' && (
            <>
              <NumberField
                key={`${shownThresholdUnit}-${worth}`}
                label={t('grades.fields.threshold')}
                value={
                  value.passMinPct === null
                    ? null
                    : shownThresholdUnit === 'points'
                      ? (value.passMinPct * worth) / 100
                      : value.passMinPct
                }
                invalid={Boolean(errors?.passMinPct)}
                onChange={(n) =>
                  onChange({
                    passMinPct:
                      n === null ? null : shownThresholdUnit === 'points' ? (n / worth) * 100 : n,
                  })
                }
              />
              {value.passMinPct !== null && (
                <span className="text-xs leading-[1.4] text-ink-muted">
                  {shownThresholdUnit === 'points'
                    ? t('grades.fields.thresholdIsPct', {
                        pct: formatPoints(value.passMinPct, locale),
                      })
                    : t('grades.fields.thresholdIsPoints', {
                        points: formatPoints((value.passMinPct * worth) / 100, locale),
                      })}{' '}
                  {thresholdHint}
                </span>
              )}
              {errors?.passMinPct && (
                <span role="alert" className="text-sm text-danger">
                  {t(errors.passMinPct)}
                </span>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}
