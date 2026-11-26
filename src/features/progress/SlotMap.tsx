import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { SLOT_PARTS } from '@/lib/schedule/rhythm'
import { MIN_SLOT_SESSIONS } from '@/lib/slots/signals'
import { useProgress } from './useProgress'

export function SlotMap() {
  const { t, i18n } = useTranslation()
  const data = useProgress()
  const [selected, setSelected] = useState<string | null>(null)
  if (!data) return null
  return (
    <section className="surface flex flex-col gap-3 rounded-card p-4">
      <h2 className="text-base font-semibold">{t('progress.slots.title')}</h2>
      <p className="text-xs text-ink-muted">
        {t(
          data.model.built.state.slotPeriod === 'exam'
            ? 'progress.slots.exam'
            : 'progress.slots.teaching',
        )}
      </p>
      <div className="grid grid-cols-[48px_repeat(5,minmax(0,1fr))] gap-1">
        <span />
        {SLOT_PARTS.map((p) => (
          <span key={p} className="text-center text-[10px] text-ink-muted">
            {t(`progress.parts.${p}`)}
          </span>
        ))}
        {(['weekday', 'weekend'] as const).map((kind) => (
          <Row key={kind} kind={kind} />
        ))}
      </div>
      <p className="text-xs text-ink-muted">{selected ?? t('progress.slots.hint')}</p>
    </section>
  )
  function Row({ kind }: { kind: 'weekday' | 'weekend' }) {
    return (
      <>
        <span className="self-center text-xs">{t(`progress.slots.${kind}`)}</span>
        {SLOT_PARTS.map((part) => {
          const s = data!.signals?.[kind][part]
          const known = s && s.sessions >= MIN_SLOT_SESSIONS
          const count = Math.max(0, MIN_SLOT_SESSIONS - (s?.sessions ?? 0))
          const label = known
            ? t('progress.slots.detail', {
                focus: s.focus?.toLocaleString(i18n.language, { maximumFractionDigits: 1 }) ?? '—',
                completion: Math.round(
                  (data!.model.built.state.slotCompletion?.[kind][part] ?? 0) * 100,
                ),
                count: s.sessions,
              })
            : t('progress.slots.learning', { count })
          return (
            <button
              type="button"
              key={part}
              title={label}
              aria-label={`${t(`progress.slots.${kind}`)} · ${t(`progress.parts.${part}`)} · ${label}`}
              onClick={() => setSelected(label)}
              className={`relative min-h-11 rounded-xl text-xs ${known ? (s.focus !== null && s.focus >= 2.5 ? 'bg-brand text-white' : 'bg-brand/15 text-brand') : 'bg-white/30 text-ink-muted'}`}
            >
              {known && s.focus !== null
                ? s.focus.toLocaleString(i18n.language, { maximumFractionDigits: 1 })
                : '…'}
              {known && (
                <span className="absolute inset-x-1 bottom-1 h-0.5 overflow-hidden rounded-full bg-track">
                  <span
                    className="block h-full bg-brand"
                    style={{
                      width: `${(data!.model.built.state.slotCompletion?.[kind][part] ?? 0) * 100}%`,
                    }}
                  />
                </span>
              )}
            </button>
          )
        })}
      </>
    )
  }
}
