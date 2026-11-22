import { useRef, useState } from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { BottomSheet } from '@/components/BottomSheet'
import {
  BookIcon,
  CheckIcon,
  ChevronRightIcon,
  CloseIcon,
  DocIcon,
  PencilIcon,
  WarningIcon,
} from '@/components/icons'
import { OfflineNotice } from '@/components/OfflineNotice'
import { ScreenTitle } from '@/components/ScreenTitle'
import { DetailSkeleton } from '@/components/Skeleton'
import { useToast } from '@/components/toast-store'
import { useOnline } from '@/features/owl/api'
import { Stepper } from '@/features/session/Stepper'
import {
  coverage,
  pageOffset,
  unitChunks,
  unitRanges,
  type TextUnit,
  type UnitChunk,
} from '@/lib/sourceText'
import type { PageText } from '@/lib/documents/chunk'
import { cn } from '@/lib/utils'
import { useSource } from './api'
import { activeUnits, type SourceWithUnits } from './model'
import { readPdfPages } from './textRead'
import { useDeleteSourceText, useSaveSourceText, useSaveUnitText, useSourceText } from './textApi'

type Phase =
  | { kind: 'pick' }
  | { kind: 'reading'; page: number; total: number }
  | { kind: 'confirm'; pages: PageText[]; offset: number }
  | { kind: 'done'; chunks: UnitChunk[]; pages: number }
  | { kind: 'scanned'; fileName: string; pageCount: number }
  | { kind: 'failed' }

const card = 'overflow-hidden rounded-[24px] surface'
const row = 'flex min-h-14 w-full items-center gap-3 px-4 py-2 text-left'
const rowLine = 'border-t border-hairline first:border-t-0'
const tile = 'flex size-10 shrink-0 items-center justify-center rounded-[13px]'
const h2 = 'mt-4 px-1 text-[22px] font-bold'

/** Tekst izvora (boards TekstIzvora, TekstSkeniran; PRD "Tekst izvora, sažetak i kartice"). */
export function SourceTextPage() {
  const { id, sourceId } = useParams()
  const { data: source, isPending } = useSource(id, sourceId)
  if (isPending) return <DetailSkeleton />
  if (!source) return <Navigate to={id ? `/subjects/${id}` : '/subjects'} replace />
  return <SourceText subjectId={id!} source={source} />
}

/** The source's leaf units in outline order, with the book's pages. */
function textUnits(source: SourceWithUnits): TextUnit[] {
  const units = activeUnits(source)
  const parents = new Set(units.map((u) => u.parent_id).filter(Boolean))
  return units
    .filter((u) => !parents.has(u.id))
    .map((u) => ({ id: u.id, title: u.title, pageStart: u.page_start, pageEnd: u.page_end }))
}

/** Top-level units with the pages their leaves cover ("Po poglavljima"). */
function chapters(source: SourceWithUnits, leaves: TextUnit[]) {
  const units = activeUnits(source)
  const byId = new Map(units.map((u) => [u.id, u]))
  const ranges = unitRanges(leaves)
  const rootOf = (unitId: string) => {
    let u = byId.get(unitId)
    while (u?.parent_id && byId.has(u.parent_id)) u = byId.get(u.parent_id)
    return u
  }
  const out = new Map<string, { title: string; label: string | null; from: number; to: number }>()
  for (const [unitId, r] of ranges) {
    const root = rootOf(unitId)
    if (!root) continue
    const prev = out.get(root.id)
    out.set(root.id, {
      title: root.title,
      label: root.label,
      from: Math.min(prev?.from ?? r.from, r.from),
      to: Math.max(prev?.to ?? r.to, r.to),
    })
  }
  return [...out.values()]
}

