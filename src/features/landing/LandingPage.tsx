import { useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { LocaleToggle } from '@/components/LocaleToggle'
import { LogoMark } from '@/components/Logo'
import { cn } from '@/lib/utils'
import { useLocale } from '@/features/settings/useLocale'

/**
 * Public `/` for signed-out visitors, in the Noćna sova style (Sprint 19; no board, built from the
 * system in docs/design/README.md): the blue header with the wave, the promise and "Počni", a
 * screenshot of Danas over the wave, what Hoot does, how to start and a sky closing card. One
 * column, centred on wide screens. The screenshot is a JPEG per locale in `public/landing/`
 * (`npm run landing:shots`); without it the frame is left out.
 */
export function LandingPage() {
  const { t } = useTranslation()
  const { locale, setLocale } = useLocale()
  const [shot, setShot] = useState(true)

  return (
    <div className="min-h-dvh bg-ground pb-12 text-ink">
      <section
        className={cn(
          'relative bg-brand text-ground',
          shot ? 'pb-36' : 'pb-16',
          'pt-[env(safe-area-inset-top)]',
        )}
      >
        <div className="mx-auto flex w-full max-w-[440px] flex-col px-4">
          <header className="flex h-16 items-center gap-2">
            <span className="flex flex-1 items-center gap-2 font-display text-[22px] font-bold tracking-[-0.02em]">
              <LogoMark />
              hoot
            </span>
            <LocaleToggle
              value={locale}
              onChange={setLocale}
              variant="short"
              tone="dark"
              className="bg-ground/12"
            />
            <Link
              to="/login"
              className="flex h-11 items-center pr-1 pl-2 text-[15px] font-semibold"
            >
              {t('landing.signIn')}
            </Link>
          </header>

          <h1 className="mt-8 px-1 text-[44px] leading-[1.02] font-bold whitespace-pre-line">
            {t('auth.headline')}
          </h1>
          <p className="mt-4 px-1 text-[17px] leading-[1.45] text-ground/85">{t('landing.lead')}</p>
          <Link
            to="/login"
            className="mt-6 flex h-14 items-center justify-center rounded-[16px] bg-ground text-[17px] font-bold text-brand-strong"
          >
            {t('landing.start')}
          </Link>
          <span className="mt-3 text-center text-[13px] text-ground/75">
            {t('landing.devices')}
          </span>
        </div>
        <svg
          viewBox="0 0 390 40"
          preserveAspectRatio="none"
          aria-hidden="true"
          className="absolute inset-x-0 -bottom-px block h-10 w-full text-ground"
        >
          <path
            d="M0 22 C 48 2, 104 2, 150 18 C 176 28, 214 28, 240 18 C 286 2, 342 2, 390 22 V40 H0 Z"
            fill="currentColor"
          />
        </svg>
      </section>

      <div className="mx-auto flex w-full max-w-[440px] flex-col px-4">
        {shot && (
          <div className="relative z-10 -mt-28 flex justify-center">
            <div className="w-[252px] rounded-[42px] bg-ink p-2 shadow-[0_24px_60px_rgb(23_24_31/0.28)]">
              <img
                src={`/landing/today-${locale}.jpg`}
                alt={t('landing.shotAlt')}
                width={236}
                height={511}
                loading="lazy"
                onError={() => setShot(false)}
                className="block h-auto w-full rounded-[34px]"
              />
            </div>
          </div>
        )}

        <section className="flex flex-col gap-2.5 pt-10">
          <h2 className="px-1 pb-1 text-[26px] leading-tight font-bold">
            {t('landing.what.title')}
          </h2>
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

        <section className="flex flex-col gap-4 pt-10">
          <h2 className="px-1 text-[26px] leading-tight font-bold">{t('landing.how.title')}</h2>
          <ol className="flex flex-col gap-3">
            {(['signIn', 'subjects', 'today'] as const).map((step, i) => (
              <li key={step} className="flex items-start gap-3.5 px-1">
                <span className="next-card flex size-9 shrink-0 items-center justify-center rounded-full font-display text-[17px] font-bold tabular-nums">
                  {i + 1}
                </span>
                <span className="pt-1.5 text-[15px] leading-snug">
                  <b>{t(`landing.how.${step}`)}</b> {t(`landing.how.${step}Body`)}
                </span>
              </li>
            ))}
          </ol>
        </section>

        <section className="next-card mt-10 flex flex-col gap-3 rounded-card p-5">
          <h2 className="text-[24px] leading-tight font-bold">{t('landing.cta.title')}</h2>
          <p className="text-[15px] leading-snug text-brand-strong">{t('landing.cta.body')}</p>
          <Link
            to="/login"
            className="btn-primary mt-1 flex h-14 items-center justify-center rounded-[16px] text-[17px] font-bold"
          >
            {t('landing.cta.button')}
          </Link>
        </section>

        <footer className="flex items-center justify-center gap-2 pt-8 text-[13px] text-ink-muted">
          <LogoMark width={20} />
          Hoot
        </footer>
      </div>
    </div>
  )
}

function Feature({ icon, title, body }: { icon: ReactNode; title: string; body: string }) {
  return (
    <div className="surface flex gap-3.5 rounded-card p-4">
      <span className="icon-tile flex size-11 shrink-0 items-center justify-center rounded-[14px]">
        <svg
          width="22"
          height="22"
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
        <h3 className="font-display text-[18px] leading-tight font-bold">{title}</h3>
        <p className="text-[15px] leading-[1.4] text-ink-secondary">{body}</p>
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
