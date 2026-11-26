import { useEffect, useState, type CSSProperties, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { addDays, format } from 'date-fns'
import { LocaleToggle } from '@/components/LocaleToggle'
import { LogoMark } from '@/components/Logo'
import { useLocale } from '@/features/settings/useLocale'
import { dateFnsLocales } from '@/lib/locale'
import { cn } from '@/lib/utils'
import './landing.css'

/**
 * Public `/` for signed-out visitors (board "Landing · A Noćna sova", Main.dc.html): the first
 * screen is the promise, the owl and "Počni"; below it the day's cards shuffle, what Hoot does,
 * and "Danas ne mogu" moving the plan by one day. One column, centred on wide screens. The
 * animations start when their section is in view and never with reduced motion.
 */
export function LandingPage() {
  const { t } = useTranslation()
  const { locale, setLocale } = useLocale()

  return (
    <div className="min-h-dvh bg-ground pb-10 text-ink">
      <div className="flex min-h-dvh flex-col">
        <section className="relative bg-brand px-6 pt-[calc(20px+env(safe-area-inset-top))] pb-[92px] text-ground">
          <div className="mx-auto w-full max-w-[440px]">
            <div className="flex h-11 items-center justify-between">
              <span className="flex items-center gap-2.5 font-display text-[28px] font-extrabold tracking-[-0.02em]">
                <LogoMark width={32} />
                hoot
              </span>
              <Link to="/login" className="flex h-11 items-center text-[15px] font-semibold">
                {t('landing.signIn')}
              </Link>
            </div>
            <h1 className="mt-10 text-[52px] leading-[0.98] font-extrabold tracking-[-0.035em] whitespace-pre-line">
              {t('landing.headline')}
            </h1>
            <p className="mt-4 max-w-[300px] text-[17px] leading-6 text-ground/82">
              {t('landing.lead')}
            </p>
          </div>
          <Wave />
        </section>

        <div className="flex min-h-[160px] flex-1 items-center justify-center">
          <svg
            width="240"
            height="132"
            viewBox="0 0 240 132"
            role="img"
            aria-label={t('landing.owl')}
          >
            <ellipse cx="78" cy="58" rx="22" ry="34" className="fill-ink" />
            <ellipse cx="162" cy="58" rx="22" ry="34" className="fill-ink" />
            <circle cx="85" cy="44" r="7" className="fill-ground" />
            <circle cx="169" cy="44" r="7" className="fill-ground" />
            <path d="M108 100 Q120 94 132 100 L123 118 Q120 123 117 118 Z" className="fill-ai" />
          </svg>
        </div>

        <div className="mx-auto flex w-full max-w-[440px] flex-col gap-2 px-6 pb-7">
          <Link
            to="/login"
            className="btn-primary flex h-14 items-center justify-center rounded-[16px] text-[17px] font-bold"
          >
            {t('landing.start')}
          </Link>
          <Link
            to="/login"
            className="flex h-12 items-center justify-center text-[15px] font-semibold text-brand"
          >
            {t('landing.haveAccount')}
          </Link>
        </div>
      </div>

      <div className="mx-auto w-full max-w-[440px]">
        <DaySection />
        <LearnSection />
        <ReplanSection />

        <footer className="mt-10 flex items-center justify-between gap-3 px-6 text-sm text-ink-muted">
          <span className="flex items-center gap-2 font-display text-[22px] font-extrabold text-brand">
            <LogoMark width={26} className="text-brand" />
            hoot
          </span>
          <span className="flex items-center gap-2">
            <LocaleToggle value={locale} onChange={setLocale} variant="short" />
            <Link to="/login" className="flex h-11 items-center px-1 font-semibold text-brand">
              {t('landing.signIn')}
            </Link>
          </span>
        </footer>
      </div>
    </div>
  )
}

function Wave() {
  return (
    <svg
      viewBox="0 0 390 64"
      preserveAspectRatio="none"
      aria-hidden="true"
      className="absolute inset-x-0 -bottom-px block h-16 w-full text-ground"
    >
      <path
        d="M0 34 C 48 6, 104 6, 150 30 C 176 44, 214 44, 240 30 C 286 6, 342 6, 390 34 V64 H0 Z"
        fill="currentColor"
      />
    </svg>
  )
}

/** `.ld-on` once the element is half in view; never with reduced motion. */
function useReveal<T extends HTMLElement>() {
  const [el, setEl] = useState<T | null>(null)
  const [on, setOn] = useState(false)
  useEffect(() => {
    if (!el || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return
    const io = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) return
        setOn(true)
        io.disconnect()
      },
      { threshold: 0.45 },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [el])
  return { attach: setEl, onClass: on ? 'ld-on' : '' }
}

const h2 =
  'font-display text-[30px] leading-[1.05] font-extrabold tracking-[-0.02em] whitespace-pre-line'

/** "Ujutro otvoriš": three day cards stacked like a deck, shuffling. */
function DaySection() {
  const { t } = useTranslation()
  const { attach, onClass } = useReveal<HTMLDivElement>()
  const cards = [
    {
      cls: 'ld-s2',
      tone: 'bg-subject-lavender-soft text-subject-lavender-ink',
      muted: 'text-subject-lavender-ink/80',
      head: '11:11',
      min: 30,
      chapter: 2,
      subject: 3,
      days: 26,
      style: { transform: 'translate(28px,30px) rotate(7deg)', zIndex: 1 },
    },
    {
      cls: 'ld-s1',
      tone: 'next-card',
      muted: 'text-ink-secondary',
      head: '10:25',
      min: 31,
      chapter: 3,
      subject: 2,
      days: 19,
      style: { transform: 'translate(14px,15px) rotate(3deg)', zIndex: 2 },
    },
    {
      cls: 'ld-s0',
      tone: 'hero',
      muted: 'text-ground/82',
      head: t('landing.day.next', { time: '09:20' }),
      min: 50,
      chapter: 4,
      subject: 1,
      days: 12,
      style: { transform: 'rotate(-2deg)', zIndex: 3 },
    },
  ]
  return (
    <section className="mx-5 mt-12 flex flex-col gap-[22px]">
      <h2 className={cn(h2, 'text-brand-strong')}>{t('landing.day.title')}</h2>
      <div
        ref={attach}
        role="img"
        aria-label={t('landing.day.alt')}
        className={cn('relative h-[250px]', onClass)}
      >
        {cards.map((c) => (
          <div
            key={c.cls}
            style={c.style}
            className={cn(
              c.cls,
              c.tone,
              'absolute top-0 left-1 flex w-[min(318px,calc(100%-40px))] flex-col gap-3.5 rounded-[28px] p-5 shadow-[0_16px_34px_rgb(34_57_90/0.24)]',
            )}
          >
            <div className="flex items-center justify-between">
              <span className={cn('text-[13px] font-bold', c.muted)}>{c.head}</span>
              <span className="flex h-[26px] items-center rounded-[13px] bg-white/18 px-2.5 text-xs font-bold tabular-nums">
                {t('landing.day.minutes', { n: c.min })}
              </span>
            </div>
            <div className="flex flex-col gap-0.5">
              <span className="font-display text-[26px] leading-[1.1] font-extrabold tracking-[-0.01em]">
                {t('landing.day.chapter', { n: c.chapter })}
              </span>
              <span className={cn('text-sm', c.muted)}>
                {t('landing.day.subject', {
                  n: c.subject,
                  exam: t('landing.day.examIn', { count: c.days }),
                })}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm font-bold">{t('landing.day.reading')}</span>
              <span className="flex size-[52px] items-center justify-center rounded-full bg-ai text-ink">
                <svg
                  width="14"
                  height="16"
                  viewBox="0 0 12 14"
                  fill="currentColor"
                  aria-hidden="true"
                >
                  <path d="M1 1.5v11a1 1 0 0 0 1.5.86l9-5.5a1 1 0 0 0 0-1.72l-9-5.5A1 1 0 0 0 1 1.5z" />
                </svg>
              </span>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}

const chip =
  'flex h-[26px] items-center self-start rounded-[13px] bg-surface px-2.5 text-xs font-bold text-brand-strong'

/** "Plan koji uči zajedno s tobom": the model, rescheduling and progress, each with an example. */
function LearnSection() {
  const { t } = useTranslation()
  return (
    <section className="mx-6 mt-14 flex flex-col gap-2">
      <h2 className={cn(h2, 'text-brand-strong')}>{t('landing.learn.title')}</h2>
      <ul className="mt-2 flex flex-col">
        <Item icon={<BrainIcon />} title={t('landing.learn.ml')} body={t('landing.learn.mlBody')}>
          <span className={cn(chip, 'mt-1.5 tabular-nums')}>{t('landing.learn.mlChip')}</span>
        </Item>
        <Item
          icon={<CalendarRepeatIcon />}
          title={t('landing.learn.adapt')}
          body={t('landing.learn.adaptBody')}
        >
          <span className="mt-1.5 flex flex-wrap gap-1.5">
            {(['missed', 'less', 'deadline'] as const).map((k) => (
              <span key={k} className={chip}>
                {t(`landing.learn.adaptChip.${k}`)}
              </span>
            ))}
          </span>
        </Item>
        <Item
          icon={<ChartIcon />}
          title={t('landing.learn.progress')}
          body={t('landing.learn.progressBody')}
          last
        >
          <span className="mt-2 flex flex-col gap-2 rounded-[14px] bg-surface p-3">
            <span className="text-xs font-bold text-ink-muted">{t('landing.learn.weekly')}</span>
            {[
              { label: 'P1', pct: 72, bar: 'bg-subject-lavender' },
              { label: 'P2', pct: 40, bar: 'bg-subject-pink' },
            ].map((r) => (
              <span key={r.label} className="flex items-center gap-2.5">
                <span className="w-6 text-xs font-bold text-brand-strong">{r.label}</span>
                <span className="h-2 flex-1 rounded-full bg-ink/6">
                  <span
                    className={cn('block h-2 rounded-full', r.bar)}
                    style={{ width: `${r.pct}%` }}
                  />
                </span>
                <span className="w-[34px] text-right text-xs font-bold text-brand-strong tabular-nums">
                  {r.pct}%
                </span>
              </span>
            ))}
          </span>
        </Item>
      </ul>
    </section>
  )
}

function Item({
  icon,
  title,
  body,
  children,
  last,
}: {
  icon: ReactNode
  title: string
  body: string
  children: ReactNode
  last?: boolean
}) {
  return (
    <li className={cn('flex items-start gap-4 py-[18px]', !last && 'border-b border-ink/10')}>
      <span className="flex size-11 shrink-0 items-center justify-center text-brand-strong">
        {icon}
      </span>
      <span className="flex flex-1 flex-col gap-1">
        <span className="text-[17px] font-bold">{title}</span>
        <span className="text-[15px] leading-[21px] text-ink-muted">{body}</span>
        {children}
      </span>
    </li>
  )
}

/** Chapters per day: the column (0 today, 1 tomorrow, 2 the day after), row and where they move. */
const MOVES: { cls: string; subject: 1 | 2; n: number; left: number; top: number }[] = [
  { cls: 'ld-a3', subject: 1, n: 3, left: 224, top: 36 },
  { cls: 'ld-b2', subject: 2, n: 2, left: 115, top: 72 },
  { cls: 'ld-a2', subject: 1, n: 2, left: 115, top: 36 },
  { cls: 'ld-b1', subject: 2, n: 1, left: 6, top: 72 },
  { cls: 'ld-a1', subject: 1, n: 1, left: 6, top: 36 },
]

/** "Dan ne ide po planu?": a tap on "Danas ne mogu" frees today and moves every chapter a day. */
function ReplanSection() {
  const { t } = useTranslation()
  const { locale } = useLocale()
  const { attach, onClass } = useReveal<HTMLElement>()
  // Read once (the page does not live across midnight); the weekday follows the locale.
  const [now] = useState(() => new Date())
  const dayAfter = format(addDays(now, 2), 'EEEE', { locale: dateFnsLocales[locale] })
  const days = [t('landing.replan.today'), t('landing.replan.tomorrow'), capitalize(dayAfter)]
  return (
    <section
      ref={attach}
      className={cn(
        'mx-4 mt-10 flex flex-col gap-[18px] rounded-[28px] bg-brand-strong px-5 pt-7 pb-[22px] text-ground',
        onClass,
      )}
    >
      <h2 className={h2}>{t('landing.replan.title')}</h2>
      <div className="relative flex flex-wrap gap-2">
        <span className="ld-chip relative flex h-10 items-center overflow-hidden rounded-[20px] border-[1.5px] border-ground px-3.5 text-sm font-bold">
          <span
            aria-hidden="true"
            className="ld-tap absolute top-1/2 left-1/2 -mt-5 -ml-5 size-10 rounded-full bg-ai"
          />
          <span className="relative">{t('landing.replan.cant')}</span>
        </span>
        <span
          aria-hidden="true"
          className="ld-finger pointer-events-none absolute top-1.5 left-[51px] size-7 rounded-full bg-ground/92 opacity-0 shadow-[0_0_0_6px_rgb(251_245_230/0.22),0_6px_14px_rgb(0_0_0/0.3)]"
        />
      </div>

      <div
        role="img"
        aria-label={t('landing.replan.alt')}
        className="relative h-[152px] w-[318px] max-w-full"
      >
        {days.map((d, i) => (
          <div
            key={i}
            style={{ left: i * 109 }}
            className={cn(
              'absolute top-0 h-[152px] w-[100px] rounded-[16px] bg-ground/8',
              i === 0 && 'ld-today',
            )}
          >
            <span
              className={cn(
                'absolute top-2.5 left-2.5 text-xs',
                i === 0 ? 'font-bold' : 'font-semibold text-ground/75',
              )}
            >
              {d}
            </span>
          </div>
        ))}
        <div className="ld-free absolute top-9 left-1.5 flex h-[102px] w-[88px] items-center justify-center rounded-[12px] border-[1.5px] border-dashed border-ground/40 text-xs font-semibold text-ground/80">
          {t('landing.replan.free')}
        </div>
        {MOVES.map((m) => (
          <span
            key={m.cls}
            style={{ left: m.left, top: m.top } as CSSProperties}
            className={cn(
              m.cls,
              'absolute flex h-[30px] w-[88px] items-center gap-1.5 rounded-[10px] pl-[5px] text-xs font-bold shadow-[0_6px_14px_rgb(0_0_0/0.18)]',
              m.subject === 1
                ? 'bg-subject-lavender-soft text-subject-lavender-ink'
                : 'bg-subject-pink-soft text-subject-pink-ink',
            )}
          >
            <span
              className={cn(
                'flex h-5 items-center rounded-[6px] px-[5px] text-[11px] font-extrabold',
                m.subject === 1
                  ? 'bg-subject-lavender-ink text-subject-lavender-soft'
                  : 'bg-subject-pink-ink text-subject-pink-soft',
              )}
            >
              P{m.subject}
            </span>
            {t('landing.replan.chapter', { n: m.n })}
          </span>
        ))}
      </div>

      <div className="ld-ok flex min-h-14 items-center justify-between gap-2.5 rounded-[28px] bg-ground py-2 pr-3 pl-[18px] text-brand-strong">
        <span className="flex flex-col">
          <span className="text-[15px] font-bold">{t('landing.replan.ok')}</span>
          <span className="text-xs font-semibold text-ink-secondary">
            {t('landing.replan.okSub')}
          </span>
        </span>
        <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-brand text-ground">
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={3}
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M5 12l5 5L19 8" />
          </svg>
        </span>
      </div>
    </section>
  )
}

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

const Stroke = ({ children }: { children: ReactNode }) => (
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
    {children}
  </svg>
)

const BrainIcon = () => (
  <Stroke>
    <path d="M9 2C10.66 2 12 3.34 12 5V19C12 20.66 10.66 22 9 22C7.51 22 6.28 20.92 6.04 19.5C6 19.24 5.76 19 5.5 19C3.57 19 2 17.43 2 15.5C2 14.49 2.42 13.59 3.11 12.95C3.56 12.52 3.7 11.68 3.41 11.14C3.15 10.65 3 10.09 3 9.5C3 8.04 3.9 6.78 5.18 6.26C5.66 6.06 6 5.52 6 5C6 3.34 7.34 2 9 2Z" />
    <path d="M15 2C13.34 2 12 3.34 12 5V19C12 20.66 13.34 22 15 22C16.49 22 17.72 20.92 17.96 19.5C18 19.24 18.24 19 18.5 19C20.43 19 22 17.43 22 15.5C22 14.49 21.58 13.59 20.89 12.95C20.44 12.52 20.3 11.68 20.59 11.14C20.85 10.65 21 10.09 21 9.5C21 8.04 20.1 6.78 18.82 6.26C18.34 6.06 18 5.52 18 5C18 3.34 16.66 2 15 2Z" />
    <path d="M12 10C12 11.1 11.1 12 10 12C8.9 12 8 11.1 8 10" />
    <path d="M16 15C16 13.9 15.1 13 14 13C12.9 13 12 13.9 12 15" />
  </Stroke>
)

const CalendarRepeatIcon = () => (
  <Stroke>
    <path d="M16 2V6M8 2V6" />
    <path d="M12 22H11C7.23 22 5.34 22 4.17 20.83C3 19.66 3 17.77 3 14V12C3 8.23 3 6.34 4.17 5.17C5.34 4 7.23 4 11 4H13C16.77 4 18.66 4 19.83 5.17C20.89 6.23 20.99 7.89 21 11" />
    <path d="M3 10H21" />
    <path d="M14.39 15.79C15.03 14.43 16.4 13.5 18 13.5C19.48 13.5 20.77 14.3 21.46 15.5M14.39 15.79C14.68 16 15.15 16 16 16H17M14.39 15.79C14.35 15.76 14.32 15.74 14.29 15.71C14 15.41 14 14.94 14 14V13M21.62 19.21C20.97 20.57 19.6 21.5 18 21.5C16.52 21.5 15.23 20.7 14.54 19.5M21.62 19.21C21.32 19 20.85 19 20 19H19M21.62 19.21C21.65 19.24 21.68 19.26 21.71 19.29C22 19.59 22 20.06 22 21V22" />
  </Stroke>
)

const ChartIcon = () => (
  <Stroke>
    <path d="M21 21H10C6.7 21 5.05 21 4.03 19.97C3 18.95 3 17.3 3 14V3" />
    <path d="M8 17C11.53 17 18.91 15.53 18.7 6.43M16.49 8.04L18.37 6.15C18.57 5.95 18.88 5.95 19.08 6.14L21 8.04" />
  </Stroke>
)
