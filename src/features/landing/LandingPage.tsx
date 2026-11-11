import { useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { LocaleToggle } from '@/components/LocaleToggle'
import { Logo } from '@/components/Logo'
import { useLocale } from '@/features/settings/useLocale'

/**
 * Public `/` for signed-out visitors (Landing.dc.html): what Hoot does, a screenshot of Danas and
 * "Počni". One column, centred on wide screens. The screenshot is a JPEG per locale in
 * `public/landing/` (`npm run landing:shots`); without it the frame is left out.
 */
export function LandingPage() {
  const { t } = useTranslation()
  const { locale, setLocale } = useLocale()
  const [shot, setShot] = useState(true)

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-[440px] flex-col pb-10">
      <header className="flex h-16 items-center gap-2.5 px-[18px] pt-[env(safe-area-inset-top)]">
        <Logo size={28} />
        <span className="flex-1 text-lg font-bold">Hoot</span>
        <LocaleToggle value={locale} onChange={setLocale} variant="short" className="bg-white/60" />
        <Link
          to="/login"
          className="flex h-11 items-center pr-1 pl-2 text-[15px] font-semibold text-brand"
        >
          {t('landing.signIn')}
        </Link>
      </header>

      <section className="flex flex-col gap-3.5 px-6 pt-7">
        <h1 className="text-[34px] leading-[1.1] font-bold whitespace-pre-line">
          {t('auth.headline')}
        </h1>
        <p className="text-base leading-[1.45] text-ink-secondary">{t('landing.lead')}</p>
        <Link
          to="/login"
          className="btn-primary mt-1.5 flex h-14 items-center justify-center rounded-full text-base font-semibold"
        >
          {t('landing.start')}
        </Link>
        <span className="text-center text-xs text-ink-muted">{t('landing.devices')}</span>
      </section>

      {shot && (
        <div className="flex justify-center pt-6 pb-2">
          <div className="w-[250px] rounded-[40px] bg-ink p-2 shadow-[0_24px_60px_rgb(58_51_96/0.3)]">
            <img
              src={`/landing/today-${locale}.jpg`}
              alt={t('landing.shotAlt')}
              width={234}
              height={507}
              loading="lazy"
              onError={() => setShot(false)}
              className="block h-auto w-full rounded-[33px]"
            />
          </div>
        </div>
      )}

      <section className="flex flex-col gap-3 px-[18px] pt-7">
        <h2 className="px-1.5 text-[22px] leading-tight font-bold">{t('landing.what.title')}</h2>
        <Feature
          icon={<CalendarPath />}
          title={t('landing.what.plan')}
          body={t('landing.what.planBody')}
        />
        <Feature
          icon={<ReplanPath />}
          title={t('landing.what.adapt')}
          body={t('landing.what.adaptBody')}
        />
        <Feature
          icon={<BulbPath />}
          title={t('landing.what.remember')}
          body={t('landing.what.rememberBody')}
        />
      </section>

      <section className="flex flex-col gap-3.5 px-6 pt-7">
        <h2 className="text-[22px] leading-tight font-bold">{t('landing.how.title')}</h2>
        <ol className="flex flex-col gap-3.5">
          {(['signIn', 'subjects', 'today'] as const).map((step, i) => (
            <li key={step} className="flex items-baseline gap-3 text-[15px] leading-snug">
              <span className="w-[18px] shrink-0 font-bold text-brand-accent">{i + 1}</span>
              <span>
                <b>{t(`landing.how.${step}`)}</b> {t(`landing.how.${step}Body`)}
              </span>
            </li>
          ))}
        </ol>
      </section>

      <section className="px-[18px] pt-8">
        <div className="hero flex flex-col gap-3 rounded-card-lg px-5 py-6 text-white">
          <h2 className="text-xl font-bold">{t('landing.cta.title')}</h2>
          <p className="text-sm leading-snug text-white/88">{t('landing.cta.body')}</p>
          <Link
            to="/login"
            className="flex h-14 items-center justify-center rounded-full bg-white text-base font-semibold text-brand"
          >
            {t('landing.cta.button')}
          </Link>
        </div>
      </section>
    </div>
  )
}

function Feature({ icon, title, body }: { icon: ReactNode; title: string; body: string }) {
  return (
    <div className="surface flex gap-3.5 rounded-[26px] p-[18px]">
      <span className="icon-tile flex size-10 shrink-0 items-center justify-center rounded-[13px]">
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.8}
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          {icon}
        </svg>
      </span>
      <div className="flex flex-col gap-1">
        <h3 className="text-base font-semibold">{title}</h3>
        <p className="text-sm leading-[1.4] text-ink-secondary">{body}</p>
      </div>
    </div>
  )
}

const CalendarPath = () => (
  <>
    <rect x="3.5" y="5" width="17" height="15" rx="3" />
    <path d="M3.5 10h17M8 3v4M16 3v4" />
  </>
)
const ReplanPath = () => (
  <path d="M4 12a8 8 0 0 1 14-5.3L20 9M20 4v5h-5M20 12a8 8 0 0 1-14 5.3L4 15M4 20v-5h5" />
)
const BulbPath = () => <path d="M12 3a6 6 0 0 0-3.5 10.9V17h7v-3.1A6 6 0 0 0 12 3zM9.5 20.5h5" />
