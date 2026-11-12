import { format } from 'date-fns'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate, useParams } from 'react-router-dom'
import { InHeader } from '@/app/layout/ScreenHeader'
import { MinusIcon, PlusIcon } from '@/components/icons'
import { ListSkeleton } from '@/components/Skeleton'
import { Button } from '@/components/ui/button'
import { useGlobalScale } from '@/features/settings/profile'
import { useLocale } from '@/features/settings/useLocale'
import {
  useDeadlines,
  useSaveDeadlineResult,
  useSaveExamResult,
  useSubject,
  useUpdateSubject,
} from '@/features/subjects/api'
import { paletteOf } from '@/features/subjects/colors'
import { DeadlineSheet } from '@/features/subjects/DeadlineSheet'
import { NumberField } from '@/features/subjects/fields'
import { formatPoints, gradeItemsOf, gradeSubjectOf, scaleOf } from '@/features/subjects/grades'
import type { Deadline, SubjectWithAssessments } from '@/features/subjects/model'
import { DEFAULT_SCALE, itemWorth, resultShare, suggestPassed, type GradeItem } from '@/lib/grades'
import { dateFnsLocales } from '@/lib/locale'
import { cn } from '@/lib/utils'

/** Tints of the subject colour for the grade bands 6–10 (board BodoviUredi). */
const BAND_OPACITY = ['opacity-25', 'opacity-40', 'opacity-55', 'opacity-75', 'opacity-95']

export function PointsEditPage() {
  const { id } = useParams()
  const { data: subject, isPending } = useSubject(id)
  const { data: deadlines, isPending: deadlinesPending } = useDeadlines()
  const global = useGlobalScale()
  if (isPending || deadlinesPending || !global) return <ListSkeleton count={2} rows={4} />
  if (!subject) return null
  return <PointsEdit subject={subject} deadlines={deadlines ?? []} />
}

/** Items that carry points; the integral stands in for the partials, so it is not its own row. */
function rowsOf(items: GradeItem[], pointsTotal: number) {
  const hasPartials = items.some((i) => i.kind === 'partial')
  return items
    .filter((i) => i.kind !== 'makeup' && !(hasPartials && i.kind === 'integral'))
    .flatMap((i) => {
      const worth = itemWorth(i, items, pointsTotal)
      return worth === null ? [] : [{ item: i, worth }]
    })
    .sort((a, b) => a.item.at.localeCompare(b.item.at))
}

