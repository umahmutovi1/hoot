import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { MAX_CUSTOM_PRESETS, sessionPresetSchema, type SessionPreset } from '@shared/schemas.ts'
import { BottomSheet } from '@/components/BottomSheet'
import { CloseIcon, PencilIcon, PlusIcon } from '@/components/icons'
import { Switch } from '@/components/Switch'
import { presetName, presetSummary, usePresets } from '@/features/session/presets'
import { cn } from '@/lib/utils'
import { useUpdateProfile } from './profile'

/**
 * "Predložak sesije" in Postavke: the default preset (also suggested in PokreniSesiju until
 * another one is used) and the user's own sequences.
 */
export function PresetSettings() {
  const { t } = useTranslation()
  const { presets, custom, defaultId } = usePresets()
  const update = useUpdateProfile()
  const [editing, setEditing] = useState<SessionPreset | 'new' | null>(null)

  const saveCustom = (list: SessionPreset[], nextDefault = defaultId) =>
    update.mutate({ session_presets: list, default_preset: nextDefault })

  return (
    <div className="flex flex-col gap-2 rounded-card glass p-4">
      <span className="text-[15px]">{t('settings.presets.title')}</span>
      <div
        role="radiogroup"
        aria-label={t('settings.presets.title')}
        className="flex flex-col gap-1.5"
      >
        {presets.map((p) => {
          const on = p.id === defaultId
          const own = custom.find((c) => c.id === p.id)
          return (
            <div
              key={p.id}
              className={cn(
                'flex items-center gap-3 rounded-[18px] px-3 py-2.5',
                on ? 'bg-white/75 shadow-[0_4px_14px_rgba(58,51,96,0.10)]' : 'bg-white/30',
              )}
            >
              <button
                type="button"
                role="radio"
                aria-checked={on}
                onClick={() => update.mutate({ default_preset: p.id })}
                className="flex min-w-0 flex-1 items-center gap-3 text-left"
              >
                <span
                  className={cn(
                    'flex size-[22px] shrink-0 items-center justify-center rounded-full border-2',
                    on ? 'border-brand-accent' : 'border-radio-ring',
                  )}
                >
                  <span className={cn('size-2.5 rounded-full', on && 'bg-brand-accent')} />
                </span>
                <span className="flex min-w-0 flex-col">
                  <span className="truncate text-[15px] font-semibold">{presetName(t, p)}</span>
                  <span className="truncate text-xs text-ink-muted">{presetSummary(t, p)}</span>
                </span>
              </button>
              {own && (
                <button
                  type="button"
                  onClick={() => setEditing(own)}
                  aria-label={t('settings.presets.edit', { name: own.name })}
                  className="flex size-11 shrink-0 items-center justify-center rounded-full text-ink-secondary"
                >
                  <PencilIcon size={18} />
                </button>
              )}
            </div>
          )
        })}
      </div>
      {custom.length < MAX_CUSTOM_PRESETS && (
        <button
          type="button"
          onClick={() => setEditing('new')}
          className="mt-1 flex h-11 items-center justify-center gap-1.5 rounded-full bg-brand-soft text-sm font-semibold text-brand"
        >
          <PlusIcon size={16} />
          {t('settings.presets.new')}
        </button>
      )}
      <span className="px-1 text-xs leading-[1.45] text-ink-muted">
        {t('settings.presets.hint')}
      </span>

      <PresetEditor
        preset={editing}
        onClose={() => setEditing(null)}
        onSave={(p) => {
          const exists = custom.some((c) => c.id === p.id)
          saveCustom(exists ? custom.map((c) => (c.id === p.id ? p : c)) : [...custom, p])
          setEditing(null)
        }}
        onDelete={(id) => {
          saveCustom(
            custom.filter((c) => c.id !== id),
            defaultId === id ? 'standard' : defaultId,
          )
          setEditing(null)
        }}
      />
    </div>
  )
}

const STEP_OPTIONS = { work: [15, 20, 25, 30, 40, 45, 50, 60, 75, 90], break: [5, 10, 15, 20, 30] }

function PresetEditor({
  preset,
  onClose,
  onSave,
  onDelete,
}: {
  preset: SessionPreset | 'new' | null
  onClose: () => void
  onSave: (p: SessionPreset) => void
  onDelete: (id: string) => void
}) {
  const { t } = useTranslation()
  return (
    <BottomSheet
      open={preset !== null}
      onOpenChange={(o) => !o && onClose()}
      title={preset === 'new' ? t('settings.presets.newTitle') : t('settings.presets.editTitle')}
      subtitle={t('settings.presets.editorSub')}
    >
      {preset !== null && (
        <EditorForm
          key={preset === 'new' ? 'new' : preset.id}
          initial={preset === 'new' ? null : preset}
          onSave={onSave}
          onDelete={onDelete}
        />
      )}
    </BottomSheet>
  )
}

