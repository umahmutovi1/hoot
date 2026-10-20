import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { CloseIcon, DocIcon, PlusIcon, SendIcon, TrashIcon } from '@/components/icons'
import { useSubjects } from '@/features/subjects/api'
import { cn } from '@/lib/utils'
import type { Citation } from '@shared/schemas.ts'
import { openDocumentFile, useAiAvailability, useDocuments } from './api'
import { GiveDocumentSheet } from './GiveDocumentSheet'
import { ImportCard } from './ImportCard'
import { OwlHead } from './OwlBar'
import { useOwlStore, type OwlMessage, type StateRef } from './store'
import { useOwl } from './useOwl'

/** Conversation with the owl over the whole screen (SovaAgent mockups 2 and 4). */
export function OwlChatPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const messages = useOwlStore((s) => s.messages)
  const busy = useOwlStore((s) => s.busy)
  const openSheet = useOwlStore((s) => s.openSheet)
  const clear = useOwlStore((s) => s.clear)
  const { state } = useAiAvailability()
  const owl = useOwl()
  const [question, setQuestion] = useState('')
  const end = useRef<HTMLDivElement>(null)
  const enabled = state === 'ready'

  useEffect(() => {
    end.current?.scrollIntoView({ block: 'end' })
  }, [messages])

  const close = () => (window.history.length > 1 ? navigate(-1) : navigate('/'))

  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (!question.trim() || busy || !enabled) return
    void owl.ask(question)
    setQuestion('')
  }

  return (
    <div className="flex min-h-[calc(100dvh-48px)] flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2.5">
          <OwlHead pose={enabled ? 'reading-head' : 'sleeping-head'} size={40} />
          <div className="flex min-w-0 flex-col">
            <h1 className="text-lg font-bold">{t('owl.name')}</h1>
            <span className="truncate text-xs text-ink-muted">{t('owl.tagline')}</span>
          </div>
        </div>
        <div className="flex gap-1.5">
          {messages.length > 0 && (
            <button
              type="button"
              onClick={clear}
              disabled={busy}
              aria-label={t('owl.clear')}
              className="flex size-11 items-center justify-center rounded-full bg-surface text-ink-muted"
            >
              <TrashIcon size={18} />
            </button>
          )}
          <button
            type="button"
            onClick={close}
            aria-label={t('common.close')}
            className="flex size-11 items-center justify-center rounded-full bg-surface text-ink-muted"
          >
            <CloseIcon size={18} />
          </button>
        </div>
      </div>

      <div className="flex flex-1 flex-col justify-end gap-3 pb-2" aria-live="polite">
        {messages.length === 0 && <OwlBubble>{t('owl.intro')}</OwlBubble>}
        {messages.map((m) => (
          <Message key={m.id} message={m} />
        ))}
        <div ref={end} className="scroll-mb-24" />
      </div>

      <form
        onSubmit={submit}
        className="sticky bottom-[calc(12px+env(safe-area-inset-bottom))] flex h-14 items-center gap-2 rounded-full bg-surface px-1.5 shadow-[0_6px_24px_rgba(47,35,99,0.10)]"
      >
        <button
          type="button"
          onClick={() => openSheet()}
          disabled={!enabled || busy}
          aria-label={t('owl.add')}
          className="flex size-11 shrink-0 items-center justify-center rounded-full bg-canvas text-brand disabled:opacity-60"
        >
          <PlusIcon size={20} />
        </button>
        <input
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          maxLength={1000}
          disabled={!enabled}
          placeholder={
            state === 'offline'
              ? t('owl.offline')
              : state === 'disabled'
                ? t('owl.disabled')
                : t('owl.ask')
          }
          aria-label={t('owl.ask')}
          className="h-11 min-w-0 flex-1 bg-transparent text-[15px] outline-none placeholder:text-ink-subtle"
        />
        <button
          type="submit"
          disabled={!enabled || busy || !question.trim()}
          aria-label={t('owl.send')}
          className="flex size-11 shrink-0 items-center justify-center rounded-full bg-brand text-white disabled:opacity-60"
        >
          <SendIcon size={20} />
        </button>
      </form>
      <GiveDocumentSheet />
    </div>
  )
}

