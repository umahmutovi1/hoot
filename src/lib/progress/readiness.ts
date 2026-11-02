/** Sprint 17: 1–5 means expected score 20–100%; it is not the 6–10 grade scale. */
export function overestimation(
  exams: readonly {
    readiness_before: number | null
    result_points: number | null
    result_max: number | null
    result_annulled: boolean
  }[],
) {
  const pairs = exams.filter(
    (e) =>
      e.readiness_before !== null &&
      e.result_points !== null &&
      e.result_max !== null &&
      e.result_max > 0 &&
      !e.result_annulled,
  )
  if (pairs.length < 3) return null
  const overBy =
    pairs.reduce(
      (sum, e) =>
        sum + e.readiness_before! / 5 - Math.min(1, Math.max(0, e.result_points! / e.result_max!)),
      0,
    ) / pairs.length
  return overBy >= 0.15 - 1e-9
    ? { pairs: pairs.length, percentagePoints: Math.round(overBy * 100) }
    : null
}
