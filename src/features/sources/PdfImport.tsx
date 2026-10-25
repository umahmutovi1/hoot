import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { DocIcon } from '@/components/icons'
import { Button } from '@/components/ui/button'
import { useLocale } from '@/features/settings/useLocale'
import { fromAi, type AiOutline } from '@/lib/outline/ai'
import type { Measure } from '@/lib/outline/parse'
import { filesAsUnits, findTocPages, offsetFromLabels, pdfOutlineUnits } from '@/lib/outline/pdf'
import { cn } from '@/lib/utils'
import { downloadDriveFile, pickDriveFiles } from './drive'
import { readPdf, type PdfInfo } from './pdfRead'

/** Where the units came from, kept on the source. */
export interface PdfOrigin {
  fileName: string | null
  driveFileId: string | null
  externalUrl: string | null
}

interface Loaded {
  info: PdfInfo
  name: string
  origin: PdfOrigin
}

const MAX_TOC_PAGES = 8

/**
 * "PDF s uređaja" and "Google Drive" on Novi izvor (Materijali.dc.html, Stage 10c). A PDF with an
 * outline becomes units without an AI call; without one only the table-of-contents pages go to
 * the model (`onAiText`). Presentations, and several PDFs at once, are one unit per file.
 */
export function PdfImport({
  source,
  measure,
  title,
  onTitle,
  onReview,
  onAiText,
  onTypeInstead,
  aiReady,
  busy,
}: {
  source: 'pdf' | 'drive'
  measure: Measure
  title: string
  onTitle: (title: string) => void
  onReview: (outline: AiOutline, origin: PdfOrigin) => void
  onAiText: (text: string, origin: PdfOrigin) => void
  onTypeInstead: () => void
  aiReady: boolean
  busy: boolean
}) {
  const { t } = useTranslation()
  const { locale } = useLocale()
  const input = useRef<HTMLInputElement>(null)
  const [loaded, setLoaded] = useState<Loaded | null>(null)
  const [several, setSeveral] = useState<{ name: string; pages: number }[] | null>(null)
  const [reading, setReading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [shift, setShift] = useState(false)
  const [toc, setToc] = useState<{ from: number; to: number }>({ from: 1, to: 1 })

  useEffect(() => () => void loaded?.info.close(), [loaded])

  // Metadata titles are often a file name or the editor's ("Microsoft Word - …"): then the name.
  const usable = (title: string | null) =>
    title && !/\.(?:html?|docx?|pdf|tex|pptx?)$/i.test(title) && !/^microsoft /i.test(title)
      ? title
      : null
  const nameTitle = (name: string, info?: PdfInfo) =>
    usable(info?.title ?? null) ?? name.replace(/\.pdf$/i, '').replace(/[_]+/g, ' ')

  const open = async (data: ArrayBuffer, name: string, origin: PdfOrigin) => {
    const info = await readPdf(data)
    setLoaded({ info, name, origin })
    setSeveral(null)
    setShift(false)
    setToc(findTocPages(info.firstPages) ?? { from: 1, to: Math.min(5, info.pageCount) })
    if (!title.trim()) onTitle(nameTitle(name, info))
  }

  const run = async (work: () => Promise<void>) => {
    setReading(true)
    setError(null)
    try {
      await work()
    } catch {
      setError(t('sources.pdf.failed'))
    } finally {
      setReading(false)
    }
  }

  const fromDevice = (file: File) =>
    run(() =>
      file
        .arrayBuffer()
        .then((data) =>
          open(data, file.name, { fileName: file.name, driveFileId: null, externalUrl: null }),
        ),
    )

  const fromDrive = () =>
    run(async () => {
      const picked = await pickDriveFiles(locale)
      if (!picked || picked.files.length === 0) return
      if (picked.files.length === 1) {
        const f = picked.files[0]!
        const data = await downloadDriveFile(f.id, picked.token)
        await open(data, f.name, { fileName: f.name, driveFileId: f.id, externalUrl: f.url })
        return
      }
      // Several PDFs (e.g. a folder of lectures): one source, one unit per file.
      const files: { name: string; pages: number }[] = []
      for (const f of picked.files) {
        const info = await readPdf(await downloadDriveFile(f.id, picked.token))
        files.push({ name: f.name, pages: info.pageCount })
        await info.close()
      }
      setLoaded(null)
      setSeveral(files)
    })

  const offset = loaded ? offsetFromLabels(loaded.info.labels) : 0
  const perFile = measure === 'slides'
  const hasOutline = Boolean(loaded && loaded.info.outline.length > 0)

  const review = () => {
    if (several) {
      onReview(fromAi(filesAsUnits(several), measure), {
        fileName: null,
        driveFileId: null,
        externalUrl: null,
      })
      return
    }
    if (!loaded) return
    const units = perFile
      ? filesAsUnits([{ name: loaded.name, pages: loaded.info.pageCount }])
      : pdfOutlineUnits(loaded.info.outline, loaded.info.pageCount, shift ? offset : 0)
    onReview(fromAi(units, measure), loaded.origin)
  }

  const aiFromToc = () =>
    loaded &&
    run(async () => {
      const text = await loaded.info.pagesText(toc.from, toc.to)
      onAiText(text, loaded.origin)
    })

  return (
    <div className="flex flex-col gap-3">
      {source === 'pdf' && (
        <input
          ref={input}
          type="file"
          accept="application/pdf"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0]
            e.target.value = ''
            if (file) void fromDevice(file)
          }}
        />
      )}

      {!loaded && !several && (
        <Button
          type="button"
          size="pill"
          variant="outline"
          disabled={reading}
          onClick={() => (source === 'pdf' ? input.current?.click() : void fromDrive())}
          className="glass"
        >
          {reading
            ? t('sources.pdf.reading')
            : t(source === 'pdf' ? 'sources.pdf.pick' : 'sources.pdf.pickDrive')}
        </Button>
      )}

      {loaded && (
        <FileRow
          name={loaded.name}
          sub={t(loaded.origin.driveFileId ? 'sources.pdf.fromDrive' : 'sources.pdf.onDevice', {
            pages: loaded.info.pageCount,
          })}
          onChange={() => (source === 'pdf' ? input.current?.click() : void fromDrive())}
        />
      )}
      {several && (
        <FileRow
          name={t('sources.pdf.severalName', { count: several.length })}
          sub={t('sources.pdf.severalSub')}
          onChange={() => void fromDrive()}
        />
      )}

      {(several || (loaded && perFile)) && (
        <p className="rounded-[18px] bg-success-soft px-3.5 py-2.5 text-[13px] leading-[1.4] text-success-ink">
          {t('sources.pdf.perFile')}
        </p>
      )}

      {loaded && !perFile && hasOutline && (
        <>
          <p className="rounded-[18px] bg-success-soft px-3.5 py-2.5 text-[13px] leading-[1.4] text-success-ink">
            {t('sources.pdf.outlineFound', { count: loaded.info.outline.length })}
          </p>
          {offset > 0 && (
            <div className="flex flex-col gap-1.5">
              <span className="text-sm font-semibold">{t('sources.pdf.pagesLabel')}</span>
              <div className="flex gap-1.5">
                {[false, true].map((on) => (
                  <button
                    key={String(on)}
                    type="button"
                    aria-pressed={shift === on}
                    onClick={() => setShift(on)}
                    className={cn(
                      'h-[38px] rounded-full px-3.5 text-[13px] font-semibold',
                      shift === on ? 'bg-ink text-white' : 'bg-white/50',
                    )}
                  >
                    {on ? t('sources.pdf.shift', { n: offset }) : t('sources.pdf.asInPdf')}
                  </button>
                ))}
              </div>
              <span className="text-xs leading-[1.4] text-ink-muted">
                {t('sources.pdf.shiftHint', { n: offset })}
              </span>
            </div>
          )}
        </>
      )}

      {loaded && !perFile && !hasOutline && (
        <>
          <p className="rounded-[18px] bg-warning-soft px-3.5 py-2.5 text-[13px] leading-[1.4] text-warning-ink">
            {t('sources.pdf.noOutline')}
          </p>
          <div className="flex flex-col gap-1.5">
            <span className="text-sm font-semibold">{t('sources.pdf.tocPages')}</span>
            <div className="flex items-center gap-2">
              <PageInput
                label={t('sources.pdf.tocFrom')}
                value={toc.from}
                max={loaded.info.pageCount}
                onChange={(from) => setToc((x) => ({ from, to: Math.max(from, x.to) }))}
              />
              <span aria-hidden="true">–</span>
              <PageInput
                label={t('sources.pdf.tocTo')}
                value={toc.to}
                max={loaded.info.pageCount}
                onChange={(to) =>
                  setToc((x) => ({
                    from: Math.min(x.from, to),
                    to: Math.min(to, x.from + MAX_TOC_PAGES - 1),
                  }))
                }
              />
            </div>
            <span className="text-xs leading-[1.4] text-ink-muted">{t('sources.pdf.tocHint')}</span>
          </div>
          <Button
            type="button"
            size="pill"
            className="btn-primary"
            disabled={!aiReady || busy || reading}
            onClick={() => void aiFromToc()}
          >
            {busy || reading ? t('sources.import.reading') : t('sources.import.extract')}
          </Button>
          {!aiReady && (
            <span className="text-[13px] text-ink-muted">{t('sources.import.noAi')}</span>
          )}
          <button
            type="button"
            onClick={onTypeInstead}
            className="h-11 text-sm font-semibold text-brand"
          >
            {t('sources.pdf.typeInstead')}
          </button>
        </>
      )}

      {(several || (loaded && (perFile || hasOutline))) && (
        <Button type="button" size="pill" className="btn-primary" onClick={review}>
          {t('sources.editor.review')}
        </Button>
      )}

      {error && (
        <span role="alert" className="text-sm text-danger">
          {error}
        </span>
      )}
      <span className="text-center text-xs text-ink-muted">{t('sources.pdf.privacy')}</span>
    </div>
  )
}

