import { Fragment } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { goBack } from '@/app/navigation'
import { ChevronLeftIcon } from '@/components/icons'
import { useCrumbs } from './useCrumbs'

/**
 * Second row under the top bar on every screen below the main ones (decision after 8b): ‹ goes
 * back to where you came from (or up one level without history), and the crumbs show where the
 * screen sits in the app; each one above the screen is a link.
 */
export function Crumbs() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const crumbs = useCrumbs()
  if (crumbs.length === 0) return null
  const parent = crumbs.at(-2)?.to ?? '/'
  return (
    <nav aria-label={t('crumbs.label')} className="-ml-1 flex min-h-11 items-center gap-1">
      <button
        type="button"
        onClick={() => goBack(navigate, parent)}
        aria-label={t('app.back')}
        className="flex size-11 shrink-0 items-center justify-center rounded-full text-ink"
      >
        <ChevronLeftIcon size={22} />
      </button>
      <ol className="flex min-w-0 items-center gap-1 text-[13px]">
        {crumbs.map((c, i) => {
          const last = i === crumbs.length - 1
          return (
            <Fragment key={c.to + i}>
              {i > 0 && (
                <li aria-hidden="true" className="shrink-0 text-ink-subtle">
                  ›
                </li>
              )}
              <li className={last ? 'min-w-0 truncate' : 'max-w-[38%] shrink truncate'}>
                {last ? (
                  <span aria-current="page" className="font-semibold text-ink">
                    {c.label}
                  </span>
                ) : (
                  <Link to={c.to} className="inline-flex min-h-11 items-center text-brand">
                    {c.label}
                  </Link>
                )}
              </li>
            </Fragment>
          )
        })}
      </ol>
    </nav>
  )
}