function SourceText({ subjectId, source }: { subjectId: string; source: SourceWithUnits }) {
  const { t } = useTranslation()
  const online = useOnline()
  const input = useRef<HTMLInputElement>(null)
  const [phase, setPhase] = useState<Phase>({ kind: 'pick' })
  const [pasting, setPasting] = useState(false)
  const [hidden, setHidden] = useState(false)
  const status = useSourceText(source.id)
  const save = useSaveSourceText(subjectId, source.id)
  const remove = useDeleteSourceText(subjectId, source.id)
  const leaves = textUnits(source)
  const withPages = leaves.filter((u) => u.pageStart !== null)
  const base = `/subjects/${subjectId}/sources/${source.id}`
  const has = !hidden && (status.data?.passages ?? 0) > 0

  const finish = (pages: PageText[], offset: number) => {
    const chunks = unitChunks(pages, leaves, offset)
    const read = coverage(chunks)
    save.mutate({ chunks, pages: Math.max(read.pages, 1) })
    setPhase({ kind: 'done', chunks, pages: read.pages })
  }

  const read = async (file: File) => {
    setHidden(false)
    setPhase({ kind: 'reading', page: 0, total: 0 })
    try {
      const pdf = await readPdfPages(file, (page, total) =>
        setPhase({ kind: 'reading', page, total }),
      )
      if (pdf.scanned) {
        setPhase({ kind: 'scanned', fileName: file.name, pageCount: pdf.pageCount })
        return
      }
      const found = pageOffset(pdf.pages, leaves, pdf.labels)
      if (found.sure) finish(pdf.pages, found.offset)
      else setPhase({ kind: 'confirm', pages: pdf.pages, offset: found.offset })
    } catch {
      setPhase({ kind: 'failed' })
    }
  }

  const removeText = () => {
    setHidden(true)
    setPhase({ kind: 'pick' })
    remove.mutate(undefined, { onError: () => setHidden(false) })
  }

  const sub =
    phase.kind === 'scanned'
      ? t('sources.text.fileSub', { name: phase.fileName, count: phase.pageCount })
      : source.title
  const title = <ScreenTitle title={t('sources.text.title')} sub={sub} />
  const picker = (
    <input
      ref={input}
      type="file"
      accept="application/pdf"
      className="hidden"
      onChange={(e) => {
        const file = e.target.files?.[0]
        e.target.value = ''
        if (file) void read(file)
      }}
    />
  )
  const pick = () => input.current?.click()

  if (!online && phase.kind === 'pick')
    return (
      <>
        {title}
        <OfflineNotice />
      </>
    )

  const chapterList = (readTo: number) => (
    <div className={card}>
      {chapters(source, leaves).map((c, i) => {
        const done = readTo >= c.to
        return (
          <div key={`${c.title}-${i}`} className={cn(row, rowLine)}>
            <span
              className={cn(
                tile,
                'text-[15px] font-bold tabular-nums',
                done
                  ? 'bg-subject-green-soft text-subject-green-ink'
                  : 'bg-raised text-ink-secondary',
              )}
            >
              {c.label ?? i + 1}
            </span>
            <span className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="truncate text-[15px] font-bold">{c.title}</span>
              <span className="text-[13px] text-ink-secondary tabular-nums">
                {t(done ? 'sources.text.pagesRead' : 'sources.text.pages', {
                  from: c.from,
                  to: c.to,
                })}
              </span>
            </span>
          </div>
        )
      })}
    </div>
  )

  return (
    <>
      {title}
      {picker}
      <div className="mt-2 flex flex-col gap-3">
        {phase.kind === 'pick' && !has && (
          <div className="flex animate-settle-in flex-col gap-3">
            <section className="flex flex-col gap-2 rounded-[24px] bg-subject-lavender-soft p-[18px] text-subject-lavender-ink">
              <h2 className="text-xl leading-[1.2] font-bold">{t('sources.text.introTitle')}</h2>
              <p className="text-[15px] leading-[22px]">{t('sources.text.introBody')}</p>
            </section>
            {withPages.length === 0 ? (
              <p className="rounded-[20px] surface p-4 text-sm text-ink-secondary">
                {t('sources.text.noPages')}
              </p>
            ) : (
              <>
                <h2 className={h2}>{t('sources.text.whereFrom')}</h2>
                <div className={card}>
                  <button type="button" onClick={pick} className={row}>
                    <span className={cn(tile, 'bg-brand-soft text-brand-strong')}>
                      <DocIcon size={20} />
                    </span>
                    <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                      <span className="text-[15px] font-bold">{t('sources.text.device')}</span>
                      <span className="text-[13px] text-ink-secondary">
                        {t('sources.text.deviceSub')}
                      </span>
                    </span>
                    <ChevronRightIcon size={20} />
                  </button>
                </div>
                <p className="px-1 text-[13px] leading-[1.4] text-ink-secondary">
                  {t('sources.text.private')}
                </p>
              </>
            )}
          </div>
        )}

        {phase.kind === 'pick' && has && status.data && (
          <Saved
            pages={source.text_pages}
            units={status.data.units}
            passages={status.data.passages}
            embedded={status.data.embedded}
          />
        )}

        {phase.kind === 'reading' && (
          <div className="flex animate-settle-in flex-col gap-3">
            <section className="flex flex-col gap-2.5 rounded-[24px] bg-brand-soft px-[18px] py-4">
              <div className="flex items-baseline justify-between">
                <span className="font-display text-[30px] font-bold tabular-nums">
                  {phase.total ? Math.round((phase.page / phase.total) * 100) : 0}%
                </span>
                <span className="text-sm font-bold text-brand-strong tabular-nums">
                  {t('sources.text.progress', { page: phase.page, total: phase.total || '…' })}
                </span>
              </div>
              <div
                role="progressbar"
                aria-label={t('sources.text.progressLabel')}
                aria-valuemin={0}
                aria-valuemax={phase.total}
                aria-valuenow={phase.page}
                className="h-2.5 overflow-hidden rounded-full bg-ground/70"
              >
                <span
                  className="block h-full rounded-full bg-brand transition-[width] duration-400 ease-[cubic-bezier(.22,1,.36,1)]"
                  style={{ width: `${phase.total ? (phase.page / phase.total) * 100 : 0}%` }}
                />
              </div>
              <span className="text-sm text-brand-strong">{t('sources.text.reading')}</span>
            </section>
            <h2 className={h2}>{t('sources.text.byChapter')}</h2>
            {chapterList(phase.page)}
          </div>
        )}

        {phase.kind === 'confirm' && (
          <Confirm
            unit={withPages[0]!}
            pages={phase.pages}
            offset={phase.offset}
            onOffset={(offset) => setPhase({ ...phase, offset })}
            onSave={() => finish(phase.pages, phase.offset)}
          />
        )}

        {phase.kind === 'done' && (
          <>
            <Saved
              pages={phase.pages}
              units={coverage(phase.chunks).units}
              passages={phase.chunks.length}
              embedded={null}
            />
            {withPages.length < leaves.length && (
              <p className="px-1 text-[13px] text-ink-secondary">
                {t('sources.text.missingPages', { count: leaves.length - withPages.length })}
              </p>
            )}
            {save.isError && (
              <p role="alert" className="px-1 text-sm text-danger">
                {t('common.saveFailed')}
              </p>
            )}
          </>
        )}

        {phase.kind === 'scanned' && (
          <Scanned onPaste={() => setPasting(true)} onOther={pick} base={base} />
        )}

        {phase.kind === 'failed' && (
          <div className="flex flex-col gap-3 rounded-[24px] bg-ai-soft p-5 text-ai-ink">
            <span className="text-[15px] font-semibold">{t('sources.text.failed')}</span>
            <button
              type="button"
              onClick={pick}
              className="flex h-12 items-center justify-center rounded-[16px] bg-raised text-[15px] font-bold text-brand-strong"
            >
              {t('sources.text.other')}
            </button>
          </div>
        )}
      </div>

      <div className="sticky bottom-[calc(16px+var(--nav-offset,0px)+env(safe-area-inset-bottom))] z-10 -mx-5 mt-6 flex flex-col gap-1 bg-ground px-5 pt-3">
        {phase.kind === 'reading' && (
          <button
            type="button"
            disabled
            className="btn-primary h-14 rounded-[16px] text-[17px] font-bold"
          >
            {t('sources.text.readingButton')}
          </button>
        )}
        {(phase.kind === 'done' || (phase.kind === 'pick' && has)) && (
          <>
            <Link
              to={base}
              className="btn-primary flex h-14 items-center justify-center rounded-[16px] text-[17px] font-bold"
            >
              {t('sources.text.done')}
            </Link>
            <div className="flex">
              <button
                type="button"
                onClick={pick}
                className="flex h-12 flex-1 items-center justify-center text-[15px] font-bold text-brand-strong"
              >
                {t('sources.text.again')}
              </button>
              {phase.kind === 'pick' && (
                <button
                  type="button"
                  onClick={removeText}
                  className="flex h-12 flex-1 items-center justify-center text-[15px] font-bold text-danger"
                >
                  {t('sources.text.delete')}
                </button>
              )}
            </div>
          </>
        )}
        {phase.kind === 'scanned' && (
          <Link
            to={base}
            className="flex h-[52px] items-center justify-center rounded-[16px] text-[15px] font-bold text-brand-strong shadow-[inset_0_0_0_1.5px_var(--color-brand)]"
          >
            {t('sources.text.back')}
          </Link>
        )}
      </div>

      <PasteSheet
        open={pasting}
        onOpenChange={setPasting}
        subjectId={subjectId}
        source={source}
        units={leaves}
      />
    </>
  )
}

