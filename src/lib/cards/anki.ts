/**
 * Cards in and out without an API (PRD "Ostale integracije": Anki / Quizlet). Export is a CSV
 * Anki imports as Basic notes (front, back, tags); import reads "pojam ⇥ definicija" lines, the
 * format Quizlet exports and people paste.
 */

export interface CardText {
  front: string
  back: string
}

/** One CSV field: quoted when it holds a comma, quote or line break (RFC 4180). */
function field(value: string): string {
  return /[",\n\r]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value
}

/** A tag Anki accepts: no spaces, so "Signali i sistemi" → "Signali_i_sistemi". */
export function ankiTag(name: string): string {
  return name.trim().replace(/\s+/g, '_').replace(/[",]/g, '')
}

/**
 * CSV with Anki's header lines (Anki 2.1.55+): comma separator, plain text, tags in column 3.
 * Line breaks inside a card stay (Anki keeps them in a quoted field).
 */
export function cardsToCsv(cards: (CardText & { tags: string[] })[]): string {
  const lines = ['#separator:comma', '#html:false', '#tags column:3']
  for (const c of cards)
    lines.push([c.front, c.back, c.tags.map(ankiTag).join(' ')].map(field).join(','))
  return `${lines.join('\n')}\n`
}

/** Tab first (Quizlet, spreadsheets), then " - " / " – " / " — " between term and definition. */
const SEPARATORS = [/\t+/, /\s+[-–—]\s+/]

export interface ParsedCards {
  cards: CardText[]
  /** Non-empty lines without a separator, by line number (1-based). */
  skipped: number[]
}

export function parseCardLines(text: string): ParsedCards {
  const cards: CardText[] = []
  const skipped: number[] = []
  text.split(/\r?\n/).forEach((raw, i) => {
    const line = raw.trim()
    if (!line) return
    for (const sep of SEPARATORS) {
      const m = sep.exec(line)
      if (!m) continue
      const front = line.slice(0, m.index).trim()
      const back = line.slice(m.index + m[0].length).trim()
      if (front && back) {
        cards.push({ front, back })
        return
      }
    }
    skipped.push(i + 1)
  })
  return { cards, skipped }
}

/**
 * Quizlet "Uvezi" (paste): term ⇥ definition, one card per line. Line breaks and tabs inside a
 * card become spaces, since they would split it.
 */
export function cardsToQuizlet(cards: CardText[]): string {
  const flat = (v: string) => v.replace(/[\t\r\n]+/g, ' ').trim()
  return cards.map((c) => `${flat(c.front)}\t${flat(c.back)}`).join('\n')
}
