export type GreetingPart = 'morning' | 'day' | 'evening'

/** Picks the greeting for a local hour (0–23). */
export function greetingPart(hour: number): GreetingPart {
  if (hour >= 4 && hour < 12) return 'morning'
  if (hour >= 12 && hour < 18) return 'day'
  return 'evening'
}
