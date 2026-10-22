import { useMemo } from 'react'
import { useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { format } from 'date-fns'
import { crumbsFor } from '@/app/crumbs'
import { useDocuments } from '@/features/owl/api'
import { useAllSources } from '@/features/plan/api'
import { useSessions } from '@/features/session/api'
import { useLocale } from '@/features/settings/useLocale'
import { useSubjects } from '@/features/subjects/api'
import { dateFnsLocales } from '@/lib/locale'

/** Breadcrumbs of the current screen, with names from the cached records. */
export function useCrumbs() {
  const { t } = useTranslation()
  const { pathname } = useLocation()
  const { locale } = useLocale()
  const { data: subjects } = useSubjects()
  const { data: sources } = useAllSources()
  const { data: documents } = useDocuments()
  const { data: sessions } = useSessions()
  return useMemo(
    () =>
      crumbsFor(pathname, t, {
        subject: (id) => subjects?.find((s) => s.id === id)?.name,
        source: (id) => sources?.find((s) => s.id === id)?.title,
        unit: (id) => {
          const unit = sources?.flatMap((s) => s.units).find((u) => u.id === id)
          if (!unit) return undefined
          return unit.label && !unit.label.startsWith('~')
            ? `${unit.label} ${unit.title}`
            : unit.title
        },
        document: (id) => documents?.find((d) => d.id === id)?.title,
        session: (id) => {
          const s = sessions?.find((x) => x.id === id)
          return s
            ? format(new Date(s.started_at), 'EEE, d. MMM', { locale: dateFnsLocales[locale] })
            : undefined
        },
      }),
    [pathname, t, subjects, sources, documents, sessions, locale],
  )
}
