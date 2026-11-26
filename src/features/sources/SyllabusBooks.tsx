import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { CheckIcon } from '@/components/icons'
import { cn } from '@/lib/utils'
import type { SyllabusBook } from '@/lib/import/syllabus'

/**
 * Dodaj izvor → "Koje od ovoga koristiš?" (board DodajIzvor): the subject's syllabus books that
 * are not a source yet. Nothing is ticked until the user says they use it (PRD).
 */
export function SyllabusBooks({
  books,
  institution,
  onAdd,
  onNone,
}: {
  books: (SyllabusBook & { index: number })[]
  institution: string | null
  onAdd: (indexes: number[]) => void
  onNone: () => void
}) {
  const { t } = useTranslation()
  const [picked, setPicked] = useState<number[]>([])
  const toggle = (index: number) =>
    setPicked((p) => (p.includes(index) ? p.filter((x) => x !== index) : [...p, index]))
  // In the order they are listed, so the editor opens them top to bottom.
  const ordered = books.map((b) => b.index).filter((i) => picked.includes(i))

  return (
    <section className="next-card flex flex-col gap-2.5 rounded-card p-4">
      <div className="flex flex-col gap-0.5">
        <span className="text-[13px] font-bold text-brand-strong">
          {institution ? t('sources.syllabus.fromAt', { institution }) : t('sources.syllabus.from')}
        </span>
        <h2 className="text-[22px] leading-[1.15] font-bold">{t('sources.syllabus.title')}</h2>
      </div>
      <div role="group" aria-label={t('sources.syllabus.group')} className="flex flex-col gap-1.5">
        {books.map((b) => {
          const on = picked.includes(b.index)
          return (
            <button
              key={b.index}
              type="button"
              role="checkbox"
              aria-checked={on}
              onClick={() => toggle(b.index)}
              className={cn(
                'flex min-h-16 items-center gap-3 rounded-[16px] px-3 py-2.5 text-left transition-colors',
                on ? 'bg-raised ring-2 ring-brand ring-inset' : 'bg-raised/70',
              )}
            >
              <span
                aria-hidden="true"
                className={cn(
                  'flex size-6 shrink-0 items-center justify-center rounded-[7px] border-2 text-ground',
                  on ? 'border-brand bg-brand' : 'border-ink/30',
                )}
              >
                {on && <CheckIcon size={14} strokeWidth={3} />}
              </span>
              <span className="flex min-w-0 flex-1 flex-col gap-px">
                <b className="text-[15px]">{b.authors ? `${b.authors}, ${b.title}` : b.title}</b>
                <span className="text-[13px] text-ink-secondary">
                  {t(b.required ? 'sources.syllabus.required' : 'sources.syllabus.extra')}
                </span>
              </span>
            </button>
          )
        })}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={ordered.length === 0}
          onClick={() => onAdd(ordered)}
          className="flex h-12 items-center rounded-[16px] px-[18px] text-[15px] font-bold btn-primary disabled:text-brand-strong"
        >
          {ordered.length > 0
            ? t('sources.syllabus.add', { count: ordered.length })
            : t('sources.syllabus.pick')}
        </button>
        <button
          type="button"
          onClick={onNone}
          className="flex h-12 items-center px-2.5 text-[15px] font-bold text-brand-strong"
        >
          {t('sources.syllabus.none')}
        </button>
      </div>
      <span className="text-[13px] leading-[1.4] text-brand-strong">
        {t('sources.syllabus.hint')}
      </span>
    </section>
  )
}