function EditorForm({
  initial,
  onSave,
  onDelete,
}: {
  initial: SessionPreset | null
  onSave: (p: SessionPreset) => void
  onDelete: (id: string) => void
}) {
  const { t } = useTranslation()
  const [name, setName] = useState(initial?.name ?? '')
  const [pairs, setPairs] = useState<[number, number][]>(() => {
    const steps = initial?.steps ?? [
      { kind: 'work', min: 45 },
      { kind: 'break', min: 10 },
    ]
    const out: [number, number][] = []
    for (let i = 0; i < steps.length; i += 2) out.push([steps[i]!.min, steps[i + 1]?.min ?? 10])
    return out
  })
  const [longOn, setLongOn] = useState(Boolean(initial?.long_break))
  const [every, setEvery] = useState(initial?.long_break?.every ?? 4)
  const [longMin, setLongMin] = useState(initial?.long_break?.min ?? 20)

  const candidate = {
    id: initial?.id ?? `custom:${crypto.randomUUID()}`,
    name: name.trim(),
    steps: pairs.flatMap(([w, b]) => [
      { kind: 'work' as const, min: w },
      { kind: 'break' as const, min: b },
    ]),
    long_break: longOn ? { every, min: longMin } : null,
  }
  const parsed = sessionPresetSchema.safeParse(candidate)
  const setPair = (i: number, k: 0 | 1, v: number) =>
    setPairs((ps) => ps.map((p, j) => (j === i ? (k === 0 ? [v, p[1]] : [p[0], v]) : p)))
  const select = 'h-11 rounded-[14px] bg-canvas px-3 text-[15px] font-semibold'

  return (
    <div className="flex flex-col gap-3.5">
      <label className="flex flex-col gap-1.5">
        <span className="text-[13px] font-semibold text-ink-secondary">
          {t('settings.presets.name')}
        </span>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={40}
          placeholder={t('settings.presets.namePlaceholder')}
          className="h-12 rounded-input bg-canvas px-4 text-[15px] outline-none"
        />
      </label>
      <div className="flex flex-col gap-2">
        <span className="text-[13px] font-semibold text-ink-secondary">
          {t('settings.presets.steps')}
        </span>
        {pairs.map(([w, b], i) => (
          <div key={i} className="flex items-center gap-2">
            <select
              aria-label={t('settings.presets.work')}
              value={w}
              onChange={(e) => setPair(i, 0, Number(e.target.value))}
              className={select}
            >
              {STEP_OPTIONS.work.map((m) => (
                <option key={m} value={m}>
                  {t('settings.presets.workMin', { min: m })}
                </option>
              ))}
            </select>
            <span className="text-ink-muted">→</span>
            <select
              aria-label={t('settings.presets.break')}
              value={b}
              onChange={(e) => setPair(i, 1, Number(e.target.value))}
              className={select}
            >
              {STEP_OPTIONS.break.map((m) => (
                <option key={m} value={m}>
                  {t('settings.presets.breakMin', { min: m })}
                </option>
              ))}
            </select>
            {pairs.length > 1 && (
              <button
                type="button"
                onClick={() => setPairs((ps) => ps.filter((_, j) => j !== i))}
                aria-label={t('settings.presets.removeStep')}
                className="flex size-11 items-center justify-center text-ink-muted"
              >
                <CloseIcon size={16} />
              </button>
            )}
          </div>
        ))}
        {pairs.length < 6 && (
          <button
            type="button"
            onClick={() => setPairs((ps) => [...ps, [45, 10]])}
            className="flex h-11 items-center gap-1.5 self-start rounded-full px-3 text-sm font-semibold text-brand"
          >
            <PlusIcon size={16} />
            {t('settings.presets.addStep')}
          </button>
        )}
        <span className="text-xs text-ink-muted">{t('settings.presets.repeats')}</span>
      </div>
      <Switch checked={longOn} onChange={setLongOn} label={t('settings.presets.longBreak')} />
      {longOn && (
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <select
            aria-label={t('settings.presets.longMin')}
            value={longMin}
            onChange={(e) => setLongMin(Number(e.target.value))}
            className={select}
          >
            {[10, 15, 20, 25, 30, 45].map((m) => (
              <option key={m} value={m}>
                {t('settings.presets.breakMin', { min: m })}
              </option>
            ))}
          </select>
          <span>{t('settings.presets.after')}</span>
          <select
            aria-label={t('settings.presets.every')}
            value={every}
            onChange={(e) => setEvery(Number(e.target.value))}
            className={select}
          >
            {[2, 3, 4, 5, 6].map((n) => (
              <option key={n} value={n}>
                {t('settings.presets.intervals', { count: n })}
              </option>
            ))}
          </select>
        </div>
      )}
      <button
        type="button"
        disabled={!parsed.success}
        onClick={() => parsed.success && onSave(parsed.data)}
        className="btn-primary h-14 rounded-full text-base font-semibold"
      >
        {t('common.save')}
      </button>
      {initial && (
        <button
          type="button"
          onClick={() => onDelete(initial.id)}
          className="h-12 rounded-full bg-canvas text-[15px] font-semibold text-danger"
        >
          {t('settings.presets.delete')}
        </button>
      )}
    </div>
  )
}
