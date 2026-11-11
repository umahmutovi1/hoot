import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { PresetChips } from './PresetChips'
import { presetName, presetSummary, usePresets } from './presets'

/**
 * Pauses in one row (StartSesije, PokreniSesiju; PRD "Dopune, 5. nov 2026"): the rhythm Hoot uses,
 * read-only, with "Promijeni" opening the preset chips under it. `sub` replaces the preset's own
 * line (the planned block says it is the default the block was built on).
 */
export function RhythmRow({
  value,
  onChange,
  sub,
}: {
  value: string
  onChange: (id: string) => void
  sub?: string
}) {
  const { t } = useTranslation()
  const { resolve } = usePresets()
  const [open, setOpen] = useState(false)
  const preset = resolve(value)
  return (
    <div className="flex flex-col gap-2">
      <div className="flex min-h-[52px] items-center gap-3 rounded-row pr-1 pl-4 shadow-[inset_0_0_0_1.5px_var(--color-line)]">
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
          {t('common.change')}
        </button>
      </div>
      {open && (
        <PresetChips
          label={t('session.start.breaks')}
          value={value}
          onChange={(id) => {
            onChange(id)
            setOpen(false)
          }}
        />
      )}
    </div>
  )
}
