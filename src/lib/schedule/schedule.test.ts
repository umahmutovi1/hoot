import { describe, expect, it } from 'vitest'
import fc from 'fast-check'
import {
  calendarStatus,
  classesOn,
  exceptionDelta,
  formatClock,
  freeSlotsOn,
  mergeSlots,
  parityOf,
  parseClock,
  slotMinutes,
  subtractSlots,
  suggestExamPeriod,
  assignExamPeriods,
  lecturesToLog,
  weekFreeMinutes,
  weekNumber,
  type ClassEntry,
  type DayInput,
  type Period,
} from '.'

const winter: Period = {
  id: 'w',
  kind: 'teaching',
  examSession: null,
  title: 'Zimski semestar',
  startsOn: '2026-10-01', // Thursday
  endsOn: '2027-01-22',
}
const partials: Period = {
  id: 'p',
  kind: 'partial_exams',
  examSession: null,
  title: 'Sedmica parcijalnih',
  startsOn: '2026-11-23',
  endsOn: '2026-11-27',
}
const holiday: Period = {
  id: 'h',
  kind: 'holiday',
  examSession: null,
  title: 'Dan državnosti',
  startsOn: '2026-11-25',
  endsOn: '2026-11-25',
}
const january: Period = {
  id: 'j',
  kind: 'exam',
  examSession: 'regular',
  title: 'Januarski rok',
  startsOn: '2027-01-25',
  endsOn: '2027-02-12',
}
const makeup: Period = {
  id: 'm',
  kind: 'exam',
  examSession: 'makeup',
  title: 'Popravni rok',
  startsOn: '2027-02-15',
  endsOn: '2027-02-26',
}
const periods = [winter, partials, holiday, january, makeup]

const entry = (over: Partial<ClassEntry>): ClassEntry => ({
  id: 'e',
  subjectId: 's',
  kind: 'lecture',
  weekday: 0,
  startMin: 9 * 60,
  endMin: 11 * 60,
  weekParity: null,
  validFrom: winter.startsOn,
  validTo: winter.endsOn,
  ...over,
})

describe('weeks', () => {
  it('counts the week that contains the start as week 1', () => {
    expect(weekNumber('2026-10-01', '2026-09-28')).toBe(1) // Monday of that week
    expect(weekNumber('2026-10-01', '2026-10-04')).toBe(1)
    expect(weekNumber('2026-10-01', '2026-10-05')).toBe(2)
    expect(parityOf('2026-10-01', '2026-10-02')).toBe('odd')
    expect(parityOf('2026-10-01', '2026-10-07')).toBe('even')
  })
})

describe('calendarStatus', () => {
  it('shows the teaching week', () => {
    expect(calendarStatus('2026-10-19', periods)).toEqual({
      kind: 'teaching',
      title: 'Zimski semestar',
      week: 4,
    })
  })

  it('prefers a holiday, then partial-exam weeks', () => {
    expect(calendarStatus('2026-11-25', periods)?.kind).toBe('holiday')
    expect(calendarStatus('2026-11-24', periods)?.kind).toBe('partial_exams')
  })

  it('numbers weeks of an exam period and is empty outside all periods', () => {
    expect(calendarStatus('2027-02-02', periods)).toEqual({
      kind: 'exam',
      title: 'Januarski rok',
      week: 2,
    })
    expect(calendarStatus('2027-07-15', periods)).toBeNull()
  })
})

describe('classesOn', () => {
  const odd = entry({ id: 'lab', kind: 'lab', weekday: 3, weekParity: 'odd' })
  const monday = entry({ id: 'mon' })

  it('repeats weekly inside the period only', () => {
    expect(classesOn('2026-10-19', [monday], periods)).toHaveLength(1)
    expect(classesOn('2026-09-28', [monday], periods)).toHaveLength(0)
    expect(classesOn('2027-01-25', [monday], periods)).toHaveLength(0)
  })

  it('respects odd and even weeks from the start of teaching', () => {
    expect(classesOn('2026-10-01', [odd], periods)).toHaveLength(1) // week 1
    expect(classesOn('2026-10-08', [odd], periods)).toHaveLength(0) // week 2
    expect(classesOn('2026-10-15', [odd], periods)).toHaveLength(1) // week 3
  })

  it('skips holidays', () => {
    const wednesday = entry({ weekday: 2 })
    expect(classesOn('2026-11-25', [wednesday], periods)).toHaveLength(0)
    expect(classesOn('2026-11-18', [wednesday], periods)).toHaveLength(1)
  })
})

describe('slots', () => {
  it('merges and subtracts', () => {
    expect(
      mergeSlots([
        { startMin: 60, endMin: 120 },
        { startMin: 100, endMin: 200 },
        { startMin: 200, endMin: 210 },
      ]),
    ).toEqual([{ startMin: 60, endMin: 210 }])
    expect(subtractSlots([{ startMin: 0, endMin: 300 }], [{ startMin: 100, endMin: 200 }])).toEqual(
      [
        { startMin: 0, endMin: 100 },
        { startMin: 200, endMin: 300 },
      ],
    )
  })

  it('never returns more than it started with (property)', () => {
    const slot = fc
      .tuple(fc.integer({ min: 0, max: 1439 }), fc.integer({ min: 1, max: 600 }))
      .map(([s, len]) => ({ startMin: s, endMin: Math.min(1440, s + len) }))
    fc.assert(
      fc.property(fc.array(slot), fc.array(slot), (free, busy) => {
        const left = subtractSlots(free, busy)
        expect(slotMinutes(left)).toBeLessThanOrEqual(slotMinutes(free))
        for (const s of left)
          for (const b of busy) expect(s.endMin <= b.startMin || s.startMin >= b.endMin).toBe(true)
      }),
    )
  })
})

