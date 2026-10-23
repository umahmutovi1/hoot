import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { AiSparkIcon, ClockIcon, DocIcon, PencilIcon, PlusIcon, SendIcon } from '@/components/icons'
import { useSubjects } from '@/features/subjects/api'
import { cn } from '@/lib/utils'
import type { Citation } from '@shared/schemas.ts'
import { useAiAvailability, useDocumentFileUrl, useDocuments } from './api'
import { ChatPlan } from './ChatPlan'
import { GiveDocumentSheet } from './GiveDocumentSheet'
import { ActionCard } from './ActionCard'
import { ImportCard } from './ImportCard'
import { useOwlStore, type OwlMessage, type StateRef } from './store'
import { useOwl } from './useOwl'

/** The assistant in the AI tab (Chat.dc.html): conversation, suggestions and the document +. */
export function OwlChatPage() {
  const { t } = useTranslation()
  const messages = useOwlStore((s) => s.messages)
  const busy = useOwlStore((s) => s.busy)
  const openSheet = useOwlStore((s) => s.openSheet)
  const newConversation = useOwlStore((s) => s.newConversation)
  const { state } = useAiAvailability()
  const owl = useOwl()
  const [question, setQuestion] = useState('')
  const end = useRef<HTMLDivElement>(null)
  const enabled = state === 'ready'

  useEffect(() => {
    end.current?.scrollIntoView({ block: 'end' })
  }, [messages])

  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (!question.trim() || busy || !enabled) return
    void owl.ask(question)
    setQuestion('')
  }

  const suggestions = [
    { label: t('owl.suggest.important'), ask: t('owl.suggest.important') },
    { label: t('owl.suggest.importExams'), kind: 'exam_schedule' as const },
    { label: t('owl.suggest.makeup'), ask: t('owl.suggest.makeup') },
  ]

  return (
    <div className="flex flex-1 flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 flex-col">
          <h1 className="truncate text-[30px] font-bold tracking-[-0.6px]">{t('owl.name')}</h1>
          <span className="truncate text-[13px] text-ink-secondary">
            {state === 'ready'
              ? t('owl.tagline')
              : state === 'offline'
                ? t('owl.offline')
                : t('owl.disabled')}
          </span>
        </div>
        <div className="flex shrink-0 gap-2">
          <Link
            to="/chat/history"
            aria-label={t('owl.history.title')}
            className="glass flex size-11 items-center justify-center rounded-full text-ink"
          >
            <ClockIcon size={18} />
          </Link>
          {messages.length > 0 && (
            <button
              type="button"
              onClick={newConversation}
              disabled={busy}
              aria-label={t('owl.history.new')}
              className="glass flex size-11 items-center justify-center rounded-full text-ink disabled:opacity-60"
            >
              <PencilIcon size={18} />
            </button>
          )}
        </div>
      </div>

      <ChatPlan />
      <div className="flex flex-1 flex-col justify-end gap-3 pb-2" aria-live="polite">
        {messages.length === 0 && <OwlBubble>{t('owl.intro')}</OwlBubble>}
        {messages.map((m) => (
          <Message key={m.id} message={m} />
        ))}
        <div ref={end} className="scroll-mb-24" />
      </div>

      <div className="sticky bottom-[calc(16px+env(safe-area-inset-bottom)+var(--vv-bottom,0px))] z-10 keyboard:bottom-[calc(8px+var(--vv-bottom,0px))] flex flex-col gap-2">
        {enabled && messages.length === 0 && (
          <div className="-mx-5 flex gap-2 overflow-x-auto px-5 py-0.5 [scrollbar-width:none]">
            {suggestions.map((sug) => (
              <button
                key={sug.label}
                type="button"
                disabled={busy}
                onClick={() => (sug.kind ? openSheet(sug.kind) : void owl.ask(sug.ask))}
                className="glass-flat h-9 shrink-0 rounded-full px-3.5 text-[13px] font-semibold whitespace-nowrap text-brand disabled:opacity-60"
              >
                {sug.label}
              </button>
            ))}
          </div>
        )}
        <form
          onSubmit={submit}
          className="glass-strong flex h-14 items-center gap-2 rounded-full px-1.5"
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
            className="flex size-11 shrink-0 items-center justify-center rounded-full btn-primary disabled:opacity-60"
          >
            <SendIcon size={20} />
          </button>
        </form>
      </div>
      <GiveDocumentSheet />
    </div>
  )
}

function OwlBubble({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex gap-2.5 self-stretch">
      <span
        aria-hidden="true"
        className="icon-tile flex size-8 shrink-0 items-center justify-center rounded-full"
      >
        <AiSparkIcon size={15} />
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-2 pt-1 text-[15px] leading-[1.45]">
        {children}
      </div>
    </div>
  )
}

function Message({ message: m }: { message: OwlMessage }) {
  const { t } = useTranslation()
  switch (m.type) {
    case 'text':
      return (
        <div className="max-w-[80%] self-end glass-tint rounded-[20px_20px_6px_20px] px-3.5 py-2.5 text-[15px] leading-[1.35] whitespace-pre-wrap">
          {m.text}
        </div>
      )
    case 'file':
      return (
        <div className="flex max-w-[80%] flex-col gap-1.5 self-end glass-tint rounded-[20px_20px_6px_20px] px-3.5 py-2.5 text-sm">
          <span className="flex min-w-0 items-center gap-2">
            <DocIcon size={18} className="shrink-0" />
            <span className="truncate">{m.name}</span>
          </span>
          {m.note && <span className="leading-[1.4] whitespace-pre-wrap">{m.note}</span>}
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
          {m.action && <ActionCard action={m.action} />}
        </OwlBubble>
      )
    case 'document':
      return (
        <OwlBubble>
          <span>
            {m.again
              ? t('owl.document.again', { title: m.title })
              : m.stored === false
                ? t('owl.document.notStored', { title: m.title })
                : t('owl.document.stored', { title: m.title })}
          </span>
          {m.found > 0 ? (
            <span>{t('owl.document.found', { count: m.found })}</span>
          ) : m.again ? (
            <span>{t('owl.document.nothingAgain')}</span>
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
  const doc = useDocuments().data?.find((d) => d.id === citation.document_id)
  const fileUrl = useDocumentFileUrl(doc?.storage_path).data
  const label = (
    <>
      <DocIcon size={14} className="shrink-0" />
      <span className="truncate">
        {citation.title}
        {citation.page ? ` · ${t('owl.page', { page: citation.page })}` : ''}
      </span>
    </>
  )
  // A stored file opens in a new tab at the page; pasted text opens its document page.
  return fileUrl ? (
    <a
      href={citation.page ? `${fileUrl}#page=${citation.page}` : fileUrl}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(chip, 'bg-canvas')}
    >
      {label}
    </a>
  ) : (
    <Link to={`/settings/documents/${citation.document_id}`} className={cn(chip, 'bg-canvas')}>
      {label}
    </Link>
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
