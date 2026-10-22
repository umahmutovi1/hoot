import { useTranslation } from 'react-i18next'
import { Chip } from './Chip'
import { presetName, usePresets } from './presets'

/** Preset chips ("Pauze"): built-in ones, then the user's own. */
export function PresetChips({
  value,
  onChange,
  label,
}: {
  value: string
  onChange: (id: string) => void
  label: string
}) {
  const { t } = useTranslation()
  const { presets } = usePresets()
  return (
    <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-1.5">
      {presets.map((p) => (
        <Chip key={p.id} selected={p.id === value} onClick={() => onChange(p.id)}>
          {presetName(t, p)}
        </Chip>
      ))}
    </div>
  )
}
