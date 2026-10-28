import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { format } from 'date-fns'
import type { TFunction } from 'i18next'
import { useQuery } from '@tanstack/react-query'
import { ScreenTitle } from '@/components/ScreenTitle'
import { DocIcon, TrashIcon } from '@/components/icons'
import { SwipeRow } from '@/components/SwipeRow'
import { Button } from '@/components/ui/button'
import { useLocale } from '@/features/settings/useLocale'
import { dateFnsLocales } from '@/lib/locale'
import { supabase } from '@/lib/supabase'
import { useDeleteDocument, useDocumentFileUrl, useDocuments, type DocumentRow } from './api'
import { GiveDocumentSheet } from './GiveDocumentSheet'
import { useOwlStore } from './store'

/** Documents the owl answers from (Postavke → Dokumenti); swipe left deletes one, with undo. */
export function DocumentsPage() {
  const { t } = useTranslation()
  const { locale } = useLocale()
  const { data: documents } = useDocuments()
  const remove = useDeleteDocument()
  const openSheet = useOwlStore((s) => s.openSheet)

  return (
    <div className="flex flex-col gap-3.5">
      <ScreenTitle title={t('owl.documents.title')} />
      <GiveDocumentSheet />
      <p className="px-1 text-sm leading-[1.45] text-ink-muted">{t('owl.documents.intro')}</p>
      <Button type="button" size="pill" className="btn-primary" onClick={() => openSheet()}>
        {t('owl.documents.add')}
      </Button>
      {documents && documents.length === 0 && (
        <p className="rounded-card glass p-4 text-sm text-ink-muted">{t('owl.documents.empty')}</p>
      )}
      {documents && documents.length > 0 && (
        <div className="flex flex-col overflow-hidden rounded-card glass py-1.5">
          {documents.map((d, i) => (
            <SwipeRow
              key={d.id}
              actions={[
                {
                  id: 'delete',
                  label: t('swipe.delete'),
                  tone: 'danger',
                  icon: <TrashIcon size={18} />,
                  deferred: t('swipe.documentDeleted'),
                  run: () => remove.mutateAsync(d),
                },
              ]}
            >
              <Link
                to={`/settings/documents/${d.id}`}
                className={`mx-4 flex items-center gap-3 py-3 ${i > 0 ? 'border-t border-canvas' : ''}`}
              >
                <span className="flex size-10 shrink-0 items-center justify-center rounded-[14px] bg-canvas text-brand">
                  <DocIcon size={18} />
                </span>
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="truncate text-[15px] font-semibold">{d.title}</span>
                  <span className="text-xs text-ink-muted">{documentMeta(t, d, locale)}</span>
                </span>
                <span className="text-ink-muted">›</span>
              </Link>
            </SwipeRow>
          ))}
        </div>
      )}
    </div>
  )
}

function documentMeta(t: TFunction, d: DocumentRow, locale: 'bs' | 'en') {
  const parts = [
    t(`owl.kind.${d.kind as 'other'}`),
    format(new Date(d.created_at), 'd. MMM yyyy', { locale: dateFnsLocales[locale] }),
    d.storage_path
      ? d.pages
        ? t('owl.documents.pages', { count: d.pages })
        : null
      : t('owl.documents.pasted'),
  ]
  return parts.filter(Boolean).join(' · ')
}

/** One document: its text as the owl stored it, the file, delete. */
export function DocumentPage() {
  const { t } = useTranslation()
  const { locale } = useLocale()
  const navigate = useNavigate()
  const { id } = useParams()
  const doc = useDocuments().data?.find((d) => d.id === id)
  const remove = useDeleteDocument()
  const [confirming, setConfirming] = useState(false)
  const fileUrl = useDocumentFileUrl(doc?.storage_path).data
  const chunks = useQuery({
    queryKey: ['document-chunks', id],
    enabled: Boolean(id),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('document_chunks')
        .select('id, page, position, content')
        .eq('document_id', id!)
        .order('position')
      if (error) throw error
      return data
    },
  })

  if (!doc) return <ScreenTitle title={t('owl.documents.title')} />

  return (
    <div className="flex flex-col gap-3.5">
      <ScreenTitle title={t('owl.documents.title')} />
      <div className="flex flex-col gap-1 px-1">
        <h2 className="text-[22px] leading-tight font-bold">{doc.title}</h2>
        <span className="text-[13px] text-ink-muted">{documentMeta(t, doc, locale)}</span>
      </div>
      {fileUrl && (
        <Button asChild variant="secondary" size="pill-sm" className="bg-brand-soft text-brand">
          <a href={fileUrl} target="_blank" rel="noopener noreferrer">
            {t('owl.documents.openFile')}
          </a>
        </Button>
      )}
      <div className="flex flex-col gap-3 rounded-card glass p-4 text-sm leading-[1.5]">
        {(chunks.data ?? []).map((c, i, all) => (
          <div key={c.id} className="flex flex-col gap-1">
            {c.page && c.page !== all[i - 1]?.page && (
              <span className="text-xs font-semibold text-ink-muted">
                {t('owl.page', { page: c.page })}
              </span>
            )}
            <p className="whitespace-pre-wrap">{c.content}</p>
          </div>
        ))}
      </div>
      {confirming ? (
        <div className="flex flex-col gap-2 rounded-card glass p-4">
          <span className="text-sm">{t('owl.documents.confirmDelete')}</span>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="secondary"
              size="pill-sm"
              className="flex-1"
              onClick={() => setConfirming(false)}
            >
              {t('common.cancel')}
            </Button>
            <Button
              type="button"
              size="pill-sm"
              className="flex-1 bg-danger text-white hover:bg-danger/90"
              disabled={remove.isPending}
              onClick={() =>
                remove.mutate(doc, {
                  onSuccess: () => navigate('/settings/documents', { replace: true }),
                })
              }
            >
              {t('owl.documents.delete')}
            </Button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setConfirming(true)}
          className="h-[52px] rounded-full glass text-[15px] font-semibold text-danger"
        >
          {t('owl.documents.delete')}
        </button>
      )}
    </div>
  )
}
