import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'
import { LOCALES, type Locale } from '@/lib/locale'

type Props = {
  value: Locale
  onChange: (locale: Locale) => void
  /** "short" = BS/EN chips on the login hero, "long" = full names in settings. */
  variant?: 'short' | 'long'
  /** "dark" = on the blue header (landing): light text, the picked one on the ground colour. */
  tone?: 'light' | 'dark'
  className?: string
}

export function LocaleToggle({
  value,
  onChange,
  variant = 'long',
  tone = 'light',
  className,
}: Props) {
  const { t } = useTranslation()
  return (
    <div
      role="radiogroup"
      aria-label={t('settings.language')}
      className={cn('flex rounded-[18px] p-[3px]', className)}
    >
      {LOCALES.map((locale) => (
        <button
          key={locale}
          type="button"
          role="radio"
          aria-checked={value === locale}
          onClick={() => onChange(locale)}
          className={cn(
            'rounded-[15px] text-[13px] font-semibold transition-colors',
            variant === 'short' ? 'h-8 px-3' : 'h-[34px] px-3.5',
            tone === 'dark'
              ? value === locale
                ? 'bg-ground text-brand-strong'
                : 'bg-transparent text-ground/80'
              : value === locale
                ? 'surface text-ink'
                : 'bg-transparent text-ink',
          )}
        >
          {t(variant === 'short' ? `locale.${locale}Short` : `locale.${locale}`)}
        </button>
      ))}
    </div>
  )
}
