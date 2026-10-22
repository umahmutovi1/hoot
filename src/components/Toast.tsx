import { useEffect } from 'react'
import { useToast } from './toast-store'

const VISIBLE_MS = 6000

export function Toast() {
  const toast = useToast((s) => s.toast)
  const hide = useToast((s) => s.hide)
  useEffect(() => {
    if (!toast) return
    const timer = setTimeout(hide, VISIBLE_MS)
    return () => clearTimeout(timer)
  }, [toast, hide])
  if (!toast) return null
  return (
    <div
      role="status"
      className="glass-toast fixed inset-x-0 bottom-[calc(24px+env(safe-area-inset-bottom)+var(--vv-bottom,0px))] z-50 mx-auto flex h-14 w-[calc(100%-36px)] max-w-[394px] items-center gap-2.5 rounded-full pr-2 pl-5 text-white"
    >
      <span className="flex-1 text-sm">{toast.message}</span>
      {toast.action && (
        <button
          type="button"
          onClick={() => {
            toast.action!.run()
            hide()
          }}
          className="flex h-10 items-center rounded-full bg-white/16 px-4 text-sm font-semibold"
        >
          {toast.action.label}
        </button>
      )}
    </div>
  )
}
