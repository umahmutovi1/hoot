import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { BottomSheet } from '@/components/BottomSheet'
import { TOAST_MS, useToast } from '@/components/toast-store'
import { cn } from '@/lib/utils'

export interface SwipeAction {
  id: string
  label: string
  tone: 'danger' | 'archive' | 'skip'
  icon: ReactNode
  /** Runs the action; with `deferred` it runs only once the undo toast is gone. */
  run: () => void | Promise<unknown>
  /**
   * Hide the row, show `deferred` as a toast with undo and run after it (deletes that cannot be
   * undone afterwards: a session, a class, a deadline, a document).
   */
  deferred?: string
}

const BUTTON_PX = 72
/** Swipes that start this close to the left edge belong to iOS back. */
const EDGE_PX = 24
const LONG_PRESS_MS = 500

const tones: Record<SwipeAction['tone'], string> = {
  danger: 'bg-danger text-white',
  archive: 'bg-ink-subtle text-white',
  skip: 'bg-brand-accent text-white',
}

/**
 * Swipe left on a list row (design README, Stage 10b): a short swipe reveals the buttons (72 px
 * each, the row resists past them), a full swipe runs the first action. Long press, right click
 * or the hidden "Radnje" button (keyboard) open the same actions in a sheet. There is never a
 * confirmation dialog: every action has undo.
 */
