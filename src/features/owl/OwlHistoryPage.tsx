import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { format } from 'date-fns'
import { BackHeader } from '@/components/BackHeader'
import { TrashIcon } from '@/components/icons'
import { Button } from '@/components/ui/button'
import { useLocale } from '@/features/settings/useLocale'
import { dateFnsLocales } from '@/lib/locale'
import { loadConversationMessages, useConversations, useDeleteConversation } from './api'
import { useOwlStore } from './store'

/** Past conversations with the owl; tap continues one, the pencil in the chat starts a new one. */
export function OwlHistoryPage() {
  const { t } = useTranslation()
  const { locale } = useLocale()
  const navigate = useNavigate()
  const { data: conversations } = useConversations()
  const remove = useDeleteConversation()
  const openConversation = useOwlStore((s) => s.openConversation)
  const newConversation = useOwlStore((s) => s.newConversation)
  const currentId = useOwlStore((s) => s.conversationId)
  const busy = useOwlStore((s) => s.busy)
  const [confirming, setConfirming] = useState<string | null>(null)
  const [opening, setOpening] = useState<string | null>(null)

  const open = async (id: string) => {
    if (busy) return
    setOpening(id)
    try {
      openConversation(id, await loadConversationMessages(id))
      navigate('/chat', { replace: true })
    } finally {
      setOpening(null)
    }
  }

  return (
    <div className="flex flex-col gap-3.5">
      <BackHeader title={t('owl.history.title')} fallback="/chat" />
      {conversations && conversations.length === 0 && (
        <p className="rounded-card glass p-4 text-sm text-ink-muted">{t('owl.history.empty')}</p>
      )}
      {conversations && conversations.length > 0 && (
        <div className="flex flex-col rounded-card glass px-4 py-1.5">
          {conversations.map((c, i) => (
            <div key={c.id} className={i > 0 ? 'border-t border-canvas' : ''}>
              {confirming === c.id ? (
                <div className="flex flex-col gap-2 py-3">
                  <span className="text-sm">{t('owl.history.confirmDelete')}</span>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="secondary"
                      size="pill-sm"
                      className="flex-1"
                      onClick={() => setConfirming(null)}
                    >
                      {t('common.cancel')}
                    </Button>
                    <Button
                      type="button"
                      size="pill-sm"
                      className="flex-1 bg-danger text-white hover:bg-danger/90"
                      disabled={remove.isPending || (busy && c.id === currentId)}
                      onClick={() =>
                        remove.mutate(c.id, {
                          onSuccess: () => {
                            if (c.id === currentId) newConversation()
                            setConfirming(null)
                          },
                        })
                      }
                    >
                      {t('owl.history.delete')}
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => void open(c.id)}
                    disabled={opening !== null}
                    className="flex min-h-14 min-w-0 flex-1 flex-col justify-center gap-0.5 py-2.5 text-left"
                  >
                    <span className="truncate text-[15px] font-semibold">
                      {c.title || t('owl.history.untitled')}
                    </span>
                    <span className="text-xs text-ink-muted first-letter:uppercase">
                      {format(new Date(c.last_message_at), 'EEEE, d. MMM · HH:mm', {
                        locale: dateFnsLocales[locale],
                      })}
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirming(c.id)}
                    aria-label={t('owl.history.delete')}
                    className="flex size-11 shrink-0 items-center justify-center rounded-full text-ink-muted"
                  >
                    <TrashIcon size={18} />
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