function FileRow({ name, sub, onChange }: { name: string; sub: string; onChange: () => void }) {
  const { t } = useTranslation()
  return (
    <div className="flex items-center gap-3 rounded-[20px] glass p-3">
      <span
        aria-hidden="true"
        className="flex size-10 shrink-0 items-center justify-center rounded-[12px] bg-danger/10 text-danger"
      >
        <DocIcon size={18} />
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="truncate text-[15px] font-semibold">{name}</span>
        <span className="text-xs text-ink-muted">{sub}</span>
      </span>
      <button
        type="button"
        onClick={onChange}
        className="flex h-11 shrink-0 items-center px-2 text-sm font-semibold text-brand"
      >
        {t('sources.pdf.change')}
      </button>
    </div>
  )
}

function PageInput({
  label,
  value,
  max,
  onChange,
}: {
  label: string
  value: number
  max: number
  onChange: (n: number) => void
}) {
  return (
    <input
      type="number"
      inputMode="numeric"
      aria-label={label}
      min={1}
      max={max}
      value={value}
      onChange={(e) => {
        const n = Math.round(Number(e.target.value))
        if (Number.isFinite(n) && n >= 1 && n <= max) onChange(n)
      }}
      className="h-12 w-20 rounded-input glass text-center text-base outline-none focus-visible:ring-2 focus-visible:ring-brand-accent"
    />
  )
}
