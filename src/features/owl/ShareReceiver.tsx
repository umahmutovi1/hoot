import { useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { takeShared } from './share'
import { useOwlStore } from './store'

/** /chat?share=1 (Android share target): opens "Daj dokument" with what was shared. */
export function ShareReceiver() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const shared = params.get('share') === '1'
  useEffect(() => {
    if (!shared) return
    let live = true
    void takeShared().then((input) => {
      if (!live) return
      navigate('/chat', { replace: true })
      if (input) {
        useOwlStore.getState().newConversation()
        useOwlStore.getState().openShared(input)
      }
    })
    return () => {
      live = false
    }
  }, [shared, navigate])
  return null
}
