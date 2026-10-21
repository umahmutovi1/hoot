import { useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { forgottenSegment } from '@/lib/session/timer'
import { useActiveSession } from './api'
import { toSegment } from './model'
import { useSessionUi } from './store'
import { useNow } from './useNow'

/** On opening the app: a timer left running for 3+ h goes to the session to ask about it. */
export function ForgottenGuard() {
  const { data } = useActiveSession()
  const now = useNow(60_000, Boolean(data))
  const kept = useSessionUi((s) => s.keptSegmentId)
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const forgottenId = data ? forgottenSegment(data.segments.map(toSegment), now)?.id : null

  useEffect(() => {
    if (forgottenId && forgottenId !== kept && pathname !== '/session') navigate('/session')
  }, [forgottenId, kept, pathname, navigate])

  return null
}
