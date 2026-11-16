import { useTranslation } from 'react-i18next'
import { GENDERS, type Gender } from '@/lib/address'
import { cn } from '@/lib/utils'

/**
 * "Kako da ti se obraćam?": the form of the Bosnian copy, shown by example ("Spremna si" /
 * "Spreman si"). Nothing is picked until the user chooses.
 */
export function AddressToggle({
  value,
  onChange,
  className,
}: {
  value: Gender | null
  onChange: (gender: Gender) => void
  className?: string
}) {
  const { t } = useTranslation()
  return (
    <div
      role="radiogroup"
      aria-label={t('onboarding.name.address')}
      className={cn('flex rounded-[18px] p-[3px]', className)}
    >
      {GENDERS.map((gender) => (
        <button
          key={gender}
          type="button"
          role="radio"
          aria-checked={value === gender}
          onClick={() => onChange(gender)}
          className={cn(
            'tap h-[34px] rounded-[15px] px-3.5 text-[13px] font-semibold transition-colors',
            value === gender ? 'surface text-ink' : 'bg-transparent text-ink',
          )}
        >
          {t(gender === 'female' ? 'onboarding.name.addressFemale' : 'onboarding.name.addressMale')}
        </button>
      ))}
    </div>
  )
}
