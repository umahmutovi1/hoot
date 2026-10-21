import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { AiSparkIcon, PlusIcon } from '@/components/icons'
import { cn } from '@/lib/utils'
import type { ImportKind } from '@shared/schemas.ts'
import { useAiAvailability } from './api'
import { useOwlStore } from './store'
import { useOwl } from './useOwl'

type Suggestion =
  | { label: string; to: string }
  | { label: string; kind: ImportKind }
  | { label: string; question: string }

/**
 * The owl docked above the tab bar on Today (SovaAgent mockup 1, 5, 6): suggestions, then the
 * bar. Tap opens the conversation, + opens "Daj sovi dokument". Offline or without an AI key
 * the bar is dimmed with the sleeping owl.
 */
export function OwlBar({ empty }: { empty: boolean }) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { state } = useAiAvailability()
  const owl = useOwl()
  const openSheet = useOwlStore((s) => s.openSheet)
  const newConversation = useOwlStore((s) => s.newConversation)
  const enabled = state === 'ready'

  const suggestions: Suggestion[] = empty
    ? [
        { label: t('owl.suggest.addSubject'), to: '/subjects/new' },
        { label: t('owl.suggest.importCalendar'), kind: 'academic_calendar' },
        { label: t('owl.suggest.importExams'), kind: 'exam_schedule' },
      ]
    : [
        { label: t('owl.suggest.important'), question: t('owl.suggest.important') },
        { label: t('owl.suggest.importExams'), kind: 'exam_schedule' },
        { label: t('owl.suggest.makeup'), question: t('owl.suggest.makeup') },
      ]

  const pick = (s: Suggestion) => {
    if ('to' in s) return navigate(s.to)
    if ('kind' in s) return openSheet(s.kind)
    newConversation()
    navigate('/chat')
    void owl.ask(s.question)
  }

  if (state === 'offline' || state === 'disabled') {
    return (
      <Dock>
        <div className="flex h-14 items-center gap-2 rounded-full glass px-1.5 opacity-70 shadow-[0_6px_24px_rgba(47,35,99,0.14)]">
          <OwlHead enabled={false} />
          <span className="flex-1 text-sm text-ink-subtle">
            {state === 'offline' ? t('owl.offline') : t('owl.disabled')}
          </span>
        </div>
      </Dock>
    )
  }

  return (
    <Dock>
      <div className="-mx-4 flex gap-1.5 overflow-x-auto px-4 pb-0.5 [scrollbar-width:none]">
        {suggestions.map((s) => (
          <button
            key={s.label}
            type="button"
            disabled={!enabled && !('to' in s)}
            onClick={() => pick(s)}
            className="h-[34px] shrink-0 rounded-full glass px-3 text-xs font-semibold whitespace-nowrap text-brand shadow-[0_2px_8px_rgba(47,35,99,0.08)] disabled:opacity-60"
          >
            {s.label}
          </button>
        ))}
      </div>
      <div className="flex h-14 items-center gap-2 rounded-full glass px-1.5 shadow-[0_6px_24px_rgba(47,35,99,0.14)]">
        <button
          type="button"
          onClick={() => {
            // Every visit from Today starts a new conversation; old ones are in the history.
            newConversation()
            navigate('/chat')
          }}
          aria-label={t('owl.open')}
          className="flex h-11 min-w-0 flex-1 items-center gap-2 text-left"
        >
          <OwlHead />
          <span className="truncate text-[15px] text-ink-subtle">
            {empty ? t('owl.askEmpty') : t('owl.ask')}
          </span>
        </button>
        <button
          type="button"
          onClick={() => openSheet()}
          disabled={!enabled}
          aria-label={t('owl.add')}
          className="flex size-11 shrink-0 items-center justify-center rounded-full bg-canvas text-brand disabled:opacity-60"
        >
          <PlusIcon size={20} />
        </button>
      </div>
    </Dock>
  )
}

export function Dock({ children }: { children: React.ReactNode }) {
  return (
    <>
      {/* Fades the scrolling list out behind the bar and the tab bar. */}
      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-20 h-[calc(190px+env(safe-area-inset-bottom))] bg-linear-to-t from-canvas via-canvas/90 to-transparent" />
      <div className="pointer-events-none fixed inset-x-0 bottom-[calc(92px+env(safe-area-inset-bottom))] z-30 flex justify-center px-4">
        <div className="pointer-events-auto flex w-full max-w-[398px] flex-col gap-2">
          {children}
        </div>
      </div>
    </>
  )
}

/** The assistant's avatar: the AI spark on a glass circle, dimmed when it is unavailable. */
export function OwlHead({
  enabled = true,
  size = 44,
  className,
}: {
  enabled?: boolean
  size?: number
  className?: string
}) {
  return (
    <span
      className={cn(
        'flex shrink-0 items-center justify-center rounded-full bg-white/60',
        enabled ? 'text-brand-accent' : 'text-ink-subtle',
        className,
      )}
      style={{ width: size, height: size }}
    >
      <AiSparkIcon size={Math.round(size * 0.48)} />
    </span>
  )
}