function OwlBubble({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex max-w-[88%] flex-col gap-2 self-start rounded-[20px_20px_20px_6px] bg-surface px-3.5 py-3 text-sm leading-[1.45]">
      {children}
    </div>
  )
}

function Message({ message: m }: { message: OwlMessage }) {
  const { t } = useTranslation()
  switch (m.type) {
    case 'text':
      return (
        <div className="max-w-[80%] self-end rounded-[20px_20px_6px_20px] bg-brand px-3.5 py-2.5 text-sm leading-[1.4] whitespace-pre-wrap text-white">
          {m.text}
        </div>
      )
    case 'file':
      return (
        <div className="flex max-w-[80%] items-center gap-2 self-end rounded-[20px_20px_6px_20px] bg-brand px-3.5 py-2.5 text-sm text-white">
          <DocIcon size={18} />
          <span className="truncate">{m.name}</span>
        </div>
      )
    case 'pending':
      return (
        <OwlBubble>
          <span className="animate-pulse text-ink-muted">{t(`owl.pending.${m.stage}`)}</span>
        </OwlBubble>
      )
    case 'error':
      return (
        <OwlBubble>
          <span className="text-danger">{t(`owl.error.${m.code}`)}</span>
        </OwlBubble>
      )
    case 'answer':
      return (
        <OwlBubble>
          <span className="whitespace-pre-wrap">{m.text}</span>
          {m.citations.map((c) => (
            <CitationChip key={`${c.document_id}:${c.page}`} citation={c} />
          ))}
          {m.stateRefs.map((r) => (
            <StateChip key={`${r.subject}:${r.topic}`} stateRef={r} />
          ))}
        </OwlBubble>
      )
    case 'document':
      return (
        <OwlBubble>
          <span>{t('owl.document.stored', { title: m.title })}</span>
          {m.found > 0 ? (
            <span>{t('owl.document.found', { count: m.found })}</span>
          ) : (
            (m.kind === 'academic_calendar' || m.kind === 'exam_schedule') && (
              <span>{t('owl.document.noDates')}</span>
            )
          )}
        </OwlBubble>
      )
    case 'proposal':
      return <ImportCard messageId={m.id} proposal={m.proposal} />
  }
}

const chip =
  'inline-flex min-h-7 max-w-full items-center gap-1.5 self-start rounded-full px-2.5 py-1 text-xs font-semibold text-brand'

/** "Akademski kalendar 2026/27 · str. 2"; opens the stored file at that page. */
function CitationChip({ citation }: { citation: Citation }) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const doc = useDocuments().data?.find((d) => d.id === citation.document_id)
  const open = () => {
    if (doc?.storage_path) void openDocumentFile(doc.storage_path, citation.page)
    else navigate(`/settings/documents/${citation.document_id}`)
  }
  return (
    <button type="button" onClick={open} className={cn(chip, 'bg-canvas text-left')}>
      <DocIcon size={14} />
      <span className="truncate">
        {citation.title}
        {citation.page ? ` · ${t('owl.page', { page: citation.page })}` : ''}
      </span>
    </button>
  )
}

/** "Signali i sistemi › Bodovi i ocjena"; links to the subject when the owl named one. */
function StateChip({ stateRef }: { stateRef: StateRef }) {
  const { t } = useTranslation()
  const subject = useSubjects().data?.find((s) => s.name === stateRef.subject)
  const label = `${stateRef.subject ? `${stateRef.subject} › ` : ''}${t(`owl.stateRef.${stateRef.topic}`)}`
  const to = subject
    ? `/subjects/${subject.id}`
    : stateRef.topic === 'calendar'
      ? '/settings/calendar'
      : '/plan'
  return (
    <Link to={to} className={cn(chip, 'bg-brand-soft')}>
      <span className="truncate">{label}</span>
    </Link>
  )
}
