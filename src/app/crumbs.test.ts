import { describe, expect, it } from 'vitest'
import type { TFunction } from 'i18next'
import { crumbsFor, type CrumbNames } from './crumbs'

const t = ((key: string) => key) as unknown as TFunction
const names: CrumbNames = {
  subject: (id) => (id === 's1' ? 'Signali' : undefined),
  source: (id) => (id === 'src1' ? 'Knjiga' : undefined),
  unit: (id) => (id === 'u1' ? '3.1 Uvod' : undefined),
  document: () => 'Kalendar 2026',
  session: () => 'čet, 22. okt',
}
const path = (p: string) => crumbsFor(p, t, names).map((c) => `${c.label}@${c.to}`)

describe('crumbsFor', () => {
  it('main screens have no crumbs', () => {
    for (const p of ['/', '/plan', '/subjects', '/progress', '/chat']) expect(path(p)).toEqual([])
  })

  it('follows the place in the app down to a unit', () => {
    expect(path('/subjects/s1/sources/src1/units/u1')).toEqual([
      'nav.subjects@/subjects',
      'Signali@/subjects/s1',
      'Knjiga@/subjects/s1/sources/src1',
      '3.1 Uvod@/subjects/s1/sources/src1/units/u1',
    ])
  })

  it('falls back to a generic name while a record is not loaded', () => {
    expect(path('/subjects/x/sources/y')).toEqual([
      'nav.subjects@/subjects',
      'nav.subjects@/subjects/x',
      'crumbs.source@/subjects/x/sources/y',
    ])
  })

  it('covers settings, plan, chat and sessions', () => {
    expect(path('/settings/documents/d1')).toEqual([
      'settings.title@/settings',
      'menu.documents@/settings/documents',
      'Kalendar 2026@/settings/documents/d1',
    ])
    expect(path('/plan/timetable')).toEqual(['nav.plan@/plan', 'menu.timetable@/plan/timetable'])
    expect(path('/chat/history')).toEqual(['owl.name@/chat', 'owl.history.title@/chat/history'])
    expect(path('/sessions/a')).toEqual([
      'nav.progress@/progress',
      'menu.sessions@/sessions',
      'čet, 22. okt@/sessions/a',
    ])
    expect(path('/subjects/s1/edit').at(-1)).toBe('crumbs.edit@/subjects/s1/edit')
    expect(path('/today/moodle')).toEqual(['nav.today@/', 'moodle.title@/today/moodle'])
    expect(path('/subjects/s1/sources/src1/links').slice(-2)).toEqual([
      'Knjiga@/subjects/s1/sources/src1',
      'links.title@/subjects/s1/sources/src1/links',
    ])
  })

  it('the session flow (recall gate, knowledge check) has no crumbs, like the timer', () => {
    expect(path('/session')).toEqual([])
    expect(path('/session/recall')).toEqual([])
    expect(path('/session/review')).toEqual([])
  })
})
