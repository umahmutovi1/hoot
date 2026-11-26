import { useOutletContext } from 'react-router-dom'
import type { Source, Unit } from '@/features/sources/model'

export interface TutorContext {
  unit: Unit
  source: Source
  subjectId: string
  /** FSRS objects the tutor rates: the unit, or its leaves for a chapter with sub-units. */
  leaves: Unit[]
  hasText: boolean
  /** Ends the session the tutor started itself (from a Jedinica); no-op inside a timer session. */
  finish: () => Promise<void>
  startedHere: boolean
}

/** The unit, its source and the tutor's session, shared by every tutor screen. */
export const useTutor = () => useOutletContext<TutorContext>()
