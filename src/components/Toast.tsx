import { useEffect } from 'react'
import { CheckIcon, WarningIcon } from './icons'
import { TOAST_MS, useToast } from './toast-store'

export function Toast() {
  const toast = useToast((s) => s.toast)
  const hide = useToast((s) => s.hide)
  useEffect(() => {
    if (!toast) return
    const timer = setTimeout(hide, TOAST_MS)
    return () => clearTimeout(timer)
  }, [toast, hide])
  if (!toast) return null
  return (
    <div
      key={toast.id}
      role={toast.kind === 'error' ? 'alert' : 'status'}
      className="glass-toast animate-in fade-in slide-in-from-bottom-2 fixed inset-x-0 bottom-[calc(24px+env(safe-area-inset-bottom)+var(--vv-bottom,0px))] z-50 mx-auto flex min-h-14 w-[calc(100%-36px)] max-w-[394px] items-center gap-2.5 rounded-full py-2 pr-2 pl-5 text-white motion-reduce:animate-none"
    >
      {toast.kind === 'success' && <CheckIcon size={18} className="shrink-0 text-white/90" />}
      {toast.kind === 'error' && <WarningIcon size={18} className="shrink-0 text-white/90" />}
      <span className="flex-1 text-sm">{toast.message}</span>
      {toast.action && (
        <button
          type="button"
          onClick={() => {
            toast.action!.run()
            hide()
          }}
          className="flex h-10 shrink-0 items-center rounded-full bg-white/16 px-4 text-sm font-semibold"
        >
          {toast.action.label}
        </button>
      )}
    </div>
  )
}