describe('freeSlotsOn', () => {
  const input: DayInput = {
    rules: [
      { weekday: 0, startMin: 8 * 60, endMin: 12 * 60 },
      { weekday: 0, startMin: 17 * 60, endMin: 20 * 60 },
    ],
    exceptions: [],
    entries: [entry({ id: 'lec' })], // Monday 09:00–11:00
    periods,
  }

  it('subtracts classes with 15 min before and after', () => {
    expect(freeSlotsOn('2026-10-19', input)).toEqual([
      { startMin: 8 * 60, endMin: 8 * 60 + 45 },
      { startMin: 11 * 60 + 15, endMin: 12 * 60 },
      { startMin: 17 * 60, endMin: 20 * 60 },
    ])
  })

  it('a cancelled class frees its slot again', () => {
    const free = freeSlotsOn('2026-10-19', {
      ...input,
      cancelledEntryIds: new Set(['lec']),
      exceptions: [
        { onDate: '2026-10-19', startMin: 8 * 60 + 45, endMin: 11 * 60 + 15, isBusy: false },
      ],
    })
    expect(free).toEqual([
      { startMin: 8 * 60, endMin: 12 * 60 },
      { startMin: 17 * 60, endMin: 20 * 60 },
    ])
  })

  it('handles whole-day busy and extra free time', () => {
    const busy = { onDate: '2026-10-19', startMin: null, endMin: null, isBusy: true }
    expect(freeSlotsOn('2026-10-19', { ...input, exceptions: [busy] })).toEqual([])
    const extra = { onDate: '2026-10-19', startMin: 14 * 60, endMin: 16 * 60, isBusy: false }
    expect(exceptionDelta(extra, input)).toBe(120)
    expect(exceptionDelta(busy, input)).toBe(-(45 + 45 + 180))
  })

  it('sums the week', () => {
    expect(weekFreeMinutes('2026-10-21', input)).toBe(45 + 45 + 180)
  })
})

describe('suggestExamPeriod', () => {
  it('matches the exam kind', () => {
    expect(suggestExamPeriod('partial', periods, '2026-10-19')?.id).toBe('p')
    expect(suggestExamPeriod('final', periods, '2026-10-19')?.id).toBe('j')
    expect(suggestExamPeriod('integral', periods, '2026-10-19')?.id).toBe('j')
    expect(suggestExamPeriod('makeup', periods, '2026-10-19')?.id).toBe('m')
    expect(suggestExamPeriod('partial', periods, '2026-12-01')).toBeUndefined()
  })
})

describe('clock', () => {
  it('formats and parses', () => {
    expect(formatClock(9 * 60 + 5)).toBe('09:05')
    expect(parseClock('9:05')).toBe(545)
    expect(parseClock('24:00')).toBe(1440)
    expect(parseClock('25:00')).toBeNull()
    expect(parseClock('abc')).toBeNull()
  })
})

describe('assignExamPeriods', () => {
  it('gives partials successive partial-exam weeks', () => {
    const second: Period = { ...partials, id: 'p2', startsOn: '2027-01-11', endsOn: '2027-01-15' }
    const got = assignExamPeriods(
      [{ kind: 'partial' }, { kind: 'partial' }, { kind: 'integral' }, { kind: 'makeup' }],
      [...periods, second],
      '2026-10-19',
    )
    expect(got.map((p) => p?.id)).toEqual(['p', 'p2', 'j', 'm'])
  })

  it('leaves an exam without a fitting period empty', () => {
    expect(
      assignExamPeriods([{ kind: 'partial' }, { kind: 'partial' }], periods, '2026-10-19')[1],
    ).toBeUndefined()
  })
})

describe('lecturesToLog', () => {
  const lecture = entry({ id: 'lec' }) // Monday 09:00–11:00
  const exercise = entry({ id: 'ex', kind: 'exercise', startMin: 12 * 60, endMin: 13 * 60 })
  const none = new Set<string>()

  it('asks only after a lecture has ended', () => {
    expect(lecturesToLog('2026-10-19', 10 * 60, [lecture], periods, none, none)).toEqual([])
    expect(lecturesToLog('2026-10-19', 11 * 60, [lecture], periods, none, none)).toHaveLength(1)
  })

  it('skips exercises, logged and skipped lectures', () => {
    const late = 23 * 60
    expect(lecturesToLog('2026-10-19', late, [exercise], periods, none, none)).toEqual([])
    const key = new Set(['lec:2026-10-19'])
    expect(lecturesToLog('2026-10-19', late, [lecture], periods, key, none)).toEqual([])
    expect(lecturesToLog('2026-10-19', late, [lecture], periods, none, key)).toEqual([])
  })
})
