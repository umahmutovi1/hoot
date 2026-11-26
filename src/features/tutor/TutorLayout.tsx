import { Navigate, Outlet, useParams } from 'react-router-dom'
import { DetailSkeleton } from '@/components/Skeleton'
import { useAllSources } from '@/features/plan/api'
import { useUnitsWithText } from '@/features/sources/summaryApi'
import { useTutorTime } from './api'
import type { TutorContext } from './context'

/** Shared by every tutor screen; the tutor's time runs while any of them is open. */
export function TutorLayout() {
  const { unitId } = useParams()
  const { data: sources, isPending } = useAllSources()
  const withText = useUnitsWithText().data
  const source = sources?.find((s) => s.units.some((u) => u.id === unitId))
  const unit = source?.units.find((u) => u.id === unitId)
  const time = useTutorTime(source?.subject_id, unit?.id)
  if (isPending) return <DetailSkeleton />
  if (!source || !unit) return <Navigate to="/" replace />
  const children = source.units.filter((u) => u.parent_id === unit.id && u.archived_at === null)
  const leaves = children.length > 0 ? children : [unit]
  const context: TutorContext = {
    unit,
    source,
    subjectId: source.subject_id,
    leaves,
    hasText: [unit, ...children].some((u) => withText?.has(u.id)),
    finish: time.finish,
    startedHere: time.startedHere,
  }
  return <Outlet context={context} />
}
