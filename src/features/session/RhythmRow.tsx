import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Switch } from '@/components/Switch'
import { parseRhythmId, RHYTHM_BREAK, RHYTHM_WORK, rhythmId } from '@/lib/session/timer'
import { cn } from '@/lib/utils'
import { presetName, presetSummary, usePresets } from './presets'
import { Stepper } from './Stepper'

const clamp = (v: number, r: { min: number; max: number }) => Math.max(r.min, Math.min(r.max, v))

/**
 * Pauses in one row (StartSesije, PokreniSesiju; PRD "Dopune, 5. nov 2026"): the rhythm Hoot uses,
 * read-only, with "Promijeni" opening the rhythms as cards and "Svoj ritam" (study and break
 * minutes, "Koristi i ubuduće"). `sub` replaces the preset's own line (the planned block says it
 * is the default the block was built on).
 */
export function RhythmRow({
  value,
  onChange,
  sub,
  keep,
  onKeepChange,
}: {
  value: string
  onChange: (id: string) => void
  sub?: string
  /** "Koristi i ubuduće" for "Svoj ritam"; saved by the caller when the session starts. */
  keep: boolean
  onKeepChange: (keep: boolean) => void
}) {
  const { t } = useTranslation()
  const { presets, defaultId, resolve } = usePresets()
  const [open, setOpen] = useState(false)
  const preset = resolve(value)
  const own = parseRhythmId(value)
  const [work, setWork] = useState(own?.work ?? 40)
  const [pause, setPause] = useState(own?.pause ?? 10)
  const setOwn = (w: number, p: number) => {
    setWork(w)
    setPause(p)
    onChange(rhythmId(w, p))
  }
  const card = (on: boolean) =>
    cn(
      'flex min-h-[60px] flex-col justify-center gap-0.5 rounded-[16px] px-3.5 py-2 text-left transition-colors',
      on ? 'bg-brand text-ground' : 'surface text-ink',
    )
  const cardSub = (on: boolean) =>
    cn('text-[13px] tabular-nums', on ? 'text-ground/80' : 'text-ink-secondary')

  return (
    <div className="flex flex-col gap-2">
      <div className="flex min-h-14 items-center gap-2 rounded-row py-1.5 pr-1 pl-4 shadow-[inset_0_0_0_1.5px_var(--color-line)]">
        <span className="flex min-w-0 flex-1 flex-col gap-px">
          <span className="text-[15px] font-bold">{presetName(t, preset)}</span>
          <span className="text-[13px] text-ink-secondary">{sub ?? presetSummary(t, preset)}</span>
        </span>
        <button
          type="button"
          aria-expanded={open}
          onClick={() => setOpen((o) => !o)}
          className="flex h-11 shrink-0 items-center px-3 text-[15px] font-bold text-brand-strong"
        >
          {open ? t('session.rhythm.done') : t('common.change')}
        </button>
      </div>
      {open && (
        <div className="flex animate-settle-in flex-col gap-2">
          <div
            role="radiogroup"
            aria-label={t('session.rhythm.label')}
            className="grid grid-cols-2 gap-2"
          >
            {presets.map((p) => {
              const on = p.id === value
              return (
                <button
                  key={p.id}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  onClick={() => onChange(p.id)}
                  className={card(on)}
                >
                  <b className="text-[15px]">{presetName(t, p)}</b>
                  <span className={cardSub(on)}>
                    {p.id === defaultId ? t('session.rhythm.yourDefault') : presetSummary(t, p)}
                  </span>
                </button>
              )
            })}
            <button
              type="button"
              role="radio"
              aria-checked={own !== null}
              onClick={() => setOwn(work, pause)}
              className={card(own !== null)}
            >
              <b className="text-[15px]">{t('session.rhythm.own')}</b>
              <span className={cardSub(own !== null)}>
                {own ? t('session.rhythm.value', own) : t('session.rhythm.ownSub')}
              </span>
            </button>
          </div>
          {own && (
            <div className="flex animate-settle-in flex-col gap-2">
              <Stepper
                label={t('session.rhythm.study')}
                value={t('session.rhythm.minutes', { count: work })}
                less={t('session.rhythm.studyLess')}
                more={t('session.rhythm.studyMore')}
                onLess={() => setOwn(clamp(work - 5, RHYTHM_WORK), pause)}
                onMore={() => setOwn(clamp(work + 5, RHYTHM_WORK), pause)}
                min={work <= RHYTHM_WORK.min}
                max={work >= RHYTHM_WORK.max}
              />
              <Stepper
                label={t('session.rhythm.break')}
                value={t('session.rhythm.minutes', { count: pause })}
                less={t('session.rhythm.breakLess')}
                more={t('session.rhythm.breakMore')}
                onLess={() => setOwn(work, clamp(pause - (pause > 5 ? 5 : 1), RHYTHM_BREAK))}
                onMore={() => setOwn(work, clamp(pause + (pause >= 5 ? 5 : 1), RHYTHM_BREAK))}
                min={pause <= RHYTHM_BREAK.min}
                max={pause >= RHYTHM_BREAK.max}
              />
              <div className="flex min-h-[52px] items-center gap-3 px-1">
                <span className="flex flex-1 flex-col gap-px">
                  <span className="text-[15px] font-semibold">{t('session.rhythm.keep')}</span>
                  <span className="text-xs text-ink-secondary">{t('session.rhythm.keepSub')}</span>
                </span>
                <Switch
                  checked={keep}
                  onChange={onKeepChange}
                  label={t('session.rhythm.keepLabel')}
                  hideLabel
                />
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