/** Bodovi → olovka (board BodoviUredi): results of the subject's items and its grade scale. */
function PointsEdit({
  subject,
  deadlines,
}: {
  subject: SubjectWithAssessments
  deadlines: Deadline[]
}) {
  const { t } = useTranslation()
  const { locale } = useLocale()
  const navigate = useNavigate()
  const global = useGlobalScale()
  const saveExam = useSaveExamResult()
  const saveDeadline = useSaveDeadlineResult()
  const updateSubject = useUpdateSubject()
  const palette = paletteOf(subject.color)
  const grading = gradeSubjectOf(subject, global)
  const items = gradeItemsOf(subject, deadlines)
  const rows = rowsOf(items, grading.pointsTotal)
  const shown = (i: GradeItem, worth: number) => {
    const share = resultShare(i)
    return share === null ? null : Math.round(share * worth * 100) / 100
  }
  const [values, setValues] = useState<Record<string, number | null>>(() =>
    Object.fromEntries(rows.map((r) => [r.item.id, shown(r.item, r.worth)])),
  )
  const [custom, setCustom] = useState(subject.custom_scale)
  const [scale, setScale] = useState<number[]>(() => [...(grading.scale ?? DEFAULT_SCALE)])
  const [adding, setAdding] = useState(false)
  const globalScale = scaleOf(global)
  const thresholds = custom ? scale : [...(globalScale.scale ?? DEFAULT_SCALE)]
  const total = custom ? grading.pointsTotal : globalScale.pointsTotal
  const fmt = (n: number) => formatPoints(n, locale)
  const asPoints = (pct: number) => fmt((pct * total) / 100)
  const invalid = (id: string, worth: number) => {
    const v = values[id]
    return v !== null && v !== undefined && (v < 0 || v > worth)
  }
  const anyInvalid = rows.some((r) => invalid(r.item.id, r.worth))
  const day = (iso: string) =>
    format(new Date(iso), locale === 'en' ? 'MMM d' : 'd. MMM', { locale: dateFnsLocales[locale] })

  const step = (i: number, d: number) =>
    setScale((s) => {
      const lo = i ? s[i - 1]! + 1 : 1
      const hi = i < 4 ? s[i + 1]! - 1 : 100
      return s.map((v, j) => (j === i ? Math.max(lo, Math.min(hi, v + d)) : v))
    })

  const toggle = (on: boolean) => {
    setCustom(on)
    // Own scale starts from the default one.
    if (on && !subject.custom_scale) setScale([...(globalScale.scale ?? DEFAULT_SCALE)])
  }

  const save = () => {
    if (anyInvalid) return
    for (const { item, worth } of rows) {
      const value = values[item.id] ?? null
      if (value === shown(item, worth)) continue
      const result =
        value === null
          ? { result_points: null, result_max: null }
          : { result_points: value, result_max: worth }
      if (item.kind === 'deadline') {
        saveDeadline.mutate({
          id: item.id,
          patch: value === null ? result : { ...result, done: true },
        })
      } else {
        saveExam.mutate({
          id: item.id,
          patch: {
            ...result,
            result_annulled: false,
            passed: value === null ? false : suggestPassed(value / worth, item.passMinPct),
          },
        })
      }
    }
    const isDefault = scale.every((n, i) => n === DEFAULT_SCALE[i])
    const scaleChanged =
      custom !== subject.custom_scale ||
      (custom && scale.some((n, i) => n !== (grading.scale ?? DEFAULT_SCALE)[i]))
    if (scaleChanged) {
      updateSubject.mutate({
        id: subject.id,
        patch: custom
          ? {
              custom_scale: true,
              points_total: grading.pointsTotal,
              grade_scale: isDefault ? null : scale,
            }
          : { custom_scale: false },
      })
    }
    void navigate('/progress/points')
  }

  return (
    <div className="flex flex-col gap-2.5">
      <InHeader>
        <span className="flex items-center gap-2 text-sm font-bold text-ground/80">
          <span className={cn('size-2.5 rounded-full', palette.bar)} />
          {t('points.editLabel')}
        </span>
        <h1 className="mt-1.5 text-[34px] leading-[1.05] font-bold">{subject.name}</h1>
      </InHeader>

      <div className="flex items-baseline justify-between px-1">
        <h2 className="font-sans text-[15px] font-bold">{t('points.items')}</h2>
        <span className="text-[13px] text-ink-secondary tabular-nums">
          {t('points.itemsTotal', {
            sum: fmt(rows.reduce((s, r) => s + r.worth, 0)),
            total: fmt(grading.pointsTotal),
          })}
        </span>
      </div>
      {rows.length > 0 && (
        <div className="overflow-hidden rounded-card surface">
          {rows.map(({ item, worth }) => {
            const title =
              subject.assessments.find((a) => a.id === item.id)?.title ??
              deadlines.find((d) => d.id === item.id)?.title ??
              ''
            const meta = [
              day(item.at),
              item.passMinPct !== null &&
                t('points.threshold', { points: fmt((worth * item.passMinPct) / 100) }),
            ]
              .filter(Boolean)
              .join(' · ')
            return (
              <div
                key={item.id}
                className="flex min-h-16 items-center gap-2.5 border-hairline py-2 pr-2 pl-4 not-first:border-t"
              >
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <b className="truncate text-[15px]">{title}</b>
                  <span className="text-[13px] text-ink-secondary tabular-nums">{meta}</span>
                </span>
                <NumberField
                  label={t('points.earnedFor', { title })}
                  value={values[item.id] ?? null}
                  placeholder="–"
                  invalid={invalid(item.id, worth)}
                  onChange={(n) => setValues((v) => ({ ...v, [item.id]: n }))}
                  className="h-11 w-16 rounded-xl bg-raised px-1 text-center font-bold tabular-nums"
                />
                <span className="min-w-10 text-sm text-ink-secondary tabular-nums">
                  / {fmt(worth)}
                </span>
              </div>
            )
          })}
        </div>
      )}
      {anyInvalid && (
        <span role="alert" className="px-1 text-[13px] text-danger">
          {t('points.tooMany')}
        </span>
      )}
      <p className="px-1 text-[13px] leading-[1.4] text-ink-secondary">
        {t(rows.length ? 'points.itemsHint' : 'points.itemsEmpty')}
      </p>
      <button
        type="button"
        onClick={() => setAdding(true)}
        className="flex h-11 items-center gap-1.5 self-start rounded-[14px] px-3.5 text-sm font-bold text-brand-strong shadow-[inset_0_0_0_1.5px_rgb(var(--hoot-brand-rgb)/0.35)]"
      >
        <PlusIcon size={16} />
        {t('points.addItem')}
      </button>

      <h2 className="mt-5 px-1 font-sans text-[15px] font-bold">{t('points.scale')}</h2>
      <div className="flex min-h-[72px] items-center gap-2 rounded-card surface py-1.5 pr-4 pl-4">
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="text-[15px] font-bold">{t('points.customScale')}</span>
          <span className="text-[13px] text-ink-secondary tabular-nums">
            {t(custom ? 'points.scaleOwn' : 'points.scaleDefault', {
              scale: thresholds.map(asPoints).join(' / '),
            })}
          </span>
        </span>
        <button
          type="button"
          role="switch"
          aria-checked={custom}
          aria-label={t('points.customScale')}
          onClick={() => toggle(!custom)}
          className={cn(
            'relative h-8 w-[52px] shrink-0 rounded-full transition-colors motion-reduce:transition-none',
            custom ? 'bg-brand' : 'bg-radio-ring',
          )}
        >
          <span
            className={cn(
              'absolute top-1 left-1 size-6 rounded-full bg-raised transition-transform duration-200 motion-reduce:transition-none',
              custom && 'translate-x-5 bg-ground',
            )}
          />
        </button>
      </div>
      <div
        role="img"
        aria-label={t('points.scaleAria', {
          scale: thresholds
            .map((pct, i) => t('points.scaleStep', { grade: i + 6, pct: asPoints(pct) }))
            .join(', '),
        })}
        className="relative mx-1 mt-1 h-3.5 overflow-hidden rounded-[7px] bg-track"
      >
        {thresholds.map((pct, i) => (
          <span
            key={i}
            className={cn(
              'absolute inset-y-0 border-l-[1.5px] border-ground',
              palette.bar,
              BAND_OPACITY[i],
            )}
            style={{ left: `${pct}%`, width: `${(thresholds[i + 1] ?? 100) - pct}%` }}
          />
        ))}
      </div>
      <div aria-hidden="true" className="relative mx-1 h-[18px]">
        {thresholds.map((pct, i) => (
          <span
            key={i}
            className="absolute text-xs font-bold text-ink-secondary tabular-nums"
            style={{ left: `${pct}%` }}
          >
            {i + 6}
          </span>
        ))}
      </div>
      {custom && (
        <div className="animate-settle-in overflow-hidden rounded-card surface">
          {scale.map((pct, i) => (
            <div
              key={i}
              className="flex min-h-14 items-center gap-2 border-hairline py-1.5 pr-1.5 pl-4 not-first:border-t"
            >
              <span className="flex-1 text-[15px] font-bold">
                {t('points.gradeFrom', { grade: i + 6 })}
              </span>
              <button
                type="button"
                aria-label={t('points.less', { grade: i + 6 })}
                disabled={pct <= (i ? scale[i - 1]! + 1 : 1)}
                onClick={() => step(i, -1)}
                className="flex size-11 items-center justify-center text-brand-strong disabled:opacity-40"
              >
                <MinusIcon size={18} />
              </button>
              <span
                aria-live="polite"
                className="min-w-16 text-center font-display text-xl font-bold tabular-nums"
              >
                {asPoints(pct)}
              </span>
              <button
                type="button"
                aria-label={t('points.more', { grade: i + 6 })}
                disabled={pct >= (i < 4 ? scale[i + 1]! - 1 : 100)}
                onClick={() => step(i, 1)}
                className="flex size-11 items-center justify-center text-brand-strong disabled:opacity-40"
              >
                <PlusIcon size={18} />
              </button>
            </div>
          ))}
        </div>
      )}
      <p className="px-1 text-[13px] leading-[1.4] text-ink-secondary">
        {t('points.scaleHint', { points: asPoints(thresholds[0]!) })}
      </p>

      <div className="sticky bottom-[calc(16px+var(--nav-offset,0px)+env(safe-area-inset-bottom))] z-10 -mx-5 mt-4 bg-ground px-5 pt-3">
        <Button
          type="button"
          size="pill"
          onClick={save}
          disabled={anyInvalid}
          className="btn-primary w-full"
        >
          {t('common.save')}
        </Button>
      </div>

      <DeadlineSheet subjectId={subject.id} open={adding} onOpenChange={setAdding} />
    </div>
  )
}
