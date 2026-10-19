const SKIPPED_KEY = 'hoot.lectures.skipped'

/** Lectures skipped with "Preskoči" (`<entryId>:<date>`), kept on this device only. */
export function readSkippedLectures(): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(SKIPPED_KEY) ?? '[]') as string[])
  } catch {
    return new Set()
  }
}

export function skipLecture(key: string) {
  try {
    const next = [...readSkippedLectures(), key].slice(-200)
    localStorage.setItem(SKIPPED_KEY, JSON.stringify(next))
  } catch {
    // Private mode or blocked storage: the card simply comes back.
  }
}
