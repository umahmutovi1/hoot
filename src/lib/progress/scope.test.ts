import { describe, expect, it } from 'vitest'
import { choiceOf, rowsForChoice, scopeOf, type ScopeExam, type ScopeRow } from './scope'

const I: ScopeExam = { id: 'I', scopeAll: false }
const II: ScopeExam = { id: 'II', scopeAll: false }
const INT: ScopeExam = { id: 'INT', scopeAll: true }
const exams = [I, II, INT]

const units = [
  { id: '1', parentId: null },
  { id: '1.1', parentId: '1' },
  { id: '1.2', parentId: '1' },
  { id: '2', parentId: null },
]
const row = (assessmentId: string, unitId: string, included = true): ScopeRow => ({
  assessmentId,
  unitId,
  included,
})

describe('scopeOf', () => {
  it('scope_all covers everything without rows', () => {
    expect([...scopeOf(INT, units, [])]).toEqual(['1', '1.1', '1.2', '2'])
  })

  it('a partial covers only included units; a parent row covers its children', () => {
    expect([...scopeOf(I, units, [row('I', '1')])]).toEqual(['1', '1.1', '1.2'])
  })

  it('a child row overrides its parent', () => {
    const rows = [row('I', '1'), row('I', '1.2', false)]
    expect([...scopeOf(I, units, rows)]).toEqual(['1', '1.1'])
  })

  it('"Ne ulazi" excludes from a scope_all exam', () => {
    expect([...scopeOf(INT, units, [row('INT', '2', false)])]).toEqual(['1', '1.1', '1.2'])
  })

  it('ignores rows of other exams', () => {
    expect([...scopeOf(II, units, [row('I', '1')])]).toEqual([])
  })
})

describe('choiceOf / rowsForChoice', () => {
  it('unassigned without rows', () => {
    expect(choiceOf('1', exams, [])).toEqual({ kind: 'unassigned' })
    expect(rowsForChoice('1', exams, { kind: 'unassigned' })).toEqual([])
  })

  it('one or more partial exams', () => {
    const rows = rowsForChoice('1', exams, { kind: 'exams', examIds: ['II', 'I'] })
    expect(rows).toEqual([row('I', '1'), row('II', '1')])
    expect(choiceOf('1', exams, rows)).toEqual({ kind: 'exams', examIds: ['I', 'II'] })
  })

  it('never writes positive rows for scope_all exams', () => {
    expect(rowsForChoice('1', exams, { kind: 'exams', examIds: ['INT'] })).toEqual([])
  })

  it('excluded writes included = false for every exam', () => {
    const rows = rowsForChoice('1', exams, { kind: 'excluded' })
    expect(rows).toEqual([row('I', '1', false), row('II', '1', false), row('INT', '1', false)])
    expect(choiceOf('1', exams, rows)).toEqual({ kind: 'excluded' })
    expect(scopeOf(INT, units, rows).has('1')).toBe(false)
  })
})
