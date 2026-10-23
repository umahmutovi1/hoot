import { useEffect, useMemo, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { MAX_IMPORT_FILES } from '@shared/schemas.ts'
import { CameraIcon, CloseIcon, DocIcon, ImageIcon } from '@/components/icons'

/**
 * DodajIzvor "Slikaj sadržaj": up to four photos (or one PDF) of the table of contents or the
 * question list, numbered in order. They are only sent for the one AI call and deleted after it.
 */
export function ImportPhotos({
  files,
  onChange,
  disabled,
}: {
  files: File[]
  onChange: (files: File[]) => void
  disabled?: boolean
}) {
  const { t } = useTranslation()
  const camera = useRef<HTMLInputElement>(null)
  const gallery = useRef<HTMLInputElement>(null)
  const previews = useMemo(
    () => files.map((f) => (f.type.startsWith('image/') ? URL.createObjectURL(f) : null)),
    [files],
  )
  useEffect(() => () => previews.forEach((p) => p && URL.revokeObjectURL(p)), [previews])

  const add = (list: FileList | null) => {
    if (!list) return
    const picked = [...files, ...Array.from(list)].slice(0, MAX_IMPORT_FILES)
    onChange(picked)
  }
  const full = files.length >= MAX_IMPORT_FILES

  return (
    <div className="flex flex-col gap-3 rounded-card-lg glass p-4">
      <div className="grid grid-cols-2 gap-2">
        {[
          { ref: camera, Icon: CameraIcon, label: t('sources.import.camera') },
          { ref: gallery, Icon: ImageIcon, label: t('sources.import.gallery') },
        ].map(({ ref, Icon, label }) => (
          <button
            key={label}
            type="button"
            disabled={disabled || full}
            onClick={() => ref.current?.click()}
            className="flex min-h-[88px] flex-col items-center justify-center gap-2 rounded-[20px] border-2 border-dashed border-line bg-canvas-soft px-3 text-center disabled:opacity-50"
          >
            <span className="flex size-11 items-center justify-center rounded-full bg-brand-soft text-brand">
              <Icon size={22} />
            </span>
            <span className="text-sm font-semibold">{label}</span>
          </button>
        ))}
      </div>
      <input
        ref={camera}
        type="file"
        accept="image/*"
        capture="environment"
        hidden
        onChange={(e) => {
          add(e.target.files)
          e.target.value = ''
        }}
      />
      <input
        ref={gallery}
        type="file"
        accept="image/*,application/pdf"
        multiple
        hidden
        onChange={(e) => {
          add(e.target.files)
          e.target.value = ''
        }}
      />

      {files.length > 0 ? (
        <div className="flex flex-wrap items-center gap-2">
          {files.map((f, i) => (
            <div
              key={`${f.name}-${i}`}
              className="relative flex h-[72px] w-14 items-center justify-center overflow-hidden rounded-[12px] bg-white/70"
            >
              {previews[i] ? (
                <img src={previews[i]!} alt="" className="size-full object-cover" />
              ) : (
                <DocIcon size={22} className="text-brand" />
              )}
              <span className="absolute bottom-1 left-1 flex size-5 items-center justify-center rounded-full bg-ink text-[11px] font-semibold text-white">
                {i + 1}
              </span>
              <button
                type="button"
                disabled={disabled}
                onClick={() => onChange(files.filter((_, j) => j !== i))}
                aria-label={t('sources.import.removePhoto', { n: i + 1 })}
                className="absolute -top-0.5 -right-0.5 flex size-7 items-center justify-center rounded-full bg-white/90 text-ink-muted"
              >
                <CloseIcon size={12} />
              </button>
            </div>
          ))}
          <span className="text-[13px] text-ink-muted">
            {t('sources.import.photos', { count: files.length })}
          </span>
        </div>
      ) : (
        <span className="text-xs text-ink-muted">{t('sources.import.photosHint')}</span>
      )}
    </div>
  )
}
