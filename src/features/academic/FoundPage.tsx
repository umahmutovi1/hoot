import { useEffect, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { DocIcon } from '@/components/icons'
import { ScreenTitle } from '@/components/ScreenTitle'
import { Button } from '@/components/ui/button'
import { AiCallError } from '@/features/owl/api'
import { documentFromLink } from '@/features/owl/link'
import type { GiveResult } from '@/features/owl/actions'
import { GiveDocumentSheet } from '@/features/owl/GiveDocumentSheet'
import { useOwlStore } from '@/features/owl/store'
import { useOwl } from '@/features/owl/useOwl'
import { useProfile } from '@/features/settings/profile'
import { yearLabelOn } from '@/lib/academic'
import { cn } from '@/lib/utils'
import type { FoundDocument } from '@shared/schemas'
import { useAcademicTerm } from './api'
import { useAcademicSearch, useFindAcademicInfo } from './search'

const hostOf = (url: string) => {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return url
  }
}

/**
 * "Nađeno na internetu" (PlanIProgram.dc.html 1–2): documents find-academic-info found for the
 * faculty, with their link and the year they say. "Uvezi" reads one through the same
 * parse-document review as a given PDF; nothing is saved without it. `?search=1` searches first
 * (the same search is answered from the profile, without an AI call).
 */
export function FoundPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const { data: profile } = useProfile()
  const { years, today } = useAcademicTerm()
  const search = useAcademicSearch()
  const find = useFindAcademicInfo()
  const owl = useOwl()
  const openSheet = useOwlStore((s) => s.openSheet)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState<Record<string, Extract<GiveResult, { ok: true }>>>({})
  const newConversation = useOwlStore((s) => s.newConversation)
  // The year the documents should be for: the current academic year, else today's label.
  const academicYear =
    years.find((y) => y.startsOn <= today && today <= y.endsOn)?.label ?? yearLabelOn(today)
  const started = useRef(false)

  useEffect(() => {
    if (started.current || params.get('search') !== '1' || !profile?.institution) return
    started.current = true
    find.mutate(academicYear)
  }, [params, profile?.institution, academicYear, find])

  const docs = search?.documents ?? []
  const subtitle = [
    profile?.institution,
    profile?.study_program,
    profile?.year_of_study ? t('academic.found.year', { n: profile.year_of_study }) : null,
  ]
    .filter(Boolean)
    .join(' · ')

  // "Uvezi" reads the document here; the row then opens its review, which comes back here.
  const importDoc = async (doc: FoundDocument) => {
    setBusy(doc.url)
    setError(null)
    try {
      const got = await documentFromLink(doc.url)
      const kind =
        doc.kind === 'academic_calendar'
          ? 'academic_calendar'
          : doc.kind === 'syllabus'
            ? 'syllabus'
            : 'auto'
      newConversation()
      const result = await owl.giveDocument(got.input, kind, null, {
        url: doc.url,
        academicYear: doc.academic_year,
      })
      if (result.ok) setDone((d) => ({ ...d, [doc.url]: result }))
      else setError(t(`owl.error.${result.code}`))
    } catch (err) {
      setError(t(`owl.error.${err instanceof AiCallError ? err.code : 'failed'}`))
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="flex flex-col gap-3.5">
      <ScreenTitle title={t('academic.found.title')} />
      <GiveDocumentSheet />
      {subtitle && (
        <p className="-mt-1.5 px-1 text-sm leading-[1.4] text-ink-secondary">{subtitle}</p>
      )}

      {find.isPending && (
        <p className="rounded-card glass p-4 text-sm text-ink-muted">
          {t('academic.found.searching')}
        </p>
      )}
      {find.isError && (
        <p role="alert" className="text-sm text-danger">
          {t(`owl.error.${find.error instanceof AiCallError ? find.error.code : 'failed'}`)}
        </p>
      )}

      {!find.isPending && docs.length > 0 && (
        <>
          <div className="flex flex-col divide-y divide-hairline rounded-card glass">
            {docs.map((d) => {
              const yearOk = d.academic_year === academicYear
              return (
                <div key={d.url} className="flex items-start gap-3 p-3.5">
                  <span
                    aria-hidden="true"
                    className="icon-tile flex size-9 shrink-0 items-center justify-center rounded-[12px]"
                  >
                    <DocIcon size={18} />
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col gap-1">
                    <span className="text-xs font-semibold text-ink-muted">
                      {t(`academic.found.kind.${d.kind}`)}
                    </span>
                    <span className="text-[15px] leading-snug font-semibold">{d.title}</span>
                    <span className="flex flex-wrap items-center gap-2">
                      <a
                        href={d.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[13px] font-semibold text-brand"
                      >
                        {hostOf(d.url)} ↗
                      </a>
                      <span
                        className={cn(
                          'rounded-full px-2 py-0.5 text-[11px] font-semibold',
                          yearOk
                            ? 'bg-success-soft text-success-ink'
                            : 'bg-warning-soft text-warning-ink',
                        )}
                      >
                        {d.academic_year
                          ? yearOk
                            ? d.academic_year
                            : t('academic.found.checkYear', { year: d.academic_year })
                          : t('academic.found.noYear')}
                      </span>
                    </span>
                  </span>
                  <button
                    type="button"
                    disabled={busy !== null || (done[d.url] && !done[d.url]!.proposalId)}
                    onClick={() => {
                      const result = done[d.url]
                      if (result?.proposalId) navigate(`/chat/import/${result.proposalId}`)
                      else void importDoc(d)
                    }}
                    className="flex h-11 shrink-0 items-center rounded-full bg-canvas px-3.5 text-[13px] font-semibold text-brand disabled:opacity-50"
                  >
                    {busy === d.url
                      ? t('academic.found.importing')
                      : done[d.url]
                        ? done[d.url]!.proposalId
                          ? t('academic.found.review')
                          : t('academic.found.nothing')
                        : t('academic.found.import')}
                  </button>
                </div>
              )
            })}
          </div>
          <p className="rounded-[18px] bg-warning-soft px-3.5 py-2.5 text-[13px] leading-[1.4] text-warning-ink">
            {t('academic.found.warning', { year: academicYear })}
          </p>
        </>
      )}

      {!find.isPending && search && docs.length === 0 && (
        <div className="flex flex-col items-start gap-3 rounded-card glass p-4">
          <span className="text-base font-semibold">
            {t('academic.found.none', { year: academicYear })}
          </span>
          <span className="text-sm leading-[1.4] text-ink-secondary">
            {t('academic.found.noneSub')}
          </span>
          <Button
            type="button"
            size="pill"
            className="btn-primary"
            onClick={() => openSheet('syllabus')}
          >
            {t('academic.found.addPdf')}
          </Button>
        </div>
      )}

      {!find.isPending && (
        <p className="px-1 text-sm leading-[1.4] text-ink-secondary">
          {t('academic.found.haveLink')}{' '}
          <button
            type="button"
            onClick={() => openSheet('auto', { link: true })}
            className="inline-flex min-h-11 items-center font-semibold text-brand"
          >
            {t('academic.found.pasteLink')}
          </button>
        </p>
      )}

      {!find.isPending && !search && (
        <Button
          type="button"
          size="pill"
          className="btn-primary"
          disabled={!profile?.institution}
          onClick={() => find.mutate(academicYear)}
        >
          {t('academic.found.search')}
        </Button>
      )}
      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
      <p className="px-1 text-xs leading-[1.4] text-ink-muted">{t('academic.found.privacy')}</p>
    </div>
  )
}
