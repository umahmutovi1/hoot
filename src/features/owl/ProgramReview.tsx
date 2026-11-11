import { useTranslation } from 'react-i18next'
import { Switch } from '@/components/Switch'
import type { ProgramProposal, ProgramSubjectProposal } from '@/lib/import/program'

const sectionTitle = 'px-1 pt-1 text-[13px] font-semibold text-ink-muted uppercase'

/**
 * "Pregled uvoza · Studijski program" (Sprint 16): every semester with its subjects. New ones of
 * this and later semesters are preselected; earlier semesters and electives wait for a tap; a
 * subject the student already has stays.
 */
export function ProgramReview({
  program,
  saved,
  onToggle,
}: {
  program: ProgramProposal
  saved: boolean
  onToggle: (key: string, include: boolean) => void
}) {
  const { t } = useTranslation()
  return (
    <>
      <p className="px-1 text-[13px] leading-[1.4] text-ink-muted">{t('owl.program.hint')}</p>
      {program.semesters.map((s) => (
        <section key={s.semester} className="flex flex-col gap-2">
          <h2 className={sectionTitle}>
            {t('owl.program.semester', { n: s.semester, year: s.yearLabel ?? '' }).trim()}
            {s.past && ` · ${t('owl.program.past')}`}
          </h2>
          <div className="flex flex-col rounded-card surface px-4 py-1">
            {s.subjects.map((x: ProgramSubjectProposal) => (
              <div
                key={x.key}
                className="flex items-center justify-between gap-3 border-b border-canvas py-2 last:border-b-0"
              >
                <span className="flex min-w-0 flex-col">
                  <span className="truncate text-[15px] font-medium">{x.name}</span>
                  <span className="text-xs text-ink-muted">
                    {[
                      x.electiveGroup && t('owl.program.elective', { group: x.electiveGroup }),
                      x.ects !== null && t('owl.program.ects', { n: x.ects }),
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </span>
                </span>
                {x.existingId ? (
                  <span className="shrink-0 text-xs font-semibold text-ink-muted">
                    {t('owl.syllabus.have')}
                  </span>
                ) : (
                  <Switch
                    checked={x.include}
                    label={x.name}
                    hideLabel
                    disabled={saved}
                    onChange={(include) => onToggle(x.key, include)}
                  />
                )}
              </div>
            ))}
          </div>
        </section>
      ))}
    </>
  )
}
