import { describe, expect, it } from 'vitest'
import { formatOutline, parseOutline } from './parse'

const pick = (text: string, measure: Parameters<typeof parseOutline>[1] = 'pages') =>
  parseOutline(text, measure).units.map((u) => [
    u.label,
    u.title,
    u.parentLabel,
    u.pageStart,
    u.pageEnd,
    u.amount,
  ])

describe('parseOutline', () => {
  it('reads label, title and start page; end = next start − 1', () => {
    expect(
      pick('1 Uvod 1\n2 LTI sistemi 74\n2.1 Konvolucija 75\n2.2 Integral 90\n3 Fourier 177-250'),
    ).toEqual([
      ['1', 'Uvod', null, 1, 73, 73],
      ['2', 'LTI sistemi', null, 74, 176, 103],
      ['2.1', 'Konvolucija', '2', 75, 89, 15],
      ['2.2', 'Integral', '2', 90, 176, 87],
      ['3', 'Fourier', null, 177, 250, 74],
    ])
  })

  it('handles dot leaders, "str." and label words', () => {
    expect(pick('Poglavlje 3: Fourierov red ........ 177-250\n1. Uvod, str. 1–56')).toEqual([
      ['3', 'Fourierov red', null, 177, 250, 74],
      ['1', 'Uvod', null, 1, 56, 56],
    ])
  })

  it('skips empty lines and bullets', () => {
    expect(pick('\n- 1 A 1-10\n\n• 2 B 11-20\n')).toEqual([
      ['1', 'A', null, 1, 10, 10],
      ['2', 'B', null, 11, 20, 10],
    ])
  })

  it('guesses the last unit without an end page from the average and warns', () => {
    const out = parseOutline('1 A 1\n2 B 11\n3 C 31', 'pages')
    expect(out.units.map((u) => [u.amount, u.amountGuessed])).toEqual([
      [10, false],
      [20, false],
      [15, true],
    ])
    expect(out.warnings).toEqual([{ code: 'missingAmount', labels: ['3'] }])
  })

  it('does not warn for parents whose children carry the pages', () => {
    const out = parseOutline('1 A\n1.1 A1 1-5\n1.2 A2 6-9', 'pages')
    expect(out.warnings).toEqual([])
  })

  it('warns about a reversed range', () => {
    const out = parseOutline('1 A 20-10\n2 B 21-30', 'pages')
    expect(out.warnings[0]).toEqual({ code: 'pageOrder', labels: ['1'] })
    expect(out.units[0]!.pageEnd).toBeNull()
  })

  it('renames duplicate labels', () => {
    const out = parseOutline('1 A 1-2\n1 B 3-4', 'pages')
    expect(out.units.map((u) => u.label)).toEqual(['1', '1-2'])
    expect(out.warnings).toEqual([{ code: 'duplicateLabel', labels: ['1-2'] }])
  })

  it('numbers unlabeled lines', () => {
    expect(pick('Uvod 1-5\nOsnove 6-9').map((u) => u[0])).toEqual(['1', '2'])
  })

  it('flattens levels deeper than three', () => {
    const units = parseOutline('1 A\n1.1 B\n1.1.1 C\n1.1.1.1 D', 'items').units
    expect(units.map((u) => [u.label, u.depth, u.parentLabel])).toEqual([
      ['1', 0, null],
      ['1.1', 1, '1'],
      ['1.1.1', 2, '1.1'],
      ['1.1.1.1', 2, '1.1'],
    ])
  })

  it('attaches to the closest existing ancestor', () => {
    const units = parseOutline('2 A\n2.1.3 B', 'items').units
    expect(units[1]).toMatchObject({ parentLabel: '2', depth: 1 })
  })

  it('questions: whole line is the title, numeric labels become P-labels', () => {
    expect(pick('12. Izračunaj konvoluciju za n = 5\nNavedi svojstva LTI', 'questions')).toEqual([
      ['P12', 'Izračunaj konvoluciju za n = 5', null, null, null, 1],
      ['P2', 'Navedi svojstva LTI', null, null, null, 1],
    ])
  })

  it('slides: a single number is the slide count, a range is a range', () => {
    expect(pick('L1–3 Uvod 34\nL4 Konvolucija 1-20', 'slides')).toEqual([
      ['L1–3', 'Uvod', null, null, null, 34],
      ['L4', 'Konvolucija', null, 1, 20, 20],
    ])
  })

  it('items: one line = one unit, numbers stay in the title', () => {
    expect(pick('1 Vježba 3 iz zbirke', 'items')).toEqual([
      ['1', 'Vježba 3 iz zbirke', null, null, null, 1],
    ])
  })
})

describe('formatOutline', () => {
  it('round-trips through parseOutline', () => {
    const text = '1 Uvod 1\n2 LTI 74\n2.1 Konvolucija 75\n3 Fourier 177-250'
    for (const measure of ['pages', 'slides', 'questions', 'items'] as const) {
      const first = parseOutline(text, measure).units
      const again = parseOutline(formatOutline(first, measure), measure).units
      const strip = (units: typeof first) => units.map((u) => ({ ...u, amountGuessed: false }))
      expect(strip(again)).toEqual(strip(first))
    }
  })
})