export function SwipeRow({
  actions,
  children,
  className,
}: {
  actions: SwipeAction[]
  children: ReactNode
  className?: string
}) {
  const { t } = useTranslation()
  const show = useToast((s) => s.show)
  const row = useRef<HTMLDivElement>(null)
  const [dx, setDx] = useState(0)
  const [dragging, setDragging] = useState(false)
  const [hidden, setHidden] = useState(false)
  const [menu, setMenu] = useState(false)
  const gesture = useRef<{
    x: number
    y: number
    base: number
    axis: 'x' | 'y' | null
    moved: boolean
    /** Where the finger is, without the resistance (decides a full swipe). */
    raw: number
  } | null>(null)
  const press = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const swallowClick = useRef(false)
  const width = actions.length * BUTTON_PX
  const open = dx < 0

  // An open row closes when anything else is touched.
  useEffect(() => {
    if (!open) return
    const close = (e: PointerEvent) => {
      if (!row.current?.contains(e.target as Node)) setDx(0)
    }
    document.addEventListener('pointerdown', close)
    return () => document.removeEventListener('pointerdown', close)
  }, [open])

  const runAction = (a: SwipeAction) => {
    setDx(0)
    setMenu(false)
    if (!a.deferred) {
      void a.run()
      return
    }
    setHidden(true)
    // Not cleared on unmount: leaving the screen does not cancel the delete.
    const timer = setTimeout(() => void a.run(), TOAST_MS + 300)
    show(a.deferred, {
      label: t('today.cant.undo'),
      run: () => {
        clearTimeout(timer)
        setHidden(false)
      },
    })
  }

  if (hidden) return null
  const first = actions[0]
  return (
    <div ref={row} className={cn('relative overflow-hidden', className)}>
      {/* Only as wide as the gap the row leaves: rows are translucent glass. */}
      <div
        className="absolute inset-y-0 right-0 flex justify-end overflow-hidden"
        style={{ width: Math.max(0, -dx) }}
        aria-hidden={!open}
      >
        {actions.map((a) => (
          <button
            key={a.id}
            type="button"
            tabIndex={open ? 0 : -1}
            onClick={() => runAction(a)}
            className={cn(
              'flex h-full shrink-0 flex-col items-center justify-center gap-1 text-xs font-semibold',
              tones[a.tone],
            )}
            style={{ width: BUTTON_PX }}
          >
            {a.icon}
            {a.label}
          </button>
        ))}
      </div>
      <div
        className={cn(
          'relative touch-pan-y bg-inherit select-none [-webkit-touch-callout:none]',
          // While open, row and buttons are one flat strip (no rounded gap between them).
          dx < 0 && '[&>*]:rounded-r-none',
          !dragging && 'transition-transform duration-200 ease-out motion-reduce:transition-none',
        )}
        style={{ transform: dx ? `translateX(${dx}px)` : undefined }}
        onPointerDown={(e) => {
          if (e.button !== 0) return
          const left = row.current?.getBoundingClientRect().left ?? 0
          if (e.clientX - left < EDGE_PX && e.clientX < EDGE_PX) return
          gesture.current = {
            x: e.clientX,
            y: e.clientY,
            base: dx,
            axis: null,
            moved: false,
            raw: dx,
          }
          clearTimeout(press.current)
          press.current = setTimeout(() => {
            if (gesture.current && !gesture.current.moved) {
              swallowClick.current = true
              gesture.current = null
              setMenu(true)
            }
          }, LONG_PRESS_MS)
        }}
        onPointerMove={(e) => {
          const g = gesture.current
          if (!g) return
          const mx = e.clientX - g.x
          const my = e.clientY - g.y
          if (!g.axis) {
            if (Math.abs(mx) < 8 && Math.abs(my) < 8) return
            g.moved = true
            clearTimeout(press.current)
            g.axis = Math.abs(mx) > Math.abs(my) ? 'x' : 'y'
            if (g.axis === 'y') {
              gesture.current = null
              return
            }
            e.currentTarget.setPointerCapture(e.pointerId)
            setDragging(true)
          }
          const next = Math.min(0, g.base + mx)
          g.raw = next
          // Past the buttons the row follows the finger with resistance.
          setDx(next < -width ? -width + (next + width) * 0.35 : next)
        }}
        onPointerUp={() => {
          clearTimeout(press.current)
          const g = gesture.current
          gesture.current = null
          if (!g || g.axis !== 'x') return
          setDragging(false)
          swallowClick.current = true
          const full = (row.current?.offsetWidth ?? 390) * 0.55
          if (first && g.raw < -Math.max(full, width + 40)) runAction(first)
          else setDx(dx < -width / 2 ? -width : 0)
        }}
        onPointerCancel={() => {
          clearTimeout(press.current)
          gesture.current = null
          setDragging(false)
          setDx(0)
        }}
        onClickCapture={(e) => {
          // A swipe or a long press is not a tap on the row.
          if (swallowClick.current) {
            // The click that ends a swipe or a long press.
            e.preventDefault()
            e.stopPropagation()
            swallowClick.current = false
          } else if (open) {
            // A tap on an open row only closes it.
            e.preventDefault()
            e.stopPropagation()
            setDx(0)
          }
        }}
        // Links inside the row would start a native drag (and cancel the swipe) with a mouse.
        onDragStart={(e) => e.preventDefault()}
        onContextMenu={(e) => {
          e.preventDefault()
          setMenu(true)
        }}
      >
        {children}
      </div>
      <button
        type="button"
        onClick={() => setMenu(true)}
        className="sr-only focus:not-sr-only focus:absolute focus:top-1/2 focus:right-2 focus:-translate-y-1/2 focus:rounded-full focus:bg-canvas focus:px-3 focus:py-2 focus:text-sm focus:font-semibold focus:text-brand"
      >
        {t('swipe.actions')}
      </button>
      <BottomSheet open={menu} onOpenChange={setMenu} title={t('swipe.actions')}>
        <div className="flex flex-col gap-2">
          {actions.map((a) => (
            <button
              key={a.id}
              type="button"
              onClick={() => runAction(a)}
              className={cn(
                'flex h-12 items-center justify-center gap-2 rounded-full text-[15px] font-semibold',
                a.tone === 'danger' ? 'bg-danger text-white' : 'glass text-ink',
              )}
            >
              {a.icon}
              {a.label}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setMenu(false)}
            className="flex h-12 items-center justify-center rounded-full text-[15px] font-semibold text-brand"
          >
            {t('common.cancel')}
          </button>
        </div>
      </BottomSheet>
    </div>
  )
}