function Saved({
  pages,
  units,
  passages,
  embedded,
}: {
  pages: number | null
  units: number
  passages: number
  /** Searchable passages; null right after reading (vectors come in the background). */
  embedded: number | null
}) {
  const { t } = useTranslation()
  return (
    <div className="flex animate-settle-in flex-col gap-3">
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-0.5 rounded-[24px] bg-subject-green-soft p-4 text-subject-green-ink">
          <span className="text-[13px] font-bold">{t('sources.text.read')}</span>
          <span className="font-display text-[28px] font-bold tabular-nums">
            {pages ? t('sources.text.pagesValue', { count: pages }) : '—'}
          </span>
          <span className="text-[13px]">{t('sources.text.units', { count: units })}</span>
        </div>
        <div className="flex flex-col gap-0.5 rounded-[24px] surface p-4">
          <span className="text-[13px] font-bold text-ink-secondary">
            {t('sources.text.passages')}
          </span>
          <span className="font-display text-[28px] font-bold tabular-nums">{passages}</span>
          <span className="text-[13px] text-ink-secondary tabular-nums">
            {embedded === null || embedded >= passages
              ? t('sources.text.passagesSub')
              : t('sources.text.embedding', { done: embedded, total: passages })}
          </span>
        </div>
      </div>
      <h2 className={h2}>{t('sources.text.saved')}</h2>
      <div className={card}>
        <div className={cn(row, rowLine)}>
          <span className={cn(tile, 'bg-subject-green-soft text-subject-green-ink')}>
            <CheckIcon size={18} />
          </span>
          <span className="flex min-w-0 flex-1 flex-col gap-0.5">
            <span className="text-[15px] font-bold">{t('sources.text.savedText')}</span>
            <span className="text-[13px] text-ink-secondary">{t('sources.text.savedTextSub')}</span>
          </span>
        </div>
        <div className={cn(row, rowLine)}>
          <span
            className={cn(
              tile,
              'bg-raised text-ink-secondary shadow-[inset_0_0_0_1.5px_var(--color-line)]',
            )}
          >
            <CloseIcon size={16} />
          </span>
          <span className="flex min-w-0 flex-1 flex-col gap-0.5">
            <span className="text-[15px] font-bold">{t('sources.text.original')}</span>
            <span className="text-[13px] text-ink-secondary">{t('sources.text.originalSub')}</span>
          </span>
        </div>
      </div>
      <p className="px-1 text-[13px] leading-[1.4] text-ink-secondary">
        {t('sources.text.deleteHint')}
      </p>
    </div>
  )
}

