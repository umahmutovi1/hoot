import { useTranslation } from 'react-i18next'
import { ScreenTitle } from '@/components/ScreenTitle'
import { useToast } from '@/components/toast-store'
import { cn } from '@/lib/utils'
import { useProfile, useUpdateProfile } from './profile'
import { applyTheme, isTheme, THEMES, type Theme } from './theme'

/**
 * Postavke → Opće → Izgled (Izgled.dc.html, Stage 10b): five light themes. A tap applies the theme
 * at once (no Save) and syncs it through `profiles.theme`; the toast can undo it.
 */
export function AppearancePage() {
  const { t } = useTranslation()
  const { data: profile } = useProfile()
  const update = useUpdateProfile()
  const show = useToast((s) => s.show)
  const current: Theme = isTheme(profile?.theme) ? profile.theme : 'lavender'

  const pick = (theme: Theme) => {
    if (theme === current) return
    const previous = current
    applyTheme(theme)
    update.mutate({ theme })
    show(t('appearance.changed', { name: t(`appearance.theme.${theme}.name`) }), {
      label: t('today.cant.undo'),
      run: () => {
        applyTheme(previous)
        update.mutate({ theme: previous })
      },
    })
  }

  return (
    <div className="flex flex-col gap-3.5">
      <ScreenTitle title={t('appearance.title')} />
      <p className="-mt-1.5 px-1 text-sm leading-[1.45] text-ink-secondary">
        {t('appearance.intro')}
      </p>
      <h2 className="px-1 pt-1 text-[13px] font-semibold text-ink-muted uppercase">
        {t('appearance.themes')}
      </h2>
      <div role="radiogroup" aria-label={t('appearance.themes')} className="flex flex-col gap-2">
        {THEMES.map((theme) => {
          const on = theme === current
          return (
            <button
              key={theme}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => pick(theme)}
              className={cn(
                'flex items-center gap-3 rounded-[20px] border-2 p-3 text-left',
                on ? 'border-brand-accent bg-white/40' : 'border-line/60 bg-white/55',
              )}
            >
              <ThemeSwatch theme={theme} />
              <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="text-[15px] font-semibold">
                  {t(`appearance.theme.${theme}.name`)}
                </span>
                <span className="text-xs text-ink-muted">{t(`appearance.theme.${theme}.sub`)}</span>
              </span>
              <span
                className={cn(
                  'flex size-[22px] shrink-0 items-center justify-center rounded-full border-2',
                  on ? 'border-brand' : 'border-radio-ring',
                )}
              >
                {on && <span className="size-2.5 rounded-full bg-brand" />}
              </span>
            </button>
          )
        })}
      </div>
      <p className="px-1 text-xs text-ink-muted">{t('appearance.note')}</p>
    </div>
  )
}

/** The theme's mist with its button colour, drawn from its own tokens (`data-theme` on the tile). */
export function ThemeSwatch({ theme, size = 40 }: { theme: Theme; size?: number }) {
  return (
    <span
      data-theme={theme}
      aria-hidden="true"
      className="flex shrink-0 items-end justify-end rounded-xl p-[5px] shadow-[inset_0_0_0_0.5px_rgba(58,51,96,0.12)]"
      style={{
        width: size,
        height: size,
        background:
          'radial-gradient(120% 90% at 0% 0%, rgb(var(--hoot-mist-1) / 0.9), rgb(var(--hoot-mist-1) / 0) 70%), radial-gradient(90% 80% at 100% 30%, rgb(var(--hoot-mist-2) / 0.85), rgb(var(--hoot-mist-2) / 0) 70%), linear-gradient(180deg, var(--hoot-canvas-top), var(--hoot-canvas-bottom))',
      }}
    >
      <span
        className="rounded-full"
        style={{
          width: size * 0.4,
          height: size * 0.4,
          background: 'linear-gradient(160deg, var(--hoot-btn-from), var(--hoot-btn-to))',
        }}
      />
    </span>
  )
}
