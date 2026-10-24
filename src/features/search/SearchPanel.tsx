import { useMemo, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Dialog } from 'radix-ui'
import {
  BookIcon,
  CalendarIcon,
  ChevronRightIcon,
  ClockIcon,
  CloseIcon,
  DocIcon,
  GearIcon,
  HomeIcon,
  SearchIcon,
  SparkleIcon,
} from '@/components/icons'
import { paletteOf } from '@/features/subjects/colors'
import { cn } from '@/lib/utils'
import {
  addRecent,
  createSearcher,
  highlight,
  type SearchEntry,
  type SearchGroup,
  type SearchHit,
} from './search'
import { useSearchIndex } from './useSearchIndex'

const RECENT_KEY = 'hoot.search.recent'
const SHOWN = 3

const groupIcon: Record<SearchGroup, ReactNode> = {
  actions: <SparkleIcon size={18} />,
  screens: <HomeIcon size={18} />,
  settings: <GearIcon size={18} />,
  subjects: <BookIcon size={18} />,
  exams: <CalendarIcon size={18} />,
  sources: <DocIcon size={18} />,
  units: <BookIcon size={18} />,
  documents: <DocIcon size={18} />,
}

function readRecent(): string[] {
  try {
    const list = JSON.parse(localStorage.getItem(RECENT_KEY) ?? '[]') as unknown
    return Array.isArray(list) ? list.filter((x): x is string => typeof x === 'string') : []
  } catch {
    return []
  }
}

function writeRecent(list: string[]) {
  try {
    localStorage.setItem(RECENT_KEY, JSON.stringify(list))
  } catch {
    // Private mode or blocked storage: recent searches are a convenience only.
  }
}

/**
 * Search (Pretraga.dc.html, Stage 10b): a glass panel from the top like the menu. The field is
 * focused at once; results are grouped (three per group, "Sve (N)" for the rest) with the match in
 * bold; a tap opens the screen or the action's sheet and keeps the query in recent searches (on
 * this device). An empty field shows the recent ones.
 */
