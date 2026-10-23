import { describe, expect, it } from 'vitest'
import { cardsToCsv, cardsToQuizlet, parseCardLines } from './anki'

describe('cardsToCsv', () => {
  it('writes the Anki header, quotes what needs it and joins tags', () => {
    const csv = cardsToCsv([
      {
        front: 'Šta je X⁺?',
        back: 'Skup atributa, koje X određuje',
        tags: ['Baze podataka', '5.1'],
      },
      { front: 'Kaže "da"', back: 'red 1\nred 2', tags: [] },
    ])
    expect(csv).toBe(
      '#separator:comma\n#html:false\n#tags column:3\n' +
        'Šta je X⁺?,"Skup atributa, koje X određuje",Baze_podataka 5.1\n' +
        '"Kaže ""da""","red 1\nred 2",\n',
    )
  })
})

describe('parseCardLines', () => {
  it('reads tab and dash separated lines and reports the rest', () => {
    const out = parseCardLines(
      'Konvolucija\tmnoženje u frekvenciji\n\nDTFT - transformacija niza\nbez para\n x \t ',
    )
    expect(out.cards).toEqual([
      { front: 'Konvolucija', back: 'množenje u frekvenciji' },
      { front: 'DTFT', back: 'transformacija niza' },
    ])
    expect(out.skipped).toEqual([4, 5])
  })

  it('keeps hyphens inside words', () => {
    expect(parseCardLines('Fourier-ova transformacija – spektar').cards).toEqual([
      { front: 'Fourier-ova transformacija', back: 'spektar' },
    ])
  })
})

describe('cardsToQuizlet', () => {
  it('is tab separated, one card per line, and reads back the same', () => {
    const text = cardsToQuizlet([
      { front: 'Konvolucija', back: 'red 1\nred 2' },
      { front: 'DTFT', back: 'transformacija\tniza' },
    ])
    expect(text).toBe('Konvolucija\tred 1 red 2\nDTFT\ttransformacija niza')
    expect(parseCardLines(text).cards).toHaveLength(2)
  })
})
