import { sameStudyPeriod } from '@/lib/slots/period'
import { createContext, createElement, useContext, useMemo, type ReactNode } from 'react'
import { usePlanInputs } from '@/features/plan/api'
import { usePlanStore } from '@/features/plan/store'
import { useDayBoundary } from '@/features/settings/profile'
import { rateOf } from '@/features/sources/model'
import { gradeItemsOf, gradeSubjectOf } from '@/features/subjects/grades'
import { addDays, diffDays, localDay, weekdayOf } from '@/lib/day'
import { gradeRange, project } from '@/lib/grades'
import { progressOf } from '@/lib/progress'
import { forecast } from '@/lib/progress/forecast'
import { coverageOf } from '@/lib/scheduler'
import { seedOf } from '@/lib/scheduler/hash'
import { partOf } from '@/lib/schedule/rhythm'
import { slotObservations, slotSignals } from '@/lib/slots/signals'
import { weightedStrength } from '@/lib/srs'
import { strengthOf } from '@/features/review/strength'
import { candidates } from '@/lib/strategist'

/** Sprint 17: screens consume exactly the model that produced the latest plan. */
function useProgressData() {
  const boundary = useDayBoundary()
  const inputs = usePlanInputs(boundary)
  const model = usePlanStore((s) => s.model)
  return useMemo(() => {
    if (!inputs || !model) return null
    const { state, today } = model.built
    const units = state.units
    const progress = (ids: string[]) =>
      progressOf(
        units
          .filter((u) => ids.includes(u.id))
          .map((u) => ({
            ...u,
            parentId: null,
            read: u.readShare,
          })),
      )
    const rawUnits = new Map(inputs.sources.flatMap((s) => s.units.map((u) => [u.id, u] as const)))
    const strength = (ids: string[], on = today) =>
      weightedStrength(
        units
          .filter((u) => ids.includes(u.id))
          .map((u) => ({
            minutes: u.minutes,
            strength: rawUnits.has(u.id)
              ? strengthOf(
                  rawUnits.get(u.id)!,
                  inputs.cards.filter((c) => c.unit_id === u.id),
                  on,
                  boundary,
                  state.fsrsParams,
                )
              : null,
          })),
      )
    const history = new Map<string, number>()
    // Bootstrap includes zero-work days, not only days on which a session happened.
    const firstSession = inputs.sessions
      .map((s) => localDay(new Date(s.startedAt), boundary))
      .sort()[0]
    for (let i = 1; i <= 28; i++) {
      const day = addDays(today, -i)
      if (firstSession && day >= firstSession) history.set(day, 0)
    }
    for (const s of inputs.sessions) {
      const day = localDay(new Date(s.startedAt), boundary)
      if (history.has(day)) history.set(day, history.get(day)! + s.minutes)
    }
    const allBlocks = [
      ...model.result.blocks,
      ...state.fixed.map((b) => ({ ...b, demand: 1 })),
    ].filter((b) => b.onDate >= today)
    const loads = new Map<string, number>()
    for (const b of allBlocks) loads.set(b.onDate, (loads.get(b.onDate) ?? 0) + b.minutes)
    const prediction = forecast({
      today,
      blocks: allBlocks.map((b) => ({
        onDate: b.onDate,
        minutes: b.minutes,
        subjectId: b.subjectId,
        goalId: b.goalId,
        learn: b.kind === 'learn',
        features: {
          part: partOf(b.startMin ?? 9 * 60),
          weekend: weekdayOf(b.onDate) >= 5,
          kind: b.kind,
          demand: b.demand,
          dayLoadMin: loads.get(b.onDate) ?? 0,
          daysToGoal: state.goals.find((g) => g.id === b.goalId)?.on
            ? diffDays(b.onDate, state.goals.find((g) => g.id === b.goalId)!.on)
            : null,
          prevLate: false,
        },
      })),
      goals: state.goals
        .filter((g) => g.kind === 'exam')
        .map((g) => {
          const p = progress(g.unitIds)
          const subject = state.subjects.find((s) => s.id === g.subjectId)!
          return {
            id: g.id,
            on: g.on,
            scopeMinutes: p.totalMinutes,
            coveredMinutes: p.totalMinutes - p.remainingMinutes,
            requiredMinutes: p.totalMinutes * coverageOf(subject),
            recallOnExam: strength(g.unitIds, g.on) ?? 0,
          }
        }),
      completion: inputs.completion,
      history: [...history].map(([date, minutes]) => ({ date, minutes })),
      capacity: model.result.capacity,
      speedSd: Math.sqrt(
        inputs.sources.reduce((sum, s) => sum + rateOf(s, inputs.sources).variance, 0) /
          Math.max(1, inputs.sources.length),
      ),
      seed: seedOf(model.hash),
    })
    const forecasts = prediction.goals
      .map((f) => {
        const goal = state.goals.find((g) => g.id === f.goalId)!
        const subject = inputs.subjects.find((s) => s.id === goal.subjectId)!
        const exam = subject.assessments.find((a) => a.id === f.goalId)!
        const gradeSubject = gradeSubjectOf(subject, inputs.globalScale)
        const projection = project(gradeItemsOf(subject, inputs.deadlines), gradeSubject)
        return {
          ...f,
          goal,
          subject,
          exam,
          hasMemory: strength(goal.unitIds, goal.on) !== null,
          grade: projection.remaining > 0 ? gradeRange(projection, gradeSubject, f.score) : null,
        }
      })
      .sort((a, b) => a.goal.on.localeCompare(b.goal.on))
    const signals = inputs.signals
      ? slotSignals(
          sameStudyPeriod(
            slotObservations(
              inputs.signals.sessions,
              inputs.signals.plannedStart,
              new Map(
                inputs.sources.flatMap((s) =>
                  s.units.map(
                    (u) =>
                      [
                        u.id,
                        (units.find((x) => x.id === u.id)?.minutes ?? 0) / Math.max(1, u.amount),
                      ] as const,
                  ),
                ),
              ),
              boundary,
            ),
            today,
            inputs.dayInput(today).periods,
          ),
          today,
        )
      : null
    const actions = candidates({
      state,
      result: model.result,
      today,
      behind: model.built.behind,
      slots: signals,
      slotCompletion: state.slotCompletion ?? null,
      avoided: [],
    })
    return { inputs, model, progress, strength, forecasts, signals, actions, today }
  }, [inputs, model, boundary])
}

const ProgressContext = createContext<ReturnType<typeof useProgressData>>(null)
export function ProgressProvider({ children }: { children: ReactNode }) {
  const value = useProgressData()
  return createElement(ProgressContext.Provider, { value }, children)
}
export function useProgress() {
  return useContext(ProgressContext)
}
