import type { SearchGroup } from './search'

/**
 * Screens, settings and actions the search knows; titles, subtitles and synonyms are in the
 * locale files (`search.items.<id>`). An action's route carries a query the screen turns into its
 * sheet.
 */
export const STATIC_ITEMS = [
  { id: 'moreTime', group: 'actions', to: '/plan?more=1' },
  { id: 'extraTime', group: 'actions', to: '/?extra=1' },
  { id: 'newSubject', group: 'actions', to: '/subjects/new' },
  { id: 'today', group: 'screens', to: '/' },
  { id: 'plan', group: 'screens', to: '/plan' },
  { id: 'month', group: 'screens', to: '/plan?view=month' },
  { id: 'timetable', group: 'screens', to: '/plan/timetable' },
  { id: 'subjects', group: 'screens', to: '/subjects' },
  { id: 'progress', group: 'screens', to: '/progress' },
  { id: 'sessions', group: 'screens', to: '/sessions' },
  { id: 'chat', group: 'screens', to: '/chat' },
  { id: 'settings', group: 'screens', to: '/settings' },
  { id: 'academic', group: 'screens', to: '/settings/calendar' },
  { id: 'feeds', group: 'screens', to: '/settings/feeds' },
  { id: 'documents', group: 'screens', to: '/settings/documents' },
  { id: 'availability', group: 'settings', to: '/plan/availability' },
  { id: 'appearance', group: 'settings', to: '/settings/appearance' },
  { id: 'faculty', group: 'settings', to: '/settings/academic' },
  { id: 'language', group: 'settings', to: '/settings#general' },
  { id: 'presets', group: 'settings', to: '/settings#session' },
  { id: 'notifications', group: 'settings', to: '/settings#notify' },
  { id: 'grades', group: 'settings', to: '/settings#general' },
  { id: 'export', group: 'settings', to: '/settings#data' },
] as const satisfies readonly { id: string; group: SearchGroup; to: string }[]
