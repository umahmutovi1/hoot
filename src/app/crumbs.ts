import type { TFunction } from 'i18next'

export interface Crumb {
  label: string
  to: string
}

/** Names of the records in a path (subject, source, unit, document, session), from the caches. */
export interface CrumbNames {
  subject: (id: string) => string | undefined
  source: (id: string) => string | undefined
  unit: (id: string) => string | undefined
  document: (id: string) => string | undefined
  session: (id: string) => string | undefined
}

/**
 * Breadcrumbs of a screen by the place in the app, not by history: "Predmeti › Signali › Knjiga".
 * The last crumb is the screen itself. Top-level screens (Danas, Plan, Predmeti, Napredak, Chat)
 * have none.
 */
export function crumbsFor(pathname: string, t: TFunction, names: CrumbNames): Crumb[] {
  const parts = pathname.split('/').filter(Boolean)
  const [first, second, third, fourth, fifth, sixth] = parts
  const today: Crumb = { label: t('nav.today'), to: '/' }
  const plan: Crumb = { label: t('nav.plan'), to: '/plan' }
  const subjects: Crumb = { label: t('nav.subjects'), to: '/subjects' }
  const progress: Crumb = { label: t('nav.progress'), to: '/progress' }
  const settings: Crumb = { label: t('settings.title'), to: '/settings' }
  const chat: Crumb = { label: t('owl.name'), to: '/chat' }

  switch (first) {
    case 'today':
      if (second === 'fresh') return [today, { label: t('crumbs.fresh'), to: pathname }]
      if (second === 'moodle') return [today, { label: t('moodle.title'), to: pathname }]
      return []
    case 'plan':
      if (second === 'availability')
        return [plan, { label: t('availability.title'), to: '/plan/availability' }]
      if (second === 'timetable')
        return [plan, { label: t('menu.timetable'), to: '/plan/timetable' }]
      return []
    case 'chat':
      if (second === 'history') return [chat, { label: t('owl.history.title'), to: pathname }]
      if (second === 'import') return [chat, { label: t('owl.reviewPage.title'), to: pathname }]
      return []
    case 'settings': {
      const own = [settings]
      if (second === 'calendar') own.push({ label: t('menu.academicCalendar'), to: pathname })
      if (second === 'feeds') own.push({ label: t('feeds.title'), to: pathname })
      if (second === 'academic') own.push({ label: t('academic.faculty.title'), to: pathname })
      if (second === 'documents') {
        own.push({ label: t('menu.documents'), to: '/settings/documents' })
        if (third)
          own.push({ label: names.document(third) ?? t('owl.documents.title'), to: pathname })
      }
      return own
    }
    case 'sessions': {
      const list = [progress, { label: t('menu.sessions'), to: '/sessions' }]
      return second
        ? [...list, { label: names.session(second) ?? t('session.title'), to: pathname }]
        : list
    }
    case 'subjects': {
      if (!second) return []
      if (second === 'new') return [subjects, { label: t('crumbs.newSubject'), to: pathname }]
      const subjectTo = `/subjects/${second}`
      const out = [subjects, { label: names.subject(second) ?? t('nav.subjects'), to: subjectTo }]
      if (third === 'edit') out.push({ label: t('crumbs.edit'), to: pathname })
      if (third === 'scope') out.push({ label: t('scope.title'), to: pathname })
      if (third === 'sources' && fourth === 'new')
        out.push({ label: t('crumbs.newSource'), to: pathname })
      else if (third === 'sources' && fourth) {
        const sourceTo = `${subjectTo}/sources/${fourth}`
        out.push({ label: names.source(fourth) ?? t('crumbs.source'), to: sourceTo })
        if (fifth === 'edit') out.push({ label: t('crumbs.edit'), to: pathname })
        if (fifth === 'links') out.push({ label: t('links.title'), to: pathname })
        if (fifth === 'units' && sixth)
          out.push({ label: names.unit(sixth) ?? t('crumbs.unit'), to: pathname })
      }
      return out
    }
    // The session flow (timer, end form, recall gate, knowledge check) is full screen without the
    // top bar, like onboarding.
    case 'session':
    default:
      return []
  }
}