/** Hoot could not tell where the book's pages start: one question, with the PDF page shown. */
function Confirm({
  unit,
  pages,
  offset,
  onOffset,
  onSave,
}: {
  unit: TextUnit
  pages: PageText[]
  offset: number
  onOffset: (offset: number) => void
  onSave: () => void
}) {
  const { t } = useTranslation()
  const bookPage = unit.pageStart!
  const pdfPage = bookPage + offset
  const text = pages.find((p) => p.page === pdfPage)?.text ?? ''
  return (
    <div className="flex animate-settle-in flex-col gap-3">
      <section className="flex flex-col gap-2 rounded-[24px] bg-ai-soft p-5 text-ai-ink">
        <h2 className="text-[22px] leading-[1.2] font-bold">
          {t('sources.text.confirmTitle', { page: bookPage })}
        </h2>
        <p className="text-[15px] leading-[22px]">
          {t('sources.text.confirmBody', { title: unit.title, page: bookPage })}
        </p>
      </section>
      <Stepper
        label={t('sources.text.pdfPage')}
        value={String(pdfPage)}
        less={t('sources.text.pdfPageLess')}
        more={t('sources.text.pdfPageMore')}
        onLess={() => onOffset(offset - 1)}
        onMore={() => onOffset(offset + 1)}
        min={pdfPage <= 1}
        max={pdfPage >= pages.length}
      />
      <p className="line-clamp-6 rounded-[18px] surface px-4 py-3 text-sm leading-[1.45] whitespace-pre-line text-ink-secondary">
        {text || t('sources.text.emptyPage')}
      </p>
      <button
        type="button"
        onClick={onSave}
        className="btn-primary flex h-14 items-center justify-center rounded-[16px] text-[17px] font-bold"
      >
        {t('common.save')}
      </button>
    </div>
  )
}