export function SearchPanel({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const { t } = useTranslation()
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-scrim duration-150 data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0" />
        <Dialog.Content
          aria-describedby={undefined}
          className="glass-sheet fixed inset-x-3 top-[calc(16px+env(safe-area-inset-top))] z-50 mx-auto flex max-h-[calc(100dvh-32px-env(safe-area-inset-top)-var(--vv-bottom,0px))] max-w-[406px] origin-top flex-col overflow-hidden rounded-[30px] duration-200 data-open:animate-in data-open:fade-in-0 data-open:slide-in-from-top-2 data-closed:animate-out data-closed:fade-out-0"
        >
          <Dialog.Title className="sr-only">{t('search.open')}</Dialog.Title>
          {open && <Body onClose={() => onOpenChange(false)} />}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

function Body({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const index = useSearchIndex()
  const search = useMemo(() => createSearcher(index), [index])
  const [query, setQuery] = useState('')
  const [recent, setRecent] = useState(readRecent)
  const [expanded, setExpanded] = useState<SearchGroup[]>([])
  const groups = useMemo(() => search(query), [search, query])

  const go = (entry: SearchEntry) => {
    const next = addRecent(recent, query)
    writeRecent(next)
    setRecent(next)
    onClose()
    navigate(entry.to)
  }

  return (
    <>
      <div className="flex items-center gap-2 p-2 pl-3">
        <label className="flex h-11 flex-1 items-center gap-2 rounded-full bg-canvas pr-1.5 pl-3.5">
          <SearchIcon size={18} className="shrink-0 text-ink-muted" />
          <input
            // The panel exists to type into.
            // oxlint-disable-next-line jsx-a11y/no-autofocus
            autoFocus
            type="search"
            enterKeyHint="go"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              setExpanded([])
            }}
            onKeyDown={(e) => {
              const first = groups[0]?.hits[0]
              if (e.key === 'Enter' && first) go(first.entry)
            }}
            placeholder={t('search.placeholder')}
            aria-label={t('search.placeholder')}
            className="h-full min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-ink-placeholder [&::-webkit-search-cancel-button]:hidden"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery('')}
              aria-label={t('search.clear')}
              className="flex size-8 shrink-0 items-center justify-center rounded-full text-ink-muted"
            >
              <CloseIcon size={16} />
            </button>
          )}
        </label>
        <button
          type="button"
          onClick={onClose}
          className="flex h-11 items-center px-2 text-base font-medium text-brand"
        >
          {t('search.cancel')}
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 pb-3">
        {query.trim().length < 2 ? (
          recent.length > 0 ? (
            <Group
              title={t('search.recent')}
              action={
                <button
                  type="button"
                  onClick={() => {
                    writeRecent([])
                    setRecent([])
                  }}
                  className="text-[13px] font-semibold text-brand"
                >
                  {t('search.clearRecent')}
                </button>
              }
            >
              {recent.map((q) => (
                <button
                  key={q}
                  type="button"
                  onClick={() => setQuery(q)}
                  className="flex min-h-12 w-full items-center gap-3 rounded-2xl px-2 text-left"
                >
                  <ClockIcon size={18} className="shrink-0 text-ink-muted" />
                  <span className="truncate text-[15px]">{q}</span>
                </button>
              ))}
            </Group>
          ) : (
            <p className="px-2 py-4 text-center text-xs text-ink-muted">{t('search.offline')}</p>
          )
        ) : groups.length === 0 ? (
          <div className="flex flex-col gap-1.5 px-4 pt-5 pb-6 text-center">
            <span className="text-base font-semibold">
              {t('search.none', { query: query.trim() })}
            </span>
            <span className="text-sm leading-[1.45] text-ink-secondary">{t('search.noneSub')}</span>
          </div>
        ) : (
          groups.map(({ group, hits }) => {
            const all = expanded.includes(group)
            return (
              <Group
                key={group}
                title={t(`search.group.${group}`)}
                action={
                  hits.length > SHOWN && !all ? (
                    <button
                      type="button"
                      onClick={() => setExpanded([...expanded, group])}
                      className="text-[13px] font-semibold text-brand"
                    >
                      {t('search.all', { count: hits.length })}
                    </button>
                  ) : null
                }
              >
                {(all ? hits : hits.slice(0, SHOWN)).map((hit) => (
                  <Result key={hit.entry.id} hit={hit} onPick={() => go(hit.entry)} />
                ))}
              </Group>
            )
          })
        )}
      </div>
    </>
  )
}

function Group({
  title,
  action,
  children,
}: {
  title: string
  action?: ReactNode
  children: ReactNode
}) {
  return (
    <section className="flex flex-col pt-1.5">
      <div className="flex items-baseline justify-between px-2 pt-2 pb-1">
        <h3 className="text-xs font-semibold tracking-[0.4px] text-ink-secondary uppercase">
          {title}
        </h3>
        {action}
      </div>
      {children}
    </section>
  )
}

function Result({ hit, onPick }: { hit: SearchHit; onPick: () => void }) {
  const { entry } = hit
  const palette = entry.color !== undefined ? paletteOf(entry.color) : null
  return (
    <button
      type="button"
      onClick={onPick}
      className="flex min-h-[52px] w-full items-center gap-3 rounded-2xl px-2 py-1.5 text-left active:bg-canvas"
    >
      <span
        className={cn(
          'flex size-[34px] shrink-0 items-center justify-center rounded-[11px]',
          palette ? palette.soft : 'bg-brand-soft text-brand',
          palette?.deepText,
        )}
      >
        {groupIcon[entry.group]}
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-px">
        <span className="truncate text-[15px]">
          {highlight(entry.title, hit.ranges).map((p, i) =>
            p.match ? <b key={i}>{p.text}</b> : <span key={i}>{p.text}</span>,
          )}
        </span>
        {entry.sub && <span className="truncate text-xs text-ink-muted">{entry.sub}</span>}
      </span>
      <ChevronRightIcon size={14} className="shrink-0 text-ink-subtle" />
    </button>
  )
}
