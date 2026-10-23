import Fuse from 'fuse.js'

export interface ChapterRef {
  id: string
  label: string | null
  title: string
}

const normalize = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'dj')
    .replace(/[^a-z0-9. ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

/**
 * The chapter the student named in the chat ("ispitaj me iz poglavlja 4", "iz Fourierove
 * transformacije"): a label ("4", "2.1") wins, then the closest title (fuse.js). null = not sure.
 */
export function findChapter(text: string, chapters: ChapterRef[]): ChapterRef | null {
  const target = normalize(text)
  if (!target) return null
  const label = /(?:^|\s)(\d+(?:\.\d+)*)(?:\s|$)/.exec(target)?.[1]
  if (label) {
    const byLabel = chapters.find((c) => c.label === label)
    if (byLabel) return byLabel
  }
  const words = target.replace(/\b(poglavlj\w*|chapter|lekcij\w*|iz|from|o|about)\b/g, ' ').trim()
  if (!words) return null
  const fuse = new Fuse(
    chapters.map((c) => ({ ...c, key: normalize(c.title) })),
    { keys: ['key'], threshold: 0.4, ignoreLocation: true },
  )
  return fuse.search(words)[0]?.item ?? null
}
