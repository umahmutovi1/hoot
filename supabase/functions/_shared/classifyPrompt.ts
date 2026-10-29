// The classify-events prompt: only what the model needs (title, length, weekday, time, weekly),
// never the calendar's name, location or the feed link.
import type { LlmRequest } from './llm.ts'
import { classifyOutputSchema, type ClassifyEventsRequest, type ClassifyOutput } from './schemas.ts'

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

const clock = (min: number) =>
  `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`

export function classifyRequest(req: ClassifyEventsRequest): LlmRequest<ClassifyOutput> {
  const lines = [
    `Student's subjects: ${req.subjects.length > 0 ? req.subjects.join('; ') : '(none yet)'}`,
    'Events (number: title · weekday time · minutes · weekly or not):',
    ...req.events.map(
      (e, i) =>
        `${i + 1}: ${e.title} · ${WEEKDAYS[e.weekday]} ${clock(e.start_min)} · ${e.minutes} min${e.weekly ? ' · weekly' : ''}`,
    ),
  ]
  return {
    task: 'classify_events',
    system: `You sort a university student's calendar events for Hoot, a study planner. Titles
may be in Bosnian or English. For each event say what it is: busy (time the student is not free
to study: work, appointments, sport, travel, social plans), lecture (a class: lecture, exercises,
lab, seminar, often weekly and named like a subject), exam (exam, test, midterm, quiz taken at
that time), deadline (something due; the time is not spent there) or free (a reminder or note
that takes no time). When unsure, answer busy. Return one entry per event number.`,
    text: lines.join('\n'),
    schema: classifyOutputSchema,
    maxTokens: 2000,
  }
}

/** The model's answer per event id; numbers that were not asked are dropped. */
export function classifiedKinds(
  output: ClassifyOutput,
  req: ClassifyEventsRequest,
): Map<string, ClassifyOutput['events'][number]['kind']> {
  const out = new Map<string, ClassifyOutput['events'][number]['kind']>()
  for (const e of output.events) {
    const asked = req.events[e.event - 1]
    if (asked && !out.has(asked.id)) out.set(asked.id, e.kind)
  }
  return out
}
