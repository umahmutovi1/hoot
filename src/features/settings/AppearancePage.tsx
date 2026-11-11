import { useTranslation } from 'react-i18next'
import { ScreenTitle } from '@/components/ScreenTitle'
import { useToast } from '@/components/toast-store'
import { CheckIcon } from '@/components/icons'
import { useProfile, useUpdateProfile } from './profile'
import { applyTheme, isTheme, THEMES, type Theme } from './theme'

/**
 * Postavke → Opće → Izgled (Izgled.dc.html, Sprint 12; Noćna sova, Sprint 19): five light themes. A tap applies the theme
 * at once (no Save) and syncs it through `profiles.theme`; the toast can undo it.
 */
export function AppearancePage() {
  const { t } = useTranslation()
  const { data: profile } = useProfile()
  const update = useUpdateProfile()
  const show = useToast((s) => s.show)
  const current: Theme = isTheme(profile?.theme) ? profile.theme : 'ocean'

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
      <div
        role="radiogroup"
        aria-label={t('appearance.themes')}
        className="surface flex flex-col overflow-hidden rounded-card"
      >
        {THEMES.map((theme) => {
          const on = theme === current
          return (
            <button
              key={theme}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => pick(theme)}
              className="flex min-h-14 items-center gap-3 border-hairline py-2 pr-3 pl-4 text-left not-first:border-t"
            >
              <ThemeSwatch theme={theme} />
              <span className="min-w-0 flex-1 text-[15px] font-bold">
                {t(`appearance.theme.${theme}.name`)}
              </span>
              {on && <CheckIcon size={22} className="text-brand" />}
            </button>
          )
        })}
      </div>
      <p className="px-1 text-xs text-ink-muted">{t('appearance.note')}</p>
    </div>
  )
}

/** The theme's brand colour, drawn from its own tokens (`data-theme` on the tile). */
export function ThemeSwatch({ theme, size = 40 }: { theme: Theme; size?: number }) {
  return (
    <span
      data-theme={theme}
      aria-hidden="true"
      className="shrink-0"
      style={{
        width: size,
        height: size,
        borderRadius: size * 0.325,
        background: 'var(--hoot-brand)',
      }}
    />
  )
}
