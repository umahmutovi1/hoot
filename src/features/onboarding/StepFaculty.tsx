import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { FacultyFields } from '@/features/academic/FacultyFields'
import { useFacultyValue, useSaveFaculty, type FacultyValue } from '@/features/academic/faculty'
import { useFindAcademicInfo } from '@/features/academic/search'
import { yearLabelOn } from '@/lib/academic'
import { localDay } from '@/lib/day'
import { StepTitle, type StepProps } from './OnboardingPage'

/**
 * Step 1b "Gdje studiraš?" (optional, AkademskaGodina.dc.html 4): faculty, program, year of study
 * and semester; saves them and the first academic year. "Preskoči" is always there.
 */
export function StepFaculty({ setSave }: StepProps) {
  const { t } = useTranslation()
  const initial = useFacultyValue()
  const [value, setValue] = useState<FacultyValue | null>(null)
  const current = value ?? initial
  const save = useSaveFaculty()

  const find = useFindAcademicInfo()

  // `current`, `save` and `find` are new objects on every render; registering the save on each
  // change re-rendered the shell, which rendered this step again, in a loop that froze the screen.
  // The save is registered once and reads the latest values from a ref.
  const latest = useRef({ current, save, find })
  useEffect(() => {
    latest.current = { current, save, find }
  })
  useEffect(() => {
    setSave(async () => {
      const { current, save, find } = latest.current
      await save(current)
      // "Fakultet s interneta" runs in the background; what it finds waits in the next step.
      if (current.institution.trim()) find.mutate(yearLabelOn(localDay(new Date())))
    })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <>
      <StepTitle title={t('academic.onboarding.title')} sub={t('academic.onboarding.sub')} />
      <FacultyFields value={current} onChange={setValue} withSemester />
      <span className="px-1 text-xs leading-[1.4] text-ink-muted">
        {t('academic.onboarding.privacy')}
      </span>
    </>
  )
}
