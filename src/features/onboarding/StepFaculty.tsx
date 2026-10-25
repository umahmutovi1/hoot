import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { FacultyFields } from '@/features/academic/FacultyFields'
import { useFacultyValue, useSaveFaculty, type FacultyValue } from '@/features/academic/faculty'
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

  useEffect(() => {
    setSave(() => save(current))
  }, [current, save]) // eslint-disable-line react-hooks/exhaustive-deps

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
