import type { LocalDate } from '@/lib/day'
import type { Slot } from '@/lib/schedule'
import type { SlotPart } from '@/lib/schedule/rhythm'
import type { Preset } from '@/lib/session/timer'

/**
 * Scheduler input and output (PRD "Scheduler, replan i AI strategist"). The state is plain data
 * built from the database by the plan feature; `plan()` and `placeTimes()` are pure functions of
 * it, so the same state always gives the same plan and the same times.
 */

export type BlockKind = 'learn' | 'review' | 'questions' | 'recap' | 'deadline'
export type StudyMode = 'regular' | 'campaign'

export interface PlanSettings {
  /** `profiles.buffer_days`: last days before an exam hold only review and questions. */
  bufferDays: number
  maxSubjectsPerDay: number
  /** Shortest learning block; shorter free slots take only reviews (micro-blocks). */
  minBlockMinutes: number
  /** 15 min recap on a day with a lecture of the subject. */
  recapAfterLecture: boolean
  /** Reviews take at most this share of a day's capacity (`review_cap_pct`, default 40). */
  reviewCapPct: number
  /** Day before an exam: no blocks after this wall-clock minute (default 23:00). */
  examEveEndMin: number
  /** `lecture_pace_days`: a unit covered in class gets a soft deadline this many days later. */
  lecturePaceDays: number
}

export interface PlanSubject {
  id: string
  /** 1 Lagano … 5 Uslovni */
  priority: number
  mode: StudyMode
  /** Manual campaign start (`campaign_start_on`); wins over the computed one. */
  campaignStartOn: LocalDate | null
  /** Temporary boost ("Uzmi vrijeme od …"), inclusive. */
  boostUntil: LocalDate | null
  /**
   * Average share the user needs on the remaining exams for the target grade (0–1, PRD "Željena
   * ocjena kao ulaz u plan"); null without a target grade.
   */
  requiredShare: number | null
}

/** An active goal: an unpassed exam (contingent ones only once needed) or an open deadline. */
export interface PlanGoal {
  id: string
  subjectId: string
  kind: 'exam' | 'deadline'
  /** Exam: the date (earliest day of a range). Deadline: the due date. */
  on: LocalDate
  /** Exam: leaf units in its scope. */
  unitIds: string[]
  /** Deadline: minutes of work left. */
  minutes: number
}

/** A leaf unit with its estimate (minutes already include calibration and speed factor). */
export interface PlanUnit {
  id: string
  subjectId: string
  sourceId: string
  /** Order inside the subject: source order, then outline position. */
  order: number
  kind: 'chapter' | 'question'
  /** Chapters 0–3; questions 0, 1, 3. */
  level: number
  minutes: number
  difficulty: number
  /** Self-rated confidence; low confidence goes first among re-learned units. */
  confidence: number | null
  /** Exam questions linked through topics. */
  questionCount: number
  pageStart: number | null
  pageEnd: number | null
  /** Day the unit is due for a check (FSRS, Stage 9); null = not in review. */
  nextReviewOn: LocalDate | null
  /** Covered in class on this day (latest lecture log), null = not covered or not tracked. */
  coveredOn: LocalDate | null
  /** The subject has lecture logs for this unit's source: uncovered units are not pushed ahead. */
  tracked: boolean
}

export interface PlanDay {
  date: LocalDate
  /** Free time: availability minus classes, calendar busy time and exceptions. */
  slots: Slot[]
  /** Daily study cap (minutes). */
  cap: number
  /** Subjects with a lecture on this day (recap blocks). */
  lectureSubjectIds: string[]
}

export interface BlockUnit {
  unitId: string
  minutes: number
  pageFrom: number | null
  pageTo: number | null
}

/**
 * A block that replan keeps: manual blocks (`origin = 'user'`, never deleted or moved) and the
 * AI blocks of a day that stays as it is (today's list). Their units count as planned.
 */
export interface FixedBlock {
  id: string
  subjectId: string
  goalId: string | null
  onDate: LocalDate
  startMin: number | null
  minutes: number
  kind: BlockKind
  origin: 'ai' | 'user'
  units: { unitId: string; minutes: number }[]
}

export interface PlanState {
  /** First day that gets new AI blocks (today, or tomorrow when today's list stays). */
  from: LocalDate
  /** Wall-clock minute when `from` is today and its list is planned now; null otherwise. */
  nowMin: number | null
  /** One entry per day from `from` to the last goal. */
  days: PlanDay[]
  subjects: PlanSubject[]
  goals: PlanGoal[]
  units: PlanUnit[]
  fixed: FixedBlock[]
  settings: PlanSettings
  /** Default session preset: block length and breaks. */
  preset: Preset
  /** Realization factor ρ (see `realization()`). */
  rho: number
  /** Average studied minutes of the last 7 days for the growth limit; null = no limit. */
  growthBase: number | null
  /** Onboarding "kad ti je najlakše učiti" (prior for slot scores until Stage 11). */
  preferredParts: SlotPart[]
}

/**
 * "Zašto ovo danas" as data; the UI turns it into a sentence in the user's language.
 * `days` = days until the goal, `date` = lecture or campaign day.
 */
export interface Reason {
  code:
    | 'review'
    | 'recap'
    | 'buffer'
    | 'exam'
    | 'deadline'
    | 'lecture'
    | 'campaign_start'
    | 'optional'
    /** A manual block (UrediBlok): its study mode and whether it was an AI block. */
    | 'manual'
  goalId?: string
  mode?: string
  edited?: boolean
  days?: number
  date?: LocalDate
  /** Priority 5 ("uslovni predmet"). */
  conditional?: boolean
  /** Temporary boost is on. */
  boost?: boolean
}

export interface PlannedBlock {
  /** Stable within one plan (day, subject, goal, kind, part); ids are given when saving. */
  key: string
  subjectId: string
  goalId: string | null
  onDate: LocalDate
  /** Filled by `placeTimes()`; null when the block did not fit a free slot. */
  startMin: number | null
  minutes: number
  kind: BlockKind
  /** Only optional work (beyond the subject's target coverage). */
  optional: boolean
  units: BlockUnit[]
  reason: Reason
}

export interface Deficit {
  goalId: string
  subjectId: string
  /** Required work that does not fit before the goal (minutes). */
  minutes: number
  /** Last day learning for the goal is possible (exam − buffer − 1). */
  lastDay: LocalDate
}

export interface PlanResult {
  blocks: PlannedBlock[]
  deficits: Deficit[]
  /** Day each campaign subject enters rotation (manual start, else computed). */
  campaignStarts: Record<string, LocalDate>
  /** The computed (ALAP + margin) start, also for subjects with a manual one ("Kreni ranije"). */
  computedStarts: Record<string, LocalDate>
  /** AI capacity per day after ρ, reserve and fixed blocks. */
  capacity: Record<LocalDate, number>
  /** Start minute `placeTimes()` gave each fixed block (manual blocks without a time). */
  fixedTimes: Record<string, number>
}