function Scanned({
  onPaste,
  onOther,
  base,
}: {
  onPaste: () => void
  onOther: () => void
  base: string
}) {
  const { t } = useTranslation()
  return (
    <div className="flex animate-settle-in flex-col gap-3">
      <section className="flex flex-col gap-2.5 rounded-[24px] bg-ai-soft p-5 text-ai-ink">
        <span className="flex items-center gap-2 text-sm font-bold">
          <WarningIcon size={20} />
          {t('sources.text.scannedTag')}
        </span>
        <h2 className="text-[22px] leading-[1.2] font-bold">{t('sources.text.scannedTitle')}</h2>
        <p className="text-[15px] leading-[22px]">{t('sources.text.scannedBody')}</p>
      </section>
      <h2 className={h2}>{t('sources.text.now')}</h2>
      <div className={card}>
        <button type="button" onClick={onPaste} className={cn(row, rowLine)}>
          <span className={cn(tile, 'bg-brand-soft text-brand-strong')}>
            <PencilIcon size={20} />
          </span>
          <span className="flex min-w-0 flex-1 flex-col gap-0.5">
            <span className="text-[15px] font-bold">{t('sources.text.paste')}</span>
            <span className="text-[13px] text-ink-secondary">{t('sources.text.pasteSub')}</span>
          </span>
          <ChevronRightIcon size={20} />
        </button>
        <button type="button" onClick={onOther} className={cn(row, rowLine)}>
          <span className={cn(tile, 'bg-subject-lavender-soft text-subject-lavender-ink')}>
            <DocIcon size={20} />
          </span>
          <span className="flex min-w-0 flex-1 flex-col gap-0.5">
            <span className="text-[15px] font-bold">{t('sources.text.other')}</span>
            <span className="text-[13px] text-ink-secondary">{t('sources.text.otherSub')}</span>
          </span>
          <ChevronRightIcon size={20} />
        </button>
        <Link to={base} className={cn(row, rowLine)}>
          <span
            className={cn(
              tile,
              'bg-raised text-ink-secondary shadow-[inset_0_0_0_1.5px_var(--color-line)]',
            )}
          >
            <BookIcon size={20} />
          </span>
          <span className="flex min-w-0 flex-1 flex-col gap-0.5">
            <span className="text-[15px] font-bold">{t('sources.text.notesOnly')}</span>
            <span className="text-[13px] text-ink-secondary">{t('sources.text.notesOnlySub')}</span>
          </span>
          <ChevronRightIcon size={20} />
        </Link>
      </div>
      <p className="px-1 text-[13px] leading-[1.4] text-ink-secondary">
        {t('sources.text.scannedHint')}
      </p>
    </div>
  )
}

/** "Zalijepi tekst poglavlja": a unit and its text. */
function PasteSheet({
  open,
  onOpenChange,
  subjectId,
  source,
  units,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  subjectId: string
  source: SourceWithUnits
  units: TextUnit[]
}) {
  const { t } = useTranslation()
  const show = useToast((s) => s.show)
  const save = useSaveUnitText(subjectId, source.id)
  const [unitId, setUnitId] = useState<string>(units[0]?.id ?? '')
  const [text, setText] = useState('')
  const unit = units.find((u) => u.id === unitId)
  return (
    <BottomSheet open={open} onOpenChange={onOpenChange} title={t('sources.text.pasteTitle')}>
      <div className="flex flex-col gap-3">
        <label className="flex flex-col gap-1.5">
          <span className="px-1 text-sm font-bold">{t('sources.text.pasteUnit')}</span>
          <select
            value={unitId}
            onChange={(e) => setUnitId(e.target.value)}
            className="h-12 rounded-[14px] surface px-3 text-[15px]"
          >
            {units.map((u) => (
              <option key={u.id} value={u.id}>
                {u.title}
              </option>
            ))}
          </select>
        </label>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={8}
          aria-label={t('sources.text.pasteTitle')}
          placeholder={t('sources.text.pastePlaceholder')}
          className="rounded-[16px] bg-raised p-3 text-[15px] leading-[1.45] shadow-[inset_0_0_0_1.5px_var(--color-line)] placeholder:text-ink-placeholder"
        />
        <button
          type="button"
          disabled={!unit || !text.trim() || save.isPending}
          onClick={() =>
            save.mutate(
              { unitId, page: unit?.pageStart ?? 1, text },
              {
                onSuccess: () => {
                  setText('')
                  onOpenChange(false)
                  show(t('sources.text.pasted'))
                },
              },
            )
          }
          className="btn-primary flex h-14 items-center justify-center rounded-[16px] text-[17px] font-bold"
        >
          {t('common.save')}
        </button>
      </div>
    </BottomSheet>
  )
}
